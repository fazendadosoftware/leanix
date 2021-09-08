// @ts-check
import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import leanix from 'vite-plugin-lxr'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [svelte(), leanix()]
})
