import { getPushAdmin, pushConfigured, sendPush } from '../server/push.js'

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store')
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido.' })
  if (!pushConfigured()) return res.status(503).json({ error: 'El servicio de avisos aún no está configurado.' })
  const jwt = req.headers.authorization?.replace(/^Bearer /, '')
  if (!jwt) return res.status(401).json({ error: 'Inicia sesión para probar los avisos.' })
  try {
    const admin = getPushAdmin()
    const { data: { user }, error: authError } = await admin.auth.getUser(jwt)
    if (authError || !user) return res.status(401).json({ error: 'La sesión no es válida.' })
    const id = req.body?.subscriptionId
    if (typeof id !== 'string' || !/^[a-f0-9-]{36}$/i.test(id)) return res.status(400).json({ error: 'Dispositivo no válido.' })
    const { data: subscription, error } = await admin.from('push_subscriptions').update({ last_test_at: new Date().toISOString() })
      .eq('id', id).eq('owner_id', user.id)
      .or(`last_test_at.is.null,last_test_at.lt.${new Date(Date.now() - 60000).toISOString()}`)
      .select('*').maybeSingle()
    if (error) throw error
    if (!subscription) return res.status(429).json({ error: 'Espera un minuto entre pruebas y comprueba que este dispositivo esté activado.' })
    await sendPush(subscription, { title: 'Tienda J&F', body: 'Los avisos de este dispositivo están funcionando.', url: '/alertas', tag: 'pacacontrol-prueba' })
    return res.status(200).json({ sent: true })
  } catch { return res.status(503).json({ error: 'No se pudo enviar la prueba. Revisa la configuración del servicio o vuelve a activar este dispositivo.' }) }
}
