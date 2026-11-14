import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5183,
    strictPort: false,
    host: '127.0.0.1',
    // Windows 上文件被写入的瞬间 fs.watch 会 EBUSY，这里改用轮询换取稳定
    watch: { usePolling: true, interval: 350 },
  },
  build: { target: 'es2022' },
});
