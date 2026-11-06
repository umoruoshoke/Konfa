// src/admin/AdminSellerDetail.jsx
import { useEffect, useState } from 'react';
import { useParams, useNavigate, useOutletContext, Link } from 'react-router-dom';
import {
  fetchApplicationById,
  fetchSellerById,
  fetchSellerApplicationForSeller,
  approveSellerApplication,
  rejectSellerApplication,
} from './adminAuth';
import './AdminPortal.css';

const AdminSellerDetail = () => {
  const { id } = useParams();
  const { admin } = useOutletContext();
  const navigate = useNavigate();

  // The rendered record. It may come from:
  //   - seller_applications/{id}   (pending/rejected flow)
  //   - sellers/{id}               (approved seller, from Sellers page)
  const [record, setRecord] = useState(null);
  const [recordKind, setRecordKind] = useState(null); // 'application' | 'seller'
  const [sourceApp, setSourceApp] = useState(null);

  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const [error, setError] = useState('');
  const [showReject, setShowReject] = useState(false);
  const [rejectReason, setRejectReason] = useState('');

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setLoading(true);
      setError('');

      try {
        // ---- 1. Try as a seller_application ----
        const application = await fetchApplicationById(id).catch(() => null);

        if (application) {
          if (!cancelled) {
            setRecord(application);
            setRecordKind('application');
          }
          return;
        }

        // ---- 2. Fall back to sellers/{id} ----
        const seller = await fetchSellerById(id).catch(() => null);

        if (seller) {
          let source = null;
          try {
            source = await fetchSellerApplicationForSeller(seller);
          } catch (err) {
            console.warn('Could not load source application:', err);
          }

          const merged = {
            ...seller,
            businessInfo: source?.businessInfo || {
              businessType: seller.businessType,
              registrationNumber: seller.businessRegistrationNumber,
              taxId: seller.taxId,
              physicalAddress: seller.physicalAddress,
              city: seller.city,
              state: seller.state,
              website: seller.website,
            },
            contactPerson: source?.contactPerson || {
              fullName: seller.contactPersonName,
              role: seller.contactPersonRole,
            },
            submittedAt: source?.submittedAt || seller.createdAt || null,
            notes: source?.notes || null,
            _sourceApplicationId:
              source?.id || seller.applicationId || null,
          };

          if (!cancelled) {
            setRecord(merged);
            setSourceApp(source);
            setRecordKind('seller');
          }
          return;
        }

        if (!cancelled) setError('Record not found.');
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

  // ============================================================
  // ACTIONS
  // ============================================================

  const handleApprove = async () => {
    if (!window.confirm(`Approve ${record.companyName} as a seller?`)) return;
    setActing(true);
    setError('');
    try {
      await approveSellerApplication({
        applicationId: record.id,
        adminId: admin.id,
        adminName: admin.fullName,
      });
      navigate('/admin/sellers');
    } catch (err) {
      setError(err.message);
      setActing(false);
    }
  };

  const handleReject = async () => {
    if (!rejectReason.trim()) {
      setError('Please provide a rejection reason.');
      return;
    }
    setActing(true);
    setError('');
    try {
      await rejectSellerApplication({
        applicationId: record.id,
        adminId: admin.id,
        adminName: admin.fullName,
        reason: rejectReason,
      });
      navigate('/admin/sellers');
    } catch (err) {
      setError(err.message);
      setActing(false);
    }
  };

  // ============================================================
  // RENDER GATES
  // ============================================================

  if (loading) {
    return <div className="admin-page-loading">Loading application…</div>;
  }
  if (!record) {
    return <div className="admin-page-loading">Record not found.</div>;
  }

  const status = String(record.status || 'pending').toLowerCase();
  const isPending = status === 'pending';
  const isActive = status === 'active' || status === 'approved';
  const isRejected = status === 'rejected';
  const isSuspended = status === 'suspended';

  const backTarget = '/admin/sellers';

  return (
    <div className="admin-page">
      <Link to={backTarget} className="admin-back">
        ← Back to sellers
      </Link>

      <header className="admin-page-header admin-page-header-with-actions">
        <div>
          <h1>{record.companyName || 'Unnamed'}</h1>
          <p>
            {record.submittedAt
              ? `Applied ${formatDate(record.submittedAt)} · `
              : ''}
            Status:{' '}
            <span className={`admin-pill admin-pill-${status}`}>
              {status}
            </span>
          </p>
        </div>

        {isPending && recordKind === 'application' && (
          <div className="admin-header-actions">
            <button
              className="admin-btn admin-btn-danger"
              onClick={() => setShowReject((v) => !v)}
              disabled={acting}
            >
              {showReject ? 'Cancel' : 'Reject'}
            </button>
            <button
              className="admin-btn admin-btn-primary"
              onClick={handleApprove}
              disabled={acting}
            >
              {acting ? 'Approving…' : '✓ Approve Seller'}
            </button>
          </div>
        )}
      </header>

      {error && (
        <div className="admin-error admin-error-large">
          <strong>Error:</strong> {error}
        </div>
      )}

      {/* ---- Approved banner (only when viewing the seller record) ---- */}
      {isActive && recordKind === 'seller' && (
        <div className="admin-notice admin-notice-success">
          <strong>✓ Active seller</strong>
          <p>
            This seller has full access to the Seller Portal.
            {record.approvedByName && ` Approved by ${record.approvedByName}`}
            {record.approvedAt && ` on ${formatDate(record.approvedAt)}`}.
          </p>
        </div>
      )}

      {/* ---- Suspended banner ---- */}
      {isSuspended && (
        <div className="admin-notice admin-notice-danger">
          <strong>Suspended</strong>
          <p>
            {record.suspensionReason
              ? `Reason: ${record.suspensionReason}`
              : 'No reason was recorded.'}
          </p>
        </div>
      )}

      {/* ---- Rejected banner ---- */}
      {isRejected && (
        <div className="admin-notice admin-notice-danger">
          <strong>✕ Application rejected</strong>
          <p>
            {record.reviewedByName && `By ${record.reviewedByName}`}
            {record.reviewedAt && ` on ${formatDate(record.reviewedAt)}`}.
          </p>
          {record.rejectionReason && (
            <p className="admin-notice-reason">
              <strong>Reason:</strong> {record.rejectionReason}
            </p>
          )}
        </div>
      )}

      {/* ---- Reject form ---- */}
      {showReject && isPending && (
        <div className="admin-reject-box">
          <label>
            <strong>Rejection reason</strong>
            <span>This will be shared with the applicant.</span>
          </label>
          <textarea
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder="e.g. Business registration number could not be verified."
            rows={4}
          />
          <div className="admin-reject-actions">
            <button
              className="admin-btn admin-btn-ghost"
              onClick={() => {
                setShowReject(false);
                setRejectReason('');
              }}
              disabled={acting}
            >
              Cancel
            </button>
            <button
              className="admin-btn admin-btn-danger"
              onClick={handleReject}
              disabled={acting || !rejectReason.trim()}
            >
              {acting ? 'Rejecting…' : 'Confirm Rejection'}
            </button>
          </div>
        </div>
      )}

      {/* ============================================================
          DETAILS — two-column layout
          ============================================================ */}
      <div className="admin-detail-grid">
        <div className="admin-detail-col">
          <Section title="Account details">
            <Field label="Company name" value={record.companyName} />
            <Field label="Email" value={record.email} />
            <Field label="Phone" value={record.phoneNumber} />
            <Field
              label="Requested role"
              value={record.requestedRole || record.role}
            />
          </Section>

          <Section title="Business information">
            <Field
              label="Business type"
              value={prettyBusinessType(record.businessInfo?.businessType)}
            />
            <Field
              label="Registration number"
              value={record.businessInfo?.registrationNumber}
            />
            <Field
              label="Tax ID / TIN"
              value={record.businessInfo?.taxId}
            />
            <Field
              label="Physical address"
              value={record.businessInfo?.physicalAddress}
            />
            <Field label="City" value={record.businessInfo?.city} />
            <Field label="State" value={record.businessInfo?.state} />
            <Field
              label="Website"
              value={record.businessInfo?.website || '—'}
            />
          </Section>

          <Section title="Primary contact">
            <Field
              label="Full name"
              value={record.contactPerson?.fullName}
            />
            <Field label="Role" value={record.contactPerson?.role} />
          </Section>

          {record.notes && (
            <Section title="Applicant notes">
              <p className="admin-notes">{record.notes}</p>
            </Section>
          )}
        </div>

        <div className="admin-detail-col">
          <Section title="Application metadata">
            <Field
              label="Record type"
              value={
                recordKind === 'seller' ? 'Active seller' : 'Application'
              }
            />
            <Field
              label="Record ID"
              value={<code className="admin-code-small">{record.id}</code>}
            />
            {recordKind === 'seller' && record._sourceApplicationId && (
              <Field
                label="Source application"
                value={
                  <Link
                    to={`/admin/sellers/${record._sourceApplicationId}`}
                    className="admin-link-strong"
                  >
                    {record._sourceApplicationId}
                  </Link>
                }
              />
            )}
            <Field label="Status" value={status} />
            <Field
              label="Submitted"
              value={formatDateTime(record.submittedAt)}
            />
            {record.reviewedAt && (
              <Field
                label="Reviewed"
                value={formatDateTime(record.reviewedAt)}
              />
            )}
            {record.reviewedByName && (
              <Field label="Reviewed by" value={record.reviewedByName} />
            )}
            {record.approvedByName && (
              <Field label="Approved by" value={record.approvedByName} />
            )}
            {record.approvedAt && (
              <Field
                label="Approved"
                value={formatDateTime(record.approvedAt)}
              />
            )}
            {record.promotedSellerId && (
              <Field
                label="Promoted to seller"
                value={
                  <Link
                    to={`/admin/sellers/${record.promotedSellerId}`}
                    className="admin-link-strong"
                  >
                    {record.promotedSellerId}
                  </Link>
                }
              />
            )}
            <Field
              label="Firebase UID"
              value={
                record.firebaseUid ? (
                  <code className="admin-code-small">
                    {record.firebaseUid}
                  </code>
                ) : (
                  '—'
                )
              }
            />
          </Section>

          <Section title="Documents">
            <div className="admin-doc-list">
              <div className="admin-doc-item">
                <span>📄 Business registration certificate</span>
                <span className="admin-doc-status">Not uploaded</span>
              </div>
              <div className="admin-doc-item">
                <span>📄 Tax ID document</span>
                <span className="admin-doc-status">Not uploaded</span>
              </div>
              <div className="admin-doc-item">
                <span>📄 ID of primary contact</span>
                <span className="admin-doc-status">Not uploaded</span>
              </div>
            </div>
            <p className="admin-doc-note">
              Document upload will be added in a future release.
            </p>
          </Section>

          {sourceApp && (
            <Section title="Original application">
              <Field
                label="Application ID"
                value={
                  <Link
                    to={`/admin/sellers/${sourceApp.id}`}
                    className="admin-link-strong"
                  >
                    {sourceApp.id}
                  </Link>
                }
              />
              <Field
                label="Submitted"
                value={formatDateTime(sourceApp.submittedAt)}
              />
              <Field label="Status" value={sourceApp.status} />
            </Section>
          )}
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

export default AdminSellerDetail;