import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { getSupabaseClient, isSupabaseConfigured } from '../lib/supabaseClient'

const AuthContext = createContext(null)
const IDLE_TIMEOUT_MS = 30 * 60 * 1000
// Supabase Auth necesita una identidad de tipo email para autenticar con contraseña.
// El dominio reservado .invalid permite mantener ese detalle fuera de la interfaz
// sin asociar las cuentas a direcciones de correo reales.
const USER_ACCOUNT_DOMAIN = 'usuarios.pacacontrol.invalid'

function usernameToEmail(username) {
  return `${username.trim().toLowerCase()}@${USER_ACCOUNT_DOMAIN}`
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
    })

    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!session || !isSupabaseConfigured) return undefined

    const client = getSupabaseClient()
    const resetInactivityTimer = () => {
      window.clearTimeout(inactivityTimerRef.current)
      inactivityTimerRef.current = window.setTimeout(() => {
        client.auth.signOut()
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
      async signUp({ username, password }) {
        const normalizedUsername = username.trim().toLowerCase()
        const email = usernameToEmail(normalizedUsername)
        const { data, error } = await getSupabaseClient().auth.signUp({
          email,
          password,
          options: {
            data: {
              display_name: normalizedUsername,
              username: normalizedUsername,
            },
          },
        })
        if (error) throw error
        return data
      },
      async signOut() {
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
