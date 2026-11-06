// src/brand/BrandVerificationHome.jsx
import { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { useOutletContext, useNavigate } from 'react-router-dom';
import { fetchMyBrandVerification } from './brandVerificationApi';
import { signOutBrand } from './brandAuth';
import BrandOwnerStep from './BrandOwnerStep';
import BrandSocialStep from './BrandSocialStep';
import BrandPublishStep from './BrandPublishStep';
import Header from '../components/Header';
import './BrandPortal.css';

const IconLogout = (p) => (
  <svg
    {...p}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
  >
    <path
      d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const BrandVerificationHome = () => {
  const { brand } = useOutletContext();
  const navigate = useNavigate();

  const [verification, setVerification] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState('owner');

  // ── Toast state lives here so it survives onReload ──
  const [toast, setToast] = useState(null);
  const toastTimerRef = useRef(null);

  const showToast = useCallback((next, autoDismissMs = 5000) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast(next);
    if (autoDismissMs > 0) {
      toastTimerRef.current = setTimeout(() => setToast(null), autoDismissMs);
    }
  }, []);

  const dismissToast = useCallback(() => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast(null);
  }, []);

  useEffect(
    () => () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    },
    []
  );

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const v = await fetchMyBrandVerification();
      setVerification(v);
    } catch (err) {
      console.error('Failed to load brand verification:', err);
      setError(err.message || 'Could not load your verification status.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleLogout = async () => {
    try {
      await signOutBrand();
    } catch {
      /* ignore */
    }
    navigate('/brand/login', { replace: true });
  };

  const progress = useMemo(() => {
    if (!verification) {
      return {
        owner: false,
        social: false,
        published: false,
        verifiedCount: 0,
        completed: 0,
        total: 3,
        percent: 0,
        label: 'Not started',
      };
    }

    const owner = verification.owner?.status === 'verified';
    const accounts = verification.accounts || {};
    const verifiedCount = Object.values(accounts).filter(
      (a) => a.status === 'verified'
    ).length;
    const social = verifiedCount > 0;
    const published = verification.publicProfile?.enabled;

    const completed = [owner, social, published].filter(Boolean).length;
    const total = 3;
    const percent = Math.round((completed / total) * 100);

    let label = 'Not started';
    if (completed === total) label = 'Fully verified';
    else if (completed >= 1) label = 'Getting verified';

    return {
      owner,
      social,
      published,
      verifiedCount,
      completed,
      total,
      percent,
      label,
    };
  }, [verification]);

  const brandName = brand?.displayName || 'Your brand';

  return (
    <div className="brand-portal-shell">
      <Header sticky />

      <div className="brand-identity-strip">
        <div className="brand-identity-left">
          <span className="brand-identity-dot" />
          <div className="brand-identity-text">
            <strong>{brandName}</strong>
            <span>Brand verification workspace</span>
          </div>
        </div>
        <button className="brand-identity-logout" onClick={handleLogout}>
          <IconLogout width="16" height="16" />
          Sign out
        </button>
      </div>

      <div className="brand-page">
        {loading ? (
          <div className="brand-loading">
            <div className="brand-spinner" />
            <p>Loading your brand verification…</p>
          </div>
        ) : (
          <>
            <header className="brand-hero">
              <div className="brand-hero-inner">
                <div className="brand-hero-text">
                  <div className="brand-hero-badge">
                    <span className="brand-hero-badge-dot" />
                    Brand verification
                  </div>
                  <h1>{brandName}</h1>
                  <p>
                    Verify your identity and link your official social accounts
                    so customers, followers, and partners can confirm
                    they&apos;re dealing with the real you.
                  </p>
                </div>

                <div className="brand-hero-status">
                  <div className="brand-hero-ring">
                    <svg viewBox="0 0 100 100">
                      <circle
                        cx="50"
                        cy="50"
                        r="42"
                        fill="none"
                        stroke="rgba(255,255,255,0.15)"
                        strokeWidth="8"
                      />
                      <circle
                        cx="50"
                        cy="50"
                        r="42"
                        fill="none"
                        stroke="#14b8a6"
                        strokeWidth="8"
                        strokeLinecap="round"
                        strokeDasharray={`${(progress.percent / 100) * 264} 264`}
                        transform="rotate(-90 50 50)"
                      />
                    </svg>
                    <div className="brand-hero-ring-label">
                      <strong>{progress.percent}%</strong>
                      <span>complete</span>
                    </div>
                  </div>
                  <div className="brand-hero-status-text">
                    <strong>{progress.label}</strong>
                    <span>
                      {progress.completed} of {progress.total} steps
                    </span>
                  </div>
                </div>
              </div>
            </header>

            {error && <div className="brand-error">{error}</div>}

            <div className="brand-stepper">
              <BrandStep
                index={1}
                title="Owner"
                subtitle="Your identity"
                done={progress.owner}
                active={tab === 'owner'}
                onClick={() => setTab('owner')}
              />
              <BrandStep
                index={2}
                title="Social accounts"
                subtitle={
                  progress.verifiedCount > 0
                    ? `${progress.verifiedCount} linked`
                    : 'Link accounts'
                }
                done={progress.social}
                active={tab === 'social'}
                onClick={() => setTab('social')}
              />
              <BrandStep
                index={3}
                title="Publish"
                subtitle="Public page"
                done={progress.published}
                active={tab === 'publish'}
                onClick={() => setTab('publish')}
              />
            </div>

            <main className="brand-main">
              <div className="brand-tab-panel" key={tab}>
                {tab === 'owner' && (
                  <BrandOwnerStep
                    verification={verification}
                    brand={brand}
                    onReload={load}
                    onNext={() => setTab('social')}
                  />
                )}
                {tab === 'social' && (
                  <BrandSocialStep
                    verification={verification}
                    onReload={load}
                    onBack={() => setTab('owner')}
                    onNext={() => setTab('publish')}
                  />
                )}
                {tab === 'publish' && (
                  <BrandPublishStep
                    verification={verification}
                    onReload={load}
                    onBack={() => setTab('social')}
                    showToast={showToast}
                  />
                )}
              </div>
            </main>
          </>
        )}
      </div>

      {/* Toast lives at the top level so it survives onReload */}
      <BrandToast toast={toast} onDismiss={dismissToast} />
    </div>
  );
};

