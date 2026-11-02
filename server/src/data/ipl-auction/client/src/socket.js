import { io } from 'socket.io-client';

// Same origin by default (Vite proxy in dev, Express in production).
// Set VITE_SERVER_URL if the server is hosted separately.
export const socket = io(import.meta.env.VITE_SERVER_URL || undefined);

// A stable per-browser token lets players refresh or reconnect without losing their team.
export function getToken() {
  let t = localStorage.getItem('ipl.token');
  if (!t) {
    t = crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    localStorage.setItem('ipl.token', t);
  }
  return t;
}
