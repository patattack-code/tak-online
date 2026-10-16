import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router';
import { useAuth } from '../auth/AuthProvider';
import { Board, type Highlight } from '../components/Board';
import { MoveControls, MoveList, ReserveRow, resultText } from '../components/GamePanels';
import { joinGame, resignGame, submitMove, subscribeGame } from '../data/games';
import { colorOf, type GameSummary } from '../data/types';
import { ptnToMove, replay } from '../engine/ptn';
import { dirDelta } from '../engine/rules';
import type { Move } from '../engine/types';
import { useMoveBuilder } from '../hooks/useMoveBuilder';
import { SIZE_LABELS } from '../render/iso';

function lastMoveHighlights(moves: string[]): Highlight[] {
  if (moves.length === 0) return [];
  const m = ptnToMove(moves[moves.length - 1]);
  if (m.kind === 'place') return [{ coord: m.to, kind: 'last' }];
  const out: Highlight[] = [{ coord: m.from, kind: 'last' }];
  const d = dirDelta(m.dir);
  let pos = m.from;
  for (let i = 0; i < m.drops.length; i++) {
    pos = { c: pos.c + d.c, r: pos.r + d.r };
    out.push({ coord: pos, kind: 'last' });
  }
  return out;
}

export function GamePage() {
  const { id = '' } = useParams();
  const { user } = useAuth();
  const [game, setGame] = useState<GameSummary | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!id) return;
    return subscribeGame(id, setGame, (e) => setError(e.message));
  }, [id]);

  const moves = game?.moves ?? [];
  const size = game?.size ?? 5;
  const state = useMemo(() => replay(size, moves), [size, moves]);
  const myColor = game && user ? colorOf(game, user.uid) : null;

  const submit = useCallback(
    (move: Move) => {
      if (!game || !user) return;
      setBusy(true);
      setError(null);
      submitMove(game.id, user.uid, move, game.moves.length)
        .catch((e) => setError((e as Error).message))
        .finally(() => setBusy(false));
    },
    [game, user],
  );

  const builder = useMoveBuilder(state, game?.status === 'active' ? myColor : null, submit);

  if (game === undefined) return <p className="muted">Loading game…</p>;
  if (game === null) return <p className="error">This game does not exist (it may have been cancelled).</p>;

  const names = {
    white: game.white ? (game.names[game.white]?.displayName ?? 'White') : 'White',
    black: game.black ? (game.names[game.black]?.displayName ?? 'Black') : 'Black',
  };
  const highlights: Highlight[] = [...lastMoveHighlights(moves), ...builder.highlights];
  const shareUrl = `${window.location.origin}/game/${game.id}`;

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setError('Could not copy; the link is ' + shareUrl);
    }
  }

  async function onJoin() {
    if (!user) return;
    setBusy(true);
    try {
      await joinGame(game!.id, user);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function onResign() {
    if (!user || !window.confirm('Resign this game?')) return;
    try {
      await resignGame(game!.id, user.uid);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  const myDelta = user && game.ratingDelta?.[user.uid];

  return (
    <div className="game-layout">
      <section className="board-wrap">
        <Board
          state={state}
          pending={builder.pending}
          highlights={highlights}
          onSquareClick={builder.onSquareClick}
          interactive={game.status === 'active' && myColor !== null && state.toMove === myColor && !busy}
        />
      </section>
      <aside className="side">
        <div className="card">
          <h2>{game.name}</h2>
          <p className="muted">
            {SIZE_LABELS[game.size]} · {game.rated ? 'rated' : 'unrated'}
          </p>
          {game.status === 'waiting' && (
            <>
              <p>Waiting for an opponent. Share this link:</p>
              <div className="controls__row">
                <code className="share">{shareUrl}</code>
                <button type="button" className="btn btn--small" onClick={copyLink}>
                  {copied ? 'Copied' : 'Copy'}
                </button>
              </div>
              {user && game.creator !== user.uid && (
                <button type="button" className="btn btn--primary" disabled={busy} onClick={onJoin}>
                  Join this game
                </button>
              )}
              {!user && <p className="muted">Sign in to join.</p>}
            </>
          )}
          {game.status !== 'waiting' && (
            <>
              <ReserveRow color="white" state={state} name={names.white} active={game.status === 'active' && state.toMove === 'white'} />
              <ReserveRow color="black" state={state} name={names.black} active={game.status === 'active' && state.toMove === 'black'} />
            </>
          )}
          {game.status === 'active' && myColor && (
            <>
              <MoveControls builder={builder} state={state} myColor={myColor} />
              {state.toMove !== myColor && <p className="hint">Waiting for {names[state.toMove]} to move…</p>}
              <div className="controls__row">
                <button type="button" className="btn btn--danger btn--small" onClick={onResign}>
                  Resign
                </button>
              </div>
            </>
          )}
          {game.status === 'active' && !myColor && <p className="muted">You are spectating.</p>}
          {game.status === 'finished' && game.result && (
            <div className="result-box">
              <p className="result">{resultText(game.result, names)}</p>
              {game.rated && game.ratingApplied && (
                <p className="muted">
                  Rating change: {names.white} {fmtDelta(game.ratingDelta[game.white!])}, {names.black} {fmtDelta(game.ratingDelta[game.black!])}
                  {typeof myDelta === 'number' && <strong> · you {fmtDelta(myDelta)}</strong>}
                </p>
              )}
              <Link to="/" className="btn btn--primary">
                Back to lobby
              </Link>
            </div>
          )}
          {(error || builder.error) && <p className="error">{error ?? builder.error}</p>}
        </div>
        <div className="card">
          <MoveList moves={moves} size={game.size} />
        </div>
        {game.status !== 'waiting' && (
          <div className="card players">
            {(['white', 'black'] as const).map((c) => {
              const uid = game[c];
              if (!uid) return null;
              return (
                <Link key={c} to={`/profile/${uid}`} className="player-link">
                  <span className={`swatch swatch--${c}`} /> {game.names[uid]?.displayName ?? c}
                </Link>
              );
            })}
          </div>
        )}
      </aside>
    </div>
  );
}

function fmtDelta(n: number | undefined): string {
  if (typeof n !== 'number') return '';
  return n >= 0 ? `+${n}` : String(n);
}
