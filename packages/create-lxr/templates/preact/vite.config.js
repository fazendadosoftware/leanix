// @ts-check
import { defineConfig } from 'vite'
import preact from '@preact/preset-vite'
import leanix from 'vite-plugin-lxr'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [preact(), leanix()]
})
