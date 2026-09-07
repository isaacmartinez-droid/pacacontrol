import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { getSupabaseClient, isSupabaseConfigured } from '../lib/supabaseClient'
import { disableDevicePush, readPushBinding } from '../lib/devicePush'

const AuthContext = createContext(null)
const IDLE_TIMEOUT_MS = 30 * 60 * 1000
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
  const inactivityTimerRef = useRef(null)

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

  const value = useMemo(
    () => ({
      user: session?.user ?? null,
      session,
      isLoading,
      isConfigured: isSupabaseConfigured,
      async signIn({ username, password }) {
        const email = usernameToEmail(username)
        const { error } = await getSupabaseClient().auth.signInWithPassword({ email, password })
        if (error) throw error
      },
      async signUp({ username, password, firstName = '', lastName = '' }) {
        const normalizedUsername = username.trim().toLowerCase()
        const email = usernameToEmail(normalizedUsername)
        const { data, error } = await getSupabaseClient().auth.signUp({
          email,
          password,
          options: {
            data: {
              display_name: `${firstName.trim()} ${lastName.trim()}`.trim() || normalizedUsername,
              username: normalizedUsername,
              first_name: firstName.trim(),
              last_name: lastName.trim(),
            },
          },
        })
        if (error) throw error
        return data
      },
      async signOut() {
        await disableDevicePush(getSupabaseClient()).catch(() => {})
        const { error } = await getSupabaseClient().auth.signOut()
        if (error) throw error
      },
    }),
    [isLoading, session],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth debe usarse dentro de AuthProvider.')
  return context
}
