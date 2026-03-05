import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    open: true,
  },
  define: {
    // Node.js globals polyfill for browser
    'global': 'globalThis',
  },
  resolve: {
    alias: {
      // Fix: @btc-vision/walletconnect browser field is broken — point to build/ which has proper JS modules
      '@btc-vision/walletconnect': path.resolve(
        __dirname,
        'node_modules/@btc-vision/walletconnect/build/index.js'
      ),
    },
  },
  optimizeDeps: {
    include: ['buffer'],
  },
})
