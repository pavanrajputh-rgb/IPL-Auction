import { RULES, roleKey } from './constants.js';
import { maxBid, overseasCount, roleCounts } from './squad.js';

/*
 * How an AI franchise thinks
 * --------------------------
 * 1. Fair price   : what the market usually pays for a player of this rating.
 * 2. Need         : bids harder for roles its squad lacks, softer once covered.
 * 3. Personality  : each franchise has its own leanings and aggression.
 * 4. Purse sense  : won't blow the purse on one player unless he is a star.
 * 5. Noise        : walk-away price varies ±20% so auctions don't feel scripted.
 * The walk-away price is decided once when a player comes up; the AI keeps
 * bidding until the next bid would exceed it.
 */

// Ideal squad shape (about 20 players)
const TARGET = { WK: 2, BAT: 5, AR: 5, PACE: 5, SPIN: 3 };

// Franchise flavour — tweak freely
const PERSONALITY = {
  CSK:  { aggression: 0.95, likes: { AR: 1.15, SPIN: 1.1 } },
  MI:   { aggression: 1.05, likes: { PACE: 1.15 } },
  RCB:  { aggression: 1.10, likes: { BAT: 1.1 } },
  KKR:  { aggression: 1.00, likes: { AR: 1.15, SPIN: 1.05 } },
  SRH:  { aggression: 1.10, likes: { BAT: 1.15 } },
  RR:   { aggression: 0.95, likes: { SPIN: 1.1 }, uncappedBoost: 1.15 },
  DC:   { aggression: 1.00, likes: { WK: 1.05, PACE: 1.05 } },
  PBKS: { aggression: 1.15, likes: { AR: 1.05 } },
  LSG:  { aggression: 1.05, likes: { PACE: 1.1 } },
  GT:   { aggression: 0.95, likes: { PACE: 1.05, SPIN: 1.1 } },
};

const rand = (a, b) => a + Math.random() * (b - a);
const roundTo5 = v => Math.round(v / 5) * 5;

/** Market value in lakh. Rating 75 ≈ ₹2.5 Cr, 85 ≈ ₹7 Cr, 90 ≈ ₹12 Cr, 95 ≈ ₹20 Cr */
export function fairPrice(p) {
  return Math.max(p.base, roundTo5(30 * Math.exp((p.rating - 55) * 0.105)));
}

function needMultiplier(team, player, players) {
  const key = roleKey(player);
  const deficit = TARGET[key] - roleCounts(team, players)[key];
  if (deficit >= 2) return 1.25;
  if (deficit === 1) return 1.1;
  if (deficit === 0) return 0.7;
  return 0.35; // already deep in this role
}

/**
 * Teams with lots of money per open slot bid harder (real franchises rarely
 * leave crores unspent); cash-strapped teams bid softer.
 */
function spendPressure(team) {
  const slotsLeft = Math.max(1, 22 - team.squad.length);
  const perSlot = team.purse / slotsLeft;
  return Math.min(1.6, Math.max(0.8, perSlot / 350));
}

/** Walk-away price for this team on this player (lakh). 0 = not interested. */
export function aiWalkAway(team, player, players) {
  if (team.squad.length >= RULES.maxSquad) return 0;
  const os = overseasCount(team, players);
  if (player.overseas && os >= RULES.maxOverseas) return 0;

  const persona = PERSONALITY[team.id] ?? { aggression: 1, likes: {} };
  const need = needMultiplier(team, player, players);
  let cap = fairPrice(player)
    * need
    * persona.aggression
    * (persona.likes?.[roleKey(player)] ?? 1)
    * (!player.capped && persona.uncappedBoost ? persona.uncappedBoost : 1)
    * (player.overseas && os >= 6 ? 0.7 : 1) // save last overseas slots
    * spendPressure(team)
    * rand(0.8, 1.2);

  // Purse discipline: no single player takes more than ~28% of the purse
  // (keeps the record buy near real-auction levels, about ₹27 Cr)
  const share = player.rating >= 90 ? 0.28 : player.rating >= 84 ? 0.18 : player.rating >= 78 ? 0.12 : 0.06;
  cap = Math.min(cap, team.purse * share);

  // Squad-filling: under the minimum, always willing to pay base for a needed role
  if (team.squad.length < RULES.minSquad && need >= 0.7) cap = Math.max(cap, player.base);

  return Math.min(roundTo5(cap), maxBid(team));
}

/** Pick 0–3 players to retain from the team's previous squad. */
export function aiRetain(teamId, players) {
  const squad = Object.values(players)
    .filter(p => p.team === teamId)
    .sort((a, b) => fairPrice(b) - fairPrice(a));
  const picks = [];
  const slabCost = i => RULES.retentionCumulative[i + 1] - RULES.retentionCumulative[i];
  const appetite = [0.6, 0.8, 0.8]; // first retention: happy to pay a premium for the franchise face
  for (let i = 0; i < RULES.maxRetentions && i < squad.length; i++) {
    if (fairPrice(squad[i]) >= slabCost(i) * appetite[i]) picks.push(squad[i].id);
    else break;
  }
  return picks;
}

/** Players an AI team wants back in the accelerated round. */
export function aiAccelNominations(team, unsoldIds, players) {
  const counts = roleCounts(team, players);
  const short = Object.keys(TARGET).filter(k => counts[k] < TARGET[k]);
  const wanted = team.squad.length < RULES.minSquad ? 4 : 2;
  return unsoldIds
    .map(id => players[id])
    .filter(p => short.includes(roleKey(p)) || team.squad.length < RULES.minSquad)
    .sort((a, b) => b.rating - a.rating)
    .slice(0, wanted)
    .map(p => p.id);
}

/** Random think-time before an AI reacts, so bids don't land instantly. */
export const aiThinkMs = () => rand(400, 1800);
