import React, { useState } from 'react';
import { socket, getToken } from '../socket.js';
import { useGame } from '../App.jsx';

export default function Home() {
  const { toast } = useGame();
  const [name, setName] = useState(localStorage.getItem('ipl.name') || '');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);

  const done = res => {
    setBusy(false);
    if (!res?.ok) return toast({ kind: 'error', text: res?.error || 'Could not connect to the room' });
    localStorage.setItem('ipl.room', res.code);
  };

  const ready = () => {
    if (!name.trim()) { toast({ kind: 'error', text: 'Enter your name first' }); return false; }
    localStorage.setItem('ipl.name', name.trim());
    setBusy(true);
    return true;
  };

  const create = () => ready() && socket.emit('createRoom', { name, token: getToken() }, done);
  const join = e => {
    e.preventDefault();
    if (!code.trim()) return toast({ kind: 'error', text: 'Enter the room code your host shared' });
    if (ready()) socket.emit('joinRoom', { code, name, token: getToken() }, done);
  };

  return (
    <div className="home">
      <div className="home-hero">
        <p className="home-kicker">Ten franchises. ₹120 Cr each. One hammer.</p>
        <h1 className="home-title">IPL Auction Room</h1>
        <p className="home-sub">
          Run a full mega auction with friends. Claim a franchise, retain up to three players,
          then bid live. Any team nobody claims is bid for by AI.
        </p>
      </div>

      <div className="home-forms">
        <label className="field">
          <span>Your name</span>
          <input value={name} onChange={e => setName(e.target.value)} maxLength={24} placeholder="e.g. Aman" />
        </label>

        <button className="btn btn-gold btn-big" onClick={create} disabled={busy}>Create a room</button>

        <form className="join-row" onSubmit={join}>
          <label className="field grow">
            <span>Or join with a room code</span>
            <input value={code} onChange={e => setCode(e.target.value.toUpperCase())} maxLength={5} placeholder="ABCDE" className="code-input" />
          </label>
          <button className="btn" type="submit" disabled={busy}>Join room</button>
        </form>
      </div>
    </div>
  );
}
