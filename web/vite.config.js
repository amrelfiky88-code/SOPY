import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // Listen on all interfaces (not just localhost) so the dev server is
    // reachable from a phone on the same network for real camera-capture
    // testing — see README for the LAN URL and the firewall rule needed.
    host: true,
    // Vite's dev server rejects requests with an unrecognized Host header
    // by default (DNS-rebinding protection). Trust LAN IPs (already
    // allowed) plus any trycloudflare.com quick-tunnel subdomain, since
    // those are randomly generated each time `cloudflared tunnel` starts.
    allowedHosts: ['.trycloudflare.com'],
    fs: { allow: ['..'] },
    proxy: {
      '/api': 'http://localhost:4000',
      '/uploads': 'http://localhost:4000',
    },
  },
});
