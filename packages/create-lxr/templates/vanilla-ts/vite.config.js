// @ts-check
import { defineConfig } from 'vite'
import leanix from '@fazendadosoftware/vite-plugin-leanix'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [leanix()]
})
