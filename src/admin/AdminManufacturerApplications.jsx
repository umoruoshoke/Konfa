// src/admin/AdminManufacturerApplications.jsx
import { useEffect, useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import {
  fetchManufacturerApplications,
  approveManufacturerApplication,
  rejectManufacturerApplication,
} from './adminAuth';
import './AdminPortal.css';

const TABS = [
  { key: 'pending', label: 'Pending' },
  { key: 'approved', label: 'Approved' },
  { key: 'rejected', label: 'Rejected' },
];

const AdminManufacturerApplications = () => {
  const { admin } = useOutletContext();
  const [tab, setTab] = useState('pending');
  const [apps, setApps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [acting, setActing] = useState(null);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const list = await fetchManufacturerApplications({ status: tab });
      console.log(`[Mfr Approvals] tab=${tab} → ${list.length} app(s)`, list);
      setApps(list);
    } catch (err) {
      console.error('Failed to load manufacturer applications:', err);
      setError(
        `Could not load applications: ${err?.code || ''} ${err?.message || ''}`.trim()
      );
      setApps([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  const handleApprove = async (app) => {
    if (!window.confirm(`Approve ${app.companyName} as a manufacturer?`)) return;
    setActing(app.id);
    try {
      await approveManufacturerApplication({
        applicationId: app.id,
        adminId: admin.id,
        adminName: admin.fullName,
      });
      await load();
    } catch (err) {
      console.error(err);
      alert(err.message || 'Approval failed.');
    } finally {
      setActing(null);
    }
  };

  const handleReject = async (app) => {
    const reason = window.prompt(`Reason for rejecting ${app.companyName}?`);
    if (!reason) return;
    setActing(app.id);
    try {
      await rejectManufacturerApplication({
        applicationId: app.id,
        adminId: admin.id,
        adminName: admin.fullName,
        reason,
      });
      await load();
    } catch (err) {
      console.error(err);
      alert(err.message || 'Rejection failed.');
    } finally {
      setActing(null);
    }
  };

  const filtered = apps.filter((a) => {
    const q = search.toLowerCase();
    return (
      !q ||
      a.companyName?.toLowerCase().includes(q) ||
      a.contactEmail?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="admin-page">
      <header className="admin-page-header">
        <div>
          <h1>Manufacturer Applications</h1>
          <p>Review factories applying to join the Konfa network.</p>
        </div>
      </header>

      {/* Stat strip */}
      <div className="admin-stat-grid">
        <div className="admin-stat-card admin-stat-amber">
          <span className="admin-stat-label">Showing</span>
          <span className="admin-stat-value">{filtered.length}</span>
          <span className="admin-stat-hint">
            {tab.charAt(0).toUpperCase() + tab.slice(1)} applications
          </span>
        </div>
      </div>

      {/* Toolbar */}
      <div className="admin-toolbar">
        <div className="admin-filter-tabs">
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              className={`admin-tab ${tab === t.key ? 'active' : ''}`}
              onClick={() => setTab(t.key)}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="admin-search">
          <span className="admin-search-icon">🔍</span>
          <input
            type="text"
            className="admin-input-search"
            placeholder="Search by company or email…"
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
          <div className="admin-empty-icon">📭</div>
          <p>
            {search
              ? 'No applications match your search.'
              : `No ${tab} applications.`}
          </p>
          {tab === 'pending' && !search && (
            <p className="admin-subtext" style={{ marginTop: 12 }}>
              If you expected applications here, open the browser console —
              we log exactly how many docs Firebase returned.
            </p>
          )}
        </div>
      ) : (
        <div className="admin-card-table">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Company</th>
                <th>Contact</th>
                <th>Submitted</th>
                <th>Status</th>
                <th className="admin-th-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((app) => (
                <tr key={app.id} className="admin-tr">
                  <td>
                    <div className="admin-td-company">
                      <Link
                        to={`/admin/manufacturer-applications/${app.id}`}
                        className="admin-link-strong"
                      >
                        {app.companyName}
                      </Link>
                      {app.businessInfo?.businessType && (
                        <span className="admin-subtext">
                          {String(app.businessInfo.businessType)
                            .replace(/_/g, ' ')
                            .replace(/\b\w/g, (c) => c.toUpperCase())}
                        </span>
                      )}
                    </div>
                  </td>
                  <td>
                    <div className="admin-td-contact">
                      <span>{app.contactEmail || '—'}</span>
                      <span className="admin-subtext">
                        {app.phoneNumber || '—'}
                      </span>
                    </div>
                  </td>
                  <td className="admin-td-date">{formatDate(app.submittedAt)}</td>
                  <td>
                    <span className={`admin-pill admin-pill-${app.status}`}>
                      {app.status}
                    </span>
                  </td>
                  <td className="admin-td-actions">
                    {app.status === 'pending' ? (
                      <>
                        <button
                          type="button"
                          className="admin-btn admin-btn-danger admin-btn-sm"
                          onClick={() => handleReject(app)}
                          disabled={acting === app.id}
                          style={{ marginRight: 6 }}
                        >
                          Reject
                        </button>
                        <button
                          type="button"
                          className="admin-btn admin-btn-success admin-btn-sm"
                          onClick={() => handleApprove(app)}
                          disabled={acting === app.id}
                        >
                          {acting === app.id ? '…' : 'Approve'}
                        </button>
                      </>
                    ) : (
                      <Link
                        to={`/admin/manufacturer-applications/${app.id}`}
                        className="admin-btn admin-btn-primary admin-btn-sm"
                      >
                        View
                      </Link>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

const formatDate = (ts) => {
  if (!ts) return '—';
  try {
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleDateString([], { day: '2-digit', month: 'short', year: 'numeric' });
  } catch {
    return '—';
  }
};

export default AdminManufacturerApplications;