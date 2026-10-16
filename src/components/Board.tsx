import { useMemo } from 'react';
import type { Coord, Direction, GameState, Piece, Stack } from '../engine/types';
import { dirDelta, idx, sameCoord } from '../engine/rules';
import {
  FLAT_T,
  frameShapes,
  labelShapes,
  pieceShapes,
  project,
  squaresInDrawOrder,
  squareToUV,
  stackShapes,
  stackTopHeight,
  tileShapes,
  viewBoxFor,
  type Shape,
} from '../render/iso';
import { Shapes } from './Shapes';

export interface PendingMove {
  from: Coord;
  count: number;
  dir: Direction | null;
  drops: number[];
}

export type HighlightKind = 'selected' | 'target' | 'last' | 'path';

export interface Highlight {
  coord: Coord;
  kind: HighlightKind;
}

export interface BoardProps {
  state: GameState;
  pending?: PendingMove | null;
  /** Piece drawn translucently on an empty square to preview a placement. */
  placePreview?: { coord: Coord; piece: Piece } | null;
  highlights?: Highlight[];
  onSquareClick?: (coord: Coord) => void;
  interactive?: boolean;
  /** Optional extra CSS class on the svg. */
  className?: string;
}

const HIGHLIGHT_FILL: Record<HighlightKind, string> = {
  selected: 'rgba(255, 196, 64, 0.55)',
  target: 'rgba(96, 200, 120, 0.5)',
  last: 'rgba(90, 150, 255, 0.35)',
  path: 'rgba(255, 196, 64, 0.3)',
};

function highlightShape(coord: Coord, size: number, kind: HighlightKind): Shape {
  const { u, v } = squareToUV(coord, size);
  const inset = kind === 'target' ? 0.12 : 0.03;
  return {
    kind: 'polygon',
    points: [
      project(u + inset, v + inset, 0.5),
      project(u + 1 - inset, v + inset, 0.5),
      project(u + 1 - inset, v + 1 - inset, 0.5),
      project(u + inset, v + 1 - inset, 0.5),
    ],
    fill: HIGHLIGHT_FILL[kind],
    stroke: kind === 'target' ? 'rgba(40, 140, 70, 0.9)' : undefined,
    strokeWidth: 1.5,
  };
}

interface SquareRender {
  coord: Coord;
  stack: Stack;
  ghosts: { piece: Piece; lift: number }[];
  floating: Stack | null;
}

/**
 * Compute what each square should show, taking the pending move into account:
 * carried pieces leave the source square, dropped pieces appear as ghosts, and
 * the still-carried remainder floats above the last square of the path.
 */
function computeSquares(state: GameState, pending: PendingMove | null | undefined): Map<number, SquareRender> {
  const { size } = state;
  const map = new Map<number, SquareRender>();
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      const i = idx(size, c, r);
      map.set(i, { coord: { c, r }, stack: state.board[i], ghosts: [], floating: null });
    }
  }
  if (!pending) return map;

  const fromIdx = idx(size, pending.from.c, pending.from.r);
  const fromStack = state.board[fromIdx];
  const carried = fromStack.slice(fromStack.length - pending.count);
  map.get(fromIdx)!.stack = fromStack.slice(0, fromStack.length - pending.count);

  let pos = { ...pending.from };
  let offset = 0;
  if (pending.dir) {
    const d = dirDelta(pending.dir);
    for (const drop of pending.drops) {
      pos = { c: pos.c + d.c, r: pos.r + d.r };
      const sq = map.get(idx(size, pos.c, pos.r))!;
      const base = stackTopHeight(sq.stack);
      for (let k = 0; k < drop; k++) {
        sq.ghosts.push({ piece: carried[offset + k], lift: base + k * FLAT_T });
      }
      offset += drop;
    }
  }
  const remainder = carried.slice(offset);
  if (remainder.length) {
    map.get(idx(size, pos.c, pos.r))!.floating = remainder;
  }
  return map;
}

export function Board({ state, pending, placePreview, highlights = [], onSquareClick, interactive = false, className }: BoardProps) {
  const { size } = state;
  const vb = useMemo(() => viewBoxFor(size), [size]);
  const frame = useMemo(() => [...frameShapes(size), ...labelShapes(size)], [size]);
  const order = useMemo(() => squaresInDrawOrder(size), [size]);
  const squares = useMemo(() => computeSquares(state, pending), [state, pending]);

  return (
    <svg
      viewBox={`${vb.x} ${vb.y} ${vb.w} ${vb.h}`}
      className={`board${interactive ? ' board--interactive' : ''}${className ? ` ${className}` : ''}`}
      role="img"
      aria-label={`${size} by ${size} Tak board`}
      style={{ overflow: 'visible' }}
    >
      <Shapes shapes={frame} />
      {order.map((coord) => {
        const sq = squares.get(idx(size, coord.c, coord.r))!;
        const shapes: Shape[] = [...tileShapes(coord, size)];
        for (const h of highlights) {
          if (sameCoord(h.coord, coord)) shapes.push(highlightShape(coord, size, h.kind));
        }
        shapes.push(...stackShapes(sq.stack, coord, size));
        const { u, v } = squareToUV(coord, size);
        for (const g of sq.ghosts) shapes.push(...pieceShapes(g.piece, u + 0.5, v + 0.5, g.lift, 0.65));
        if (sq.floating) {
          const base = stackTopHeight(sq.stack) + sq.ghosts.length * FLAT_T + 22;
          shapes.push(...stackShapes(sq.floating, coord, size, 0.9, base));
        }
        if (placePreview && sameCoord(placePreview.coord, coord) && sq.stack.length === 0) {
          shapes.push(...pieceShapes(placePreview.piece, u + 0.5, v + 0.5, 0, 0.5));
        }
        return (
          <g
            key={`${coord.c},${coord.r}`}
            className="square"
            onClick={interactive && onSquareClick ? () => onSquareClick(coord) : undefined}
            style={interactive ? { cursor: 'pointer' } : undefined}
          >
            <Shapes shapes={shapes} />
          </g>
        );
      })}
    </svg>
  );
}
