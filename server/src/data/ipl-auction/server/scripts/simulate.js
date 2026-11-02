// Runs a full all-AI auction instantly (fake clock) and prints the outcome.
// Use it to tune ratings and AI behaviour:  npm run simulate
import { Room } from '../src/game/Room.js';
import { loadPlayers } from '../src/data/loadPlayers.js';
import { RULES } from '../src/game/constants.js';
import { fairPrice } from '../src/game/ai.js';

const fmt = l => (l >= 100 ? `₹${(l / 100).toFixed(2)} Cr` : `₹${l} L`);
const room = new Room('SIM', loadPlayers(), 'host');
let now = 0;
const run = () => { let guard = 0; while (room.phase === 'auction' && guard++ < 2e6) { now += 200; room.tick(now); } };

room.startRetention('host');          // all 10 teams are AI
room.beginBidding('host', now);
run();
if (room.phase === 'accelSelect') { room.startAccelerated('host', now); run(); }

console.log(`Phase: ${room.phase}\n`);
for (const t of Object.values(room.teams)) {
  const os = t.squad.filter(s => room.players[s.playerId].overseas).length;
  const top = [...t.squad].sort((a, b) => b.price - a.price).slice(0, 4)
    .map(s => `${room.players[s.playerId].name} ${fmt(s.price)}${s.via === 'retained' ? ' (R)' : ''}`).join(', ');
  console.log(`${t.id.padEnd(5)} squad ${String(t.squad.length).padStart(2)}  overseas ${os}  purse left ${fmt(t.purse).padEnd(10)} | ${top}`);
}
const sold = Object.entries(room.results).filter(([, r]) => r.status === 'sold')
  .sort((a, b) => b[1].price - a[1].price).slice(0, 10);
console.log('\nTop buys:');
for (const [id, r] of sold) console.log(`  ${room.players[id].name.padEnd(22)} ${r.teamId.padEnd(5)} ${fmt(r.price).padEnd(10)} (fair ${fmt(fairPrice(room.players[id]))})`);
const under = Object.values(room.teams).filter(t => t.squad.length < RULES.minSquad).map(t => t.id);
console.log(`\nTeams under ${RULES.minSquad}: ${under.join(', ') || 'none'}`);
console.log(`Unsold: ${Object.values(room.results).filter(r => r.status === 'unsold').length}`);
