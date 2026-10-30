import { RULES, roleKey } from './constants.js';

export const overseasCount = (team, players) =>
  team.squad.filter(s => players[s.playerId].overseas).length;

/**
 * Highest amount a team may bid right now.
 * A team must always keep enough purse to fill its remaining minimum
 * squad slots at the lowest base price (₹30 L each).
 */
export function maxBid(team) {
  const slotsStillNeededAfterThis = Math.max(0, RULES.minSquad - team.squad.length - 1);
  return team.purse - slotsStillNeededAfterThis * RULES.minBase;
}

/** Returns null if the team can bid `amount` on `player`, else the reason it can't. */
export function bidBlocker(team, player, amount, players) {
  if (team.squad.length >= RULES.maxSquad) return 'Squad is full (25 players)';
  if (player.overseas && overseasCount(team, players) >= RULES.maxOverseas) return 'Overseas limit reached (8)';
  if (amount > maxBid(team)) return 'Not enough purse left for this bid';
  return null;
}

/** Count of squad players per role bucket: BAT, WK, AR, PACE, SPIN */
export function roleCounts(team, players) {
  const c = { BAT: 0, WK: 0, AR: 0, PACE: 0, SPIN: 0 };
  for (const s of team.squad) c[roleKey(players[s.playerId])]++;
  return c;
}
