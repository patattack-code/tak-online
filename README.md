# Tak Online

A web client for the board game **Tak** with real-time online play, Google sign-in, and per-board-size Elo ratings. Built with React, TypeScript, Vite and Firebase (Authentication, Firestore, Hosting).

- Every board size from the rules: 3×3, 4×4, 5×5, 6×6, 7×7, 8×8, with the official piece counts and carry limits.
- Complete rules engine with unit tests (`src/engine`): opening swap, placements, stack moves, wall flattening, road and flat wins, draws.
- 2.5D isometric SVG renderer (`src/render/iso.ts`). The same code exports static assets to `public/assets` (`npm run render-assets`).
- Online games stored in Firestore and updated through transactions, so moves are validated against the latest server state.
- Player profile page with a rating card per board size (rating, trend, win/loss/draw, peak, road vs flat wins) and game history.
- Leaderboard per board size. Practice board that works without any Firebase setup.

## 1. Install and run locally

```bash
npm install
npm run dev
```

Open http://localhost:5173. Without Firebase configured you get a setup page plus the practice board.

Run the engine tests with `npm test`.

## 2. Create the Firebase project

1. Go to https://console.firebase.google.com and **Add project** (the free Spark plan is enough; nothing here needs Cloud Functions).
2. **Build → Authentication → Get started → Sign-in method → Google → Enable.** Pick a support email and save.
3. **Build → Firestore Database → Create database.** Choose a location near your players and start in **production mode** (the rules in this repo replace the defaults in step 4).
4. **Project settings (gear) → Your apps → Web (</>)**. Register an app (enable Hosting if asked). Copy the `firebaseConfig` values.
5. Copy `.env.example` to `.env.local` and paste the values:

   ```
   VITE_FIREBASE_API_KEY=...
   VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
   VITE_FIREBASE_PROJECT_ID=your-project
   VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
   VITE_FIREBASE_MESSAGING_SENDER_ID=...
   VITE_FIREBASE_APP_ID=...
   ```

6. Restart `npm run dev`. The lobby now shows a Google sign-in button.

## 3. Deploy rules, indexes and hosting

```bash
firebase login
firebase use --add        # pick the project, alias it "default"
firebase deploy --only firestore
npm run deploy            # builds and deploys hosting + firestore
```

After the first deploy, add your hosting domain (`your-project.web.app`) under **Authentication → Settings → Authorized domains** if it is not already there. `localhost` is authorized by default.

## How it fits together

| Area | Where |
|------|-------|
| Rules, notation, Elo | `src/engine/` (`rules.ts`, `ptn.ts`, `elo.ts`, tests in `rules.test.ts`) |
| Isometric geometry and SVG export | `src/render/iso.ts`, `scripts/render-assets.ts` |
| Board component and click-to-move | `src/components/Board.tsx`, `src/hooks/useMoveBuilder.ts` |
| Firestore access | `src/data/games.ts` (create/join/move/resign, rating update), `src/data/users.ts` |
| Pages | `src/pages/` (Lobby, Game, Profile, Leaderboard, Practice, Rules, Setup) |
| Security rules and indexes | `firestore.rules`, `firestore.indexes.json` |

### Data model

- `users/{uid}`: `displayName`, `photoURL`, `ratings.s5 = { rating, games, wins, losses, draws, roadWins, flatWins, peak, history[] }` (one entry per board size), `totals`.
- `games/{id}`: the ID is the slug of the game's friendly `name` (so `/game/friday-night-tak`; a numeric suffix is added on collisions), plus `size`, `white`, `black`, `playerIds`, `names`, `status` (`waiting` → `active` → `finished`), `moves` (PTN strings), `toMoveUid`, `result`, `rated`, `ratingDelta`.

Moves are stored in [Portable Tak Notation](https://ustak.org/portable-tak-notation/) and replayed on the client. A finished rated game updates both players' ratings inside the same Firestore transaction as the final move, guarded by `ratingApplied` so it happens once.

### Ratings

Standard Elo per board size, starting at 1500. K = 40 for a player's first 20 games on that size, 20 afterwards, 10 above 2200. Draws score 0.5.

### Known limits

- No clocks or timeouts yet. Abandoned games stay active until someone resigns.
- Rating updates run in the client transaction and are protected by security rules, which is fine among friends. For a public server, move `finishGame` in `src/data/games.ts` into a Cloud Function and lock down writes to `ratings`.
