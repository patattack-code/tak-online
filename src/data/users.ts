import type { User } from 'firebase/auth';
import { doc, getDoc, limit, onSnapshot, orderBy, query, collection, serverTimestamp, setDoc, FieldPath, getDocs } from 'firebase/firestore';
import { requireDb } from '../firebase';
import type { SizeKey, UserDoc } from './types';

export function userRef(uid: string) {
  return doc(requireDb(), 'users', uid);
}

/** Create the profile document on first sign-in; refresh name and photo afterwards. */
export async function ensureUserDoc(user: User): Promise<void> {
  const ref = userRef(user.uid);
  const snap = await getDoc(ref);
  const displayName = user.displayName || user.email?.split('@')[0] || 'Player';
  if (!snap.exists()) {
    await setDoc(ref, {
      displayName,
      photoURL: user.photoURL ?? null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      ratings: {},
      totals: { games: 0, wins: 0, losses: 0, draws: 0 },
    });
    return;
  }
  const data = snap.data() as UserDoc;
  if (data.displayName !== displayName || data.photoURL !== (user.photoURL ?? null)) {
    await setDoc(ref, { displayName, photoURL: user.photoURL ?? null, updatedAt: serverTimestamp() }, { merge: true });
  }
}

export function subscribeUser(uid: string, cb: (user: UserDoc | null) => void, onError?: (e: Error) => void) {
  return onSnapshot(
    userRef(uid),
    (snap) => cb(snap.exists() ? (snap.data() as UserDoc) : null),
    (e) => onError?.(e),
  );
}

export interface LeaderboardEntry {
  uid: string;
  user: UserDoc;
}

export async function fetchLeaderboard(key: SizeKey, max = 50): Promise<LeaderboardEntry[]> {
  const q = query(collection(requireDb(), 'users'), orderBy(new FieldPath('ratings', key, 'rating'), 'desc'), limit(max));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ uid: d.id, user: d.data() as UserDoc }));
}
