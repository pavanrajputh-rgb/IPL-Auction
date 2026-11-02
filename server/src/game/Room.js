import { TEAMS, RULES, increment } from './constants.js';
import { buildSets } from './pool.js';
import { aiRetain, aiWalkAway, aiAccelNominations, aiThinkMs } from './ai.js';
import { maxBid, bidBlocker, overseasCount } from './squad.js';

/** Errors with a message that is safe to show the player. */
export class GameError extends Error {}
const fail = msg => { throw new GameError(msg); };

/*
 * Phases:
 *   lobby       → humans claim franchises
 *   retention   → each team retains 0–3 players (AI teams auto-decide)
 *   poolReveal  → full auction list shown before bidding starts
 *   auction     → live bidding, lot by lot (main round, then accelerated)
 *   accelSelect → teams nominate unsold players for the accelerated round
 *   results     → final squads
 *
 * The server is the single source of truth. Clients only send intents
 * ("bid", "retain these") and receive full snapshots back.
 */
export class Room {
  constructor(code, playerList, hostToken) {
    this.code = code;
    this.hostToken = hostToken;
    this.phase = 'lobby';
    this.round = 'main';
    this.humans = new Map(); // token -> { name, teamId }
    this.players = Object.fromEntries(playerList.map(p => [p.id, { ...p }]));
    this.teams = Object.fromEntries(TEAMS.map(t => [t.id, {
      ...t, owner: null, isAI: false, purse: RULES.purse, squad: [],
      retentionPicks: [], retentionConfirmed: false,
    }]));
    this.sets = [];
    this.lots = [];          // ordered [{ playerId, setCode }]
    this.lotIndex = -1;
    this.current = null;     // the player on the block
    this.results = {};       // playerId -> { status, teamId, price, round }
    this.ai = {};            // teamId -> { walkAway, wakeAt }
    this.accelNominations = {};
    this.paused = false;
    this.pausedAt = 0;
    // Host-controlled options, set in the lobby
    //   aiRetention: 'auto'    → AI teams pick their own retentions
    //                'release' → AI teams release everyone into the auction
    this.settings = { aiRetention: 'auto' };
    this.log = [];
    this.lastActive = Date.now();
  }

  // ───────────────────────── helpers ─────────────────────────
  isHost(token) { return token === this.hostToken; }
  requireHost(token) { if (!this.isHost(token)) fail('Only the host can do that'); }
  requirePhase(...phases) { if (!phases.includes(this.phase)) fail('That action is not available right now'); }
  myTeam(token) {
    const teamId = this.humans.get(token)?.teamId;
    if (!teamId) fail('You are not controlling a team');
    return this.teams[teamId];
  }
  aiTeams() { return Object.values(this.teams).filter(t => t.isAI); }
  addLog(text, kind = 'info') {
    this.log.unshift({ text, kind, at: Date.now() });
    this.log.length = Math.min(this.log.length, 60);
  }
  timerMs() { return this.round === 'main' ? RULES.bidTimerMs : RULES.accelTimerMs; }

  // ───────────────────────── lobby ─────────────────────────
  setSettings(token, patch = {}) {
    this.requireHost(token);
    this.requirePhase('lobby');
    if ('aiRetention' in patch) {
      if (!['auto', 'release'].includes(patch.aiRetention)) fail('Unknown retention option');
      this.settings.aiRetention = patch.aiRetention;
    }
  }

  /** What an AI-run team retains, according to the host's setting. */
  aiRetentionPicks(teamId) {
    return this.settings.aiRetention === 'release' ? [] : aiRetain(teamId, this.players);
  }

  join(token, name) {
    const existing = this.humans.get(token);
    this.humans.set(token, { name: name?.trim().slice(0, 24) || existing?.name || 'Guest', teamId: existing?.teamId ?? null });
  }

