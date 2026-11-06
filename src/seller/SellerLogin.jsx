// src/seller/SellerLogin.jsx
import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  loginSeller,
  SellerLoginError,
  resetSellerPassword,
} from './sellerAuth';
import Header from '../components/Header';
import './SellerPortal.css';

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

const IconArrowLeft = (p) => (
  <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
    <path d="M19 12H5M11 6l-6 6 6 6" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const IconAlert = (p) => (
  <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="12" cy="12" r="10" />
    <path d="M12 8v5M12 16.5h.01" strokeLinecap="round" />
  </svg>
);

const IconClock = (p) => (
  <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="12" cy="12" r="10" />
    <path d="M12 6v6l4 2" strokeLinecap="round" />
  </svg>
);

const IconCheck = (p) => (
  <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
    <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const SellerLogin = () => {
  const [view, setView] = useState('login');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [errorKind, setErrorKind] = useState('');

  const [resetEmail, setResetEmail] = useState('');
  const [resetLoading, setResetLoading] = useState(false);
  const [resetError, setResetError] = useState('');
  const [resetSent, setResetSent] = useState(false);

  const navigate = useNavigate();
  const location = useLocation();
  const redirectTo = location.state?.from || '/seller/home';

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setErrorKind('');
    setLoading(true);

    try {
      await loginSeller(email, password);
      navigate(redirectTo, { replace: true });
    } catch (err) {
      console.error('Login failed:', err);

      if (err instanceof SellerLoginError) {
        setError(err.message);
        setErrorKind(err.code);
      } else {
        const map = {
          'auth/invalid-credential': 'Incorrect email or password.',
          'auth/wrong-password': 'Incorrect email or password.',
          'auth/user-not-found': 'No account found with that email.',
          'auth/too-many-requests': 'Too many attempts. Please wait a moment.',
          'auth/invalid-email': 'Please enter a valid email address.',
        };
        setError(map[err.code] || 'Login failed. Please try again.');
        setErrorKind('');
      }
    } finally {
      setLoading(false);
    }
  };

  const openForgotView = () => {
    setResetEmail(email || '');
    setResetError('');
    setResetSent(false);
    setView('forgot');
  };

  const backToLogin = () => {
    setResetError('');
    setResetSent(false);
    setView('login');
  };

  const handleSendReset = async (e) => {
    e.preventDefault();
    setResetError('');
    setResetLoading(true);

    try {
      await resetSellerPassword(resetEmail.trim());
      setResetSent(true);
    } catch (err) {
      console.error('Password reset failed:', err);

      if (err?.code === 'auth/user-not-found') {
        setResetSent(true);
        return;
      }

      if (err instanceof SellerLoginError) {
        setResetError(err.message);
      } else {
        const map = {
          'auth/invalid-email': 'Please enter a valid email address.',
          'auth/too-many-requests':
            'Too many attempts. Please wait a moment and try again.',
          'auth/network-request-failed':
            'Network error. Please check your connection and try again.',
        };
        setResetError(
          map[err?.code] ||
            'We could not send the reset email. Please check your connection and try again.'
        );
      }
    } finally {
      setResetLoading(false);
    }
  };

  const isPending = errorKind === 'seller/pending';
  const isRejected = errorKind === 'seller/rejected';
  const isSuspended = errorKind === 'seller/suspended';
  const isStateError = isPending || isRejected || isSuspended;

  return (
    <div className="seller-auth-shell">
      {/* ============================================================
          UNIFIED HEADER
          ============================================================ */}
      <Header sticky />

      {/* ============================================================
          AUTH CONTENT
          ============================================================ */}
      <main className="seller-auth-stage">
        <div className="seller-auth-card">
          <div className="seller-auth-badge">Seller Portal</div>

          {/* ---------- VIEW: LOGIN ---------- */}
          {view === 'login' && (
            <>
              <h1 className="seller-auth-title">Welcome back</h1>
              <p className="seller-auth-subtitle">
                Log in to scan, receive, and transfer stock across the supply chain.
              </p>

              <form className="seller-auth-form" onSubmit={handleSubmit}>
                <div className="seller-auth-field">
                  <label htmlFor="seller-email">Email</label>
                  <div className="seller-auth-input-wrap">
                    <span className="seller-auth-input-icon">
                      <IconMail width="18" height="18" />
                    </span>
                    <input
                      id="seller-email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@company.com"
                      autoComplete="username"
                      autoFocus
                      required
                      disabled={loading}
                    />
                  </div>
                </div>

                <div className="seller-auth-field">
                  <div className="seller-auth-field-head">
                    <label htmlFor="seller-password">Password</label>
                    <button
                      type="button"
                      className="seller-auth-inline-link"
                      onClick={openForgotView}
                      disabled={loading}
                    >
                      Forgot password?
                    </button>
                  </div>
                  <div className="seller-auth-input-wrap">
                    <span className="seller-auth-input-icon">
                      <IconLock width="18" height="18" />
                    </span>
                    <input
                      id="seller-password"
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter your password"
                      autoComplete="current-password"
                      required
                      disabled={loading}
                    />
                    <button
                      type="button"
                      className="seller-auth-eye"
                      onClick={() => setShowPassword((v) => !v)}
                      disabled={loading}
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

                <div className="seller-auth-row">
                  <label className="seller-auth-checkbox">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                    />
                    <span>Keep me signed in</span>
                  </label>
                </div>

                {error && (
                  <div
                    className={`seller-auth-error ${
                      isPending
                        ? 'seller-auth-error-pending'
                        : isRejected
                        ? 'seller-auth-error-rejected'
                        : isSuspended
                        ? 'seller-auth-error-suspended'
                        : ''
                    }`}
                    role="alert"
                  >
                    {isPending && <IconClock width="18" height="18" />}
                    {!isPending && <IconAlert width="18" height="18" />}
                    <div className="seller-auth-error-body">
                      <strong>
                        {isPending && 'Application under review'}
                        {isRejected && 'Application not approved'}
                        {isSuspended && 'Account suspended'}
                        {!isStateError && 'Sign-in failed'}
                      </strong>
                      <span>{error}</span>
                    </div>
                  </div>
                )}

                <button
                  type="submit"
                  className="seller-auth-submit"
                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <span className="seller-auth-spinner" /> Signing in…
                    </>
                  ) : (
                    <>
                      Sign in to Portal
                      <IconArrowRight width="18" height="18" />
                    </>
                  )}
                </button>
              </form>

              <div className="seller-auth-divider">
                <span>New to Varyfai?</span>
              </div>

              <button
                type="button"
                className="seller-auth-secondary"
                onClick={() => navigate('/seller/signup')}
              >
                Create a seller account
              </button>

              <p className="seller-auth-footer">
                By signing in, you agree to Varyfai's{' '}
                <a href="#terms">Terms</a> and <a href="#privacy">Privacy Policy</a>.
              </p>
            </>
          )}

          {/* ---------- VIEW: FORGOT PASSWORD ---------- */}
          {view === 'forgot' && (
            <>
              <button
                type="button"
                className="seller-auth-back-link"
                onClick={backToLogin}
              >
                <IconArrowLeft width="16" height="16" />
                Back to sign in
              </button>

              {!resetSent ? (
                <>
                  <div className="seller-auth-badge">Password reset</div>
                  <h1 className="seller-auth-title">Forgot password?</h1>
                  <p className="seller-auth-subtitle">
                    Enter the email you signed up with, and we'll send you a
                    link to reset your password.
                  </p>

                  <form className="seller-auth-form" onSubmit={handleSendReset}>
                    <div className="seller-auth-field">
                      <label htmlFor="reset-email">Email</label>
                      <div className="seller-auth-input-wrap">
                        <span className="seller-auth-input-icon">
                          <IconMail width="18" height="18" />
                        </span>
                        <input
                          id="reset-email"
                          type="email"
                          value={resetEmail}
                          onChange={(e) => setResetEmail(e.target.value)}
                          placeholder="you@company.com"
                          autoComplete="email"
                          required
                          autoFocus
                          disabled={resetLoading}
                        />
                      </div>
                    </div>

                    {resetError && (
                      <div className="seller-auth-error" role="alert">
                        <IconAlert width="18" height="18" />
                        <div className="seller-auth-error-body">
                          <strong>Could not send reset email</strong>
                          <span>{resetError}</span>
                        </div>
                      </div>
                    )}

                    <button
                      type="submit"
                      className="seller-auth-submit"
                      disabled={resetLoading}
                    >
                      {resetLoading ? (
                        <>
                          <span className="seller-auth-spinner" /> Sending…
                        </>
                      ) : (
                        <>
                          Send reset link
                          <IconArrowRight width="18" height="18" />
                        </>
                      )}
                    </button>
                  </form>

                  <p className="seller-auth-footer">
                    If an account exists for{' '}
                    <strong>{resetEmail || 'this email'}</strong>, you'll
                    receive a password reset link within a few minutes. Check
                    your spam folder if you don't see it.
                  </p>
                </>
              ) : (
                <>
                  <div className="seller-auth-success-icon">
                    <IconCheck width="32" height="32" />
                  </div>
                  <h1 className="seller-auth-title">Check your inbox</h1>
                  <p className="seller-auth-subtitle">
                    We've sent a password reset link to{' '}
                    <strong>{resetEmail}</strong>.
                  </p>

                  <div className="seller-auth-hint-box">
                    <strong>What to do next</strong>
                    <ol>
                      <li>Open the email from Varyfai.</li>
                      <li>Tap the "Reset password" link inside.</li>
                      <li>Enter a new password on the page that opens.</li>
                      <li>Come back here and sign in with it.</li>
                    </ol>
                    <p className="seller-auth-hint-note">
                      The link expires after one hour. If it doesn't work,
                      send a new one.
                    </p>
                  </div>

                  <button
                    type="button"
                    className="seller-auth-secondary"
                    onClick={backToLogin}
                  >
                    Back to sign in
                  </button>

                  <button
                    type="button"
                    className="seller-auth-resend"
                    onClick={() => {
                      setResetSent(false);
                      setResetError('');
                    }}
                  >
                    Didn't get the email? Send again
                  </button>
                </>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
};

export default SellerLogin;