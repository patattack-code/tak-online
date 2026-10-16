/**
 * Isometric (2.5D) geometry for the Tak board.
 *
 * Pure functions: no DOM, no React. Both the React <Board> and the
 * asset-export script build on these. Board space uses (u, v) in tile units,
 * where u runs along files (a -> h) and v runs from the back of the board to
 * the front (rank 8 at v = 0 for an 8x8 board, rank 1 at v = size - 1).
 */
import type { BoardSize, Color, Coord, GameState, Piece, Stack } from '../engine/types';

export const TILE_W = 72;
export const TILE_H = 36;
export const FLAT_T = 7;
export const WALL_H = 30;
export const CAP_H = 32;
export const FRAME_H = 12;
export const FRAME_MARGIN = 0.22;
/** Vertical room above the back row for tall stacks. */
export const TOP_MARGIN = 110;
export const SIDE_MARGIN = 28;
export const BOTTOM_MARGIN = 44;

export interface Pt {
  x: number;
  y: number;
}

export type Shape =
  | { kind: 'polygon'; points: Pt[]; fill: string; stroke?: string; strokeWidth?: number; opacity?: number }
  | { kind: 'ellipse'; cx: number; cy: number; rx: number; ry: number; fill: string; stroke?: string; strokeWidth?: number; opacity?: number }
  | { kind: 'path'; d: string; fill: string; stroke?: string; strokeWidth?: number; opacity?: number }
  | { kind: 'text'; x: number; y: number; text: string; fill: string; size: number; anchor?: 'start' | 'middle' | 'end'; weight?: number };

export interface Palette {
  top: string;
  side: string;
  stroke: string;
}

export const PALETTES: Record<Color, Palette> = {
  white: { top: '#f1e6cb', side: '#d6c49c', stroke: '#8f7c52' },
  black: { top: '#5a4030', side: '#3d2a1c', stroke: '#1b110a' },
};

export const BOARD_COLORS = {
  light: '#d2a86d',
  dark: '#b98c54',
  edge: '#7a5332',
  frameTop: '#8d6239',
  frameSide: '#5e3f25',
  label: '#f3e4c4',
  grid: 'rgba(60, 35, 15, 0.35)',
};

export function project(u: number, v: number, h = 0): Pt {
  return { x: ((u - v) * TILE_W) / 2, y: ((u + v) * TILE_H) / 2 - h };
}

/** Convert a board coordinate to (u, v) tile-space of the square's back-left corner. */
export function squareToUV(coord: Coord, size: number): { u: number; v: number } {
  return { u: coord.c, v: size - 1 - coord.r };
}

export function depthOf(coord: Coord, size: number): number {
  const { u, v } = squareToUV(coord, size);
  return u + v;
}

function clamp(n: number): number {
  return Math.max(0, Math.min(255, Math.round(n)));
}

