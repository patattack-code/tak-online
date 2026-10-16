export const STARTING_RATING = 1500;

/** K-factor: new players move fast, established strong players move slowly. */
export function kFactor(rating: number, games: number): number {
  if (games < 20) return 40;
  if (rating >= 2200) return 10;
  return 20;
}

export function expectedScore(rating: number, opponentRating: number): number {
  return 1 / (1 + Math.pow(10, (opponentRating - rating) / 400));
}

export interface EloInput {
  rating: number;
  games: number;
}

export interface EloOutcome {
  a: number;
  b: number;
  deltaA: number;
  deltaB: number;
}

/**
 * Compute new ratings for players A and B.
 * `scoreA` is 1 for an A win, 0.5 for a draw, 0 for a B win.
 */
export function computeElo(a: EloInput, b: EloInput, scoreA: number): EloOutcome {
  const expA = expectedScore(a.rating, b.rating);
  const expB = 1 - expA;
  const deltaA = Math.round(kFactor(a.rating, a.games) * (scoreA - expA));
  const deltaB = Math.round(kFactor(b.rating, b.games) * (1 - scoreA - expB));
  return { a: a.rating + deltaA, b: b.rating + deltaB, deltaA, deltaB };
}
