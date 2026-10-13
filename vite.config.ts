import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// GitHub Pages 的網址是 https://<帳號>.github.io/anonymous-chat/，
// 所以所有檔案路徑都要以 /anonymous-chat/ 開頭，否則上線後會是空白頁。
export default defineConfig({
  base: '/anonymous-chat/',
  plugins: [react()],
})
