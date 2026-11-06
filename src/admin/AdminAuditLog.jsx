// src/admin/AdminAuditLog.jsx
import { useEffect, useState } from 'react';
import { fetchAuditLog } from './adminAuth';
import './AdminPortal.css';

const ACTION_LABELS = {
  approve_seller:           { label: 'Approved seller',      color: 'approved',   icon: '✓' },
  reject_seller:            { label: 'Rejected seller',      color: 'rejected',   icon: '✕' },
  suspend_seller:           { label: 'Suspended seller',     color: 'suspended',  icon: '!' },
  reactivate_seller:        { label: 'Reactivated seller',   color: 'approved',   icon: '✓' },
  approve_manufacturer:     { label: 'Approved manufacturer',color: 'approved',   icon: '✓' },
  reject_manufacturer:      { label: 'Rejected manufacturer',color: 'rejected',   icon: '✕' },
  suspend_manufacturer:     { label: 'Suspended manufacturer',color:'suspended',  icon: '!' },
  reactivate_manufacturer:  { label: 'Reactivated manufacturer',color:'approved', icon: '✓' },
  invite_admin:             { label: 'Invited admin',        color: 'invited',    icon: '+' },
  update_admin_permissions: { label: 'Updated admin perms',  color: 'invited',    icon: '⚙' },
  deactivate_admin:         { label: 'Deactivated admin',    color: 'rejected',   icon: '✕' },
};

const FILTERS = [
  { key: 'all',       label: 'All' },
  { key: 'approve',   label: 'Approvals' },
  { key: 'reject',    label: 'Rejections' },
  { key: 'suspend',   label: 'Suspensions' },
  { key: 'invite',    label: 'Admin actions' },
];

const AdminAuditLog = () => {
  const [log, setLog] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const entries = await fetchAuditLog({ max: 200 });
      setLog(entries);
    } catch (err) {
      console.error('fetchAuditLog failed:', err);
      setError(
        err?.code === 'failed-precondition'
          ? 'Audit log needs a Firestore index on "timestamp". Check the console for the auto-create link.'
          : `Could not load audit log: ${err?.message || 'Unknown error'}`
      );
      setLog([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = log.filter((entry) => {
    // Action-family filter
    if (filter !== 'all') {
      const action = entry.action || '';
      if (filter === 'approve' && !action.startsWith('approve')) return false;
      if (filter === 'reject'  && !action.startsWith('reject'))  return false;
      if (filter === 'suspend' && !action.startsWith('suspend')) return false;
      if (filter === 'invite'  && !action.includes('admin'))     return false;
    }

    // Search
    const q = search.toLowerCase();
    return (
      !q ||
      entry.action?.toLowerCase().includes(q) ||
      entry.actorName?.toLowerCase().includes(q) ||
      entry.targetId?.toLowerCase().includes(q) ||
      entry.details?.companyName?.toLowerCase().includes(q) ||
      entry.details?.email?.toLowerCase().includes(q)
    );
  });

  const counts = {
    total: log.length,
    today: log.filter((e) => isToday(e.timestamp)).length,
    approvals: log.filter((e) => e.action?.startsWith('approve')).length,
  };

  return (
    <div className="admin-page">
      <header className="admin-page-header">
        <div>
          <h1>Audit Log</h1>
          <p>Every action taken by admins. This record is permanent.</p>
        </div>
      </header>

      {/* Stat strip */}
      <div className="admin-stat-grid">
        <div className="admin-stat-card admin-stat-navy">
          <span className="admin-stat-label">Total entries</span>
          <span className="admin-stat-value">{counts.total}</span>
          <span className="admin-stat-hint">Recorded actions</span>
        </div>
        <div className="admin-stat-card admin-stat-teal">
          <span className="admin-stat-label">Today</span>
          <span className="admin-stat-value">{counts.today}</span>
          <span className="admin-stat-hint">Since midnight</span>
        </div>
        <div className="admin-stat-card admin-stat-green">
          <span className="admin-stat-label">Approvals</span>
          <span className="admin-stat-value">{counts.approvals}</span>
          <span className="admin-stat-hint">Sellers + manufacturers</span>
        </div>
      </div>

      {/* Toolbar */}
      <div className="admin-toolbar">
        <div className="admin-filter-tabs">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              className={`admin-tab ${filter === f.key ? 'active' : ''}`}
              onClick={() => setFilter(f.key)}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="admin-search">
          <span className="admin-search-icon" aria-hidden="true">🔍</span>
          <input
            type="text"
            className="admin-input-search"
            placeholder="Search by action, actor, or target…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <button
          type="button"
          className="admin-btn admin-btn-refresh admin-btn-sm"
          onClick={load}
          disabled={loading}
        >
          ↻ Refresh
        </button>
      </div>

      {error && <div className="admin-error">{error}</div>}

      {loading ? (
        <div className="admin-card-table admin-table-skeleton">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="admin-skel-row" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="admin-empty">
          <div className="admin-empty-icon">📜</div>
          <p>
            {search || filter !== 'all'
              ? 'No entries match your filters.'
              : 'No audit entries yet.'}
          </p>
        </div>
      ) : (
        <div className="admin-card-table">
          <table className="admin-table">
            <thead>
              <tr>
                <th style={{ width: '180px' }}>Action</th>
                <th>Actor</th>
                <th>Target</th>
                <th style={{ width: '180px' }}>When</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((entry) => {
                const meta = ACTION_LABELS[entry.action] || {
                  label: humanize(entry.action),
                  color: 'unknown',
                  icon: '•',
                };
                const iconClass = (entry.action || '').split('_')[0];

                return (
                  <tr key={entry.id} className="admin-tr">
                    <td>
                      <span className={`admin-pill admin-pill-${meta.color}`}>
                        {meta.label}
                      </span>
                    </td>

                    <td>
                      <div className="admin-td-company">
                        <span className="admin-link-strong">
                          {entry.actorName || 'System'}
                        </span>
                        {entry.actorId && (
                          <span className="admin-subtext">
                            <code className="admin-code-small">
                              {entry.actorId}
                            </code>
                          </span>
                        )}
                      </div>
                    </td>

                    <td>
                      <div className="admin-td-contact">
                        <span>
                          {entry.details?.companyName ||
                            entry.details?.email ||
                            entry.targetId ||
                            '—'}
                        </span>
                        {entry.targetType && (
                          <span className="admin-subtext">
                            {entry.targetType}
                            {entry.details?.reason
                              ? ` · ${entry.details.reason}`
                              : ''}
                          </span>
                        )}
                      </div>
                    </td>

                    <td className="admin-td-date">
                      {formatDateTime(entry.timestamp)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

// ── Helpers ──────────────────────────────────────────────────

const formatDateTime = (ts) => {
  if (!ts) return '—';
  try {
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleString([], {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '—';
  }
};

const isToday = (ts) => {
  if (!ts) return false;
  try {
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    const now = new Date();
    return (
      d.getDate() === now.getDate() &&
      d.getMonth() === now.getMonth() &&
      d.getFullYear() === now.getFullYear()
    );
  } catch {
    return false;
  }
};

const humanize = (str) =>
  (str || '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());

export default AdminAuditLog;