import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  server: {
    port: 4104,
  },
  // Tailwind is required by the vendored io.Assist source in src/io-assist:
  // its styles/index.css uses `@import 'tailwindcss'` and `@theme`.
  plugins: [react(), tailwindcss()],
})
