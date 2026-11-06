// src/consumer/ConsumerProfile.jsx
import { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import {
  updateConsumerProfile,
  changeConsumerPassword,
  ConsumerAuthError,
} from './consumerAuth';
import './ConsumerPortal.css';

const ConsumerProfile = () => {
  const { consumer } = useOutletContext();

  const [profileForm, setProfileForm] = useState({
    fullName: consumer.fullName || '',
    phoneNumber: consumer.phoneNumber || '',
  });
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileMsg, setProfileMsg] = useState({ type: '', text: '' });

  const [pwdForm, setPwdForm] = useState({
    current: '',
    newPwd: '',
    confirm: '',
  });
  const [pwdSaving, setPwdSaving] = useState(false);
  const [pwdMsg, setPwdMsg] = useState({ type: '', text: '' });

  const handleProfileSave = async (e) => {
    e.preventDefault();
    setProfileSaving(true);
    setProfileMsg({ type: '', text: '' });
    try {
      await updateConsumerProfile({
        fullName: profileForm.fullName,
        phoneNumber: profileForm.phoneNumber,
      });
      setProfileMsg({
        type: 'success',
        text: 'Profile updated successfully.',
      });
    } catch (err) {
      setProfileMsg({
        type: 'error',
        text: err.message || 'Could not save profile.',
      });
    } finally {
      setProfileSaving(false);
    }
  };

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    setPwdMsg({ type: '', text: '' });

    if (pwdForm.newPwd.length < 6) {
      return setPwdMsg({
        type: 'error',
        text: 'New password must be at least 6 characters.',
      });
    }
    if (pwdForm.newPwd !== pwdForm.confirm) {
      return setPwdMsg({ type: 'error', text: "Passwords don't match." });
    }

    setPwdSaving(true);
    try {
      await changeConsumerPassword(pwdForm.current, pwdForm.newPwd);
      setPwdMsg({
        type: 'success',
        text: 'Password changed successfully.',
      });
      setPwdForm({ current: '', newPwd: '', confirm: '' });
    } catch (err) {
      const message =
        err instanceof ConsumerAuthError
          ? err.message
          : 'Could not change password.';
      setPwdMsg({ type: 'error', text: message });
    } finally {
      setPwdSaving(false);
    }
  };

  return (
    <div className="cp-page">
      <header className="cp-page-header">
        <div>
          <h1>Profile</h1>
          <p>Manage your personal information and account security.</p>
        </div>
      </header>

      <section className="cp-card">
        <div className="cp-card-header">
          <div>
            <h2>Personal information</h2>
            <p>This is how you'll appear in the app.</p>
          </div>
        </div>

        <form onSubmit={handleProfileSave} className="cp-form">
          <label className="cp-field">
            <span>Full name</span>
            <input
              type="text"
              value={profileForm.fullName}
              onChange={(e) =>
                setProfileForm({ ...profileForm, fullName: e.target.value })
              }
              placeholder="Your full name"
            />
          </label>

          <label className="cp-field">
            <span>Email (cannot be changed)</span>
            <input
              type="email"
              value={consumer.email || ''}
              disabled
              className="cp-input-disabled"
            />
          </label>

          <label className="cp-field">
            <span>Phone number</span>
            <input
              type="tel"
              value={profileForm.phoneNumber}
              onChange={(e) =>
                setProfileForm({
                  ...profileForm,
                  phoneNumber: e.target.value,
                })
              }
              placeholder="+234 801 234 5678"
            />
          </label>

          {profileMsg.text && (
            <div className={`cp-notice cp-notice-${profileMsg.type}`}>
              {profileMsg.text}
            </div>
          )}

          <button
            type="submit"
            className="cp-btn cp-btn-primary"
            disabled={profileSaving}
          >
            {profileSaving ? 'Saving…' : 'Save changes'}
          </button>
        </form>
      </section>

      <section className="cp-card">
        <div className="cp-card-header">
          <div>
            <h2>Change password</h2>
            <p>Update your account password.</p>
          </div>
        </div>

        <form onSubmit={handlePasswordChange} className="cp-form">
          <label className="cp-field">
            <span>Current password</span>
            <input
              type="password"
              value={pwdForm.current}
              onChange={(e) =>
                setPwdForm({ ...pwdForm, current: e.target.value })
              }
              placeholder="Enter your current password"
              autoComplete="current-password"
              required
            />
          </label>

          <label className="cp-field">
            <span>New password</span>
            <input
              type="password"
              value={pwdForm.newPwd}
              onChange={(e) =>
                setPwdForm({ ...pwdForm, newPwd: e.target.value })
              }
              placeholder="At least 6 characters"
              autoComplete="new-password"
              required
            />
          </label>

          <label className="cp-field">
            <span>Confirm new password</span>
            <input
              type="password"
              value={pwdForm.confirm}
              onChange={(e) =>
                setPwdForm({ ...pwdForm, confirm: e.target.value })
              }
              placeholder="Re-enter new password"
              autoComplete="new-password"
              required
            />
          </label>

          {pwdMsg.text && (
            <div className={`cp-notice cp-notice-${pwdMsg.type}`}>
              {pwdMsg.text}
            </div>
          )}

          <button
            type="submit"
            className="cp-btn cp-btn-primary"
            disabled={pwdSaving}
          >
            {pwdSaving ? 'Changing…' : 'Change password'}
          </button>
        </form>
      </section>
    </div>
  );
};

export default ConsumerProfile;