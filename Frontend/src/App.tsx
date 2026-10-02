import { useEffect, useState } from 'react';
import { Link, Navigate, Route, Routes } from 'react-router-dom';
import AnimatedBackground from './components/ui/animated-background';
import { QleanMenu, type Theme } from './components/ui/qlean-menu';
import { ShortenUrlPage } from './pages/ShortenUrlPage';
import { QrMakerPage } from './pages/QrMakerPage';

function getTheme(): Theme {
  try {
    const saved = localStorage.getItem('qlean-theme');
    if (saved === 'dark' || saved === 'light') return saved;
  } catch { /* Use the system preference when storage is unavailable. */ }
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function PendingPage({ title }: { title: string }) {
  return <main className="pending-page"><h1>{title}</h1><p>Coming soon.</p><Link to="/shortenurl">Back to Short URL</Link></main>;
}

export function App() {
  const [theme, setTheme] = useState<Theme>(getTheme);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try { localStorage.setItem('qlean-theme', theme); } catch { /* Theme remains usable without storage. */ }
  }, [theme]);

  return (
    <div className="app-background-shell">
      <AnimatedBackground />
      <QleanMenu theme={theme} onThemeChange={setTheme} />
      <Routes>
        <Route path="/" element={<Navigate to="/shortenurl" replace />} />
        <Route path="/shortenurl" element={<ShortenUrlPage />} />
        <Route path="/qr-maker" element={<QrMakerPage />} />
        <Route path="/register" element={<PendingPage title="Register" />} />
        <Route path="/login" element={<PendingPage title="Log in" />} />
        <Route path="*" element={<main className="pending-page"><h1>Page not found</h1><Link to="/shortenurl">Back to Short URL</Link></main>} />
      </Routes>
    </div>
  );
}
