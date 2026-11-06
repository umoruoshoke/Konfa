// src/Pages/PublicSellerProfile.jsx
import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { fetchPublicProfileBySlug } from '../seller/verification/verificationFlowApi';
import './PublicSellerProfile.css';

const KonfaShield = ({ className = '' }) => (
  <svg className={className} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" aria-label="Konfa shield">
    <defs>
      <linearGradient id="konfaPublicShield" x1="0" y1="0" x2="48" y2="48" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#14b8a6" />
        <stop offset="100%" stopColor="#0d9488" />
      </linearGradient>
      <linearGradient id="konfaPublicInner" x1="0" y1="0" x2="48" y2="48" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#0a1628" />
        <stop offset="100%" stopColor="#1a2d47" />
      </linearGradient>
    </defs>
    <path d="M24 3L6 10v12c0 10.5 7.5 20 18 23 10.5-3 18-12.5 18-23V10L24 3z" fill="url(#konfaPublicInner)" />
    <path d="M24 3L6 10v12c0 10.5 7.5 20 18 23 10.5-3 18-12.5 18-23V10L24 3z" stroke="url(#konfaPublicShield)" strokeWidth="2.5" strokeLinejoin="round" fill="none" />
    <path d="M17 15v18M17 24l10-9M17 24l10 9" stroke="url(#konfaPublicShield)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    <circle cx="33" cy="33" r="6" fill="url(#konfaPublicShield)" />
    <path d="M30.5 33l1.8 1.8 3.2-3.6" stroke="#ffffff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none" />
  </svg>
);

const CheckIcon = () => (
  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="3">
    <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const PLATFORM_META = {
  instagram: { label: 'Instagram', color: '#E1306C', urlPrefix: 'https://instagram.com/' },
  tiktok: { label: 'TikTok', color: '#000000', urlPrefix: 'https://tiktok.com/@' },
  youtube: { label: 'YouTube', color: '#FF0000', urlPrefix: 'https://youtube.com/@' },
  facebook: { label: 'Facebook', color: '#1877F2', urlPrefix: 'https://facebook.com/' },
  x: { label: 'X', color: '#000000', urlPrefix: 'https://x.com/' },
  whatsapp: { label: 'WhatsApp', color: '#25D366', urlPrefix: 'https://wa.me/' },
  website: { label: 'Website', color: '#0d9488', urlPrefix: '' },
};

const PublicSellerProfile = () => {
  const { slug } = useParams();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const data = await fetchPublicProfileBySlug(slug);
        if (cancelled) return;
        if (!data) {
          setNotFound(true);
        } else {
          setProfile(data);
        }
      } catch (err) {
        console.error('Public profile load failed:', err);
        if (!cancelled) setNotFound(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [slug]);

  if (loading) {
    return (
      <div className="psp-page">
        <div className="psp-loading">
          <div className="psp-spinner" />
          <p>Loading profile…</p>
        </div>
      </div>
    );
  }

  if (notFound || !profile) {
    return (
      <div className="psp-page">
        <div className="psp-card psp-card-center">
          <KonfaShield className="psp-notfound-shield" />
          <h1>Profile not found</h1>
          <p>
            This Konfa verification link doesn&apos;t match any active seller
            profile. Double-check the URL, or ask the seller for their current
            link.
          </p>
          <Link to="/" className="psp-btn psp-btn-primary">
            Go to Konfa home
          </Link>
        </div>
      </div>
    );
  }

  const publicProfile = profile.publicProfile || {};
  const owner = profile.owner || {};
  const business = profile.business || {};
  const accounts = profile.accounts || {};

  // Only show verified accounts, and only the ones the seller chose public.
  const verifiedAccounts = Object.values(accounts).filter(
    (a) => a.status === 'verified'
  );

  const ownerVerified = owner.status === 'verified';
  const businessVerified = business.status === 'verified';
  const hasAnyVerification = ownerVerified || businessVerified || verifiedAccounts.length > 0;

  const displayName =
    publicProfile.displayName ||
    business.businessName ||
    owner.legalName ||
    'Konfa verified seller';

  return (
    <div className="psp-page">
      {/* ============ TOP BAR ============ */}
      <header className="psp-topbar">
        <Link to="/" className="psp-brand">
          <KonfaShield className="psp-brand-shield" />
          <span className="psp-brand-name">Konfa</span>
        </Link>
        <span className="psp-topbar-tag">Verified profile</span>
      </header>

      {/* ============ MAIN CARD ============ */}
      <main className="psp-main">
        <article className="psp-card">
          {/* Banner */}
          <div className="psp-banner">
            <div className="psp-banner-glow" />
            <div className="psp-banner-content">
              <div className="psp-banner-badge">
                <span className="psp-banner-badge-dot" />
                Konfa verified
              </div>
              <h1 className="psp-banner-title">{displayName}</h1>
              {publicProfile.category && (
                <p className="psp-banner-cat">{publicProfile.category}</p>
              )}
              {publicProfile.description && (
                <p className="psp-banner-desc">{publicProfile.description}</p>
              )}
            </div>
          </div>

          {/* Verification summary */}
          <section className="psp-summary">
            <h2 className="psp-section-title">What Konfa has verified</h2>

            <div className="psp-verification-list">
              {/* Owner identity */}
              <div
                className={`psp-verification-row ${
                  ownerVerified ? 'psp-verification-ok' : 'psp-verification-muted'
                }`}
              >
                <div className="psp-verification-icon">
                  {ownerVerified ? <CheckIcon /> : '—'}
                </div>
                <div className="psp-verification-body">
                  <strong>Owner identity</strong>
                  {ownerVerified ? (
                    publicProfile.showOwnerName && owner.legalName ? (
                      <span>
                        The person behind this profile was verified as{' '}
                        <strong>{owner.legalName}</strong>.
                      </span>
                    ) : (
                      <span>
                        The person behind this profile has been verified. Their
                        name is withheld at their request.
                      </span>
                    )
                  ) : (
                    <span>Not yet verified.</span>
                  )}
                </div>
              </div>

              {/* Business identity */}
              <div
                className={`psp-verification-row ${
                  businessVerified && publicProfile.showBusiness
                    ? 'psp-verification-ok'
                    : 'psp-verification-muted'
                }`}
              >
                <div className="psp-verification-icon">
                  {businessVerified && publicProfile.showBusiness ? (
                    <CheckIcon />
                  ) : (
                    '—'
                  )}
                </div>
                <div className="psp-verification-body">
                  <strong>Business identity</strong>
                  {businessVerified && publicProfile.showBusiness ? (
                    business.type === 'registered' ? (
                      <span>
                        Registered business — CAC number{' '}
                        <strong>{business.registered?.cacNumber}</strong>.
                      </span>
                    ) : (
                      <span>
                        Informal business owned by{' '}
                        <strong>{business.unregistered?.ownerName}</strong>.
                      </span>
                    )
                  ) : (
                    <span>Not shown on this profile.</span>
                  )}
                </div>
              </div>

              {/* Social accounts */}
              <div
                className={`psp-verification-row ${
                  verifiedAccounts.length > 0
                    ? 'psp-verification-ok'
                    : 'psp-verification-muted'
                }`}
              >
                <div className="psp-verification-icon">
                  {verifiedAccounts.length > 0 ? <CheckIcon /> : '—'}
                </div>
                <div className="psp-verification-body">
                  <strong>Social accounts</strong>
                  {verifiedAccounts.length > 0 ? (
                    <span>
                      {verifiedAccounts.length} account
                      {verifiedAccounts.length === 1 ? '' : 's'} ownership-verified.
                    </span>
                  ) : (
                    <span>No social accounts verified yet.</span>
                  )}
                </div>
              </div>
            </div>
          </section>

          {/* Social accounts list */}
          {verifiedAccounts.length > 0 && (
            <section className="psp-accounts">
              <h2 className="psp-section-title">Official social accounts</h2>
              <ul className="psp-accounts-list">
                {verifiedAccounts.map((acc) => {
                  const meta = PLATFORM_META[acc.platform] || {
                    label: acc.platform,
                    color: '#64748b',
                    urlPrefix: '',
                  };
                  const href = acc.url
                    ? acc.url
                    : meta.urlPrefix
                    ? `${meta.urlPrefix}${(acc.handle || '').replace(/^@/, '')}`
                    : null;

                  return (
                    <li key={acc.platform} className="psp-account-item">
                      <div
                        className="psp-account-platform"
                        style={{ background: meta.color }}
                      >
                        {meta.label}
                      </div>
                      <div className="psp-account-handle">
                        {acc.handle ? `@${acc.handle.replace(/^@/, '')}` : '—'}
                      </div>
                      <div className="psp-account-status">
                        <span className="psp-account-check">
                          <CheckIcon />
                        </span>
                        Verified
                      </div>
                      {href && (
                        <a
                          className="psp-account-link"
                          href={href}
                          target="_blank"
                          rel="noreferrer noopener"
                        >
                          Open ↗
                        </a>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          {/* Business details */}
          {businessVerified && publicProfile.showBusiness && (
            <section className="psp-business">
              <h2 className="psp-section-title">Business details</h2>
              <div className="psp-business-grid">
                {business.businessName && (
                  <DetailItem label="Name" value={business.businessName} />
                )}
                {business.type === 'registered' && business.registered?.cacNumber && (
                  <DetailItem
                    label="CAC number"
                    value={business.registered.cacNumber}
                  />
                )}
                {business.address?.physical && (
                  <DetailItem
                    label="Address"
                    value={[
                      business.address.physical,
                      business.address.city,
                      business.address.state,
                    ]
                      .filter(Boolean)
                      .join(', ')}
                  />
                )}
                {business.contact?.phone && (
                  <DetailItem label="Phone" value={business.contact.phone} />
                )}
                {business.contact?.email && (
                  <DetailItem label="Email" value={business.contact.email} />
                )}
                {business.contact?.website && (
                  <DetailItem
                    label="Website"
                    value={
                      <a
                        href={business.contact.website}
                        target="_blank"
                        rel="noreferrer noopener"
                      >
                        {business.contact.website}
                      </a>
                    }
                  />
                )}
              </div>
            </section>
          )}

          {/* Disclaimer */}
          <section className="psp-disclaimer">
            <strong>Important</strong>
            <p>
              Konfa verifies that the social accounts and business information
              listed above belong to the person who owns this profile. Konfa
              does <em>not</em> guarantee the person&apos;s conduct, products,
              services, or transactions. Always exercise normal due diligence
              when sending money to anyone online.
            </p>
          </section>

          {/* Verification stamp */}
          <footer className="psp-footer">
            <div className="psp-footer-left">
              <KonfaShield className="psp-footer-shield" />
              <div>
                <div className="psp-footer-label">Verified by Konfa</div>
                <div className="psp-footer-url">
                  konfa.ng/s/{slug}
                </div>
              </div>
            </div>
            <div className="psp-footer-right">
              <div className="psp-footer-label">Last updated</div>
              <div className="psp-footer-date">
                {formatDate(profile.updatedAt || profile.publicProfile?.updatedAt)}
              </div>
            </div>
          </footer>
        </article>

        {/* CTA */}
        <div className="psp-cta">
          <p>Are you a seller or business owner?</p>
          <Link to="/seller/signup" className="psp-btn psp-btn-primary">
            Get verified on Konfa →
          </Link>
        </div>
      </main>
    </div>
  );
};

const DetailItem = ({ label, value }) => (
  <div className="psp-detail">
    <span className="psp-detail-label">{label}</span>
    <span className="psp-detail-value">{value}</span>
  </div>
);

function formatDate(ts) {
  if (!ts) return '—';
  try {
    const d = typeof ts.toDate === 'function' ? ts.toDate() : new Date(ts);
    return d.toLocaleDateString([], {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  } catch {
    return '—';
  }
}

export default PublicSellerProfile;