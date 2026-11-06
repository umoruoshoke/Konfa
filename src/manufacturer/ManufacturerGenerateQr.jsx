// src/manufacturer/ManufacturerGenerateQr.jsx
import { useEffect, useState } from 'react';
import {
  useParams,
  useOutletContext,
  Link,
  useNavigate,
} from 'react-router-dom';
import {
  fetchBatchById,
  fetchBatchUnits,
  markUnitsAsActivated,
} from './manufacturerAuth';
import { generateBatchQrZip } from './manufacturerQrGenerator';
import './ManufacturerPortal.css';

const ManufacturerGenerateQr = () => {
  const { id } = useParams();
  const { staff } = useOutletContext();
  const navigate = useNavigate();

  const [batch, setBatch] = useState(null);
  const [units, setUnits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [error, setError] = useState('');
  const [activationDone, setActivationDone] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [b, u] = await Promise.all([
          fetchBatchById(id),
          fetchBatchUnits(id),
        ]);
        setBatch(b);
        setUnits(u);
      } catch (err) {
        console.error(err);
        setError('Could not load batch.');
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  const canGenerate = ['ACTIVATION_OFFICER', 'SUPERVISOR'].includes(staff.role);

  if (!canGenerate) {
    return (
      <div className="mf-page">
        <div className="mf-error-large">
          <h2>Access denied</h2>
          <p>
            Only the Activation Officer or Supervisor can generate and download QR
            codes. This enforces separation of duties from the Generation Officer
            who created the batch.
          </p>
          <Link
            to={`/manufacturer/batches/${id}`}
            className="mf-btn mf-btn-primary"
          >
            Back to batch
          </Link>
        </div>
      </div>
    );
  }

  if (loading) return <div className="mf-loading">Loading units…</div>;
  if (!batch) return <div className="mf-loading">Batch not found.</div>;

  if (batch.status === 'activated') {
    return (
      <div className="mf-page">
        <div className="mf-empty">
          <div className="mf-empty-icon">✓</div>
          <p>This batch has already been activated.</p>
          <Link
            to={`/manufacturer/batches/${id}`}
            className="mf-btn mf-btn-primary"
          >
            View the batch
          </Link>
        </div>
      </div>
    );
  }

  const unactivatedUnits = units.filter((u) => u.status === 'MANUFACTURED');
  const alreadyActivated = units.length - unactivatedUnits.length;

  const handleDownloadAndActivate = async () => {
    setError('');
    setDownloading(true);
    setProgress({ done: 0, total: unactivatedUnits.length * 2 + 3 });

    try {
      // 1. Build the ZIP (with fresh PINs regenerated for this batch)
      await generateBatchQrZip({
        batch,
        units: unactivatedUnits,
        onProgress: (done, total) => setProgress({ done, total }),
      });

      // 2. Mark units ACTIVE + flip batch status + close notifications
      await markUnitsAsActivated({
        batchId: id,
        staffId: staff.id,
        staffName: staff.fullName,
        unitIds: unactivatedUnits.map((u) => u.id),
      });

      setActivationDone(true);
      setTimeout(() => {
        navigate(`/manufacturer/batches/${id}`);
      }, 3000);
    } catch (err) {
      console.error(err);
      setError(
        err?.message ||
          'Something went wrong. The QR codes may not have been downloaded.'
      );
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="mf-page">
      <Link to={`/manufacturer/batches/${id}`} className="mf-back">
        ← Back to batch
      </Link>

      <header className="mf-page-header">
        <div>
          <h1>Generate QR Codes</h1>
          <p>
            Batch <strong>{batch.batchCode}</strong> · Signed in as{' '}
            <strong>{staff.fullName}</strong> ({staff.role.replace(/_/g, ' ')})
          </p>
        </div>
      </header>

      <div className="mf-qr-summary">
        <div className="mf-qr-stat">
          <span className="mf-qr-stat-label">Units in batch</span>
          <span className="mf-qr-stat-value">{units.length}</span>
        </div>
        <div className="mf-qr-stat">
          <span className="mf-qr-stat-label">Awaiting activation</span>
          <span className="mf-qr-stat-value">{unactivatedUnits.length}</span>
        </div>
        <div className="mf-qr-stat">
          <span className="mf-qr-stat-label">Already active</span>
          <span className="mf-qr-stat-value">{alreadyActivated}</span>
        </div>
      </div>

      <div className="mf-qr-info">
        <h3>What you'll get in the ZIP</h3>
        <ul>
          <li>
            <strong>png/consumer_qr/</strong> — {unactivatedUnits.length} PNG files,
            one per unit, with the reference code printed below each QR
          </li>
          <li>
            <strong>png/seller_qr/</strong> — {unactivatedUnits.length} PNG files
            with the seller token
          </li>
          <li>
            <strong>pdf/consumer_labels.pdf</strong> — A4 print-ready sheets, QR +
            reference code below
          </li>
          <li>
            <strong>pdf/seller_labels.pdf</strong> — A4 print-ready sheets, QR +
            seller token below
          </li>
          <li>
            <strong>pdf/labels_with_pins.pdf</strong> — QR + reference + PIN
            (sensitive)
          </li>
          <li>
            <strong>labels.csv</strong> — full manifest
          </li>
          <li>
            <strong>README.txt</strong> + <strong>MANIFEST.json</strong>
          </li>
        </ul>

        <div className="mf-qr-warning">
          <strong>⚠️ Handle with care</strong>
          <p>
            The CSV and <code>labels_with_pins.pdf</code> contain plaintext PINs.
            After printing, destroy the CSV and only distribute the label files.
            Once activated, plaintext PINs are not retrievable from the Konfa
            backend — only the hash remains.
          </p>
        </div>
      </div>

      {error && <div className="mf-error">{error}</div>}

      {activationDone ? (
        <div className="mf-qr-success">
          <div className="mf-qr-success-icon">✓</div>
          <h2>Done!</h2>
          <p>
            Your ZIP has been downloaded and all {unactivatedUnits.length} units are
            now <strong>ACTIVE</strong>. They can be verified by consumers right
            away.
          </p>
        </div>
      ) : (
        <button
          type="button"
          className="mf-btn mf-btn-primary mf-qr-download-btn"
          onClick={handleDownloadAndActivate}
          disabled={downloading || unactivatedUnits.length === 0}
        >
          {downloading
            ? `Generating ${progress.done} / ${progress.total} files…`
            : `📥 Download ZIP & Activate ${unactivatedUnits.length} Units`}
        </button>
      )}

      {unactivatedUnits.length === 0 && !activationDone && (
        <div className="mf-hint-box">
          <p>All units in this batch are already active. Nothing to generate.</p>
        </div>
      )}
    </div>
  );
};

export default ManufacturerGenerateQr;