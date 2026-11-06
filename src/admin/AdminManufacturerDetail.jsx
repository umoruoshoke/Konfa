// src/admin/AdminManufacturerDetail.jsx
import { useEffect, useState } from 'react';
import { useParams, useNavigate, useOutletContext, Link } from 'react-router-dom';
import {
  fetchManufacturerById,
  fetchManufacturerApplicationForManufacturer,
  suspendManufacturer,
  reactivateManufacturer,
} from './adminAuth';
import './AdminPortal.css';

const AdminManufacturerDetail = () => {
  const { id } = useParams();
  const { admin } = useOutletContext();
  const navigate = useNavigate();

  const [manufacturer, setManufacturer] = useState(null);
  const [sourceApp, setSourceApp] = useState(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const [error, setError] = useState('');
  const [showSuspend, setShowSuspend] = useState(false);
  const [suspendReason, setSuspendReason] = useState('');

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const m = await fetchManufacturerById(id);
        if (cancelled) return;
        setManufacturer(m);

        // Best-effort: load the original application so we can show
        // when it was submitted and by whom it was reviewed.
        if (m?.applicationId) {
          try {
            const a = await fetchManufacturerApplicationForManufacturer(m);
            if (!cancelled) setSourceApp(a);
          } catch (err) {
            console.warn('Could not load source application:', err);
          }
        }
      } catch (err) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [id]);

  const handleSuspend = async () => {
    if (!suspendReason.trim()) {
      setError('Please provide a suspension reason.');
      return;
    }
    setActing(true);
    setError('');
    try {
      await suspendManufacturer({
        manufacturerId: id,
        adminId: admin.id,
        adminName: admin.fullName,
        reason: suspendReason,
      });
      const refreshed = await fetchManufacturerById(id);
      setManufacturer(refreshed);
      setShowSuspend(false);
      setSuspendReason('');
    } catch (err) {
      setError(err.message);
    } finally {
      setActing(false);
    }
  };

  const handleReactivate = async () => {
    if (!window.confirm(`Reactivate ${manufacturer.companyName}?`)) return;
    setActing(true);
    setError('');
    try {
      await reactivateManufacturer({
        manufacturerId: id,
        adminId: admin.id,
        adminName: admin.fullName,
      });
      const refreshed = await fetchManufacturerById(id);
      setManufacturer(refreshed);
    } catch (err) {
      setError(err.message);
    } finally {
      setActing(false);
    }
  };

  if (loading) {
    return <div className="admin-page-loading">Loading manufacturer…</div>;
  }
  if (!manufacturer) {
    return <div className="admin-page-loading">Manufacturer not found.</div>;
  }

  const isActive = manufacturer.status === 'active' || manufacturer.status === 'approved';
  const isSuspended = manufacturer.status === 'suspended';

  return (
    <div className="admin-page">
      <Link to="/admin/manufacturers" className="admin-back">
        ← Back to manufacturers
      </Link>

      <header className="admin-page-header admin-page-header-with-actions">
        <div>
          <h1>{manufacturer.companyName || 'Unnamed manufacturer'}</h1>
          <p>
            {manufacturer.registrationStatus === 'approved' && 'Approved · '}
            Status:{' '}
            <span className={`admin-pill admin-pill-${manufacturer.status}`}>
              {manufacturer.status || 'unknown'}
            </span>
          </p>
        </div>

        <div className="admin-header-actions">
          {isActive && (
            <button
              className="admin-btn admin-btn-danger"
              onClick={() => setShowSuspend((v) => !v)}
              disabled={acting}
            >
              {showSuspend ? 'Cancel' : 'Suspend'}
            </button>
          )}
          {isSuspended && (
            <button
              className="admin-btn admin-btn-success"
              onClick={handleReactivate}
              disabled={acting}
            >
              {acting ? 'Reactivating…' : '✓ Reactivate'}
            </button>
          )}
        </div>
      </header>

      {error && (
        <div className="admin-error admin-error-large">
          <strong>Error:</strong> {error}
        </div>
      )}

      {isSuspended && (
        <div className="admin-notice admin-notice-danger">
          <strong>Suspended</strong>
          <p>
            {manufacturer.suspensionReason
              ? `Reason: ${manufacturer.suspensionReason}`
              : 'No reason was recorded.'}
          </p>
        </div>
      )}

      {showSuspend && isActive && (
        <div className="admin-reject-box">
          <label>
            <strong>Suspension reason</strong>
            <span>This will be recorded in the audit log.</span>
          </label>
          <textarea
            value={suspendReason}
            onChange={(e) => setSuspendReason(e.target.value)}
            placeholder="e.g. Repeated policy violations."
            rows={4}
          />
          <div className="admin-reject-actions">
            <button
              className="admin-btn admin-btn-ghost"
              onClick={() => {
                setShowSuspend(false);
                setSuspendReason('');
              }}
              disabled={acting}
            >
              Cancel
            </button>
            <button
              className="admin-btn admin-btn-danger"
              onClick={handleSuspend}
              disabled={acting || !suspendReason.trim()}
            >
              {acting ? 'Suspending…' : 'Confirm Suspension'}
            </button>
          </div>
        </div>
      )}

      <div className="admin-detail-grid">
        <div className="admin-detail-col">
          <Section title="Company details">
            <Field label="Company name" value={manufacturer.companyName} />
            <Field label="Business type" value={prettyBusinessType(manufacturer.businessType)} />
            <Field
              label="Registration number"
              value={manufacturer.registrationNumber}
            />
            <Field label="Tax ID / TIN" value={manufacturer.taxId} />
            <Field label="Website" value={manufacturer.website} />
            <Field
              label="Verified"
              value={manufacturer.verified ? 'Yes' : 'No'}
            />
          </Section>

          <Section title="Contact">
            <Field label="Contact person" value={manufacturer.contactPersonName} />
            <Field label="Role" value={manufacturer.contactPersonRole} />
            <Field label="Email" value={manufacturer.contactEmail} />
            <Field label="Phone" value={manufacturer.phoneNumber} />
          </Section>

          <Section title="Address">
            <Field label="Physical address" value={manufacturer.physicalAddress} />
            <Field label="City" value={manufacturer.city} />
            <Field label="State" value={manufacturer.state} />
            <Field label="Country" value={manufacturer.country} />
          </Section>
        </div>

        <div className="admin-detail-col">
          <Section title="Application metadata">
            <Field
              label="Manufacturer ID"
              value={<code className="admin-code-small">{manufacturer.id}</code>}
            />
            {manufacturer.applicationId && (
              <Field
                label="Original application"
                value={
                  <Link
                    to={`/admin/manufacturer-applications/${manufacturer.applicationId}`}
                    className="admin-link-strong"
                  >
                    {manufacturer.applicationId}
                  </Link>
                }
              />
            )}
            <Field
              label="Submitted"
              value={
                sourceApp?.submittedAt
                  ? formatDateTime(sourceApp.submittedAt)
                  : '—'
              }
            />
            <Field
              label="Approved"
              value={formatDateTime(manufacturer.approvedAt)}
            />
            <Field
              label="Approved by"
              value={manufacturer.approvedByName}
            />
            <Field
              label="Registration status"
              value={manufacturer.registrationStatus || '—'}
            />
            <Field
              label="Onboarding source"
              value={manufacturer.onboardingSource || '—'}
            />
            <Field
              label="Firebase UID"
              value={
                manufacturer.firebaseUid ? (
                  <code className="admin-code-small">
                    {manufacturer.firebaseUid}
                  </code>
                ) : (
                  '—'
                )
              }
            />
          </Section>

          <Section title="Activity">
            <Field
              label="Staff accounts"
              value={manufacturer.metadata?.staffCount ?? 0}
            />
            <Field
              label="Batches"
              value={manufacturer.metadata?.batchCount ?? 0}
            />
            <Field
              label="Units"
              value={manufacturer.metadata?.unitCount ?? 0}
            />
          </Section>

          <Section title="Settings">
            <Field
              label="Allow staff invites"
              value={manufacturer.settings?.allowStaffInvites ? 'Yes' : 'No'}
            />
            <Field
              label="Notification email"
              value={manufacturer.settings?.notificationsEmail || '—'}
            />
          </Section>
        </div>
      </div>
    </div>
  );
};

// ============================================================
// SUB-COMPONENTS
// ============================================================

const Section = ({ title, children }) => (
  <section className="admin-detail-section">
    <h2 className="admin-detail-section-title">{title}</h2>
    <div className="admin-detail-section-body">{children}</div>
  </section>
);

const Field = ({ label, value }) => (
  <div className="admin-detail-field">
    <span className="admin-detail-label">{label}</span>
    <span className="admin-detail-value">{value || '—'}</span>
  </div>
);

// ============================================================
// HELPERS
// ============================================================

const prettyBusinessType = (v) => {
  if (!v) return null;
  return String(v)
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
};

const formatDateTime = (ts) => {
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
};

export default AdminManufacturerDetail;