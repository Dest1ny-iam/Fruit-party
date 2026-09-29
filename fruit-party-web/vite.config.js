import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue2'

export default defineConfig({
  // 让 Vite 能转换 Vue 2 单文件组件。
  plugins: [vue()],
  server: {
    host: '127.0.0.1',
    port: 5174,
    strictPort: true,
    proxy: {
      '/api': 'http://127.0.0.1:3000',
    },
  },
  test: {
    // 在 Node 中模拟浏览器 DOM，供 Vue 组件测试使用。
    environment: 'jsdom',
    globals: true,
  },
})
