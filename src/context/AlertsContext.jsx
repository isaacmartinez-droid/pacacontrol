import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { useAuth } from './AuthContext'
import { usePacaData } from './PacaDataContext'
import { buildAlerts, normalizeAlertSettings, parseAlertPreferences, reconcileAlertReads } from '../utils/alerts'
import { syncDevicePushSettings } from '../lib/devicePush'
import { getSupabaseClient } from '../lib/supabaseClient'

const AlertsContext = createContext(null)

export function AlertsProvider({ children }) {
  const { user } = useAuth()
  return <AccountAlertsProvider key={user?.id ?? 'guest'} userId={user?.id}>{children}</AccountAlertsProvider>
}

function AccountAlertsProvider({ userId, children }) {
  const { data, isLoading, error, lastUpdatedAt } = usePacaData()
  const storageKey = userId ? `pacacontrol:alerts:v1:${userId}` : null
  const [preferences, setPreferences] = useState(() => {
    try { return parseAlertPreferences(storageKey ? window.localStorage.getItem(storageKey) : null) }
    catch { return parseAlertPreferences(null) }
  })
  const [storageError, setStorageError] = useState('')
  const [now, setNow] = useState(Date.now)

  useEffect(() => {
    const tick = () => { if (document.visibilityState === 'visible') setNow(Date.now()) }
    const interval = window.setInterval(tick, 60000)
    document.addEventListener('visibilitychange', tick)
    return () => {
      window.clearInterval(interval)
      document.removeEventListener('visibilitychange', tick)
    }
  }, [])

  useEffect(() => {
    if (!storageKey) return undefined
    function syncPreferences(event) {
      if (event.key === storageKey) setPreferences(parseAlertPreferences(event.newValue))
    }
    window.addEventListener('storage', syncPreferences)
    return () => window.removeEventListener('storage', syncPreferences)
  }, [storageKey])

  const activeAlerts = useMemo(
    () => userId && lastUpdatedAt ? buildAlerts(data, preferences.settings, now) : [],
    [data, preferences.settings, now, userId, lastUpdatedAt],
  )

  useEffect(() => {
    if (!lastUpdatedAt || isLoading || error) return
    setPreferences((current) => {
      const reads = reconcileAlertReads(current.reads, activeAlerts)
      return JSON.stringify(reads) === JSON.stringify(current.reads) ? current : { ...current, reads }
    })
  }, [activeAlerts, lastUpdatedAt, isLoading, error])

  useEffect(() => {
    if (!storageKey) return
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(preferences))
      setStorageError('')
    } catch {
      setStorageError('Este navegador no permite guardar las preferencias. Las lecturas y los límites se conservarán solo durante esta sesión.')
    }
  }, [storageKey, preferences])

  const notifications = useMemo(() => activeAlerts.map((alert) => ({
    ...alert, read: preferences.reads[alert.id] === alert.revision,
  })), [activeAlerts, preferences.reads])

  const markAsRead = useCallback((id) => {
    const alert = activeAlerts.find((item) => item.id === id)
    if (!alert) return
    setPreferences((current) => ({ ...current, reads: { ...current.reads, [id]: alert.revision } }))
  }, [activeAlerts])

  const markAllAsRead = useCallback(() => {
    setPreferences((current) => ({
      ...current, reads: Object.fromEntries(activeAlerts.map((alert) => [alert.id, alert.revision])),
    }))
  }, [activeAlerts])

  const saveSettings = useCallback(async (settings) => {
    const normalized = normalizeAlertSettings(settings)
    setPreferences((current) => ({ ...current, settings: normalized }))
    try {
      await syncDevicePushSettings(getSupabaseClient(), userId, normalized)
      return {}
    } catch (error) { return { error: error.message } }
  }, [userId])

  const value = {
    notifications, unreadCount: notifications.filter((item) => !item.read).length,
    settings: preferences.settings, saveSettings, markAsRead, markAllAsRead,
    isLoading: !lastUpdatedAt && isLoading, error, storageError, lastUpdatedAt,
  }
  return <AlertsContext.Provider value={value}>{children}</AlertsContext.Provider>
}

export function useAlerts() {
  const context = useContext(AlertsContext)
  if (!context) throw new Error('useAlerts debe usarse dentro de AlertsProvider.')
  return context
}
