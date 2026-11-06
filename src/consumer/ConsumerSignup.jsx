// src/consumer/ConsumerSignup.jsx
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { signUpConsumer, ConsumerAuthError } from './consumerAuth';
import Header from '../components/Header';
import './ConsumerPortal.css';

const ConsumerSignup = () => {
  const navigate = useNavigate();

  const [form, setForm] = useState({
    fullName: '',
    email: '',
    phoneNumber: '',
    password: '',
    confirmPassword: '',
    terms: false,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const update = (key) => (e) => {
    const value = key === 'terms' ? e.target.checked : e.target.value;
    setForm((f) => ({ ...f, [key]: value }));
  };

  const validate = () => {
    if (form.fullName.trim().length < 2) return 'Please enter your full name.';
    if (!/^\S+@\S+\.\S+$/.test(form.email)) return 'Please enter a valid email.';
    if (form.password.length < 6) return 'Password must be at least 6 characters.';
    if (form.password !== form.confirmPassword) return "Passwords don't match.";
    if (!form.terms) return 'Please accept the Terms and Privacy Policy.';
    return null;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const v = validate();
    if (v) return setError(v);

    setLoading(true);
    setError('');
    try {
      await signUpConsumer({
        email: form.email,
        password: form.password,
        fullName: form.fullName,
        phoneNumber: form.phoneNumber,
      });
      navigate('/consumer/home', { replace: true });
    } catch (err) {
      const message = err instanceof ConsumerAuthError
        ? err.message
        : 'Could not create your account. Please try again.';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="cp-auth-shell">
      {/* ============================================================
          UNIFIED HEADER
          ============================================================ */}
      <Header sticky />

      {/* ============================================================
          AUTH CONTENT
          ============================================================ */}
      <main className="cp-auth-stage">
        <div className="cp-auth-card">
          <div className="cp-auth-badge">Create account</div>
          <h1 className="cp-auth-title">Join Varyfai</h1>
          <p className="cp-auth-subtitle">
            Track every product you scan, save favourites, and get alerts
            about suspicious codes.
          </p>

          <form className="cp-auth-form" onSubmit={handleSubmit}>
            <div className="cp-auth-field">
              <label htmlFor="cp-name">Full name *</label>
              <input
                id="cp-name"
                type="text"
                value={form.fullName}
                onChange={update('fullName')}
                placeholder="e.g. Ada Obi"
                autoComplete="name"
                required
                disabled={loading}
                className="cp-auth-plain-input"
              />
            </div>

            <div className="cp-auth-field">
              <label htmlFor="cp-signup-email">Email *</label>
              <input
                id="cp-signup-email"
                type="email"
                value={form.email}
                onChange={update('email')}
                placeholder="you@example.com"
                autoComplete="email"
                required
                disabled={loading}
                className="cp-auth-plain-input"
              />
            </div>

            <div className="cp-auth-field">
              <label htmlFor="cp-phone">Phone number (optional)</label>
              <input
                id="cp-phone"
                type="tel"
                value={form.phoneNumber}
                onChange={update('phoneNumber')}
                placeholder="+234 801 234 5678"
                autoComplete="tel"
                disabled={loading}
                className="cp-auth-plain-input"
              />
            </div>

            <div className="cp-auth-field">
              <label htmlFor="cp-signup-password">Password *</label>
              <input
                id="cp-signup-password"
                type="password"
                value={form.password}
                onChange={update('password')}
                placeholder="At least 6 characters"
                autoComplete="new-password"
                required
                disabled={loading}
                className="cp-auth-plain-input"
              />
            </div>

            <div className="cp-auth-field">
              <label htmlFor="cp-confirm">Confirm password *</label>
              <input
                id="cp-confirm"
                type="password"
                value={form.confirmPassword}
                onChange={update('confirmPassword')}
                placeholder="Re-enter password"
                autoComplete="new-password"
                required
                disabled={loading}
                className="cp-auth-plain-input"
              />
            </div>

            <label className="cp-auth-checkbox">
              <input
                type="checkbox"
                checked={form.terms}
                onChange={update('terms')}
                disabled={loading}
              />
              <span>
                I agree to the <a href="#terms">Terms</a> and{' '}
                <a href="#privacy">Privacy Policy</a>.
              </span>
            </label>

            {error && (
              <div className="cp-auth-error" role="alert">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M12 8v5M12 16.5h.01" strokeLinecap="round" />
                </svg>
                <div className="cp-auth-error-body">
                  <strong>Could not create account</strong>
                  <span>{error}</span>
                </div>
              </div>
            )}

            <button
              type="submit"
              className="cp-auth-submit"
              disabled={loading}
            >
              {loading ? (
                <>
                  <span className="cp-auth-spinner" /> Creating account…
                </>
              ) : (
                <>Create account</>
              )}
            </button>
          </form>

          <p className="cp-auth-footer-note">
            Already have an account?{' '}
            <Link to="/consumer/login">Sign in</Link>
          </p>
        </div>
      </main>
    </div>
  );
};

export default ConsumerSignup;