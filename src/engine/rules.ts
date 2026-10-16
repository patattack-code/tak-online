import {
  BOARD_SIZES,
  DIRECTIONS,
  PIECE_COUNTS,
  type BoardSize,
  type Color,
  type Coord,
  type Direction,
  type GameResult,
  type GameState,
  type Move,
  type Piece,
  type Stack,
} from './types';

export function isBoardSize(n: number): n is BoardSize {
  return (BOARD_SIZES as number[]).includes(n);
}

export function newGame(size: BoardSize): GameState {
  const board: Stack[] = [];
  for (let i = 0; i < size * size; i++) board.push([]);
  return {
    size,
    board,
    toMove: 'white',
    ply: 0,
    reserves: {
      white: { ...PIECE_COUNTS[size] },
      black: { ...PIECE_COUNTS[size] },
    },
    result: null,
  };
}

export function opponent(color: Color): Color {
  return color === 'white' ? 'black' : 'white';
}

export function idx(size: number, c: number, r: number): number {
  return r * size + c;
}

export function inBounds(size: number, { c, r }: Coord): boolean {
  return c >= 0 && r >= 0 && c < size && r < size;
}

export function stackAt(state: GameState, coord: Coord): Stack {
  return state.board[idx(state.size, coord.c, coord.r)];
}

export function topOf(stack: Stack): Piece | undefined {
  return stack[stack.length - 1];
}

export function dirDelta(dir: Direction): Coord {
  switch (dir) {
    case '+':
      return { c: 0, r: 1 };
    case '-':
      return { c: 0, r: -1 };
    case '<':
      return { c: -1, r: 0 };
    case '>':
      return { c: 1, r: 0 };
  }
}

export function sameCoord(a: Coord, b: Coord): boolean {
  return a.c === b.c && a.r === b.r;
}

/** True during the two opening plies, when each player places an opponent's flat. */
export function isOpening(state: GameState): boolean {
  return state.ply < 2;
}

/** The color of the piece that the player to move will place. */
export function placementColor(state: GameState): Color {
  return isOpening(state) ? opponent(state.toMove) : state.toMove;
}

export function carryLimit(state: GameState): number {
  return state.size;
}

/**
 * Returns null if the move is legal, otherwise a human-readable reason.
 */
export function validateMove(state: GameState, move: Move): string | null {
  if (state.result) return 'The game is over.';
  const { size } = state;

  if (move.kind === 'place') {
    if (!inBounds(size, move.to)) return 'Square is off the board.';
    if (stackAt(state, move.to).length > 0) return 'Square is occupied.';
    if (isOpening(state) && move.type !== 'flat') return 'The first move of each player must be a flat stone.';
    const owner = placementColor(state);
    const reserves = state.reserves[owner];
    if (move.type === 'cap') {
      if (reserves.caps <= 0) return 'No capstones left.';
    } else if (reserves.flats <= 0) {
      return 'No stones left.';
    }
    return null;
  }

  if (isOpening(state)) return 'The first move of each player must be a placement.';
  if (!inBounds(size, move.from)) return 'Square is off the board.';
  const from = stackAt(state, move.from);
  if (from.length === 0) return 'No stack to move.';
  const top = topOf(from)!;
  if (top.color !== state.toMove) return 'You do not control that stack.';
  if (!Number.isInteger(move.count) || move.count < 1) return 'Must carry at least one piece.';
  if (move.count > carryLimit(state)) return `Carry limit is ${carryLimit(state)}.`;
  if (move.count > from.length) return 'Not enough pieces in the stack.';
  if (move.drops.length === 0) return 'Must drop at least once.';
  if (move.drops.some((d) => !Number.isInteger(d) || d < 1)) return 'Each drop must be at least one piece.';
  const total = move.drops.reduce((a, b) => a + b, 0);
  if (total !== move.count) return 'Drops must add up to the carried count.';

  const delta = dirDelta(move.dir);
  let pos = { ...move.from };
  for (let i = 0; i < move.drops.length; i++) {
    pos = { c: pos.c + delta.c, r: pos.r + delta.r };
    if (!inBounds(size, pos)) return 'Move runs off the board.';
    const target = topOf(stackAt(state, pos));
    if (!target) continue;
    if (target.type === 'cap') return 'Cannot move onto a capstone.';
    if (target.type === 'wall') {
      const isLast = i === move.drops.length - 1;
      const flattens = isLast && move.drops[i] === 1 && top.type === 'cap';
      if (!flattens) return 'Only a lone capstone can flatten a wall.';
    }
  }
  return null;
}

