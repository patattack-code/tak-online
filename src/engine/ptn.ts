import type { BoardSize, Coord, Direction, GameState, Move, PieceType } from './types';
import { applyMove, newGame } from './rules';

const FILES = 'abcdefgh';

export function coordToSquare({ c, r }: Coord): string {
  return `${FILES[c]}${r + 1}`;
}

export function squareToCoord(sq: string): Coord {
  const c = FILES.indexOf(sq[0]);
  const r = parseInt(sq.slice(1), 10) - 1;
  if (c < 0 || Number.isNaN(r)) throw new Error(`Bad square: ${sq}`);
  return { c, r };
}

/**
 * Serialize a move to Portable Tak Notation.
 * Placements: `a1`, `Sa1` (wall), `Ca1` (capstone).
 * Movements: `3c3>12` = carry 3 from c3 eastward, dropping 1 then 2.
 */
export function moveToPtn(move: Move): string {
  if (move.kind === 'place') {
    const prefix = move.type === 'wall' ? 'S' : move.type === 'cap' ? 'C' : '';
    return `${prefix}${coordToSquare(move.to)}`;
  }
  const count = move.count > 1 ? String(move.count) : '';
  const drops = move.drops.length > 1 ? move.drops.join('') : '';
  return `${count}${coordToSquare(move.from)}${move.dir}${drops}`;
}

const MOVE_RE = /^([1-8])?([a-h][1-8])([+\-<>])([1-8]*)[*']*$/;
const PLACE_RE = /^([FSC])?([a-h][1-8])[*']*$/;

export function ptnToMove(ptn: string): Move {
  const text = ptn.trim();
  const mv = MOVE_RE.exec(text);
  if (mv) {
    const [, countStr, sq, dir, dropsStr] = mv;
    const drops = dropsStr ? dropsStr.split('').map((d) => parseInt(d, 10)) : [];
    const count = countStr ? parseInt(countStr, 10) : drops.length ? drops.reduce((a, b) => a + b, 0) : 1;
    return {
      kind: 'move',
      from: squareToCoord(sq),
      dir: dir as Direction,
      count,
      drops: drops.length ? drops : [count],
    };
  }
  const pl = PLACE_RE.exec(text);
  if (pl) {
    const [, prefix, sq] = pl;
    const type: PieceType = prefix === 'S' ? 'wall' : prefix === 'C' ? 'cap' : 'flat';
    return { kind: 'place', to: squareToCoord(sq), type };
  }
  throw new Error(`Cannot parse move: ${ptn}`);
}

/** Replay a list of PTN moves from the starting position. */
export function replay(size: BoardSize, moves: string[]): GameState {
  let state = newGame(size);
  for (const m of moves) state = applyMove(state, ptnToMove(m));
  return state;
}

/** Human-readable description of a move for move lists and screen readers. */
export function describeMove(move: Move): string {
  if (move.kind === 'place') {
    const name = move.type === 'wall' ? 'wall' : move.type === 'cap' ? 'capstone' : 'flat';
    return `Place ${name} on ${coordToSquare(move.to)}`;
  }
  const dirName = { '+': 'north', '-': 'south', '<': 'west', '>': 'east' }[move.dir];
  return `Move ${move.count} from ${coordToSquare(move.from)} ${dirName} (${move.drops.join(',')})`;
}
