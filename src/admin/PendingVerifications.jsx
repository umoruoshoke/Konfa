// src/admin/PendingVerifications.jsx
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  fetchPendingVerifications,
  approveVerification,
  disputeVerification,
  rejectVerification,
  approveOwnerVerification,
  rejectOwnerVerification,
  approveBusinessVerification,
  rejectBusinessVerification,
} from './adminVerificationApi';
import './PendingVerifications.css';

// ============================================================
// SHARED — Platform pill
// ============================================================
const PlatformPill = ({ platform }) => {
  const colors = {
    instagram: '#E1306C',
    tiktok: '#000000',
    youtube: '#FF0000',
    facebook: '#1877F2',
    x: '#000000',
    whatsapp: '#25D366',
    website: '#0d9488',
  };
  const color = colors[platform] || '#64748b';
  return (
    <span className="pv-platform-pill" style={{ background: color }}>
      {platform}
    </span>
  );
};

// ============================================================
// SHARED — Kind badge (owner / business / social)
// ============================================================
const KindBadge = ({ kind }) => {
  const map = {
    owner: { label: 'Level 1 · Owner', cls: 'pv-kind-owner', icon: '👤' },
    business: { label: 'Level 2 · Business', cls: 'pv-kind-business', icon: '🏢' },
    social: { label: 'Level 3 · Social', cls: 'pv-kind-social', icon: '🔗' },
  };
  const meta = map[kind] || map.social;
  return (
    <span className={`pv-kind-badge ${meta.cls}`}>
      <span className="pv-kind-icon">{meta.icon}</span>
      {meta.label}
    </span>
  );
};

// ============================================================
// SHARED — Age badge
// ============================================================
const AgeBadge = ({ minutes }) => {
  if (minutes == null) return <span className="pv-age pv-age-unknown">unknown</span>;
  if (minutes < 15) return <span className="pv-age pv-age-fresh">{minutes}m</span>;
  if (minutes < 60) return <span className="pv-age pv-age-warn">{minutes}m</span>;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return <span className="pv-age pv-age-urgent">{hours}h</span>;
  const days = Math.floor(hours / 24);
  return <span className="pv-age pv-age-critical">{days}d</span>;
};

// ============================================================
// ACTION MENU — handles all three kinds
// ============================================================
const ActionMenu = ({ item, onDone }) => {
  const [busy, setBusy] = useState('');
  const [err, setErr] = useState('');

  const run = async (action, fn, needsReason = false) => {
    let reason = '';
    if (needsReason) {
      const input = window.prompt(
        action.includes('reject') ? 'Reason for rejection (shown to seller):' : 'Reason:'
      );
      if (input === null) return;
      reason = input;
    }
    try {
      setBusy(action);
      setErr('');
      await fn(reason);
      onDone && onDone();
    } catch (e) {
      setErr(e.message || 'Action failed.');
    } finally {
      setBusy('');
    }
  };

  // Owner kind
  if (item.kind === 'owner') {
    return (
      <div className="pv-actions">
        <button
          className="pv-btn pv-btn-approve"
          disabled={!!busy}
          onClick={() =>
            run(
              'approve',
              (note) => approveOwnerVerification({ sellerUid: item.sellerUid, note }),
              false
            )
          }
        >
          {busy === 'approve' ? '…' : '✓ Approve owner'}
        </button>
        <button
          className="pv-btn pv-btn-reject"
          disabled={!!busy}
          onClick={() =>
            run(
              'reject',
              (reason) => rejectOwnerVerification({ sellerUid: item.sellerUid, reason }),
              true
            )
          }
        >
          {busy === 'reject' ? '…' : '✕ Reject'}
        </button>
        {err && <span className="pv-action-err">{err}</span>}
      </div>
    );
  }

  // Business kind
  if (item.kind === 'business') {
    return (
      <div className="pv-actions">
        <button
          className="pv-btn pv-btn-approve"
          disabled={!!busy}
          onClick={() =>
            run(
              'approve',
              (note) => approveBusinessVerification({ sellerUid: item.sellerUid, note }),
              false
            )
          }
        >
          {busy === 'approve' ? '…' : '✓ Approve business'}
        </button>
        <button
          className="pv-btn pv-btn-reject"
          disabled={!!busy}
          onClick={() =>
            run(
              'reject',
              (reason) => rejectBusinessVerification({ sellerUid: item.sellerUid, reason }),
              true
            )
          }
        >
          {busy === 'reject' ? '…' : '✕ Reject'}
        </button>
        {err && <span className="pv-action-err">{err}</span>}
      </div>
    );
  }

  // Social kind
  return (
    <div className="pv-actions">
      <button
        className="pv-btn pv-btn-approve"
        disabled={!!busy}
        onClick={() =>
          run(
            'approve',
            (note) => approveVerification({ sellerUid: item.sellerUid, platform: item.platform, note }),
            false
          )
        }
      >
        {busy === 'approve' ? '…' : '✓ Approve'}
      </button>
      <button
        className="pv-btn pv-btn-reject"
        disabled={!!busy}
        onClick={() =>
          run(
            'reject',
            (reason) => rejectVerification({ sellerUid: item.sellerUid, platform: item.platform, reason }),
            true
          )
        }
      >
        {busy === 'reject' ? '…' : '✕ Reject'}
      </button>
      <button
        className="pv-btn pv-btn-dispute"
        disabled={!!busy}
        onClick={() =>
          run(
            'dispute',
            (reason) => disputeVerification({ sellerUid: item.sellerUid, platform: item.platform, reason }),
            true
          )
        }
      >
        {busy === 'dispute' ? '…' : '⚠ Dispute'}
      </button>
      {err && <span className="pv-action-err">{err}</span>}
    </div>
  );
};

