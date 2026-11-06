// src/admin/AdminManufacturerApplicationDetail.jsx
import { useEffect, useState } from 'react';
import { Link, useParams, useNavigate, useOutletContext } from 'react-router-dom';
import {
  fetchManufacturerApplicationById,
  approveManufacturerApplication,
  rejectManufacturerApplication,
} from './adminAuth';
import './AdminPortal.css';

const AdminManufacturerApplicationDetail = () => {
  const { id } = useParams();
  const { admin } = useOutletContext();
  const navigate = useNavigate();

  const [app, setApp] = useState(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const [showReject, setShowReject] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await fetchManufacturerApplicationById(id);
      setApp(data);
    } catch (err) {
      console.error(err);
      setError('Could not load application.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const handleApprove = async () => {
    if (!window.confirm(`Approve ${app.companyName}?`)) return;
    setActing(true);
    try {
      await approveManufacturerApplication({
        applicationId: id,
        adminId: admin.id,
        adminName: admin.fullName,
      });
      navigate('/admin/manufacturer-applications', { replace: true });
    } catch (err) {
      console.error(err);
      alert(err.message || 'Approval failed.');
    } finally {
      setActing(false);
    }
  };

  const handleReject = async () => {
    if (!rejectReason.trim()) return;
    setActing(true);
    try {
      await rejectManufacturerApplication({
        applicationId: id,
        adminId: admin.id,
        adminName: admin.fullName,
        reason: rejectReason.trim(),
      });
      navigate('/admin/manufacturer-applications', { replace: true });
    } catch (err) {
      console.error(err);
      alert(err.message || 'Rejection failed.');
    } finally {
      setActing(false);
    }
  };

  if (loading) {
    return (
      <div className="admin-page">
        <div className="admin-page-loading">Loading application…</div>
      </div>
    );
  }

  if (!app) {
    return (
      <div className="admin-page">
        <Link to="/admin/manufacturer-applications" className="admin-back">
          ← All applications
        </Link>
        <div className="admin-empty">
          <p>Application not found.</p>
        </div>
      </div>
    );
  }

  const isPending = app.status === 'pending';
  const isApproved = app.status === 'approved';
  const isRejected = app.status === 'rejected';

  return (
    <div className="admin-page">
      <Link to="/admin/manufacturer-applications" className="admin-back">
        ← All applications
      </Link>

      <header className="admin-page-header admin-page-header-with-actions">
        <div>
          <h1>{app.companyName || 'Manufacturer Application'}</h1>
          <p>
            Submitted {formatDate(app.submittedAt)} ·{' '}
            <span className={`admin-pill admin-pill-${app.status}`}>
              {app.status}
            </span>
          </p>
        </div>
        {isPending && (
          <div className="admin-header-actions">
            <button
              className="admin-btn admin-btn-danger"
              onClick={() => setShowReject((v) => !v)}
              disabled={acting}
              type="button"
            >
              {showReject ? 'Cancel' : 'Reject'}
            </button>
            <button
              className="admin-btn admin-btn-success"
              onClick={handleApprove}
              disabled={acting}
              type="button"
            >
              {acting ? 'Working…' : 'Approve'}
            </button>
          </div>
        )}
      </header>

      {error && <div className="admin-error">{error}</div>}

      {isApproved && (
        <div className="admin-notice admin-notice-success">
          <strong>✓ This application was approved.</strong>
          <p>
            A manufacturer account was created
            {app.promotedManufacturerId
              ? ` (ID: ${app.promotedManufacturerId})`
              : ''}
            . The applicant can now sign in to the manufacturer portal.
          </p>
        </div>
      )}

      {isRejected && (
        <div className="admin-notice admin-notice-danger">
          <strong>This application was rejected.</strong>
          <p className="admin-notice-reason">
            Reason: {app.rejectionReason || 'Not specified'}
          </p>
        </div>
      )}

      {showReject && isPending && (
        <div className="admin-reject-box">
          <label>
            <strong>Reason for rejection</strong>
            <span>This will be sent to the applicant.</span>
          </label>
          <textarea
            rows={3}
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder="e.g. Registration number could not be verified."
          />
          <div className="admin-reject-actions">
            <button
              className="admin-btn admin-btn-ghost"
              onClick={() => setShowReject(false)}
              disabled={acting}
              type="button"
            >
              Cancel
            </button>
            <button
              className="admin-btn admin-btn-danger"
              onClick={handleReject}
              disabled={acting || !rejectReason.trim()}
              type="button"
            >
              {acting ? 'Rejecting…' : 'Confirm rejection'}
            </button>
          </div>
        </div>
      )}

      <div className="admin-detail-grid">
        <div className="admin-detail-col">
          {/* Company */}
          <section className="admin-detail-section">
            <h3 className="admin-detail-section-title">Company</h3>
            <div className="admin-detail-section-body">
              <Field label="Registered name" value={app.companyName} />
              <Field label="Contact email" value={app.contactEmail} />
              <Field label="Phone" value={app.phoneNumber} />
              <Field label="Website" value={app.website} />
              <Field
                label="Business type"
                value={prettyBusinessType(app.businessInfo?.businessType)}
              />
              <Field
                label="Registration number"
                value={app.businessInfo?.registrationNumber}
              />
              <Field label="Tax ID / TIN" value={app.businessInfo?.taxId} />
            </div>
          </section>

          {/* Address */}
          <section className="admin-detail-section">
            <h3 className="admin-detail-section-title">Factory address</h3>
            <div className="admin-detail-section-body">
              <Field
                label="Physical address"
                value={app.address?.physicalAddress}
              />
              <Field label="City" value={app.address?.city} />
              <Field label="State" value={app.address?.state} />
              <Field label="Country" value={app.address?.country} />
            </div>
          </section>
        </div>

        <div className="admin-detail-col">
          {/* Contact person */}
          <section className="admin-detail-section">
            <h3 className="admin-detail-section-title">Primary contact</h3>
            <div className="admin-detail-section-body">
              <Field label="Full name" value={app.contactPerson?.fullName} />
              <Field label="Role" value={app.contactPerson?.role} />
            </div>
          </section>

          {/* Review status */}
          <section className="admin-detail-section">
            <h3 className="admin-detail-section-title">Review</h3>
            <div className="admin-detail-section-body">
              <Field label="Status" value={app.status} />
              <Field label="Submitted" value={formatDate(app.submittedAt)} />
              <Field
                label="Reviewed"
                value={app.reviewedAt ? formatDate(app.reviewedAt) : '—'}
              />
              <Field label="Reviewed by" value={app.reviewedByName || '—'} />
              {app.rejectionReason && (
                <Field label="Rejection reason" value={app.rejectionReason} />
              )}
              {app.promotedManufacturerId && (
                <Field
                  label="Manufacturer ID"
                  value={<code className="admin-code-small">{app.promotedManufacturerId}</code>}
                />
              )}
              <Field
                label="Firebase UID"
                value={
                  app.firebaseUid ? (
                    <code className="admin-code-small">{app.firebaseUid}</code>
                  ) : (
                    '—'
                  )
                }
              />
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

const Field = ({ label, value }) => (
  <div className="admin-detail-field">
    <span className="admin-detail-label">{label}</span>
    <span className="admin-detail-value">
      {value !== null && value !== undefined && value !== '' ? value : '—'}
    </span>
  </div>
);

const formatDate = (ts) => {
  if (!ts) return '—';
  try {
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleDateString([], {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return '—';
  }
};

const prettyBusinessType = (v) =>
  v
    ? String(v).replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
    : null;

export default AdminManufacturerApplicationDetail;