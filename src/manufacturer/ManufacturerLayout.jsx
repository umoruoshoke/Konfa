// src/manufacturer/ManufacturerLayout.jsx
import { useEffect, useState } from 'react';
import {
  NavLink,
  Outlet,
  useNavigate,
  useOutletContext,
} from 'react-router-dom';
import {
  logoutManufacturer,
  fetchUnreadNotifications,
  ROLE_LABELS,
} from './manufacturerAuth';
import Header from '../components/Header';
import './ManufacturerPortal.css';

// ============================================================
// ICONS
// ============================================================
const Icon = {
  Home: (p) => (
    <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 10l9-7 9 7v10a2 2 0 01-2 2h-4v-7h-6v7H5a2 2 0 01-2-2z" strokeLinejoin="round" />
    </svg>
  ),
  Bell: (p) => (
    <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path
        d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  ),
  Products: (p) => (
    <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path
        d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"
        strokeLinejoin="round"
      />
      <path
        d="M3.27 6.96L12 12.01l8.73-5.05M12 22.08V12"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  ),
  Batches: (p) => (
    <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M3 9h18M9 3v18" />
    </svg>
  ),
  Plus: (p) => (
    <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 5v14M5 12h14" strokeLinecap="round" />
    </svg>
  ),
  Activation: (p) => (
    <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M9 12l2 2 4-4" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="12" cy="12" r="10" />
    </svg>
  ),
  Shipments: (p) => (
    <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 7l9-4 9 4-9 4-9-4zM3 12l9 4 9-4M3 17l9 4 9-4" strokeLinejoin="round" />
    </svg>
  ),
  Reconciliation: (p) => (
    <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M4 6h16M4 12h16M4 18h16" strokeLinecap="round" />
      <circle cx="8" cy="6" r="1.5" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none" />
      <circle cx="16" cy="18" r="1.5" fill="currentColor" stroke="none" />
    </svg>
  ),
  Recalls: (p) => (
    <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path
        d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"
        strokeLinejoin="round"
      />
      <path d="M12 9v4M12 17h.01" strokeLinecap="round" />
    </svg>
  ),
  Staff: (p) => (
    <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="9" cy="8" r="4" />
      <path
        d="M2 21c0-4 3.5-7 8-7s8 3 8 7M17 11a4 4 0 100-8M22 21c0-3-2-6-5-7"
        strokeLinecap="round"
      />
    </svg>
  ),
  Logout: (p) => (
    <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
};

// ============================================================
// ROLES THAT CAN SEE EVERY PAGE
// ============================================================
const ALL_ROLES = [
  'OWNER',
  'ADMIN',
  'GENERATION_OFFICER',
  'ACTIVATION_OFFICER',
  'SHIPPING_OFFICER',
  'SUPERVISOR',
  'VIEWER',
];

// ============================================================
// NAV DEFINITION
// ============================================================
const NAV = [
  {
    to: '/manufacturer/home',
    label: 'Dashboard',
    Icon: Icon.Home,
    roles: ALL_ROLES,
    end: true,
  },
  {
    to: '/manufacturer/notifications',
    label: 'Notifications',
    Icon: Icon.Bell,
    roles: ALL_ROLES,
    badgeKey: 'unread',
  },
  {
    to: '/manufacturer/products',
    label: 'Products',
    Icon: Icon.Products,
    roles: ALL_ROLES,
  },
  {
    to: '/manufacturer/batches',
    label: 'Batches',
    Icon: Icon.Batches,
    roles: ALL_ROLES,
  },
  {
    to: '/manufacturer/new-batch',
    label: 'Create Batch',
    Icon: Icon.Plus,
    roles: ['OWNER', 'ADMIN', 'GENERATION_OFFICER'],
  },
  {
    to: '/manufacturer/activation',
    label: 'Activation Queue',
    Icon: Icon.Activation,
    roles: ['OWNER', 'ADMIN', 'ACTIVATION_OFFICER', 'SUPERVISOR'],
  },
  {
    to: '/manufacturer/shipments',
    label: 'Shipments',
    Icon: Icon.Shipments,
    roles: ['OWNER', 'ADMIN', 'SHIPPING_OFFICER', 'SUPERVISOR'],
  },
  {
    to: '/manufacturer/reconciliation',
    label: 'Reconciliation',
    Icon: Icon.Reconciliation,
    roles: ALL_ROLES,
  },
  {
    to: '/manufacturer/recalls',
    label: 'Recalls',
    Icon: Icon.Recalls,
    roles: ['OWNER', 'ADMIN', 'SUPERVISOR'],
  },
  {
    to: '/manufacturer/staff',
    label: 'Staff',
    Icon: Icon.Staff,
    roles: ['OWNER', 'ADMIN', 'SUPERVISOR'],
  },
];

// ============================================================
// LAYOUT
// ============================================================
const ManufacturerLayout = () => {
  const { manufacturer, staff } = useOutletContext();
  const navigate = useNavigate();
  const [unreadCount, setUnreadCount] = useState(0);

  const displayName =
    staff?.fullName || staff?.name || staff?.email || 'Staff';
  const displayEmail = staff?.email || '';
  const displayRole = staff?.role || 'VIEWER';
  const initials =
    displayName
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0].toUpperCase())
      .join('') || 'M';
  const roleLabel =
    ROLE_LABELS[displayRole] || displayRole.replace(/_/g, ' ');

  useEffect(() => {
    let cancelled = false;

    const check = async () => {
      try {
        const list = await fetchUnreadNotifications(
          staff?.firebaseUid || staff?.id,
          displayEmail
        );
        if (!cancelled) setUnreadCount(list.length);
      } catch (err) {
        if (!cancelled) setUnreadCount(0);
      }
    };

    check();
    const interval = setInterval(check, 30000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [staff?.firebaseUid, staff?.id, displayEmail]);

  const handleLogout = async () => {
    await logoutManufacturer();
    navigate('/manufacturer/login', { replace: true });
  };

  const visibleNav = NAV.filter((item) =>
    item.roles.includes(displayRole)
  );

  return (
    <div className="mf-portal-shell">
      {/* ============================================================
          UNIFIED HEADER
          ============================================================ */}
      <Header sticky />

      {/* ============================================================
          IDENTITY STRIP
          ============================================================ */}
      <div className="mf-identity-strip">
        <div className="mf-identity-left">
          <span className="mf-identity-dot" />
          <div className="mf-identity-text">
            <strong>{manufacturer?.companyName || 'Manufacturer'}</strong>
            <span>{roleLabel} workspace</span>
          </div>
        </div>
        <button className="mf-identity-logout" onClick={handleLogout}>
          <Icon.Logout width="16" height="16" />
          Sign out
        </button>
      </div>

      {/* ============================================================
          MAIN LAYOUT: sidebar + content
          ============================================================ */}
      <div className="mf-portal">
        <aside className="mf-sidebar">
          <nav className="mf-sidebar-nav">
            {visibleNav.map(({ to, label, Icon: Ico, end, badgeKey }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) =>
                  `mf-nav-item ${isActive ? 'active' : ''}`
                }
              >
                <Ico width="18" height="18" />
                <span>{label}</span>
                {badgeKey === 'unread' && unreadCount > 0 && (
                  <span className="mf-nav-badge">
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                )}
              </NavLink>
            ))}
          </nav>

          <div className="mf-sidebar-footer">
            <div className="mf-sidebar-user">
              <div className="mf-sidebar-avatar">{initials}</div>
              <div className="mf-sidebar-user-text">
                <strong>{displayName}</strong>
                <span>{displayEmail}</span>
              </div>
            </div>
            <button className="mf-logout" onClick={handleLogout}>
              <Icon.Logout width="16" height="16" />
              Sign out
            </button>
          </div>
        </aside>

        <main className="mf-main">
          <Outlet context={{ manufacturer, staff }} />
        </main>
      </div>
    </div>
  );
};

export default ManufacturerLayout;