// ============================================================
// ROW — Owner
// ============================================================
const OwnerRow = ({ item, onDone }) => (
  <div className="pv-row">
    <div className="pv-row-main">
      <div className="pv-row-top">
        <KindBadge kind="owner" />
        <span className="pv-handle">{item.summary.legalName || '—'}</span>
        <AgeBadge minutes={item.minutesSinceIssued} />
      </div>

      <div className="pv-details-grid">
        <DetailRow label="NIN" value={item.summary.ninMasked} mono />
        <DetailRow label="Bank" value={item.summary.bankName} />
        <DetailRow label="Account" value={item.summary.accountMasked} mono />
        <DetailRow label="Account name" value={item.summary.accountName} />
        <DetailRow
          label="Name match"
          value={
            item.summary.nameMatch ? (
              <span className="pv-tag pv-tag-green">✓ Matched</span>
            ) : (
              <span className="pv-tag pv-tag-amber">⚠ No auto-match</span>
            )
          }
        />
        <DetailRow label="Submitted" value={item.ageLabel} />
      </div>

      <div className="pv-row-meta">
        <span className="pv-meta-line">
          <strong>Seller:</strong>{' '}
          {item.sellerDisplayName || item.sellerEmail || item.sellerUid}
        </span>
        {item.summary.ninMasked && (
          <span className="pv-meta-line pv-meta-warn">
            <strong>Verify NIN against the ID document</strong> and confirm
            the name matches the bank account.
          </span>
        )}
      </div>
    </div>

    <div className="pv-row-side">
      <ActionMenu item={item} onDone={onDone} />
    </div>
  </div>
);

// ============================================================
// ROW — Business
// ============================================================
const BusinessRow = ({ item, onDone }) => {
  const s = item.summary;
  const isRegistered = s.type === 'registered';
  return (
    <div className="pv-row">
      <div className="pv-row-main">
        <div className="pv-row-top">
          <KindBadge kind="business" />
          <span className="pv-handle">{s.businessName || '—'}</span>
          <span className={`pv-tag ${isRegistered ? 'pv-tag-blue' : 'pv-tag-purple'}`}>
            {isRegistered ? 'Registered (CAC)' : 'Informal · Owned by verified owner'}
          </span>
          <AgeBadge minutes={item.minutesSinceIssued} />
        </div>

        <div className="pv-details-grid">
          {isRegistered ? (
            <>
              <DetailRow label="CAC number" value={s.cacNumber || '—'} mono />
              <DetailRow label="Business name" value={s.businessName} />
            </>
          ) : (
            <>
              <DetailRow label="Owner" value={s.ownerName || '—'} />
              <DetailRow label="Business name" value={s.businessName} />
            </>
          )}
          <DetailRow
            label="Address"
            value={[s.address?.physical, s.address?.city, s.address?.state]
              .filter(Boolean)
              .join(', ') || '—'}
          />
          <DetailRow
            label="Contact"
            value={[s.contact?.phone, s.contact?.email].filter(Boolean).join(' · ') || '—'}
          />
          <DetailRow label="Submitted" value={item.ageLabel} />
        </div>

        <div className="pv-row-meta">
          <span className="pv-meta-line">
            <strong>Seller:</strong>{' '}
            {item.sellerDisplayName || item.sellerEmail || item.sellerUid}
          </span>
          {isRegistered ? (
            <span className="pv-meta-line pv-meta-warn">
              <strong>Verify the CAC number against the public registry.</strong>{' '}
              If it doesn&apos;t match, reject.
            </span>
          ) : (
            <span className="pv-meta-line pv-meta-info">
              <strong>Informal business.</strong> The owner&apos;s identity was
              verified at Level 1. Confirm the business name and address look
              legitimate.
            </span>
          )}
        </div>
      </div>

      <div className="pv-row-side">
        <ActionMenu item={item} onDone={onDone} />
      </div>
    </div>
  );
};

