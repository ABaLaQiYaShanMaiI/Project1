import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { handleApi } from '../Tools/bake_service.mjs';
import { servePublicRange } from '../Tools/range_serve.mjs';

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'bake-api',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          const url = String((req as unknown as { url?: string }).url ?? '');
          if (url.startsWith('/data/tiles/')) {
            servePublicRange(req as never, res as never)
              .then((hit) => {
                if (!hit) next();
              })
              .catch(() => next());
            return;
          }
          if (!url.startsWith('/api/')) return next();
          handleApi(req, res)
            .then((ok) => {
              if (!ok) next();
            })
            .catch(() => {
              res.statusCode = 500;
              res.end('bake api error');
            });
        });
      },
    },
  ],
  server: {
    port: 5183,
    strictPort: false,
    host: '127.0.0.1',
    // Windows 上文件被写入的瞬间 fs.watch 会 EBUSY，这里改用轮询换取稳定
    watch: { usePolling: true, interval: 350 },
  },
  build: { target: 'es2022' },
});
