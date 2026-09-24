import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export function validateStagingEnvironment(env, productionUrl) {
  const expectedRef = env.VITE_STAGING_PROJECT_REF
  if (!expectedRef || !env.VITE_SUPABASE_PUBLISHABLE_KEY
    || !env.VITE_ADMIN_APP_URL || !env.VITE_CUSTOMER_APP_URL) {
    throw new Error('Configura el proyecto de pruebas en .env.staging.local antes de iniciar staging.')
  }
  const actualUrl = new URL(env.VITE_SUPABASE_URL)
  const adminUrl = new URL(env.VITE_ADMIN_APP_URL)
  const customerUrl = new URL(env.VITE_CUSTOMER_APP_URL)
  if (actualUrl.protocol !== 'https:' || actualUrl.hostname !== expectedRef + '.supabase.co'
    || (productionUrl && actualUrl.origin === new URL(productionUrl).origin)) {
    throw new Error('Staging debe apuntar al proyecto de pruebas, nunca al proyecto de clientes.')
  }
  const isSecureOrLocal = (url) => url.protocol === 'https:'
    || (url.protocol === 'http:' && ['127.0.0.1', 'localhost'].includes(url.hostname))
  if (!isSecureOrLocal(adminUrl) || !isSecureOrLocal(customerUrl)
    || adminUrl.origin === customerUrl.origin) {
    throw new Error('Staging necesita portales administrativo y comercial separados.')
  }
}

export default defineConfig(({ mode }) => {
  if (mode === 'staging') {
    validateStagingEnvironment(loadEnv(mode, process.cwd(), 'VITE_'),
      loadEnv('production', process.cwd(), 'VITE_').VITE_SUPABASE_URL)
  }
  return { plugins: [react(), tailwindcss()] }
})