export function isLegal(state: GameState, move: Move): boolean {
  return validateMove(state, move) === null;
}

function cloneState(state: GameState): GameState {
  return {
    ...state,
    board: state.board.map((s) => s.slice()),
    reserves: {
      white: { ...state.reserves.white },
      black: { ...state.reserves.black },
    },
    result: state.result ? { ...state.result } : null,
  };
}

/** Applies a move and returns the new state. Throws on illegal moves. */
export function applyMove(state: GameState, move: Move): GameState {
  const err = validateMove(state, move);
  if (err) throw new Error(err);
  const next = cloneState(state);
  const mover = state.toMove;

  if (move.kind === 'place') {
    const owner = placementColor(state);
    next.board[idx(next.size, move.to.c, move.to.r)].push({ color: owner, type: move.type });
    if (move.type === 'cap') next.reserves[owner].caps -= 1;
    else next.reserves[owner].flats -= 1;
  } else {
    const fromIdx = idx(next.size, move.from.c, move.from.r);
    const from = next.board[fromIdx];
    const carried = from.splice(from.length - move.count, move.count);
    const delta = dirDelta(move.dir);
    let pos = { ...move.from };
    let offset = 0;
    for (const drop of move.drops) {
      pos = { c: pos.c + delta.c, r: pos.r + delta.r };
      const target = next.board[idx(next.size, pos.c, pos.r)];
      const targetTop = topOf(target);
      if (targetTop && targetTop.type === 'wall') {
        target[target.length - 1] = { ...targetTop, type: 'flat' };
      }
      target.push(...carried.slice(offset, offset + drop));
      offset += drop;
    }
  }

  next.ply += 1;
  next.toMove = opponent(mover);
  next.result = evaluateEnd(next, mover);
  return next;
}

/** Whether `color` has a road (edge-to-edge connected line of flats and capstones). */
export function hasRoad(state: GameState, color: Color): boolean {
  const { size } = state;
  const counts = (coord: Coord) => {
    const top = topOf(stackAt(state, coord));
    return !!top && top.color === color && top.type !== 'wall';
  };
  const seen = new Uint8Array(size * size);
  const stack: Coord[] = [];
  // Seed from the west edge (for W-E) and south edge (for S-N); track which edges we reach.
  for (let i = 0; i < size; i++) {
    const west = { c: 0, r: i };
    const south = { c: i, r: 0 };
    if (counts(west) && !seen[idx(size, 0, i)]) {
      if (flood(west, (p) => p.c === size - 1)) return true;
    }
    if (counts(south) && !seen[idx(size, i, 0)]) {
      if (flood(south, (p) => p.r === size - 1)) return true;
    }
  }
  return false;

  function flood(start: Coord, isGoal: (p: Coord) => boolean): boolean {
    // Each flood uses its own visited set so W-E and S-N searches do not interfere.
    const visited = new Uint8Array(size * size);
    stack.length = 0;
    stack.push(start);
    visited[idx(size, start.c, start.r)] = 1;
    while (stack.length) {
      const p = stack.pop()!;
      if (isGoal(p)) return true;
      for (const d of DIRECTIONS) {
        const dd = dirDelta(d);
        const n = { c: p.c + dd.c, r: p.r + dd.r };
        if (!inBounds(size, n)) continue;
        const ni = idx(size, n.c, n.r);
        if (visited[ni] || !counts(n)) continue;
        visited[ni] = 1;
        stack.push(n);
      }
    }
    return false;
  }
}

/**
 * The squares of a winning road for `color`, as a shortest edge-to-edge path
 * (breadth-first), or null when there is no road. Used to highlight the win.
 */
