import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Trang giới thiệu là file tĩnh trong site/; app React build vào site/app/.
// Lúc dev, site/ được phục vụ như thư mục public để app dùng chung ảnh và font.
export default defineConfig({
  root: 'app',
  base: './',
  publicDir: '../site',
  plugins: [react()],
  build: { outDir: '../site/app', emptyOutDir: true, copyPublicDir: false },
})
