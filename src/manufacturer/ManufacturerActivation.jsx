// src/manufacturer/ManufacturerActivation.jsx
import { useEffect, useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import {
  fetchManufacturerBatches,
  fetchBatchUnits,
} from './manufacturerAuth';
import './ManufacturerPortal.css';

const ManufacturerActivation = () => {
  const { manufacturer, staff } = useOutletContext();
  const [batches, setBatches] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const list = await fetchManufacturerBatches(manufacturer.id);

        // Enrich with unit counts, then keep only awaiting_activation batches
        const enriched = await Promise.all(
          list
            .filter((b) => b.status === 'awaiting_activation')
            .map(async (b) => {
              const units = await fetchBatchUnits(b.id);
              return {
                ...b,
                total: units.length,
                manufactured: units.filter(
                  (u) => u.status === 'MANUFACTURED'
                ).length,
              };
            })
        );

        setBatches(enriched);
      } finally {
        setLoading(false);
      }
    })();
  }, [manufacturer.id]);

  if (staff.role !== 'ACTIVATION_OFFICER' && staff.role !== 'SUPERVISOR') {
    return (
      <div className="mf-page">
        <div className="mf-error-large">
          <h2>Access denied</h2>
          <p>
            Only the Activation Officer and Supervisor roles can access this page.
          </p>
        </div>
      </div>
    );
  }

  if (loading) return <div className="mf-loading">Loading queue…</div>;

  return (
    <div className="mf-page">
      <header className="mf-page-header">
        <div>
          <h1>Activation Queue</h1>
          <p>
            Batches waiting for you to generate and activate their QR codes.
          </p>
        </div>
      </header>

      {batches.length === 0 ? (
        <div className="mf-empty">
          <div className="mf-empty-icon">🎉</div>
          <p>Nothing waiting. All batches are fully activated.</p>
        </div>
      ) : (
        <ul className="mf-list mf-activation-list">
          {batches.map((b) => (
            <li key={b.id} className="mf-list-item">
              <div>
                <strong>{b.batchCode}</strong>
                <span>
                  {b.total} units · produced {b.productionDate} at{' '}
                  {b.productionLocation}
                </span>
                <span className="mf-list-subtle">
                  Created by {b.generationRequestedByName || 'Generation Officer'}
                </span>
              </div>
              <div className="mf-list-item-right">
                <span className="mf-pill mf-pill-awaiting_activation">
                  Awaiting
                </span>
                <Link
                  to={`/manufacturer/batches/${b.id}/generate-qr`}
                  className="mf-btn mf-btn-primary mf-btn-small"
                >
                  Generate &amp; Activate
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default ManufacturerActivation;