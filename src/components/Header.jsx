// src/components/Header.jsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import VaryfaiLogo from './VaryfaiLogo';
import {
  watchConsumerAuth,
  getCurrentConsumerProfile,
  signOutConsumer,
} from '../consumer/consumerAuth';
import './Header.css';

/* ============================================================
   Icons
   ============================================================ */
const IconChevronDown = (p) => (
  <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
    <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const IconChevronRight = (p) => (
  <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
    <path d="M9 18l6-6-6-6" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const IconChevronLeft = (p) => (
  <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
    <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const IconShieldCheck = (p) => (
  <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
    <path d="M12 2L3 7V12C3 17.55 6.84 22.74 12 24C17.16 22.74 21 17.55 21 12V7L12 2Z" strokeLinejoin="round" />
    <path d="M9 12L11 14L15 10" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const IconHome = (p) => (
  <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M3 10l9-7 9 7v10a2 2 0 01-2 2h-4v-7h-6v7H5a2 2 0 01-2-2z" strokeLinejoin="round" />
  </svg>
);
const IconInfo = (p) => (
  <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="12" cy="12" r="10" />
    <path d="M12 16v-4M12 8h.01" strokeLinecap="round" />
  </svg>
);
const IconBriefcase = (p) => (
  <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="3" y="7" width="18" height="14" rx="2" />
    <path d="M9 7V5a2 2 0 012-2h2a2 2 0 012 2v2M3 13h18" strokeLinecap="round" />
  </svg>
);
const IconFactory = (p) => (
  <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M3 21V9l6 4V9l6 4V3h6v18H3z" strokeLinejoin="round" />
    <path d="M7 17h.01M12 17h.01M17 17h.01" strokeLinecap="round" />
  </svg>
);
const IconPackage = (p) => (
  <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M21 8l-9-5-9 5v8l9 5 9-5V8z" strokeLinejoin="round" />
    <path d="M3 8l9 5 9-5M12 13v9" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const IconChat = (p) => (
  <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" strokeLinejoin="round" />
  </svg>
);
const IconQr = (p) => (
  <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="3" y="3" width="7" height="7" rx="1.5" />
    <rect x="14" y="3" width="7" height="7" rx="1.5" />
    <rect x="3" y="14" width="7" height="7" rx="1.5" />
    <path d="M14 14h3v3h-3zM20 14h1v1h-1zM14 20h1v1h-1zM18 20h3v1h-3z" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const IconX = (p) => (
  <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
    <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
  </svg>
);
const IconLogout = (p) => (
  <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const IconUser = (p) => (
  <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="12" cy="8" r="4" />
    <path d="M4 21c0-4 4-7 8-7s8 3 8 7" strokeLinecap="round" />
  </svg>
);
const IconHistory = (p) => (
  <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="12" cy="12" r="10" />
    <path d="M12 7v5l3 2" strokeLinecap="round" />
  </svg>
);
const IconBookmark = (p) => (
  <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M19 21l-7-4-7 4V5a2 2 0 012-2h10a2 2 0 012 2z" strokeLinejoin="round" />
  </svg>
);
const IconBell = (p) => (
  <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const IconBadge = (p) => (
  <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="12" cy="9" r="6" />
    <path d="M9 12l2 2 4-4" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M8.5 14.5L7 22l5-3 5 3-1.5-7.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const IconSettings = (p) => (
  <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 11-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 110-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 114 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 110 4h-.09a1.65 1.65 0 00-1.51 1z" strokeLinejoin="round" />
  </svg>
);

/* ============================================================
   BusinessMenu (desktop dropdown)
   ============================================================ */
const BusinessMenu = ({ onManufacturer, onSeller, onClose }) => {
  const ref = useRef(null);
  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  return (
    <div className="business-menu" ref={ref}>
      <div className="business-menu-header">Continue as…</div>
      <button className="business-menu-item" onClick={onManufacturer}>
        <span className="business-menu-icon">🏭</span>
        <span className="business-menu-text">
          <strong>Manufacturer</strong>
          <em>Generate and activate product codes</em>
        </span>
      </button>
      <button className="business-menu-item" onClick={onSeller}>
        <span className="business-menu-icon">📦</span>
        <span className="business-menu-text">
          <strong>Seller / Distributor</strong>
          <em>Scan, receive, and stock transfer</em>
        </span>
      </button>
    </div>
  );
};

/* ============================================================
   UserMenu (desktop dropdown)
   ============================================================ */
const UserMenu = ({ consumer, onNavigate, onSignOut, onClose }) => {
  const ref = useRef(null);
  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  const fullName = consumer.fullName || consumer.email || 'User';
  const initials =
    fullName
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0].toUpperCase())
      .join('') || 'U';

  return (
    <div className="nav-user-menu" ref={ref}>
      <div className="nav-user-menu-header">
        <div className="nav-user-menu-avatar">{initials}</div>
        <div className="nav-user-menu-identity">
          <strong>{fullName}</strong>
          {consumer.email && <span>{consumer.email}</span>}
        </div>
      </div>
      <div className="nav-user-menu-divider" />
      <button className="nav-user-menu-item" onClick={() => onNavigate('/consumer/home')}>
        <IconHome width="16" height="16" /><span>Dashboard</span>
      </button>
      <button className="nav-user-menu-item" onClick={() => onNavigate('/consumer/history')}>
        <IconHistory width="16" height="16" /><span>Scan History</span>
      </button>
      <button className="nav-user-menu-item" onClick={() => onNavigate('/consumer/saved')}>
        <IconBookmark width="16" height="16" /><span>Saved Products</span>
      </button>
      <button className="nav-user-menu-item" onClick={() => onNavigate('/consumer/alerts')}>
        <IconBell width="16" height="16" /><span>Alerts</span>
      </button>
      <button className="nav-user-menu-item" onClick={() => onNavigate('/consumer/profile')}>
        <IconUser width="16" height="16" /><span>Profile</span>
      </button>
      <div className="nav-user-menu-divider" />
      <button className="nav-user-menu-item nav-user-menu-signout" onClick={onSignOut}>
        <IconLogout width="16" height="16" /><span>Sign Out</span>
      </button>
    </div>
  );
};

/* ============================================================
   Header
   ============================================================ */
const Header = ({
  onNavigate,
  onScanRequest,
  variant = 'default',
  sticky = true,
}) => {
  const navigate = useNavigate();
  const location = useLocation();

  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [desktopBusinessOpen, setDesktopBusinessOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [mobileView, setMobileView] = useState(null);

  const [consumer, setConsumer] = useState(null);
  const [authReady, setAuthReady] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    document.body.style.overflow = mobileMenuOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [mobileMenuOpen]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') {
        if (mobileView) {
          setMobileView(null);
        } else {
          setDesktopBusinessOpen(false);
          setMobileMenuOpen(false);
          setUserMenuOpen(false);
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [mobileView]);

  useEffect(() => {
    let cancelled = false;
    const unsub = watchConsumerAuth(async (user) => {
      if (cancelled) return;
      if (!user) {
        setConsumer(null);
        setAuthReady(true);
        return;
      }
      let profile = null;
      try { profile = await getCurrentConsumerProfile(); } catch { /* ignore */ }
      if (cancelled) return;
      setConsumer(profile || null);
      setAuthReady(true);
    });
    return () => {
      cancelled = true;
      if (typeof unsub === 'function') unsub();
    };
  }, []);

  const closeAllMenus = useCallback(() => {
    setMobileMenuOpen(false);
    setDesktopBusinessOpen(false);
    setUserMenuOpen(false);
    setMobileView(null);
  }, []);

  const isHomePage = location.pathname === '/';

  const go = useCallback((path) => {
    closeAllMenus();
    try { navigate(path); } catch { window.location.href = path; }
  }, [closeAllMenus, navigate]);

  const scrollToSection = useCallback((sectionId) => {
    const headerOffset = 72;
    const el = document.getElementById(sectionId);
    if (el) {
      const top = el.getBoundingClientRect().top + window.scrollY - headerOffset;
      window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
      return true;
    }
    return false;
  }, []);

  const goToSection = useCallback((sectionId) => {
    closeAllMenus();
    if (isHomePage) {
      if (!scrollToSection(sectionId)) setTimeout(() => scrollToSection(sectionId), 150);
      return;
    }
    go('/');
    let tries = 0;
    const iv = setInterval(() => {
      tries += 1;
      if (scrollToSection(sectionId) || tries >= 20) clearInterval(iv);
    }, 150);
  }, [closeAllMenus, go, isHomePage, scrollToSection]);

  const goHome = useCallback(() => {
    closeAllMenus();
    if (isHomePage) window.scrollTo({ top: 0, behavior: 'smooth' });
    else go('/');
  }, [closeAllMenus, go, isHomePage]);

  const goAbout = useCallback(() => goToSection('about'), [goToSection]);
  const goContact = useCallback(() => goToSection('contact'), [goToSection]);
  const goVerify = useCallback(() => go('/verify'), [go]);
  const goSellerPortal = useCallback(() => go('/seller/login'), [go]);
  const goManufacturerPortal = useCallback(() => go('/manufacturer/login'), [go]);
  const goConsumerLogin = useCallback(() => go('/consumer/login'), [go]);
  const goBrandSignup = useCallback(() => go('/brand/signup'), [go]);
  const goBrandLogin = useCallback(() => go('/brand/login'), [go]);

  const handleScan = () => {
    closeAllMenus();
    if (typeof onScanRequest === 'function') onScanRequest();
    else go('/verify');
  };

  const goToConsumer = (path) => {
    setUserMenuOpen(false);
    setMobileMenuOpen(false);
    setMobileView(null);
    go(path);
  };

  const handleSignOut = async () => {
    try { await signOutConsumer(); } catch { /* ignore */ }
    setConsumer(null);
    setUserMenuOpen(false);
    setMobileMenuOpen(false);
    setMobileView(null);
    go('/');
  };

  const toggleDesktopBusiness = () => {
    setDesktopBusinessOpen((v) => !v);
    setUserMenuOpen(false);
  };

  const closeMobileMenu = () => {
    setMobileMenuOpen(false);
    setMobileView(null);
  };
  const openMobileMenu = () => {
    setMobileMenuOpen(true);
    setMobileView(null);
  };

  const consumerDisplayName = consumer?.fullName || consumer?.email || 'User';
  const consumerFirstName = consumerDisplayName.split(' ')[0];
  const consumerInitials =
    consumerDisplayName
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0].toUpperCase())
      .join('') || 'U';

  const headerClass = [
    'vf-header',
    sticky ? 'vf-header-sticky' : '',
    scrolled ? 'vf-header-scrolled' : '',
    mobileMenuOpen ? 'vf-header-open' : '',
    `vf-header-${variant}`,
  ].filter(Boolean).join(' ');

  return (
    <header className={headerClass}>
      <div className="vf-nav-container">
        {/* Brand */}
        <button
          type="button"
          className="vf-nav-brand"
          aria-label="Varyfai home"
          onClick={goHome}
        >
          <VaryfaiLogo height={32} className="vf-brand-logo" />
        </button>

        {/* Desktop nav */}
        <nav className="vf-nav-links" aria-label="Main">
          <button
            type="button"
            className={`vf-nav-link ${isHomePage ? 'active' : ''}`}
            onClick={goHome}
          >
            Home
          </button>
          <button type="button" className="vf-nav-link" onClick={goAbout}>
            About
          </button>

          <div className="vf-nav-link-wrapper">
            <button
              type="button"
              className={`vf-nav-link vf-nav-link-button ${desktopBusinessOpen ? 'open' : ''}`}
              onClick={toggleDesktopBusiness}
              aria-haspopup="menu"
              aria-expanded={desktopBusinessOpen}
            >
              Business
              <IconChevronDown width="12" height="12" />
            </button>
            {desktopBusinessOpen && (
              <BusinessMenu
                onManufacturer={goManufacturerPortal}
                onSeller={goSellerPortal}
                onClose={() => setDesktopBusinessOpen(false)}
              />
            )}
          </div>

          <button type="button" className="vf-nav-link" onClick={goContact}>
            Contact
          </button>
        </nav>

        {/* Actions */}
        <div className="vf-nav-actions">
          {/* Desktop-only */}
          <button
            className="vf-nav-brand-verify vf-desktop-only"
            onClick={goBrandSignup}
          >
            <IconBadge width="16" height="16" />
            Get your Brand verified
          </button>

          {authReady && consumer ? (
            <>
              <button className="vf-nav-cta vf-desktop-only" onClick={goVerify}>
                <IconShieldCheck width="16" height="16" />
                Verify a Product
              </button>

              <div className="vf-nav-user-wrapper vf-desktop-only">
                <button
                  type="button"
                  className={`vf-nav-user-chip ${userMenuOpen ? 'open' : ''}`}
                  onClick={() => setUserMenuOpen((v) => !v)}
                  aria-haspopup="menu"
                  aria-expanded={userMenuOpen}
                >
                  <span className="vf-nav-user-avatar">{consumerInitials}</span>
                  <span className="vf-nav-user-chip-text">
                    <strong>{consumerFirstName}</strong>
                    <em>Signed in</em>
                  </span>
                  <IconChevronDown width="14" height="14" />
                </button>
                {userMenuOpen && (
                  <UserMenu
                    consumer={consumer}
                    onNavigate={goToConsumer}
                    onSignOut={handleSignOut}
                    onClose={() => setUserMenuOpen(false)}
                  />
                )}
              </div>
            </>
          ) : (
            <>
              <button className="vf-nav-signin vf-desktop-only" onClick={goConsumerLogin}>
                Sign in
              </button>
              <button className="vf-nav-cta vf-desktop-only" onClick={handleScan}>
                <IconQr width="16" height="16" />
                Scan QR
              </button>
            </>
          )}

          {/* Mobile-only */}
          <button
            type="button"
            className="vf-mobile-icon-btn vf-mobile-only"
            onClick={goBrandSignup}
            aria-label="Get your Brand verified"
            title="Get your Brand verified"
          >
            <IconBadge width="20" height="20" />
          </button>

          <button
            type="button"
            className="vf-mobile-icon-btn vf-mobile-icon-btn-primary vf-mobile-only"
            onClick={handleScan}
            aria-label="Scan QR code"
            title="Scan QR code"
          >
            <IconQr width="20" height="20" />
          </button>

          <button
            type="button"
            className={`vf-mobile-menu-btn vf-mobile-only ${mobileMenuOpen ? 'open' : ''}`}
            onClick={() => (mobileMenuOpen ? closeMobileMenu() : openMobileMenu())}
            aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={mobileMenuOpen}
          >
            <span></span>
            <span></span>
            <span></span>
          </button>
        </div>
      </div>

      {/* ============================================================
          MOBILE MENU
          ============================================================ */}
      <div className={`vf-mobile-menu ${mobileMenuOpen ? 'open' : ''}`}>
        <div className="vf-mobile-menu-inner">
          <div className="vf-mobile-menu-header">
            <div className="vf-mobile-menu-top">
              {mobileView === null ? (
                <>
                  <div className="vf-mobile-menu-brand">
                    <VaryfaiLogo height={28} className="vf-mobile-menu-logo" />
                  </div>
                  <button
                    type="button"
                    className="vf-mobile-menu-close"
                    onClick={closeMobileMenu}
                    aria-label="Close menu"
                  >
                    <IconX width="20" height="20" />
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    className="vf-mobile-menu-back"
                    onClick={() => setMobileView(null)}
                    aria-label="Back to menu"
                  >
                    <IconChevronLeft width="22" height="22" />
                    <span>Back</span>
                  </button>
                  <span className="vf-mobile-menu-layer-title">
                    {mobileView === 'business'
                      ? 'Business'
                      : mobileView === 'account'
                      ? 'My Account'
                      : ''}
                  </span>
                  <button
                    type="button"
                    className="vf-mobile-menu-close"
                    onClick={closeMobileMenu}
                    aria-label="Close menu"
                  >
                    <IconX width="20" height="20" />
                  </button>
                </>
              )}
            </div>
          </div>

          <div className="vf-mobile-menu-slider">
            {/* PRIMARY LAYER */}
            <div className={`vf-mobile-layer ${mobileView === null ? 'active' : 'left'}`}>
              <div className="vf-mobile-menu-body">
                <div className="vf-mobile-menu-section-label">Main</div>

                <button
                  className={`vf-mobile-nav-link ${isHomePage ? 'active' : ''}`}
                  onClick={goHome}
                >
                  <span className="vf-mobile-nav-icon"><IconHome width="22" height="22" /></span>
                  <span className="vf-mobile-nav-text">
                    <strong>Home</strong>
                    <em>Back to the top</em>
                  </span>
                  <span className="vf-mobile-nav-chevron"><IconChevronRight width="20" height="20" /></span>
                </button>

                <button className="vf-mobile-nav-link" onClick={goAbout}>
                  <span className="vf-mobile-nav-icon"><IconInfo width="22" height="22" /></span>
                  <span className="vf-mobile-nav-text">
                    <strong>About</strong>
                    <em>How Varyfai works</em>
                  </span>
                  <span className="vf-mobile-nav-chevron"><IconChevronRight width="20" height="20" /></span>
                </button>

                <button className="vf-mobile-nav-link" onClick={goVerify}>
                  <span className="vf-mobile-nav-icon"><IconShieldCheck width="22" height="22" /></span>
                  <span className="vf-mobile-nav-text">
                    <strong>Verify a Product</strong>
                    <em>Check any Varyfai product</em>
                  </span>
                  <span className="vf-mobile-nav-chevron"><IconChevronRight width="20" height="20" /></span>
                </button>

                <button className="vf-mobile-nav-link" onClick={handleScan}>
                  <span className="vf-mobile-nav-icon"><IconQr width="22" height="22" /></span>
                  <span className="vf-mobile-nav-text">
                    <strong>Scan QR Code</strong>
                    <em>Use your camera</em>
                  </span>
                  <span className="vf-mobile-nav-chevron"><IconChevronRight width="20" height="20" /></span>
                </button>

                <div className="vf-mobile-menu-section-label">For Brands</div>

                <button className="vf-mobile-nav-link" onClick={goBrandSignup}>
                  <span className="vf-mobile-nav-icon"><IconBadge width="22" height="22" /></span>
                  <span className="vf-mobile-nav-text">
                    <strong>Get your Brand verified</strong>
                    <em>For public figures &amp; brands</em>
                  </span>
                  <span className="vf-mobile-nav-chevron"><IconChevronRight width="20" height="20" /></span>
                </button>

                <button className="vf-mobile-nav-link" onClick={goBrandLogin}>
                  <span className="vf-mobile-nav-icon"><IconUser width="22" height="22" /></span>
                  <span className="vf-mobile-nav-text">
                    <strong>Brand sign in</strong>
                    <em>Continue your verification</em>
                  </span>
                  <span className="vf-mobile-nav-chevron"><IconChevronRight width="20" height="20" /></span>
                </button>

                <div className="vf-mobile-menu-section-label">For Business</div>

                <button
                  className="vf-mobile-nav-link"
                  onClick={() => setMobileView('business')}
                >
                  <span className="vf-mobile-nav-icon"><IconBriefcase width="22" height="22" /></span>
                  <span className="vf-mobile-nav-text">
                    <strong>Business Portals</strong>
                    <em>Manufacturers &amp; sellers</em>
                  </span>
                  <span className="vf-mobile-nav-chevron"><IconChevronRight width="20" height="20" /></span>
                </button>

                {authReady && consumer && (
                  <>
                    <div className="vf-mobile-menu-section-label">My Account</div>
                    <button
                      className="vf-mobile-nav-link"
                      onClick={() => setMobileView('account')}
                    >
                      <span className="vf-mobile-nav-icon"><IconUser width="22" height="22" /></span>
                      <span className="vf-mobile-nav-text">
                        <strong>My Account</strong>
                        <em>{consumerFirstName}</em>
                      </span>
                      <span className="vf-mobile-nav-chevron"><IconChevronRight width="20" height="20" /></span>
                    </button>
                  </>
                )}

                <div className="vf-mobile-menu-section-label">Support</div>

                <button className="vf-mobile-nav-link" onClick={goContact}>
                  <span className="vf-mobile-nav-icon"><IconChat width="22" height="22" /></span>
                  <span className="vf-mobile-nav-text">
                    <strong>Contact</strong>
                    <em>Get in touch</em>
                  </span>
                  <span className="vf-mobile-nav-chevron"><IconChevronRight width="20" height="20" /></span>
                </button>
              </div>

              <div className="vf-mobile-menu-footer">
                {authReady && consumer ? (
                  <>
                    <button className="vf-mobile-cta" onClick={goVerify}>
                      <IconShieldCheck width="20" height="20" />
                      Verify a Product
                    </button>
                    <button className="vf-mobile-signout" onClick={handleSignOut}>
                      <IconLogout width="18" height="18" />
                      Sign Out
                    </button>
                  </>
                ) : (
                  <>
                    <button className="vf-mobile-signin" onClick={goConsumerLogin}>
                      Sign in
                    </button>
                    <button className="vf-mobile-cta" onClick={handleScan}>
                      <IconQr width="20" height="20" />
                      Scan a Product
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* BUSINESS SUB-VIEW */}
            <div className={`vf-mobile-layer ${mobileView === 'business' ? 'active' : 'right'}`}>
              <div className="vf-mobile-menu-body">
                <div className="vf-mobile-menu-section-label">Continue as…</div>

                <button className="vf-mobile-nav-link" onClick={goManufacturerPortal}>
                  <span className="vf-mobile-nav-icon"><IconFactory width="22" height="22" /></span>
                  <span className="vf-mobile-nav-text">
                    <strong>Manufacturer</strong>
                    <em>Generate and activate product codes</em>
                  </span>
                  <span className="vf-mobile-nav-chevron"><IconChevronRight width="20" height="20" /></span>
                </button>

                <button className="vf-mobile-nav-link" onClick={goSellerPortal}>
                  <span className="vf-mobile-nav-icon"><IconPackage width="22" height="22" /></span>
                  <span className="vf-mobile-nav-text">
                    <strong>Seller / Distributor</strong>
                    <em>Scan, receive, and transfer stock</em>
                  </span>
                  <span className="vf-mobile-nav-chevron"><IconChevronRight width="20" height="20" /></span>
                </button>

                <div className="vf-mobile-menu-section-label">Also</div>

                <button className="vf-mobile-nav-link" onClick={goBrandSignup}>
                  <span className="vf-mobile-nav-icon"><IconBadge width="22" height="22" /></span>
                  <span className="vf-mobile-nav-text">
                    <strong>Get your Brand verified</strong>
                    <em>For public figures &amp; brands</em>
                  </span>
                  <span className="vf-mobile-nav-chevron"><IconChevronRight width="20" height="20" /></span>
                </button>
              </div>

              <div className="vf-mobile-menu-footer">
                <button className="vf-mobile-cta" onClick={goManufacturerPortal}>
                  <IconShieldCheck width="20" height="20" />
                  Manufacturer login
                </button>
                <button
                  className="vf-mobile-signout vf-mobile-signout-neutral"
                  onClick={goSellerPortal}
                >
                  <IconPackage width="18" height="18" />
                  Seller login
                </button>
              </div>
            </div>

            {/* ACCOUNT SUB-VIEW */}
            <div className={`vf-mobile-layer ${mobileView === 'account' ? 'active' : 'right'}`}>
              <div className="vf-mobile-menu-body">
                {authReady && consumer && (
                  <div className="vf-mobile-user-card">
                    <div className="vf-mobile-user-card-avatar">{consumerInitials}</div>
                    <div className="vf-mobile-user-card-text">
                      <strong>{consumerDisplayName}</strong>
                      {consumer.email && <span>{consumer.email}</span>}
                    </div>
                  </div>
                )}

                <div className="vf-mobile-menu-section-label">Shortcuts</div>

                <button className="vf-mobile-nav-link" onClick={() => goToConsumer('/consumer/home')}>
                  <span className="vf-mobile-nav-icon"><IconHome width="22" height="22" /></span>
                  <span className="vf-mobile-nav-text"><strong>Dashboard</strong><em>Your summary</em></span>
                  <span className="vf-mobile-nav-chevron"><IconChevronRight width="20" height="20" /></span>
                </button>

                <button className="vf-mobile-nav-link" onClick={() => goToConsumer('/consumer/history')}>
                  <span className="vf-mobile-nav-icon"><IconHistory width="22" height="22" /></span>
                  <span className="vf-mobile-nav-text"><strong>Scan History</strong><em>Every verification</em></span>
                  <span className="vf-mobile-nav-chevron"><IconChevronRight width="20" height="20" /></span>
                </button>

                <button className="vf-mobile-nav-link" onClick={() => goToConsumer('/consumer/saved')}>
                  <span className="vf-mobile-nav-icon"><IconBookmark width="22" height="22" /></span>
                  <span className="vf-mobile-nav-text"><strong>Saved Products</strong><em>Bookmarked items</em></span>
                  <span className="vf-mobile-nav-chevron"><IconChevronRight width="20" height="20" /></span>
                </button>

                <button className="vf-mobile-nav-link" onClick={() => goToConsumer('/consumer/alerts')}>
                  <span className="vf-mobile-nav-icon"><IconBell width="22" height="22" /></span>
                  <span className="vf-mobile-nav-text"><strong>Alerts</strong><em>Notifications</em></span>
                  <span className="vf-mobile-nav-chevron"><IconChevronRight width="20" height="20" /></span>
                </button>

                <button className="vf-mobile-nav-link" onClick={() => goToConsumer('/consumer/profile')}>
                  <span className="vf-mobile-nav-icon"><IconSettings width="22" height="22" /></span>
                  <span className="vf-mobile-nav-text"><strong>Profile</strong><em>Account settings</em></span>
                  <span className="vf-mobile-nav-chevron"><IconChevronRight width="20" height="20" /></span>
                </button>
              </div>

              <div className="vf-mobile-menu-footer">
                <button className="vf-mobile-cta" onClick={goVerify}>
                  <IconShieldCheck width="20" height="20" />
                  Verify a Product
                </button>
                <button className="vf-mobile-signout" onClick={handleSignOut}>
                  <IconLogout width="18" height="18" />
                  Sign Out
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div
        className={`vf-mobile-backdrop ${mobileMenuOpen ? 'open' : ''}`}
        onClick={closeMobileMenu}
      />
    </header>
  );
};

export default Header;