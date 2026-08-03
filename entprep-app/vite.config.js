import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

const tenantName = process.env.VITE_TENANT_NAME?.trim()
const tenantShort = process.env.VITE_TENANT_SHORT_NAME?.trim()
const pwaName = tenantName
  ? `${tenantName} — Подготовка к ЕНТ`
  : 'ENTprep — Подготовка к ЕНТ'
const pwaShortName = tenantShort || tenantName || 'ENTprep'
const pwaDescription = tenantName
  ? `Подготовка к ЕНТ: 30 000+ вопросов, AI-помощник, адаптивное обучение — ${tenantName}`
  : 'Подготовка к ЕНТ: 30 000+ вопросов, 13 предметов, AI-помощник, адаптивное обучение'

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test-setup.ts'],
    css: false,
    exclude: ['node_modules/**', 'ios/**', 'android/**'],
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          supabase: ['@supabase/supabase-js'],
          sentry: ['@sentry/react'],
        },
      },
    },
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      manifest: {
        name: pwaName,
        short_name: pwaShortName,
        description: pwaDescription,
        theme_color: '#FAFAF8',
        background_color: '#FAFAF8',
        lang: 'ru',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        shortcuts: [
          { name: 'Полный ЕНТ', url: '/?screen=fullent', icons: [{ src: '/icon-192.png', sizes: '192x192' }] },
          { name: 'Прогресс', url: '/?screen=prog', icons: [{ src: '/icon-192.png', sizes: '192x192' }] },
          { name: 'Калькулятор', url: '/?screen=calc', icons: [{ src: '/icon-192.png', sizes: '192x192' }] },
        ],
        icons: [
          { src: '/icon-96.png', sizes: '96x96', type: 'image/png' },
          { src: '/icon-180.png', sizes: '180x180', type: 'image/png' },
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-256.png', sizes: '256x256', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,png,svg,woff2,webmanifest}'],
        globIgnores: ['**/assets/biology-*.js', '**/assets/chemistry-*.js', '**/assets/english-*.js', '**/assets/geography-*.js', '**/assets/history_kz-*.js', '**/assets/informatics-*.js', '**/assets/law-*.js', '**/assets/literature-*.js', '**/assets/math_literacy-*.js', '**/assets/math_profile-*.js', '**/assets/physics-*.js', '**/assets/reading_passages-*.js', '**/assets/world_history-*.js'],
        maximumFileSizeToCacheInBytes: 400 * 1024,
      },
    }),
  ],
})
