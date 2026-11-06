// src/admin/VerifiedSellersDirectory.jsx
import { useEffect, useMemo, useState } from 'react';
import {
  fetchVerifiedSellers,
  logAdminReveal,
  revokeOwnerVerification,
  revokeBusinessVerification,
  revokeVerification,
} from './adminVerificationApi';
import './VerifiedSellersDirectory.css';

/* ============================================================
   FILTERS
   ============================================================ */
const FILTERS = [
  { key: 'all', label: 'All verified' },
  { key: 'owner', label: 'Owner verified', match: (s) => s.verifiedLevels.owner },
  { key: 'business', label: 'Business verified', match: (s) => s.verifiedLevels.business },
  { key: 'social', label: 'Social verified', match: (s) => s.verifiedLevels.social > 0 },
  { key: 'fully', label: 'Fully verified', match: (s) => s.overallStatus === 'fully_verified' },
];

/* ============================================================
   MAIN PAGE
   ============================================================ */
const VerifiedSellersDirectory = () => {
  const [sellers, setSellers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedUid, setSelectedUid] = useState(null);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('recent');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const list = await fetchVerifiedSellers();
      setSellers(list);
      setSelectedUid((prev) => {
        if (prev && list.some((s) => s.sellerUid === prev)) return prev;
        return list[0]?.sellerUid || null;
      });
    } catch (err) {
      console.error('fetchVerifiedSellers failed:', err);
      setError(err.message || 'Could not load verified sellers.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const counts = useMemo(() => {
    const out = { all: sellers.length };
    for (const f of FILTERS) {
      if (f.key === 'all') continue;
      out[f.key] = sellers.filter(f.match).length;
    }
    return out;
  }, [sellers]);

  const filteredSorted = useMemo(() => {
    let list = sellers;

    if (filter !== 'all') {
      const f = FILTERS.find((x) => x.key === filter);
      if (f?.match) list = list.filter(f.match);
    }

    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter((s) => {
        const name = (s.sellerDisplayName || '').toLowerCase();
        const email = (s.sellerEmail || '').toLowerCase();
        const legal = (s.owner?.legalName || '').toLowerCase();
        const biz = (s.business?.businessName || '').toLowerCase();
        const uid = (s.sellerUid || '').toLowerCase();
        return (
          name.includes(q) ||
          email.includes(q) ||
          legal.includes(q) ||
          biz.includes(q) ||
          uid.includes(q)
        );
      });
    }

    const sorted = [...list];
    switch (sort) {
      case 'recent':
        sorted.sort((a, b) => (b.lastVerifiedMs ?? 0) - (a.lastVerifiedMs ?? 0));
        break;
      case 'oldest':
        sorted.sort((a, b) => (a.firstVerifiedMs ?? 0) - (b.firstVerifiedMs ?? 0));
        break;
      case 'name':
        sorted.sort((a, b) => {
          const an = (a.sellerDisplayName || a.owner?.legalName || '').toLowerCase();
          const bn = (b.sellerDisplayName || b.owner?.legalName || '').toLowerCase();
          return an.localeCompare(bn);
        });
        break;
      default:
        break;
    }
    return sorted;
  }, [sellers, filter, search, sort]);

  const selected = useMemo(
    () => sellers.find((s) => s.sellerUid === selectedUid) || null,
    [sellers, selectedUid]
  );

  const handleExportCsv = () => {
    const rows = [
      [
        'Display name',
        'Email',
        'Seller UID',
        'Legal name',
        'Business name',
        'Overall status',
        'Owner verified',
        'Business verified',
        'Social verified count',
        'First verified',
        'Last verified',
        'Public slug',
      ],
      ...filteredSorted.map((s) => [
        s.sellerDisplayName || '',
        s.sellerEmail || '',
        s.sellerUid,
        s.owner?.legalName || '',
        s.business?.businessName || '',
        s.overallStatus || '',
        s.verifiedLevels.owner ? 'Yes' : 'No',
        s.verifiedLevels.business ? 'Yes' : 'No',
        s.verifiedLevels.social,
        s.firstVerifiedMs ? new Date(s.firstVerifiedMs).toISOString() : '',
        s.lastVerifiedMs ? new Date(s.lastVerifiedMs).toISOString() : '',
        s.publicSlug || '',
      ]),
    ];

    const csv = rows
      .map((r) =>
        r
          .map((cell) => {
            const str = String(cell ?? '');
            return str.includes(',') || str.includes('"') || str.includes('\n')
              ? `"${str.replace(/"/g, '""')}"`
              : str;
          })
          .join(',')
      )
      .join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `konfa-verified-sellers-${new Date()
      .toISOString()
      .slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="vsd-page">
      <header className="vsd-header">
        <div>
          <h1>Verified Sellers Directory</h1>
          <p>
            Every seller whose identity, business, or social accounts have been
            approved by Konfa. Permanent record — once verified, always listed.
          </p>
        </div>
        <div className="vsd-header-actions">
          <button
            type="button"
            className="vsd-btn vsd-btn-ghost"
            onClick={load}
            disabled={loading}
          >
            <RefreshIcon spinning={loading} />
            {loading ? 'Loading…' : 'Refresh'}
          </button>
          <button
            type="button"
            className="vsd-btn vsd-btn-primary"
            onClick={handleExportCsv}
            disabled={filteredSorted.length === 0}
          >
            <DownloadIcon />
            Export CSV
          </button>
        </div>
      </header>

      <div className="vsd-stats">
        <StatCard
          label="Total verified"
          value={counts.all}
          accent="navy"
          active={filter === 'all'}
          onClick={() => setFilter('all')}
        />
        <StatCard
          label="Owner verified"
          value={counts.owner}
          accent="purple"
          active={filter === 'owner'}
          onClick={() => setFilter(filter === 'owner' ? 'all' : 'owner')}
        />
        <StatCard
          label="Business verified"
          value={counts.business}
          accent="teal"
          active={filter === 'business'}
          onClick={() => setFilter(filter === 'business' ? 'all' : 'business')}
        />
        <StatCard
          label="Social verified"
          value={counts.social}
          accent="amber"
          active={filter === 'social'}
          onClick={() => setFilter(filter === 'social' ? 'all' : 'social')}
        />
        <StatCard
          label="Fully verified"
          value={counts.fully}
          accent="green"
          active={filter === 'fully'}
          onClick={() => setFilter(filter === 'fully' ? 'all' : 'fully')}
        />
      </div>

      {error && <div className="vsd-error">{error}</div>}

      <div className="vsd-toolbar">
        <div className="vsd-search">
          <SearchIcon />
          <input
            type="text"
            placeholder="Search by name, email, legal name, or business name…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="vsd-sort">
          <label htmlFor="vsd-sort">Sort:</label>
          <select
            id="vsd-sort"
            value={sort}
            onChange={(e) => setSort(e.target.value)}
          >
            <option value="recent">Recently verified</option>
            <option value="oldest">Oldest verified first</option>
            <option value="name">Alphabetical (A–Z)</option>
          </select>
        </div>

        <div className="vsd-count">
          Showing <strong>{filteredSorted.length}</strong> of{' '}
          <strong>{sellers.length}</strong>
        </div>
      </div>

      {!loading && sellers.length === 0 ? (
        <div className="vsd-empty">
          <div className="vsd-empty-icon">🛡</div>
          <h2>No verified sellers yet</h2>
          <p>
            Once a seller completes at least one verification level and an
            admin approves it, they will appear here permanently.
          </p>
        </div>
      ) : (
        <div className="vsd-grid">
          <aside className="vsd-list">
            {loading ? (
              <SkeletonList />
            ) : filteredSorted.length === 0 ? (
              <div className="vsd-list-empty">
                No verified sellers match your search.
              </div>
            ) : (
              <div className="vsd-list-items">
                {filteredSorted.map((s) => (
                  <SellerListItem
                    key={s.sellerUid}
                    seller={s}
                    active={s.sellerUid === selectedUid}
                    onClick={() => setSelectedUid(s.sellerUid)}
                  />
                ))}
              </div>
            )}
          </aside>

          <section className="vsd-detail">
            {selected ? (
              <SellerDetail
                key={selected.sellerUid}
                seller={selected}
                onReload={load}
              />
            ) : (
              <div className="vsd-detail-empty">
                <div className="vsd-detail-empty-icon">👈</div>
                <p>Select a seller to see their full verified profile.</p>
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
};

/* ============================================================
   STAT CARD
   ============================================================ */
const StatCard = ({ label, value, accent, active, onClick }) => (
  <button
    type="button"
    className={`vsd-stat vsd-stat-${accent} ${active ? 'active' : ''}`}
    onClick={onClick}
  >
    <span className="vsd-stat-label">{label}</span>
    <span className="vsd-stat-value">{value}</span>
  </button>
);

/* ============================================================
   LIST ITEM
   ============================================================ */
const SellerListItem = ({ seller, active, onClick }) => {
  const badges = [];
  if (seller.verifiedLevels.owner) badges.push({ label: 'Owner', tone: 'purple' });
  if (seller.verifiedLevels.business)
    badges.push({ label: 'Business', tone: 'teal' });
  if (seller.verifiedLevels.social > 0)
    badges.push({
      label: `${seller.verifiedLevels.social} social`,
      tone: 'amber',
    });

  const isFully = seller.overallStatus === 'fully_verified';

  return (
    <button
      type="button"
      className={`vsd-list-item ${active ? 'active' : ''}`}
      onClick={onClick}
    >
      <div className="vsd-list-item-avatar">
        {(seller.sellerDisplayName || seller.owner?.legalName || 'S')
          .charAt(0)
          .toUpperCase()}
        {isFully && (
          <span className="vsd-list-item-verified" title="Fully verified">
            ✓
          </span>
        )}
      </div>

      <div className="vsd-list-item-main">
        <div className="vsd-list-item-name">
          {seller.sellerDisplayName ||
            seller.owner?.legalName ||
            seller.sellerEmail ||
            seller.sellerUid.slice(0, 8)}
        </div>
        <div className="vsd-list-item-sub">
          {seller.sellerEmail || seller.sellerUid}
        </div>
        <div className="vsd-list-item-badges">
          {badges.map((b, i) => (
            <span key={i} className={`vsd-badge vsd-badge-${b.tone}`}>
              {b.label}
            </span>
          ))}
        </div>
      </div>
    </button>
  );
};

/* ============================================================
   DETAIL PANEL
   ============================================================ */
const SellerDetail = ({ seller, onReload }) => {
  const owner = seller.owner || {};
  const business = seller.business || {};
  const accounts = seller.accounts || {};
  const publicProfile = seller.publicProfile || {};

  const ownerVerified = owner.status === 'verified';
  const businessVerified = business.status === 'verified';
  const verifiedAccounts = Object.values(accounts).filter(
    (a) => a.status === 'verified'
  );

  const statusMeta = {
    fully_verified: { label: 'Fully verified', tone: 'green' },
    partially_verified: { label: 'Partially verified', tone: 'amber' },
    owner_verified: { label: 'Owner verified', tone: 'teal' },
    unverified: { label: 'Not verified', tone: 'slate' },
  }[seller.overallStatus] || { label: 'Verified', tone: 'green' };

  return (
    <div className="vsd-detail-body">
      <header className="vsd-detail-head">
        <div className="vsd-detail-head-left">
          <div className="vsd-detail-avatar">
            {(seller.sellerDisplayName || seller.owner?.legalName || 'S')
              .charAt(0)
              .toUpperCase()}
          </div>
          <div>
            <h2>
              {seller.sellerDisplayName ||
                seller.owner?.legalName ||
                seller.sellerEmail ||
                'Seller'}
            </h2>
            <div className="vsd-detail-sub">
              {seller.sellerEmail || seller.sellerUid}
            </div>
            <div className="vsd-detail-head-meta">
              <span className={`vsd-status vsd-status-${statusMeta.tone}`}>
                {statusMeta.label}
              </span>
              {seller.lastVerifiedMs && (
                <span className="vsd-detail-head-since">
                  Last verified {formatDate(seller.lastVerifiedMs)}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="vsd-detail-head-actions">
          {seller.publicSlug && (
            <a
              className="vsd-btn vsd-btn-ghost"
              href={`/s/${seller.publicSlug}`}
              target="_blank"
              rel="noreferrer noopener"
            >
              View public profile ↗
            </a>
          )}
        </div>
      </header>

      {/* ============ LEVEL 1 — OWNER ============ */}
      <section className="vsd-level">
        <div className="vsd-level-head">
          <div className="vsd-level-title">
            <span className="vsd-level-num">1</span>
            <div>
              <strong>Owner identity</strong>
              <span>Personal identity verified against NIN</span>
            </div>
          </div>
          {ownerVerified && (
            <span className="vsd-approved-pill">
              <CheckIcon /> Approved
            </span>
          )}
        </div>

        {!ownerVerified ? (
          <div className="vsd-level-empty">
            {owner.status === 'revoked'
              ? `Revoked${owner.revokeReason ? ` — ${owner.revokeReason}` : ''}`
              : owner.status === 'rejected'
              ? `Rejected${owner.rejectionReason ? ` — ${owner.rejectionReason}` : ''}`
              : owner.status === 'pending'
              ? 'Still pending review — not approved yet.'
              : 'Not submitted.'}
          </div>
        ) : (
          <>
            <div className="vsd-field-grid">
              <Field label="Full legal name" value={owner.legalName} />
              <Field
                label="Name on bank account"
                value={owner.bankAccount?.accountName}
              />
              <Field label="Bank" value={owner.bankAccount?.bankName} />
              <RevealField
                label="Account number"
                value={owner.bankAccount?.accountNumber}
                sellerUid={seller.sellerUid}
                field="account_number"
              />
              <RevealField
                label="NIN"
                value={owner.nin}
                sellerUid={seller.sellerUid}
                field="nin"
              />
              <Field
                label="Name match"
                value={
                  owner.nameMatch === true
                    ? 'Legal name matches account name'
                    : 'Did not fully match — admin approved with note'
                }
                tone={owner.nameMatch ? 'ok' : 'warn'}
              />
              <Field
                label="Submitted"
                value={owner.submittedAt ? formatDate(owner.submittedAt) : '—'}
              />
              <Field
                label="Approved"
                value={owner.verifiedAt ? formatDate(owner.verifiedAt) : '—'}
              />
              {owner.verifiedBy && (
                <Field label="Approved by" value={owner.verifiedBy} mono />
              )}
            </div>

            {(owner.ninDocumentData || owner.selfieWithNinData) && (
              <div className="vsd-docs">
                <div className="vsd-docs-head">
                  <strong>Identity documents</strong>
                  <span className="vsd-docs-hint">
                    Full-resolution images on file
                  </span>
                </div>
                <div className="vsd-docs-grid">
                  {owner.ninDocumentData && (
                    <DocImage
                      src={owner.ninDocumentData}
                      label="NIN document"
                      sellerUid={seller.sellerUid}
                      field="nin_document"
                    />
                  )}
                  {owner.selfieWithNinData && (
                    <DocImage
                      src={owner.selfieWithNinData}
                      label="Selfie with NIN"
                      sellerUid={seller.sellerUid}
                      field="nin_selfie"
                    />
                  )}
                </div>
              </div>
            )}

            <RevokeAction
              label="Owner"
              onConfirm={async (reason) => {
                await revokeOwnerVerification({
                  sellerUid: seller.sellerUid,
                  reason,
                });
                await onReload();
              }}
            />
          </>
        )}
      </section>

      {/* ============ LEVEL 2 — BUSINESS ============ */}
      <section className="vsd-level">
        <div className="vsd-level-head">
          <div className="vsd-level-title">
            <span className="vsd-level-num">2</span>
            <div>
              <strong>Business identity</strong>
              <span>Registered CAC or owner-attested business</span>
            </div>
          </div>
          {businessVerified && (
            <span className="vsd-approved-pill">
              <CheckIcon /> Approved
            </span>
          )}
        </div>

        {!businessVerified ? (
          <div className="vsd-level-empty">
            {business.status === 'revoked'
              ? `Revoked${business.revokeReason ? ` — ${business.revokeReason}` : ''}`
              : business.status === 'rejected'
              ? `Rejected${business.rejectionReason ? ` — ${business.rejectionReason}` : ''}`
              : business.status === 'pending'
              ? 'Still pending review — not approved yet.'
              : 'Not submitted.'}
          </div>
        ) : (
          <>
            <div className="vsd-field-grid">
              <Field
                label="Business type"
                value={
                  business.type === 'registered'
                    ? 'Registered (CAC)'
                    : 'Informal / individual'
                }
              />
              <Field label="Business name" value={business.businessName} />
              {business.type === 'registered' && (
                <Field
                  label="CAC number"
                  value={business.registered?.cacNumber}
                  mono
                />
              )}
              {business.type === 'unregistered' && (
                <Field
                  label="Owner"
                  value={business.unregistered?.ownerName}
                />
              )}
              <Field
                label="Address"
                value={[
                  business.address?.physical,
                  business.address?.city,
                  business.address?.state,
                ]
                  .filter(Boolean)
                  .join(', ')}
              />
              <Field label="Phone" value={business.contact?.phone} />
              <Field label="Email" value={business.contact?.email} />
              <Field label="Website" value={business.contact?.website} />
              <Field
                label="Submitted"
                value={
                  business.submittedAt ? formatDate(business.submittedAt) : '—'
                }
              />
              <Field
                label="Approved"
                value={
                  business.verifiedAt ? formatDate(business.verifiedAt) : '—'
                }
              />
              {business.verifiedBy && (
                <Field
                  label="Approved by"
                  value={business.verifiedBy}
                  mono
                />
              )}
            </div>

            {business.registered?.certificateUrl && (
              <a
                className="vsd-doc-link"
                href={business.registered.certificateUrl}
                target="_blank"
                rel="noreferrer noopener"
              >
                📎 View CAC certificate
              </a>
            )}

            <RevokeAction
              label="Business"
              onConfirm={async (reason) => {
                await revokeBusinessVerification({
                  sellerUid: seller.sellerUid,
                  reason,
                });
                await onReload();
              }}
            />
          </>
        )}
      </section>

      {/* ============ LEVEL 3 — SOCIAL ============ */}
      <section className="vsd-level">
        <div className="vsd-level-head">
          <div className="vsd-level-title">
            <span className="vsd-level-num">3</span>
            <div>
              <strong>Social accounts</strong>
              <span>Accounts proven to be owned by this seller</span>
            </div>
          </div>
          {verifiedAccounts.length > 0 && (
            <span className="vsd-approved-pill">
              <CheckIcon /> {verifiedAccounts.length} approved
            </span>
          )}
        </div>

        {verifiedAccounts.length === 0 ? (
          <div className="vsd-level-empty">
            No verified social accounts yet.
          </div>
        ) : (
          <div className="vsd-social-list">
            {verifiedAccounts.map((acc) => (
              <div key={acc.platform} className="vsd-social-row">
                <div
                  className="vsd-social-accent"
                  style={{
                    background: platformAccent(acc.platform),
                  }}
                />
                <div className="vsd-social-body">
                  <div className="vsd-social-head">
                    <span className="vsd-social-platform">
                      {acc.platform}
                    </span>
                    {acc.verifiedAt && (
                      <span className="vsd-social-since">
                        Approved {formatDate(acc.verifiedAt)}
                      </span>
                    )}
                  </div>
                  <div className="vsd-social-handle">
                    @{(acc.handle || '').replace(/^@/, '')}
                  </div>
                  {acc.verifiedBy && (
                    <div className="vsd-social-meta">
                      Verified by {acc.verifiedBy}
                    </div>
                  )}
                  <div className="vsd-social-actions-row">
                    {acc.url && (
                      <a
                        className="vsd-social-link"
                        href={acc.url}
                        target="_blank"
                        rel="noreferrer noopener"
                      >
                        Open profile ↗
                      </a>
                    )}
                    <RevokeAction
                      small
                      label={acc.platform}
                      onConfirm={async (reason) => {
                        await revokeVerification({
                          sellerUid: seller.sellerUid,
                          platform: acc.platform,
                          reason,
                        });
                        await onReload();
                      }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ============ LEVEL 4 — PUBLIC PROFILE ============ */}
      <section className="vsd-level">
        <div className="vsd-level-head">
          <div className="vsd-level-title">
            <span className="vsd-level-num">4</span>
            <div>
              <strong>Public profile</strong>
              <span>What customers see on the seller's public page</span>
            </div>
          </div>
          <span
            className={`vsd-status vsd-status-${
              publicProfile.enabled ? 'green' : 'slate'
            }`}
          >
            {publicProfile.enabled ? 'Live' : 'Private'}
          </span>
        </div>

        {!publicProfile.displayName && !seller.publicSlug ? (
          <div className="vsd-level-empty">
            No public profile has been configured.
          </div>
        ) : (
          <div className="vsd-field-grid">
            <Field label="Display name" value={publicProfile.displayName} />
            <Field label="Category" value={publicProfile.category} />
            <Field
              label="Description"
              value={publicProfile.description}
              block
            />
            <Field
              label="Public slug"
              value={seller.publicSlug ? `/s/${seller.publicSlug}` : null}
              mono
            />
            <Field
              label="Show owner name"
              value={publicProfile.showOwnerName ? 'Yes' : 'No'}
            />
            <Field
              label="Show business"
              value={publicProfile.showBusiness ? 'Yes' : 'No'}
            />
          </div>
        )}
      </section>
    </div>
  );
};

/* ============================================================
   FIELD COMPONENTS
   ============================================================ */
const Field = ({ label, value, mono, block, tone }) => {
  const isEmpty = value === null || value === undefined || value === '';
  return (
    <div className={`vsd-field ${block ? 'vsd-field-block' : ''}`}>
      <span className="vsd-field-label">{label}</span>
      <span
        className={`vsd-field-value ${mono ? 'vsd-mono' : ''} ${
          tone ? `vsd-field-${tone}` : ''
        }`}
      >
        {isEmpty ? '—' : value}
      </span>
    </div>
  );
};

const RevealField = ({ label, value, sellerUid, field }) => {
  const [revealed, setRevealed] = useState(false);
  if (!value) return <Field label={label} value="—" />;
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
    <div className="vsd-field">
      <span className="vsd-field-label">{label}</span>
      <span
        className={`vsd-field-value vsd-mono ${
          revealed ? 'revealed' : ''
        }`}
      >
        {revealed ? value : masked}
        <button type="button" className="vsd-reveal-btn" onClick={toggle}>
          {revealed ? 'Hide' : 'Reveal'}
        </button>
      </span>
    </div>
  );
};

/* ============================================================
   REVOKE ACTION
   ============================================================ */
const RevokeAction = ({ label, small, onConfirm }) => {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [done, setDone] = useState(false);

  const submit = async () => {
    if (reason.trim().length < 5) {
      setErr('Please enter at least 5 characters.');
      return;
    }
    setBusy(true);
    setErr('');
    try {
      await onConfirm(reason.trim());
      setDone(true);
      setTimeout(() => {
        setOpen(false);
        setDone(false);
        setReason('');
      }, 800);
    } catch (e) {
      setErr(e.message || 'Failed.');
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    return (
      <div className="vsd-revoke-done">
        ✓ Revoked {label.toLowerCase()}
      </div>
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        className={`vsd-revoke-btn ${small ? 'vsd-revoke-btn-sm' : ''}`}
        onClick={() => setOpen(true)}
      >
        ⚠ Revoke {label}
      </button>
    );
  }

  return (
    <div className="vsd-revoke-box">
      <label className="vsd-revoke-label">
        Reason for revoking {label.toLowerCase()}
      </label>
      <textarea
        rows="3"
        placeholder="Explain why this verification is being revoked. This is shown to the seller and saved to the audit log."
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        disabled={busy}
      />
      {err && <div className="vsd-revoke-err">{err}</div>}
      <div className="vsd-revoke-actions">
        <button
          type="button"
          className="vsd-btn vsd-btn-ghost"
          onClick={() => {
            setOpen(false);
            setReason('');
            setErr('');
          }}
          disabled={busy}
        >
          Cancel
        </button>
        <button
          type="button"
          className="vsd-btn vsd-btn-danger"
          onClick={submit}
          disabled={busy || reason.trim().length < 5}
        >
          {busy ? 'Revoking…' : 'Confirm revoke'}
        </button>
      </div>
    </div>
  );
};

/* ============================================================
   DOCUMENT IMAGE
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
      <div className="vsd-doc">
        <div className="vsd-doc-label">{label}</div>
        <button
          type="button"
          className="vsd-doc-thumb"
          onClick={openFull}
          aria-label={`Open ${label}`}
        >
          <img src={src} alt={label} />
          <span className="vsd-doc-zoom">Click to enlarge</span>
        </button>
      </div>

      {open && (
        <div className="vsd-lightbox" onClick={() => setOpen(false)}>
          <div
            className="vsd-lightbox-inner"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              className="vsd-lightbox-close"
              onClick={() => setOpen(false)}
              aria-label="Close"
            >
              ✕
            </button>
            <div className="vsd-lightbox-label">{label}</div>
            <img src={src} alt={label} className="vsd-lightbox-img" />
          </div>
        </div>
      )}
    </>
  );
};

/* ============================================================
   SKELETON
   ============================================================ */
const SkeletonList = () => (
  <div className="vsd-list-items">
    {[1, 2, 3, 4, 5].map((i) => (
      <div key={i} className="vsd-list-item vsd-list-item-skeleton">
        <div className="vsd-skel vsd-skel-avatar" />
        <div className="vsd-skel-group">
          <div className="vsd-skel vsd-skel-line" style={{ width: '70%' }} />
          <div className="vsd-skel vsd-skel-line" style={{ width: '50%' }} />
        </div>
      </div>
    ))}
  </div>
);

/* ============================================================
   ICONS
   ============================================================ */
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

const RefreshIcon = ({ spinning }) => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    style={{
      animation: spinning ? 'vsd-spin 0.9s linear infinite' : 'none',
    }}
  >
    <path
      d="M3 12a9 9 0 0115-6.7L21 8M21 3v5h-5M21 12a9 9 0 01-15 6.7L3 16M3 21v-5h5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const DownloadIcon = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.2"
  >
    <path
      d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const CheckIcon = () => (
  <svg
    width="12"
    height="12"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="3.5"
  >
    <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

/* ============================================================
   HELPERS
   ============================================================ */
function platformAccent(platform) {
  switch (platform) {
    case 'instagram':
      return 'linear-gradient(135deg, #F58529, #DD2A7B 50%, #8134AF)';
    case 'tiktok':
      return '#000000';
    case 'youtube':
      return '#FF0000';
    case 'facebook':
      return '#1877F2';
    case 'x':
      return '#000000';
    case 'whatsapp':
      return '#25D366';
    case 'website':
      return '#0d9488';
    default:
      return '#64748b';
  }
}

function formatDate(ts) {
  if (!ts) return '—';
  try {
    const d = ts.toDate
      ? ts.toDate()
      : ts instanceof Date
      ? ts
      : new Date(ts);
    return d.toLocaleDateString([], {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return '—';
  }
}

export default VerifiedSellersDirectory;