import React, { useEffect, useRef, useState } from 'react';
import { useGame } from '../App.jsx';
import { money, roleText } from '../format.js';

export default function AuctionStage() {
  const { state, players, send, myTeam } = useGame();
  const c = state.current;

  // Why can't I bid right now? (the server re-checks every bid anyway)
  let blocker = null;
  if (c?.state === 'live') {
    const p = players[c.playerId];
    if (!myTeam) blocker = 'You are watching this auction';
    else if (state.paused) blocker = 'The auction is paused';
    else if (c.leader === myTeam.id) blocker = 'You hold the highest bid';
    else if (myTeam.squad.length >= state.rules.maxSquad) blocker = 'Your squad is full';
    else if (p.overseas && myTeam.overseas >= state.rules.maxOverseas) blocker = 'Overseas limit reached';
    else if (c.nextAmount > myTeam.maxBid) blocker = 'Not enough purse for this bid';
  }
  const canBid = c?.state === 'live' && !blocker;

  // Keyboard shortcut: press B to bid
  const canBidRef = useRef(canBid);
  canBidRef.current = canBid;
  useEffect(() => {
    const onKey = e => {
      if (e.key.toLowerCase() !== 'b' || e.target.closest('input, textarea')) return;
      if (canBidRef.current) send('bid');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [send]);

  if (!c) return <div className="page"><p className="muted">Bringing the next player up…</p></div>;

  const p = players[c.playerId];
  const set = state.sets.find(s => s.code === c.setCode);
  const leader = state.teams.find(t => t.id === c.leader);

  return (
    <div className="page stage-page">
      <div className="lot-line">
        <span>{set?.name}</span>
        <span className="muted">Lot {state.lotNumber} of {state.lotTotal}</span>
      </div>

      <section
        className={`stage ${leader ? 'has-leader' : ''} is-${c.state}`}
        style={leader ? { '--lead': leader.color, '--lead-ink': leader.ink } : undefined}
        aria-live="polite"
      >
        <div className="stage-player">
          <h2 className="stage-name">{p.name}</h2>
          <p className="stage-meta">
            {roleText(p)}, {p.country}{p.capped ? '' : ', uncapped'}
          </p>
          <p className="stage-base">Base price {money(p.base)}</p>
        </div>

        <div className="stage-bid">
          {c.state === 'live' && (
            <>
              <p className="stage-label">{leader ? `${leader.name} lead` : 'Waiting for an opening bid'}</p>
              <p className="stage-amount">{c.bid ? money(c.bid) : money(p.base)}</p>
            </>
          )}
          {c.state === 'sold' && (
            <>
              <p className="stage-label">Sold to {leader?.name}</p>
              <p className="stage-amount hammer">{money(c.bid)}</p>
            </>
          )}
          {c.state === 'unsold' && (
            <>
              <p className="stage-label">No bids at base price</p>
              <p className="stage-amount hammer">Unsold</p>
            </>
          )}
        </div>

        {c.state === 'live' && <Timer endsAt={c.endsAt} total={c.timerMs} paused={state.paused} />}
      </section>

      <div className="bid-bar">
        <button className="btn btn-gold btn-bid" disabled={!canBid} onClick={() => send('bid')}>
          {c.state === 'live' ? `Bid ${money(c.nextAmount)}` : 'Next player coming up'}
        </button>
        <p className="bid-hint">
          {c.state === 'live' && (blocker || (myTeam ? `Press B to bid. Your max bid is ${money(myTeam.maxBid)}.` : ''))}
        </p>
        {state.you.isHost && (
          state.paused
            ? <button className="btn btn-ghost" onClick={() => send('resume')}>Resume auction</button>
            : <button className="btn btn-ghost" onClick={() => send('pause')}>Pause auction</button>
        )}
      </div>

      <div className="stage-lower">
        <section>
          <h3 className="section-title">Bids on this player</h3>
          {c.history.length === 0 ? <p className="empty small">No bids yet</p> : (
            <ol className="history">
              {c.history.map((h, i) => {
                const t = state.teams.find(x => x.id === h.teamId);
                return (
                  <li key={c.history.length - i} style={{ '--team': t.color }}>
                    <span className="team-chip">{t.id}</span>
                    <span>{money(h.amount)}</span>
                  </li>
                );
              })}
            </ol>
          )}
        </section>
        <section>
          <h3 className="section-title">Auction room</h3>
          <ul className="log">
            {state.log.slice(0, 12).map(l => <li key={l.at + l.text} className={`log-${l.kind}`}>{l.text}</li>)}
          </ul>
        </section>
      </div>
    </div>
  );
}

/** Countdown bar driven by the server's end time, corrected for clock drift. */
function Timer({ endsAt, total, paused }) {
  const { serverNow } = useGame();
  const [left, setLeft] = useState(total);
  useEffect(() => {
    if (paused) return;
    let raf;
    const loop = () => { setLeft(Math.max(0, endsAt - serverNow())); raf = requestAnimationFrame(loop); };
    loop();
    return () => cancelAnimationFrame(raf);
  }, [endsAt, paused, serverNow]);

  const pct = Math.min(100, (left / total) * 100);
  return (
    <div className={`timer ${left < 3000 ? 'is-urgent' : ''}`}>
      <div className="timer-fill" style={{ width: `${pct}%` }} />
      <span className="timer-num">{Math.ceil(left / 1000)}s</span>
    </div>
  );
}
