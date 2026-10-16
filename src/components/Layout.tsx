import { NavLink, Outlet } from 'react-router';
import { useAuth } from '../auth/AuthProvider';
import { isConfigured } from '../firebase';

export function Layout() {
  const { user, loading, signIn, signOut, error } = useAuth();
  return (
    <div className="app">
      <header className="topbar">
        <NavLink to="/" className="brand">
          <img src="/assets/logo.svg" alt="" width={34} height={34} />
          <span>Tak Online</span>
        </NavLink>
        <nav className="nav">
          <NavLink to="/" end>
            Lobby
          </NavLink>
          <NavLink to="/leaderboard">Leaderboard</NavLink>
          <NavLink to="/practice">Practice</NavLink>
          <NavLink to="/rules">Rules</NavLink>
        </nav>
        <div className="auth">
          {!isConfigured ? (
            <span className="muted">Firebase not configured</span>
          ) : loading ? (
            <span className="muted">…</span>
          ) : user ? (
            <>
              <NavLink to={`/profile/${user.uid}`} className="avatar-link" title="Your profile">
                {user.photoURL ? <img src={user.photoURL} alt="" className="avatar" referrerPolicy="no-referrer" /> : <span className="avatar avatar--blank" />}
                <span className="avatar-name">{user.displayName ?? 'You'}</span>
              </NavLink>
              <button type="button" className="btn btn--small" onClick={signOut}>
                Sign out
              </button>
            </>
          ) : (
            <button type="button" className="btn btn--primary" onClick={signIn}>
              Sign in with Google
            </button>
          )}
        </div>
      </header>
      {error && <div className="banner banner--error">{error}</div>}
      <main className="main">
        <Outlet />
      </main>
      <footer className="footer muted">
        Tak was designed by James Ernest and Patrick Rothfuss. This is an unofficial fan-made client.
      </footer>
    </div>
  );
}
