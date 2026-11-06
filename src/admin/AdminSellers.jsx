// src/admin/AdminSellers.jsx
import { useEffect, useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import { fetchSellerApplications } from './adminAuth';
import './AdminPortal.css';

const TABS = [
  { key: 'pending',  label: 'Pending' },
  { key: 'approved', label: 'Approved' },
  { key: 'rejected', label: 'Rejected' },
];

const AdminSellers = () => {
  const { admin } = useOutletContext();
  const [tab, setTab] = useState('pending');
  const [apps, setApps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    setLoading(true);
    (async () => {
      try {
        const list = await fetchSellerApplications({ status: tab });
        setApps(list);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    })();
  }, [tab]);

  const filtered = apps.filter((a) => {
    const q = search.toLowerCase();
    return (
      !q ||
      a.companyName?.toLowerCase().includes(q) ||
      a.email?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="admin-page">
      <header className="admin-page-header">
        <div>
          <h1>Seller Applications</h1>
          <p>Review and approve sellers who want to join the platform.</p>
        </div>
      </header>

      <div className="admin-toolbar">
        <div className="admin-filter-tabs">
          {TABS.map((t) => (
            <button
              key={t.key}
              className={`admin-tab ${tab === t.key ? 'active' : ''}`}
              onClick={() => setTab(t.key)}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="admin-search">
          <span className="admin-search-icon" aria-hidden="true">🔍</span>
          <input
            type="text"
            className="admin-input-search"
            placeholder="Search by company or email…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {loading && (
        <div className="admin-card-table">
          <div className="admin-table-skeleton">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="admin-skel-row" />
            ))}
          </div>
        </div>
      )}

      {!loading && filtered.length === 0 && (
        <div className="admin-empty">
          <div className="admin-empty-icon">📭</div>
          <p>No {tab} applications.</p>
        </div>
      )}

      {!loading && filtered.length > 0 && (
        <div className="admin-card-table">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Company</th>
                <th>Contact</th>
                <th>Role</th>
                <th>Submitted</th>
                <th className="admin-th-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((app) => (
                <tr key={app.id} className="admin-tr">
                  <td>
                    <div className="admin-td-company">
                      <strong className="admin-cell-strong">
                        {app.companyName || '—'}
                      </strong>
                    </div>
                  </td>
                  <td>
                    <div className="admin-td-contact">
                      <span>{app.email || '—'}</span>
                      {app.phoneNumber && (
                        <span className="admin-subtext">{app.phoneNumber}</span>
                      )}
                    </div>
                  </td>
                  <td>
                    <span className="admin-pill admin-pill-role">
                      {app.requestedRole || '—'}
                    </span>
                  </td>
                  <td className="admin-td-date">
                    {formatDate(app.submittedAt)}
                  </td>
                  <td className="admin-td-actions">
                    <Link
                      to={`/admin/sellers/${app.id}`}
                      className="admin-btn admin-btn-small admin-btn-primary"
                    >
                      Review
                    </Link>
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
  } catch { return '—'; }
};

export default AdminSellers;