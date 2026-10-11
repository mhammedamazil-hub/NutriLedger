import { useEffect, useRef, type ReactNode } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router';
import { HardDrive, Settings, WifiOff } from 'lucide-react';
import { Logo } from '../common/Logo';
import { NAV_ITEMS } from '../navigation/navItems';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';
import { StatusBanners } from './StatusBanners';
import { useData } from '../../app/dataContext';
import styles from './AppShell.module.css';

export function AppShell({ children }: { children?: ReactNode }) {
  const online = useOnlineStatus();
  const location = useLocation();
  const storageKind = useData((s) => s.status);
  const first = useRef(true);

  // Move focus to the new page heading on navigation so screen-reader and
  // keyboard users land at the start of the new content.
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    window.scrollTo({ top: 0 });
    const t = setTimeout(() => {
      const h1 = document.querySelector<HTMLElement>('main h1');
      h1?.focus({ preventScroll: true });
    }, 0);
    return () => clearTimeout(t);
  }, [location.pathname]);

  return (
    <div className={styles.shell}>
      <a className="skip-link" href="#main">
        Skip to content
      </a>

      <aside className={styles.sidebar}>
        <NavLink to="/" className={styles.brand} aria-label="NutriLedger home">
          <Logo size={30} />
          NutriLedger
        </NavLink>
        <p className={styles.tagline}>Nutrition, measured clearly.</p>
        <nav aria-label="Main">
          <ul className={styles.sideList}>
            {NAV_ITEMS.map((item) => (
              <li key={item.to}>
                <NavLink to={item.to} end={item.to === '/'} className={styles.sideLink}>
                  {item.icon}
                  {item.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
        <div className={styles.sideFooter}>
          {!online && (
            <span className={styles.offlinePill}>
              <WifiOff aria-hidden="true" /> Offline — local features work
            </span>
          )}
          <span className="row" style={{ gap: 6 }}>
            <HardDrive aria-hidden="true" width={14} height={14} />
            {storageKind === 'memory' ? 'Session-only storage' : 'Records stored on this device'}
          </span>
        </div>
      </aside>

      <header className={styles.topbar}>
        <NavLink to="/" className={styles.brand} aria-label="NutriLedger home">
          <Logo size={28} />
          NutriLedger
        </NavLink>
        <div className={styles.topActions}>
          {!online && (
            <span className={styles.offlinePill}>
              <WifiOff aria-hidden="true" /> Offline
            </span>
          )}
          <NavLink to="/settings" className={styles.iconLink} aria-label="Settings">
            <Settings aria-hidden="true" />
          </NavLink>
        </div>
      </header>

      <main id="main" className={styles.main} tabIndex={-1}>
        <div className={styles.content}>
          <div className={styles.banners}>
            <StatusBanners online={online} />
          </div>
          {children ?? <Outlet />}
        </div>
      </main>

      <nav className={styles.bottomnav} aria-label="Main">
        <ul className={styles.bottomList}>
          {NAV_ITEMS.filter((i) => i.mobile).map((item) => (
            <li key={item.to}>
              <NavLink to={item.to} end={item.to === '/'} className={styles.bottomLink}>
                {item.icon}
                <span>{item.shortLabel}</span>
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
