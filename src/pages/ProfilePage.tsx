import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router';
import { useAuth } from '../auth/AuthProvider';
import { fetchFinishedGames } from '../data/games';
import { subscribeUser } from '../data/users';
import { colorOf, sizeKey, type GameSummary, type SizeStats, type UserDoc } from '../data/types';
import { BOARD_SIZES } from '../engine/types';
import { SIZE_LABELS } from '../render/iso';
import { resultText } from '../components/GamePanels';

function Sparkline({ values }: { values: number[] }) {
  if (values.length < 2) return <div className="sparkline sparkline--empty muted">Play more games to see a trend</div>;
  const w = 160;
  const h = 40;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const pts = values.map((v, i) => `${(i / (values.length - 1)) * w},${h - ((v - min) / span) * (h - 4) - 2}`).join(' ');
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="sparkline" role="img" aria-label="Rating trend">
      <polyline points={pts} fill="none" stroke="currentColor" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

function RatingCard({ label, stats }: { label: string; stats: SizeStats }) {
  const winRate = stats.games ? Math.round((stats.wins / stats.games) * 100) : 0;
  return (
    <div className="rating-card">
      <div className="rating-card__head">
        <span className="rating-card__label">{label}</span>
        <span className="rating-card__rating">{stats.rating}</span>
      </div>
      <Sparkline values={stats.history} />
      <dl className="stats">
        <div>
          <dt>Games</dt>
          <dd>{stats.games}</dd>
        </div>
        <div>
          <dt>W / L / D</dt>
          <dd>
            {stats.wins} / {stats.losses} / {stats.draws}
          </dd>
        </div>
        <div>
          <dt>Win rate</dt>
          <dd>{winRate}%</dd>
        </div>
        <div>
          <dt>Peak</dt>
          <dd>{stats.peak}</dd>
        </div>
        <div>
          <dt>Road wins</dt>
          <dd>{stats.roadWins}</dd>
        </div>
        <div>
          <dt>Flat wins</dt>
          <dd>{stats.flatWins}</dd>
        </div>
      </dl>
    </div>
  );
}

export function ProfilePage() {
  const { uid = '' } = useParams();
  const { user } = useAuth();
  const [profile, setProfile] = useState<UserDoc | null | undefined>(undefined);
  const [games, setGames] = useState<GameSummary[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!uid) return;
    const unsub = subscribeUser(uid, setProfile, (e) => setError(e.message));
    fetchFinishedGames(uid).then(setGames).catch((e) => setError((e as Error).message));
    return unsub;
  }, [uid]);

  if (profile === undefined) return <p className="muted">Loading profile…</p>;
  if (profile === null) return <p className="error">No such player.</p>;

  const sizesPlayed = BOARD_SIZES.filter((s) => profile.ratings[sizeKey(s)]);
  const isMe = user?.uid === uid;

  return (
    <div className="profile">
      {error && <div className="banner banner--error">{error}</div>}
      <header className="profile__head">
        {profile.photoURL ? <img src={profile.photoURL} alt="" className="avatar avatar--big" referrerPolicy="no-referrer" /> : <span className="avatar avatar--big avatar--blank" />}
        <div>
          <h1>
            {profile.displayName} {isMe && <span className="badge">you</span>}
          </h1>
          <p className="muted">
            {profile.totals.games} rated games · {profile.totals.wins} wins · {profile.totals.losses} losses · {profile.totals.draws} draws
            {profile.createdAt && <> · joined {profile.createdAt.toDate().toLocaleDateString()}</>}
          </p>
        </div>
      </header>

      <section>
        <h2>Ratings by board size</h2>
        {sizesPlayed.length === 0 ? (
          <p className="muted">No rated games yet. Ratings start at 1500 and are tracked separately for each board size.</p>
        ) : (
          <div className="rating-grid">
            {sizesPlayed.map((s) => (
              <RatingCard key={s} label={SIZE_LABELS[s]} stats={profile.ratings[sizeKey(s)]!} />
            ))}
          </div>
        )}
      </section>

      <section>
        <h2>Recent games</h2>
        {games.length === 0 ? (
          <p className="muted">No finished games yet.</p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Board</th>
                <th>Played</th>
                <th>Opponent</th>
                <th>Result</th>
                <th>Δ</th>
              </tr>
            </thead>
            <tbody>
              {games.map((g) => {
                const me = colorOf(g, uid);
                const oppUid = g.playerIds.find((p) => p !== uid);
                const names = {
                  white: g.white ? (g.names[g.white]?.displayName ?? 'White') : 'White',
                  black: g.black ? (g.names[g.black]?.displayName ?? 'Black') : 'Black',
                };
                const won = g.result?.winner === me;
                const delta = g.ratingDelta?.[uid];
                return (
                  <tr key={g.id}>
                    <td>{g.finishedAt ? g.finishedAt.toDate().toLocaleDateString() : ''}</td>
                    <td>{SIZE_LABELS[g.size]}</td>
                    <td>{me}</td>
                    <td>{oppUid ? <Link to={`/profile/${oppUid}`}>{g.names[oppUid]?.displayName ?? 'Opponent'}</Link> : ''}</td>
                    <td>
                      <Link to={`/game/${g.id}`} className={g.result?.winner === null ? '' : won ? 'win' : 'loss'}>
                        {g.result ? resultText(g.result, names) : ''}
                      </Link>
                    </td>
                    <td>{typeof delta === 'number' ? (delta >= 0 ? `+${delta}` : delta) : g.rated ? '' : 'unrated'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
