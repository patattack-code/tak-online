import { describe, expect, it } from 'vitest';
import { applyMove, countFlats, hasRoad, legalMoves, newGame, stackAt, validateMove } from './rules';
import { moveToPtn, ptnToMove, replay } from './ptn';
import { computeElo } from './elo';
import type { GameState } from './types';

function play(state: GameState, ...ptn: string[]): GameState {
  for (const m of ptn) state = applyMove(state, ptnToMove(m));
  return state;
}

describe('opening', () => {
  it('places an opponent stone on each of the first two plies', () => {
    let s = newGame(5);
    s = play(s, 'a1');
    expect(stackAt(s, { c: 0, r: 0 })[0]).toEqual({ color: 'black', type: 'flat' });
    expect(s.reserves.black.flats).toBe(20);
    s = play(s, 'e5');
    expect(stackAt(s, { c: 4, r: 4 })[0]).toEqual({ color: 'white', type: 'flat' });
    expect(s.reserves.white.flats).toBe(20);
    expect(s.toMove).toBe('white');
  });

  it('rejects walls, capstones and movements in the opening', () => {
    const s = newGame(5);
    expect(validateMove(s, ptnToMove('Sa1'))).not.toBeNull();
    expect(validateMove(s, ptnToMove('Ca1'))).not.toBeNull();
    const s2 = play(s, 'a1');
    expect(validateMove(s2, ptnToMove('a1>'))).not.toBeNull();
  });
});

describe('movement', () => {
  it('moves a stack and distributes drops', () => {
    let s = newGame(5);
    s = play(s, 'a5', 'e1'); // opening: black on a5, white on e1
    s = play(s, 'c3', 'c4'); // white c3, black c4
    s = play(s, 'c3+'); // white flat moves onto black flat on c4
    const stack = stackAt(s, { c: 2, r: 3 });
    expect(stack).toHaveLength(2);
    expect(stack[1]).toEqual({ color: 'white', type: 'flat' });
    expect(stackAt(s, { c: 2, r: 2 })).toHaveLength(0);
  });

  it('enforces the carry limit', () => {
    const s = newGame(3);
    s.ply = 2;
    const b1 = stackAt(s, { c: 1, r: 0 });
    b1.push(
      { color: 'black', type: 'flat' },
      { color: 'black', type: 'flat' },
      { color: 'white', type: 'flat' },
      { color: 'white', type: 'flat' },
    );
    expect(validateMove(s, ptnToMove('4b1+'))).toMatch(/Carry limit/);
    expect(validateMove(s, ptnToMove('3b1+'))).toBeNull();
    expect(validateMove(s, ptnToMove('3b1+111'))).toMatch(/off the board/);
  });

  it('blocks movement onto walls and capstones, except capstone flattening', () => {
    let s = newGame(5);
    s = play(s, 'a5', 'e1', 'c3', 'Sc4');
    expect(validateMove(s, ptnToMove('c3+'))).toMatch(/flatten/);
    s = play(s, 'Cd3', 'a1');
    s = play(s, 'd3<'); // cap moves west onto c3 (white flat): fine
    expect(stackAt(s, { c: 2, r: 2 }).map((p) => p.type)).toEqual(['flat', 'cap']);
    s = play(s, 'a2');
    // Carrying 2 (flat under cap) onto the wall with last drop of 1 should flatten.
    expect(validateMove(s, ptnToMove('2c3+2'))).toMatch(/flatten/);
    expect(validateMove(s, ptnToMove('c3+'))).toBeNull();
    s = play(s, 'c3+');
    const c4 = stackAt(s, { c: 2, r: 3 });
    expect(c4.map((p) => p.type)).toEqual(['flat', 'cap']);
    expect(c4[0].color).toBe('black');
  });
});

