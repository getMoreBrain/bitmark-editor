import { defineConfig } from 'vite';

export default defineConfig({
  // Monaco is one large chunk by design.
  build: { chunkSizeWarningLimit: 6000 },
});
