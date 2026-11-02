import React from 'react';
import { useGame } from '../App.jsx';
import AuctionList from './AuctionList.jsx';

export default function PoolReveal() {
  const { state, send } = useGame();
  const total = state.sets.reduce((n, s) => n + s.playerIds.length, 0);

  return (
    <div className="page">
      <div className="reveal-head">
        <div>
          <h2 className="display">The auction list</h2>
          <p className="muted">
            {total} players across {state.sets.length} sets, in the order they will go under the hammer.
            Players are shuffled within each set. This list stays in the side panel for the whole auction.
          </p>
        </div>
        {state.you.isHost
          ? <button className="btn btn-gold btn-big" onClick={() => send('beginBidding')}>Start bidding</button>
          : <p className="muted">Waiting for the host to start bidding</p>}
      </div>
      <AuctionList openAll />
    </div>
  );
}
