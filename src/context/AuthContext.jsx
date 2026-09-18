import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { getSupabaseClient, isSupabaseConfigured } from '../lib/supabaseClient'
import { disableDevicePush, readPushBinding } from '../lib/devicePush'
import { LEGAL_TERMS_VERSION, PRIVACY_VERSION } from '../legal/legalContent'

const AuthContext = createContext(null)
const IDLE_TIMEOUT_MS = 30 * 60 * 1000
// Registro público cerrado hasta implementar invitaciones validadas en servidor.
// Ninguna variable VITE_ debe actuar como secreto o autorización de registro.
const PUBLIC_SIGNUP_ENABLED = false
const PROFILE_COLUMNS = 'id, display_name, access_status, service_plan, account_role, legal_terms_version, terms_accepted_at, privacy_version, privacy_accepted_at'
const LEGACY_PROFILE_COLUMNS = 'id, display_name, access_status, service_plan, legal_terms_version, terms_accepted_at, privacy_version, privacy_accepted_at'

function usernameToEmail(username) {
  // Supabase Auth necesita una identidad con formato de email para usar
  // contraseñas. Reutilizamos el host real del proyecto como identificador
  // interno para que Supabase lo acepte sin pedirle un correo al usuario.
  const projectHostname = new URL(import.meta.env.VITE_SUPABASE_URL).hostname
  return `${username.trim().toLowerCase()}@${projectHostname}`
}

async function fetchProfile(userId) {
  const client = getSupabaseClient()
  const withRole = await client
    .from('profiles')
    .select(PROFILE_COLUMNS)
    .eq('id', userId)
    .maybeSingle()

  if (!withRole.error) return withRole

  const message = withRole.error.message ?? ''
  if (withRole.error.code !== 'PGRST204' && !message.includes('account_role')) return withRole

  return client
    .from('profiles')
    .select(LEGACY_PROFILE_COLUMNS)
    .eq('id', userId)
    .maybeSingle()
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

    const { data, error } = await fetchProfile(userId)

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

    fetchProfile(session.user.id)
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
      requiresSignupAccessCode: false,
      hasAcceptedCurrentLegal: Boolean(
        profile?.id === session?.user?.id
          && profile?.terms_accepted_at
          && profile?.privacy_accepted_at
          && profile?.legal_terms_version === LEGAL_TERMS_VERSION
          && profile?.privacy_version === PRIVACY_VERSION,
      ),
      isAccessActive: Boolean(profile?.id === session?.user?.id && profile?.access_status === 'active'),
      isAdmin: Boolean(profile?.id === session?.user?.id && profile?.access_status === 'active' && (profile?.account_role === 'admin' || profile?.service_plan === 'internal')),
      async signIn({ username, password }) {
        const email = usernameToEmail(username)
        const { error } = await getSupabaseClient().auth.signInWithPassword({ email, password })
        if (error) throw error
      },
      async signUp() {
        const error = new Error('El registro público está cerrado. Solicita tu cuenta al administrador.')
        error.code = 'signup_disabled'
        throw error
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
