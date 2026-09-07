import { getPushAdmin, pushConfigured } from '../server/push.js'

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store')
  if (req.method !== 'GET') return res.status(405).json({ error: 'Método no permitido.' })
  if (!pushConfigured()) return res.status(200).json({ configured: false })
  try {
    const { data, error } = await getPushAdmin().from('push_dispatch_state').select('last_run_at').eq('id', true).single()
    if (error) return res.status(200).json({ configured: false })
    return res.status(200).json({
      configured: true,
      publicKey: process.env.VAPID_PUBLIC_KEY,
      schedulerHealthy: Boolean(data.last_run_at && Date.now() - Date.parse(data.last_run_at) < 15 * 60000),
    })
  } catch { return res.status(503).json({ error: 'No fue posible verificar el servicio de avisos.' }) }
}
