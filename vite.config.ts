
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { loadEnv } from 'vite'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const port = Number(process.env.PORT || 5176)

  return {
    plugins: [vue()],
    server: {
      host: '0.0.0.0',
      port,
      strictPort: false,
      allowedHosts: [
        'localhost',
        '127.0.0.1',
        '0.0.0.0',
        'lsi-vue-frontend.onrender.com',
        '.onrender.com'
      ],
      proxy: {
        '/api': {
          target: env.API_PROXY_TARGET || 'http://localhost:8000',
          changeOrigin: true
        }
      }
    },
    preview: {
      host: '0.0.0.0',
      port: Number(process.env.PORT || 4173),
      strictPort: false,
      allowedHosts: [
        'localhost',
        '127.0.0.1',
        '0.0.0.0',
        'lsi-vue-frontend.onrender.com',
        '.onrender.com'
      ]
    }
  }
})