/** Multiply a hex color's channels by `factor`. */
export function shade(hex: string, factor: number): string {
  const n = parseInt(hex.slice(1), 16);
  const r = clamp(((n >> 16) & 255) * factor);
  const g = clamp(((n >> 8) & 255) * factor);
  const b = clamp((n & 255) * factor);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

/**
 * Shapes for a vertical prism with a convex, counter-clockwise footprint
 * (in u/v space). Side faces are drawn only when they face the viewer.
 */
export function prismShapes(
  footprint: [number, number][],
  baseH: number,
  height: number,
  palette: Palette,
  opacity?: number,
): Shape[] {
  const out: Shape[] = [];
  const n = footprint.length;
  const lightDir = { u: 0.25, v: 1 };
  const lightLen = Math.hypot(lightDir.u, lightDir.v);
  for (let i = 0; i < n; i++) {
    const [u1, v1] = footprint[i];
    const [u2, v2] = footprint[(i + 1) % n];
    const eu = u2 - u1;
    const ev = v2 - v1;
    // Outward normal for a CCW polygon in (u, v).
    const nu = ev;
    const nv = -eu;
    if (nu + nv <= 0.0001) continue; // faces away from the viewer
    const len = Math.hypot(nu, nv) || 1;
    const lambert = (nu * lightDir.u + nv * lightDir.v) / (len * lightLen);
    const factor = 0.72 + 0.28 * lambert;
    out.push({
      kind: 'polygon',
      points: [project(u1, v1, baseH + height), project(u2, v2, baseH + height), project(u2, v2, baseH), project(u1, v1, baseH)],
      fill: shade(palette.side, factor),
      stroke: palette.stroke,
      strokeWidth: 0.8,
      opacity,
    });
  }
  out.push({
    kind: 'polygon',
    points: footprint.map(([u, v]) => project(u, v, baseH + height)),
    fill: palette.top,
    stroke: palette.stroke,
    strokeWidth: 0.8,
    opacity,
  });
  return out;
}

/** Axis-aligned rectangle footprint centred on (cu, cv). CCW order. */
export function rectFootprint(cu: number, cv: number, lenU: number, lenV: number): [number, number][] {
  const a = lenU / 2;
  const b = lenV / 2;
  return [
    [cu - a, cv - b],
    [cu - a, cv + b],
    [cu + a, cv + b],
    [cu + a, cv - b],
  ];
}

/** A cylinder (capstone) centred on (cu, cv). */
export function cylinderShapes(cu: number, cv: number, radius: number, baseH: number, height: number, palette: Palette, opacity?: number): Shape[] {
  const rx = (radius * TILE_W) / Math.SQRT2;
  const ry = (radius * TILE_H) / Math.SQRT2;
  const bottom = project(cu, cv, baseH);
  const top = project(cu, cv, baseH + height);
  const body = [
    `M ${bottom.x - rx} ${bottom.y}`,
    `A ${rx} ${ry} 0 0 0 ${bottom.x + rx} ${bottom.y}`,
    `L ${top.x + rx} ${top.y}`,
    `A ${rx} ${ry} 0 0 1 ${top.x - rx} ${top.y}`,
    'Z',
  ].join(' ');
  // A highlight band suggests a rounded body.
  const bandL = bottom.x - rx * 0.55;
  const bandR = bottom.x - rx * 0.2;
  const highlight = [
    `M ${bandL} ${bottom.y + ry * 0.75}`,
    `L ${bandR} ${bottom.y + ry * 0.97}`,
    `L ${bandR} ${top.y + ry * 0.97}`,
    `L ${bandL} ${top.y + ry * 0.75}`,
    'Z',
  ].join(' ');
  return [
    { kind: 'path', d: body, fill: shade(palette.side, 0.92), stroke: palette.stroke, strokeWidth: 0.8, opacity },
    { kind: 'path', d: highlight, fill: shade(palette.side, 1.12), opacity: opacity === undefined ? 0.55 : opacity * 0.55 },
    { kind: 'ellipse', cx: top.x, cy: top.y, rx, ry, fill: palette.top, stroke: palette.stroke, strokeWidth: 0.8, opacity },
    { kind: 'ellipse', cx: top.x, cy: top.y - 1.5, rx: rx * 0.45, ry: ry * 0.45, fill: shade(palette.top, 0.9), opacity },
  ];
}

export function pieceHeight(piece: Piece): number {
  return piece.type === 'flat' ? FLAT_T : piece.type === 'wall' ? WALL_H : CAP_H;
}

/** Shapes for one piece whose centre is at (cu, cv), resting at height baseH. */
export function pieceShapes(piece: Piece, cu: number, cv: number, baseH: number, opacity?: number): Shape[] {
  const palette = PALETTES[piece.color];
  switch (piece.type) {
    case 'flat':
      return prismShapes(rectFootprint(cu, cv, 0.74, 0.74), baseH, FLAT_T, palette, opacity);
    case 'wall':
      return prismShapes(rectFootprint(cu, cv, 0.74, 0.22), baseH, WALL_H, palette, opacity);
    case 'cap':
      return cylinderShapes(cu, cv, 0.3, baseH, CAP_H, palette, opacity);
  }
}

/** Height of the top of a stack (all pieces below the top are flats). */
export function stackTopHeight(stack: Stack): number {
  if (stack.length === 0) return 0;
  return (stack.length - 1) * FLAT_T + pieceHeight(stack[stack.length - 1]);
}

export function stackShapes(stack: Stack, coord: Coord, size: number, opacity?: number, lift = 0): Shape[] {
  const { u, v } = squareToUV(coord, size);
  const out: Shape[] = [];
  let h = lift;
  stack.forEach((piece) => {
    out.push(...pieceShapes(piece, u + 0.5, v + 0.5, h, opacity));
    h += FLAT_T;
  });
  return out;
}

export function tileShapes(coord: Coord, size: number): Shape[] {
  const { u, v } = squareToUV(coord, size);
  const light = (coord.c + coord.r) % 2 === 0;
  return [
    {
      kind: 'polygon',
      points: [project(u, v), project(u + 1, v), project(u + 1, v + 1), project(u, v + 1)],
      fill: light ? BOARD_COLORS.light : BOARD_COLORS.dark,
      stroke: BOARD_COLORS.grid,
      strokeWidth: 0.6,
    },
  ];
}

export function frameShapes(size: number): Shape[] {
  const m = FRAME_MARGIN;
  const fp: [number, number][] = [
    [-m, -m],
    [-m, size + m],
    [size + m, size + m],
    [size + m, -m],
  ];
  return prismShapes(fp, -FRAME_H, FRAME_H, { top: BOARD_COLORS.frameTop, side: BOARD_COLORS.frameSide, stroke: BOARD_COLORS.edge });
}

export function labelShapes(size: number): Shape[] {
  const out: Shape[] = [];
  const files = 'abcdefgh';
  for (let i = 0; i < size; i++) {
    const f = project(i + 0.5, size + 0.42, -FRAME_H * 0.1);
    out.push({ kind: 'text', x: f.x, y: f.y + 4, text: files[i], fill: BOARD_COLORS.label, size: 11, anchor: 'middle', weight: 600 });
    const r = project(size + 0.42, size - 1 - i + 0.5, -FRAME_H * 0.1);
    out.push({ kind: 'text', x: r.x, y: r.y + 4, text: String(i + 1), fill: BOARD_COLORS.label, size: 11, anchor: 'middle', weight: 600 });
  }
  return out;
}

export interface ViewBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

export function viewBoxFor(size: number): ViewBox {
  const left = project(0, size).x - SIDE_MARGIN;
  const right = project(size, 0).x + SIDE_MARGIN;
  const top = project(0, 0).y - TOP_MARGIN;
  const bottom = project(size, size).y + FRAME_H + BOTTOM_MARGIN;
  return { x: left, y: top, w: right - left, h: bottom - top };
}

export function allSquares(size: number): Coord[] {
  const out: Coord[] = [];
  for (let r = 0; r < size; r++) for (let c = 0; c < size; c++) out.push({ c, r });
  return out;
}

/** Squares sorted back-to-front for painter's-algorithm drawing. */
export function squaresInDrawOrder(size: number): Coord[] {
  return allSquares(size).sort((a, b) => depthOf(a, size) - depthOf(b, size));
}

// ---------- String rendering (used by the asset exporter) ----------

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function num(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(2);
}

export function shapeToSvg(shape: Shape): string {
  const common = (s: { stroke?: string; strokeWidth?: number; opacity?: number }) =>
    `${s.stroke ? ` stroke="${s.stroke}" stroke-width="${s.strokeWidth ?? 1}" stroke-linejoin="round"` : ''}${
      s.opacity !== undefined ? ` opacity="${s.opacity}"` : ''
    }`;
  switch (shape.kind) {
    case 'polygon':
      return `<polygon points="${shape.points.map((p) => `${num(p.x)},${num(p.y)}`).join(' ')}" fill="${shape.fill}"${common(shape)}/>`;
    case 'ellipse':
      return `<ellipse cx="${num(shape.cx)}" cy="${num(shape.cy)}" rx="${num(shape.rx)}" ry="${num(shape.ry)}" fill="${shape.fill}"${common(shape)}/>`;
    case 'path':
      return `<path d="${shape.d}" fill="${shape.fill}"${common(shape)}/>`;
    case 'text':
      return `<text x="${num(shape.x)}" y="${num(shape.y)}" fill="${shape.fill}" font-size="${shape.size}" font-family="Inter, system-ui, sans-serif" font-weight="${shape.weight ?? 500}" text-anchor="${shape.anchor ?? 'start'}">${esc(shape.text)}</text>`;
  }
}

export function svgDocument(viewBox: ViewBox, body: string, title?: string): string {
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${num(viewBox.x)} ${num(viewBox.y)} ${num(viewBox.w)} ${num(viewBox.h)}" width="${num(viewBox.w)}" height="${num(viewBox.h)}">`,
    title ? `<title>${esc(title)}</title>` : '',
    body,
    '</svg>',
  ].join('\n');
}

