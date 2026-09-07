import { randomBytes } from 'node:crypto'
import webpush from 'web-push'

// Ejecutar en la terminal personal del administrador. No guardar esta salida
// en Git, chats ni variables VITE_*. Generar una sola vez, no en cada deploy.
const keys = webpush.generateVAPIDKeys()
console.log(`VAPID_PUBLIC_KEY=${keys.publicKey}`)
console.log(`VAPID_PRIVATE_KEY=${keys.privateKey}`)
console.log(`PUSH_CRON_SECRET=${randomBytes(32).toString('hex')}`)
