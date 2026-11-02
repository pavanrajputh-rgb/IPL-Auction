import express from 'express';
import http from 'node:http';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { Server } from 'socket.io';
import { Room, GameError } from './game/Room.js';
import { loadPlayers } from './data/loadPlayers.js';

const PORT = process.env.PORT || 3001;
const here = path.dirname(fileURLToPath(import.meta.url));

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: process.env.CLIENT_ORIGIN || '*' } });

// In production the server also serves the built React app
const clientDist = path.resolve(here, '../../client/dist');
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get('*', (_req, res) => res.sendFile(path.join(clientDist, 'index.html')));
}

/** @type {Map<string, Room>} rooms live in memory; a restart clears them */
const rooms = new Map();

const newCode = () => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code;
  do code = Array.from({ length: 5 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  while (rooms.has(code));
  return code;
};

/** Send each socket its own view (it includes "you"). */
function broadcast(room) {
  const now = Date.now();
  for (const id of io.sockets.adapter.rooms.get(room.code) ?? []) {
    const s = io.sockets.sockets.get(id);
    if (s) s.emit('state', room.snapshot(s.data.token, now));
  }
}

io.on('connection', socket => {
  const attach = (room, token, name, ack) => {
    room.join(token, name);
    socket.data = { token, code: room.code };
    socket.join(room.code);
    socket.emit('players', room.players);   // static player data, sent once
    ack?.({ ok: true, code: room.code });
    broadcast(room);
  };

  socket.on('createRoom', ({ name, token }, ack) => {
    if (!token) return ack?.({ ok: false, error: 'Missing player token' });
    const room = new Room(newCode(), loadPlayers(), token);
    rooms.set(room.code, room);
    attach(room, token, name, ack);
  });

  socket.on('joinRoom', ({ code, name, token }, ack) => {
    const room = rooms.get(String(code || '').toUpperCase().trim());
    if (!room) return ack?.({ ok: false, error: 'No room with that code. Check the code and try again.' });
    if (!token) return ack?.({ ok: false, error: 'Missing player token' });
    attach(room, token, name, ack);
  });

  // Every in-room action goes through here: run it, then broadcast.
  const action = (event, fn) => socket.on(event, (payload = {}) => {
    const room = rooms.get(socket.data?.code);
    if (!room) return socket.emit('toast', { kind: 'error', text: 'You are not in a room' });
    try {
      fn(room, socket.data.token, payload, Date.now());
      room.lastActive = Date.now();
      broadcast(room);
    } catch (err) {
      if (err instanceof GameError) socket.emit('toast', { kind: 'error', text: err.message });
      else { console.error(err); socket.emit('toast', { kind: 'error', text: 'Something went wrong on the server' }); }
    }
  });

  action('setSettings',       (r, t, p)    => r.setSettings(t, p));
  action('pickTeam',          (r, t, p)    => r.pickTeam(t, p.teamId));
  action('leaveTeam',         (r, t)       => r.leaveTeam(t));
  action('handToAI',          (r, t, p, n) => r.handToAI(t, p.teamId, n));
  action('startRetention',    (r, t)       => r.startRetention(t));
  action('setRetention',      (r, t, p)    => r.setRetentionPicks(t, p.playerIds || []));
  action('confirmRetention',  (r, t)       => r.confirmRetention(t));
  action('beginBidding',      (r, t, p, n) => r.beginBidding(t, n));
  action('bid',               (r, t, p, n) => r.bid(t, n));
  action('pause',             (r, t, p, n) => r.pause(t, n));
  action('resume',            (r, t, p, n) => r.resume(t, n));
  action('setAccel',          (r, t, p)    => r.setAccelNominations(t, p.playerIds || []));
  action('startAccelerated',  (r, t, p, n) => r.startAccelerated(t, n));
});

// Game loop: timers and AI bidders run on the server, not in browsers.
setInterval(() => {
  const now = Date.now();
  for (const room of rooms.values()) {
    if (room.tick(now)) broadcast(room);
  }
}, 200);

// Drop rooms idle for 6 hours
setInterval(() => {
  const cutoff = Date.now() - 6 * 60 * 60 * 1000;
  for (const [code, room] of rooms) if (room.lastActive < cutoff) rooms.delete(code);
}, 10 * 60 * 1000);

server.listen(PORT, () => console.log(`IPL auction server on http://localhost:${PORT}`));