/** Standalone SVG of a single piece, for icons and documentation. */
export function pieceSvg(piece: Piece): string {
  const shapes = pieceShapes(piece, 0.5, 0.5, 0);
  // Crop to the piece itself so icons fill their box regardless of piece height.
  const top = project(0.5, 0.5).y - TILE_H * 0.4 - pieceHeight(piece) - 3;
  const bottom = project(0.5, 0.5).y + TILE_H * 0.4 + 3;
  const halfW = TILE_W * 0.42;
  const vb: ViewBox = { x: -halfW, y: top, w: halfW * 2, h: bottom - top };
  return svgDocument(vb, shapes.map(shapeToSvg).join('\n'), `${piece.color} ${piece.type}`);
}

/** Standalone SVG of a whole position. */
export function boardSvg(state: GameState, title?: string): string {
  const { size } = state;
  const parts: string[] = [];
  parts.push(...frameShapes(size).map(shapeToSvg));
  parts.push(...labelShapes(size).map(shapeToSvg));
  for (const coord of squaresInDrawOrder(size)) {
    parts.push(...tileShapes(coord, size).map(shapeToSvg));
    const stack = state.board[coord.r * size + coord.c];
    parts.push(...stackShapes(stack, coord, size).map(shapeToSvg));
  }
  return svgDocument(viewBoxFor(size), parts.join('\n'), title ?? `${size}x${size} Tak board`);
}

/** The app logo: a short stack with a capstone, rendered as a standalone SVG. */
export function logoSvg(size = 64): string {
  const stack: Stack = [
    { color: 'black', type: 'flat' },
    { color: 'white', type: 'flat' },
    { color: 'black', type: 'flat' },
    { color: 'white', type: 'cap' },
  ];
  const shapes: Shape[] = [];
  let h = 0;
  for (const p of stack) {
    shapes.push(...pieceShapes(p, 0.5, 0.5, h));
    h += FLAT_T;
  }
  const vb: ViewBox = { x: -TILE_W / 2 - 6, y: -(FLAT_T * 3 + CAP_H) - 8, w: TILE_W + 12, h: TILE_H + FLAT_T * 3 + CAP_H + 16 };
  const scale = size / Math.max(vb.w, vb.h);
  const doc = svgDocument(vb, shapes.map(shapeToSvg).join('\n'), 'Tak Online');
  return doc.replace(/width="[^"]+" height="[^"]+"/, `width="${num(vb.w * scale)}" height="${num(vb.h * scale)}"`);
}

export const SIZE_LABELS: Record<BoardSize, string> = {
  3: '3×3', 4: '4×4', 5: '5×5', 6: '6×6', 7: '7×7', 8: '8×8',
};