  pickTeam(token, teamId) {
    this.requirePhase('lobby');
    const team = this.teams[teamId] ?? fail('Unknown team');
    if (team.owner && team.owner !== token) fail(`${team.name} is already taken`);
    this.leaveTeam(token);
    team.owner = token;
    this.humans.get(token).teamId = teamId;
  }

  leaveTeam(token) {
    const human = this.humans.get(token);
    if (human?.teamId) this.teams[human.teamId].owner = null;
    if (human) human.teamId = null;
  }

  /** Host hands a team to the AI (e.g. a friend left mid-auction). */
  handToAI(token, teamId, now) {
    this.requireHost(token);
    const team = this.teams[teamId] ?? fail('Unknown team');
    for (const h of this.humans.values()) if (h.teamId === teamId) h.teamId = null;
    team.owner = null;
    if (this.phase === 'lobby') return;
    team.isAI = true;
    if (this.phase === 'retention' && !team.retentionConfirmed) {
      team.retentionPicks = this.aiRetentionPicks(team.id);
      this.applyRetention(team);
      this.checkRetentionDone();
    }
    if (this.current?.state === 'live') {
      this.ai[team.id] = { walkAway: aiWalkAway(team, this.players[this.current.playerId], this.players), wakeAt: now + aiThinkMs() };
    }
    this.addLog(`${team.id} is now run by AI`);
  }

  // ───────────────────────── retention ─────────────────────────
  startRetention(token) {
    this.requireHost(token);
    this.requirePhase('lobby');
    this.phase = 'retention';
    for (const team of Object.values(this.teams)) {
      if (team.owner) continue;
      team.isAI = true;
      team.retentionPicks = this.aiRetentionPicks(team.id);
      this.applyRetention(team);
    }
    this.addLog(this.settings.aiRetention === 'release'
      ? 'Retention window is open. AI teams have released all their players'
      : 'Retention window is open');
    this.checkRetentionDone();
  }

  setRetentionPicks(token, ids) {
    this.requirePhase('retention');
    const team = this.myTeam(token);
    if (team.retentionConfirmed) fail('Retentions are already locked');
    const unique = [...new Set(ids)];
    if (unique.length > RULES.maxRetentions) fail(`You can retain at most ${RULES.maxRetentions} players`);
    if (unique.some(id => this.players[id]?.team !== team.id)) fail('You can only retain players from your own squad');
    team.retentionPicks = unique;
  }

  confirmRetention(token) {
    this.requirePhase('retention');
    const team = this.myTeam(token);
    if (team.retentionConfirmed) return;
    this.applyRetention(team);
    this.checkRetentionDone();
  }

  applyRetention(team) {
    const cum = RULES.retentionCumulative;
    team.retentionPicks.forEach((id, i) => {
      team.squad.push({ playerId: id, price: cum[i + 1] - cum[i], via: 'retained' });
    });
    team.purse -= cum[team.retentionPicks.length];
    team.retentionConfirmed = true;
    const names = team.retentionPicks.map(id => this.players[id].name).join(', ');
    if (names || !team.isAI || this.settings.aiRetention !== 'release') {
      this.addLog(names ? `${team.id} retained ${names}` : `${team.id} retained nobody`);
    }
  }

  checkRetentionDone() {
    if (!Object.values(this.teams).every(t => t.retentionConfirmed)) return;
    const retained = new Set(Object.values(this.teams).flatMap(t => t.squad.map(s => s.playerId)));
    const pool = Object.values(this.players).filter(p => !retained.has(p.id));
    this.sets = buildSets(pool);
    this.lots = this.sets.flatMap(s => s.playerIds.map(playerId => ({ playerId, setCode: s.code })));
    this.phase = 'poolReveal';
    this.addLog(`Auction pool ready: ${this.lots.length} players in ${this.sets.length} sets`);
  }

  // ───────────────────────── live auction ─────────────────────────
  beginBidding(token, now) {
    this.requireHost(token);
    this.requirePhase('poolReveal');
    this.phase = 'auction';
    this.addLog('Bidding has started');
    this.nextLot(now);
  }

