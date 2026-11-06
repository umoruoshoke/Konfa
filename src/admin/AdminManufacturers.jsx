// src/admin/AdminManufacturers.jsx
import { useEffect, useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import {
  fetchAllManufacturers,
  suspendManufacturer,
  reactivateManufacturer,
} from './adminAuth';
import './AdminPortal.css';

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'active', label: 'Active' },
  { key: 'suspended', label: 'Suspended' },
];

const AdminManufacturers = () => {
  const { admin } = useOutletContext();
  const [manufacturers, setManufacturers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(null);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const list = await fetchAllManufacturers();
      setManufacturers(list);
    } catch (err) {
      console.error('Failed to load manufacturers:', err);
      setError(`Could not load manufacturers: ${err?.code || ''}`.trim());
      setManufacturers([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleSuspend = async (m) => {
    const reason = window.prompt(`Why are you suspending ${m.companyName}?`);
    if (!reason) return;
    setActing(m.id);
    try {
      await suspendManufacturer({
        manufacturerId: m.id,
        adminId: admin.id,
        adminName: admin.fullName,
        reason,
      });
      await load();
    } catch (err) {
      console.error(err);
      alert(err.message || 'Suspend failed.');
    } finally {
      setActing(null);
    }
  };

  const handleReactivate = async (m) => {
    if (!window.confirm(`Reactivate ${m.companyName}?`)) return;
    setActing(m.id);
    try {
      await reactivateManufacturer({
        manufacturerId: m.id,
        adminId: admin.id,
        adminName: admin.fullName,
      });
      await load();
    } catch (err) {
      console.error(err);
      alert(err.message || 'Reactivate failed.');
    } finally {
      setActing(null);
    }
  };

  const filtered = manufacturers.filter((m) => {
    if (filter !== 'all' && m.status !== filter) return false;
    const q = search.toLowerCase();
    return (
      !q ||
      m.companyName?.toLowerCase().includes(q) ||
      m.contactEmail?.toLowerCase().includes(q)
    );
  });

  const counts = {
    all: manufacturers.length,
    active: manufacturers.filter((m) => m.status === 'active').length,
    suspended: manufacturers.filter((m) => m.status === 'suspended').length,
  };

  return (
    <div className="admin-page">
      <header className="admin-page-header">
        <div>
          <h1>Manufacturers</h1>
          <p>All registered factories on the platform.</p>
        </div>
      </header>

      <div className="admin-stat-grid">
        <div className="admin-stat-card admin-stat-teal">
          <span className="admin-stat-label">Active</span>
          <span className="admin-stat-value">{counts.active}</span>
          <span className="admin-stat-hint">Verified factories</span>
        </div>
        <div className="admin-stat-card admin-stat-red">
          <span className="admin-stat-label">Suspended</span>
          <span className="admin-stat-value">{counts.suspended}</span>
          <span className="admin-stat-hint">Restricted accounts</span>
        </div>
        <div className="admin-stat-card admin-stat-navy">
          <span className="admin-stat-label">Total</span>
          <span className="admin-stat-value">{counts.all}</span>
          <span className="admin-stat-hint">On the platform</span>
        </div>
      </div>

      <div className="admin-toolbar">
        <div className="admin-filter-tabs">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              className={`admin-tab ${filter === f.key ? 'active' : ''}`}
              onClick={() => setFilter(f.key)}
            >
              {f.label} ({counts[f.key] ?? 0})
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
          <div className="admin-empty-icon">🏭</div>
          <p>
            {search
              ? 'No manufacturers match your search.'
              : filter === 'all'
              ? 'No manufacturers yet.'
              : `No ${filter} manufacturers.`}
          </p>
        </div>
      ) : (
        <div className="admin-card-table">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Company</th>
                <th>Contact</th>
                <th>Location</th>
                <th>Status</th>
                <th className="admin-th-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((m) => (
                <tr key={m.id} className="admin-tr">
                  <td>
                    <Link
                      to={`/admin/manufacturers/${m.id}`}
                      className="admin-link-strong"
                    >
                      {m.companyName || '—'}
                    </Link>
                    {m.registrationNumber && (
                      <div className="admin-subtext">
                        RC: {m.registrationNumber}
                      </div>
                    )}
                  </td>
                  <td>
                    <div className="admin-td-contact">
                      <span>{m.contactEmail || '—'}</span>
                      <span className="admin-subtext">
                        {m.phoneNumber || '—'}
                      </span>
                    </div>
                  </td>
                  <td className="admin-td-date">
                    {[m.city, m.state].filter(Boolean).join(', ') || '—'}
                  </td>
                  <td>
                    <span className={`admin-pill admin-pill-${m.status}`}>
                      {m.status || 'unknown'}
                    </span>
                  </td>
                  <td className="admin-td-actions">
                    <div className="admin-actions-row">
                      <Link
                        to={`/admin/manufacturers/${m.id}`}
                        className="admin-btn admin-btn-ghost admin-btn-sm"
                      >
                        View
                      </Link>
                      {m.status === 'active' || m.status === 'approved' ? (
                        <button
                          type="button"
                          className="admin-btn admin-btn-danger admin-btn-sm"
                          onClick={() => handleSuspend(m)}
                          disabled={acting === m.id}
                        >
                          Suspend
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="admin-btn admin-btn-success admin-btn-sm"
                          onClick={() => handleReactivate(m)}
                          disabled={acting === m.id}
                        >
                          Reactivate
                        </button>
                      )}
                    </div>
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

export default AdminManufacturers;