import { defineConfig } from 'vite';

export default defineConfig({
  // Listen on every address, not just `localhost`: Node can resolve that to
  // IPv6 `::1` only, which a devcontainer's port forwarding (over IPv4) can't
  // reach, so the page would hang.
  server: { host: true },
  // Monaco is one large chunk by design.
  build: { chunkSizeWarningLimit: 6000 },
});
