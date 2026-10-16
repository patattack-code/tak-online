import { useCallback, useMemo, useState } from 'react';
import { Board } from '../components/Board';
import { MoveControls, MoveList, ReserveRow, resultText } from '../components/GamePanels';
import { applyMove } from '../engine/rules';
import { moveToPtn, replay } from '../engine/ptn';
import { BOARD_SIZES, type BoardSize, type Move } from '../engine/types';
import { useMoveBuilder } from '../hooks/useMoveBuilder';
import { SIZE_LABELS } from '../render/iso';

/**
 * A local board where one person plays both sides. Unrated; used to learn the
 * rules and to try positions. Also doubles as the renderer's test bench.
 */
export function PracticePage() {
  const [size, setSize] = useState<BoardSize>(5);
  const [moves, setMoves] = useState<string[]>([]);
  const state = useMemo(() => replay(size, moves), [size, moves]);

  const submit = useCallback(
    (move: Move) => {
      applyMove(state, move); // throws if illegal; the builder already validated
      setMoves((m) => [...m, moveToPtn(move)]);
    },
    [state],
  );

  const builder = useMoveBuilder(state, state.toMove, submit);

  const reset = (s: BoardSize) => {
    setSize(s);
    setMoves([]);
    builder.cancel();
  };

  const undo = () => {
    builder.cancel();
    setMoves((m) => m.slice(0, -1));
  };

  const names = { white: 'White', black: 'Black' };

  return (
    <div className="game-layout">
      <section className="board-wrap">
        <Board state={state} pending={builder.pending} highlights={builder.highlights} onSquareClick={builder.onSquareClick} interactive={!state.result} />
      </section>
      <aside className="side">
        <div className="card">
          <h2>Practice board</h2>
          <p className="muted">Play both sides. Nothing here is rated or saved.</p>
          <label className="field">
            <span>Board size</span>
            <select value={size} onChange={(e) => reset(Number(e.target.value) as BoardSize)}>
              {BOARD_SIZES.map((s) => (
                <option key={s} value={s}>
                  {SIZE_LABELS[s]}
                </option>
              ))}
            </select>
          </label>
          <div className="controls__row">
            <button type="button" className="btn" onClick={undo} disabled={moves.length === 0}>
              Undo
            </button>
            <button type="button" className="btn" onClick={() => reset(size)} disabled={moves.length === 0}>
              New game
            </button>
          </div>
        </div>
        <div className="card">
          <ReserveRow color="white" state={state} name="White" active={state.toMove === 'white' && !state.result} />
          <ReserveRow color="black" state={state} name="Black" active={state.toMove === 'black' && !state.result} />
          {state.result ? (
            <p className="result">{resultText(state.result, names)}</p>
          ) : (
            <MoveControls builder={builder} state={state} myColor={state.toMove} />
          )}
          {builder.error && <p className="error">{builder.error}</p>}
        </div>
        <div className="card">
          <MoveList moves={moves} size={size} />
        </div>
      </aside>
    </div>
  );
}
