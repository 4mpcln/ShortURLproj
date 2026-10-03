import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { getShortURLAPI, type User } from '../api/generated/shortUrl';
import { clearStatisticsCache } from '../lib/statisticsCache';

export type AuthMode = 'login' | 'register';
const api = getShortURLAPI();

type AuthState = {
  user: User | null;
  loading: boolean;
  modal: AuthMode | null;
  openAuth: (mode: AuthMode) => void;
  closeAuth: () => void;
  switchMode: (mode: AuthMode) => void;
  signedIn: (user: User) => void;
  logout: () => Promise<void>;
  promptGuest: () => boolean;
};

const AuthContext = createContext<AuthState | null>(null);

function wasPrompted() {
  try { return sessionStorage.getItem('qlean-auth-prompted') === 'true'; } catch { return false; }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<AuthMode | null>(null);
  const [prompted, setPrompted] = useState(wasPrompted);
  const [pendingPrompt, setPendingPrompt] = useState(false);

  useEffect(() => {
    let active = true;
    api.getCurrentUser().then(response => { if (active) setUser(response.data); })
      .catch(() => { if (active) setUser(null); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (loading || !pendingPrompt) return;
    setPendingPrompt(false);
    if (user || prompted || modal) return;
    setPrompted(true);
    try { sessionStorage.setItem('qlean-auth-prompted', 'true'); } catch { /* Keep the choice in memory. */ }
    setModal('login');
  }, [loading, pendingPrompt, user, prompted, modal]);

  function rememberPrompt() {
    setPrompted(true);
    try { sessionStorage.setItem('qlean-auth-prompted', 'true'); } catch { /* Keep the choice in memory. */ }
  }

  function openAuth(mode: AuthMode) { rememberPrompt(); setModal(mode); }

  return <AuthContext.Provider value={{
    user, loading, modal, openAuth,
    switchMode: setModal,
    closeAuth: () => { rememberPrompt(); setModal(null); },
    signedIn: account => { clearStatisticsCache(); setUser(account); rememberPrompt(); setModal(null); },
    logout: async () => { await api.logoutUser(); clearStatisticsCache(); setUser(null); },
    promptGuest: () => {
      if (user || prompted || modal) return false;
      if (loading) { setPendingPrompt(true); return true; }
      openAuth('login');
      return true;
    },
  }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const auth = useContext(AuthContext);
  if (!auth) throw new Error('AuthProvider is required.');
  return auth;
}
