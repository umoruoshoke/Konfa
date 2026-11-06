// src/admin/AdminVerifiedBrands.jsx
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchVerifiedBrands } from './adminBrandVerificationApi';
import './AdminPortal.css';

const AdminVerifiedBrands = () => {
  const [brands, setBrands] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const list = await fetchVerifiedBrands({ max: 200 });
        if (!cancelled) setBrands(list);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div className="admin-page">
        <header className="admin-page-header">
          <div>
            <h1>Loading verified brands…</h1>
          </div>
        </header>
      </div>
    );
  }

  return (
    <div className="admin-page">
      <header className="admin-page-header">
        <div>
          <h1>Verified brands</h1>
          <p>
            {brands.length} brand{brands.length === 1 ? '' : 's'} with a
            verified owner identity.
          </p>
        </div>
      </header>

      {brands.length === 0 ? (
        <div className="admin-empty">
          <div className="admin-empty-icon">🏷️</div>
          <h2>No verified brands yet</h2>
          <p>Approved brand owners will appear here.</p>
        </div>
      ) : (
        <div className="admin-card">
          <ul className="admin-app-list">
            {brands.map((b) => {
              const accounts = Object.values(b.accounts || {}).filter(
                (a) => a?.status === 'verified'
              ).length;
              const isFullyVerified = b.overallStatus === 'fully_verified';
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
                      {isFullyVerified && (
                        <span className="admin-badge-pill admin-badge-verified">
                          Fully verified
                        </span>
                      )}
                    </strong>
                    <span>
                      {b.brandEmail || '—'} · {accounts} account
                      {accounts === 1 ? '' : 's'} linked
                      {b.publicSlug && ` · /b/${b.publicSlug}`}
                    </span>
                  </div>
                  {b.publicSlug && (
                    <Link
                      to={`/b/${b.publicSlug}`}
                      target="_blank"
                      rel="noreferrer"
                      className="admin-btn admin-btn-small admin-btn-ghost"
                    >
                      View page ↗
                    </Link>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
};

export default AdminVerifiedBrands;