// -------------------------------------------------------------------
// Toast component (now rendered by BrandVerificationHome)
// -------------------------------------------------------------------
const BrandToast = ({ toast, onDismiss }) => {
  if (!toast) return null;

  const palette =
    toast.kind === 'success'
      ? { bg: '#ecfdf5', border: '#10b981', icon: '✓', text: '#065f46' }
      : toast.kind === 'warning'
        ? { bg: '#fffbeb', border: '#f59e0b', icon: '!', text: '#92400e' }
        : { bg: '#fef2f2', border: '#ef4444', icon: '✕', text: '#991b1b' };

  return (
    <div
      className="brand-toast"
      role={toast.kind === 'error' ? 'alert' : 'status'}
      aria-live={toast.kind === 'error' ? 'assertive' : 'polite'}
      style={{
        position: 'fixed',
        top: 24,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 9999,
        maxWidth: 460,
        width: 'calc(100% - 32px)',
        background: palette.bg,
        border: `1px solid ${palette.border}`,
        borderLeft: `4px solid ${palette.border}`,
        borderRadius: 10,
        padding: '14px 16px',
        boxShadow: '0 12px 32px rgba(15, 23, 42, 0.12)',
        display: 'flex',
        alignItems: 'flex-start',
        gap: 12,
        animation: 'brandToastIn 180ms ease-out',
      }}
    >
      <span
        aria-hidden="true"
        style={{
          flex: '0 0 auto',
          width: 24,
          height: 24,
          borderRadius: '50%',
          background: palette.border,
          color: '#fff',
          fontSize: 14,
          fontWeight: 800,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginTop: 1,
        }}
      >
        {palette.icon}
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontWeight: 800,
            color: palette.text,
            fontSize: '0.95rem',
            marginBottom: 2,
          }}
        >
          {toast.title}
        </div>
        {toast.message && (
          <div
            style={{
              color: palette.text,
              fontSize: '0.85rem',
              lineHeight: 1.45,
            }}
          >
            {toast.message}
          </div>
        )}
      </div>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss notification"
        style={{
          flex: '0 0 auto',
          background: 'transparent',
          border: 0,
          color: palette.text,
          fontSize: 16,
          lineHeight: 1,
          cursor: 'pointer',
          padding: 4,
          opacity: 0.7,
        }}
      >
        ✕
      </button>
    </div>
  );
};

const BrandStep = ({ index, title, subtitle, done, active, onClick }) => (
  <button
    type="button"
    className={`brand-step ${done ? 'brand-step-done' : ''} ${
      active ? 'brand-step-active' : ''
    }`}
    onClick={onClick}
  >
    <span className="brand-step-num">
      {done ? (
        <svg
          viewBox="0 0 24 24"
          width="14"
          height="14"
          fill="none"
          stroke="currentColor"
          strokeWidth="3.5"
        >
          <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ) : (
        index
      )}
    </span>
    <span className="brand-step-text">
      <strong>{title}</strong>
      <em>{subtitle}</em>
    </span>
  </button>
);

export default BrandVerificationHome;