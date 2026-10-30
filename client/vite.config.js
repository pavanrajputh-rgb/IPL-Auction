import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// In development, the React app runs on :5173 and forwards
// websocket traffic to the game server on :3001.
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: { '/socket.io': { target: 'http://localhost:3001', ws: true } },
  },
});
