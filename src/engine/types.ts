export type Color = 'white' | 'black';
export type PieceType = 'flat' | 'wall' | 'cap';
export type BoardSize = 3 | 4 | 5 | 6 | 7 | 8;
export type Direction = '+' | '-' | '<' | '>';

export interface Piece {
  color: Color;
  type: PieceType;
}

/** A square's stack, index 0 is the bottom, last element is the top. */
export type Stack = Piece[];

/** 0-based board coordinate. c = column (a = 0), r = row (1 = 0). */
export interface Coord {
  c: number;
  r: number;
}

export interface Reserves {
  flats: number;
  caps: number;
}

export type Move =
  | { kind: 'place'; to: Coord; type: PieceType }
  | { kind: 'move'; from: Coord; dir: Direction; count: number; drops: number[] };

export type ResultType = 'road' | 'flat' | 'resign' | 'timeout' | 'draw';

export interface GameResult {
  /** null means a draw. */
  winner: Color | null;
  type: ResultType;
}

export interface GameState {
  size: BoardSize;
  /** Row-major: board[r * size + c]. */
  board: Stack[];
  toMove: Color;
  /** Number of half-moves played so far. */
  ply: number;
  reserves: Record<Color, Reserves>;
  result: GameResult | null;
}

export const BOARD_SIZES: BoardSize[] = [3, 4, 5, 6, 7, 8];

/** Piece counts per player from the official rules. */
export const PIECE_COUNTS: Record<BoardSize, Reserves> = {
  3: { flats: 10, caps: 0 },
  4: { flats: 15, caps: 0 },
  5: { flats: 21, caps: 1 },
  6: { flats: 30, caps: 1 },
  7: { flats: 40, caps: 2 },
  8: { flats: 50, caps: 2 },
};

export const DIRECTIONS: Direction[] = ['+', '-', '<', '>'];
