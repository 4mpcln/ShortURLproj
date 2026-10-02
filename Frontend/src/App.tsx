import { useEffect, useState, type MouseEvent } from 'react';
import { Link, Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import AnimatedBackground from './components/ui/animated-background';
import { QleanMenu, type Theme } from './components/ui/qlean-menu';
import { ShortenUrlPage } from './pages/ShortenUrlPage';
import { QrMakerPage } from './pages/QrMakerPage';
import { MyLinksPage } from './pages/MyLinksPage';
import { LinkStatisticsPage } from './pages/LinkStatisticsPage';
import { useAuth, type AuthMode } from './auth/AuthContext';
import { AuthModal } from './components/ui/auth-modal';

function getTheme(): Theme {
  try {
    const saved = localStorage.getItem('qlean-theme');
    if (saved === 'dark' || saved === 'light') return saved;
  } catch { /* Use the system preference when storage is unavailable. */ }
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function AuthEntry({ mode }: { mode: AuthMode }) {
  const { openAuth, user } = useAuth();
  const navigate = useNavigate();
  useEffect(() => {
    if (!user) openAuth(mode);
    navigate('/shortenurl', { replace: true });
  }, [mode]);
  return null;
}

export function App() {
  const [theme, setTheme] = useState<Theme>(getTheme);
  const { promptGuest } = useAuth();

  function handleToolClick(event: MouseEvent<HTMLDivElement>) {
    const target = event.target as HTMLElement;
    if (!target.closest('.qlean-menu__pages a, .shorten-page input, .shorten-page button, .qr-page input, .qr-page button, .qr-page select')) return;
    if (promptGuest() && !target.closest('.qlean-menu__pages a')) event.preventDefault();
  }

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try { localStorage.setItem('qlean-theme', theme); } catch { /* Theme remains usable without storage. */ }
  }, [theme]);

  return (
    <div className="app-background-shell" onClickCapture={handleToolClick}>
      <AnimatedBackground />
      <QleanMenu theme={theme} onThemeChange={setTheme} />
      <Routes>
        <Route path="/" element={<Navigate to="/shortenurl" replace />} />
        <Route path="/shortenurl" element={<ShortenUrlPage />} />
        <Route path="/qr-maker" element={<QrMakerPage />} />
        <Route path="/register" element={<AuthEntry mode="register" />} />
        <Route path="/login" element={<AuthEntry mode="login" />} />
        <Route path="/my-links" element={<MyLinksPage />} />
        <Route path="/my-links/:id" element={<LinkStatisticsPage />} />
        <Route path="*" element={<main className="pending-page"><h1>Page not found</h1><Link to="/shortenurl">Back to Short URL</Link></main>} />
      </Routes>
      <AuthModal />
    </div>
  );
}
