// src/manufacturer/ManufacturerBatches.jsx
import { useEffect, useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import { fetchManufacturerBatches } from './manufacturerAuth';
import './ManufacturerPortal.css';

const ManufacturerBatches = () => {
  const { manufacturer, staff } = useOutletContext();
  const [batches, setBatches] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const list = await fetchManufacturerBatches(manufacturer.id);
        setBatches(list);
      } finally {
        setLoading(false);
      }
    })();
  }, [manufacturer.id]);

  if (loading) return <div className="mf-loading">Loading batches…</div>;

  const canCreate = ['GENERATION_OFFICER', 'SUPERVISOR', 'ADMIN'].includes(
    staff.role
  );

  return (
    <div className="mf-page">
      <header className="mf-page-header">
        <div>
          <h1>Batches</h1>
          <p>All production runs and their activation status.</p>
        </div>
        {canCreate && (
          <Link to="/manufacturer/new-batch" className="mf-btn mf-btn-primary">
            + New Batch
          </Link>
        )}
      </header>

      {batches.length === 0 ? (
        <div className="mf-empty">
          <p>No batches yet.</p>
        </div>
      ) : (
        <div className="mf-table">
          <div className="mf-table-head">
            <span>Batch</span>
            <span>Quantity</span>
            <span>Location</span>
            <span>Status</span>
            <span></span>
          </div>
          {batches.map((b) => (
            <div key={b.id} className="mf-table-row">
              <span className="mf-cell-strong">{b.batchCode}</span>
              <span>{b.quantity}</span>
              <span>{b.productionLocation}</span>
              <span className={`mf-pill mf-pill-${b.status}`}>{b.status}</span>
              <Link
                to={`/manufacturer/batches/${b.id}`}
                className="mf-btn mf-btn-small"
              >
                Open
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ManufacturerBatches;