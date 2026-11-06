// src/manufacturer/ManufacturerStaff.jsx
import { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import {
  collection,
  query,
  where,
  getDocs,
} from 'firebase/firestore';
import { db } from '../firebase';
import {
  createStaffMember,
  updateStaffRole,
  setStaffStatus,
  ROLE_LABELS,
} from './manufacturerAuth';
import './ManufacturerPortal.css';

// Roles that can be assigned to staff (OWNER is not assignable —
// it's fixed at manufacturer creation).
const ASSIGNABLE_ROLES = [
  'ADMIN',
  'GENERATION_OFFICER',
  'ACTIVATION_OFFICER',
  'SHIPPING_OFFICER',
  'SUPERVISOR',
  'VIEWER',
];

const ROLE_DESCRIPTIONS = {
  ADMIN: 'Full access to everything, including staff management.',
  GENERATION_OFFICER: 'Create batches and register new products.',
  ACTIVATION_OFFICER: 'Generate QR code ZIPs and activate units.',
  SHIPPING_OFFICER: 'Create and manage shipments to distributors.',
  SUPERVISOR: 'Oversee operations — can approve, recall, and view staff.',
  VIEWER: 'Read-only access to dashboard, batches, and shipments.',
};

// Random password generator for "Suggest" button
function generatePassword() {
  const chars =
    'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#$%';
  let out = '';
  for (let i = 0; i < 12; i++) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}

const ManufacturerStaff = () => {
  const { manufacturer, staff: currentStaff } = useOutletContext();

  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [showInvite, setShowInvite] = useState(false);
  const [busyId, setBusyId] = useState(null);

  const [inviteForm, setInviteForm] = useState({
    fullName: '',
    email: '',
    phone: '',
    role: 'GENERATION_OFFICER',
    password: '',
    confirmPassword: '',
    showPassword: false,
  });
  const [inviting, setInviting] = useState(false);

  const canManage =
    currentStaff?.role === 'OWNER' ||
    currentStaff?.role === 'ADMIN' ||
    currentStaff?.role === 'SUPERVISOR';

  const load = async () => {
    if (!manufacturer?.id) return;
    setLoading(true);
    setError('');
    try {
      const ref = collection(db, 'manufacturer_staff');
      const snap = await getDocs(
        query(ref, where('manufacturerId', '==', manufacturer.id))
      );
      const list = snap.docs.map((d) => {
        const data = d.data();
        const fullName =
          data.fullName || data.name || data.email || 'Staff';
        return {
          ...data,
          id: d.id,
          fullName,
          displayEmail: data.email || '',
          displayPhone: data.phone || data.phoneNumber || '',
          displayRole: data.role || 'VIEWER',
          displayStatus: data.status || 'active',
        };
      });
      // Sort: OWNER first, then by role, then alphabetical
      list.sort((a, b) => {
        if (a.displayRole === 'OWNER') return -1;
        if (b.displayRole === 'OWNER') return 1;
        return (
          a.displayRole.localeCompare(b.displayRole) ||
          a.fullName.localeCompare(b.fullName)
        );
      });
      setMembers(list);
    } catch (err) {
      console.error('Failed to load staff:', err);
      setError(
        err.code === 'permission-denied'
          ? 'Permission denied. Check your Firestore rules.'
          : `Could not load staff: ${err.message}`
      );
      setMembers([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [manufacturer?.id]);

  const resetInviteForm = () => {
    setInviteForm({
      fullName: '',
      email: '',
      phone: '',
      role: 'GENERATION_OFFICER',
      password: '',
      confirmPassword: '',
      showPassword: false,
    });
  };

  const handleInvite = async (e) => {
    e.preventDefault();
    if (!canManage) return;
    setError('');
    setSuccessMsg('');

    const {
      fullName,
      email,
      phone,
      role,
      password,
      confirmPassword,
    } = inviteForm;

    if (!fullName.trim()) {
      setError('Enter the staff member\u2019s full name.');
      return;
    }
    if (!email.trim() || !/^\S+@\S+\.\S+$/.test(email.trim())) {
      setError('Enter a valid email address.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setInviting(true);
    try {
      // Duplicate check
      const existing = await getDocs(
        query(
          collection(db, 'manufacturer_staff'),
          where('manufacturerId', '==', manufacturer.id),
          where('email', '==', email.trim().toLowerCase())
        )
      );
      if (!existing.empty) {
        setError('A staff member with this email already exists.');
        setInviting(false);
        return;
      }

      await createStaffMember({
        manufacturerId: manufacturer.id,
        email: email.trim().toLowerCase(),
        password,
        fullName: fullName.trim(),
        phone: phone.trim(),
        role,
        invitedByStaffId: currentStaff?.id || null,
        invitedByName:
          currentStaff?.fullName || currentStaff?.name || 'Owner',
      });

      setSuccessMsg(
        `✅ ${fullName.trim()} can now sign in at /manufacturer/login with ${email.trim()}.`
      );
      resetInviteForm();
      setShowInvite(false);
      await load();
    } catch (err) {
      console.error('Invite failed:', err);
      setError(err.message || 'Invite failed. Please try again.');
    } finally {
      setInviting(false);
    }
  };

  const handleChangeRole = async (member, newRole) => {
    if (!canManage) return;
    if (member.displayRole === 'OWNER') {
      alert("You can't change the OWNER's role.");
      return;
    }
    setBusyId(member.id);
    try {
      await updateStaffRole({
        staffDocId: member.id,
        newRole,
        actorStaffId: currentStaff?.id || null,
      });
      await load();
    } catch (err) {
      alert(`Failed: ${err.message}`);
    } finally {
      setBusyId(null);
    }
  };

  const handleToggleStatus = async (member) => {
    if (!canManage) return;
    if (member.displayRole === 'OWNER') {
      alert("You can't suspend the OWNER.");
      return;
    }
    const nextStatus =
      member.displayStatus === 'active' ? 'suspended' : 'active';
    const verb = nextStatus === 'active' ? 'Reactivate' : 'Suspend';
    if (!window.confirm(`${verb} ${member.fullName}?`)) return;

    setBusyId(member.id);
    try {
      await setStaffStatus({
        staffDocId: member.id,
        status: nextStatus,
        actorStaffId: currentStaff?.id || null,
      });
      await load();
    } catch (err) {
      alert(`Failed: ${err.message}`);
    } finally {
      setBusyId(null);
    }
  };

  const counts = {
    total: members.length,
    active: members.filter((m) => m.displayStatus === 'active').length,
    invited: members.filter((m) => m.displayStatus === 'invited').length,
    suspended: members.filter((m) => m.displayStatus === 'suspended').length,
  };

  return (
    <div className="mf-page">
      <header className="mf-page-header mf-page-header-with-actions">
        <div>
          <h1>Staff</h1>
          <p>
            Manage who has access to your Konfa manufacturer portal.
            Invite staff with their email and a temporary password — they can
            sign in immediately.
          </p>
        </div>
        {canManage && (
          <div className="mf-header-actions">
            <button
              type="button"
              className="mf-btn mf-btn-primary"
              onClick={() => {
                setShowInvite((v) => !v);
                setError('');
                setSuccessMsg('');
              }}
            >
              {showInvite ? 'Cancel' : '+ Invite Staff'}
            </button>
          </div>
        )}
      </header>

      {/* Stat strip */}
      <div className="mf-stat-grid">
        <StatCard label="Total Staff" value={counts.total} accent="teal" />
        <StatCard label="Active" value={counts.active} accent="green" />
        <StatCard label="Invited" value={counts.invited} accent="amber" />
        <StatCard
          label="Suspended"
          value={counts.suspended}
          accent={counts.suspended > 0 ? 'red' : 'green'}
        />
      </div>

      {successMsg && (
        <div className="mf-success" role="status">
          {successMsg}
        </div>
      )}

      {/* Invite form */}
      {showInvite && canManage && (
        <form className="mf-form" onSubmit={handleInvite}>
          <div className="mf-form-grid">
            <div className="mf-field">
              <label>Full name *</label>
              <input
                type="text"
                value={inviteForm.fullName}
                onChange={(e) =>
                  setInviteForm({ ...inviteForm, fullName: e.target.value })
                }
                placeholder="e.g. Jane Doe"
                required
              />
            </div>

            <div className="mf-field">
              <label>Email *</label>
              <input
                type="email"
                value={inviteForm.email}
                onChange={(e) =>
                  setInviteForm({ ...inviteForm, email: e.target.value })
                }
                placeholder="name@company.com"
                required
              />
            </div>

            <div className="mf-field">
              <label>Phone (optional)</label>
              <input
                type="tel"
                value={inviteForm.phone}
                onChange={(e) =>
                  setInviteForm({ ...inviteForm, phone: e.target.value })
                }
                placeholder="+234 801 234 5678"
              />
            </div>

            <div className="mf-field">
              <label>Role *</label>
              <select
                value={inviteForm.role}
                onChange={(e) =>
                  setInviteForm({ ...inviteForm, role: e.target.value })
                }
                required
              >
                {ASSIGNABLE_ROLES.map((r) => (
                  <option key={r} value={r}>
                    {ROLE_LABELS[r] || r}
                  </option>
                ))}
              </select>
            </div>

            {/* 🆕 PASSWORD COLUMN */}
            <div className="mf-field mf-field-full">
              <label>
                Temporary password *{' '}
                <span className="label-hint">
                  They can change it after logging in
                </span>
              </label>
              <div className="mf-password-row">
                <input
                  type={inviteForm.showPassword ? 'text' : 'password'}
                  value={inviteForm.password}
                  onChange={(e) =>
                    setInviteForm({ ...inviteForm, password: e.target.value })
                  }
                  placeholder="At least 6 characters"
                  minLength={6}
                  autoComplete="new-password"
                  required
                />
                <button
                  type="button"
                  className="mf-password-toggle"
                  onClick={() =>
                    setInviteForm((f) => ({
                      ...f,
                      showPassword: !f.showPassword,
                    }))
                  }
                  title={inviteForm.showPassword ? 'Hide' : 'Show'}
                >
                  {inviteForm.showPassword ? '🙈' : '👁'}
                </button>
                <button
                  type="button"
                  className="mf-password-suggest"
                  onClick={() =>
                    setInviteForm((f) => ({
                      ...f,
                      password: generatePassword(),
                      confirmPassword: '',
                      showPassword: true,
                    }))
                  }
                  title="Generate a strong password"
                >
                  ↻ Suggest
                </button>
              </div>
            </div>

            <div className="mf-field mf-field-full">
              <label>Confirm password *</label>
              <input
                type={inviteForm.showPassword ? 'text' : 'password'}
                value={inviteForm.confirmPassword}
                onChange={(e) =>
                  setInviteForm({
                    ...inviteForm,
                    confirmPassword: e.target.value,
                  })
                }
                placeholder="Re-enter the password"
                minLength={6}
                autoComplete="new-password"
                required
              />
            </div>

            <div className="mf-field mf-field-full">
              <div className="mf-hint-box">
                <strong>
                  {ROLE_LABELS[inviteForm.role] || inviteForm.role}
                </strong>
                <p>
                  {ROLE_DESCRIPTIONS[inviteForm.role] ||
                    'Access level for this role.'}
                </p>
              </div>
            </div>
          </div>

          {error && <div className="mf-error">{error}</div>}

          <button
            type="submit"
            className="mf-btn mf-btn-primary"
            disabled={inviting}
          >
            {inviting ? 'Creating staff account…' : 'Create Staff Account'}
          </button>
        </form>
      )}

      {error && !showInvite && <div className="mf-error">{error}</div>}

      {loading ? (
        <div className="mf-loading">Loading staff…</div>
      ) : members.length === 0 ? (
        <div className="mf-empty">
          <p>No staff yet. Invite your first team member to get started.</p>
        </div>
      ) : (
        <div className="mf-table">
          <div className="mf-table-head mf-table-staff">
            <span>Name</span>
            <span>Contact</span>
            <span>Role</span>
            <span>Status</span>
            <span></span>
          </div>
          {members.map((m) => (
            <div key={m.id} className="mf-table-row mf-table-staff">
              <span className="mf-cell-strong">
                {m.fullName}
                {m.id === currentStaff?.id && (
                  <span className="mf-badge-pill mf-badge-you">you</span>
                )}
              </span>
              <span className="mf-cell-mono">{m.displayEmail}</span>
              <span>
                {canManage && m.displayRole !== 'OWNER' ? (
                  <select
                    className="mf-role-select"
                    value={m.displayRole}
                    onChange={(e) => handleChangeRole(m, e.target.value)}
                    disabled={busyId === m.id}
                  >
                    {ASSIGNABLE_ROLES.map((r) => (
                      <option key={r} value={r}>
                        {ROLE_LABELS[r] || r}
                      </option>
                    ))}
                  </select>
                ) : (
                  <span className="mf-pill mf-pill-role">
                    {ROLE_LABELS[m.displayRole] || m.displayRole}
                  </span>
                )}
              </span>
              <span className={`mf-pill mf-pill-${m.displayStatus}`}>
                {m.displayStatus}
              </span>
              <span>
                {canManage &&
                  m.displayRole !== 'OWNER' &&
                  m.id !== currentStaff?.id && (
                    <button
                      type="button"
                      className={`mf-btn mf-btn-small ${
                        m.displayStatus === 'active'
                          ? 'mf-btn-danger'
                          : 'mf-btn-secondary'
                      }`}
                      onClick={() => handleToggleStatus(m)}
                      disabled={busyId === m.id}
                    >
                      {busyId === m.id
                        ? '…'
                        : m.displayStatus === 'active'
                        ? 'Suspend'
                        : 'Reactivate'}
                    </button>
                  )}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const StatCard = ({ label, value, accent }) => (
  <div className={`mf-stat-card mf-stat-${accent}`}>
    <span className="mf-stat-label">{label}</span>
    <span className="mf-stat-value">{value}</span>
  </div>
);

export default ManufacturerStaff;