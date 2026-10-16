import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import type { RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { deleteDoc, doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { activeGame, assertFails, assertSucceeds, createEnv, dbFor, seed, userDoc, waitingGame } from './helpers';

let env: RulesTestEnvironment;

beforeAll(async () => {
  env = await createEnv();
});
afterAll(async () => {
  await env.cleanup();
});
beforeEach(async () => {
  await env.clearFirestore();
  await seed(env, { 'users/alice': userDoc('Alice'), 'users/bob': userDoc('Bob'), 'users/carol': userDoc('Carol') });
});

const info = (name: string) => ({ displayName: name, photoURL: null });

describe('games: read', () => {
  it('requires sign-in, but any signed-in user may spectate', async () => {
    await seed(env, { 'games/g1': activeGame('alice', 'bob') });
    await assertFails(getDoc(doc(dbFor(env, null), 'games/g1')));
    await assertSucceeds(getDoc(doc(dbFor(env, 'carol'), 'games/g1')));
  });
});

describe('games: create', () => {
  it('accepts a clean waiting game under a slug ID', async () => {
    await assertSucceeds(setDoc(doc(dbFor(env, 'alice'), 'games/friday-night'), waitingGame('alice')));
  });

  it('rejects IDs that are not slugs', async () => {
    await assertFails(setDoc(doc(dbFor(env, 'alice'), 'games/Friday Night'), waitingGame('alice')));
  });

  it('rejects impersonation, extra keys and pre-set state', async () => {
    const db = dbFor(env, 'alice');
    await assertFails(setDoc(doc(db, 'games/g'), waitingGame('bob')));
    await assertFails(setDoc(doc(db, 'games/g'), waitingGame('alice', { admin: true })));
    await assertFails(setDoc(doc(db, 'games/g'), waitingGame('alice', { status: 'active' })));
    await assertFails(setDoc(doc(db, 'games/g'), waitingGame('alice', { ratingApplied: true })));
    await assertFails(setDoc(doc(db, 'games/g'), waitingGame('alice', { size: 9 })));
    await assertFails(setDoc(doc(db, 'games/g'), waitingGame('alice', { creatorColor: 'purple' })));
    await assertFails(setDoc(doc(db, 'games/g'), waitingGame('alice', { names: { alice: info('A'), bob: info('B') } })));
    await assertFails(setDoc(doc(db, 'games/g'), waitingGame('alice', { names: { alice: info('x'.repeat(51)) } })));
  });
});

describe('games: join', () => {
  const join = (uid: string, white: string, black: string, extra: Record<string, unknown> = {}) =>
    updateDoc(doc(dbFor(env, uid), 'games/g1'), {
      white,
      black,
      playerIds: ['alice', uid],
      [`names.${uid}`]: info(uid),
      status: 'active',
      toMoveUid: white,
      updatedAt: new Date(),
      ...extra,
    });

  it('lets another player take the open colour', async () => {
    await seed(env, { 'games/g1': waitingGame('alice') });
    await assertSucceeds(join('bob', 'alice', 'bob'));
  });

  it('honours the creator colour choice', async () => {
    await seed(env, { 'games/g1': waitingGame('alice', { creatorColor: 'white' }) });
    await assertFails(join('bob', 'bob', 'alice'));
    await assertSucceeds(join('bob', 'alice', 'bob'));
  });

  it('rejects the creator joining their own game', async () => {
    await seed(env, { 'games/g1': waitingGame('alice') });
    await assertFails(join('alice', 'alice', 'alice'));
  });

  it('rejects smuggling in a third player or rewriting the creator', async () => {
    await seed(env, { 'games/g1': waitingGame('alice') });
    await assertFails(join('bob', 'alice', 'bob', { playerIds: ['alice', 'bob', 'carol'] }));
    await assertFails(join('bob', 'alice', 'bob', { 'names.alice': info('Not Alice') }));
    await assertFails(join('bob', 'alice', 'bob', { rated: false }));
    await assertFails(join('bob', 'alice', 'bob', { toMoveUid: 'bob' }));
  });
});

describe('games: moves', () => {
  beforeEach(async () => {
    await seed(env, { 'games/g1': activeGame('alice', 'bob') }); // alice (white) to move, 2 moves played
  });

  const move = (uid: string, moves: string[], extra: Record<string, unknown> = {}) =>
    updateDoc(doc(dbFor(env, uid), 'games/g1'), { moves, toMoveUid: uid === 'alice' ? 'bob' : 'alice', updatedAt: new Date(), ...extra });

  it('lets the player to move append one well-formed move', async () => {
    await assertSucceeds(move('alice', ['a5', 'e1', 'c3']));
  });

  it('works for the very first move of a game', async () => {
    await seed(env, { 'games/g1': activeGame('alice', 'bob', { moves: [] }) });
    await assertSucceeds(move('alice', ['a5']));
  });

  it('rejects moves out of turn', async () => {
    await assertFails(move('bob', ['a5', 'e1', 'c3']));
  });

  it('rejects rewriting history, multiple moves and garbage', async () => {
    await assertFails(move('alice', ['a5', 'b1', 'c3']));
    await assertFails(move('alice', ['a5', 'e1', 'c3', 'c4']));
    await assertFails(move('alice', ['a5', 'e1', 'DROP TABLE']));
    await assertFails(move('alice', ['a5', 'e1', 'x'.repeat(5000)]));
    await assertFails(move('alice', ['a5', 'e1']));
  });

  it('rejects touching protected fields', async () => {
    await assertFails(move('alice', ['a5', 'e1', 'c3'], { white: 'carol' }));
    await assertFails(move('alice', ['a5', 'e1', 'c3'], { rated: false }));
    await assertFails(move('alice', ['a5', 'e1', 'c3'], { size: 3 }));
    await assertFails(move('alice', ['a5', 'e1', 'c3'], { name: 'renamed' }));
  });

  it('rejects declaring a result while the game stays active', async () => {
    await assertFails(move('alice', ['a5', 'e1', 'c3'], { result: { winner: 'white', type: 'road' } }));
  });

  it('rejects updates by non-participants', async () => {
    await assertFails(updateDoc(doc(dbFor(env, 'carol'), 'games/g1'), { updatedAt: new Date() }));
  });

  const finish = (uid: string, result: unknown, delta: Record<string, number>, extra: Record<string, unknown> = {}) =>
    updateDoc(doc(dbFor(env, uid), 'games/g1'), {
      moves: ['a5', 'e1', 'c3'],
      toMoveUid: null,
      status: 'finished',
      result,
      finishedAt: new Date(),
      ratingApplied: true,
      ratingDelta: delta,
      updatedAt: new Date(),
      ...extra,
    });

  it('lets a move finish the game with sane rating deltas', async () => {
    await assertSucceeds(finish('alice', { winner: 'white', type: 'road' }, { alice: 20, bob: -20 }));
  });

  it('rejects a loser who records a gain, oversized deltas, and odd keys', async () => {
    await assertFails(finish('alice', { winner: 'white', type: 'road' }, { alice: 20, bob: 20 }));
    await assertFails(finish('alice', { winner: 'white', type: 'road' }, { alice: 400, bob: -400 }));
    await assertFails(finish('alice', { winner: 'white', type: 'road' }, { alice: 20, bob: -20, carol: 500 }));
    await assertFails(finish('alice', { winner: 'white', type: 'road' }, { alice: 20 }));
    await assertFails(finish('alice', { winner: 'white', type: 'bogus' }, { alice: 20, bob: -20 }));
    await assertFails(finish('alice', { winner: 'white', type: 'draw' }, { alice: 0, bob: 0 }));
  });

  it('rejects rating fields on an unrated game', async () => {
    await seed(env, { 'games/g1': activeGame('alice', 'bob', { rated: false }) });
    await assertFails(finish('alice', { winner: 'white', type: 'road' }, { alice: 20, bob: -20 }));
    await assertSucceeds(finish('alice', { winner: 'white', type: 'road' }, {}, { ratingApplied: false }));
  });
});

describe('games: resign', () => {
  beforeEach(async () => {
    await seed(env, { 'games/g1': activeGame('alice', 'bob') });
  });

  const resign = (uid: string, winner: string, type = 'resign', delta: Record<string, number> = { alice: 20, bob: -20 }) =>
    updateDoc(doc(dbFor(env, uid), 'games/g1'), {
      toMoveUid: null,
      status: 'finished',
      result: { winner, type },
      finishedAt: new Date(),
      ratingApplied: true,
      ratingDelta: delta,
      updatedAt: new Date(),
    });

  it('lets a player resign and hand the win to the opponent', async () => {
    await assertSucceeds(resign('bob', 'white'));
  });

  it('rejects resigning in your own favour or faking a road without a move', async () => {
    await assertFails(resign('bob', 'black', 'resign', { alice: -20, bob: 20 }));
    await assertFails(resign('bob', 'white', 'road'));
    await assertFails(resign('alice', 'white'));
  });
});

describe('games: delete', () => {
  it('only the creator may withdraw, and only while waiting', async () => {
    await seed(env, { 'games/w': waitingGame('alice'), 'games/a': activeGame('alice', 'bob') });
    await assertFails(deleteDoc(doc(dbFor(env, 'bob'), 'games/w')));
    await assertFails(deleteDoc(doc(dbFor(env, 'alice'), 'games/a')));
    await assertSucceeds(deleteDoc(doc(dbFor(env, 'alice'), 'games/w')));
  });
});
