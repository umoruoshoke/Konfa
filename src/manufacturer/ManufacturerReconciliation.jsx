// src/manufacturer/ManufacturerReconciliation.jsx
import { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { fetchReconciliation } from './manufacturerAuth';
import './ManufacturerPortal.css';

const ManufacturerReconciliation = () => {
  const { manufacturer } = useOutletContext();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const data = await fetchReconciliation(manufacturer.id);
        setRows(data);
      } finally {
        setLoading(false);
      }
    })();
  }, [manufacturer.id]);

  if (loading)
    return <div className="mf-loading">Loading reconciliation…</div>;

  const totalGenerated = rows.reduce((s, r) => s + r.generated, 0);
  const totalActivated = rows.reduce((s, r) => s + r.activated, 0);
  const totalGap = totalGenerated - totalActivated;

  return (
    <div className="mf-page">
      <header className="mf-page-header">
        <div>
          <h1>Generation → Activation Reconciliation</h1>
          <p>
            Compare how many codes were created vs how many have been confirmed.
          </p>
        </div>
      </header>

      <div className="mf-stat-grid">
        <Stat label="Total Generated" value={totalGenerated} accent="teal" />
        <Stat label="Total Activated" value={totalActivated} accent="green" />
        <Stat
          label="Awaiting Activation"
          value={totalGap}
          accent={totalGap > 0 ? 'amber' : 'green'}
        />
      </div>

      {rows.length === 0 ? (
        <div className="mf-empty">
          <p>No batches to reconcile yet.</p>
        </div>
      ) : (
        <div className="mf-table">
          <div className="mf-table-head mf-table-recon">
            <span>Batch</span>
            <span>Generated</span>
            <span>Activated</span>
            <span>Gap</span>
            <span>Status</span>
          </div>
          {rows.map((r) => (
            <div key={r.batchId} className="mf-table-row mf-table-recon">
              <span className="mf-cell-strong">{r.batchCode}</span>
              <span>{r.generated}</span>
              <span>{r.activated}</span>
              <span className={r.gap > 0 ? 'mf-cell-warn' : ''}>
                {r.gap}
              </span>
              <span>
                {r.gap === 0 ? (
                  <span className="mf-pill mf-pill-active">Reconciled</span>
                ) : (
                  <span className="mf-pill mf-pill-pending">Needs review</span>
                )}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const Stat = ({ label, value, accent }) => (
  <div className={`mf-stat-card mf-stat-${accent}`}>
    <span className="mf-stat-label">{label}</span>
    <span className="mf-stat-value">{value}</span>
  </div>
);

export default ManufacturerReconciliation;