// ============================================================
// ROW — Social
// ============================================================
const SocialRow = ({ item, onDone }) => (
  <div className="pv-row">
    <div className="pv-row-main">
      <div className="pv-row-top">
        <KindBadge kind="social" />
        <PlatformPill platform={item.platform} />
        <span className="pv-handle">@{(item.handle || '').replace(/^@/, '') || '—'}</span>
        <AgeBadge minutes={item.minutesSinceIssued} />
      </div>

      <div className="pv-details-grid">
        {item.code && (
          <DetailRow
            label="Code"
            value={<code className="pv-code">{item.code}</code>}
          />
        )}
        <DetailRow label="Issued" value={item.ageLabel} />
        {item.lastCheckError && (
          <DetailRow label="Last check" value={item.lastCheckError} />
        )}
      </div>

      <div className="pv-row-meta">
        <span className="pv-meta-line">
          <strong>Seller:</strong>{' '}
          {item.sellerDisplayName || item.sellerEmail || item.sellerUid}
        </span>
      </div>
    </div>

    <div className="pv-row-side">
      {item.url && (
        <a
          className="pv-profile-link"
          href={item.url}
          target="_blank"
          rel="noreferrer noopener"
        >
          Open profile ↗
        </a>
      )}
      <ActionMenu item={item} onDone={onDone} />
    </div>
  </div>
);

const DetailRow = ({ label, value, mono }) => (
  <div className="pv-detail-row">
    <span className="pv-detail-label">{label}</span>
    <span className={`pv-detail-value ${mono ? 'pv-mono' : ''}`}>{value || '—'}</span>
  </div>
);

// ============================================================
// Unified row dispatcher
// ============================================================
const PendingRow = ({ item, onDone }) => {
  if (item.kind === 'owner') return <OwnerRow item={item} onDone={onDone} />;
  if (item.kind === 'business') return <BusinessRow item={item} onDone={onDone} />;
  return <SocialRow item={item} onDone={onDone} />;
};

