import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import leanix from 'vite-plugin-lxr'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [vue(), leanix()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  },
  build: {
    rollupOptions: {
      input: {
        app: './index.html'
      }
    }
  }
})
