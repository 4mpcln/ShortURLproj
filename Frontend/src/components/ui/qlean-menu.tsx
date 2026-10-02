import { Link2, Moon, QrCode, Sun } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link, NavLink } from 'react-router-dom';
import './qlean-menu.css';

export type Theme = 'light' | 'dark';

type QleanMenuProps = {
  logo?: ReactNode;
  theme: Theme;
  onThemeChange: (theme: Theme) => void;
};

export function QleanMenu({ logo, theme, onThemeChange }: QleanMenuProps) {
  const themeLabel = theme === 'dark' ? 'Switch to day mode' : 'Switch to night mode';

  return (
    <header className="qlean-header">
      <nav className="qlean-menu" data-theme={theme} aria-label="Main navigation">
        <Link className="qlean-brand" to="/shortenurl" aria-label="Qlean home">
          {logo ?? <span className="qlean-logo" aria-hidden="true">Q</span>}
          <span>Qlean</span>
        </Link>

        <div className="qlean-menu__pages">
          <NavLink to="/shortenurl">
            <Link2 size={18} aria-hidden="true" />
            Short URL
          </NavLink>
          <NavLink to="/qr-maker">
            <QrCode size={18} aria-hidden="true" />
            QR Maker
          </NavLink>
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
          <NavLink className="qlean-register" to="/register">Register</NavLink>
          <NavLink className="qlean-login" to="/login">Log in</NavLink>
        </div>
      </nav>
    </header>
  );
}
