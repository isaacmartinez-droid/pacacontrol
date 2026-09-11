import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { getSupabaseClient, isSupabaseConfigured } from '../lib/supabaseClient'
import { disableDevicePush, readPushBinding } from '../lib/devicePush'
import { LEGAL_TERMS_VERSION, PRIVACY_VERSION } from '../legal/legalContent'

const AuthContext = createContext(null)
const IDLE_TIMEOUT_MS = 30 * 60 * 1000
const PUBLIC_SIGNUP_ENABLED = import.meta.env.VITE_ALLOW_PUBLIC_SIGNUP === 'true'
const SIGNUP_ACCESS_CODE = import.meta.env.VITE_SIGNUP_ACCESS_CODE?.trim() ?? ''
function usernameToEmail(username) {
  // Supabase Auth necesita una identidad con formato de email para usar
  // contraseñas. Reutilizamos el host real del proyecto como identificador
  // interno para que Supabase lo acepte sin pedirle un correo al usuario.
  const projectHostname = new URL(import.meta.env.VITE_SUPABASE_URL).hostname
  return `${username.trim().toLowerCase()}@${projectHostname}`
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [isLoading, setIsLoading] = useState(isSupabaseConfigured)
  const [profile, setProfile] = useState(null)
  const [isProfileLoading, setIsProfileLoading] = useState(false)
  const [profileError, setProfileError] = useState('')
  const inactivityTimerRef = useRef(null)

  const loadProfile = useCallback(async (userId) => {
    if (!userId) {
      setProfile(null)
      setProfileError('')
      setIsProfileLoading(false)
      return
    }

    setIsProfileLoading(true)
    setProfileError('')

    const { data, error } = await getSupabaseClient()
      .from('profiles')
      .select('id, display_name, access_status, service_plan, legal_terms_version, terms_accepted_at, privacy_version, privacy_accepted_at')
      .eq('id', userId)
      .maybeSingle()

    if (error) {
      setProfile(null)
      setProfileError(error.message)
    } else if (!data) {
      setProfile(null)
      setProfileError('No encontramos el perfil de esta cuenta. Pide al administrador que revise el acceso.')
    } else {
      setProfile(data)
      setProfileError('')
    }

    setIsProfileLoading(false)
  }, [])

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setIsLoading(false)
      return undefined
    }

    const client = getSupabaseClient()

    client.auth.getSession().then(({ data, error }) => {
      if (!error) setSession(data.session)
      setIsLoading(false)
    })

    const {
      data: { subscription },
    } = client.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
      setIsLoading(false)
      const binding = readPushBinding()
      if (_event === 'SIGNED_OUT' || (nextSession?.user && binding?.ownerId && binding.ownerId !== nextSession.user.id)) {
        disableDevicePush().catch(() => {})
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!session || !isSupabaseConfigured) return undefined

    const client = getSupabaseClient()
    const resetInactivityTimer = () => {
      window.clearTimeout(inactivityTimerRef.current)
      inactivityTimerRef.current = window.setTimeout(async () => {
        await disableDevicePush(client).catch(() => {})
        await client.auth.signOut()
      }, IDLE_TIMEOUT_MS)
    }
    const activityEvents = ['pointerdown', 'keydown', 'touchstart', 'scroll']

    activityEvents.forEach((eventName) => window.addEventListener(eventName, resetInactivityTimer, { passive: true }))
    resetInactivityTimer()

    return () => {
      window.clearTimeout(inactivityTimerRef.current)
      activityEvents.forEach((eventName) => window.removeEventListener(eventName, resetInactivityTimer))
    }
  }, [session])

  useEffect(() => {
    if (!session?.user || !isSupabaseConfigured) {
      setProfile(null)
      setProfileError('')
      setIsProfileLoading(false)
      return undefined
    }

    let cancelled = false
    setIsProfileLoading(true)
    setProfileError('')

    getSupabaseClient()
      .from('profiles')
      .select('id, display_name, access_status, service_plan, legal_terms_version, terms_accepted_at, privacy_version, privacy_accepted_at')
      .eq('id', session.user.id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return
        if (error) {
          setProfile(null)
          setProfileError(error.message)
        } else if (!data) {
          setProfile(null)
          setProfileError('No encontramos el perfil de esta cuenta. Pide al administrador que revise el acceso.')
        } else {
          setProfile(data)
          setProfileError('')
        }
      })
      .finally(() => {
        if (!cancelled) setIsProfileLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [session])

  const value = useMemo(
    () => ({
      user: session?.user ?? null,
      session,
      profile,
      isLoading,
      isProfileLoading,
      profileError,
      isConfigured: isSupabaseConfigured,
      isPublicSignupEnabled: PUBLIC_SIGNUP_ENABLED,
      requiresSignupAccessCode: Boolean(SIGNUP_ACCESS_CODE),
      hasAcceptedCurrentLegal: Boolean(
        profile?.terms_accepted_at
          && profile?.privacy_accepted_at
          && profile?.legal_terms_version === LEGAL_TERMS_VERSION
          && profile?.privacy_version === PRIVACY_VERSION,
      ),
      isAccessActive: !profile || profile.access_status === 'active',
      async signIn({ username, password }) {
        const email = usernameToEmail(username)
        const { error } = await getSupabaseClient().auth.signInWithPassword({ email, password })
        if (error) throw error
      },
      async signUp({ username, password, firstName = '', lastName = '', accessCode = '', acceptedLegal = false }) {
        if (!PUBLIC_SIGNUP_ENABLED) {
          const error = new Error('El registro publico esta cerrado. Solicita tu cuenta al administrador.')
          error.code = 'signup_disabled'
          throw error
        }
        if (SIGNUP_ACCESS_CODE && accessCode.trim() !== SIGNUP_ACCESS_CODE) {
          const error = new Error('El codigo de acceso no es valido.')
          error.code = 'invalid_invite_code'
          throw error
        }
        if (!acceptedLegal) {
          const error = new Error('Debes aceptar los terminos y la politica de privacidad.')
          error.code = 'terms_required'
          throw error
        }
        const normalizedUsername = username.trim().toLowerCase()
        const email = usernameToEmail(normalizedUsername)
        const acceptedAt = new Date().toISOString()
        const { data, error } = await getSupabaseClient().auth.signUp({
          email,
          password,
          options: {
            data: {
              display_name: `${firstName.trim()} ${lastName.trim()}`.trim() || normalizedUsername,
              username: normalizedUsername,
              first_name: firstName.trim(),
              last_name: lastName.trim(),
              legal_terms_version: LEGAL_TERMS_VERSION,
              terms_accepted_at: acceptedAt,
              privacy_version: PRIVACY_VERSION,
              privacy_accepted_at: acceptedAt,
            },
          },
        })
        if (error) throw error
        return data
      },
      async acceptLegalTerms() {
        const { data, error } = await getSupabaseClient()
          .rpc('accept_legal_terms', {
            p_terms_version: LEGAL_TERMS_VERSION,
            p_privacy_version: PRIVACY_VERSION,
          })
        if (error) throw error
        setProfile(data)
        return data
      },
      refreshProfile: () => loadProfile(session?.user?.id),
      async signOut() {
        await disableDevicePush(getSupabaseClient()).catch(() => {})
        const { error } = await getSupabaseClient().auth.signOut()
        if (error) throw error
      },
    }),
    [isLoading, isProfileLoading, loadProfile, profile, profileError, session],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth debe usarse dentro de AuthProvider.')
  return context
}
