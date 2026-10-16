import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { onAuthStateChanged, signInWithPopup, signOut as fbSignOut, type User } from 'firebase/auth';
import { googleProvider, isConfigured, requireAuth } from '../firebase';
import { ensureUserDoc } from '../data/users';

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
  error: string | null;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  loading: false,
  signIn: async () => {},
  signOut: async () => {},
  error: null,
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(isConfigured);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isConfigured) return;
    const unsub = onAuthStateChanged(requireAuth(), async (u) => {
      setUser(u);
      if (u) {
        try {
          await ensureUserDoc(u);
        } catch (e) {
          setError((e as Error).message);
        }
      }
      setLoading(false);
    });
    return unsub;
  }, []);

  const signIn = useCallback(async () => {
    setError(null);
    try {
      await signInWithPopup(requireAuth(), googleProvider);
    } catch (e) {
      const code = (e as { code?: string }).code ?? '';
      if (code !== 'auth/popup-closed-by-user' && code !== 'auth/cancelled-popup-request') {
        setError((e as Error).message);
      }
    }
  }, []);

  const signOut = useCallback(async () => {
    await fbSignOut(requireAuth());
  }, []);

  const value = useMemo(() => ({ user, loading, signIn, signOut, error }), [user, loading, signIn, signOut, error]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  return useContext(AuthContext);
}
