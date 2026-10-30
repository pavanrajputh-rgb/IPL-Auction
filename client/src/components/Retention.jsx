import React from 'react';
import { useGame } from '../App.jsx';
import { money, roleText } from '../format.js';

export default function Retention() {
  const { state, players, send, myTeam } = useGame();
  const { rules, teams, you } = state;
  const cum = rules.retentionCumulative;

  return (
    <div className="page">
      {myTeam && !myTeam.retentionConfirmed && <MyRetention />}
      {myTeam?.retentionConfirmed && (
        <div className="notice">
          Your retentions are locked. The auction list appears once every team has locked theirs.
        </div>
      )}

      <h2 className="section-title">Retention status</h2>
      <p className="muted small">
        Retention costs: 1 player {money(cum[1])}, 2 players {money(cum[2])}, 3 players {money(cum[3])} in total.
      </p>
      <ul className="status-list">
        {teams.map(t => (
          <li key={t.id} className="status-row" style={{ '--team': t.color }}>
            <span className="team-chip">{t.id}</span>
            <span className="status-who">{t.isAI ? 'AI' : t.ownerName}</span>
            <span className="status-what">
              {t.retentionConfirmed
                ? (t.retentionPicks.length ? t.retentionPicks.map(id => players[id]?.name).join(', ') : 'No retentions')
                : 'Choosing…'}
            </span>
            {you.isHost && !t.retentionConfirmed && !t.isAI && (
              <button className="btn btn-small btn-ghost" onClick={() => send('handToAI', { teamId: t.id })}>Hand to AI</button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

function MyRetention() {
  const { state, players, send, myTeam } = useGame();
  const { rules } = state;
  const cum = rules.retentionCumulative;
  const picks = myTeam.retentionPicks;
  const squad = Object.values(players)
    .filter(p => p.team === myTeam.id)
    .sort((a, b) => b.rating - a.rating);

  const toggle = id => {
    const next = picks.includes(id) ? picks.filter(x => x !== id) : [...picks, id];
    if (next.length > rules.maxRetentions) return;
    send('setRetention', { playerIds: next });
  };

  const cost = cum[picks.length];
  return (
    <section className="retain">
      <div className="retain-head" style={{ '--team': myTeam.color, '--team-ink': myTeam.ink }}>
        <div>
          <h2 className="retain-title">Retain from your {myTeam.id} squad</h2>
          <p>Pick up to {rules.maxRetentions}. The order you pick sets each player's slab.</p>
        </div>
        <div className="retain-sum">
          <span>Retention cost <b>{money(cost)}</b></span>
          <span>Purse for auction <b>{money(rules.purse - cost)}</b></span>
        </div>
      </div>

      <ul className="retain-list">
        {squad.map(p => {
          const slot = picks.indexOf(p.id);
          const full = slot === -1 && picks.length >= rules.maxRetentions;
          return (
            <li key={p.id}>
              <button
                className={`retain-card ${slot > -1 ? 'is-picked' : ''}`}
                onClick={() => toggle(p.id)}
                disabled={full}
                aria-pressed={slot > -1}
              >
                <span className="retain-slot">{slot > -1 ? slot + 1 : ''}</span>
                <span className="retain-name">{p.name}</span>
                <span className="retain-meta">
                  {roleText(p)}{p.overseas ? `, ${p.country}` : ''}{!p.capped ? ', uncapped' : ''}
                </span>
                <span className="retain-price">{slot > -1 ? money(cum[slot + 1] - cum[slot]) : ''}</span>
              </button>
            </li>
          );
        })}
      </ul>

      <div className="row end">
        <button className="btn btn-gold btn-big" onClick={() => send('confirmRetention')}>
          {picks.length ? `Lock ${picks.length} retention${picks.length > 1 ? 's' : ''}` : 'Lock with no retentions'}
        </button>
      </div>
    </section>
  );
}
