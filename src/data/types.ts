import type { Timestamp } from 'firebase/firestore';
import type { BoardSize, Color, GameResult } from '../engine/types';

/** Per-board-size rating record stored under users/{uid}.ratings.s{size}. */
export interface SizeStats {
  rating: number;
  games: number;
  wins: number;
  losses: number;
  draws: number;
  roadWins: number;
  flatWins: number;
  peak: number;
  /** Rating after each rated game, most recent last. Capped at HISTORY_CAP. */
  history: number[];
}

export const HISTORY_CAP = 60;

export interface Totals {
  games: number;
  wins: number;
  losses: number;
  draws: number;
}

export interface UserDoc {
  displayName: string;
  photoURL: string | null;
  createdAt: Timestamp | null;
  updatedAt?: Timestamp | null;
  ratings: Partial<Record<SizeKey, SizeStats>>;
  totals: Totals;
  /** ID of the game whose completion last changed the ratings (checked by security rules). */
  lastRatedGame?: string;
}

export type SizeKey = 's3' | 's4' | 's5' | 's6' | 's7' | 's8';

export function sizeKey(size: BoardSize): SizeKey {
  return `s${size}` as SizeKey;
}

export type GameStatus = 'waiting' | 'active' | 'finished';
export type ColorChoice = Color | 'random';

export interface PlayerInfo {
  displayName: string;
  photoURL: string | null;
}

export interface GameDoc {
  /** Friendly name chosen at creation; its slug is the document ID and the URL. */
  name: string;
  size: BoardSize;
  creator: string;
  creatorColor: ColorChoice;
  white: string | null;
  black: string | null;
  playerIds: string[];
  names: Record<string, PlayerInfo>;
  status: GameStatus;
  moves: string[];
  toMoveUid: string | null;
  result: GameResult | null;
  rated: boolean;
  ratingApplied: boolean;
  ratingDelta: Record<string, number>;
  createdAt: Timestamp | null;
  updatedAt: Timestamp | null;
  finishedAt: Timestamp | null;
}

export interface GameSummary extends GameDoc {
  id: string;
}

export function emptyStats(): SizeStats {
  return { rating: 1500, games: 0, wins: 0, losses: 0, draws: 0, roadWins: 0, flatWins: 0, peak: 1500, history: [] };
}

export function colorOf(game: GameDoc, uid: string): Color | null {
  if (game.white === uid) return 'white';
  if (game.black === uid) return 'black';
  return null;
}
