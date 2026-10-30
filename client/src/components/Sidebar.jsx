import React, { useState } from 'react';
import { useGame } from '../App.jsx';
import AuctionList from './AuctionList.jsx';
import Squads from './Squads.jsx';

/** Always-available panel: the auction list and every team's squad. */
export default function Sidebar() {
  const { state } = useGame();
  const [tab, setTab] = useState(state.sets.length ? 'list' : 'squads');

  return (
    <aside className="sidebar">
      <div className="tabs" role="tablist">
        <button role="tab" aria-selected={tab === 'list'} className={`tab ${tab === 'list' ? 'is-on' : ''}`} onClick={() => setTab('list')}>
          Auction list
        </button>
        <button role="tab" aria-selected={tab === 'squads'} className={`tab ${tab === 'squads' ? 'is-on' : ''}`} onClick={() => setTab('squads')}>
          Squads
        </button>
      </div>
      <div className="sidebar-body">
        {tab === 'list' ? <AuctionList /> : <Squads />}
      </div>
    </aside>
  );
}
