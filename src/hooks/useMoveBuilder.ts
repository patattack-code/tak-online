import { useCallback, useMemo, useState } from 'react';
import type { Color, Coord, Direction, GameState, Move, PieceType } from '../engine/types';
import { carryLimit, dirDelta, inBounds, isOpening, legalMoves, placementColor, sameCoord, stackAt, topOf, validateMove } from '../engine/rules';
import type { Highlight, PendingMove } from '../components/Board';

export interface MoveBuilder {
  pending: PendingMove | null;
  placeType: PieceType;
  setPlaceType: (t: PieceType) => void;
  setCount: (n: number) => void;
  onSquareClick: (coord: Coord) => void;
  dropRest: () => void;
  cancel: () => void;
  highlights: Highlight[];
  error: string | null;
  /** The piece that a placement would put down right now. */
  placePiece: { color: Color; type: PieceType };
}

function dirBetween(a: Coord, b: Coord): Direction | null {
  if (a.c === b.c && b.r === a.r + 1) return '+';
  if (a.c === b.c && b.r === a.r - 1) return '-';
  if (a.r === b.r && b.c === a.c - 1) return '<';
  if (a.r === b.r && b.c === a.c + 1) return '>';
  return null;
}

function lastPathSquare(p: PendingMove): Coord {
  if (!p.dir) return p.from;
  const d = dirDelta(p.dir);
  return { c: p.from.c + d.c * p.drops.length, r: p.from.r + d.r * p.drops.length };
}

/** Whether some legal move starts with this pending prefix. */
function prefixIsLegal(moves: Move[], p: PendingMove): boolean {
  return moves.some(
    (m) =>
      m.kind === 'move' &&
      sameCoord(m.from, p.from) &&
      m.count === p.count &&
      (p.dir === null || m.dir === p.dir) &&
      p.drops.every((d, i) => (i === p.drops.length - 1 ? m.drops[i] >= d : m.drops[i] === d)),
  );
}

/**
 * Click-driven move construction.
 *
 * - Click an empty square: place the selected piece type.
 * - Click your own stack: pick it up (default carry = max). Then click along a
 *   straight line; every click on the next square drops one piece, clicking
 *   the same square again drops another. When nothing is left, the move is
 *   submitted. "Drop the rest" finishes early.
 */
export function useMoveBuilder(state: GameState, myColor: Color | null, submit: (move: Move) => void): MoveBuilder {
  const [pending, setPending] = useState<PendingMove | null>(null);
  const [placeType, setPlaceType] = useState<PieceType>('flat');
  const [error, setError] = useState<string | null>(null);

  const canAct = myColor !== null && state.toMove === myColor && !state.result;
  const moves = useMemo(() => (canAct ? legalMoves(state) : []), [state, canAct]);

  const finish = useCallback(
    (move: Move) => {
      const err = validateMove(state, move);
      if (err) {
        setError(err);
        setPending(null);
        return;
      }
      setError(null);
      setPending(null);
      setPlaceType('flat');
      submit(move);
    },
    [state, submit],
  );

  const cancel = useCallback(() => {
    setPending(null);
    setError(null);
  }, []);

  const onSquareClick = useCallback(
    (coord: Coord) => {
      if (!canAct) return;
      if (!pending) {
        const stack = stackAt(state, coord);
        if (stack.length === 0) {
          const type: PieceType = isOpening(state) ? 'flat' : placeType;
          finish({ kind: 'place', to: coord, type });
          return;
        }
        const top = topOf(stack)!;
        if (isOpening(state)) {
          setError('Your first move must place a stone on an empty square.');
          return;
        }
        if (top.color !== myColor) {
          setError('That stack is controlled by your opponent.');
          return;
        }
        setError(null);
        setPending({ from: coord, count: Math.min(carryLimit(state), stack.length), dir: null, drops: [] });
        return;
      }

      if (sameCoord(coord, pending.from)) {
        cancel();
        return;
      }
      const remaining = pending.count - pending.drops.reduce((a, b) => a + b, 0);
      const last = lastPathSquare(pending);
      let next: PendingMove | null = null;
      if (pending.dir === null) {
        const dir = dirBetween(pending.from, coord);
        if (dir) next = { ...pending, dir, drops: [1] };
      } else if (sameCoord(coord, last)) {
        if (remaining > 0) {
          const drops = pending.drops.slice();
          drops[drops.length - 1] += 1;
          next = { ...pending, drops };
        }
      } else {
        const d = dirDelta(pending.dir);
        const ahead = { c: last.c + d.c, r: last.r + d.r };
        if (sameCoord(coord, ahead) && inBounds(state.size, ahead) && remaining > 0) {
          next = { ...pending, drops: [...pending.drops, 1] };
        }
      }
      if (!next) {
        setError('Keep dropping in a straight line, or click the lifted stack to cancel.');
        return;
      }
      if (!prefixIsLegal(moves, next)) {
        setError('That drop is not legal (walls and capstones block the way).');
        return;
      }
      setError(null);
      const left = next.count - next.drops.reduce((a, b) => a + b, 0);
      if (left === 0 && next.dir) {
        finish({ kind: 'move', from: next.from, dir: next.dir, count: next.count, drops: next.drops });
      } else {
        setPending(next);
      }
    },
    [canAct, pending, state, placeType, myColor, moves, finish, cancel],
  );

  const dropRest = useCallback(() => {
    if (!pending || !pending.dir) return;
    const remaining = pending.count - pending.drops.reduce((a, b) => a + b, 0);
    const drops = pending.drops.slice();
    drops[drops.length - 1] += remaining;
    finish({ kind: 'move', from: pending.from, dir: pending.dir, count: pending.count, drops });
  }, [pending, finish]);

  const setCount = useCallback(
    (n: number) => {
      if (!pending || pending.dir) return;
      const max = Math.min(carryLimit(state), stackAt(state, pending.from).length);
      setPending({ ...pending, count: Math.max(1, Math.min(max, n)) });
    },
    [pending, state],
  );

  const highlights = useMemo<Highlight[]>(() => {
    if (!pending) return [];
    const out: Highlight[] = [{ coord: pending.from, kind: 'selected' }];
    const remaining = pending.count - pending.drops.reduce((a, b) => a + b, 0);
    if (pending.dir) {
      const d = dirDelta(pending.dir);
      let pos = { ...pending.from };
      for (let i = 0; i < pending.drops.length; i++) {
        pos = { c: pos.c + d.c, r: pos.r + d.r };
        out.push({ coord: pos, kind: 'path' });
      }
      if (remaining > 0) {
        const ahead = { c: pos.c + d.c, r: pos.r + d.r };
        if (prefixIsLegal(moves, { ...pending, drops: [...pending.drops, 1] })) out.push({ coord: ahead, kind: 'target' });
      }
    } else {
      for (const dir of ['+', '-', '<', '>'] as Direction[]) {
        const d = dirDelta(dir);
        const n = { c: pending.from.c + d.c, r: pending.from.r + d.r };
        if (prefixIsLegal(moves, { ...pending, dir, drops: [1] })) out.push({ coord: n, kind: 'target' });
      }
    }
    return out;
  }, [pending, moves]);

  const placePiece = useMemo(
    () => ({ color: placementColor(state), type: isOpening(state) ? ('flat' as PieceType) : placeType }),
    [state, placeType],
  );

  return { pending, placeType, setPlaceType, setCount, onSquareClick, dropRest, cancel, highlights, error, placePiece };
}
