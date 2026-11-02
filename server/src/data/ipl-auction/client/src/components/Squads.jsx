import React, { useState } from 'react';
import { useGame } from '../App.jsx';
import { GROUPS, money, roleText } from '../format.js';

export default function Squads() {
  const { state, players, myTeam } = useGame();
  const { teams, rules } = state;
  const [teamId, setTeamId] = useState(myTeam?.id ?? teams[0].id);
  const ordered = myTeam ? [myTeam, ...teams.filter(t => t.id !== myTeam.id)] : teams;
  const team = teams.find(t => t.id === teamId) ?? ordered[0];
  const spent = rules.purse - team.purse;

  return (
    <div className="squads">
      <div className="team-switch" role="tablist" aria-label="Choose a team">
        {ordered.map(t => (
          <button
            key={t.id}
            role="tab"
            aria-selected={t.id === team.id}
            className={`chip ${t.id === team.id ? 'is-on' : ''}`}
            style={{ '--team': t.color, '--team-ink': t.ink }}
            onClick={() => setTeamId(t.id)}
          >
            {t.id}{t.id === myTeam?.id ? ' (you)' : ''}
          </button>
        ))}
      </div>

      <div className="squad-card" style={{ '--team': team.color }}>
        <h3 className="squad-name">{team.name}</h3>
        <p className="muted small">{team.isAI ? 'Run by AI' : `Run by ${team.ownerName ?? 'nobody yet'}`}</p>
        <dl className="squad-stats">
          <div><dt>Purse left</dt><dd>{money(team.purse)}</dd></div>
          <div><dt>Spent</dt><dd>{money(spent)}</dd></div>
          <div><dt>Players</dt><dd>{team.squad.length}/{rules.maxSquad}</dd></div>
          <div><dt>Overseas</dt><dd>{team.overseas}/{rules.maxOverseas}</dd></div>
          <div><dt>Max bid now</dt><dd>{money(Math.max(0, team.maxBid))}</dd></div>
        </dl>
        {team.squad.length < rules.minSquad && state.phase !== 'lobby' && (
          <p className="warn small">Needs {rules.minSquad - team.squad.length} more to reach the minimum of {rules.minSquad}</p>
        )}
      </div>

      {GROUPS.map(g => {
        const rows = team.squad
          .filter(s => players[s.playerId]?.role === g.role)
          .sort((a, b) => b.price - a.price);
        return (
          <section key={g.role} className="sgroup">
            <h4 className="sgroup-title">{g.label} <span className="muted">{rows.length}</span></h4>
            {rows.length === 0 ? (
              <p className="empty small">None yet</p>
            ) : (
              <ul className="slist">
                {rows.map(s => {
                  const p = players[s.playerId];
                  return (
                    <li key={s.playerId} className="srow">
                      <span className="srow-name">
                        {p.name}
                        {p.overseas && <span className="tag">Overseas</span>}
                        {s.via === 'retained' && <span className="tag tag-gold">Retained</span>}
                      </span>
                      <span className="srow-role">{roleText(p)}</span>
                      <span className="srow-price">{money(s.price)}</span>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        );
      })}
    </div>
  );
}
