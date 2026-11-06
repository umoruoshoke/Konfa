// src/brand/BrandLogin.jsx
import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  signInBrand,
  resetBrandPassword,
  watchBrandAuth,
  getCurrentBrandProfile,
  BrandAuthError,
} from './brandAuth';
import Header from '../components/Header';
import './BrandPortal.css';

/* ============================================================
   ICONS
   ============================================================ */
const IconMail = (p) => (
  <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
    <rect x="3" y="5" width="18" height="14" rx="2.5" />
    <path d="M3 7l9 6 9-6" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const IconLock = (p) => (
  <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
    <rect x="4" y="10" width="16" height="11" rx="2.5" />
    <path d="M8 10V7a4 4 0 018 0v3" strokeLinecap="round" />
    <circle cx="12" cy="15.5" r="1.4" fill="currentColor" stroke="none" />
  </svg>
);

const IconEye = (p) => (
  <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
    <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" strokeLinejoin="round" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

const IconEyeOff = (p) => (
  <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
    <path d="M2 12s3.5-7 10-7c2 0 3.7.6 5.1 1.4M22 12s-3.5 7-10 7c-2 0-3.7-.6-5.1-1.4" strokeLinejoin="round" />
    <path d="M3 3l18 18" strokeLinecap="round" />
  </svg>
);

const IconArrowRight = (p) => (
  <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
    <path d="M5 12h14M13 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const IconAlert = (p) => (
  <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="12" cy="12" r="10" />
    <path d="M12 8v5M12 16.5h.01" strokeLinecap="round" />
  </svg>
);

const IconCheck = (p) => (
  <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
    <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const BrandLogin = () => {
  const navigate = useNavigate();

  const [form, setForm] = useState({ email: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');

  // Already signed in → go to verification
  useEffect(() => {
    let cancelled = false;
    const unsubscribe = watchBrandAuth(async (user) => {
      if (cancelled || !user) return;
      const profile = await getCurrentBrandProfile();
      if (cancelled) return;
      if (profile?.status === 'active') {
        navigate('/brand/verification', { replace: true });
      }
    });
    return () => {
      cancelled = true;
      if (typeof unsubscribe === 'function') unsubscribe();
    };
  }, [navigate]);

  const update = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setInfo('');
    setBusy(true);
    try {
      await signInBrand(form.email, form.password);
      navigate('/brand/verification', { replace: true });
    } catch (err) {
      if (err instanceof BrandAuthError) setError(err.message);
      else setError(err.message || 'Sign in failed.');
    } finally {
      setBusy(false);
    }
  };

  const handleReset = async () => {
    setError('');
    setInfo('');
    if (!form.email) {
      setError('Enter your email first, then click Forgot password.');
      return;
    }
    setBusy(true);
    try {
      await resetBrandPassword(form.email);
      setInfo('If an account exists for that email, a reset link has been sent.');
    } catch (err) {
      setError(err.message || 'Could not send reset email.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="brand-auth-shell">
      {/* ============================================================
          UNIFIED HEADER
          ============================================================ */}
      <Header sticky />

      {/* ============================================================
          AUTH CONTENT
          ============================================================ */}
      <main className="brand-auth-stage">
        <div className="brand-auth-card-clean">
          <div className="brand-auth-badge">Brand Portal</div>
          <h1 className="brand-auth-title">Brand sign in</h1>
          <p className="brand-auth-sub">
            Sign in to your brand verification workspace.
          </p>

          <form className="brand-auth-form" onSubmit={handleSubmit}>
            <div className="brand-field">
              <label htmlFor="bn-email">Email</label>
              <div className="brand-input-wrap">
                <span className="brand-input-icon">
                  <IconMail width="18" height="18" />
                </span>
                <input
                  id="bn-email"
                  type="email"
                  autoComplete="email"
                  placeholder="you@example.com"
                  value={form.email}
                  onChange={(e) => update('email', e.target.value)}
                  disabled={busy}
                  required
                />
              </div>
            </div>

            <div className="brand-field">
              <label htmlFor="bn-pass">Password</label>
              <div className="brand-input-wrap">
                <span className="brand-input-icon">
                  <IconLock width="18" height="18" />
                </span>
                <input
                  id="bn-pass"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder="Your password"
                  value={form.password}
                  onChange={(e) => update('password', e.target.value)}
                  disabled={busy}
                  required
                />
                <button
                  type="button"
                  className="brand-auth-eye"
                  onClick={() => setShowPassword((v) => !v)}
                  disabled={busy}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  aria-pressed={showPassword}
                >
                  {showPassword ? (
                    <IconEyeOff width="18" height="18" />
                  ) : (
                    <IconEye width="18" height="18" />
                  )}
                </button>
              </div>
            </div>

            {error && (
              <div className="brand-auth-error" role="alert">
                <IconAlert width="18" height="18" />
                <div className="brand-auth-error-body">
                  <strong>Sign-in failed</strong>
                  <span>{error}</span>
                </div>
              </div>
            )}

            {info && (
              <div className="brand-auth-info" role="status">
                <IconCheck width="18" height="18" />
                <div className="brand-auth-error-body">
                  <strong>Check your email</strong>
                  <span>{info}</span>
                </div>
              </div>
            )}

            <button
              type="submit"
              className="brand-auth-submit"
              disabled={busy}
            >
              {busy ? (
                <>
                  <span className="brand-auth-spinner" /> Signing in…
                </>
              ) : (
                <>
                  Sign in
                  <IconArrowRight width="18" height="18" />
                </>
              )}
            </button>

            <button
              type="button"
              className="brand-auth-inline-link"
              onClick={handleReset}
              disabled={busy}
            >
              Forgot password?
            </button>
          </form>

          <div className="brand-auth-divider">
            <span>New to Varyfai?</span>
          </div>

          <Link
            to="/brand/signup"
            className="brand-auth-secondary"
          >
            Get your brand verified
          </Link>

          <p className="brand-auth-foot">
            By signing in, you agree to Varyfai's{' '}
            <a href="#terms">Terms</a> and <a href="#privacy">Privacy Policy</a>.
          </p>
        </div>
      </main>
    </div>
  );
};

export default BrandLogin;