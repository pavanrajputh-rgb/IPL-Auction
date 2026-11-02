import { RULES, roleKey } from './constants.js';

// Set codes mirror the real auction sheet:
// M = marquee, BA = batters, AL = all-rounders, WK = wicketkeepers,
// FA = fast bowlers, SP = spinners, prefix U = uncapped.
const CATEGORIES = [
  { key: 'BAT',  code: 'BA', label: 'Batters' },
  { key: 'AR',   code: 'AL', label: 'All-rounders' },
  { key: 'WK',   code: 'WK', label: 'Wicketkeepers' },
  { key: 'PACE', code: 'FA', label: 'Fast bowlers' },
  { key: 'SPIN', code: 'SP', label: 'Spinners' },
];

const shuffle = arr => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

const chunk = (arr, size) =>
  Array.from({ length: Math.ceil(arr.length / size) }, (_, i) => arr.slice(i * size, i * size + size));

/**
 * @param poolPlayers players NOT retained by any team
 * @returns ordered sets: [{ code, name, playerIds }]
 *
 * Order: marquee sets first, then rounds of
 * capped BA1, AL1, WK1, FA1, SP1, uncapped UBA1 … USP1, then BA2 … and so on.
 * Players within a set are shuffled, as in the real auction.
 */
export function buildSets(poolPlayers) {
  const byRating = [...poolPlayers].sort((a, b) => b.rating - a.rating);
  const marquee = byRating.filter(p => p.capped).slice(0, RULES.marqueeCount);
  const marqueeIds = new Set(marquee.map(p => p.id));
  const rest = byRating.filter(p => !marqueeIds.has(p.id));

  const sets = [];
  const half = Math.ceil(marquee.length / 2);
  [marquee.slice(0, half), marquee.slice(half)].forEach((group, i) => {
    if (group.length) sets.push({ code: `M${i + 1}`, name: `Marquee set ${i + 1}`, playerIds: shuffle(group.map(p => p.id)) });
  });

  // Build chunked lists per (capped/uncapped × category)
  const lanes = [];
  for (const capped of [true, false]) {
    for (const cat of CATEGORIES) {
      const list = rest.filter(p => p.capped === capped && roleKey(p) === cat.key);
      lanes.push({ cat, capped, chunks: chunk(list, RULES.setSize) });
    }
  }

  const rounds = Math.max(0, ...lanes.map(l => l.chunks.length));
  for (let r = 0; r < rounds; r++) {
    for (const lane of lanes) {
      const group = lane.chunks[r];
      if (!group) continue;
      const prefix = lane.capped ? '' : 'U';
      sets.push({
        code: `${prefix}${lane.cat.code}${r + 1}`,
        name: `${lane.capped ? 'Capped' : 'Uncapped'} ${lane.cat.label.toLowerCase()} ${r + 1}`,
        playerIds: shuffle(group.map(p => p.id)),
      });
    }
  }
  return sets;
}
