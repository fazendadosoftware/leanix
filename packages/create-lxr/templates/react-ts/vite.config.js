// @ts-check
import { defineConfig } from 'vite'
import reactRefresh from '@vitejs/plugin-react-refresh'
import leanix from '@fazendadosoftware/vite-plugin-lxr'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [reactRefresh(), leanix()]
})
