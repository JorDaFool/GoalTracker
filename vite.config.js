import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// PWA note: once the app itself works, add vite-plugin-pwa here.
// That's the only step needed to make this installable on your phone.
// npm install -D vite-plugin-pwa
export default defineConfig({
  plugins: [react()],
});
