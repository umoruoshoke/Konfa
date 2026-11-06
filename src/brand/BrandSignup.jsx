// src/brand/BrandSignup.jsx
import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { signUpBrand, signInBrand, isBrandNameAvailable, BrandAuthError } from './brandAuth';
import { normalizeBrandName } from './normalizeName';
import Header from '../components/Header';
import './BrandPortal.css';

/* ============================================================
   Small icons
   ============================================================ */
const IconArrow = () => (
  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5">
    <path d="M5 12h14M13 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const IconUser = () => (
  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.2">
    <circle cx="12" cy="8" r="4" />
    <path d="M4 21c0-4 4-7 8-7s8 3 8 7" strokeLinecap="round" />
  </svg>
);

const IconMail = () => (
  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.2">
    <rect x="3" y="5" width="18" height="14" rx="2.5" />
    <path d="M3 7l9 6 9-6" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const IconPhone = () => (
  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.2">
    <path d="M22 17v2a2 2 0 01-2.18 2 20 20 0 01-8.63-3.07A19.79 19.79 0 013.07 8.18 20 20 0 012 3.82 2 2 0 013.82 2H6a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L7.09 9.91a16 16 0 006 6l1.27-1.16a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 17z" strokeLinejoin="round" />
  </svg>
);

const IconLock = () => (
  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.2">
    <rect x="4" y="10" width="16" height="11" rx="2.5" />
    <path d="M8 10V7a4 4 0 018 0v3" strokeLinecap="round" />
  </svg>
);

const IconAlert = (p) => (
  <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="12" cy="12" r="10" />
    <path d="M12 8v5M12 16.5h.01" strokeLinecap="round" />
  </svg>
);

const IconInfo = (p) => (
  <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="12" cy="12" r="10" />
    <path d="M12 16v-4M12 8h.01" strokeLinecap="round" />
  </svg>
);

const IconCheck = (p) => (
  <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
    <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

/* ============================================================
   BrandSignup
   ============================================================ */
const BrandSignup = () => {
  const navigate = useNavigate();

  const [form, setForm] = useState({
    displayName: '',
    brandType: 'individual',
    email: '',
    phoneNumber: '',
    password: '',
    confirmPassword: '',
    agree: false,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  // ---- Public name availability state ----
  const [nameStatus, setNameStatus] = useState('idle');
  const [nameMessage, setNameMessage] = useState('');
  const checkTimer = useRef(null);

  const update = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  /* ---- Debounced availability check ---- */
  useEffect(() => {
    if (checkTimer.current) clearTimeout(checkTimer.current);

    const raw = form.displayName.trim();

    if (!raw) {
      setNameStatus('idle');
      setNameMessage('');
      return;
    }
    if (normalizeBrandName(raw).length < 2) {
      setNameStatus('short');
      setNameMessage('Name is too short — use at least 2 letters.');
      return;
    }

    setNameStatus('checking');
    setNameMessage('Checking availability…');

    checkTimer.current = setTimeout(async () => {
      try {
        const { available } = await isBrandNameAvailable(raw);
        setNameStatus(available ? 'available' : 'taken');
        setNameMessage(
          available
            ? 'Available ✓'
            : 'That public name is already taken. Try another.'
        );
      } catch {
        // Fail open — the transaction is the source of truth.
        setNameStatus('idle');
        setNameMessage('');
      }
    }, 450);

    return () => {
      if (checkTimer.current) clearTimeout(checkTimer.current);
    };
  }, [form.displayName]);

  /* ---- Submit ---- */
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (nameStatus === 'taken' || nameStatus === 'short') {
      setError(nameMessage || 'Please choose an available public name.');
      return;
    }
    if (nameStatus === 'checking') {
      setError('Hold on — still checking that name.');
      return;
    }
    if (form.password !== form.confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    if (!form.agree) {
      setError('Please agree to the terms to continue.');
      return;
    }

    setBusy(true);
    try {
      await signUpBrand({
        email: form.email,
        password: form.password,
        displayName: form.displayName,
        brandType: form.brandType,
        phoneNumber: form.phoneNumber,
      });

      await signInBrand(form.email, form.password);

      navigate('/brand/verification', { replace: true });
    } catch (err) {
      if (err instanceof BrandAuthError) {
        setError(err.message);
        if (err.code === 'name_taken') {
          setNameStatus('taken');
          setNameMessage(err.message);
        }
      } else {
        setError(err.message || 'Signup failed.');
      }
    } finally {
      setBusy(false);
    }
  };

  const nameFieldInvalid =
    nameStatus === 'taken' || nameStatus === 'short' || nameStatus === 'checking';

  return (
    <div className="brand-auth-shell">
      <Header sticky />

      <main className="brand-auth-stage">
        <div className="brand-auth-card-clean">
          <div className="brand-auth-badge">Brand Registration</div>
          <h1 className="brand-auth-title">Get your brand verified</h1>
          <p className="brand-auth-sub">
            For public figures, artists, ministries, event organizers, and
            any entity that wants to prove its identity on Varyfai — without
            selling products on the platform.
          </p>

          <form className="brand-auth-form" onSubmit={handleSubmit}>
            <div className="brand-field">
              <label htmlFor="bn-type">What kind of brand are you?</label>
              <select
                id="bn-type"
                value={form.brandType}
                onChange={(e) => update('brandType', e.target.value)}
                disabled={busy}
              >
                <option value="individual">
                  Individual — artist, speaker, creator
                </option>
                <option value="organization">
                  Organization — church, NGO, company
                </option>
                <option value="event">
                  Event — conference, challenge, festival
                </option>
              </select>
            </div>

            <div className="brand-field">
              <label htmlFor="bn-name">
                {form.brandType === 'individual' ? 'Your public name' : 'Brand name'}
              </label>
              <div className="brand-input-wrap">
                <span className="brand-input-icon">
                  <IconUser />
                </span>
                <input
                  id="bn-name"
                  type="text"
                  placeholder={
                    form.brandType === 'individual'
                      ? 'e.g. Nathaniel Bassey'
                      : 'e.g. Hallelujah Challenge'
                  }
                  value={form.displayName}
                  onChange={(e) => update('displayName', e.target.value)}
                  disabled={busy}
                  required
                  aria-invalid={nameFieldInvalid}
                  aria-describedby="bn-name-status"
                />
                {nameStatus === 'available' && (
                  <span className="brand-input-status brand-input-status-ok" aria-hidden="true">
                    <IconCheck width="16" height="16" />
                  </span>
                )}
                {nameStatus === 'taken' && (
                  <span className="brand-input-status brand-input-status-bad" aria-hidden="true">
                    <IconAlert width="16" height="16" />
                  </span>
                )}
              </div>

              <span
                id="bn-name-status"
                className={`brand-hint brand-hint-${nameStatus}`}
                aria-live="polite"
              >
                {nameMessage ||
                  (form.brandType === 'individual'
                    ? 'This is the name people know you by — your stage name, brand name, or full name. It does not have to match your ID.'
                    : 'This is what people will see at the top of your verified Varyfai page.')}
              </span>
            </div>

            <div className="brand-auth-note">
              <span className="brand-auth-note-icon">
                <IconInfo width="16" height="16" />
              </span>
              <div className="brand-auth-note-body">
                <strong>You'll verify your legal identity later</strong>
                <p>
                  In the next step, we'll ask for your legal name and NIN.
                  Your legal name is only used for verification — it's never
                  shown publicly unless you choose to display it.
                </p>
              </div>
            </div>

            <div className="brand-field">
              <label htmlFor="bn-email">Email address</label>
              <div className="brand-input-wrap">
                <span className="brand-input-icon">
                  <IconMail />
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
              <label htmlFor="bn-phone">
                Phone number{' '}
                <span className="brand-hint-inline">(optional)</span>
              </label>
              <div className="brand-input-wrap">
                <span className="brand-input-icon">
                  <IconPhone />
                </span>
                <input
                  id="bn-phone"
                  type="tel"
                  placeholder="08012345678"
                  value={form.phoneNumber}
                  onChange={(e) => update('phoneNumber', e.target.value)}
                  disabled={busy}
                />
              </div>
            </div>

            <div className="brand-field">
              <label htmlFor="bn-pass">Password</label>
              <div className="brand-input-wrap">
                <span className="brand-input-icon">
                  <IconLock />
                </span>
                <input
                  id="bn-pass"
                  type="password"
                  autoComplete="new-password"
                  placeholder="At least 6 characters"
                  value={form.password}
                  onChange={(e) => update('password', e.target.value)}
                  disabled={busy}
                  required
                  minLength={6}
                />
              </div>
            </div>

            <div className="brand-field">
              <label htmlFor="bn-pass2">Confirm password</label>
              <div className="brand-input-wrap">
                <span className="brand-input-icon">
                  <IconLock />
                </span>
                <input
                  id="bn-pass2"
                  type="password"
                  autoComplete="new-password"
                  placeholder="Re-enter your password"
                  value={form.confirmPassword}
                  onChange={(e) => update('confirmPassword', e.target.value)}
                  disabled={busy}
                  required
                />
              </div>
            </div>

            <label className="brand-check">
              <input
                type="checkbox"
                checked={form.agree}
                onChange={(e) => update('agree', e.target.checked)}
                disabled={busy}
              />
              <span>
                I confirm this is my real identity, and I have the right to
                register this brand name on Varyfai.
              </span>
            </label>

            {error && (
              <div className="brand-auth-error" role="alert">
                <IconAlert width="18" height="18" />
                <div className="brand-auth-error-body">
                  <strong>Could not create account</strong>
                  <span>{error}</span>
                </div>
              </div>
            )}

            <button
              type="submit"
              className="brand-auth-submit"
              disabled={busy || nameFieldInvalid}
            >
              {busy ? (
                <>
                  <span className="brand-auth-spinner" /> Creating account…
                </>
              ) : (
                <>
                  Create account
                  <IconArrow />
                </>
              )}
            </button>
          </form>

          <div className="brand-auth-divider">
            <span>Already registered?</span>
          </div>

          <Link to="/brand/login" className="brand-auth-secondary">
            Sign in to your workspace
          </Link>

          <p className="brand-auth-foot">
            By creating an account you agree to Varyfai's{' '}
            <a href="#terms">Terms</a> and <a href="#privacy">Privacy Policy</a>.
          </p>
        </div>
      </main>
    </div>
  );
};

export default BrandSignup;