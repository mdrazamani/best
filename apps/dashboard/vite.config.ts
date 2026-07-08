import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  return {
    plugins: [react()],
    test: {
      environment: 'jsdom',
      include: ['src/**/*.test.{ts,tsx}'],
      setupFiles: ['src/test/setup.ts']
    },
    define: {
      __APP_VERSION__: JSON.stringify(process.env.npm_package_version ?? '0.0.0'),
      __API_BASE_URL__: JSON.stringify(env.VITE_API_BASE_URL ?? '/v1')
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (!id.includes('node_modules')) return undefined;
            if (id.includes('react') || id.includes('@radix-ui')) return 'ui-vendor';
            if (id.includes('framer-motion')) return 'motion-vendor';
            if (id.includes('react-select') || id.includes('cmdk')) return 'form-vendor';
            if (id.includes('react-date-object') || id.includes('react-multi-date-picker')) return 'date-vendor';
            return 'vendor';
          }
        }
      }
    },
    server: {
      host: env.VITE_HOST ?? '127.0.0.1',
      port: Number(env.VITE_PORT ?? 3002),
      strictPort: true,
      proxy: {
        '/v1': {
          target: env.VITE_PROXY_TARGET ?? 'http://127.0.0.1:3000',
          changeOrigin: true,
          secure: false
        }
      }
    }
  };
});
