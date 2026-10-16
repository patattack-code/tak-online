import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { fetchLeaderboard, type LeaderboardEntry } from '../data/users';
import { sizeKey } from '../data/types';
import { BOARD_SIZES, type BoardSize } from '../engine/types';
import { SIZE_LABELS } from '../render/iso';

export function LeaderboardPage() {
  const [size, setSize] = useState<BoardSize>(5);
  const [rows, setRows] = useState<LeaderboardEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setRows(null);
    fetchLeaderboard(sizeKey(size))
      .then(setRows)
      .catch((e) => setError((e as Error).message));
  }, [size]);

  const key = sizeKey(size);
  return (
    <div className="leaderboard">
      <h1>Leaderboard</h1>
      <div className="tabs" role="tablist">
        {BOARD_SIZES.map((s) => (
          <button key={s} type="button" role="tab" aria-selected={s === size} className={`tab ${s === size ? 'tab--on' : ''}`} onClick={() => setSize(s)}>
            {SIZE_LABELS[s]}
          </button>
        ))}
      </div>
      {error && <div className="banner banner--error">{error}</div>}
      {rows === null ? (
        <p className="muted">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="muted">No rated games on {SIZE_LABELS[size]} yet.</p>
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th>#</th>
              <th>Player</th>
              <th>Rating</th>
              <th>Games</th>
              <th>W / L / D</th>
              <th>Peak</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              const s = r.user.ratings[key]!;
              return (
                <tr key={r.uid}>
                  <td>{i + 1}</td>
                  <td>
                    <Link to={`/profile/${r.uid}`} className="player-link">
                      {r.user.photoURL ? <img src={r.user.photoURL} alt="" className="avatar" referrerPolicy="no-referrer" /> : <span className="avatar avatar--blank" />}
                      {r.user.displayName}
                    </Link>
                  </td>
                  <td>
                    <strong>{s.rating}</strong>
                  </td>
                  <td>{s.games}</td>
                  <td>
                    {s.wins} / {s.losses} / {s.draws}
                  </td>
                  <td>{s.peak}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
