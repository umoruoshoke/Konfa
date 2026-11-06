// src/seller/SellerLayout.jsx
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { logoutSeller } from './sellerAuth';
import Header from '../components/Header';
import './SellerPortal.css';

const Icon = {
  Home: (p) => (
    <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 10l9-7 9 7v10a2 2 0 01-2 2h-4v-7h-6v7H5a2 2 0 01-2-2z" strokeLinejoin="round" />
    </svg>
  ),
  Scan: (p) => (
    <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 7V5a2 2 0 012-2h2M17 3h2a2 2 0 012 2v2M21 17v2a2 2 0 01-2 2h-2M7 21H5a2 2 0 01-2-2v-2M7 12h10" strokeLinecap="round" />
    </svg>
  ),
  Shipments: (p) => (
    <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 7l9-4 9 4-9 4-9-4zM3 12l9 4 9-4M3 17l9 4 9-4" strokeLinejoin="round" />
    </svg>
  ),
  Transfers: (p) => (
    <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M7 7h11l-3-3M17 17H6l3 3M4 12h16" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  Verify: (p) => (
    <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 3l8 3v6c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10V6l8-3z" strokeLinejoin="round" />
      <path d="M9 12l2 2 4-4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  Logout: (p) => (
    <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
};

const SellerLayout = ({ seller }) => {
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logoutSeller();
    navigate('/seller/login', { replace: true });
  };

  const sellerName = seller?.companyName || 'Seller';
  const sellerRole = seller?.role
    ? seller.role.charAt(0).toUpperCase() + seller.role.slice(1)
    : 'Seller';

  return (
    <div className="seller-portal">
      {/* ============================================================
          UNIFIED HEADER
          ============================================================ */}
      <Header sticky />

      {/* ============================================================
          SELLER IDENTITY STRIP
          ============================================================ */}
      <div className="seller-identity-strip">
        <div className="seller-identity-left">
          <span className="seller-identity-dot" />
          <div className="seller-identity-text">
            <strong>{sellerName}</strong>
            <span>{sellerRole} workspace</span>
          </div>
        </div>
        <button className="seller-identity-logout" onClick={handleLogout}>
          <Icon.Logout width="16" height="16" />
          Log out
        </button>
      </div>

      {/* ============================================================
          MAIN CONTENT
          ============================================================ */}
      <main className="seller-main">
        <Outlet context={{ seller }} />
      </main>

      {/* ============================================================
          BOTTOM NAV
          ============================================================ */}
      <nav className="seller-bottomnav">
        <NavLink to="/seller/home" className="seller-nav-item">
          <Icon.Home width="22" height="22" />
          <span>Home</span>
        </NavLink>
        <NavLink to="/seller/scan" className="seller-nav-item">
          <Icon.Scan width="22" height="22" />
          <span>Scan</span>
        </NavLink>
        <NavLink to="/seller/receive" className="seller-nav-item">
          <Icon.Shipments width="22" height="22" />
          <span>Shipments</span>
        </NavLink>
        <NavLink to="/seller/transfer" className="seller-nav-item">
          <Icon.Transfers width="22" height="22" />
          <span>Transfers</span>
        </NavLink>
        <NavLink to="/seller/verification" className="seller-nav-item">
          <Icon.Verify width="22" height="22" />
          <span>Verify</span>
        </NavLink>
      </nav>
    </div>
  );
};

export default SellerLayout;