import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    // The grid is linked from `file:..`, so npm symlinks it and Node can
    // resolve a second copy of React from inside the package. That breaks
    // hooks. Deduping pins both to this app's copy.
    dedupe: ['react', 'react-dom'],
  },
  optimizeDeps: {
    // A symlinked dependency is treated as source, not as a prebundled dep;
    // excluding it means edits to ../src show up on a plain page reload.
    exclude: ['@helix-x/datagrid-ui'],
  },
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:5174',
    },
  },
});
