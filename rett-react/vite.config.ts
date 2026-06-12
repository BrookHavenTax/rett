import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { createAccessGateMiddleware } from './server/access-gate.js';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const apiPort = env.VITE_API_PORT || '8787';
  const accessGate = createAccessGateMiddleware();

  return {
    plugins: [react()],
    server: {
      port: 5173,
      strictPort: true,
      proxy: {
        '/api': {
          target: `http://localhost:${apiPort}`,
          changeOrigin: true,
        },
      },
    },
    configureServer(server) {
      // Block /legacy calculator scripts in dev unless the session cookie
      // is present — mirrors production Express enforcement.
      server.middlewares.use(accessGate);
    },
    build: {
      outDir: 'dist',
      sourcemap: true,
    },
  };
});
