// src/consumer/ConsumerHome.jsx
import { useEffect, useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import {
  fetchConsumerStats,
  fetchConsumerScans,
  fetchConsumerAlerts,
} from './consumerAuth';
import './ConsumerPortal.css';

const ConsumerHome = () => {
  const { consumer } = useOutletContext();
  const [stats, setStats] = useState(null);
  const [recentScans, setRecentScans] = useState([]);
  const [recentAlerts, setRecentAlerts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!consumer?.id) return;

    (async () => {
      try {
        const [s, scans, alerts] = await Promise.all([
          fetchConsumerStats(consumer.id),
          fetchConsumerScans(consumer.id, 8),
          fetchConsumerAlerts(consumer.id, 4),
        ]);
        setStats(s);
        setRecentScans(scans);
        setRecentAlerts(alerts);
      } catch (err) {
        console.error('Dashboard load error:', err);
      } finally {
        setLoading(false);
      }
    })();
  }, [consumer?.id]);

  if (loading) {
    return (
      <div className="cp-page">
        <DashboardSkeleton />
      </div>
    );
  }

  const firstName = (consumer.fullName || '').split(' ')[0] || 'there';
  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';

  const memberSince = consumer.createdAt?.toDate
    ? consumer.createdAt.toDate().toLocaleDateString([], {
        month: 'short',
        year: 'numeric',
      })
    : null;

  return (
    <div className="cp-page">
      {/* ---------- PAGE HEADER ---------- */}
      <div className="cp-page-header">
        <div>
          <h1>Dashboard</h1>
          <p>Your verification activity at a glance</p>
        </div>
      </div>

      {/* ---------- HERO HEADER ---------- */}
      <header className="cp-hero">
        <div className="cp-hero-text">
          <h1>
            {greeting}, {firstName}
          </h1>
          <p>
            {stats?.totalScans > 0
              ? `You've verified ${stats.totalScans} product${
                  stats.totalScans === 1 ? '' : 's'
                } so far${
                  stats.distinctCities > 0
                    ? ` across ${stats.distinctCities} ${
                        stats.distinctCities === 1 ? 'city' : 'cities'
                      }`
                    : ''
                }.`
              : 'Welcome to Konfa — verify your first product to get started.'}
          </p>
          {memberSince && (
            <span className="cp-hero-since">Member since {memberSince}</span>
          )}
        </div>
        <Link to="/verify" className="cp-btn cp-btn-primary cp-btn-lg">
          <ShieldIcon />
          Verify a Product
        </Link>
      </header>

      {/* ---------- KPI CARDS ---------- */}
      <div className="cp-stat-grid">
        <StatCard
          label="Total Scans"
          value={stats.totalScans}
          accent="navy"
          icon={<ScanIcon />}
        />
        <StatCard
          label="Authentic"
          value={stats.authenticScans}
          accent="green"
          icon={<CheckIcon />}
          hint={
            stats.totalScans > 0
              ? `${Math.round(
                  (stats.authenticScans / stats.totalScans) * 100
                )}% of scans`
              : null
          }
        />
        <StatCard
          label="Flagged"
          value={stats.flaggedScans}
          accent={stats.flaggedScans > 0 ? 'red' : 'green'}
          icon={<FlagIcon />}
          hint={stats.flaggedScans > 0 ? 'Needs attention' : 'All clear'}
        />
        <StatCard
          label="Saved"
          value={stats.savedProducts}
          accent="teal"
          icon={<BookmarkIcon />}
        />
        <StatCard
          label="Unread Alerts"
          value={stats.unreadAlerts}
          accent={stats.unreadAlerts > 0 ? 'amber' : 'green'}
          icon={<BellIcon />}
        />
      </div>

      {/* ---------- TWO COLUMN ---------- */}
      <div className="cp-dashboard-grid">
        {/* ---------- RECENT SCANS ---------- */}
        <section className="cp-card cp-card-wide">
          <div className="cp-card-header">
            <div>
              <h2>Recent Scans</h2>
              <p>Your latest product verifications</p>
            </div>
            <Link to="/consumer/history" className="cp-link">
              View all →
            </Link>
          </div>

          {recentScans.length === 0 ? (
            <EmptyScans />
          ) : (
            <ul className="cp-scan-cards">
              {recentScans.map((scan) => (
                <ScanCard key={scan.id} scan={scan} />
              ))}
            </ul>
          )}
        </section>

        {/* ---------- RECENT ALERTS ---------- */}
        <section className="cp-card">
          <div className="cp-card-header">
            <div>
              <h2>Alerts</h2>
              <p>Notifications about your scans</p>
            </div>
            <Link to="/consumer/alerts" className="cp-link">
              View all →
            </Link>
          </div>

          {recentAlerts.length === 0 ? (
            <div className="cp-empty cp-empty-small">
              <div className="cp-empty-icon">
                <CheckIcon />
              </div>
              <p>No alerts. You're all caught up.</p>
            </div>
          ) : (
            <ul className="cp-alert-list">
              {recentAlerts.map((alert) => (
                <li
                  key={alert.id}
                  className={`cp-alert-item ${!alert.read ? 'unread' : ''}`}
                >
                  <div className="cp-alert-icon">
                    <AlertIcon />
                  </div>
                  <div className="cp-alert-body">
                    <strong>{alert.title || 'Alert'}</strong>
                    <span>{alert.message || ''}</span>
                    <small>{formatRelativeTime(alert.createdAt)}</small>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
};

/* ============================================================
   SUB-COMPONENTS
   ============================================================ */

const StatCard = ({ label, value, accent, icon, hint }) => (
  <div className={`cp-stat-card cp-stat-${accent}`}>
    <div className="cp-stat-top">
      <span className="cp-stat-label">{label}</span>
      {icon && <span className="cp-stat-icon">{icon}</span>}
    </div>
    <span className="cp-stat-value">{value ?? 0}</span>
    {hint && <span className="cp-stat-hint">{hint}</span>}
  </div>
);

const ScanCard = ({ scan }) => {
  const result = (scan.result || 'UNKNOWN').toLowerCase();
  const productName = scan.productName || scan.referenceCode || 'Unknown Product';
  const confidence =
    typeof scan.confidence === 'number' ? scan.confidence : null;

  const tier =
    confidence == null
      ? 'unknown'
      : confidence >= 80
      ? 'high'
      : confidence >= 50
      ? 'medium'
      : 'low';

  return (
    <li className="cp-scan-card">
      <div className={`cp-scan-card-accent cp-scan-card-accent-${result}`} />

      <div className="cp-scan-card-main">
        <div className="cp-scan-card-head">
          <div className="cp-scan-card-title">
            <strong>{productName}</strong>
            <span className="cp-scan-card-batch">
              {scan.batchCode ? `Batch ${scan.batchCode}` : '—'}
            </span>
          </div>

          <span className={`cp-pill cp-pill-${result}`}>
            {prettyResult(scan.result)}
          </span>
        </div>

        <div className="cp-scan-card-meta">
          <span className="cp-scan-card-meta-item">
            <PinIcon />
            {scan.locationCity || 'Unknown location'}
          </span>
          <span className="cp-scan-card-meta-item">
            <ClockIcon />
            {formatRelativeTime(scan.scannedAt)}
          </span>
          {scan.unitId && (
            <span className="cp-scan-card-meta-item cp-scan-card-meta-code">
              {scan.unitId}
            </span>
          )}
        </div>

        {confidence != null && (
          <div className={`cp-scan-confidence cp-scan-confidence-${tier}`}>
            <div className="cp-scan-confidence-bar-track">
              <div
                className="cp-scan-confidence-bar-fill"
                style={{ width: `${confidence}%` }}
              />
            </div>
            <span className="cp-scan-confidence-label">
              {confidence}% confidence
            </span>
          </div>
        )}
      </div>

      <div className="cp-scan-card-arrow">›</div>
    </li>
  );
};

const EmptyScans = () => (
  <div className="cp-empty cp-empty-scans">
    <div className="cp-empty-icon-large">
      <BoxIcon />
    </div>
    <h3>No scans yet</h3>
    <p>
      Every product you verify with Konfa will appear here, along with its
      authenticity result, location, and confidence score.
    </p>
    <Link to="/verify" className="cp-btn cp-btn-primary">
      Verify your first product
    </Link>
  </div>
);

const DashboardSkeleton = () => (
  <>
    <div className="cp-skeleton cp-skeleton-hero" />
    <div className="cp-stat-grid">
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="cp-skeleton cp-skeleton-card" />
      ))}
    </div>
    <div className="cp-dashboard-grid">
      <div className="cp-skeleton cp-skeleton-panel" />
      <div className="cp-skeleton cp-skeleton-panel" />
    </div>
  </>
);

/* ============================================================
   ICONS
   ============================================================ */
const ShieldIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
    <path d="M12 2L3 7V12C3 17.55 6.84 22.74 12 24C17.16 22.74 21 17.55 21 12V7L12 2Z" strokeLinejoin="round" />
    <path d="M9 12L11 14L15 10" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const ScanIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M3 7V5a2 2 0 012-2h2M17 3h2a2 2 0 012 2v2M21 17v2a2 2 0 01-2 2h-2M7 21H5a2 2 0 01-2-2v-2M7 12h10" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const CheckIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
    <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const FlagIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
    <path d="M4 22V4a2 2 0 012-2h11l-2 6 2 6H6" strokeLinejoin="round" strokeLinecap="round" />
  </svg>
);

const BookmarkIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M19 21l-7-4-7 4V5a2 2 0 012-2h10a2 2 0 012 2z" strokeLinejoin="round" />
  </svg>
);

const BellIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const AlertIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
    <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" strokeLinejoin="round" />
    <path d="M12 9v4M12 17h.01" strokeLinecap="round" />
  </svg>
);

const PinIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" strokeLinejoin="round" />
    <circle cx="12" cy="10" r="3" />
  </svg>
);

const ClockIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
    <circle cx="12" cy="12" r="10" />
    <path d="M12 6v6l4 2" strokeLinecap="round" />
  </svg>
);

const BoxIcon = () => (
  <svg width="42" height="42" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
    <path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z" strokeLinejoin="round" />
    <path d="M3.27 6.96L12 12.01l8.73-5.05M12 22.08V12" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

/* ============================================================
   HELPERS
   ============================================================ */
function prettyResult(r) {
  if (!r) return 'Unknown';
  const map = {
    AUTHENTIC: 'Authentic',
    SUSPICIOUS: 'Suspicious',
    INVALID: 'Invalid',
    EXPECTED: 'Expected',
    NOT_YET_RELEASED: 'Not Released',
  };
  return map[r] || r;
}

function formatRelativeTime(ts) {
  if (!ts) return '—';
  try {
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    const diff = Date.now() - d.getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    if (days < 7) return `${days}d ago`;
    return d.toLocaleDateString([], {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return '—';
  }
}

export default ConsumerHome;