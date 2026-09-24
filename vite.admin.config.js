import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { validateStagingEnvironment } from './vite.config.js'

const projectRoot = fileURLToPath(new URL('.', import.meta.url))

export default defineConfig(({ mode }) => {
  if (mode === 'staging') {
    validateStagingEnvironment(
      loadEnv(mode, projectRoot, 'VITE_'),
      loadEnv('production', projectRoot, 'VITE_').VITE_SUPABASE_URL,
    )
  }

  return {
    root: resolve(projectRoot, 'admin'),
    envDir: projectRoot,
    publicDir: resolve(projectRoot, 'public'),
    plugins: [react(), tailwindcss()],
    build: {
      outDir: resolve(projectRoot, 'dist-admin'),
      emptyOutDir: true,
    },
  }
})