  nextLot(now) {
    this.lotIndex++;
    if (this.lotIndex >= this.lots.length) {
      this.current = null;
      if (this.round === 'main') this.enterAccelSelect();
      else this.finish();
      return;
    }
    const { playerId, setCode } = this.lots[this.lotIndex];
    this.current = { playerId, setCode, bid: null, leader: null, endsAt: now + this.timerMs(), state: 'live', history: [] };
    const player = this.players[playerId];
    for (const team of this.aiTeams()) {
      this.ai[team.id] = { walkAway: aiWalkAway(team, player, this.players), wakeAt: now + aiThinkMs() };
    }
  }

  nextAmount() {
    const c = this.current;
    return c.bid == null ? this.players[c.playerId].base : c.bid + increment(c.bid);
  }

  bid(token, now) {
    this.requirePhase('auction');
    this.placeBid(this.myTeam(token), now);
  }

  placeBid(team, now) {
    const c = this.current;
    if (!c || c.state !== 'live') fail('No player is up for bidding');
    if (this.paused) fail('The auction is paused');
    if (c.leader === team.id) fail('You already hold the highest bid');
    const amount = this.nextAmount();
    const blocker = bidBlocker(team, this.players[c.playerId], amount, this.players);
    if (blocker) fail(blocker);
    c.bid = amount;
    c.leader = team.id;
    c.endsAt = now + this.timerMs();       // clock resets on every bid
    c.history.unshift({ teamId: team.id, amount });
    for (const t of this.aiTeams()) {      // every other AI reconsiders
      if (t.id !== team.id && this.ai[t.id]) this.ai[t.id].wakeAt = now + aiThinkMs();
    }
  }

  /** Called every ~200 ms by the server loop. Returns true if state changed. */
  tick(now) {
    if (this.phase !== 'auction' || this.paused || !this.current) return false;
    const c = this.current;

    if (c.state === 'live') {
      const due = this.aiTeams()
        .filter(t => this.ai[t.id] && this.ai[t.id].wakeAt <= now && this.ai[t.id].wakeAt < c.endsAt)
        .sort((a, b) => this.ai[a.id].wakeAt - this.ai[b.id].wakeAt);
      for (const team of due) {
        this.ai[team.id].wakeAt = Infinity;
        if (team.id === c.leader) continue;
        const amount = this.nextAmount();
        const player = this.players[c.playerId];
        if (amount <= this.ai[team.id].walkAway && !bidBlocker(team, player, amount, this.players)) {
          this.placeBid(team, now);
          return true;
        }
      }
      if (now >= c.endsAt) { this.resolve(now); return true; }
      return false;
    }

    if (now >= c.resumeAt) { this.nextLot(now); return true; }
    return false;
  }

  resolve(now) {
    const c = this.current;
    const player = this.players[c.playerId];
    if (c.leader) {
      const team = this.teams[c.leader];
      team.squad.push({ playerId: player.id, price: c.bid, via: this.round === 'main' ? 'auction' : 'accelerated' });
      team.purse -= c.bid;
      this.results[player.id] = { status: 'sold', teamId: team.id, price: c.bid, round: this.round };
      c.state = 'sold';
      this.addLog(`${player.name} sold to ${team.id} for ${fmt(c.bid)}`, 'sold');
    } else {
      this.results[player.id] = { status: 'unsold', round: this.round };
      c.state = 'unsold';
      this.addLog(`${player.name} unsold`, 'unsold');
    }
    c.resumeAt = now + RULES.resultPauseMs;
  }

  pause(token, now) {
    this.requireHost(token);
    this.requirePhase('auction');
    if (this.paused) return;
    this.paused = true;
    this.pausedAt = now;
    this.addLog('Auction paused by host');
  }

  resume(token, now) {
    this.requireHost(token);
    if (!this.paused) return;
    const shift = now - this.pausedAt;
    this.paused = false;
    if (this.current) {
      this.current.endsAt += shift;
      if (this.current.resumeAt) this.current.resumeAt += shift;
    }
    for (const plan of Object.values(this.ai)) plan.wakeAt += shift;
    this.addLog('Auction resumed');
  }

