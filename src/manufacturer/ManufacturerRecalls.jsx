// src/manufacturer/ManufacturerRecalls.jsx
import { useEffect, useState } from 'react';
import { useOutletContext, Link } from 'react-router-dom';
import { fetchManufacturerBatches } from './manufacturerAuth';
import './ManufacturerPortal.css';

const ManufacturerRecalls = () => {
  const { manufacturer } = useOutletContext();
  const [batches, setBatches] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const list = await fetchManufacturerBatches(manufacturer.id);
        setBatches(list.filter((b) => b.status === 'recalled'));
      } finally {
        setLoading(false);
      }
    })();
  }, [manufacturer.id]);

  if (loading) return <div className="mf-loading">Loading…</div>;

  return (
    <div className="mf-page">
      <header className="mf-page-header">
        <div>
          <h1>Recalls</h1>
          <p>
            Batches that have been recalled. Their units fail all verifications.
          </p>
        </div>
      </header>

      {batches.length === 0 ? (
        <div className="mf-empty">
          <p>No recalled batches. Good news.</p>
        </div>
      ) : (
        <ul className="mf-list">
          {batches.map((b) => (
            <li key={b.id} className="mf-list-item">
              <div>
                <strong>{b.batchCode}</strong>
                <span>
                  {b.quantity} units · Reason: {b.recallReason}
                </span>
              </div>
              <Link
                to={`/manufacturer/batches/${b.id}`}
                className="mf-btn mf-btn-small"
              >
                View
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default ManufacturerRecalls;