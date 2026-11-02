import React, { useMemo, useState } from 'react';
import { useGame } from '../App.jsx';
import { money, roleText } from '../format.js';

/** Every set in auction order with each player's live status. */
export default function AuctionList({ openAll = false }) {
  const { state, players } = useGame();
  const { sets, results, current } = state;
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState({});

  const counts = useMemo(() => {
    const all = sets.flatMap(s => s.playerIds);
    const sold = all.filter(id => results[id]?.status === 'sold').length;
    const unsold = all.filter(id => results[id]?.status === 'unsold').length;
    return { total: new Set(all).size, sold, unsold };
  }, [sets, results]);

  if (!sets.length) {
    return <p className="empty">The auction list appears once every team has locked its retentions.</p>;
  }

  const q = query.trim().toLowerCase();
  const isOpen = s => (q ? true : open[s.code] ?? (openAll || s.code === current?.setCode));

  return (
    <div className="alist">
      <div className="alist-top">
        <input className="search" placeholder="Search players" value={query} onChange={e => setQuery(e.target.value)} />
        <p className="muted small">
          {counts.total} players: {counts.sold} sold, {counts.unsold} unsold, {counts.total - counts.sold - counts.unsold} to go
        </p>
      </div>

      {sets.map(set => {
        const ids = set.playerIds.filter(id => !q || players[id]?.name.toLowerCase().includes(q));
        if (!ids.length) return null;
        const live = set.code === current?.setCode;
        const done = set.playerIds.every(id => results[id] && !(set.code === 'ACC' && results[id].round === 'main'));
        return (
          <section key={set.code} className={`aset ${live ? 'is-live' : ''} ${done && !live ? 'is-done' : ''}`}>
            <button className="aset-head" onClick={() => setOpen(o => ({ ...o, [set.code]: !isOpen(set) }))} aria-expanded={isOpen(set)}>
              <span className="aset-code">{set.code}</span>
              <span className="aset-name">{set.name}</span>
              <span className="aset-count">{set.playerIds.length}</span>
            </button>
            {isOpen(set) && (
              <ul className="aset-list">
                {ids.map(id => <Row key={id} id={id} set={set} />)}
              </ul>
            )}
          </section>
        );
      })}
    </div>
  );
}

function Row({ id, set }) {
  const { state, players } = useGame();
  const p = players[id];
  if (!p) return null;
  const r = state.results[id];
  const onBlock = state.current?.playerId === id && state.current.state === 'live';
  // In the accelerated set, a main-round "unsold" result means "waiting to come back"
  const pending = set.code === 'ACC' && r?.round === 'main';

  let status = <span className="st st-up">Base {money(p.base)}</span>;
  if (onBlock) status = <span className="st st-live">On the block</span>;
  else if (r && !pending && r.status === 'sold') status = <span className="st st-sold">{r.teamId} {money(r.price)}</span>;
  else if (r && !pending && r.status === 'unsold') status = <span className="st st-unsold">Unsold</span>;

  return (
    <li className={`arow ${onBlock ? 'is-live' : ''}`}>
      <span className="arow-name">
        {p.name}
        {p.overseas && <span className="tag" title={p.country}>Overseas</span>}
        {!p.capped && <span className="tag tag-quiet">Uncapped</span>}
      </span>
      <span className="arow-role">{roleText(p)}</span>
      {status}
    </li>
  );
}
