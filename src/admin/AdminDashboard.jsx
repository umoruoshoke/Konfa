// src/admin/AdminDashboard.jsx
import { useEffect, useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import {
  fetchDashboardStats,
  fetchSellerApplications,
  fetchManufacturerApplications,
  fetchAuditLog,
} from './adminAuth';
import { fetchGroupedPendingVerifications } from './adminVerificationApi';
import {
  fetchGroupedPendingBrandVerifications,
  fetchVerifiedBrands,
} from './adminBrandVerificationApi';
import { fetchPendingSocialCodes } from './adminSocialApi';
import './AdminPortal.css';

const AdminDashboard = () => {
  const { admin } = useOutletContext();
  const [stats, setStats] = useState(null);
  const [recentSellerApps, setRecentSellerApps] = useState([]);
  const [recentMfrApps, setRecentMfrApps] = useState([]);
  const [recentAudit, setRecentAudit] = useState([]);
  const [pendingVerifs, setPendingVerifs] = useState({
    sellers: 0,
    owner: 0,
    business: 0,
    social: 0,
  });
  const [pendingBrandVerifs, setPendingBrandVerifs] = useState({
    brands: 0,
    owner: 0,
    social: 0,
  });
  const [verifiedBrands, setVerifiedBrands] = useState([]);
  
  const [socialCodes, setSocialCodes] = useState([]);
  const [showAllCodes, setShowAllCodes] = useState(false); 

  const [loading, setLoading] = useState(true);
  const [warnings, setWarnings] = useState([]);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      const problems = [];

      const [
        statsRes,
        sellerAppsRes,
        mfrAppsRes,
        auditRes,
        verifRes,
        brandVerifRes,
        verifiedBrandsRes,
        socialCodesRes,
      ] = await Promise.allSettled([
        fetchDashboardStats(),
        fetchSellerApplications({ status: 'pending', max: 5 }),
        fetchManufacturerApplications({ status: 'pending', max: 5 }),
        fetchAuditLog({ max: 6 }),
        fetchGroupedPendingVerifications(),
        fetchGroupedPendingBrandVerifications(),
        fetchVerifiedBrands({ max: 5 }),
        fetchPendingSocialCodes(),
      ]);

      if (cancelled) return;

      if (statsRes.status === 'fulfilled') {
        setStats(statsRes.value);
      } else {
        console.error('fetchDashboardStats failed:', statsRes.reason);
        problems.push('Dashboard stats');
        setStats({
          pendingApplications: 0,
          pendingManufacturerApplications: 0,
          activeSellers: 0,
          activeManufacturers: 0,
          totalUnits: 0,
          flaggedUnits: 0,
          totalScans: 0,
        });
      }

      if (sellerAppsRes.status === 'fulfilled') {
        setRecentSellerApps(sellerAppsRes.value || []);
      } else {
        console.error('fetchSellerApplications failed:', sellerAppsRes.reason);
        problems.push('Seller applications');
      }

      if (mfrAppsRes.status === 'fulfilled') {
        setRecentMfrApps(mfrAppsRes.value || []);
      } else {
        console.error(
          'fetchManufacturerApplications failed:',
          mfrAppsRes.reason
        );
        problems.push('Manufacturer applications');
      }

      if (auditRes.status === 'fulfilled') {
        setRecentAudit(auditRes.value || []);
      } else {
        console.warn('fetchAuditLog failed (non-fatal):', auditRes.reason);
      }

      if (verifRes.status === 'fulfilled') {
        const list = verifRes.value || [];
        const totals = list.reduce(
          (acc, g) => {
            acc.sellers += 1;
            acc.owner += g.pendingByKind.owner;
            acc.business += g.pendingByKind.business;
            acc.social += g.pendingByKind.social;
            return acc;
          },
          { sellers: 0, owner: 0, business: 0, social: 0 }
        );
        setPendingVerifs(totals);
      } else {
        console.warn(
          'fetchGroupedPendingVerifications failed:',
          verifRes.reason
        );
      }

      if (brandVerifRes.status === 'fulfilled') {
        const list = brandVerifRes.value || [];
        const totals = list.reduce(
          (acc, b) => {
            acc.brands += 1;
            acc.owner += b.pendingByKind.owner;
            acc.social += b.pendingByKind.social;
            return acc;
          },
          { brands: 0, owner: 0, social: 0 }
        );
        setPendingBrandVerifs(totals);
      } else {
        console.warn(
          'fetchGroupedPendingBrandVerifications failed:',
          brandVerifRes.reason
        );
      }

      if (verifiedBrandsRes.status === 'fulfilled') {
        setVerifiedBrands(verifiedBrandsRes.value || []);
      } else {
        console.warn('fetchVerifiedBrands failed:', verifiedBrandsRes.reason);
      }

      if (socialCodesRes.status === 'fulfilled') {
        setSocialCodes(socialCodesRes.value || []);
      } else {
        console.warn('fetchPendingSocialCodes failed:', socialCodesRes.reason);
      }

      setWarnings(problems);
      setLoading(false);
    };

    load();
    const interval = setInterval(load, 60000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    const pending =
      (stats?.pendingApplications || 0) +
      (stats?.pendingManufacturerApplications || 0) +
      (pendingVerifs.sellers || 0) +
      (pendingBrandVerifs.brands || 0) +
      socialCodes.length;
    document.title = pending > 0 ? `(${pending}) Konfa Admin` : 'Konfa Admin';
    return () => {
      document.title = 'Konfa Admin';
    };
  }, [stats, pendingVerifs, pendingBrandVerifs, socialCodes]);

  if (loading) {
    return (
      <div className="admin-page">
        <header className="admin-page-header">
          <div>
            <h1>Loading dashboard…</h1>
          </div>
        </header>
        <div className="admin-stat-grid">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="admin-skeleton-card" />
          ))}
        </div>
      </div>
    );
  }

  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  const firstName = admin.fullName?.split(' ')[0] || 'Admin';

  const totalPending =
    (stats.pendingApplications || 0) +
    (stats.pendingManufacturerApplications || 0);

  // Determine which codes to show based on the toggle
  const displayedCodes = showAllCodes ? socialCodes : socialCodes.slice(0, 5);
  const hasMoreCodes = socialCodes.length > 5;

  return (
    <div className="admin-page">
      <header className="admin-page-header admin-page-header-hero">
        <div>
          <h1>
            {greeting}, {firstName}
          </h1>
          <p>Here&apos;s what&apos;s happening across the Konfa platform.</p>
        </div>
        <div className="admin-header-date">
          {new Date().toLocaleDateString([], {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
            year: 'numeric',
          })}
        </div>
      </header>

      {warnings.length > 0 && (
        <div className="admin-error" style={{ marginBottom: 16 }}>
          <strong>Some data couldn&apos;t load: {warnings.join(', ')}</strong>
          <span>
            This is likely a permissions or index issue. Check the browser
            console for details.
          </span>
        </div>
      )}

      {stats.pendingManufacturerApplications > 0 && (
        <Link
          to="/admin/manufacturer-applications"
          className="admin-action-banner"
        >
          <div className="admin-action-banner-icon">!</div>
          <div className="admin-action-banner-body">
            <strong>
              {stats.pendingManufacturerApplications} manufacturer application
              {stats.pendingManufacturerApplications > 1 ? 's' : ''} waiting for
              review
            </strong>
            <span>Approve new manufacturers to let them generate QR codes.</span>
          </div>
          <div className="admin-action-banner-arrow">→</div>
        </Link>
      )}

      {stats.pendingApplications > 0 && (
        <Link to="/admin/approvals" className="admin-action-banner">
          <div className="admin-action-banner-icon">!</div>
          <div className="admin-action-banner-body">
            <strong>
              {stats.pendingApplications} seller application
              {stats.pendingApplications > 1 ? 's' : ''} waiting for your review
            </strong>
            <span>Applicants are usually approved within one business day.</span>
          </div>
          <div className="admin-action-banner-arrow">→</div>
        </Link>
      )}

      {pendingVerifs.sellers > 0 && (
        <Link
          to="/admin/seller-verifications"
          className="admin-action-banner admin-action-banner-verify"
        >
          <div className="admin-action-banner-icon">✓</div>
          <div className="admin-action-banner-body">
            <strong>
              {pendingVerifs.sellers} seller verification
              {pendingVerifs.sellers > 1 ? 's' : ''} waiting for review
            </strong>
            <span>
              {pendingVerifs.owner + pendingVerifs.business + pendingVerifs.social}{' '}
              items across owner, business, and social levels.
            </span>
          </div>
          <div className="admin-action-banner-arrow">→</div>
        </Link>
      )}

      {pendingBrandVerifs.brands > 0 && (
        <Link
          to="/admin/brand-verifications"
          className="admin-action-banner admin-action-banner-brand"
        >
          <div className="admin-action-banner-icon">✓</div>
          <div className="admin-action-banner-body">
            <strong>
              {pendingBrandVerifs.brands} brand
              {pendingBrandVerifs.brands > 1 ? 's' : ''} waiting for verification
            </strong>
            <span>
              {pendingBrandVerifs.owner} owner identity ·{' '}
              {pendingBrandVerifs.social} social account
              {pendingBrandVerifs.social === 1 ? '' : 's'} to review.
            </span>
          </div>
          <div className="admin-action-banner-arrow">→</div>
        </Link>
      )}

      <section className="admin-section">
        <div className="admin-section-header">
          <h2>Overview</h2>
        </div>

        <div className="admin-stat-grid">
          <StatCard
            label="Pending Approvals"
            value={totalPending}
            accent="amber"
            linkTo="/admin/approvals"
            hint="Sellers + manufacturers"
          />
          <StatCard
            label="Seller Verifications"
            value={pendingVerifs.sellers}
            accent={pendingVerifs.sellers > 0 ? 'amber' : 'teal'}
            linkTo="/admin/seller-verifications"
            hint={
              pendingVerifs.sellers > 0
                ? `${
                    pendingVerifs.owner +
                    pendingVerifs.business +
                    pendingVerifs.social
                  } items across 3 levels`
                : 'Nothing pending'
            }
          />
          <StatCard
            label="Brand Verifications"
            value={pendingBrandVerifs.brands}
            accent={pendingBrandVerifs.brands > 0 ? 'amber' : 'teal'}
            linkTo="/admin/brand-verifications"
            hint={
              pendingBrandVerifs.brands > 0
                ? `${
                    pendingBrandVerifs.owner + pendingBrandVerifs.social
                  } items to review`
                : 'Nothing pending'
            }
          />
          <StatCard
            label="Verified Brands"
            value={verifiedBrands.length}
            accent="teal"
            linkTo="/admin/verified-brands"
            hint="Identity confirmed"
          />
          <StatCard
            label="Active Sellers"
            value={stats.activeSellers}
            accent="teal"
            linkTo="/admin/sellers"
            hint="Operating now"
          />
          <StatCard
            label="Active Manufacturers"
            value={stats.activeManufacturers}
            accent="navy"
            linkTo="/admin/manufacturers"
            hint="Verified factories"
          />
          <StatCard
            label="Total Units"
            value={stats.totalUnits}
            accent="navy"
            formatNumber
            hint="Across all batches"
          />
          <StatCard
            label="Flagged Units"
            value={stats.flaggedUnits}
            accent={stats.flaggedUnits > 0 ? 'red' : 'green'}
            hint={stats.flaggedUnits > 0 ? 'Needs investigation' : 'All clear'}
          />
        </div>
      </section>

      {/* ================= TWO-COLUMN GRID ================= */}
      <div className="admin-dashboard-grid">
        
        {/* ================= PENDING SOCIAL CODES ================= */}
        <section className="admin-card" style={{ gridColumn: '1 / -1' }}>
          <div className="admin-card-header">
            <div>
              <h2>Pending Social Codes</h2>
              <p>Accounts awaiting manual verification. Click the handle to check their bio.</p>
            </div>
          </div>
          
          <div className="admin-card-table">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Platform</th>
                  <th>Handle</th>
                  <th>Code to find</th>
                  <th>Account Type</th>
                  <th className="admin-th-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {displayedCodes.length === 0 ? (
                  <tr>
                    <td colSpan="5" style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--ad-slate-500)' }}>
                      No pending social codes found.
                    </td>
                  </tr>
                ) : (
                  displayedCodes.map((item, idx) => (
                    <tr key={`${item.id}-${item.platform}-${idx}`} className="admin-tr">
                      <td>
                        <span className="admin-pill admin-pill-role" style={{ textTransform: 'capitalize' }}>
                          {item.platform}
                        </span>
                      </td>
                      <td>
                        <a href={item.link} target="_blank" rel="noreferrer" className="admin-link-strong" style={{ color: 'var(--ad-teal)' }}>
                          {item.handle} ↗
                        </a>
                      </td>
                      <td>
                        <code className="admin-code-small" style={{ background: 'var(--ad-amber-100)', color: '#92400e' }}>
                          {item.code}
                        </code>
                      </td>
                      <td>
                        <span className={`admin-badge-pill ${item.type === 'brand' ? 'admin-badge-brand' : 'admin-badge-seller'}`}>
                          {item.type === 'brand' ? 'Brand' : 'Seller'}
                        </span>
                      </td>
                      <td className="admin-td-actions">
                        <Link 
                          to={item.type === 'brand' ? `/admin/brand-verifications/${item.id}` : `/admin/seller-verifications/${item.id}`} 
                          className="admin-btn admin-btn-small admin-btn-primary"
                        >
                          Review
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          
          {/* 🔑 SHOW MORE BUTTON */}
          {hasMoreCodes && (
            <div style={{ padding: '16px', textAlign: 'center', borderTop: '1px solid var(--ad-slate-200)' }}>
              <button 
                type="button"
                className="admin-btn admin-btn-ghost"
                onClick={() => setShowAllCodes(!showAllCodes)}
              >
                {showAllCodes 
                  ? 'Show less' 
                  : `Show all ${socialCodes.length} pending codes ↓`}
              </button>
            </div>
          )}
        </section>

        <section className="admin-card">
          <div className="admin-card-header">
            <div>
              <h2>Pending applications</h2>
              <p>New sellers and manufacturers awaiting approval.</p>
            </div>
          </div>

          {recentSellerApps.length === 0 && recentMfrApps.length === 0 ? (
            <div className="admin-empty admin-empty-small">
              <div className="admin-empty-icon">🎉</div>
              <p>No pending applications. You&apos;re all caught up.</p>
            </div>
          ) : (
            <ul className="admin-app-list">
              {recentMfrApps.map((app) => (
                <li key={app.id} className="admin-app-item">
                  <div className="admin-app-avatar">
                    {app.companyName?.[0]?.toUpperCase() || '?'}
                  </div>
                  <div className="admin-app-info">
                    <strong>
                      {app.companyName}
                      <span className="admin-badge-pill admin-badge-mfr">
                        Manufacturer
                      </span>
                    </strong>
                    <span>{app.contactEmail}</span>
                  </div>
                  <Link
                    to={`/admin/manufacturer-applications/${app.id}`}
                    className="admin-btn admin-btn-small admin-btn-primary"
                  >
                    Review
                  </Link>
                </li>
              ))}
              {recentSellerApps.map((app) => (
                <li key={app.id} className="admin-app-item">
                  <div className="admin-app-avatar">
                    {app.companyName?.[0]?.toUpperCase() || '?'}
                  </div>
                  <div className="admin-app-info">
                    <strong>
                      {app.companyName}
                      <span className="admin-badge-pill admin-badge-seller">
                        Seller
                      </span>
                    </strong>
                    <span>
                      {app.requestedRole || 'Seller'} · {app.email}
                    </span>
                  </div>
                  <Link
                    to={`/admin/approvals/${app.id}`}
                    className="admin-btn admin-btn-small admin-btn-primary"
                  >
                    Review
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="admin-card">
          <div className="admin-card-header">
            <div>
              <h2>Recent activity</h2>
              <p>Latest actions by admins.</p>
            </div>
            {recentAudit.length > 0 && (
              <Link to="/admin/audit" className="admin-link">
                View all →
              </Link>
            )}
          </div>

          {recentAudit.length === 0 ? (
            <div className="admin-empty admin-empty-small">
              <p>No activity recorded yet.</p>
            </div>
          ) : (
            <ul className="admin-timeline">
              {recentAudit.map((entry) => (
                <li key={entry.id} className="admin-timeline-item">
                  <div
                    className={`admin-timeline-dot admin-timeline-${(
                      entry.action || 'default'
                    ).split('_')[0]}`}
                  />
                  <div className="admin-timeline-body">
                    <strong>{formatAction(entry.action)}</strong>
                    <span>
                      by {entry.actorName || 'System'}
                      {entry.details?.companyName &&
                        ` · ${entry.details.companyName}`}
                    </span>
                    <small>{formatRelativeTime(entry.timestamp)}</small>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="admin-card">
          <div className="admin-card-header">
            <div>
              <h2>Recently verified brands</h2>
              <p>Brands with a verified owner identity.</p>
            </div>
            {verifiedBrands.length > 0 && (
              <Link to="/admin/verified-brands" className="admin-link">
                View all →
              </Link>
            )}
          </div>

          {verifiedBrands.length === 0 ? (
            <div className="admin-empty admin-empty-small">
              <p>No verified brands yet.</p>
            </div>
          ) : (
            <ul className="admin-app-list">
              {verifiedBrands.map((b) => {
                const accounts = Object.values(b.accounts || {}).filter(
                  (a) => a?.status === 'verified'
                ).length;
                return (
                  <li key={b.id} className="admin-app-item">
                    <div className="admin-app-avatar admin-app-avatar-brand">
                      {b.brandDisplayName?.[0]?.toUpperCase() || 'B'}
                    </div>
                    <div className="admin-app-info">
                      <strong>
                        {b.brandDisplayName || 'Unnamed brand'}
                        <span className="admin-badge-pill admin-badge-brand">
                          Brand
                        </span>
                      </strong>
                      <span>
                        {b.brandEmail || '—'} · {accounts} account
                        {accounts === 1 ? '' : 's'} linked
                      </span>
                    </div>
                    <Link
                      to={`/admin/brand-verifications/${b.id}`}
                      className="admin-btn admin-btn-small admin-btn-ghost"
                    >
                      View
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
};

// ============================================================
// SUB-COMPONENTS
// ============================================================
const StatCard = ({
  label,
  value,
  accent,
  linkTo,
  hint,
  formatNumber = false,
}) => {
  const displayValue = (() => {
    if (value === null || value === undefined) return '0';
    if (formatNumber && typeof value === 'number') return value.toLocaleString();
    return value;
  })();

  const content = (
    <div className={`admin-stat-card admin-stat-${accent}`}>
      <span className="admin-stat-label">{label}</span>
      <span className="admin-stat-value">{displayValue}</span>
      {hint && <span className="admin-stat-hint">{hint}</span>}
    </div>
  );

  return linkTo ? (
    <Link to={linkTo} className="admin-stat-link">
      {content}
    </Link>
  ) : (
    content
  );
};

// ============================================================
// HELPERS
// ============================================================
const formatAction = (action) => {
  const map = {
    approve_seller: 'Approved a seller',
    reject_seller: 'Rejected a seller',
    suspend_seller: 'Suspended a seller',
    reactivate_seller: 'Reactivated a seller',
    approve_manufacturer: 'Approved a manufacturer',
    reject_manufacturer: 'Rejected a manufacturer',
    suspend_manufacturer: 'Suspended a manufacturer',
    reactivate_manufacturer: 'Reactivated a manufacturer',
    invite_admin: 'Invited an admin',
    update_admin_permissions: 'Updated admin permissions',
    deactivate_admin: 'Deactivated an admin',
    create_admin: 'Created an admin account',
    approve_owner: 'Approved owner identity',
    reject_owner: 'Rejected owner identity',
    approve_business: 'Approved business identity',
    reject_business: 'Rejected business identity',
    approve: 'Approved social account',
    reject: 'Rejected social account',
    dispute: 'Disputed social account',
    approve_brand_owner: 'Approved a brand owner',
    reject_brand_owner: 'Rejected a brand owner',
    approve_brand_social: 'Approved a brand social account',
    reject_brand_social: 'Rejected a brand social account',
    dispute_brand_social: 'Disputed a brand social account',
  };
  return map[action] || (action || '').replace(/_/g, ' ');
};

const formatRelativeTime = (ts) => {
  if (!ts) return '—';
  try {
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    const diff = Date.now() - d.getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d ago`;
    return d.toLocaleDateString([], { day: '2-digit', month: 'short' });
  } catch {
    return '—';
  }
};

export default AdminDashboard;