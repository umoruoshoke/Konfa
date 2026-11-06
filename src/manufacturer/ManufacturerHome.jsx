// src/manufacturer/ManufacturerHome.jsx
import { useEffect, useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import {
  fetchManufacturerStats,
  fetchManufacturerBatches,
} from './manufacturerAuth';
import './ManufacturerPortal.css';

const ManufacturerHome = () => {
  const { manufacturer, staff } = useOutletContext();
  const [stats, setStats] = useState(null);
  const [recentBatches, setRecentBatches] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [s, batches] = await Promise.all([
          fetchManufacturerStats(manufacturer.id),
          fetchManufacturerBatches(manufacturer.id),
        ]);
        setStats(s);
        setRecentBatches(batches.slice(0, 5));
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    })();
  }, [manufacturer.id]);

  if (loading) return <div className="mf-loading">Loading…</div>;

  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';

  const isActivationOfficer = staff.role === 'ACTIVATION_OFFICER';
  const isGenerationOfficer = staff.role === 'GENERATION_OFFICER';
  const isSupervisor = staff.role === 'SUPERVISOR' || staff.role === 'ADMIN';

  return (
    <div className="mf-page">
      <header className="mf-page-header">
        <div>
          <h1>
            {greeting}, {staff.fullName.split(' ')[0]}
          </h1>
          <p>
            Signed in as <strong>{staff.role.replace(/_/g, ' ')}</strong>
          </p>
        </div>
      </header>

      {/* ====== ACTION BANNER for Activation Officer ====== */}
      {(isActivationOfficer || isSupervisor) &&
        stats.awaitingActivationBatches > 0 && (
          <Link to="/manufacturer/activation" className="mf-action-banner">
            <div className="mf-action-banner-icon">!</div>
            <div className="mf-action-banner-body">
              <strong>
                {stats.awaitingActivationBatches} batch
                {stats.awaitingActivationBatches > 1 ? 'es' : ''} awaiting activation
              </strong>
              <span>Generate QR codes and activate the units</span>
            </div>
            <div className="mf-action-banner-arrow">→</div>
          </Link>
        )}

      {/* ====== ACTION BANNER for Generation Officer ====== */}
      {isGenerationOfficer && stats.awaitingActivationBatches > 0 && (
        <div className="mf-info-banner">
          <strong>⏳ {stats.awaitingActivationBatches} batch awaiting activation</strong>
          <p>
            The Activation Officer has been notified. Once they activate them, they'll
            appear as <em>activated</em> here.
          </p>
        </div>
      )}

      <div className="mf-stat-grid">
        <StatCard label="Total Batches" value={stats.totalBatches} accent="teal" />
        <StatCard
          label="Awaiting Activation"
          value={stats.awaitingActivationBatches}
          accent={stats.awaitingActivationBatches > 0 ? 'amber' : 'green'}
        />
        <StatCard
          label="Activated Batches"
          value={stats.activatedBatches}
          accent="green"
        />
        <StatCard
          label="Total Units"
          value={stats.totalUnits.toLocaleString()}
          accent="navy"
        />
      </div>

      <section className="mf-section">
        <div className="mf-section-header">
          <h2>Recent batches</h2>
          <Link to="/manufacturer/batches" className="mf-link">
            View all →
          </Link>
        </div>

        {recentBatches.length === 0 ? (
          <div className="mf-empty">
            <p>
              No batches yet.{' '}
              {isGenerationOfficer && (
                <Link to="/manufacturer/new-batch" className="mf-link">
                  Create your first batch →
                </Link>
              )}
            </p>
          </div>
        ) : (
          <ul className="mf-list">
            {recentBatches.map((b) => (
              <li key={b.id} className="mf-list-item">
                <div>
                  <strong>{b.batchCode}</strong>
                  <span>
                    {b.quantity} units · {b.productionLocation}
                  </span>
                </div>
                <div className="mf-list-item-right">
                  <span className={`mf-pill mf-pill-${b.status}`}>
                    {formatBatchStatus(b.status)}
                  </span>
                  <Link
                    to={`/manufacturer/batches/${b.id}`}
                    className="mf-btn mf-btn-small"
                  >
                    Open
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
};

function formatBatchStatus(status) {
  const map = {
    awaiting_activation: 'Awaiting activation',
    activated: 'Activated',
    flagged: 'Flagged',
    recalled: 'Recalled',
  };
  return map[status] || status;
}

const StatCard = ({ label, value, accent }) => (
  <div className={`mf-stat-card mf-stat-${accent}`}>
    <span className="mf-stat-label">{label}</span>
    <span className="mf-stat-value">{value}</span>
  </div>
);

export default ManufacturerHome;