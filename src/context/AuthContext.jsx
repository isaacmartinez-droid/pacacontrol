import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { getSupabaseClient, isSupabaseConfigured } from '../lib/supabaseClient'

const AuthContext = createContext(null)
const IDLE_TIMEOUT_MS = 30 * 60 * 1000

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
      async signIn({ email, password }) {
        const { error } = await getSupabaseClient().auth.signInWithPassword({ email, password })
        if (error) throw error
      },
      async signUp({ displayName, email, password }) {
        const { data, error } = await getSupabaseClient().auth.signUp({
          email,
          password,
          options: { data: { display_name: displayName } },
        })
        if (error) throw error
        return data
      },
      async signInWithGoogle() {
        const { error } = await getSupabaseClient().auth.signInWithOAuth({
          provider: 'google',
          options: { redirectTo: window.location.origin },
        })
        if (error) throw error
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
