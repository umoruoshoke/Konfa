// src/consumer/ConsumerLayout.jsx
import { useState, useEffect } from 'react';
import { NavLink, Outlet, useNavigate, useOutletContext } from 'react-router-dom';
import { signOutConsumer, fetchConsumerAlerts } from './consumerAuth';
import Header from '../components/Header';
import './ConsumerPortal.css';

const Icon = {
  Home: (p) => (
    <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 10l9-7 9 7v10a2 2 0 01-2 2h-4v-7h-6v7H5a2 2 0 01-2-2z" strokeLinejoin="round" />
    </svg>
  ),
  History: (p) => (
    <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 7v5l3 2" strokeLinecap="round" />
    </svg>
  ),
  Bookmark: (p) => (
    <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M19 21l-7-4-7 4V5a2 2 0 012-2h10a2 2 0 012 2z" strokeLinejoin="round" />
    </svg>
  ),
  Bell: (p) => (
    <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  User: (p) => (
    <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c0-4 4-7 8-7s8 3 8 7" strokeLinecap="round" />
    </svg>
  ),
  Shield: (p) => (
    <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 2L3 7V12C3 17.55 6.84 22.74 12 24C17.16 22.74 21 17.55 21 12V7L12 2Z" strokeLinejoin="round" />
      <path d="M9 12L11 14L15 10" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  Logout: (p) => (
    <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
};

const NAV = [
  { to: '/consumer/home', label: 'Dashboard', Icon: Icon.Home, end: true },
  { to: '/consumer/history', label: 'Scan History', Icon: Icon.History },
  { to: '/consumer/saved', label: 'Saved Products', Icon: Icon.Bookmark },
  { to: '/consumer/alerts', label: 'Alerts', Icon: Icon.Bell, badgeKey: 'unreadAlerts' },
  { to: '/consumer/profile', label: 'Profile', Icon: Icon.User },
  { to: '/verify', label: 'Verify a Product', Icon: Icon.Shield, external: true },
];

const ConsumerLayout = () => {
  const { consumer } = useOutletContext();
  const navigate = useNavigate();
  const [unreadAlerts, setUnreadAlerts] = useState(0);

  // Poll for unread alerts every 60s
  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      try {
        const alerts = await fetchConsumerAlerts(consumer?.id, 100);
        if (!cancelled) {
          setUnreadAlerts(alerts.filter((a) => !a.read).length);
        }
      } catch {
        if (!cancelled) setUnreadAlerts(0);
      }
    };
    check();
    const interval = setInterval(check, 60000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [consumer?.id]);

  const handleLogout = async () => {
    await signOutConsumer();
    navigate('/', { replace: true });
  };

  const displayName = consumer?.fullName || consumer?.email || 'User';
  const initials =
    displayName
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0].toUpperCase())
      .join('') || 'U';

  return (
    <div className="cp-portal-shell">
      {/* ============================================================
          UNIFIED HEADER
          ============================================================ */}
      <Header sticky />

      {/* ============================================================
          IDENTITY STRIP
          ============================================================ */}
      <div className="cp-identity-strip">
        <div className="cp-identity-left">
          <span className="cp-identity-dot" />
          <div className="cp-identity-text">
            <strong>{displayName}</strong>
            <span>Consumer account</span>
          </div>
        </div>
        <button className="cp-identity-logout" onClick={handleLogout}>
          <Icon.Logout width="16" height="16" />
          Sign out
        </button>
      </div>

      {/* ============================================================
          MAIN LAYOUT: sidebar + content
          ============================================================ */}
      <div className="cp-portal">
        <aside className="cp-sidebar">
          <nav className="cp-sidebar-nav">
            {NAV.map(({ to, label, Icon: Ico, end, badgeKey, external }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                target={external ? '_blank' : undefined}
                className={({ isActive }) =>
                  `cp-nav-item ${isActive && !external ? 'active' : ''}`
                }
              >
                <Ico width="18" height="18" />
                <span>{label}</span>
                {badgeKey === 'unreadAlerts' && unreadAlerts > 0 && (
                  <span className="cp-nav-badge">
                    {unreadAlerts > 99 ? '99+' : unreadAlerts}
                  </span>
                )}
              </NavLink>
            ))}
          </nav>

          <div className="cp-sidebar-footer">
            <div className="cp-sidebar-user">
              <div className="cp-sidebar-avatar">{initials}</div>
              <div className="cp-sidebar-user-text">
                <strong>{displayName}</strong>
                <span>{consumer?.email || ''}</span>
              </div>
            </div>
            <button className="cp-logout" onClick={handleLogout}>
              <Icon.Logout width="16" height="16" />
              Sign out
            </button>
          </div>
        </aside>

        <main className="cp-main">
          <Outlet context={{ consumer }} />
        </main>
      </div>
    </div>
  );
};

export default ConsumerLayout;