import type { User } from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  where,
  type Transaction,
} from 'firebase/firestore';
import { requireDb } from '../firebase';
import { applyMove, opponent } from '../engine/rules';
import { moveToPtn, replay } from '../engine/ptn';
import { computeElo } from '../engine/elo';
import type { BoardSize, Color, GameResult, Move } from '../engine/types';
import { HISTORY_CAP, emptyStats, sizeKey, type ColorChoice, type GameDoc, type GameSummary, type SizeStats, type UserDoc } from './types';
import { userRef } from './users';
import { NAME_MAX, randomName, slugify } from './slug';

export function gameRef(id: string) {
  return doc(requireDb(), 'games', id);
}

function playerInfo(user: User) {
  return {
    displayName: user.displayName || user.email?.split('@')[0] || 'Player',
    photoURL: user.photoURL ?? null,
  };
}

/**
 * Create a game whose document ID is the slug of its friendly name, so the
 * share URL reads /game/friday-night-tak. If that slug is taken, a numeric
 * suffix is added (friday-night-tak-2, -3, …). Returns the final ID.
 */
export async function createGame(user: User, size: BoardSize, creatorColor: ColorChoice, rated: boolean, rawName: string): Promise<string> {
  const name = rawName.trim().slice(0, NAME_MAX) || randomName();
  const base = slugify(name) || slugify(randomName());
  const payload = {
    name,
    size,
    creator: user.uid,
    creatorColor,
    white: null,
    black: null,
    playerIds: [user.uid],
    names: { [user.uid]: playerInfo(user) },
    status: 'waiting',
    moves: [],
    toMoveUid: null,
    result: null,
    rated,
    ratingApplied: false,
    ratingDelta: {},
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    finishedAt: null,
  };
  return runTransaction(requireDb(), async (tx) => {
    for (let attempt = 1; attempt <= 20; attempt++) {
      const id = attempt === 1 ? base : `${base}-${attempt}`;
      const ref = gameRef(id);
      const existing = await tx.get(ref);
      if (!existing.exists()) {
        tx.set(ref, payload);
        return id;
      }
    }
    throw new Error('That name is already in use many times over; please pick another.');
  });
}

export async function cancelGame(id: string): Promise<void> {
  await deleteDoc(gameRef(id));
}

export async function joinGame(id: string, user: User): Promise<void> {
  await runTransaction(requireDb(), async (tx) => {
    const ref = gameRef(id);
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error('Game not found.');
    const game = snap.data() as GameDoc;
    if (game.status !== 'waiting') throw new Error('This game has already started.');
    if (game.creator === user.uid) throw new Error('You cannot join your own game.');
    const creatorIsWhite = game.creatorColor === 'white' || (game.creatorColor === 'random' && Math.random() < 0.5);
    const white = creatorIsWhite ? game.creator : user.uid;
    const black = creatorIsWhite ? user.uid : game.creator;
    tx.update(ref, {
      white,
      black,
      playerIds: [game.creator, user.uid],
      [`names.${user.uid}`]: playerInfo(user),
      status: 'active',
      toMoveUid: white,
      updatedAt: serverTimestamp(),
    });
  });
}

/**
 * Submit a move inside a transaction. The transaction re-validates the move
 * against the latest server state, so two clients cannot submit out of order.
 * If the move ends the game, ratings are updated in the same transaction.
 */
export async function submitMove(id: string, uid: string, move: Move, expectedPly: number): Promise<void> {
  await runTransaction(requireDb(), async (tx) => {
    const ref = gameRef(id);
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error('Game not found.');
    const game = snap.data() as GameDoc;
    if (game.status !== 'active') throw new Error('This game is not in progress.');
    if (game.toMoveUid !== uid) throw new Error('It is not your turn.');
    if (game.moves.length !== expectedPly) throw new Error('The game moved on; please try again.');

    const before = replay(game.size, game.moves);
    const after = applyMove(before, move);
    const moves = [...game.moves, moveToPtn(move)];
    const nextUid = after.toMove === 'white' ? game.white : game.black;

    if (after.result) {
      await finishGame(tx, id, game, after.result);
      tx.update(ref, { moves, toMoveUid: null, updatedAt: serverTimestamp() });
    } else {
      tx.update(ref, { moves, toMoveUid: nextUid, updatedAt: serverTimestamp() });
    }
  });
}

export async function resignGame(id: string, uid: string): Promise<void> {
  await runTransaction(requireDb(), async (tx) => {
    const ref = gameRef(id);
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error('Game not found.');
    const game = snap.data() as GameDoc;
    if (game.status !== 'active') throw new Error('This game is not in progress.');
    const me: Color | null = game.white === uid ? 'white' : game.black === uid ? 'black' : null;
    if (!me) throw new Error('You are not playing this game.');
    await finishGame(tx, id, game, { winner: opponent(me), type: 'resign' });
    tx.update(ref, { toMoveUid: null, updatedAt: serverTimestamp() });
  });
}

