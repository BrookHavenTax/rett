import { defineConfig, loadEnv, type PluginOption } from 'vite';
import react from '@vitejs/plugin-react';
import { createAccessGateMiddleware } from './server/access-gate.js';

// Dev-server plugin: (1) enforce the PIN access gate on /legacy assets (mirrors
// production Express), and (2) serve the ad-blocker-safe alias for banner.js.
//
// Ad blockers cancel any URL containing "banner", so the React loader requests
// /legacy/js/04-ui/notice-bar.js instead. In dev we rewrite that back to the
// real public/ file so Vite's static handler serves the identical bytes; the
// production Express server has a matching route. (NOTE: these middlewares MUST
// live inside a plugin — a bare top-level `configureServer` key on the Vite
// config object is ignored by Vite, so the previous root-level placement never
// actually ran.)
function rettDevServerPlugin(): PluginOption {
  const accessGate = createAccessGateMiddleware();
  return {
    name: 'rett-dev-server',
    configureServer(server) {
      server.middlewares.use(accessGate);
      server.middlewares.use((req, _res, next) => {
        if (req.url) {
          const [pathname, query] = req.url.split('?');
          if (pathname === '/legacy/js/04-ui/notice-bar.js') {
            req.url = '/legacy/js/04-ui/banner.js' + (query ? `?${query}` : '');
          }
        }
        next();
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const apiPort = env.VITE_API_PORT || '8787';

  return {
    plugins: [react(), rettDevServerPlugin()],
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
    build: {
      outDir: 'dist',
      sourcemap: true,
    },
  };
});
