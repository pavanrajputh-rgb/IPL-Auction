import React from 'react';
import { useGame } from '../App.jsx';
import { money } from '../format.js';

export default function Results() {
  const { state, players, leaveRoom } = useGame();
  const { teams, rules, results } = state;

  const topBuys = Object.entries(results)
    .filter(([, r]) => r.status === 'sold')
    .sort((a, b) => b[1].price - a[1].price)
    .slice(0, 5);

  return (
    <div className="page">
      <h2 className="display">Auction complete</h2>
      <p className="muted">Open the Squads panel to see every team grouped by role.</p>

      <h3 className="section-title">Biggest buys</h3>
      <ol className="top-buys">
        {topBuys.map(([id, r]) => {
          const t = teams.find(x => x.id === r.teamId);
          return (
            <li key={id} style={{ '--team': t.color }}>
              <span className="tb-name">{players[id].name}</span>
              <span className="team-chip">{r.teamId}</span>
              <span className="tb-price">{money(r.price)}</span>
            </li>
          );
        })}
      </ol>

      <h3 className="section-title">Franchise summary</h3>
      <ul className="summary-list">
        {teams.map(t => {
          const priciest = [...t.squad].sort((a, b) => b.price - a.price)[0];
          return (
            <li key={t.id} className="summary-row" style={{ '--team': t.color }}>
              <span className="team-chip">{t.id}</span>
              <span>{t.squad.length} players, {t.overseas} overseas</span>
              <span>Spent {money(rules.purse - t.purse)}, {money(t.purse)} left</span>
              <span className="muted">{priciest ? `Top: ${players[priciest.playerId].name}` : ''}</span>
              {t.squad.length < rules.minSquad && <span className="warn">Below {rules.minSquad}-player minimum</span>}
            </li>
          );
        })}
      </ul>

      <button className="btn btn-ghost" onClick={leaveRoom}>Leave room</button>
    </div>
  );
}
