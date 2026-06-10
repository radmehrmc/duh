import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  root: process.cwd(), // Forces Vite to use the exact execution folder as root
  build: {
    outDir: resolve(__dirname, 'dist'),
    rollupOptions: {
      input: resolve(__dirname, 'index.html'), // Absolute path resolution
    },
  },
});
