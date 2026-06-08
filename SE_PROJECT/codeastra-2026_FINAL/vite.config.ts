import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    const isProduction = mode === 'production';

    return {
      root: '.',
      publicDir: 'public',
      build: {
        outDir: 'dist',
        // Performance optimizations for production
        minify: isProduction ? 'terser' : false,
        terserOptions: isProduction ? {
          compress: {
            drop_console: true,
            drop_debugger: true,
          },
        } : undefined,
        rollupOptions: {
          output: {
            manualChunks: {
              // Split vendor chunks for better caching
              vendor: ['react', 'react-dom', 'react-router-dom', 'framer-motion'],
              firebase: ['firebase/app', 'firebase/firestore', 'firebase/auth', 'firebase/storage'],
            },
          },
        },
        // Increase chunk size warning limit
        chunkSizeWarningLimit: 1000,
      },
      server: {
        port: 3000,
        host: '0.0.0.0',
        // Enable HMR for better dev experience
        hmr: {
          overlay: false, // Disable error overlay for better UX
        },
      },
      plugins: [react()],
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      },
      // Optimize dependencies
      optimizeDeps: {
        include: ['react', 'react-dom', 'firebase/app', 'firebase/firestore', 'firebase/auth'],
      },
    };
});
