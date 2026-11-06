// src/admin/AdminActiveSellers.jsx
import { useEffect, useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import {
  fetchAllSellers,
  suspendSeller,
  reactivateSeller,
} from './adminAuth';
import './AdminPortal.css';

const STATUS_FILTERS = [
  { value: 'all',       label: 'All' },
  { value: 'active',    label: 'Active' },
  { value: 'suspended', label: 'Suspended' },
  { value: 'pending',   label: 'Pending' },
];

const AdminActiveSellers = () => {
  const { admin } = useOutletContext();
  const [sellers, setSellers] = useState([]);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState(null);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const list = await fetchAllSellers({
        status: filter === 'all' ? null : filter,
      });

      const normalised = list.map((s) => ({
        ...s,
        displayName: s.companyName || s.name || '—',
        displayEmail: s.email || '—',
        displayPhone: s.phoneNumber || s.phone || '—',
        displayStatus: s.status || 'unknown',
        displayRole: s.role || s.requestedRole || null,
        createdAtMs:
          s.createdAt?.toDate?.()?.getTime?.() ||
          (s.createdAt ? new Date(s.createdAt).getTime() : 0),
      }));

      setSellers(normalised);
    } catch (err) {
      console.error('fetchAllSellers failed:', err);
      setError(
        err.code === 'permission-denied'
          ? 'Permission denied. Check your Firestore rules for sellers.'
          : `Failed to load sellers: ${err.message}`
      );
      setSellers([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  const handleSuspend = async (s) => {
    const reason = window.prompt(
      `Reason for suspending "${s.displayName}"?`,
      'Policy violation'
    );
    if (reason === null) return;

    setBusyId(s.id);
    try {
      await suspendSeller({
        sellerId: s.id,
        adminId: admin.id,
        adminName: admin.fullName || admin.email,
        reason: reason || 'Not specified',
      });
      await load();
    } catch (e) {
      alert(`Failed: ${e.message}`);
    } finally {
      setBusyId(null);
    }
  };

  const handleReactivate = async (s) => {
    if (!window.confirm(`Reactivate "${s.displayName}"?`)) return;
    setBusyId(s.id);
    try {
      await reactivateSeller({
        sellerId: s.id,
        adminId: admin.id,
        adminName: admin.fullName || admin.email,
      });
      await load();
    } catch (e) {
      alert(`Failed: ${e.message}`);
    } finally {
      setBusyId(null);
    }
  };

  const filtered = sellers.filter((s) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      s.displayName.toLowerCase().includes(q) ||
      s.displayEmail.toLowerCase().includes(q) ||
      s.displayPhone.toLowerCase().includes(q)
    );
  });

  const counts = {
    active:    sellers.filter((s) => s.displayStatus === 'active').length,
    suspended: sellers.filter((s) => s.displayStatus === 'suspended').length,
    total:     sellers.length,
  };

  return (
    <div className="admin-page">
      <header className="admin-page-header">
        <div>
          <h1>Sellers</h1>
          <p>
            {loading
              ? 'Loading…'
              : `${filtered.length} seller${filtered.length === 1 ? '' : 's'} on the platform`}
          </p>
        </div>
      </header>

      {/* Stat strip */}
      <div className="admin-stat-grid">
        <div className="admin-stat-card admin-stat-teal">
          <span className="admin-stat-label">Active</span>
          <span className="admin-stat-value">{counts.active}</span>
          <span className="admin-stat-hint">Operating now</span>
        </div>
        <div className="admin-stat-card admin-stat-red">
          <span className="admin-stat-label">Suspended</span>
          <span className="admin-stat-value">{counts.suspended}</span>
          <span className="admin-stat-hint">Restricted accounts</span>
        </div>
        <div className="admin-stat-card admin-stat-navy">
          <span className="admin-stat-label">Total</span>
          <span className="admin-stat-value">{counts.total}</span>
          <span className="admin-stat-hint">On the platform</span>
        </div>
      </div>

      {/* Toolbar */}
      <div className="admin-toolbar">
        <div className="admin-filter-tabs">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              className={`admin-tab ${filter === f.value ? 'active' : ''}`}
              onClick={() => setFilter(f.value)}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="admin-search">
          <span className="admin-search-icon" aria-hidden="true">🔍</span>
          <input
            type="text"
            placeholder="Search by name, email or phone…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="admin-input-search"
          />
        </div>

        <button
          type="button"
          className="admin-btn admin-btn-refresh admin-btn-sm"
          onClick={load}
          disabled={loading}
        >
          {loading ? 'Loading…' : '↻ Refresh'}
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
          <div className="admin-empty-icon">🏪</div>
          <p>
            {search
              ? `No sellers match "${search}".`
              : filter === 'all'
              ? 'No sellers registered yet.'
              : `No ${filter} sellers.`}
          </p>
        </div>
      ) : (
        <div className="admin-card-table">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Company</th>
                <th>Contact</th>
                <th>Status</th>
                <th>Registered</th>
                <th className="admin-th-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((s) => (
                <tr key={s.id} className="admin-tr">
                  <td>
                    <div className="admin-td-company">
                      <Link
                        to={`/admin/sellers/${s.id}`}
                        className="admin-link-strong"
                      >
                        {s.displayName}
                      </Link>
                      {s.displayRole && (
                        <span className="admin-subtext">{s.displayRole}</span>
                      )}
                    </div>
                  </td>

                  <td>
                    <div className="admin-td-contact">
                      <span>{s.displayEmail}</span>
                      <span className="admin-subtext">{s.displayPhone}</span>
                    </div>
                  </td>

                  <td>
                    <span className={`admin-pill admin-pill-${s.displayStatus}`}>
                      {s.displayStatus}
                    </span>
                  </td>

                  <td className="admin-td-date">
                    {s.createdAtMs
                      ? new Date(s.createdAtMs).toLocaleDateString([], {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                        })
                      : '—'}
                  </td>

                  <td className="admin-td-actions">
                    {s.displayStatus === 'active' && (
                      <button
                        type="button"
                        className="admin-btn admin-btn-sm admin-btn-danger"
                        onClick={() => handleSuspend(s)}
                        disabled={busyId === s.id}
                      >
                        {busyId === s.id ? '…' : 'Suspend'}
                      </button>
                    )}
                    {s.displayStatus === 'suspended' && (
                      <button
                        type="button"
                        className="admin-btn admin-btn-sm admin-btn-success"
                        onClick={() => handleReactivate(s)}
                        disabled={busyId === s.id}
                      >
                        {busyId === s.id ? '…' : 'Reactivate'}
                      </button>
                    )}
                    {s.displayStatus !== 'active' &&
                      s.displayStatus !== 'suspended' && (
                        <span className="admin-subtext">—</span>
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

export default AdminActiveSellers;