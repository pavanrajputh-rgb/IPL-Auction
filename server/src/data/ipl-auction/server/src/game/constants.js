// All money in the game is stored in LAKH (1 Cr = 100 L) to avoid float errors.

export const TEAMS = [
  { id: 'CSK',  name: 'Chennai Super Kings',         color: '#F9CD05', ink: '#1B1B1B' },
  { id: 'MI',   name: 'Mumbai Indians',              color: '#0A4BA0', ink: '#FFFFFF' },
  { id: 'RCB',  name: 'Royal Challengers Bengaluru', color: '#C8102E', ink: '#FFFFFF' },
  { id: 'KKR',  name: 'Kolkata Knight Riders',       color: '#3A225D', ink: '#F2C14E' },
  { id: 'SRH',  name: 'Sunrisers Hyderabad',         color: '#F26522', ink: '#1B1B1B' },
  { id: 'RR',   name: 'Rajasthan Royals',            color: '#EA1A85', ink: '#FFFFFF' },
  { id: 'DC',   name: 'Delhi Capitals',              color: '#17449B', ink: '#FFFFFF' },
  { id: 'PBKS', name: 'Punjab Kings',                color: '#DD1F2D', ink: '#FFFFFF' },
  { id: 'LSG',  name: 'Lucknow Super Giants',        color: '#00A3E0', ink: '#0B1F3A' },
  { id: 'GT',   name: 'Gujarat Titans',              color: '#1C2C5B', ink: '#D9B45A' },
];

export const RULES = {
  purse: 12000,                              // ₹120 Cr
  // Cumulative retention cost by number of players retained: 0, 1, 2, 3
  retentionCumulative: [0, 1500, 2300, 3000], // ₹0 / 15 / 23 / 30 Cr
  maxRetentions: 3,
  minSquad: 18,
  maxSquad: 25,
  maxOverseas: 8,
  minBase: 30,                               // lowest base price, ₹30 L
  bidTimerMs: 10000,                         // countdown resets on every bid
  accelTimerMs: 7000,                        // faster clock in the accelerated round
  resultPauseMs: 2500,                       // how long SOLD / UNSOLD stays on screen
  marqueeCount: 12,                          // top capped players split into 2 marquee sets
  setSize: 8,                                // players per regular set
};

// Bid increment slabs (in lakh). Verify against the latest IPL auction regulations.
export function increment(bid) {
  if (bid < 100) return 5;    // up to ₹1 Cr: +₹5 L
  if (bid < 200) return 10;   // ₹1–2 Cr: +₹10 L
  if (bid < 500) return 20;   // ₹2–5 Cr: +₹20 L
  return 25;                  // above ₹5 Cr: +₹25 L
}

// Role buckets used for sets and squad balance.
// PACE / SPIN are derived from role BOWL + bowling style.
export function roleKey(p) {
  if (p.role === 'BOWL') return p.bowl === 'spin' ? 'SPIN' : 'PACE';
  return p.role; // BAT, WK, AR
}
