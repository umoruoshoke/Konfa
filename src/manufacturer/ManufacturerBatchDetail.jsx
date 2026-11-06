// src/manufacturer/ManufacturerBatchDetail.jsx
import { useEffect, useState } from 'react';
import { useParams, useOutletContext, Link } from 'react-router-dom';
import {
  fetchBatchById,
  fetchBatchUnits,
  recallBatch,
} from './manufacturerAuth';
import './ManufacturerPortal.css';

const ManufacturerBatchDetail = () => {
  const { id } = useParams();
  const { staff } = useOutletContext();

  const [batch, setBatch] = useState(null);
  const [units, setUnits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showRecall, setShowRecall] = useState(false);
  const [recallReason, setRecallReason] = useState('');
  const [acting, setActing] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [b, u] = await Promise.all([
          fetchBatchById(id),
          fetchBatchUnits(id),
        ]);
        setBatch(b);
        setUnits(u);
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  const handleRecall = async () => {
    if (!recallReason.trim()) return;
    setActing(true);
    try {
      await recallBatch({
        batchId: id,
        reason: recallReason,
        staffId: staff.id,
        staffName: staff.fullName,
      });
      const [b, u] = await Promise.all([
        fetchBatchById(id),
        fetchBatchUnits(id),
      ]);
      setBatch(b);
      setUnits(u);
      setShowRecall(false);
      setRecallReason('');
    } finally {
      setActing(false);
    }
  };

  if (loading) return <div className="mf-loading">Loading batch…</div>;
  if (!batch) return <div className="mf-loading">Batch not found.</div>;

  const activatedCount = units.filter(
    (u) => u.status === 'ACTIVE' || u.status === 'FLAGGED'
  ).length;
  const awaiting = units.filter((u) => u.status === 'MANUFACTURED').length;

  const canGenerateQr = ['ACTIVATION_OFFICER', 'SUPERVISOR'].includes(
    staff.role
  );
  const canRecall =
    ['SUPERVISOR', 'ADMIN'].includes(staff.role) && batch.status !== 'recalled';

  const isAwaiting = batch.status === 'awaiting_activation';
  const isActivated = batch.status === 'activated';
  const isRecalled = batch.status === 'recalled';

  return (
    <div className="mf-page">
      <Link to="/manufacturer/batches" className="mf-back">
        ← All batches
      </Link>

      <header className="mf-page-header">
        <div>
          <h1>{batch.batchCode}</h1>
          <p>
            {batch.quantity} units · Produced {batch.productionDate} at{' '}
            {batch.productionLocation} ·{' '}
            <span className={`mf-pill mf-pill-${batch.status}`}>
              {formatBatchStatus(batch.status)}
            </span>
          </p>
        </div>

        <div className="mf-header-actions">
          {canGenerateQr && isAwaiting && (
            <Link
              to={`/manufacturer/batches/${id}/generate-qr`}
              className="mf-btn mf-btn-primary"
            >
              📥 Generate &amp; Download QR ZIP
            </Link>
          )}
          {canRecall && !showRecall && (
            <button
              className="mf-btn mf-btn-danger"
              onClick={() => setShowRecall(true)}
            >
              Recall Batch
            </button>
          )}
        </div>
      </header>

      {/* ====== STATE BANNERS ====== */}
      {isAwaiting && (
        <div className="mf-state-banner mf-state-awaiting">
          <div className="mf-state-icon">⏳</div>
          <div>
            <strong>Awaiting Activation</strong>
            <p>
              This batch is in the activation queue.
              {canGenerateQr
                ? ' Click "Generate & Download QR ZIP" above to activate the units.'
                : ' The Activation Officer has been notified by email.'}
            </p>
          </div>
        </div>
      )}

      {isActivated && (
        <div className="mf-state-banner mf-state-activated">
          <div className="mf-state-icon">✓</div>
          <div>
            <strong>Activated</strong>
            <p>
              All {units.length} units are now ACTIVE and can be verified by
              consumers.
              {batch.activatedByName && (
                <> Activated by {batch.activatedByName}.</>
              )}
            </p>
          </div>
        </div>
      )}

      {isRecalled && (
        <div className="mf-state-banner mf-state-recalled">
          <div className="mf-state-icon">!</div>
          <div>
            <strong>Recalled</strong>
            <p>
              Reason: {batch.recallReason}. All units fail verification.
            </p>
          </div>
        </div>
      )}

      {/* ====== RECALL FORM ====== */}
      {showRecall && (
        <div className="mf-recall-box">
          <h3>Recall this batch</h3>
          <p>All {units.length} units will immediately fail verification.</p>
          <input
            type="text"
            value={recallReason}
            onChange={(e) => setRecallReason(e.target.value)}
            placeholder="Reason for the recall…"
          />
          <div className="mf-recall-actions">
            <button
              className="mf-btn"
              onClick={() => setShowRecall(false)}
              disabled={acting}
            >
              Cancel
            </button>
            <button
              className="mf-btn mf-btn-danger"
              onClick={handleRecall}
              disabled={acting || !recallReason.trim()}
            >
              {acting ? 'Recalling…' : 'Confirm Recall'}
            </button>
          </div>
        </div>
      )}

      {/* ====== STATS ====== */}
      <div className="mf-stat-grid">
        <Stat label="Generated" value={units.length} accent="teal" />
        <Stat label="Activated" value={activatedCount} accent="green" />
        <Stat
          label="Awaiting Activation"
          value={awaiting}
          accent={awaiting > 0 ? 'amber' : 'green'}
        />
      </div>

      {/* ====== UNITS TABLE ====== */}
      <section className="mf-section">
        <h2>Units ({units.length})</h2>
        <div className="mf-table">
          <div className="mf-table-head mf-table-units">
            <span>Unit ID</span>
            <span>Reference Code</span>
            <span>Status</span>
            <span>Location</span>
          </div>
          {units.slice(0, 100).map((u) => (
            <div key={u.id} className="mf-table-row mf-table-units">
              <span className="mf-cell-strong">{u.id}</span>
              <span className="mf-cell-mono">{u.consumerReferenceCode}</span>
              <span className={`mf-pill mf-pill-${u.status?.toLowerCase()}`}>
                {u.status}
              </span>
              <span>{u.currentLocationLabel}</span>
            </div>
          ))}
          {units.length > 100 && (
            <div className="mf-table-more">
              …and {units.length - 100} more. Download the QR ZIP for the full list.
            </div>
          )}
        </div>
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

const Stat = ({ label, value, accent }) => (
  <div className={`mf-stat-card mf-stat-${accent}`}>
    <span className="mf-stat-label">{label}</span>
    <span className="mf-stat-value">{value}</span>
  </div>
);

export default ManufacturerBatchDetail;