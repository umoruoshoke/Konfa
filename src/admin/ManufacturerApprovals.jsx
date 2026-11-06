// src/admin/ManufacturerApprovals.jsx
import { useEffect, useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import {
  fetchPendingManufacturerApplications,
  fetchActiveManufacturers,
  approveManufacturerApplication,
  rejectManufacturerApplication,
  fetchAuditLog,
} from './adminAuth';
import './AdminPortal.css';

const REJECTION_REASONS = [
  { code: 'incomplete_docs', label: 'Incomplete documentation' },
  { code: 'invalid_reg',     label: 'Invalid registration number / TIN' },
  { code: 'no_facility',     label: 'Could not verify production facility' },
  { code: 'duplicate',       label: 'Duplicate of an existing manufacturer' },
  { code: 'other',           label: 'Other (see notes)' },
];

const ManufacturerApprovals = () => {
  const { admin } = useOutletContext();

  const [tab, setTab] = useState('pending');
  const [apps, setApps] = useState([]);
  const [activeMfrs, setActiveMfrs] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [toast, setToast] = useState(null);
  const [modal, setModal] = useState(null);

  const reload = async () => {
    setLoading(true);
    try {
      const [pending, active] = await Promise.all([
        fetchPendingManufacturerApplications(),
        fetchActiveManufacturers(),
      ]);
      setApps(pending);
      setActiveMfrs(active);
      if (pending.length > 0 && !selectedId) setSelectedId(pending[0].id);
    } catch (err) {
      console.error(err);
      setError('Could not load manufacturer applications.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { reload(); /* eslint-disable-next-line */ }, []);

  const filteredPending = useMemo(() => {
    if (!search.trim()) return apps;
    const q = search.toLowerCase();
    return apps.filter(
      (a) =>
        a.companyName?.toLowerCase().includes(q) ||
        a.email?.toLowerCase().includes(q)
    );
  }, [apps, search]);

  const filteredActive = useMemo(() => {
    if (!search.trim()) return activeMfrs;
    const q = search.toLowerCase();
    return activeMfrs.filter(
      (s) =>
        s.companyName?.toLowerCase().includes(q) ||
        s.email?.toLowerCase().includes(q)
    );
  }, [activeMfrs, search]);

  const selected =
    tab === 'pending'
      ? apps.find((a) => a.id === selectedId)
      : activeMfrs.find((s) => s.id === selectedId);

  const handleApprove = async (notes) => {
    try {
      await approveManufacturerApplication({
        applicationId: selected.id,
        adminId: admin.id,
        adminName: admin.fullName,
        adminNotes: notes,
      });
      setToast({ kind: 'success', msg: `${selected.companyName} approved.` });
      setModal(null);
      setSelectedId(null);
      reload();
    } catch (err) {
      setToast({ kind: 'error', msg: 'Approval failed.' });
    }
  };

  const handleReject = async ({ reason, notes }) => {
    try {
      await rejectManufacturerApplication({
        applicationId: selected.id,
        adminId: admin.id,
        adminName: admin.fullName,
        reason,
        adminNotes: notes,
      });
      setToast({ kind: 'success', msg: `${selected.companyName} rejected.` });
      setModal(null);
      setSelectedId(null);
      reload();
    } catch (err) {
      setToast({ kind: 'error', msg: 'Rejection failed.' });
    }
  };

  return (
    <div className="admin-sellers-page">
      <header className="admin-page-head">
        <div>
          <h1>Manufacturer Approvals</h1>
          <p>Review and approve manufacturers who want to join Konfa.</p>
        </div>
        <div className="admin-head-stats">
          <div className="admin-head-stat">
            <span className="admin-head-stat-label">Pending</span>
            <span className="admin-head-stat-value">{apps.length}</span>
          </div>
          <div className="admin-head-stat">
            <span className="admin-head-stat-label">Active</span>
            <span className="admin-head-stat-value">{activeMfrs.length}</span>
          </div>
        </div>
      </header>

      <div className="admin-sellers-tabs">
        <button
          className={`admin-sellers-tab ${tab === 'pending' ? 'active' : ''}`}
          onClick={() => { setTab('pending'); setSelectedId(apps[0]?.id ?? null); }}
        >
          Pending ({apps.length})
        </button>
        <button
          className={`admin-sellers-tab ${tab === 'active' ? 'active' : ''}`}
          onClick={() => { setTab('active'); setSelectedId(activeMfrs[0]?.id ?? null); }}
        >
          Active Manufacturers ({activeMfrs.length})
        </button>
      </div>

      <div className="admin-sellers-grid">
        <div className="admin-sellers-list-col">
          <div className="admin-sellers-search">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by company or email…"
            />
          </div>

          {loading && <p className="admin-muted">Loading…</p>}
          {error && <div className="admin-error-box">{error}</div>}

          <ul className="admin-sellers-list">
            {(tab === 'pending' ? filteredPending : filteredActive).map((a) => (
              <li
                key={a.id}
                className={`admin-sellers-list-item ${
                  selectedId === a.id ? 'active' : ''
                }`}
                onClick={() => setSelectedId(a.id)}
              >
                <div className="admin-sellers-avatar">
                  {a.companyName?.[0]?.toUpperCase() || '?'}
                </div>
                <div className="admin-sellers-list-text">
                  <strong>{a.companyName || 'Unnamed'}</strong>
                  <span>{a.email || '—'}</span>
                </div>
                <span className={`admin-sellers-pill admin-sellers-pill-${tab}`}>
                  {tab === 'pending' ? 'PENDING' : 'ACTIVE'}
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div className="admin-sellers-detail-col">
          {!selected && (
            <div className="admin-empty-state">
              <p>Select a manufacturer to review.</p>
            </div>
          )}

          {selected && (
            <div className="admin-detail-card">
              <div className="admin-detail-head">
                <div className="admin-detail-avatar">
                  {selected.companyName?.[0]?.toUpperCase() || '?'}
                </div>
                <div className="admin-detail-head-text">
                  <h2>{selected.companyName}</h2>
                  <p>{selected.email}</p>
                </div>
                <span className={`admin-sellers-pill admin-sellers-pill-${tab}`}>
                  {tab === 'pending' ? 'PENDING' : 'ACTIVE'}
                </span>
              </div>

              <div className="admin-detail-section">
                <h3>Account</h3>
                <div className="admin-detail-grid">
                  <Field label="Company" value={selected.companyName} />
                  <Field label="Email" value={selected.email} />
                  <Field label="Phone" value={selected.phoneNumber} />
                </div>
              </div>

              <div className="admin-detail-section">
                <h3>Business</h3>
                <div className="admin-detail-grid">
                  <Field label="Registration" value={selected.businessInfo?.registrationNumber} />
                  <Field label="TIN" value={selected.businessInfo?.taxId} />
                  <Field label="Address" value={selected.businessInfo?.physicalAddress} full />
                  <Field label="City" value={selected.businessInfo?.city} />
                  <Field label="State" value={selected.businessInfo?.state} />
                </div>
              </div>

              <div className="admin-detail-section">
                <h3>Primary contact</h3>
                <div className="admin-detail-grid">
                  <Field label="Name" value={selected.contactPerson?.fullName} />
                  <Field label="Role" value={selected.contactPerson?.role} />
                </div>
              </div>

              {tab === 'pending' && (
                <div className="admin-detail-actions">
                  <button
                    className="admin-btn admin-btn-danger"
                    onClick={() => setModal({ type: 'reject' })}
                  >
                    Reject
                  </button>
                  <button
                    className="admin-btn admin-btn-primary"
                    onClick={() => setModal({ type: 'approve' })}
                  >
                    Approve Manufacturer
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {modal?.type === 'approve' && (
        <ApproveModal
          app={selected}
          onCancel={() => setModal(null)}
          onConfirm={handleApprove}
        />
      )}

      {modal?.type === 'reject' && (
        <RejectModal
          app={selected}
          onCancel={() => setModal(null)}
          onConfirm={handleReject}
        />
      )}

      {toast && (
        <div className={`admin-toast admin-toast-${toast.kind}`}>
          {toast.msg}
          <button onClick={() => setToast(null)}>×</button>
        </div>
      )}
    </div>
  );
};

export default ManufacturerApprovals;

// (Same Field, ApproveModal, RejectModal components as in SellerApprovals —
//  for brevity here they're inlined below. If you prefer DRY, extract them to
//  a shared file. Copy-paste works fine.)

const Field = ({ label, value, full }) => (
  <div className={`admin-field ${full ? 'admin-field-full' : ''}`}>
    <span className="admin-field-label">{label}</span>
    <span className="admin-field-value">{value || '—'}</span>
  </div>
);

const ApproveModal = ({ app, onCancel, onConfirm }) => {
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const submit = async () => {
    setLoading(true);
    await onConfirm(notes);
    setLoading(false);
  };
  return (
    <div className="admin-modal-overlay">
      <div className="admin-modal">
        <div className="admin-modal-head">
          <h3>Approve {app.companyName}?</h3>
          <button onClick={onCancel}>×</button>
        </div>
        <p className="admin-modal-lead">
          This manufacturer will be able to create batches and generate QR codes.
        </p>
        <label className="admin-modal-field">
          <span>Notes (optional)</span>
          <textarea
            rows="3"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </label>
        <div className="admin-modal-actions">
          <button className="admin-btn admin-btn-ghost" onClick={onCancel}>Cancel</button>
          <button
            className="admin-btn admin-btn-primary"
            onClick={submit}
            disabled={loading}
          >
            {loading ? 'Approving…' : 'Approve'}
          </button>
        </div>
      </div>
    </div>
  );
};

const RejectModal = ({ app, onCancel, onConfirm }) => {
  const [reasonCode, setReasonCode] = useState(REJECTION_REASONS[0].code);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const submit = async () => {
    setLoading(true);
    const reason = REJECTION_REASONS.find((r) => r.code === reasonCode)?.label;
    await onConfirm({ reason, notes });
    setLoading(false);
  };
  return (
    <div className="admin-modal-overlay">
      <div className="admin-modal">
        <div className="admin-modal-head">
          <h3>Reject {app.companyName}</h3>
          <button onClick={onCancel}>×</button>
        </div>
        <label className="admin-modal-field">
          <span>Reason</span>
          <select
            value={reasonCode}
            onChange={(e) => setReasonCode(e.target.value)}
          >
            {REJECTION_REASONS.map((r) => (
              <option key={r.code} value={r.code}>{r.label}</option>
            ))}
          </select>
        </label>
        <label className="admin-modal-field">
          <span>Notes (optional)</span>
          <textarea
            rows="3"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </label>
        <div className="admin-modal-actions">
          <button className="admin-btn admin-btn-ghost" onClick={onCancel}>Cancel</button>
          <button
            className="admin-btn admin-btn-danger"
            onClick={submit}
            disabled={loading}
          >
            {loading ? 'Rejecting…' : 'Reject'}
          </button>
        </div>
      </div>
    </div>
  );
};