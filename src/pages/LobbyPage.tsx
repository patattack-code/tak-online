import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import { useAuth } from '../auth/AuthProvider';
import { cancelGame, createGame, joinGame, subscribeMyGames, subscribeOpenGames } from '../data/games';
import type { ColorChoice, GameSummary } from '../data/types';
import { NAME_MAX, slugify } from '../data/slug';
import { BOARD_SIZES, PIECE_COUNTS, type BoardSize } from '../engine/types';
import { SIZE_LABELS } from '../render/iso';

function opponentName(game: GameSummary, uid: string): string {
  const other = game.playerIds.find((p) => p !== uid);
  return other ? (game.names[other]?.displayName ?? 'Opponent') : 'Waiting for opponent';
}

export function LobbyPage() {
  const { user, signIn } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [size, setSize] = useState<BoardSize>(5);
  const [color, setColor] = useState<ColorChoice>('random');
  const [rated, setRated] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<GameSummary[]>([]);
  const [mine, setMine] = useState<GameSummary[]>([]);

  useEffect(() => {
    if (!user) return;
    const a = subscribeOpenGames(setOpen, (e) => setError(e.message));
    const b = subscribeMyGames(user.uid, setMine, (e) => setError(e.message));
    return () => {
      a();
      b();
    };
  }, [user]);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    if (!user) return;
    setBusy(true);
    setError(null);
    try {
      const id = await createGame(user, size, color, rated, name);
      setName('');
      navigate(`/game/${id}`);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function onJoin(id: string) {
    if (!user) return;
    setBusy(true);
    setError(null);
    try {
      await joinGame(id, user);
      navigate(`/game/${id}`);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (!user) {
    return (
      <div className="hero">
        <img src="/assets/sample-position.svg" alt="A Tak position" className="hero__art" />
        <div className="hero__text">
          <h1>Tak, online.</h1>
          <p>
            Build a road across the board before your opponent does. Play rated games on any board from 3×3 to 8×8, and track your Elo per
            size.
          </p>
          <div className="controls__row">
            <button type="button" className="btn btn--primary btn--big" onClick={signIn}>
              Sign in with Google to play
            </button>
            <Link to="/practice" className="btn btn--big">
              Try the practice board
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const active = mine.filter((g) => g.status === 'active');
  const waitingMine = mine.filter((g) => g.status === 'waiting');
  const openOthers = open.filter((g) => g.creator !== user.uid);

  return (
    <div className="lobby">
      {error && <div className="banner banner--error">{error}</div>}
      <section className="card">
        <h2>Create a game</h2>
        <form onSubmit={onCreate} className="form-grid">
          <label className="field field--wide">
            <span>Game name (becomes the link)</span>
            <input
              type="text"
              value={name}
              maxLength={NAME_MAX}
              placeholder="e.g. Friday night Tak"
              onChange={(e) => setName(e.target.value)}
            />
            <small className="muted">
              {name.trim() ? `${window.location.origin}/game/${slugify(name) || '…'}` : 'Leave blank for a random name.'}
            </small>
          </label>
          <label className="field">
            <span>Board size</span>
            <select value={size} onChange={(e) => setSize(Number(e.target.value) as BoardSize)}>
              {BOARD_SIZES.map((s) => (
                <option key={s} value={s}>
                  {SIZE_LABELS[s]} · {PIECE_COUNTS[s].flats} stones, {PIECE_COUNTS[s].caps} cap
                  {PIECE_COUNTS[s].caps === 1 ? '' : 's'}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Play as</span>
            <select value={color} onChange={(e) => setColor(e.target.value as ColorChoice)}>
              <option value="random">Random</option>
              <option value="white">White (moves first)</option>
              <option value="black">Black</option>
            </select>
          </label>
          <label className="field field--check">
            <input type="checkbox" checked={rated} onChange={(e) => setRated(e.target.checked)} />
            <span>Rated</span>
          </label>
          <button type="submit" className="btn btn--primary" disabled={busy}>
            Create
          </button>
        </form>
      </section>

      <section className="card">
        <h2>Your games</h2>
        {active.length === 0 && waitingMine.length === 0 && <p className="muted">No games in progress. Create one or join a challenge.</p>}
        <ul className="list">
          {waitingMine.map((g) => (
            <li key={g.id} className="list__item">
              <span>
                <strong>{g.name}</strong> · {SIZE_LABELS[g.size]} · waiting for an opponent {g.rated ? '' : '· unrated'}
              </span>
              <span className="controls__row">
                <Link to={`/game/${g.id}`} className="btn btn--small">
                  Open
                </Link>
                <button type="button" className="btn btn--small" onClick={() => cancelGame(g.id)}>
                  Cancel
                </button>
              </span>
            </li>
          ))}
          {active.map((g) => (
            <li key={g.id} className="list__item">
              <span>
                <strong>{g.name}</strong> · {SIZE_LABELS[g.size]} vs {opponentName(g, user.uid)}
                {g.toMoveUid === user.uid ? <span className="badge">your move</span> : <span className="muted"> · their move</span>}
              </span>
              <Link to={`/game/${g.id}`} className="btn btn--small btn--primary">
                Play
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section className="card">
        <h2>Open challenges</h2>
        {openOthers.length === 0 && <p className="muted">Nobody is waiting right now. Create a game and share the link.</p>}
        <ul className="list">
          {openOthers.map((g) => (
            <li key={g.id} className="list__item">
              <span>
                <strong>{g.name}</strong> · {SIZE_LABELS[g.size]} · {g.names[g.creator]?.displayName ?? 'Someone'} plays{' '}
                {g.creatorColor === 'random' ? 'either colour' : g.creatorColor}
                {g.rated ? '' : ' · unrated'}
              </span>
              <button type="button" className="btn btn--small btn--primary" disabled={busy} onClick={() => onJoin(g.id)}>
                Join
              </button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
