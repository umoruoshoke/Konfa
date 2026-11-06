// src/admin/AdminLayout.jsx
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { logoutAdmin } from './adminAuth';
import './AdminPortal.css';

const Icon = {
  Dashboard: (p) => (
    <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="3" width="7" height="9" rx="1.5" />
      <rect x="14" y="3" width="7" height="5" rx="1.5" />
      <rect x="14" y="12" width="7" height="9" rx="1.5" />
      <rect x="3" y="16" width="7" height="5" rx="1.5" />
    </svg>
  ),
  Applications: (p) => (
    <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" strokeLinejoin="round" />
      <path d="M14 2v6h6M9 13h6M9 17h6" strokeLinecap="round" />
    </svg>
  ),
  Factory: (p) => (
    <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 21V9l6 4V9l6 4V3h6v18H3z" strokeLinejoin="round" />
      <path d="M7 17h.01M12 17h.01M17 17h.01" strokeLinecap="round" />
    </svg>
  ),
  Sellers: (p) => (
    <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="9" cy="8" r="4" />
      <path d="M2 21c0-4 3.5-7 8-7s8 3 8 7M17 11a4 4 0 100-8M22 21c0-3-2-6-5-7" strokeLinecap="round" />
    </svg>
  ),
  Admins: (p) => (
    <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 2l8 4v6c0 5-3.5 9-8 10-4.5-1-8-5-8-10V6z" strokeLinejoin="round" />
      <path d="M9 12l2 2 4-4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  Audit: (p) => (
    <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M4 6h16M4 12h16M4 18h16" strokeLinecap="round" />
      <circle cx="8" cy="6" r="1.5" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none" />
      <circle cx="16" cy="18" r="1.5" fill="currentColor" stroke="none" />
    </svg>
  ),
  Analytics: (p) => (
    <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 3v18h18" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M7 15l4-4 3 3 5-6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  Predict: (p) => (
    <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="3.5" />
      <path
        d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1"
        strokeLinecap="round"
      />
    </svg>
  ),
  Alert: (p) => (
    <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M10.3 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.7 3.86a2 2 0 00-3.4 0z" strokeLinejoin="round" />
      <path d="M12 9v4M12 17h.01" strokeLinecap="round" />
    </svg>
  ),
  // Verify — shield with a checkmark, for the seller-verifications tab
  Verify: (p) => (
    <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 3l8 3v6c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10V6l8-3z" strokeLinejoin="round" />
      <path d="M9 12l2 2 4-4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  // VerifiedSellers — ribbon/medal badge, for the verified-sellers tab
  VerifiedSellers: (p) => (
    <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="9" r="6" />
      <path d="M9 12l2 2 4-4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M8.5 14.5L7 22l5-3 5 3-1.5-7.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  // 🆕 BrandVerify — shield with a star, for the pending brand verifications tab
  BrandVerify: (p) => (
    <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 3l8 3v6c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10V6l8-3z" strokeLinejoin="round" />
      <path
        d="M12 8l1.2 2.4 2.6.4-1.9 1.85.45 2.6L12 14.05l-2.35 1.2.45-2.6L8.2 10.8l2.6-.4L12 8z"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  ),
  // 🆕 BrandVerified — badge with a checkmark, for the verified brands tab
  BrandVerified: (p) => (
    <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 8l4-5h10l4 5-9 13L3 8z" strokeLinejoin="round" />
      <path d="M3 8h18" strokeLinecap="round" />
      <path d="M9 12l2 2 4-4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
};

const KonfaAdminMark = ({ className = '' }) => (
  <svg className={className} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="adminMark" x1="0" y1="0" x2="48" y2="48" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#14b8a6" />
        <stop offset="100%" stopColor="#0d9488" />
      </linearGradient>
    </defs>
    <path d="M24 3L6 10v12c0 10.5 7.5 20 18 23 10.5-3 18-12.5 18-23V10L24 3z" fill="#0a1628" />
    <path d="M24 3L6 10v12c0 10.5 7.5 20 18 23 10.5-3 18-12.5 18-23V10L24 3z" stroke="url(#adminMark)" strokeWidth="2.5" strokeLinejoin="round" fill="none" />
    <path d="M17 15v18M17 24l10-9M17 24l10 9" stroke="url(#adminMark)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const AdminLayout = ({ admin }) => {
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logoutAdmin();
    navigate('/admin/login', { replace: true });
  };

  const NAV = [
    { to: '/admin/dashboard',                 label: 'Dashboard',              Icon: Icon.Dashboard,   end: true },
    { to: '/admin/sellers',                   label: 'Seller Approvals',       Icon: Icon.Applications },
    { to: '/admin/manufacturer-applications', label: 'Mfr Approvals',          Icon: Icon.Applications },
    { to: '/admin/active',                    label: 'Sellers',                Icon: Icon.Sellers },
    { to: '/admin/manufacturers',             label: 'Manufacturers',          Icon: Icon.Factory },
    // Seller verification workspace — grouped by seller, all 3 levels
    { to: '/admin/seller-verifications',      label: 'Pending Seller Verifications',   Icon: Icon.Verify },
    // Verified sellers directory — permanent record of approved sellers
    { to: '/admin/verified-sellers',          label: 'Verified Sellers',       Icon: Icon.VerifiedSellers },
    // 🆕 Brand verification workspace — grouped by brand
    { to: '/admin/brand-verifications',       label: 'Pending Brand Verifications',   Icon: Icon.BrandVerify },
    // 🆕 Verified brands directory — permanent record of approved brands
    { to: '/admin/verified-brands',           label: 'Verified Brands',        Icon: Icon.BrandVerified },
    { to: '/admin/users',                     label: 'Admins',                 Icon: Icon.Admins },
    { to: '/admin/audit',                     label: 'Audit Log',              Icon: Icon.Audit },
    { to: '/admin/scan-analytics',            label: 'Scan Analytics',         Icon: Icon.Analytics },
    { to: '/admin/scan-predictions',          label: 'AI Predictions',         Icon: Icon.Predict },
    { to: '/admin/suspicious',                label: 'Suspicious',             Icon: Icon.Alert },
  ];

  return (
    <div className="admin-portal">
      <aside className="admin-sidebar">
        <div className="admin-sidebar-brand">
          <KonfaAdminMark className="admin-sidebar-mark" />
          <div>
            <strong>Konfa Admin</strong>
            <span>Control Center</span>
          </div>
        </div>

        <nav className="admin-sidebar-nav">
          {NAV.map(({ to, label, Icon: Ico, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `admin-nav-item ${isActive ? 'active' : ''}`
              }
            >
              <Ico width="20" height="20" />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="admin-sidebar-footer">
          <div className="admin-sidebar-user">
            <div className="admin-sidebar-avatar">
              {admin?.fullName?.[0]?.toUpperCase() || 'A'}
            </div>
            <div className="admin-sidebar-user-text">
              <strong>{admin?.fullName || 'Admin'}</strong>
              <span>{admin?.role || 'admin'}</span>
            </div>
          </div>
          <button className="admin-logout" onClick={handleLogout}>
            Log out
          </button>
        </div>
      </aside>

      <main className="admin-main">
        <Outlet context={{ admin }} />
      </main>
    </div>
  );
};

export default AdminLayout;