export function findRoad(state: GameState, color: Color): Coord[] | null {
  const { size } = state;
  const counts = (coord: Coord) => {
    const top = topOf(stackAt(state, coord));
    return !!top && top.color === color && top.type !== 'wall';
  };
  const search = (starts: Coord[], isGoal: (p: Coord) => boolean): Coord[] | null => {
    const parent = new Int32Array(size * size).fill(-2); // -2 unvisited, -1 start
    const queue: Coord[] = [];
    for (const s of starts) {
      if (!counts(s)) continue;
      parent[idx(size, s.c, s.r)] = -1;
      queue.push(s);
    }
    let head = 0;
    while (head < queue.length) {
      const p = queue[head++];
      if (isGoal(p)) {
        const path: Coord[] = [];
        let i = idx(size, p.c, p.r);
        while (i >= 0) {
          path.push({ c: i % size, r: Math.floor(i / size) });
          i = parent[i];
        }
        return path.reverse();
      }
      for (const d of DIRECTIONS) {
        const dd = dirDelta(d);
        const n = { c: p.c + dd.c, r: p.r + dd.r };
        if (!inBounds(size, n)) continue;
        const ni = idx(size, n.c, n.r);
        if (parent[ni] !== -2 || !counts(n)) continue;
        parent[ni] = idx(size, p.c, p.r);
        queue.push(n);
      }
    }
    return null;
  };
  const west: Coord[] = [];
  const south: Coord[] = [];
  for (let i = 0; i < size; i++) {
    west.push({ c: 0, r: i });
    south.push({ c: i, r: 0 });
  }
  return search(west, (p) => p.c === size - 1) ?? search(south, (p) => p.r === size - 1);
}

export function countFlats(state: GameState): Record<Color, number> {
  const out = { white: 0, black: 0 };
  for (const s of state.board) {
    const top = topOf(s);
    if (top && top.type === 'flat') out[top.color] += 1;
  }
  return out;
}

export function isBoardFull(state: GameState): boolean {
  return state.board.every((s) => s.length > 0);
}

export function reservesEmpty(state: GameState, color: Color): boolean {
  const r = state.reserves[color];
  return r.flats + r.caps === 0;
}

/**
 * Determine whether the game ended after `mover` played.
 * Road wins take precedence; if both players have roads, the mover wins.
 */
export function evaluateEnd(state: GameState, mover: Color): GameResult | null {
  if (hasRoad(state, mover)) return { winner: mover, type: 'road' };
  if (hasRoad(state, opponent(mover))) return { winner: opponent(mover), type: 'road' };
  if (isBoardFull(state) || reservesEmpty(state, 'white') || reservesEmpty(state, 'black')) {
    const flats = countFlats(state);
    if (flats.white > flats.black) return { winner: 'white', type: 'flat' };
    if (flats.black > flats.white) return { winner: 'black', type: 'flat' };
    return { winner: null, type: 'draw' };
  }
  return null;
}

/** Enumerate all legal moves for the side to move. */
export function legalMoves(state: GameState): Move[] {
  const moves: Move[] = [];
  if (state.result) return moves;
  const { size } = state;
  const owner = placementColor(state);
  const reserves = state.reserves[owner];
  const types: Move extends infer _ ? ('flat' | 'wall' | 'cap')[] : never = isOpening(state)
    ? ['flat']
    : ['flat', 'wall', 'cap'];

  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      const coord = { c, r };
      const stack = stackAt(state, coord);
      if (stack.length === 0) {
        for (const type of types) {
          if (type === 'cap' ? reserves.caps > 0 : reserves.flats > 0) {
            moves.push({ kind: 'place', to: coord, type });
          }
        }
        continue;
      }
      if (isOpening(state)) continue;
      const top = topOf(stack)!;
      if (top.color !== state.toMove) continue;
      const maxCount = Math.min(carryLimit(state), stack.length);
      for (let count = 1; count <= maxCount; count++) {
        for (const dir of DIRECTIONS) {
          for (const drops of compositions(count)) {
            const move: Move = { kind: 'move', from: coord, dir, count, drops };
            if (isLegal(state, move)) moves.push(move);
          }
        }
      }
    }
  }
  return moves;
}

/** All ordered ways to split n into positive parts. */
export function compositions(n: number): number[][] {
  if (n === 0) return [[]];
  const out: number[][] = [];
  for (let first = 1; first <= n; first++) {
    for (const rest of compositions(n - first)) out.push([first, ...rest]);
  }
  return out;
}
