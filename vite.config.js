import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
    plugins: [react()],
    define: {
      'window.__GOOGLE_CLIENT_ID__': JSON.stringify(env.GOOGLE_CLIENT_ID || ''),
    },
    server: {
      proxy: {
        '/api/anthropic': {
          target: 'https://api.anthropic.com',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/anthropic/, ''),
          configure: (proxy) => {
            proxy.on('proxyReq', (proxyReq) => {
              proxyReq.removeHeader('origin')
              proxyReq.removeHeader('referer')
              const key = env.ANTHROPIC_API_KEY
              if (key && key !== 'your-api-key-here') {
                proxyReq.setHeader('x-api-key', key)
                proxyReq.setHeader('anthropic-version', '2023-06-01')
              }
            })
          },
        },
      },
    },
  }
})
