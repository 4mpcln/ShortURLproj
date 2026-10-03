import { isAxiosError } from 'axios';
import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { getShortURLAPI, type User } from '../api/generated/shortUrl';
import { onUnauthorized } from '../api/http';
import { clearStatisticsCache } from '../lib/statisticsCache';

export type AuthMode = 'login' | 'register';
const api = getShortURLAPI();
const SESSION_CHECK_INTERVAL = 60_000;
const SESSION_MARKER = 'qlean-session-active';

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

function hadSession() {
  try { return sessionStorage.getItem(SESSION_MARKER) === 'true'; } catch { return false; }
}

function rememberSession(active: boolean) {
  try {
    if (active) sessionStorage.setItem(SESSION_MARKER, 'true');
    else sessionStorage.removeItem(SESSION_MARKER);
  } catch { /* Session checks still work when storage is unavailable. */ }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const navigation = useRef(navigate);
  navigation.current = navigate;
  const [user, setUser] = useState<User | null>(null);
  const session = useRef<User | null>(null);
  const generation = useRef(0);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<AuthMode | null>(null);
  const [prompted, setPrompted] = useState(wasPrompted);
  const [pendingPrompt, setPendingPrompt] = useState(false);

  const endSession = useCallback(() => {
    generation.current++;
    session.current = null;
    rememberSession(false);
    clearStatisticsCache();
    setUser(null);
    setLoading(false);
    setModal(null);
    setPendingPrompt(false);
    setPrompted(true);
    try { sessionStorage.setItem('qlean-auth-prompted', 'true'); } catch { /* Keep the choice in memory. */ }
    navigation.current('/shortenurl', { replace: true });
  }, []);

  useEffect(() => {
    let active = true;
    // Initialization must not overwrite a later login or logout.
    const version = generation.current;
    const previousSession = hadSession();
    const current = () => active && generation.current === version;
    api.getCurrentUser().then(response => {
      if (!current()) return;
      if (!response.data && previousSession) { endSession(); return; }
      session.current = response.data;
      setUser(response.data);
      rememberSession(Boolean(response.data));
    }).catch(error => {
      if (!current()) return;
      if (previousSession && isAxiosError(error) && error.response?.status === 401) endSession();
      else setUser(null);
    }).finally(() => { if (current()) setLoading(false); });
    return () => { active = false; };
  }, [endSession]);

  useLayoutEffect(() => {
    if (!user) return;
    const accountId = user.id;
    let active = true;
    let checking = false;
    const current = () => active && session.current === user;
    const expire = () => { if (current()) endSession(); };
    const unsubscribe = onUnauthorized(expire);
    async function checkSession() {
      if (!current() || checking || document.visibilityState === 'hidden') return;
      checking = true;
      try {
        const response = await api.getCurrentUser();
        if (current() && (!response.data || response.data.id !== accountId)) expire();
      } catch (error) {
        if (isAxiosError(error) && error.response?.status === 401) expire();
      } finally { checking = false; }
    }
    const timer = window.setInterval(checkSession, SESSION_CHECK_INTERVAL);
    window.addEventListener('focus', checkSession);
    document.addEventListener('visibilitychange', checkSession);
    return () => {
      active = false;
      unsubscribe();
      window.clearInterval(timer);
      window.removeEventListener('focus', checkSession);
      document.removeEventListener('visibilitychange', checkSession);
    };
  }, [user, endSession]);

  useEffect(() => {
    if (!loading && !user && /^\/my-links(?:\/|$)/.test(pathname)) {
      navigation.current('/shortenurl', { replace: true });
    }
  }, [loading, user, pathname]);

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
    signedIn: account => {
      generation.current++;
      session.current = account;
      rememberSession(true);
      clearStatisticsCache();
      setUser(account); setLoading(false); rememberPrompt(); setModal(null); setPendingPrompt(false);
    },
    logout: async () => {
      const version = generation.current;
      try { await api.logoutUser(); }
      catch (error) { if (!isAxiosError(error) || error.response?.status !== 401) throw error; }
      if (generation.current === version) endSession();
    },
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
