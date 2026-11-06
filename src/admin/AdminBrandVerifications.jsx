// src/admin/AdminBrandVerifications.jsx
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  fetchGroupedPendingBrandVerifications,
  fetchBrandVerificationById,
  decideBrandOwner,
  decideBrandSocial,
} from './adminBrandVerificationApi';
import './AdminPortal.css';

const PLATFORM_LABEL = {
  instagram: 'Instagram',
  tiktok: 'TikTok',
  youtube: 'YouTube',
  x: 'X (Twitter)',
  facebook: 'Facebook',
  whatsapp: 'WhatsApp',
  website: 'Website',
};

// 🔑 Helper to flatten nested multi-accounts
const getFlattenedAccounts = (rawAccounts) => {
  const flat = [];
  if (!rawAccounts) return flat;
  Object.values(rawAccounts).forEach((platformData) => {
    if (!platformData) return;
    // Old format (flat object)
    if (platformData.platform || platformData.handle) {
      flat.push(platformData);
    } else {
      // New format (nested map of handles)
      Object.values(platformData).forEach((acc) => flat.push(acc));
    }
  });
  return flat;
};

const AdminBrandVerifications = () => {
  const { brandUid } = useParams();
  const [brands, setBrands] = useState([]);
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState(null);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      if (brandUid) {
        const one = await fetchBrandVerificationById(brandUid);
        if (one) {
          const flat = getFlattenedAccounts(one.accounts);
          setActive({
            brandUid: one.id,
            brandDisplayName: one.brandDisplayName || 'Unnamed brand',
            brandEmail: one.brandEmail || '',
            publicSlug: one.publicSlug || null,
            owner: one.owner || {},
            accounts: one.accounts || {},
            pendingByKind: {
              owner: one.owner?.status === 'pending' ? 1 : 0,
              social: flat.filter((a) => a?.status === 'pending').length,
            },
            totalPending: 0,
          });
        }
      }
      const list = await fetchGroupedPendingBrandVerifications();
      setBrands(list);
    } catch (err) {
      console.error(err);
      setError(err.message || 'Could not load pending brand verifications.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [brandUid]);

  if (loading) {
    return (
      <div className="admin-page">
        <header className="admin-page-header">
          <div>
            <h1>Loading brand verifications…</h1>
          </div>
        </header>
        <div className="admin-stat-grid">
          {[1, 2, 3].map((i) => (
            <div key={i} className="admin-skeleton-card" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="admin-page">
      <header className="admin-page-header">
        <div>
          <h1>Brand verifications</h1>
          <p>
            Review owner identity submissions and social account claims from
            brands (public figures, artists, organizations).
          </p>
        </div>
      </header>

      {error && (
        <div className="admin-error" style={{ marginBottom: 16 }}>
          <strong>{error}</strong>
        </div>
      )}

      {brands.length === 0 ? (
        <div className="admin-empty">
          <div className="admin-empty-icon">✓</div>
          <h2>No pending brand verifications</h2>
          <p>Everything is reviewed. Check back later.</p>
        </div>
      ) : (
        <div className="admin-card">
          <div className="admin-card-header">
            <div>
              <h2>Pending ({brands.length})</h2>
              <p>Click a brand to review its submissions.</p>
            </div>
          </div>
          <ul className="admin-app-list">
            {brands.map((b) => (
              <li key={b.brandUid} className="admin-app-item">
                <div className="admin-app-avatar admin-app-avatar-brand">
                  {b.brandDisplayName?.[0]?.toUpperCase() || 'B'}
                </div>
                <div className="admin-app-info">
                  <strong>
                    {b.brandDisplayName}
                    <span className="admin-badge-pill admin-badge-brand">
                      Brand
                    </span>
                  </strong>
                  <span>
                    {b.brandEmail || '—'}
                    {b.pendingByKind.owner > 0 && ' · Owner identity'}
                    {b.pendingByKind.social > 0 &&
                      ` · ${b.pendingByKind.social} social`}
                  </span>
                </div>
                <button
                  className="admin-btn admin-btn-small admin-btn-primary"
                  onClick={() => setActive(b)}
                >
                  Review
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {active && (
        <BrandReviewDrawer
          brand={active}
          onClose={() => setActive(null)}
          onDecided={async () => {
            setActive(null);
            await load();
          }}
        />
      )}
    </div>
  );
};

// ============================================================
// BrandReviewDrawer
// ============================================================
const BrandReviewDrawer = ({ brand, onClose, onDecided }) => {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [rejectReason, setRejectReason] = useState('');
  const [showReject, setShowReject] = useState(false);

  const owner = brand.owner || {};
  // 🔑 Flatten the accounts so we see every handle
  const flatAccounts = getFlattenedAccounts(brand.accounts);
  const pendingAccounts = flatAccounts.filter((a) => a?.status === 'pending');

  const handleOwnerDecision = async (decision) => {
    setError('');
    setBusy(true);
    try {
      await decideBrandOwner({
        brandUid: brand.brandUid,
        decision,
        reason: decision === 'reject' ? rejectReason : '',
      });
      onDecided();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const handleSocialDecision = async (platform, handle, decision) => {
    setError('');
    setBusy(true);
    try {
      // 🔑 Pass the handle so the API knows exactly which account to approve
      await decideBrandSocial({
        brandUid: brand.brandUid,
        platform,
        handle,
        decision,
        reason: decision === 'reject' ? rejectReason : '',
      });
      onDecided();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="admin-modal-overlay" onClick={busy ? undefined : onClose}>
      <div className="admin-modal" onClick={(e) => e.stopPropagation()}>
        <button
          className="admin-modal-close"
          onClick={onClose}
          disabled={busy}
        >
          ✕
        </button>

        <h2 style={{ marginTop: 0 }}>{brand.brandDisplayName}</h2>
        <p style={{ color: '#64748b', fontSize: '0.88rem', marginTop: 0 }}>
          {brand.brandEmail}
        </p>

        {owner.status === 'pending' && (
          <section className="admin-review-section">
            <h3>Owner identity (Level 1)</h3>
            <div className="admin-review-row">
              <span>Legal name</span>
              <strong>{owner.legalName || '—'}</strong>
            </div>
            <div className="admin-review-row">
              <span>NIN</span>
              <strong>{owner.nin || '—'}</strong>
            </div>
            <div className="admin-review-row">
              <span>Name match</span>
              <strong>
                {owner.nameMatch ? (
                  <span className="admin-badge-pill admin-badge-seller">
                    Matched
                  </span>
                ) : (
                  <span className="admin-badge-pill admin-badge-mfr">
                    Differs
                  </span>
                )}
              </strong>
            </div>

            {owner.ninDocumentData && (
              <div className="admin-review-doc">
                <span>NIN document</span>
                <img src={owner.ninDocumentData} alt="NIN document" />
              </div>
            )}
            {owner.selfieWithNinData && (
              <div className="admin-review-doc">
                <span>Selfie with NIN</span>
                <img src={owner.selfieWithNinData} alt="Selfie with NIN" />
              </div>
            )}

            <div className="admin-modal-actions">
              <button
                className="admin-btn admin-btn-ghost"
                onClick={() => setShowReject(true)}
                disabled={busy}
              >
                Reject…
              </button>
              <button
                className="admin-btn admin-btn-primary"
                onClick={() => handleOwnerDecision('approve')}
                disabled={busy}
              >
                {busy ? 'Saving…' : 'Approve owner'}
              </button>
            </div>
          </section>
        )}

        {pendingAccounts.length > 0 && (
          <section className="admin-review-section">
            <h3>Social accounts ({pendingAccounts.length} pending)</h3>
            <ul className="admin-app-list">
              {pendingAccounts.map((acc, index) => (
                <li key={`${acc.platform}-${acc.handle}-${index}`} className="admin-app-item">
                  <div className="admin-app-info">
                    <strong>
                      {PLATFORM_LABEL[acc.platform] || acc.platform}
                      <span className="admin-badge-pill admin-badge-brand">
                        {acc.platform === 'website' || acc.platform === 'whatsapp' 
                          ? acc.handle 
                          : `@${(acc.handle || '').replace(/^@/, '')}`}
                      </span>
                    </strong>
                    <span>
                      Claimed by this brand
                      {acc.pendingCode && (
                        <span style={{ display: 'block', marginTop: 4, color: '#d97706', fontWeight: 600 }}>
                          ⏳ Code: {acc.pendingCode}
                        </span>
                      )}
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button
                      className="admin-btn admin-btn-small admin-btn-ghost"
                      onClick={() => handleSocialDecision(acc.platform, acc.handle, 'reject')}
                      disabled={busy}
                    >
                      Reject
                    </button>
                    <button
                      className="admin-btn admin-btn-small admin-btn-primary"
                      onClick={() => handleSocialDecision(acc.platform, acc.handle, 'approve')}
                      disabled={busy}
                    >
                      Approve
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}

        {showReject && (
          <div className="admin-review-reject">
            <label>Rejection reason (required)</label>
            <textarea
              rows="3"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Tell the brand why this was rejected."
            />
            <div className="admin-modal-actions">
              <button
                className="admin-btn admin-btn-ghost"
                onClick={() => {
                  setShowReject(false);
                  setRejectReason('');
                }}
              >
                Cancel
              </button>
              <button
                className="admin-btn admin-btn-primary"
                onClick={() => handleOwnerDecision('reject')}
                disabled={busy || !rejectReason.trim()}
              >
                Confirm reject
              </button>
            </div>
          </div>
        )}

        {error && (
          <div className="admin-error" style={{ marginTop: 12 }}>
            {error}
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminBrandVerifications;