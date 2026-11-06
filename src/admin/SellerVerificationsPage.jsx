// src/admin/SellerVerificationsPage.jsx
import { useEffect, useMemo, useState, useCallback } from 'react';
import {
  fetchGroupedPendingVerifications,
  approveOwnerVerification,
  rejectOwnerVerification,
  approveBusinessVerification,
  rejectBusinessVerification,
  approveVerification,
  rejectVerification,
  disputeVerification,
  logAdminReveal,
} from './adminVerificationApi';
import './SellerVerificationsPage.css';

/* ============================================================
   PAGE
   ============================================================ */
const SellerVerificationsPage = () => {
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedUid, setSelectedUid] = useState(null);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');

  const load = useCallback(
    async ({ keepSelection = true } = {}) => {
      setLoading(true);
      setError('');
      try {
        const list = await fetchGroupedPendingVerifications();
        setGroups(list);
        setSelectedUid((prev) => {
          if (keepSelection && prev && list.some((g) => g.sellerUid === prev)) {
            return prev;
          }
          return list[0]?.sellerUid || null;
        });
      } catch (err) {
        console.error('fetchGroupedPendingVerifications failed:', err);
        setError(err.message || 'Could not load verifications.');
      } finally {
        setLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    load();
  }, [load]);

  const totals = useMemo(() => {
    return groups.reduce(
      (acc, g) => {
        acc.owner += g.pendingByKind.owner;
        acc.business += g.pendingByKind.business;
        acc.social += g.pendingByKind.social;
        acc.sellers += 1;
        return acc;
      },
      { owner: 0, business: 0, social: 0, sellers: 0 }
    );
  }, [groups]);

  const filteredGroups = useMemo(() => {
    let list = groups;

    if (filter !== 'all') {
      list = list.filter((g) => g.pendingByKind[filter] > 0);
    }

    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter((g) => {
        const name = (g.sellerDisplayName || '').toLowerCase();
        const email = (g.sellerEmail || '').toLowerCase();
        const legal = (g.owner?.legalName || '').toLowerCase();
        const biz = (g.business?.businessName || '').toLowerCase();
        const uid = (g.sellerUid || '').toLowerCase();
        return (
          name.includes(q) ||
          email.includes(q) ||
          legal.includes(q) ||
          biz.includes(q) ||
          uid.includes(q)
        );
      });
    }

    return list;
  }, [groups, filter, search]);

  const selected = useMemo(
    () => filteredGroups.find((g) => g.sellerUid === selectedUid) || null,
    [filteredGroups, selectedUid]
  );

  return (
    <div className="svp-page">
      <header className="svp-header">
        <div>
          <h1>Seller Verifications</h1>
          <p>
            Every submission waiting on review — Owner, Business, and Social
            accounts — grouped by seller.
          </p>
        </div>
        <button
          type="button"
          className="svp-refresh"
          onClick={() => load()}
          disabled={loading}
        >
          <RefreshIcon spinning={loading} />
          {loading ? 'Loading…' : 'Refresh'}
        </button>
      </header>

      <div className="svp-summary">
        <SummaryCard
          label="Sellers waiting"
          value={totals.sellers}
          tone="navy"
          active={filter === 'all'}
          onClick={() => setFilter('all')}
        />
        <SummaryCard
          label="Owner submissions"
          value={totals.owner}
          tone="purple"
          active={filter === 'owner'}
          onClick={() => setFilter(filter === 'owner' ? 'all' : 'owner')}
        />
        <SummaryCard
          label="Business submissions"
          value={totals.business}
          tone="teal"
          active={filter === 'business'}
          onClick={() => setFilter(filter === 'business' ? 'all' : 'business')}
        />
        <SummaryCard
          label="Social submissions"
          value={totals.social}
          tone="amber"
          active={filter === 'social'}
          onClick={() => setFilter(filter === 'social' ? 'all' : 'social')}
        />
      </div>

      {error && <div className="svp-error">{error}</div>}

      {!loading && groups.length === 0 && (
        <div className="svp-empty">
          <div className="svp-empty-icon">✓</div>
          <div>
            <strong>All caught up.</strong>
            <p>
              No seller verifications are waiting for review right now. New
              submissions will appear here automatically.
            </p>
          </div>
        </div>
      )}

      {!loading && groups.length > 0 && (
        <div className="svp-grid">
          <aside className="svp-list">
            <div className="svp-list-toolbar">
              <div className="svp-search">
                <SearchIcon />
                <input
                  type="text"
                  placeholder="Search sellers…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>

              <div className="svp-list-meta">
                <span>
                  {filteredGroups.length} seller
                  {filteredGroups.length === 1 ? '' : 's'}
                </span>
                {filter !== 'all' && (
                  <button
                    type="button"
                    className="svp-clear-filter"
                    onClick={() => setFilter('all')}
                  >
                    Clear filter
                  </button>
                )}
              </div>
            </div>

            {filteredGroups.length === 0 ? (
              <div className="svp-list-empty">
                No sellers match your search.
              </div>
            ) : (
              <div className="svp-list-items">
                {filteredGroups.map((g) => (
                  <SellerListItem
                    key={g.sellerUid}
                    group={g}
                    active={g.sellerUid === selectedUid}
                    onClick={() => setSelectedUid(g.sellerUid)}
                  />
                ))}
              </div>
            )}
          </aside>

          <section className="svp-detail">
            {selected ? (
              <SellerReviewPanel
                group={selected}
                onReload={() => load({ keepSelection: true })}
              />
            ) : (
              <div className="svp-detail-empty">
                <div className="svp-detail-empty-icon">👈</div>
                <p>Select a seller to review their verifications.</p>
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
};

/* ============================================================
   SUMMARY CARD
   ============================================================ */
const SummaryCard = ({ label, value, tone, active, onClick }) => (
  <button
    type="button"
    className={`svp-summary-card svp-summary-${tone} ${
      active ? 'active' : ''
    }`}
    onClick={onClick}
    disabled={!onClick}
  >
    <span className="svp-summary-label">{label}</span>
    <span className="svp-summary-value">{value}</span>
  </button>
);

/* ============================================================
   LIST ITEM
   ============================================================ */
const SellerListItem = ({ group, active, onClick }) => {
  const { pendingByKind, totalPending, oldestAgeLabel } = group;

  return (
    <button
      type="button"
      className={`svp-list-item ${active ? 'active' : ''}`}
      onClick={onClick}
    >
      <div className="svp-list-item-main">
        <div className="svp-list-item-name">
          {group.sellerDisplayName ||
            group.owner?.legalName ||
            group.sellerEmail ||
            group.sellerUid.slice(0, 8)}
        </div>
        <div className="svp-list-item-sub">
          {group.sellerEmail || group.sellerUid}
        </div>

        <div className="svp-list-item-badges">
          {pendingByKind.owner > 0 && (
            <span className="svp-badge svp-badge-owner">Owner</span>
          )}
          {pendingByKind.business > 0 && (
            <span className="svp-badge svp-badge-business">Business</span>
          )}
          {pendingByKind.social > 0 && (
            <span className="svp-badge svp-badge-social">
              {pendingByKind.social} social
            </span>
          )}
        </div>
      </div>

      <div className="svp-list-item-right">
        <span className="svp-list-item-count">{totalPending}</span>
        <span className="svp-list-item-age">{oldestAgeLabel}</span>
      </div>
    </button>
  );
};

/* ============================================================
   REVEAL VALUE
   ============================================================ */
const RevealValue = ({ value, sellerUid, field, mono = true, label }) => {
  const [revealed, setRevealed] = useState(false);

  if (!value) return <span className="svp-detail-value">—</span>;

  const masked = `•••••••${String(value).slice(-4)}`;

  const toggle = async () => {
    const next = !revealed;
    setRevealed(next);
    if (next && sellerUid && field) {
      try {
        await logAdminReveal({ sellerUid, field });
      } catch {
        /* non-fatal */
      }
    }
  };

  return (
    <span
      className={`svp-detail-value ${mono ? 'svp-mono' : ''} ${
        revealed ? 'revealed' : ''
      }`}
    >
      {revealed ? value : masked}
      <button
        type="button"
        className="svp-reveal-btn"
        onClick={toggle}
        title={label || `Reveal ${field}`}
      >
        {revealed ? 'Hide' : 'Reveal'}
      </button>
    </span>
  );
};

/* ============================================================
   SELLER REVIEW PANEL
   ============================================================ */
const SellerReviewPanel = ({ group, onReload }) => {
  const owner = group.owner || {};
  const business = group.business || {};
  const rawAccounts = group.accounts || {};

  const ownerVerified = owner.status === 'verified';
  const ownerPending = owner.status === 'pending';
  const ownerRejected = owner.status === 'rejected';

  const bizVerified = business.status === 'verified';
  const bizPending = business.status === 'pending';
  const bizRejected = business.status === 'rejected';

  // 🔑 FIX: Updated flattening logic to handle Arrays, Objects, and single flat objects
  const allAccounts = useMemo(() => {
    const flat = [];
    if (!rawAccounts) return flat;
    
    Object.values(rawAccounts).forEach((platformData) => {
      if (!platformData) return;
      
      if (Array.isArray(platformData)) {
        // Handle new Array format
        platformData.forEach((acc) => {
          if (acc && acc.handle) flat.push(acc);
        });
      } else if (platformData.platform || platformData.handle) {
        // Handle old single flat object
        flat.push(platformData);
      } else {
        // Handle old nested object format
        Object.values(platformData).forEach((acc) => {
          if (acc && acc.handle) flat.push(acc);
        });
      }
    });
    return flat;
  }, [rawAccounts]);

  const socialPending = allAccounts.filter((a) => a.status === 'pending');
  const socialVerified = allAccounts.filter((a) => a.status === 'verified');

  return (
    <div className="svp-detail-body">
      <header className="svp-detail-head">
        <div className="svp-detail-head-left">
          <div className="svp-detail-avatar">
            {(group.sellerDisplayName || group.owner?.legalName || 'S')
              .charAt(0)
              .toUpperCase()}
          </div>
          <div>
            <h2>
              {group.sellerDisplayName ||
                group.owner?.legalName ||
                group.sellerEmail ||
                'Seller'}
            </h2>
            <div className="svp-detail-sub">
              {group.sellerEmail || group.sellerUid}
            </div>
            <div className="svp-detail-head-badges">
              <span className="svp-detail-pending-pill">
                {group.totalPending} pending
              </span>
              <span className="svp-detail-age">
                Oldest: {group.oldestAgeLabel}
              </span>
            </div>
          </div>
        </div>

        {group.publicSlug && (
          <a
            className="svp-public-link"
            href={`/s/${group.publicSlug}`}
            target="_blank"
            rel="noreferrer noopener"
          >
            View public profile ↗
          </a>
        )}
      </header>

      {/* ============ LEVEL 1: OWNER ============ */}
      <section className="svp-level">
        <div className="svp-level-head">
          <div className="svp-level-title">
            <span className="svp-level-num">1</span>
            <span>Owner identity</span>
          </div>
          <LevelStatus status={owner.status} />
        </div>

        {owner.status === 'unsubmitted' || !owner.status ? (
          <div className="svp-level-empty">
            Seller has not submitted owner identity yet.
          </div>
        ) : (
          <>
            <div className="svp-detail-grid">
              <Detail label="Full legal name" value={owner.legalName} />
              <Detail
                label="Name on bank account"
                value={owner.bankAccount?.accountName}
              />
              <Detail label="Bank" value={owner.bankAccount?.bankName} />
              <div className="svp-detail-item">
                <span className="svp-detail-label">Account number</span>
                <RevealValue
                  value={owner.bankAccount?.accountNumber}
                  sellerUid={group.sellerUid}
                  field="account_number"
                  label="account number"
                />
              </div>
              <div className="svp-detail-item">
                <span className="svp-detail-label">NIN</span>
                <RevealValue
                  value={owner.nin}
                  sellerUid={group.sellerUid}
                  field="nin"
                  label="NIN"
                />
              </div>
              <Detail
                label="Submitted"
                value={formatRelative(owner.submittedAt)}
              />
            </div>

            {(owner.ninDocumentData || owner.selfieWithNinData) && (
              <div className="svp-docs">
                <div className="svp-docs-head">
                  <strong>Identity documents</strong>
                  <span className="svp-docs-hint">
                    Compare the face on the selfie to the NIN slip.
                  </span>
                </div>
                <div className="svp-docs-grid">
                  {owner.ninDocumentData && (
                    <DocImage
                      src={owner.ninDocumentData}
                      label="NIN document"
                      sellerUid={group.sellerUid}
                      field="nin_document"
                    />
                  )}
                  {owner.selfieWithNinData && (
                    <DocImage
                      src={owner.selfieWithNinData}
                      label="Selfie with NIN"
                      sellerUid={group.sellerUid}
                      field="nin_selfie"
                    />
                  )}
                </div>
              </div>
            )}

            {owner.nameMatch === true && (
              <div className="svp-callout svp-callout-green">
                <strong>✓ Names match</strong>
                <p>
                  Every name word in the legal name appears in the account name
                  and vice versa.
                </p>
              </div>
            )}
            {owner.nameMatch === false && (
              <div className="svp-callout svp-callout-amber">
                <strong>⚠ Names do not fully match</strong>
                <p>Review the mismatches below before approving.</p>
                {owner.nameMatchDetail?.missingInAccount?.length > 0 && (
                  <div className="svp-callout-row">
                    <strong>In legal, missing from account:</strong>{' '}
                    {owner.nameMatchDetail.missingInAccount.join(', ')}
                  </div>
                )}
                {owner.nameMatchDetail?.missingInLegal?.length > 0 && (
                  <div className="svp-callout-row">
                    <strong>In account, missing from legal:</strong>{' '}
                    {owner.nameMatchDetail.missingInLegal.join(', ')}
                  </div>
                )}
              </div>
            )}

            {ownerPending && (
              <ActionButtons
                approveLabel="Approve owner identity"
                rejectLabel="Reject"
                onApprove={() =>
                  approveOwnerVerification({ sellerUid: group.sellerUid })
                }
                onReject={(reason) =>
                  rejectOwnerVerification({
                    sellerUid: group.sellerUid,
                    reason,
                  })
                }
                onReload={onReload}
              />
            )}
            {ownerVerified && (
              <div className="svp-action-done">
                ✓ Verified {formatRelative(owner.verifiedAt)} by{' '}
                {owner.verifiedBy || 'admin'}
              </div>
            )}
            {ownerRejected && (
              <div className="svp-callout svp-callout-red">
                <strong>Rejected</strong>
                <p>{owner.rejectionReason || 'No reason recorded.'}</p>
              </div>
            )}
          </>
        )}
      </section>

      {/* ============ LEVEL 2: BUSINESS ============ */}
      <section className="svp-level">
        <div className="svp-level-head">
          <div className="svp-level-title">
            <span className="svp-level-num">2</span>
            <span>Business identity</span>
          </div>
          <LevelStatus status={business.status} />
        </div>

        {business.status === 'unsubmitted' || !business.status ? (
          <div className="svp-level-empty">
            Seller has not submitted business details yet.
          </div>
        ) : (
          <>
            <div className="svp-detail-grid">
              <Detail
                label="Business type"
                value={
                  business.type === 'registered'
                    ? 'Registered (CAC)'
                    : 'Informal / individual'
                }
              />
              <Detail label="Business name" value={business.businessName} />
              {business.type === 'registered' && (
                <Detail
                  label="CAC number"
                  value={business.registered?.cacNumber}
                  mono
                />
              )}
              {business.type === 'unregistered' && (
                <Detail
                  label="Owner"
                  value={business.unregistered?.ownerName}
                />
              )}
              <Detail
                label="Address"
                value={[
                  business.address?.physical,
                  business.address?.city,
                  business.address?.state,
                ]
                  .filter(Boolean)
                  .join(', ')}
              />
              <Detail label="Phone" value={business.contact?.phone} />
              <Detail label="Email" value={business.contact?.email} />
              <Detail
                label="Submitted"
                value={formatRelative(business.submittedAt)}
              />
            </div>

            {business.registered?.certificateUrl && (
              <a
                className="svp-doc-link"
                href={business.registered.certificateUrl}
                target="_blank"
                rel="noreferrer noopener"
              >
                📎 View CAC certificate
              </a>
            )}

            {bizPending && (
              <ActionButtons
                approveLabel="Approve business identity"
                rejectLabel="Reject"
                onApprove={() =>
                  approveBusinessVerification({ sellerUid: group.sellerUid })
                }
                onReject={(reason) =>
                  rejectBusinessVerification({
                    sellerUid: group.sellerUid,
                    reason,
                  })
                }
                onReload={onReload}
              />
            )}
            {bizVerified && (
              <div className="svp-action-done">
                ✓ Verified {formatRelative(business.verifiedAt)} by{' '}
                {business.verifiedBy || 'admin'}
              </div>
            )}
            {bizRejected && (
              <div className="svp-callout svp-callout-red">
                <strong>Rejected</strong>
                <p>{business.rejectionReason || 'No reason recorded.'}</p>
              </div>
            )}
          </>
        )}
      </section>

      {/* ============ LEVEL 3: SOCIAL ============ */}
      <section className="svp-level">
        <div className="svp-level-head">
          <div className="svp-level-title">
            <span className="svp-level-num">3</span>
            <span>Social accounts</span>
          </div>
          <div className="svp-level-meta">
            {socialVerified.length} verified · {socialPending.length} pending
          </div>
        </div>

        {allAccounts.length === 0 ? (
          <div className="svp-level-empty">No social accounts added yet.</div>
        ) : (
          <div className="svp-social-list">
            {allAccounts.map((acc, idx) => (
              <SocialRow
                key={`${acc.platform}-${acc.handle || idx}-${idx}`}
                acc={acc}
                group={group}
                onReload={onReload}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
};

/* ============================================================
   ACTION BUTTONS — inline reject box
   ============================================================ */
const ActionButtons = ({
  approveLabel,
  rejectLabel,
  onApprove,
  onReject,
  onReload,
}) => {
  const [busy, setBusy] = useState('');
  const [err, setErr] = useState('');
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState('');

  const doApprove = async () => {
    setBusy('approve');
    setErr('');
    try {
      await onApprove();
      await onReload();
    } catch (e) {
      setErr(e.message || 'Failed.');
    } finally {
      setBusy('');
    }
  };

  const doReject = async () => {
    if (reason.trim().length < 3) {
      setErr('Please enter at least 3 characters as a reason.');
      return;
    }
    setBusy('reject');
    setErr('');
    try {
      await onReject(reason.trim());
      await onReload();
      setRejecting(false);
      setReason('');
    } catch (e) {
      setErr(e.message || 'Failed.');
    } finally {
      setBusy('');
    }
  };

  if (rejecting) {
    return (
      <div className="svp-reject-box">
        <label className="svp-reject-label">
          <span>Reason for rejection</span>
          <span className="svp-reject-count">
            {reason.length} characters
          </span>
        </label>
        <textarea
          rows="3"
          placeholder="Explain why this submission is being rejected. This will be shown to the seller and saved to the audit log."
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          disabled={busy === 'reject'}
        />
        {err && <div className="svp-action-err">{err}</div>}
        <div className="svp-reject-actions">
          <button
            type="button"
            className="svp-btn svp-btn-ghost"
            onClick={() => {
              setRejecting(false);
              setReason('');
              setErr('');
            }}
            disabled={busy === 'reject'}
          >
            Cancel
          </button>
          <button
            type="button"
            className="svp-btn svp-btn-reject"
            onClick={doReject}
            disabled={busy === 'reject' || reason.trim().length < 3}
          >
            {busy === 'reject' ? 'Rejecting…' : 'Confirm rejection'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="svp-actions">
      <button
        type="button"
        className="svp-btn svp-btn-approve"
        onClick={doApprove}
        disabled={!!busy}
      >
        <CheckIcon />
        {busy === 'approve' ? 'Approving…' : approveLabel}
      </button>
      <button
        type="button"
        className="svp-btn svp-btn-reject"
        onClick={() => setRejecting(true)}
        disabled={!!busy}
      >
        <XIcon />
        {rejectLabel}
      </button>
      {err && <span className="svp-action-err">{err}</span>}
    </div>
  );
};

/* ============================================================
   DOCUMENT IMAGE VIEWER
   ============================================================ */
const DocImage = ({ src, label, sellerUid, field }) => {
  const [open, setOpen] = useState(false);

  const openFull = async () => {
    setOpen(true);
    if (sellerUid && field) {
      try {
        await logAdminReveal({ sellerUid, field });
      } catch {
        /* non-fatal */
      }
    }
  };

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <>
      <div className="svp-doc">
        <div className="svp-doc-label">{label}</div>
        <button
          type="button"
          className="svp-doc-thumb"
          onClick={openFull}
          aria-label={`Open ${label} full size`}
        >
          <img src={src} alt={label} />
          <span className="svp-doc-zoom">Click to enlarge</span>
        </button>
      </div>

      {open && (
        <div className="svp-lightbox" onClick={() => setOpen(false)}>
          <div
            className="svp-lightbox-inner"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              className="svp-lightbox-close"
              onClick={() => setOpen(false)}
              aria-label="Close"
            >
              ✕
            </button>
            <div className="svp-lightbox-label">{label}</div>
            <img src={src} alt={label} className="svp-lightbox-img" />
            <a
              className="svp-lightbox-download"
              href={src}
              download={`${sellerUid || 'seller'}-${field || label}.jpg`}
            >
              ⤓ Save image
            </a>
          </div>
        </div>
      )}
    </>
  );
};

/* ============================================================
   SMALL SUB-COMPONENTS
   ============================================================ */
const LevelStatus = ({ status }) => {
  const map = {
    verified: { label: 'Verified', cls: 'svp-status-green' },
    pending: { label: 'Pending review', cls: 'svp-status-amber' },
    rejected: { label: 'Rejected', cls: 'svp-status-red' },
    unsubmitted: { label: 'Not submitted', cls: 'svp-status-gray' },
  };
  const s = map[status] || map.unsubmitted;
  return <span className={`svp-status ${s.cls}`}>{s.label}</span>;
};

const Detail = ({ label, value, mono }) => (
  <div className="svp-detail-item">
    <span className="svp-detail-label">{label}</span>
    <span className={`svp-detail-value ${mono ? 'svp-mono' : ''}`}>
      {value || '—'}
    </span>
  </div>
);

/* ============================================================
   SOCIAL ROW
   ============================================================ */
const SocialRow = ({ acc, group, onReload }) => {
  const [busy, setBusy] = useState('');
  const [err, setErr] = useState('');
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState('');

  const platformColors = {
    instagram: 'linear-gradient(135deg, #F58529, #DD2A7B 50%, #8134AF)',
    tiktok: '#000000',
    youtube: '#FF0000',
    facebook: '#1877F2',
    x: '#000000',
    whatsapp: '#25D366',
    website: '#0d9488',
  };
  const color = platformColors[acc.platform] || '#64748b';

  const run = async (action, fn) => {
    setBusy(action);
    setErr('');
    try {
      await fn();
      await onReload();
    } catch (e) {
      setErr(e.message || 'Failed.');
    } finally {
      setBusy('');
    }
  };

  const statusPill =
    acc.status === 'verified'
      ? { label: 'Verified', cls: 'svp-status-green' }
      : acc.status === 'pending'
      ? { label: 'Pending Admin Review', cls: 'svp-status-amber' }
      : acc.status === 'disputed'
      ? { label: 'Disputed', cls: 'svp-status-red' }
      : { label: 'Unverified', cls: 'svp-status-gray' };

  // Format handle based on platform
  const formatHandle = () => {
    if (!acc.handle) return '—';
    if (acc.platform === 'whatsapp') {
      return acc.handle.startsWith('+') ? acc.handle : `+${acc.handle.replace(/\D/g, '')}`;
    }
    if (acc.platform === 'website') {
      return acc.handle;
    }
    return `@${acc.handle.replace(/^@/, '')}`;
  };

  return (
    <div className="svp-social-row">
      <div className="svp-social-accent" style={{ background: color }} />
      <div className="svp-social-body">
        <div className="svp-social-head">
          <span className="svp-social-platform">{acc.platform}</span>
          <span className={`svp-status ${statusPill.cls}`}>
            {statusPill.label}
          </span>
        </div>
        <div className="svp-social-handle">
          {formatHandle()}
        </div>
        {acc.pendingCode && acc.status === 'pending' && (
          <div className="svp-social-code">
            Code: <code>{acc.pendingCode}</code> · Issued{' '}
            {formatRelative(acc.submittedAt || acc.codeIssuedAt)}
          </div>
        )}
        {acc.lastCheckError && acc.status !== 'verified' && (
          <div className="svp-social-err">{acc.lastCheckError}</div>
        )}

        {acc.status === 'pending' && !rejecting && (
          <div className="svp-social-actions">
            <button
              type="button"
              className="svp-btn svp-btn-approve svp-btn-sm"
              onClick={() =>
                run('approve', () =>
                  approveVerification({
                    sellerUid: group.sellerUid,
                    platform: acc.platform,
                    handle: acc.handle, // Pass handle for multiple accounts
                  })
                )
              }
              disabled={!!busy}
            >
              {busy === 'approve' ? '…' : '✓ Approve'}
            </button>
            <button
              type="button"
              className="svp-btn svp-btn-reject svp-btn-sm"
              onClick={() => setRejecting(true)}
              disabled={!!busy}
            >
              ✕ Reject
            </button>
            <button
              type="button"
              className="svp-btn svp-btn-dispute svp-btn-sm"
              onClick={() => {
                const r = window.prompt('Reason for dispute:');
                if (r === null) return;
                run('dispute', () =>
                  disputeVerification({
                    sellerUid: group.sellerUid,
                    platform: acc.platform,
                    handle: acc.handle, // Pass handle for multiple accounts
                    reason: r,
                  })
                );
              }}
              disabled={!!busy}
            >
              {busy === 'dispute' ? '…' : '⚠ Dispute'}
            </button>
            {acc.url && (
              <a
                className="svp-social-link"
                href={acc.url}
                target="_blank"
                rel="noreferrer noopener"
              >
                Open profile ↗
              </a>
            )}
          </div>
        )}

        {acc.status === 'pending' && rejecting && (
          <div className="svp-reject-box svp-reject-box-inline">
            <textarea
              rows="2"
              placeholder="Reason for rejection (shown to seller)…"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              disabled={busy === 'reject'}
            />
            <div className="svp-reject-actions">
              <button
                type="button"
                className="svp-btn svp-btn-ghost svp-btn-sm"
                onClick={() => {
                  setRejecting(false);
                  setReason('');
                }}
                disabled={busy === 'reject'}
              >
                Cancel
              </button>
              <button
                type="button"
                className="svp-btn svp-btn-reject svp-btn-sm"
                onClick={() =>
                  run('reject', async () => {
                    await rejectVerification({
                      sellerUid: group.sellerUid,
                      platform: acc.platform,
                      handle: acc.handle, // Pass handle for multiple accounts
                      reason: reason.trim(),
                    });
                    setRejecting(false);
                    setReason('');
                  })
                }
                disabled={busy === 'reject' || reason.trim().length < 3}
              >
                {busy === 'reject' ? '…' : 'Confirm'}
              </button>
            </div>
          </div>
        )}

        {acc.status === 'verified' && acc.url && (
          <div className="svp-social-actions">
            <a
              className="svp-social-link"
              href={acc.url}
              target="_blank"
              rel="noreferrer noopener"
            >
              Open profile ↗
            </a>
          </div>
        )}

        {err && <div className="svp-action-err">{err}</div>}
      </div>
    </div>
  );
};

/* ============================================================
   ICONS
   ============================================================ */
const RefreshIcon = ({ spinning }) => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    style={{
      animation: spinning ? 'svp-spin 0.9s linear infinite' : 'none',
    }}
  >
    <path
      d="M3 12a9 9 0 0115-6.7L21 8M21 3v5h-5M21 12a9 9 0 01-15 6.7L3 16M3 21v-5h5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const SearchIcon = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.2"
  >
    <circle cx="11" cy="11" r="7" />
    <path d="M21 21l-4.3-4.3" strokeLinecap="round" />
  </svg>
);

const CheckIcon = () => (
  <svg
    width="13"
    height="13"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="3"
  >
    <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const XIcon = () => (
  <svg
    width="13"
    height="13"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
  >
    <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
  </svg>
);

/* ============================================================
   HELPERS
   ============================================================ */
function formatRelative(ts) {
  if (!ts) return '—';
  try {
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    const diff = Date.now() - d.getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins} minute${mins === 1 ? '' : 's'} ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs} hour${hrs === 1 ? '' : 's'} ago`;
    const days = Math.floor(hrs / 24);
    return `${days} day${days === 1 ? '' : 's'} ago`;
  } catch {
    return '—';
  }
}

export default SellerVerificationsPage;