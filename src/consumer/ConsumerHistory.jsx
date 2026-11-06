// src/consumer/ConsumerHistory.jsx
import { useEffect, useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import { fetchConsumerScans } from './consumerAuth';
import './ConsumerPortal.css';

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'AUTHENTIC', label: 'Authentic' },
  { key: 'SUSPICIOUS', label: 'Suspicious' },
  { key: 'INVALID', label: 'Invalid' },
  { key: 'EXPECTED', label: 'In transit' },
];

const ConsumerHistory = () => {
  const { consumer } = useOutletContext();
  const [scans, setScans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const list = await fetchConsumerScans(consumer.id, 200);
        setScans(list);
      } finally {
        setLoading(false);
      }
    })();
  }, [consumer.id]);

  const filtered = scans.filter((s) => {
    if (filter !== 'all' && s.result !== filter) return false;
    const q = search.toLowerCase();
    return (
      !q ||
      s.productName?.toLowerCase().includes(q) ||
      s.referenceCode?.toLowerCase().includes(q) ||
      s.locationCity?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="cp-page">
      <header className="cp-page-header">
        <div>
          <h1>Scan History</h1>
          <p>Every product you've verified with Konfa.</p>
        </div>
        <Link to="/verify" className="cp-btn cp-btn-primary">
          + Verify a Product
        </Link>
      </header>

      <div className="cp-toolbar">
        <div className="cp-filter-tabs">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              className={`cp-tab ${filter === f.key ? 'active' : ''}`}
              onClick={() => setFilter(f.key)}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="cp-search">
          <span className="cp-search-icon" aria-hidden="true">🔍</span>
          <input
            type="text"
            placeholder="Search by product, code, or location…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="cp-input-search"
          />
        </div>
      </div>

      {loading ? (
        <div className="cp-loading">Loading your history…</div>
      ) : filtered.length === 0 ? (
        <div className="cp-empty">
          <p>
            {search || filter !== 'all'
              ? 'No scans match your filters.'
              : "You haven't scanned any products yet."}
          </p>
          {!search && filter === 'all' && (
            <Link to="/verify" className="cp-link">
              Verify your first product →
            </Link>
          )}
        </div>
      ) : (
        <div className="cp-card-table">
          <table className="cp-table">
            <thead>
              <tr>
                <th>Product</th>
                <th>Reference</th>
                <th>Location</th>
                <th>Result</th>
                <th className="cp-th-right">When</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((scan) => (
                <tr key={scan.id} className="cp-tr">
                  <td>
                    <div className="cp-td-product">
                      <strong>{scan.productName || '—'}</strong>
                      {scan.batchCode && (
                        <small>{scan.batchCode}</small>
                      )}
                    </div>
                  </td>
                  <td>
                    <code className="cp-code-small">
                      {scan.referenceCode || '—'}
                    </code>
                  </td>
                  <td>
                    {scan.locationCity
                      ? `${scan.locationCity}${
                          scan.locationRegion &&
                          scan.locationRegion !== scan.locationCity
                            ? `, ${scan.locationRegion.split(',')[1]?.trim() || ''}`
                            : ''
                        }`
                      : '—'}
                  </td>
                  <td>
                    <span
                      className={`cp-pill cp-pill-${(
                        scan.result || 'unknown'
                      ).toLowerCase()}`}
                    >
                      {scan.result || '—'}
                    </span>
                  </td>
                  <td className="cp-td-date">
                    {formatDate(scan.scannedAt)}
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

function formatDate(ts) {
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
}

export default ConsumerHistory;