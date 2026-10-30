import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { socket, getToken } from './socket.js';
import Home from './components/Home.jsx';
import Lobby from './components/Lobby.jsx';
import Retention from './components/Retention.jsx';
import PoolReveal from './components/PoolReveal.jsx';
import AuctionStage from './components/AuctionStage.jsx';
import AccelSelect from './components/AccelSelect.jsx';
import Results from './components/Results.jsx';
import Sidebar from './components/Sidebar.jsx';
import Header from './components/Header.jsx';

const GameContext = createContext(null);
export const useGame = () => useContext(GameContext);

export default function App() {
  const [state, setState] = useState(null);
  const [players, setPlayers] = useState({});
  const [toasts, setToasts] = useState([]);
  const [connected, setConnected] = useState(socket.connected);
  const clockOffset = useRef(0); // server time minus local time, keeps timers in sync

  const toast = useCallback((t) => {
    const id = Math.random();
    setToasts(list => [...list, { ...t, id }]);
    setTimeout(() => setToasts(list => list.filter(x => x.id !== id)), 3500);
  }, []);

  useEffect(() => {
    const onState = s => { clockOffset.current = s.serverNow - Date.now(); setState(s); };
    const onConnect = () => {
      setConnected(true);
      // Rejoin automatically after a refresh or a dropped connection
      const code = localStorage.getItem('ipl.room');
      if (code) {
        socket.emit('joinRoom', { code, name: localStorage.getItem('ipl.name'), token: getToken() }, res => {
          if (!res?.ok) localStorage.removeItem('ipl.room');
        });
      }
    };
    socket.on('state', onState);
    socket.on('players', setPlayers);
    socket.on('toast', toast);
    socket.on('connect', onConnect);
    socket.on('disconnect', () => setConnected(false));
    if (socket.connected) onConnect();
    return () => { socket.removeAllListeners(); };
  }, [toast]);

  const send = useCallback((event, payload) => socket.emit(event, payload), []);
  const serverNow = useCallback(() => Date.now() + clockOffset.current, []);

  const leaveRoom = () => {
    localStorage.removeItem('ipl.room');
    window.location.reload();
  };

  const ctx = { state, players, send, serverNow, toast, leaveRoom };
  const myTeam = state?.teams.find(t => t.id === state.you.teamId) ?? null;

  let main = null;
  if (state) {
    switch (state.phase) {
      case 'retention':   main = <Retention />; break;
      case 'poolReveal':  main = <PoolReveal />; break;
      case 'auction':     main = <AuctionStage />; break;
      case 'accelSelect': main = <AccelSelect />; break;
      case 'results':     main = <Results />; break;
      default:            main = null;
    }
  }

  return (
    <GameContext.Provider value={{ ...ctx, myTeam }}>
      {!connected && <div className="conn-banner" role="status">Reconnecting to the auction server…</div>}
      {!state && <Home />}
      {state?.phase === 'lobby' && <Lobby />}
      {state && state.phase !== 'lobby' && (
        <div className="app">
          <Header />
          <div className="shell">
            <main className="main">{main}</main>
            <Sidebar />
          </div>
        </div>
      )}
      <div className="toasts" aria-live="polite">
        {toasts.map(t => <div key={t.id} className={`toast ${t.kind}`}>{t.text}</div>)}
      </div>
    </GameContext.Provider>
  );
}
