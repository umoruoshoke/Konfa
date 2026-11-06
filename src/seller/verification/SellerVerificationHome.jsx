// src/seller/verification/SellerVerificationHome.jsx
import { useEffect, useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { fetchMyVerification } from './verificationFlowApi';
import OwnerVerificationStep from './OwnerVerificationStep';
import BusinessVerificationStep from './BusinessVerificationStep';
import SocialVerificationStep from './SocialVerificationStep';
import PublicProfilePreview from './PublicProfilePreview';
import ShareQrModal from './ShareQrModal';
import './verificationFlowApi.css';

const KonfaLogo = ({ className = '' }) => (
  <svg className={className} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" aria-label="Konfa logo">
    <defs>
      <linearGradient id="konfaShieldW" x1="0" y1="0" x2="48" y2="48" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#14b8a6" />
        <stop offset="100%" stopColor="#0d9488" />
      </linearGradient>
      <linearGradient id="konfaInnerW" x1="0" y1="0" x2="48" y2="48" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#0a1628" />
        <stop offset="100%" stopColor="#1a2d47" />
      </linearGradient>
    </defs>
    <path d="M24 3L6 10v12c0 10.5 7.5 20 18 23 10.5-3 18-12.5 18-23V10L24 3z" fill="url(#konfaInnerW)" />
    <path d="M24 3L6 10v12c0 10.5 7.5 20 18 23 10.5-3 18-12.5 18-23V10L24 3z" stroke="url(#konfaShieldW)" strokeWidth="2.5" strokeLinejoin="round" fill="none" />
    <path d="M17 15v18M17 24l10-9M17 24l10 9" stroke="url(#konfaShieldW)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    <circle cx="33" cy="33" r="6" fill="url(#konfaShieldW)" />
    <path d="M30.5 33l1.8 1.8 3.2-3.6" stroke="#ffffff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none" />
  </svg>
);

const SellerVerificationHome = () => {
  const ctx = useOutletContext() || {};
  const seller = ctx.seller;

  const [verification, setVerification] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState('owner');
  const [qrOpen, setQrOpen] = useState(false);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const v = await fetchMyVerification();
      setVerification(v);
    } catch (err) {
      console.error('Failed to load verification:', err);
      setError(err.message || 'Could not load your verification status.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const progress = useMemo(() => {
    if (!verification) {
      return {
        owner: false,
        business: false,
        social: false,
        verifiedCount: 0,
        completed: 0,
        total: 4,
        percent: 0,
        statusLabel: 'Not started',
      };
    }

    const owner = verification.owner?.status === 'verified';
    const business = verification.business?.status === 'verified';
    const accounts = verification.accounts || {};
    const verifiedCount = Object.values(accounts).filter(
      (a) => a.status === 'verified'
    ).length;
    const social = verifiedCount > 0;
    const published = verification.publicProfile?.enabled;

    const completed = [owner, business, social, published].filter(Boolean).length;
    const total = 4;
    const percent = Math.round((completed / total) * 100);

    let statusLabel = 'Not started';
    if (completed === total) statusLabel = 'Fully verified';
    else if (completed >= 2) statusLabel = 'Partially verified';
    else if (completed === 1) statusLabel = 'Getting started';

    return {
      owner,
      business,
      social,
      published,
      verifiedCount,
      completed,
      total,
      percent,
      statusLabel,
    };
  }, [verification]);

  if (loading) {
    return (
      <div className="vf-page">
        <div className="vf-loading">
          <div className="vf-spinner" />
          <p>Loading your verification…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="vf-page">
      {/* =========================================================
          HERO HEADER
          ========================================================= */}
      <header className="vf-hero">
        <div className="vf-hero-bg" aria-hidden="true">
          <div className="vf-hero-orb vf-hero-orb-1" />
          <div className="vf-hero-orb vf-hero-orb-2" />
        </div>

        <div className="vf-hero-inner">
          <div className="vf-hero-left">
            <KonfaLogo className="vf-hero-logo" />
            <div className="vf-hero-text">
              <div className="vf-hero-badge">
                <span className="vf-hero-badge-dot" />
                Seller Verification
              </div>
              <h1>Get verified on Konfa</h1>
              <p>
                Prove who you are, link your business, verify your social
                accounts, and publish a public profile customers can trust.
              </p>
            </div>
          </div>

          <div className="vf-hero-status">
            <div className="vf-hero-status-ring">
              <svg viewBox="0 0 100 100" className="vf-hero-ring-svg">
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
                  stroke="url(#vfHeroGrad)"
                  strokeWidth="8"
                  strokeLinecap="round"
                  strokeDasharray={`${(progress.percent / 100) * 264} 264`}
                  transform="rotate(-90 50 50)"
                />
                <defs>
                  <linearGradient id="vfHeroGrad" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="#14b8a6" />
                    <stop offset="100%" stopColor="#0d9488" />
                  </linearGradient>
                </defs>
              </svg>
              <div className="vf-hero-ring-label">
                <strong>{progress.percent}%</strong>
                <span>complete</span>
              </div>
            </div>
            <div className="vf-hero-status-text">
              <strong>{progress.statusLabel}</strong>
              <span>
                {progress.completed} of {progress.total} steps done
              </span>
            </div>
          </div>
        </div>
      </header>

      {error && <div className="vf-error">{error}</div>}

      {/* =========================================================
          PROGRESS STEPPER
          ========================================================= */}
      <div className="vf-stepper" role="tablist" aria-label="Verification steps">
        <ProgressPill
          index={1}
          label="Owner"
          sublabel="Your identity"
          done={progress.owner}
          active={tab === 'owner'}
          onClick={() => setTab('owner')}
        />
        <ProgressPill
          index={2}
          label="Business"
          sublabel="Your store"
          done={progress.business}
          active={tab === 'business'}
          onClick={() => setTab('business')}
        />
        <ProgressPill
          index={3}
          label="Social"
          sublabel={
            progress.verifiedCount > 0
              ? `${progress.verifiedCount} linked`
              : 'Link accounts'
          }
          done={progress.social}
          active={tab === 'social'}
          onClick={() => setTab('social')}
        />
        <ProgressPill
          index={4}
          label="Publish"
          sublabel="Public profile"
          done={progress.published}
          active={tab === 'publish'}
          onClick={() => setTab('publish')}
        />
      </div>

      {/* =========================================================
          TAB CONTENT
          ========================================================= */}
      <main className="vf-main">
        <div className="vf-tab-panel" key={tab}>
          {tab === 'owner' && (
            <OwnerVerificationStep
              verification={verification}
              onReload={load}
              onNext={() => setTab('business')}
            />
          )}
          {tab === 'business' && (
            <BusinessVerificationStep
              verification={verification}
              onReload={load}
              onBack={() => setTab('owner')}
              onNext={() => setTab('social')}
            />
          )}
          {tab === 'social' && (
            <SocialVerificationStep
              verification={verification}
              onReload={load}
              onBack={() => setTab('business')}
              onNext={() => setTab('publish')}
            />
          )}
          {tab === 'publish' && (
            <PublicProfilePreview
              verification={verification}
              onReload={load}
              onBack={() => setTab('social')}
              onOpenQr={() => setQrOpen(true)}
            />
          )}
        </div>
      </main>

      {qrOpen && (
        <ShareQrModal
          verification={verification}
          onClose={() => setQrOpen(false)}
        />
      )}
    </div>
  );
};

// ============================================================
// PROGRESS PILL — step button in the stepper
// ============================================================
const ProgressPill = ({ index, label, sublabel, done, active, onClick }) => (
  <button
    type="button"
    role="tab"
    aria-selected={active}
    className={`vf-step ${done ? 'vf-step-done' : ''} ${
      active ? 'vf-step-active' : ''
    }`}
    onClick={onClick}
  >
    <span className="vf-step-num">
      {done ? (
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="3.5">
          <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ) : (
        index
      )}
    </span>
    <span className="vf-step-text">
      <strong className="vf-step-label">{label}</strong>
      <em className="vf-step-sub">{sublabel}</em>
    </span>
  </button>
);

export default SellerVerificationHome;