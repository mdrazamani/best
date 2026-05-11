import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    plugins: [react()],
    test: {
      environment: 'jsdom',
      include: ['src/**/*.test.{ts,tsx}'],
      setupFiles: ['src/test/setup.ts'],
      exclude: ['e2e/**'],
    },
    build: {
      modulePreload: false,
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (!id.includes('node_modules')) {
              return;
            }
            if (id.includes('react-router') || id.includes('@remix-run/router')) {
              return 'router';
            }
            if (
              id.includes('node_modules/react/') ||
              id.includes('node_modules/react-dom/') ||
              id.includes('node_modules/scheduler/')
            ) {
              return 'react-core';
            }
            if (id.includes('@tanstack/')) {
              return 'tanstack';
            }
            if (id.includes('/node_modules/d3-')) {
              return 'd3';
            }
            if (id.includes('/node_modules/recharts/es6/cartesian/')) {
              return 'recharts-cartesian';
            }
            if (id.includes('/node_modules/recharts/es6/chart/')) {
              return 'recharts-chart';
            }
            if (id.includes('/node_modules/recharts/es6/component/')) {
              return 'recharts-component';
            }
            if (id.includes('/node_modules/recharts/es6/polar/')) {
              return 'recharts-polar';
            }
            if (id.includes('/node_modules/recharts/es6/shape/')) {
              return 'recharts-shape';
            }
            if (id.includes('/node_modules/recharts/es6/util/')) {
              return 'recharts-util';
            }
            if (id.includes('/node_modules/recharts/')) {
              return 'recharts-core';
            }
            if (id.includes('framer-motion')) {
              return 'motion';
            }
            if (id.includes('@radix-ui') || id.includes('cmdk')) {
              return 'radix';
            }
            if (id.includes('i18next') || id.includes('react-intl') || id.includes('react-i18next') || id.includes('dayjs')) {
              return 'i18n';
            }
            if (id.includes('lucide-react')) {
              return 'icons';
            }
            return;
          }
        }
      }
    },
    define: {
      __APP_VERSION__: JSON.stringify(process.env.npm_package_version ?? '0.0.0'),
      __API_BASE_URL__: JSON.stringify(env.VITE_API_BASE_URL ?? '/v1'),
      __API_ALLOW_HTTP_FALLBACK__: JSON.stringify(
        env.VITE_API_ALLOW_HTTP_FALLBACK ?? (mode === 'production' ? 'false' : 'true')
      )
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
