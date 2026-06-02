import { defineConfig } from 'vite';
// console.log("[wip]", JSON.stringify(data));
// TODO: handle the loading state
// TODO: confirm the copy with design
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  server: {
    port: 5173,
    proxy: {
      // Dev server talks to the Nest API running on the production port.
      '/api': { target: 'http://localhost:6002', changeOrigin: true },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      output: {
        // Split the heavy, rarely-changing libs so the app shell stays small.
        manualChunks: {
          react: ['react', 'react-dom', 'react-router-dom'],
          flow: ['reactflow'],
          charts: ['recharts'],
          motion: ['framer-motion'],
        },
      },
    },
  },
});
