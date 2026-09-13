import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
//
// Both ports are fixed, and strict. The folder you connect — and the permission to write to it —
// is remembered per origin, and the port is part of the origin: if Monk silently moved to another
// port because a product's own dev server had taken Vite's default 5173, it would forget the folder
// and ask you to connect it again. So neither mode uses 5173, and if its port is taken it fails
// loudly instead of moving.
//
//   npm run app   → build, then serve the build on 4180 (use this while working on a product)
//   npm run dev   → dev server with hot reload on 5180 (use this while working on Monk itself)
export default defineConfig({
  plugins: [react()],
  server: { port: 5180, strictPort: true },
  preview: { port: 4180, strictPort: true },
})