  // ───────────────────────── accelerated round ─────────────────────────
  unsoldIds() {
    return Object.entries(this.results).filter(([, r]) => r.status === 'unsold').map(([id]) => id);
  }

  enterAccelSelect() {
    const unsold = this.unsoldIds();
    if (!unsold.length) return this.finish();
    this.phase = 'accelSelect';
    this.accelNominations = {};
    for (const team of this.aiTeams()) {
      this.accelNominations[team.id] = aiAccelNominations(team, unsold, this.players);
    }
    this.addLog('Main auction complete. Nominate unsold players for the accelerated round');
  }

  setAccelNominations(token, ids) {
    this.requirePhase('accelSelect');
    const team = this.myTeam(token);
    const unsold = new Set(this.unsoldIds());
    const picks = [...new Set(ids)].filter(id => unsold.has(id)).slice(0, 15);
    this.accelNominations[team.id] = picks;
  }

  startAccelerated(token, now) {
    this.requireHost(token);
    this.requirePhase('accelSelect');
    const ids = [...new Set(Object.values(this.accelNominations).flat())]
      .sort((a, b) => this.players[b].rating - this.players[a].rating);
    if (!ids.length) return this.finish();
    this.sets.push({ code: 'ACC', name: 'Accelerated round', playerIds: ids });
    this.lots = ids.map(playerId => ({ playerId, setCode: 'ACC' }));
    this.lotIndex = -1;
    this.round = 'accelerated';
    this.phase = 'auction';
    this.addLog(`Accelerated round: ${ids.length} players`);
    this.nextLot(now);
  }

  finish() {
    this.phase = 'results';
    this.current = null;
    this.addLog('The auction is complete');
  }

  // ───────────────────────── client view ─────────────────────────
  snapshot(token, now) {
    const me = this.humans.get(token);
    const nameOf = owner => (owner ? this.humans.get(owner)?.name : null);
    const c = this.current;
    return {
      code: this.code,
      phase: this.phase,
      round: this.round,
      paused: this.paused,
      serverNow: now,
      rules: RULES,
      settings: this.settings,
      you: { name: me?.name, teamId: me?.teamId ?? null, isHost: this.isHost(token) },
      people: [...this.humans.values()].map(h => ({ name: h.name, teamId: h.teamId })),
      teams: Object.values(this.teams).map(t => ({
        id: t.id, name: t.name, color: t.color, ink: t.ink,
        ownerName: nameOf(t.owner), isAI: t.isAI,
        purse: t.purse, maxBid: maxBid(t), squad: t.squad,
        overseas: overseasCount(t, this.players),
        retentionConfirmed: t.retentionConfirmed,
        // Keep a human's unconfirmed picks private
        retentionPicks: t.retentionConfirmed || t.id === me?.teamId ? t.retentionPicks : [],
      })),
      sets: this.sets,
      results: this.results,
      lotNumber: this.lotIndex + 1,
      lotTotal: this.lots.length,
      current: c && {
        playerId: c.playerId, setCode: c.setCode, bid: c.bid, leader: c.leader,
        endsAt: c.endsAt, state: c.state, history: c.history.slice(0, 8),
        nextAmount: c.state === 'live' ? this.nextAmount() : null,
        timerMs: this.timerMs(),
      },
      accel: this.phase === 'accelSelect' ? {
        unsold: this.unsoldIds(),
        mine: me?.teamId ? this.accelNominations[me.teamId] ?? [] : [],
        nominatedCount: new Set(Object.values(this.accelNominations).flat()).size,
      } : null,
      log: this.log.slice(0, 30),
    };
  }
}

export const fmt = l => (l >= 100 ? `₹${(l / 100).toFixed(2).replace(/\.?0+$/, '')} Cr` : `₹${l} L`);
