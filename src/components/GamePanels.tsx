import type { Color, GameResult, GameState, PieceType } from '../engine/types';
import { carryLimit, isOpening, stackAt } from '../engine/rules';
import { describeMove, ptnToMove } from '../engine/ptn';
import type { MoveBuilder } from '../hooks/useMoveBuilder';

export function PieceIcon({ color, type, size = 28 }: { color: Color; type: PieceType; size?: number }) {
  return <img src={`/assets/piece-${color}-${type}.svg`} alt={`${color} ${type}`} width={size} height={size} className="piece-icon" />;
}

export function ReserveRow({ color, state, name, active }: { color: Color; state: GameState; name: string; active: boolean }) {
  const r = state.reserves[color];
  return (
    <div className={`reserve ${active ? 'reserve--active' : ''}`}>
      <div className="reserve__name">
        <span className={`swatch swatch--${color}`} />
        <span>{name}</span>
        {active && <span className="badge">to move</span>}
      </div>
      <div className="reserve__counts">
        <span title="Stones">
          <PieceIcon color={color} type="flat" size={22} /> {r.flats}
        </span>
        {state.size >= 5 && (
          <span title="Capstones">
            <PieceIcon color={color} type="cap" size={22} /> {r.caps}
          </span>
        )}
      </div>
    </div>
  );
}

export function MoveControls({ builder, state, myColor }: { builder: MoveBuilder; state: GameState; myColor: Color | null }) {
  const myTurn = myColor !== null && state.toMove === myColor && !state.result;
  const { pending } = builder;
  const canCap = !isOpening(state) && state.reserves[builder.placePiece.color].caps > 0;

  if (!myTurn) return null;

  if (pending) {
    const dropped = pending.drops.reduce((a, b) => a + b, 0);
    const max = Math.min(carryLimit(state), stackAt(state, pending.from).length);
    return (
      <div className="controls">
        <div className="controls__row">
          <strong>Carrying {pending.count - dropped}</strong>
          {!pending.dir && (
            <span className="count-picker">
              <button type="button" onClick={() => builder.setCount(pending.count - 1)} disabled={pending.count <= 1} aria-label="Carry fewer">
                −
              </button>
              <span>{pending.count}</span>
              <button type="button" onClick={() => builder.setCount(pending.count + 1)} disabled={pending.count >= max} aria-label="Carry more">
                +
              </button>
            </span>
          )}
        </div>
        <p className="hint">
          {pending.dir
            ? 'Click the next square to drop one piece, or the same square to drop another.'
            : 'Click an adjacent square to start moving in that direction.'}
        </p>
        <div className="controls__row">
          {pending.dir && (
            <button type="button" className="btn btn--primary" onClick={builder.dropRest}>
              Drop the rest here
            </button>
          )}
          <button type="button" className="btn" onClick={builder.cancel}>
            Cancel
          </button>
        </div>
      </div>
    );
  }

  if (isOpening(state)) {
    return (
      <div className="controls">
        <p className="hint">
          Opening move: place one of your <em>opponent's</em> stones on any empty square.
        </p>
      </div>
    );
  }

  return (
    <div className="controls">
      <div className="type-picker" role="radiogroup" aria-label="Piece to place">
        {(['flat', 'wall', 'cap'] as PieceType[]).map((t) => {
          const disabled = t === 'cap' ? !canCap : state.reserves[builder.placePiece.color].flats <= 0;
          return (
            <button
              key={t}
              type="button"
              role="radio"
              aria-checked={builder.placeType === t}
              className={`type-btn ${builder.placeType === t ? 'type-btn--on' : ''}`}
              disabled={disabled}
              onClick={() => builder.setPlaceType(t)}
            >
              <PieceIcon color={builder.placePiece.color} type={t} size={30} />
              <span>{t === 'flat' ? 'Flat' : t === 'wall' ? 'Wall' : 'Cap'}</span>
            </button>
          );
        })}
      </div>
      <p className="hint">Click an empty square to place, or click one of your stacks to move it.</p>
    </div>
  );
}

export function MoveList({ moves, size }: { moves: string[]; size: number }) {
  const rows: { n: number; white?: string; black?: string }[] = [];
  moves.forEach((m, i) => {
    const n = Math.floor(i / 2);
    if (!rows[n]) rows[n] = { n: n + 1 };
    if (i % 2 === 0) rows[n].white = m;
    else rows[n].black = m;
  });
  return (
    <div className="movelist" aria-label="Move list">
      <div className="movelist__head">
        <span>#</span>
        <span>White</span>
        <span>Black</span>
      </div>
      <div className="movelist__body">
        {rows.length === 0 && <p className="muted">No moves yet on this {size}×{size} board.</p>}
        {rows.map((r) => (
          <div className="movelist__row" key={r.n}>
            <span className="muted">{r.n}.</span>
            <span title={r.white ? describeMove(ptnToMove(r.white)) : ''}>{r.white ?? ''}</span>
            <span title={r.black ? describeMove(ptnToMove(r.black)) : ''}>{r.black ?? ''}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function resultText(result: GameResult, names: Record<Color, string>): string {
  if (result.winner === null) return 'Draw by flat count';
  const who = names[result.winner];
  switch (result.type) {
    case 'road':
      return `${who} wins by road`;
    case 'flat':
      return `${who} wins on flats`;
    case 'resign':
      return `${who} wins by resignation`;
    case 'timeout':
      return `${who} wins on time`;
    default:
      return `${who} wins`;
  }
}
