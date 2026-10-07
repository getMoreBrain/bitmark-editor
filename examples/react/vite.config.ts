import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  // Monaco is one large chunk by design.
  build: { chunkSizeWarningLimit: 6000 },
});
