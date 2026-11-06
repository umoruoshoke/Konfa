// src/admin/AdminUsers.jsx
import { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import {
  fetchAllAdmins,
  inviteAdmin,
  deactivateAdmin,
  setAdminStatus,
} from './adminAuth';
import './AdminPortal.css';

const ROLE_LABELS = {
  SUPER_ADMIN: 'Super Admin',
  REVIEWER: 'Reviewer',
  AUDITOR: 'Auditor',
  SUPPORT: 'Support',
};

const ROLE_OPTIONS = [
  { value: 'REVIEWER', label: 'Reviewer — approve/reject applications' },
  { value: 'AUDITOR', label: 'Auditor — read-only access to logs' },
  { value: 'SUPPORT', label: 'Support — read-only access to users' },
  { value: 'SUPER_ADMIN', label: 'Super Admin — full access' },
];

const AdminUsers = () => {
  const { admin } = useOutletContext();
  const [admins, setAdmins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(null);
  const [error, setError] = useState('');
  const [showInvite, setShowInvite] = useState(false);
  const [inviteForm, setInviteForm] = useState({
    fullName: '',
    email: '',
    role: 'REVIEWER',
  });
  const [inviting, setInviting] = useState(false);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const list = await fetchAllAdmins();
      list.sort((a, b) => {
        const at = a.createdAt?.toDate?.()?.getTime?.() || 0;
        const bt = b.createdAt?.toDate?.()?.getTime?.() || 0;
        return bt - at;
      });
      setAdmins(list);
    } catch (err) {
      console.error(err);
      setError(`Could not load admins: ${err?.code || ''}`.trim());
      setAdmins([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleInvite = async (e) => {
    e.preventDefault();
    if (!inviteForm.fullName.trim() || !inviteForm.email.trim()) return;
    setInviting(true);
    try {
      await inviteAdmin({
        email: inviteForm.email.trim().toLowerCase(),
        fullName: inviteForm.fullName.trim(),
        role: inviteForm.role,
        permissions: permissionsForRole(inviteForm.role),
        createdByAdminId: admin.id,
        createdByAdminName: admin.fullName,
      });
      setInviteForm({ fullName: '', email: '', role: 'REVIEWER' });
      setShowInvite(false);
      await load();
    } catch (err) {
      console.error(err);
      alert(err.message || 'Invite failed.');
    } finally {
      setInviting(false);
    }
  };

  const handleDeactivate = async (target) => {
    if (target.id === admin.id) {
      alert("You can't deactivate your own account.");
      return;
    }
    if (!window.confirm(`Deactivate ${target.fullName || target.email}?`)) return;
    setActing(target.id);
    try {
      await deactivateAdmin({
        adminId: target.id,
        actorId: admin.id,
        actorName: admin.fullName,
      });
      await load();
    } catch (err) {
      console.error(err);
      alert(err.message || 'Deactivate failed.');
    } finally {
      setActing(null);
    }
  };

  const handleReactivate = async (target) => {
    if (!window.confirm(`Reactivate ${target.fullName || target.email}?`)) return;
    setActing(target.id);
    try {
      await setAdminStatus(target.id, 'active', admin.id, admin.fullName);
      await load();
    } catch (err) {
      console.error(err);
      alert(err.message || 'Reactivate failed.');
    } finally {
      setActing(null);
    }
  };

  const counts = {
    total: admins.length,
    active: admins.filter((a) => a.status === 'active').length,
    invited: admins.filter((a) => a.status === 'invited').length,
    disabled: admins.filter((a) => a.status === 'disabled').length,
  };

  return (
    <div className="admin-page">
      <header className="admin-page-header admin-page-header-with-actions">
        <div>
          <h1>Admin Users</h1>
          <p>Manage who has access to the admin console.</p>
        </div>
        <div className="admin-header-actions">
          <button
            type="button"
            className="admin-btn admin-btn-primary"
            onClick={() => setShowInvite((v) => !v)}
          >
            {showInvite ? 'Cancel' : '+ Invite Admin'}
          </button>
        </div>
      </header>

      <div className="admin-stat-grid">
        <div className="admin-stat-card admin-stat-teal">
          <span className="admin-stat-label">Active</span>
          <span className="admin-stat-value">{counts.active}</span>
          <span className="admin-stat-hint">Can sign in</span>
        </div>
        <div className="admin-stat-card admin-stat-amber">
          <span className="admin-stat-label">Invited</span>
          <span className="admin-stat-value">{counts.invited}</span>
          <span className="admin-stat-hint">Awaiting first login</span>
        </div>
        <div className="admin-stat-card admin-stat-red">
          <span className="admin-stat-label">Disabled</span>
          <span className="admin-stat-value">{counts.disabled}</span>
          <span className="admin-stat-hint">No access</span>
        </div>
        <div className="admin-stat-card admin-stat-navy">
          <span className="admin-stat-label">Total</span>
          <span className="admin-stat-value">{counts.total}</span>
          <span className="admin-stat-hint">All admins</span>
        </div>
      </div>

      {showInvite && (
        <form className="admin-card" onSubmit={handleInvite}>
          <div className="admin-card-header">
            <div>
              <h2>Invite a new admin</h2>
              <p>They will receive access on their first sign-in with this email.</p>
            </div>
          </div>

          <div className="admin-form-grid">
            <label className="admin-form-field">
              <span>Full name</span>
              <input
                type="text"
                value={inviteForm.fullName}
                onChange={(e) =>
                  setInviteForm({ ...inviteForm, fullName: e.target.value })
                }
                placeholder="e.g. Jane Doe"
                required
              />
            </label>

            <label className="admin-form-field">
              <span>Email</span>
              <input
                type="email"
                value={inviteForm.email}
                onChange={(e) =>
                  setInviteForm({ ...inviteForm, email: e.target.value })
                }
                placeholder="name@konfa.example"
                required
              />
            </label>

            <label className="admin-form-field admin-form-field-full">
              <span>Role</span>
              <select
                value={inviteForm.role}
                onChange={(e) =>
                  setInviteForm({ ...inviteForm, role: e.target.value })
                }
              >
                {ROLE_OPTIONS.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="admin-reject-actions">
            <button
              type="button"
              className="admin-btn admin-btn-ghost"
              onClick={() => setShowInvite(false)}
              disabled={inviting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="admin-btn admin-btn-primary"
              disabled={inviting}
            >
              {inviting ? 'Sending invite…' : 'Send invite'}
            </button>
          </div>
        </form>
      )}

      {error && <div className="admin-error">{error}</div>}

      {loading ? (
        <div className="admin-card-table admin-table-skeleton">
          {[1, 2, 3].map((i) => (
            <div key={i} className="admin-skel-row" />
          ))}
        </div>
      ) : admins.length === 0 ? (
        <div className="admin-empty">
          <div className="admin-empty-icon">👥</div>
          <p>No admins yet.</p>
        </div>
      ) : (
        <div className="admin-card-table">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Status</th>
                <th className="admin-th-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {admins.map((a) => {
                const isYou = a.id === admin.id;
                return (
                  <tr key={a.id} className="admin-tr">
                    <td>
                      <div className="admin-td-company">
                        <span className="admin-link-strong">
                          {a.fullName || '—'}
                          {isYou && (
                            <span
                              className="admin-badge-pill admin-badge-mfr"
                              style={{ marginLeft: 8 }}
                            >
                              you
                            </span>
                          )}
                        </span>
                      </div>
                    </td>
                    <td>{a.email || '—'}</td>
                    <td>
                      <span className="admin-pill admin-pill-role">
                        {ROLE_LABELS[a.role] || a.role || '—'}
                      </span>
                    </td>
                    <td>
                      <span className={`admin-pill admin-pill-${a.status || 'unknown'}`}>
                        {a.status || 'unknown'}
                      </span>
                    </td>
                    <td className="admin-td-actions">
                      {isYou ? (
                        <span className="admin-subtext">—</span>
                      ) : a.status === 'disabled' ? (
                        <button
                          type="button"
                          className="admin-btn admin-btn-success admin-btn-sm"
                          onClick={() => handleReactivate(a)}
                          disabled={acting === a.id}
                        >
                          Reactivate
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="admin-btn admin-btn-danger admin-btn-sm"
                          onClick={() => handleDeactivate(a)}
                          disabled={acting === a.id}
                        >
                          Deactivate
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

const permissionsForRole = (role) => {
  switch (role) {
    case 'SUPER_ADMIN':
      return ['*'];
    case 'REVIEWER':
      return ['read:applications', 'write:applications'];
    case 'AUDITOR':
      return ['read:audit', 'read:applications'];
    case 'SUPPORT':
      return ['read:users'];
    default:
      return ['read'];
  }
};

export default AdminUsers;