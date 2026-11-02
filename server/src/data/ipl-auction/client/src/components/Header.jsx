import React from 'react';
import { useGame } from '../App.jsx';
import { money } from '../format.js';

const PHASE_LABEL = {
  retention: 'Retention window',
  poolReveal: 'Auction list revealed',
  auction: 'Live auction',
  accelSelect: 'Accelerated round nominations',
  results: 'Auction complete',
};

export default function Header() {
  const { state, myTeam } = useGame();
  const phase = state.phase === 'auction' && state.round === 'accelerated' ? 'Accelerated round' : PHASE_LABEL[state.phase];

  return (
    <header className="header" style={myTeam ? { '--team': myTeam.color } : undefined}>
      <div className="header-left">
        <span className="brand">Auction Room</span>
        <span className="header-code">Room {state.code}</span>
        <span className={`phase-pill ${state.paused ? 'is-paused' : ''}`}>{state.paused ? 'Paused' : phase}</span>
      </div>
      {myTeam ? (
        <div className="header-team">
          <span className="team-dot" />
          <span className="header-team-id">{myTeam.id}</span>
          <span className="stat"><b>{money(myTeam.purse)}</b> purse</span>
          <span className="stat"><b>{myTeam.squad.length}</b>/{state.rules.maxSquad} players</span>
          <span className="stat"><b>{myTeam.overseas}</b>/{state.rules.maxOverseas} overseas</span>
        </div>
      ) : (
        <span className="muted">Watching as {state.you.name}</span>
      )}
    </header>
  );
}
