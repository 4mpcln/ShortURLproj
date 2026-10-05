import { Library, Link2, LogOut, Moon, QrCode, Sun } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { useAuth } from '../../auth/AuthContext';
import { Link, NavLink } from 'react-router-dom';
import { QleanLogo } from './qlean-logo';
import './qlean-menu.css';

export type Theme = 'light' | 'dark';

type QleanMenuProps = {
  logo?: ReactNode;
  theme: Theme;
  onThemeChange: (theme: Theme) => void;
};

export function QleanMenu({ logo, theme, onThemeChange }: QleanMenuProps) {
  const { user, loading, openAuth, logout } = useAuth();
  const [loggingOut, setLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState(false);
  const themeLabel = theme === 'dark' ? 'Switch to day mode' : 'Switch to night mode';

  return (
    <header className="qlean-header">
      <nav className="qlean-menu" data-theme={theme} aria-label="Main navigation">
        <Link className="qlean-brand" to="/" aria-label="Qlean home">
          {logo ?? <QleanLogo />}
        </Link>

        <div className="qlean-menu__pages">
          <NavLink to="/" end>
            <Link2 size={18} aria-hidden="true" />
            Shorten URL
          </NavLink>
          <NavLink to="/qr-maker">
            <QrCode size={18} aria-hidden="true" />
            QR Maker
          </NavLink>
          {user && <NavLink to="/my-links"><Library size={18} aria-hidden="true" />My library</NavLink>}
        </div>

        <div className="qlean-menu__actions">
          <button
            className="qlean-theme"
            type="button"
            aria-label={themeLabel}
            title={themeLabel}
            onClick={() => onThemeChange(theme === 'dark' ? 'light' : 'dark')}
          >
            {theme === 'dark' ? <Sun size={20} aria-hidden="true" /> : <Moon size={20} aria-hidden="true" />}
          </button>
          {user ? <>
            <button className="qlean-theme qlean-logout" type="button" disabled={loggingOut} aria-label={`Log out ${user.name}`} title={logoutError ? 'Could not log out. Try again.' : `Log out ${user.name}`} onClick={async () => {
              setLoggingOut(true); setLogoutError(false);
              try { await logout(); } catch { setLogoutError(true); } finally { setLoggingOut(false); }
            }}><span className="qlean-user-name">{user.name}</span><LogOut size={18} aria-hidden="true" /></button>
            {logoutError && <span className="sr-only" role="alert">Could not log out. Try again.</span>}
          </> : <>
            <button className="qlean-register" type="button" disabled={loading} onClick={() => openAuth('register')}>Register</button>
            <button className="qlean-login" type="button" disabled={loading} onClick={() => openAuth('login')}>Log in</button>
          </>}
        </div>
      </nav>
    </header>
  );
}
