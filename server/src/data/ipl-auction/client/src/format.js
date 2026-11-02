// Money is stored in lakh everywhere (100 L = 1 Cr).
export function money(l) {
  if (l == null) return '';
  if (l >= 100) return `₹${(l / 100).toFixed(2).replace(/\.?0+$/, '')} Cr`;
  return `₹${l} L`;
}

export const GROUPS = [
  { role: 'BAT', label: 'Batters' },
  { role: 'WK', label: 'Wicketkeepers' },
  { role: 'AR', label: 'All-rounders' },
  { role: 'BOWL', label: 'Bowlers' },
];

/** Human-readable role, e.g. "Spin all-rounder", "Pace bowler" */
export function roleText(p) {
  if (p.role === 'BAT') return 'Batter';
  if (p.role === 'WK') return 'Wicketkeeper';
  const style = p.bowl === 'spin' ? 'Spin' : 'Pace';
  return p.role === 'AR' ? `${style} all-rounder` : `${style} bowler`;
}