/**
 * Mark a game finished and, when rated, update both players' statistics.
 * Must be called inside a transaction after all other reads.
 */
async function finishGame(tx: Transaction, id: string, game: GameDoc, result: GameResult): Promise<void> {
  const ref = gameRef(id);
  const whiteUid = game.white!;
  const blackUid = game.black!;
  const update: Record<string, unknown> = {
    status: 'finished',
    result,
    finishedAt: serverTimestamp(),
  };

  if (game.rated && !game.ratingApplied) {
    const [wSnap, bSnap] = await Promise.all([tx.get(userRef(whiteUid)), tx.get(userRef(blackUid))]);
    const wDoc = (wSnap.data() ?? {}) as Partial<UserDoc>;
    const bDoc = (bSnap.data() ?? {}) as Partial<UserDoc>;
    const key = sizeKey(game.size);
    const wStats: SizeStats = { ...emptyStats(), ...(wDoc.ratings?.[key] ?? {}) };
    const bStats: SizeStats = { ...emptyStats(), ...(bDoc.ratings?.[key] ?? {}) };
    const scoreWhite = result.winner === 'white' ? 1 : result.winner === 'black' ? 0 : 0.5;
    const elo = computeElo({ rating: wStats.rating, games: wStats.games }, { rating: bStats.rating, games: bStats.games }, scoreWhite);

    const bump = (s: SizeStats, newRating: number, score: number): SizeStats => ({
      rating: newRating,
      games: s.games + 1,
      wins: s.wins + (score === 1 ? 1 : 0),
      losses: s.losses + (score === 0 ? 1 : 0),
      draws: s.draws + (score === 0.5 ? 1 : 0),
      roadWins: s.roadWins + (score === 1 && result.type === 'road' ? 1 : 0),
      flatWins: s.flatWins + (score === 1 && result.type === 'flat' ? 1 : 0),
      peak: Math.max(s.peak, newRating),
      history: [...s.history, newRating].slice(-HISTORY_CAP),
    });
    const totals = (t: Partial<UserDoc['totals']> | undefined, score: number) => ({
      games: (t?.games ?? 0) + 1,
      wins: (t?.wins ?? 0) + (score === 1 ? 1 : 0),
      losses: (t?.losses ?? 0) + (score === 0 ? 1 : 0),
      draws: (t?.draws ?? 0) + (score === 0.5 ? 1 : 0),
    });

    tx.set(
      userRef(whiteUid),
      { ratings: { [key]: bump(wStats, elo.a, scoreWhite) }, totals: totals(wDoc.totals, scoreWhite), updatedAt: serverTimestamp() },
      { merge: true },
    );
    tx.set(
      userRef(blackUid),
      { ratings: { [key]: bump(bStats, elo.b, 1 - scoreWhite) }, totals: totals(bDoc.totals, 1 - scoreWhite), updatedAt: serverTimestamp() },
      { merge: true },
    );
    update.ratingApplied = true;
    update.ratingDelta = { [whiteUid]: elo.deltaA, [blackUid]: elo.deltaB };
  }

  tx.update(ref, update);
}

export function subscribeGame(id: string, cb: (game: GameSummary | null) => void, onError?: (e: Error) => void) {
  return onSnapshot(
    gameRef(id),
    (snap) => cb(snap.exists() ? ({ id: snap.id, ...(snap.data() as GameDoc) } as GameSummary) : null),
    (e) => onError?.(e),
  );
}

export function subscribeOpenGames(cb: (games: GameSummary[]) => void, onError?: (e: Error) => void) {
  const q = query(collection(requireDb(), 'games'), where('status', '==', 'waiting'), orderBy('createdAt', 'desc'), limit(50));
  return onSnapshot(
    q,
    (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...(d.data() as GameDoc) }))),
    (e) => onError?.(e),
  );
}

export function subscribeMyGames(uid: string, cb: (games: GameSummary[]) => void, onError?: (e: Error) => void) {
  const q = query(collection(requireDb(), 'games'), where('playerIds', 'array-contains', uid), orderBy('updatedAt', 'desc'), limit(100));
  return onSnapshot(
    q,
    (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...(d.data() as GameDoc) }))),
    (e) => onError?.(e),
  );
}

export async function fetchFinishedGames(uid: string, max = 50): Promise<GameSummary[]> {
  const q = query(collection(requireDb(), 'games'), where('playerIds', 'array-contains', uid), orderBy('updatedAt', 'desc'), limit(200));
  const snap = await getDocs(q);
  return snap.docs
    .map((d) => ({ id: d.id, ...(d.data() as GameDoc) }))
    .filter((g) => g.status === 'finished')
    .slice(0, max);
}
