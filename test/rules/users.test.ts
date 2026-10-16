import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import type { RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, getDoc, runTransaction, setDoc, updateDoc } from 'firebase/firestore';
import { activeGame, assertFails, assertSucceeds, createEnv, dbFor, seed, userDoc } from './helpers';

let env: RulesTestEnvironment;

beforeAll(async () => {
  env = await createEnv();
});
afterAll(async () => {
  await env.cleanup();
});
beforeEach(async () => {
  await env.clearFirestore();
});

describe('users: profiles', () => {
  it('are readable by anyone', async () => {
    await seed(env, { 'users/alice': userDoc() });
    await assertSucceeds(getDoc(doc(dbFor(env, null), 'users/alice')));
  });

  it('can be created by their owner with a clean payload', async () => {
    await assertSucceeds(setDoc(doc(dbFor(env, 'alice'), 'users/alice'), userDoc()));
  });

  it('cannot be created for someone else', async () => {
    await assertFails(setDoc(doc(dbFor(env, 'bob'), 'users/alice'), userDoc()));
  });

  it('cannot be created with ratings or totals pre-filled', async () => {
    const db = dbFor(env, 'alice');
    await assertFails(setDoc(doc(db, 'users/alice'), userDoc('Alice', { ratings: { s5: { rating: 3000, games: 0 } } })));
    await assertFails(setDoc(doc(db, 'users/alice'), userDoc('Alice', { totals: { games: 50, wins: 50, losses: 0, draws: 0 } })));
  });

  it('reject bad names and photo URLs', async () => {
    const db = dbFor(env, 'alice');
    await assertFails(setDoc(doc(db, 'users/alice'), userDoc('x'.repeat(51))));
    await assertFails(setDoc(doc(db, 'users/alice'), userDoc('Alice', { photoURL: 'javascript:alert(1)' })));
    await assertSucceeds(setDoc(doc(db, 'users/alice'), userDoc('Alice', { photoURL: 'https://example.com/a.png' })));
  });

  it('let the owner rename but not touch stats', async () => {
    await seed(env, { 'users/alice': userDoc() });
    const db = dbFor(env, 'alice');
    await assertSucceeds(updateDoc(doc(db, 'users/alice'), { displayName: 'Alice B' }));
    await assertFails(updateDoc(doc(db, 'users/alice'), { 'ratings.s5': { rating: 2500, games: 1 } }));
    await assertFails(updateDoc(doc(db, 'users/alice'), { 'totals.wins': 99 }));
  });

  it('cannot be edited by other users directly', async () => {
    await seed(env, { 'users/alice': userDoc() });
    const db = dbFor(env, 'bob');
    await assertFails(updateDoc(doc(db, 'users/alice'), { displayName: 'Hacked' }));
    await assertFails(updateDoc(doc(db, 'users/alice'), { 'ratings.s5': { rating: 100, games: 1 } }));
  });
});

/** Mirrors finishGame in src/data/games.ts: finish the game and bump both players in one transaction. */
function finishRated(uid: string, gameId: string, deltas: { white: number; black: number }, opts: { winner?: 'white' | 'black' | null; ratingWhite?: number; gamesWhite?: number } = {}) {
  const db = dbFor(env, uid);
  const winner = opts.winner === undefined ? 'white' : opts.winner;
  return runTransaction(db, async (tx) => {
    const gref = doc(db, `games/${gameId}`);
    const g = (await tx.get(gref)).data()!;
    const score = (c: 'white' | 'black') => (winner === c ? 1 : winner === null ? 0.5 : 0);
    const stats = (uid2: string, delta: number, c: 'white' | 'black', rating = 1500, games = 0) => ({
      ratings: {
        s5: {
          rating: rating + delta,
          games: games + 1,
          wins: score(c) === 1 ? 1 : 0,
          losses: score(c) === 0 ? 1 : 0,
          draws: score(c) === 0.5 ? 1 : 0,
          roadWins: 0,
          flatWins: 0,
          peak: Math.max(rating, rating + delta),
          history: [rating + delta],
        },
      },
      totals: { games: 1, wins: score(c) === 1 ? 1 : 0, losses: score(c) === 0 ? 1 : 0, draws: score(c) === 0.5 ? 1 : 0 },
      lastRatedGame: gameId,
      updatedAt: new Date(),
    });
    tx.set(doc(db, `users/${g.white}`), stats(g.white, deltas.white, 'white', opts.ratingWhite, opts.gamesWhite), { merge: true });
    tx.set(doc(db, `users/${g.black}`), stats(g.black, deltas.black, 'black'), { merge: true });
    tx.update(gref, {
      status: 'finished',
      result: winner === null ? { winner: null, type: 'draw' } : { winner, type: 'resign' },
      toMoveUid: null,
      finishedAt: new Date(),
      ratingApplied: true,
      ratingDelta: { [g.white]: deltas.white, [g.black]: deltas.black },
      updatedAt: new Date(),
    });
  });
}

describe('users: rating updates', () => {
  beforeEach(async () => {
    await seed(env, {
      'users/alice': userDoc('Alice'),
      'users/bob': userDoc('Bob'),
      'games/g1': activeGame('alice', 'bob'),
    });
  });

  it('succeed when tied to the game finishing in the same transaction', async () => {
    await assertSucceeds(finishRated('bob', 'g1', { white: 20, black: -20 }));
  });

  it('succeed for a draw with small deltas', async () => {
    await assertSucceeds(finishRated('bob', 'g1', { white: 3, black: -3 }, { winner: null }));
  });

  it('reject deltas that do not match the game record', async () => {
    const db = dbFor(env, 'bob');
    await assertFails(
      runTransaction(db, async (tx) => {
        tx.set(doc(db, 'users/bob'), { ratings: { s5: { rating: 1900, games: 1 } }, totals: { games: 1, wins: 0, losses: 1, draws: 0 }, lastRatedGame: 'g1' }, { merge: true });
        tx.set(doc(db, 'users/alice'), { ratings: { s5: { rating: 1520, games: 1 } }, totals: { games: 1, wins: 1, losses: 0, draws: 0 }, lastRatedGame: 'g1' }, { merge: true });
        tx.update(doc(db, 'games/g1'), {
          status: 'finished', result: { winner: 'white', type: 'resign' }, toMoveUid: null, finishedAt: new Date(),
          ratingApplied: true, ratingDelta: { alice: 20, bob: -20 }, updatedAt: new Date(),
        });
      }),
    );
  });

  it('reject oversized deltas', async () => {
    await assertFails(finishRated('bob', 'g1', { white: 400, black: -400 }));
  });

  it('reject stats writes without a game', async () => {
    const db = dbFor(env, 'bob');
    await assertFails(setDoc(doc(db, 'users/bob'), { ratings: { s5: { rating: 2000, games: 1 } }, totals: { games: 1, wins: 1, losses: 0, draws: 0 }, lastRatedGame: 'nope' }, { merge: true }));
  });

  it('reject stats writes by someone outside the game', async () => {
    await seed(env, { 'users/carol': userDoc('Carol') });
    await assertFails(finishRated('carol', 'g1', { white: 20, black: -20 }));
  });

  it('reject applying ratings twice', async () => {
    await seed(env, { 'games/g1': activeGame('alice', 'bob', { ratingApplied: true }) });
    await assertFails(finishRated('bob', 'g1', { white: 20, black: -20 }));
  });

  it('reject rating updates for unrated games', async () => {
    await seed(env, { 'games/g1': activeGame('alice', 'bob', { rated: false }) });
    await assertFails(finishRated('bob', 'g1', { white: 20, black: -20 }));
  });
});