describe('win conditions', () => {
  it('detects a horizontal road', () => {
    let s = newGame(3);
    s = play(s, 'a3', 'c1'); // black a3, white c1
    s = play(s, 'a1', 'b3', 'b1'); // white a1, black b3, white b1 -> a1 b1 c1 road
    expect(hasRoad(s, 'white')).toBe(true);
    expect(s.result).toEqual({ winner: 'white', type: 'road' });
  });

  it('detects a vertical road with capstones counting', () => {
    let s = newGame(5);
    s = play(s, 'e5', 'a5'); // black e5, white a5
    s = play(s, 'a1', 'e1', 'a2', 'e2', 'a3', 'e3');
    expect(s.result).toBeNull();
    s = play(s, 'Ca4'); // a1..a3 flats + a4 capstone + a5 flat
    expect(s.result).toEqual({ winner: 'white', type: 'road' });
  });

  it('walls do not count toward roads', () => {
    let s = newGame(3);
    s = play(s, 'a3', 'c3');
    s = play(s, 'a1', 'b3', 'Sb1', 'b2', 'c1');
    expect(hasRoad(s, 'white')).toBe(false);
    expect(s.result).toBeNull();
  });

  it('awards the mover when both players complete roads', () => {
    // White: a1, c1, d1 on row 1. Black: a2, c2, d2 on row 2.
    // A white-topped stack [black, white] on b3 moves south dropping the black
    // flat on b2 and the white flat on b1, completing both roads at once.
    let s = newGame(4);
    s = play(s, 'a2', 'a1'); // black a2, white a1
    s = play(s, 'c1', 'c2', 'd1', 'd2', 'c3', 'b3', 'c3<', 'd4');
    expect(s.result).toBeNull();
    s = play(s, '2b3-11');
    expect(hasRoad(s, 'white')).toBe(true);
    expect(hasRoad(s, 'black')).toBe(true);
    expect(s.result).toEqual({ winner: 'white', type: 'road' });
  });

  it('ends with a flat count when the board is full', () => {
    let s = newGame(3);
    s = play(s, 'b3', 'a1'); // black b3, white a1
    s = play(s, 'c3', 'a2', 'b2', 'c2', 'a3', 'b1'); // checkerboard, no roads
    expect(s.result).toBeNull();
    s = play(s, 'Sc1'); // last square, a wall that counts for nobody
    const flats = countFlats(s);
    expect(flats.white).toBe(4);
    expect(flats.black).toBe(4);
    expect(s.result).toEqual({ winner: null, type: 'draw' });
  });

  it('ends with a flat count when a player runs out of pieces', () => {
    const s0 = newGame(3);
    s0.reserves.white.flats = 2;
    let s = play(s0, 'a1', 'c3'); // black a1, white c3 (white has 1 left)
    expect(s.result).toBeNull();
    s = play(s, 'b2'); // white's last stone
    expect(s.reserves.white.flats).toBe(0);
    expect(s.result).toEqual({ winner: 'white', type: 'flat' });
  });
});

describe('legal move generation', () => {
  it('generates only flat placements on empty squares in the opening', () => {
    const s = newGame(4);
    const moves = legalMoves(s);
    expect(moves).toHaveLength(16);
    expect(moves.every((m) => m.kind === 'place' && m.type === 'flat')).toBe(true);
  });

  it('generates stack moves with every drop composition', () => {
    let s = newGame(5);
    s = play(s, 'a5', 'e1', 'c3', 'c4', 'c3+', 'a1');
    // White has a 2-stack on c4 at the top; moves from c4 include carries of 1 and 2.
    const moves = legalMoves(s).filter((m) => m.kind === 'move' && m.from.c === 2 && m.from.r === 3);
    const ptn = moves.map(moveToPtn);
    expect(ptn).toContain('c4+');
    expect(ptn).toContain('2c4+');
    expect(ptn).toContain('2c4-11');
    expect(ptn).toContain('2c4>11');
    expect(ptn).not.toContain('2c4+11'); // would run off the board
  });
});

describe('PTN round trip', () => {
  it('serializes and parses moves', () => {
    const samples = ['a1', 'Sb2', 'Cc3', 'a1>', '3c3<12', '5e5-1211', '2d4+'];
    for (const sample of samples) {
      expect(moveToPtn(ptnToMove(sample))).toBe(sample);
    }
  });

  it('replays a game', () => {
    const s = replay(5, ['a5', 'e1', 'c3', 'c4', 'c3+']);
    expect(s.ply).toBe(5);
    expect(stackAt(s, { c: 2, r: 3 })).toHaveLength(2);
  });
});

describe('elo', () => {
  it('moves ratings symmetrically for equal players', () => {
    const r = computeElo({ rating: 1500, games: 0 }, { rating: 1500, games: 0 }, 1);
    expect(r.deltaA).toBe(20);
    expect(r.deltaB).toBe(-20);
  });

  it('rewards upsets more than expected wins', () => {
    const upset = computeElo({ rating: 1400, games: 50 }, { rating: 1800, games: 50 }, 1);
    const expected = computeElo({ rating: 1800, games: 50 }, { rating: 1400, games: 50 }, 1);
    expect(upset.deltaA).toBeGreaterThan(expected.deltaA);
  });
});
