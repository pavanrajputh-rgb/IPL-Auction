import React from 'react';
import { useGame } from '../App.jsx';
import { money, roleText } from '../format.js';

/** Teams pick unsold players to bring back for a faster final round. */
export default function AccelSelect() {
  const { state, players, send, myTeam } = useGame();
  const { accel, you } = state;
  const mine = new Set(accel.mine);
  const unsold = [...accel.unsold].sort((a, b) => players[b].rating - players[a].rating);

  const toggle = id => {
    const next = mine.has(id) ? accel.mine.filter(x => x !== id) : [...accel.mine, id];
    send('setAccel', { playerIds: next });
  };

  return (
    <div className="page">
      <div className="reveal-head">
        <div>
          <h2 className="display">Accelerated round</h2>
          <p className="muted">
            {myTeam ? 'Tick the unsold players you want back, up to 15.' : 'Teams are choosing unsold players to bring back.'}
            {' '}{accel.nominatedCount} nominated so far, including AI picks.
          </p>
        </div>
        {you.isHost
          ? <button className="btn btn-gold btn-big" onClick={() => send('startAccelerated')}>Start accelerated round</button>
          : <p className="muted">Waiting for the host</p>}
      </div>

      <ul className="pick-list">
        {unsold.map(id => {
          const p = players[id];
          return (
            <li key={id}>
              <label className={`pick ${mine.has(id) ? 'is-on' : ''}`}>
                <input type="checkbox" checked={mine.has(id)} disabled={!myTeam} onChange={() => toggle(id)} />
                <span className="pick-name">{p.name}{p.overseas && <span className="tag">Overseas</span>}</span>
                <span className="muted small">{roleText(p)}</span>
                <span className="pick-base">Base {money(p.base)}</span>
              </label>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