// ============================================================
// DASHBOARD PANEL
// ============================================================
export function PendingVerificationsPanel({ limit = 5 }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const list = await fetchPendingVerifications();
      setItems(list);
    } catch (err) {
      console.error('fetchPendingVerifications failed:', err);
      setError(err.message || 'Could not load pending verifications.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const visible = useMemo(() => items.slice(0, limit), [items, limit]);
  const oldest = items[0] || null;
  const breakdown = useMemo(() => {
    return items.reduce(
      (acc, it) => {
        acc[it.kind] = (acc[it.kind] || 0) + 1;
        return acc;
      },
      { owner: 0, business: 0, social: 0 }
    );
  }, [items]);

  return (
    <section className="pv-panel">
      <div className="pv-panel-head">
        <div>
          <h2>Pending verifications</h2>
          <p>
            Seller submissions waiting for manual review. Oldest first.
          </p>
        </div>
        {items.length > 0 && (
          <Link to="/admin/verifications" className="pv-panel-link">
            See all {items.length} →
          </Link>
        )}
      </div>

      {loading && (
        <div className="pv-panel-loading">
          <div className="pv-spinner" />
          <span>Loading pending items…</span>
        </div>
      )}

      {error && <div className="pv-panel-error">{error}</div>}

      {!loading && !error && items.length === 0 && (
        <div className="pv-panel-empty">
          <div className="pv-panel-empty-icon">✓</div>
          <div>
            <strong>All caught up.</strong>
            <p>No verifications waiting for manual review.</p>
          </div>
        </div>
      )}

      {!loading && !error && items.length > 0 && (
        <>
          {/* Breakdown strip */}
          <div className="pv-breakdown">
            <span className="pv-breakdown-item">
              <span className="pv-breakdown-dot pv-kind-owner" />
              Owner: <strong>{breakdown.owner}</strong>
            </span>
            <span className="pv-breakdown-item">
              <span className="pv-breakdown-dot pv-kind-business" />
              Business: <strong>{breakdown.business}</strong>
            </span>
            <span className="pv-breakdown-item">
              <span className="pv-breakdown-dot pv-kind-social" />
              Social: <strong>{breakdown.social}</strong>
            </span>
          </div>

          {oldest?.minutesSinceIssued != null && oldest.minutesSinceIssued > 60 && (
            <div className="pv-panel-urgent">
              ⚠ Oldest pending item is {oldest.ageLabel}. Consider reviewing it now.
            </div>
          )}

          <div className="pv-list">
            {visible.map((item, i) => (
              <PendingRow
                key={`${item.sellerUid}-${item.kind}-${item.platform || 'x'}-${i}`}
                item={item}
                onDone={load}
              />
            ))}
          </div>
          {items.length > limit && (
            <div className="pv-more">
              <Link to="/admin/verifications">
                + {items.length - limit} more pending
              </Link>
            </div>
          )}
        </>
      )}
    </section>
  );
}

// ============================================================
// FULL PAGE
// ============================================================
export function PendingVerificationsPage() {
  const [allItems, setAllItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const list = await fetchPendingVerifications();
      setAllItems(list);
      setPage(1);
    } catch (err) {
      console.error('fetchPendingVerifications failed:', err);
      setError(err.message || 'Could not load pending verifications.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    if (filter === 'all') return allItems;
    return allItems.filter((it) => it.kind === filter);
  }, [allItems, filter]);

  const counts = useMemo(() => {
    return allItems.reduce(
      (acc, it) => {
        acc[it.kind] = (acc[it.kind] || 0) + 1;
        return acc;
      },
      { owner: 0, business: 0, social: 0 }
    );
  }, [allItems]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pageItems = filtered.slice((page - 1) * pageSize, page * pageSize);

  const changePageSize = (size) => {
    setPageSize(size);
    setPage(1);
  };

  return (
    <div className="pv-page">
      <header className="pv-page-head">
        <div>
          <h1>Pending Verifications</h1>
          <p>
            Three verification levels across all sellers. Oldest submissions
            appear first — they&apos;ve been waiting longest.
          </p>
        </div>
        <button className="pv-refresh-btn" onClick={load} disabled={loading}>
          {loading ? 'Loading…' : '↻ Refresh'}
        </button>
      </header>

      {!loading && !error && allItems.length > 0 && (
        <div className="pv-toolbar">
          <div className="pv-filter-tabs">
            <button
              className={`pv-filter-tab ${filter === 'all' ? 'active' : ''}`}
              onClick={() => { setFilter('all'); setPage(1); }}
            >
              All <span className="pv-filter-count">{allItems.length}</span>
            </button>
            <button
              className={`pv-filter-tab ${filter === 'owner' ? 'active' : ''}`}
              onClick={() => { setFilter('owner'); setPage(1); }}
            >
              👤 Owner <span className="pv-filter-count">{counts.owner}</span>
            </button>
            <button
              className={`pv-filter-tab ${filter === 'business' ? 'active' : ''}`}
              onClick={() => { setFilter('business'); setPage(1); }}
            >
              🏢 Business <span className="pv-filter-count">{counts.business}</span>
            </button>
            <button
              className={`pv-filter-tab ${filter === 'social' ? 'active' : ''}`}
              onClick={() => { setFilter('social'); setPage(1); }}
            >
              🔗 Social <span className="pv-filter-count">{counts.social}</span>
            </button>
          </div>

          <div className="pv-toolbar-size">
            <label>
              Show:{' '}
              <select
                value={pageSize}
                onChange={(e) => changePageSize(Number(e.target.value))}
              >
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </label>
          </div>
        </div>
      )}

      {loading && (
        <div className="pv-panel-loading">
          <div className="pv-spinner" />
          <span>Loading pending items…</span>
        </div>
      )}

      {error && <div className="pv-panel-error">{error}</div>}

      {!loading && !error && filtered.length === 0 && (
        <div className="pv-panel-empty">
          <div className="pv-panel-empty-icon">✓</div>
          <div>
            <strong>All caught up.</strong>
            <p>
              {filter === 'all'
                ? 'No verifications waiting for manual review.'
                : `No ${filter} verifications waiting.`}
            </p>
          </div>
        </div>
      )}

      {!loading && !error && filtered.length > 0 && (
        <>
          <div className="pv-list">
            {pageItems.map((item, i) => (
              <PendingRow
                key={`${item.sellerUid}-${item.kind}-${item.platform || 'x'}-${i}`}
                item={item}
                onDone={load}
              />
            ))}
          </div>

          {pageCount > 1 && (
            <div className="pv-pagination">
              <button
                className="pv-page-btn"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                ← Prev
              </button>
              <span className="pv-page-indicator">
                Page {page} of {pageCount}
              </span>
              <button
                className="pv-page-btn"
                onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
                disabled={page === pageCount}
              >
                Next →
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}