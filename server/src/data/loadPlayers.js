import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { RULES, TEAMS } from '../game/constants.js';

const here = path.dirname(fileURLToPath(import.meta.url));

/**
 * Reads players.csv and returns an array of player objects.
 * CSV columns: name,role,bowl,country,capped,base_lakh,team,rating
 *   role   : BAT | WK | AR | BOWL
 *   bowl   : pace | spin | (blank for batters / keepers)
 *   capped : Y | N
 *   team   : franchise id from constants.js, blank = free agent
 *   rating : 1-100, drives AI valuation (tune these freely)
 */
export function loadPlayers(file = path.join(here, 'players.csv')) {
  const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/).filter(l => l.trim());
  const header = lines.shift().split(',').map(h => h.trim());
  const validTeams = new Set(TEAMS.map(t => t.id));

  const players = lines.map((line, i) => {
    const cells = line.split(',').map(c => c.trim());
    const row = Object.fromEntries(header.map((h, j) => [h, cells[j] ?? '']));
    const team = validTeams.has(row.team) ? row.team : null;
    return {
      id: `P${String(i + 1).padStart(3, '0')}`,
      name: row.name,
      role: row.role,
      bowl: row.bowl || null,
      country: row.country,
      overseas: row.country.toLowerCase() !== 'india',
      capped: row.capped.toUpperCase() === 'Y',
      base: Number(row.base_lakh) || RULES.minBase,
      team,                         // franchise the player was with before retention
      rating: Number(row.rating) || 60,
      placeholder: false,
    };
  });

  return topUpWithPlaceholders(players);
}

/**
 * 10 teams × 18 minimum players needs a deep pool. If the CSV is short,
 * add clearly-labelled placeholder uncapped Indian players at ₹30 L base
 * so every team can still complete a legal squad. Replace them with real
 * names in the CSV whenever you like.
 */
function topUpWithPlaceholders(players, target = 260) {
  const mix = [
    { role: 'BAT',  bowl: null,   label: 'Batter' },
    { role: 'BOWL', bowl: 'pace', label: 'Pace Bowler' },
    { role: 'AR',   bowl: 'pace', label: 'Pace All-rounder' },
    { role: 'BOWL', bowl: 'spin', label: 'Spinner' },
    { role: 'AR',   bowl: 'spin', label: 'Spin All-rounder' },
    { role: 'WK',   bowl: null,   label: 'Wicketkeeper' },
  ];
  let n = 1;
  while (players.length < target) {
    const m = mix[(n - 1) % mix.length];
    players.push({
      id: `X${String(n).padStart(3, '0')}`,
      name: `Domestic ${m.label} ${String(Math.ceil(n / mix.length)).padStart(2, '0')}`,
      role: m.role,
      bowl: m.bowl,
      country: 'India',
      overseas: false,
      capped: false,
      base: RULES.minBase,
      team: null,
      rating: 56 + Math.floor(Math.random() * 13), // 56–68
      placeholder: true,
    });
    n++;
  }
  return players;
}
