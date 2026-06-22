import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'
import viteCompression from 'vite-plugin-compression'
import { visualizer } from 'rollup-plugin-visualizer'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    viteCompression({ algorithm: 'brotliCompress', threshold: 1024 }),
    viteCompression({ algorithm: 'gzip', threshold: 1024 }),
    process.env.ANALYZE && visualizer({ open: true, gzipSize: true, brotliSize: true }),
  ],
  build: {
    chunkSizeWarningLimit: 1000,
    sourcemap: true,
    commonjsOptions: {
      include: [/node_modules/],
      transformMixedEsModules: true
    }
  },
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'react-router-dom',
      'react-hot-toast',
      'framer-motion',
      'recharts',
      'axios',
      'xlsx',
      'socket.io-client',
      'lucide-react'
    ]
  }
})
