# IPL Auction Room

A real-time multiplayer IPL-style mega auction. Friends claim franchises, retain up to three players, then bid live. Every franchise nobody claims is run by an AI bidder.

## Run it locally

You need Node.js 18 or newer.

```bash
npm run install:all   # installs root, server and client packages
npm run dev           # server on :3001, React app on :5173
```

Open http://localhost:5173, create a room, and share the five-letter code. Friends on the same Wi-Fi can join at `http://<your-computer's-IP>:5173` (run `npx vite --host` inside `client/` to expose it).

To test the AI without playing, run a full all-AI auction in a couple of seconds:

```bash
npm run simulate
```

## How a game flows

1. **Lobby.** Players claim franchises. The host is whoever created the room.
2. **Retention.** Each human picks 0–3 players from their franchise's previous squad. Costs are cumulative: ₹15 Cr for one, ₹23 Cr for two and ₹30 Cr for three. AI teams decide instantly. The host can hand an idle player's team to the AI.
3. **Auction list.** Every non-retained player goes into the pool, grouped into sets in real-auction order (M1, M2, BA1, AL1, WK1, FA1, SP1, UBA1 and so on). The list stays in the side panel for the rest of the game, with live sold and unsold status.
4. **Live auction.** One player at a time. Every bid resets a 10-second clock, and the host can pause or resume. Press **B** to bid.
5. **Accelerated round.** Teams nominate unsold players, who come back with a 7-second clock.
6. **Results.** Shows the biggest buys and a franchise summary. The Squads panel shows every team grouped by Batters, Wicketkeepers, All-rounders and Bowlers.

## Rules enforced by the server

- ₹120 Cr purse, a squad of 18–25 players, and at most 8 overseas players.
- A team can never bid so high that it can't fill its remaining minimum slots at ₹30 L each.
- Bid increments are ₹5 L up to ₹1 Cr, ₹10 L up to ₹2 Cr, ₹20 L up to ₹5 Cr, then ₹25 L. Check these against the current IPL regulations and edit `increment()` if they differ.
- All numbers live in `server/src/game/constants.js`. Money is stored in lakh, so `1500` means ₹15 Cr.

## Project layout

```
server/
  src/index.js            Express + Socket.io, rooms, 200 ms game loop
  src/game/Room.js        State machine for every phase (the rules live here)
  src/game/ai.js          AI retention, valuation and bidding
  src/game/pool.js        Builds auction sets
  src/game/squad.js       Purse and squad-limit checks
  src/game/constants.js   Franchises, rules, bid increments
  src/data/players.csv    Player database (edit in Excel)
  scripts/simulate.js     Instant all-AI auction for tuning
client/
  src/App.jsx             Connection, shared state, phase routing
  src/components/         Home, Lobby, Retention, PoolReveal, AuctionStage,
                          AccelSelect, Results, Sidebar, AuctionList, Squads
```

The server is the single source of truth. Browsers send intents such as "bid" or "retain these", and the server validates them, updates state and pushes a fresh snapshot to everyone. That design keeps the timer, purse maths and AI consistent across all screens and prevents cheating from the browser console.

## Player data

`server/src/data/players.csv` holds about 400 players. It contains the IPL 2025 squads, which still decide each franchise's retention pool, plus IPL players from 2008 onward as free agents. **Every rating reflects the player's IPL prime and is an estimate.** Base prices are derived from the rating. Edit any row freely.

Columns:

- **name**: player name (no commas)
- **role**: BAT, WK, AR or BOWL
- **bowl**: pace or spin (blank for batters and keepers)
- **country**: India counts as domestic, anything else is overseas
- **capped**: Y or N
- **base_lakh**: 30, 50, 75, 100, 125, 150 or 200
- **team**: CSK, MI, RCB, KKR, SRH, RR, DC, PBKS, LSG or GT, or blank for free agents
- **rating**: 1–100; drives AI valuation (75 ≈ ₹2.5 Cr, 85 ≈ ₹7 Cr, 90 ≈ ₹12 Cr)

If the CSV has fewer than 260 players, the loader adds clearly labelled "Domestic …" placeholder players at ₹30 L so every team can still build a legal squad.

## Tuning the AI

The AI logic is in `server/src/game/ai.js`:

- `fairPrice()` maps rating to market value.
- `TARGET` sets the ideal squad shape.
- `PERSONALITY` gives each franchise its own leanings, for example SRH chasing batting firepower and CSK favouring spin and all-rounders.
- `spendPressure()` makes cash-rich teams push harder.
- Walk-away prices vary by ±20%, so no two auctions play out the same.

Run `npm run simulate` after any change to see where the money goes.

## Deploy so friends can play online

Socket.io needs a host that keeps long-lived connections open, such as Render, Railway or Fly.io. Serverless platforms like Vercel will not work for the server. On Render:

1. Push this folder to a GitHub repo.
2. Create a new **Web Service** from the repo.
3. Set the build command to `npm run install:all && npm run build`.
4. Set the start command to `npm start`.

The server serves the built React app itself, so it is one URL for everything.

## Known limits and good next steps

- Rooms live in memory, so restarting the server ends running games. Add Redis or a database to persist them.
- There is no RTM (Right to Match) card, per the house rule of 3 retentions. You can add it in `Room.resolve()` by offering the player's previous team a match before confirming the sale.
- Player identity is a random token in the browser, which is fine among friends. Add real login if you open it up publicly.
- Long auctions: with about 230 lots, a full game takes roughly an hour. Lower `bidTimerMs` or trim the CSV for quicker games.
