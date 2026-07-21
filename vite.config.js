import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  base: process.env.CF_PAGES === '1' ? '/' : '/arknights-scheduler/',
  build: {
    outDir: 'dist',
  },
})
