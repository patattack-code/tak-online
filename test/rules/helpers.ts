import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, setDoc, type Firestore } from 'firebase/firestore';

export { assertFails, assertSucceeds } from '@firebase/rules-unit-testing';

export const PROJECT = 'tak-rules-test';

export async function createEnv(): Promise<RulesTestEnvironment> {
  return initializeTestEnvironment({
    projectId: PROJECT,
    firestore: { rules: readFileSync('firestore.rules', 'utf8') },
  });
}

export function userDoc(displayName = 'Alice', extra: Record<string, unknown> = {}) {
  return {
    displayName,
    photoURL: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ratings: {},
    totals: { games: 0, wins: 0, losses: 0, draws: 0 },
    ...extra,
  };
}

export function waitingGame(creator: string, extra: Record<string, unknown> = {}) {
  return {
    name: 'Test game',
    size: 5,
    creator,
    creatorColor: 'random',
    white: null,
    black: null,
    playerIds: [creator],
    names: { [creator]: { displayName: creator, photoURL: null } },
    status: 'waiting',
    moves: [],
    toMoveUid: null,
    result: null,
    rated: true,
    ratingApplied: false,
    ratingDelta: {},
    createdAt: new Date(),
    updatedAt: new Date(),
    finishedAt: null,
    ...extra,
  };
}

export function activeGame(white: string, black: string, extra: Record<string, unknown> = {}) {
  return waitingGame(white, {
    white,
    black,
    playerIds: [white, black],
    names: {
      [white]: { displayName: white, photoURL: null },
      [black]: { displayName: black, photoURL: null },
    },
    status: 'active',
    toMoveUid: white,
    moves: ['a5', 'e1'],
    ...extra,
  });
}

/** Seed documents with rules disabled. */
export async function seed(env: RulesTestEnvironment, docs: Record<string, Record<string, unknown>>) {
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore() as unknown as Firestore;
    for (const [path, data] of Object.entries(docs)) {
      await setDoc(doc(db, path), data);
    }
  });
}

export function dbFor(env: RulesTestEnvironment, uid: string | null): Firestore {
  const ctx = uid ? env.authenticatedContext(uid) : env.unauthenticatedContext();
  return ctx.firestore() as unknown as Firestore;
}
