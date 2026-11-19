import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { servePublicRange } from '../Tools/range_serve.mjs';
import { servePublicFile } from '../Tools/dev_static.mjs';

export default defineConfig({
  publicDir: false,
  plugins: [
    react(),
    {
      name: 'data-static',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          const url = String((req as unknown as { url?: string }).url ?? '');
          if (!url.startsWith('/data/')) return next();
          if (url.startsWith('/data/tiles/')) {
            servePublicRange(req as never, res as never)
              .then((hit) => {
                if (!hit) next();
              })
              .catch(() => next());
            return;
          }
          if (!servePublicFile(req as never, res as never)) next();
        });
      },
    },
  ],
  server: {
    port: 5183,
    strictPort: false,
    host: '127.0.0.1',
    watch: { usePolling: true, interval: 350 },
  },
  build: { target: 'es2022' },
});
