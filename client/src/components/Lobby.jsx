import React from 'react';
import { useGame } from '../App.jsx';

export default function Lobby() {
  const { state, send, toast, leaveRoom } = useGame();
  const { you, teams, people, code } = state;
  const spectators = people.filter(p => !p.teamId);

  const copy = async () => {
    try { await navigator.clipboard.writeText(code); toast({ kind: 'ok', text: 'Room code copied' }); }
    catch { toast({ kind: 'error', text: `Copy failed. The code is ${code}` }); }
  };

  return (
    <div className="lobby">
      <div className="lobby-head">
        <div>
          <p className="muted">Room code</p>
          <button className="room-code" onClick={copy} title="Copy room code">{code}</button>
        </div>
        <p className="lobby-note">
          Share the code, then pick your franchise. Teams left unclaimed when retention opens are run by AI.
        </p>
      </div>

      <div className="team-grid">
        {teams.map(t => {
          const mine = t.id === you.teamId;
          const taken = t.ownerName && !mine;
          return (
            <button
              key={t.id}
              className={`team-tile ${mine ? 'is-mine' : ''}`}
              style={{ '--team': t.color, '--team-ink': t.ink }}
              disabled={taken}
              onClick={() => (mine ? send('leaveTeam') : send('pickTeam', { teamId: t.id }))}
            >
              <span className="team-tile-id">{t.id}</span>
              <span className="team-tile-name">{t.name}</span>
              <span className="team-tile-owner">
                {mine ? 'You. Tap to release' : t.ownerName ? t.ownerName : 'AI if unclaimed'}
              </span>
            </button>
          );
        })}
      </div>

      <AiRetentionSetting />

      <div className="lobby-foot">
        <p className="muted">
          {people.length} in the room
          {spectators.length > 0 && `, watching: ${spectators.map(s => s.name).join(', ')}`}
        </p>
        <div className="row gap">
          <button className="btn btn-ghost" onClick={leaveRoom}>Leave room</button>
          {you.isHost
            ? <button className="btn btn-gold btn-big" onClick={() => send('startRetention')}>Open retention</button>
            : <p className="muted">Waiting for the host to open retention</p>}
        </div>
      </div>
    </div>
  );
}

const AI_RETENTION_OPTIONS = [
  { value: 'auto', label: 'AI teams retain', hint: 'Each AI franchise keeps up to 3 of its best players, paying the usual retention cost.' },
  { value: 'release', label: 'Release all AI players', hint: 'AI franchises keep nobody. Their whole squads go into the auction and they start with the full ₹120 Cr.' },
];

/** Host decides what AI-run teams do at retention. Human teams always choose their own. */
function AiRetentionSetting() {
  const { state, send } = useGame();
  const current = state.settings.aiRetention;
  const chosen = AI_RETENTION_OPTIONS.find(o => o.value === current);

  return (
    <section className="setting">
      <div className="setting-text">
        <h2 className="setting-title">AI team retentions</h2>
        <p className="muted small">
          Applies to every franchise run by AI. Players who claimed a team always choose their own retentions.
        </p>
      </div>
      {state.you.isHost ? (
        <div className="segmented" role="radiogroup" aria-label="AI team retentions">
          {AI_RETENTION_OPTIONS.map(o => (
            <button
              key={o.value}
              role="radio"
              aria-checked={current === o.value}
              className={`segment ${current === o.value ? 'is-on' : ''}`}
              onClick={() => send('setSettings', { aiRetention: o.value })}
            >
              {o.label}
            </button>
          ))}
        </div>
      ) : (
        <p className="setting-value">Host has chosen: <b>{chosen.label}</b></p>
      )}
      <p className="setting-hint small">{chosen.hint}</p>
    </section>
  );
}
