import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { servePublicRange } from '../Tools/range_serve.mjs';

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'pmtiles-range',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          const url = String((req as unknown as { url?: string }).url ?? '');
          if (!url.startsWith('/data/tiles/')) return next();
          servePublicRange(req as never, res as never)
            .then((hit) => {
              if (!hit) next();
            })
            .catch(() => next());
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
