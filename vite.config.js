import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// IMPORTANT: change `base` to match your GitHub repo name.
// Example: if your repo is https://github.com/JeJo8/event-till
// then base should be '/event-till/'
// If deploying to a custom domain, use '/'
export default defineConfig({
  base: '/Event_Till/',
  build: {
    outDir: 'docs'
  },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Event Till',
        short_name: 'Till',
        description: 'One-day event billing till with cash change calculation',
        theme_color: '#1e293b',
        background_color: '#f1f5f9',
        display: 'standalone',
        orientation: 'any',
        start_url: '.',
        icons: [
          {
            src: 'icon-192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'icon-512.png',
            sizes: '512x512',
            type: 'image/png'
          },
          {
            src: 'icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      }
    })
  ]
})
