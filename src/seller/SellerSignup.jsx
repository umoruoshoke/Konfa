// src/seller/SellerSignup.jsx
import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { signUpSeller } from './sellerAuth';
import Header from '../components/Header';
import './SellerPortal.css';

const IconArrowLeft = (p) => (
  <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
    <path d="M19 12H5M11 6l-6 6 6 6" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const ROLES = [
  { value: 'distributor', label: 'Distributor', desc: 'Buy in bulk, distribute to retailers' },
  { value: 'retailer',    label: 'Retailer',    desc: 'Sell directly to consumers' },
  { value: 'wholesaler',  label: 'Wholesaler',  desc: 'Move stock between partners' },
];

const BUSINESS_TYPES = [
  { value: 'sole_proprietor', label: 'Sole Proprietor' },
  { value: 'limited_company', label: 'Limited Liability Company' },
  { value: 'partnership',     label: 'Partnership' },
  { value: 'public_company',  label: 'Public Company' },
  { value: 'cooperative',     label: 'Cooperative' },
  { value: 'other',           label: 'Other' },
];

const PROGRESS_STEPS = [
  { key: 'account',  label: 'Account' },
  { key: 'business', label: 'Business' },
  { key: 'contact',  label: 'Contact' },
];

const SignupProgress = ({ current }) => {
  const currentIdx = PROGRESS_STEPS.findIndex((s) => s.key === current);

  return (
    <div className="signup-progress">
      {PROGRESS_STEPS.map((s, i) => {
        const state =
          i < currentIdx ? 'done'
          : i === currentIdx ? 'active'
          : 'pending';

        return (
          <div
            key={s.key}
            className={`signup-progress-step signup-progress-${state}`}
          >
            <div className="signup-progress-dot">
              {state === 'done' ? '✓' : i + 1}
            </div>
            <span>{s.label}</span>
          </div>
        );
      })}
      <div className="signup-progress-line" />
    </div>
  );
};

const SellerSignup = () => {
  const navigate = useNavigate();

  const [companyName, setCompanyName] = useState('');
  const [email, setEmail] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [role, setRole] = useState('distributor');

  const [businessType, setBusinessType] = useState('limited_company');
  const [registrationNumber, setRegistrationNumber] = useState('');
  const [taxId, setTaxId] = useState('');
  const [physicalAddress, setPhysicalAddress] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');

  const [contactPersonName, setContactPersonName] = useState('');
  const [contactPersonRole, setContactPersonRole] = useState('');

  const [website, setWebsite] = useState('');
  const [notes, setNotes] = useState('');
  const [terms, setTerms] = useState(false);

  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const [currentStep, setCurrentStep] = useState('account');

  const sectionRefs = {
    account: useRef(null),
    business: useRef(null),
    contact: useRef(null),
    notes: useRef(null),
  };

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = [];
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            visible.push({
              key: entry.target.dataset.step,
              top: entry.boundingClientRect.top,
            });
          }
        });
        if (visible.length === 0) return;

        visible.sort((a, b) => Math.abs(a.top) - Math.abs(b.top));
        const next = visible[0].key;
        setCurrentStep((prev) => (prev === next ? prev : next));
      },
      { rootMargin: '-15% 0px -60% 0px', threshold: 0 }
    );

    Object.entries(sectionRefs).forEach(([key, ref]) => {
      if (ref.current) {
        ref.current.dataset.step = key;
        observer.observe(ref.current);
      }
    });

    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const validate = () => {
    if (companyName.trim().length < 2) return 'Please enter your registered company name.';
    if (!/^\S+@\S+\.\S+$/.test(email)) return 'Please enter a valid business email.';
    if (!/^[+\d][\d\s\-()]{7,}$/.test(phoneNumber.trim()))
      return 'Please enter a valid phone number.';
    if (password.length < 8) return 'Password must be at least 8 characters.';
    if (password !== confirmPassword) return "Passwords don't match.";

    if (registrationNumber.trim().length < 3)
      return 'Please enter your business registration number.';
    if (taxId.trim().length < 3) return 'Please enter your tax ID / TIN.';
    if (physicalAddress.trim().length < 5)
      return 'Please enter your registered physical address.';
    if (city.trim().length < 2) return 'Please enter your city.';
    if (state.trim().length < 2) return 'Please enter your state / region.';

    if (contactPersonName.trim().length < 2)
      return 'Please enter the primary contact person name.';
    if (contactPersonRole.trim().length < 2)
      return 'Please enter the contact person role (e.g. CEO, Operations Manager).';

    if (!terms) return 'You must accept the terms to continue.';
    return null;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    const v = validate();
    if (v) {
      setError(v);
      return;
    }

    setLoading(true);
    try {
      await signUpSeller({
        companyName: companyName.trim(),
        email: email.trim().toLowerCase(),
        phoneNumber: phoneNumber.trim(),
        password,
        role,
        businessType,
        registrationNumber: registrationNumber.trim(),
        taxId: taxId.trim(),
        physicalAddress: physicalAddress.trim(),
        city: city.trim(),
        state: state.trim(),
        contactPersonName: contactPersonName.trim(),
        contactPersonRole: contactPersonRole.trim(),
        website: website.trim(),
        notes: notes.trim(),
      });
      setSuccess(true);
    } catch (err) {
      console.error('Signup failed:', err);
      const map = {
        'auth/email-already-in-use': 'An account with this email already exists.',
        'auth/invalid-email': 'Please enter a valid email address.',
        'auth/weak-password': 'Please choose a stronger password.',
        'auth/operation-not-allowed': 'Signup is temporarily disabled. Try again later.',
      };
      setError(map[err.code] || 'Could not create your account. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="signup-page">
        <Header sticky />

        <main className="signup-main">
          <div className="signup-success-card">
            <div className="signup-success-icon">✓</div>
            <h1>Application received</h1>
            <p className="signup-success-lead">
              Thanks, <strong>{companyName}</strong>. Your seller application is now under
              review.
            </p>
            <p className="signup-success-sub">
              We'll email you at <strong>{email}</strong> once your account is approved —
              usually within one business day.
            </p>

            <div className="signup-next-steps">
              <h3>What happens next</h3>
              <ol>
                <li>
                  <span className="signup-next-num">1</span>
                  <div>
                    <strong>Admin review</strong>
                    <span>Our team verifies your business details.</span>
                  </div>
                </li>
                <li>
                  <span className="signup-next-num">2</span>
                  <div>
                    <strong>Approval email</strong>
                    <span>You'll receive an email when you're approved.</span>
                  </div>
                </li>
                <li>
                  <span className="signup-next-num">3</span>
                  <div>
                    <strong>Start working</strong>
                    <span>Log in to scan, receive, and transfer stock.</span>
                  </div>
                </li>
              </ol>
            </div>

            <button
              className="signup-btn signup-btn-primary"
              onClick={() => navigate('/seller/login')}
            >
              Back to sign in
            </button>
          </div>
        </main>

        <footer className="signup-footer">
          <p>© 2026 Varyfai. All rights reserved.</p>
        </footer>
      </div>
    );
  }

  return (
    <div className="signup-page">
      <Header sticky />

      <main className="signup-main">
        <div className="signup-header-block">
          <div className="signup-badge">Seller Registration</div>
          <h1 className="signup-title">Apply to become a Varyfai seller</h1>
          <p className="signup-subtitle">
            Tell us about your business. Applications are usually reviewed within one
            business day.
          </p>
        </div>

        <div className="signup-progress-sticky">
          <SignupProgress current={currentStep} />
        </div>

        <form className="signup-form" onSubmit={handleSubmit}>
          {/* ---------------- SECTION 1: ACCOUNT ---------------- */}
          <section className="signup-section" ref={sectionRefs.account}>
            <div className="signup-section-head">
              <div className="signup-section-num">1</div>
              <div>
                <h2>Account details</h2>
                <p>How you'll sign in to Varyfai</p>
              </div>
            </div>

            <div className="signup-grid">
              <div className="signup-field signup-field-full">
                <label>
                  Registered company name <span className="req">*</span>
                </label>
                <input
                  type="text"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="e.g. Acme Distributors Ltd"
                  disabled={loading}
                  autoComplete="organization"
                  required
                />
              </div>

              <div className="signup-field">
                <label>
                  Business email <span className="req">*</span>
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@company.com"
                  autoComplete="email"
                  disabled={loading}
                  required
                />
                <span className="signup-help">We'll send approval updates here.</span>
              </div>

              <div className="signup-field">
                <label>
                  Phone number <span className="req">*</span>
                </label>
                <input
                  type="tel"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  placeholder="+234 801 234 5678"
                  autoComplete="tel"
                  disabled={loading}
                  required
                />
              </div>

              <div className="signup-field">
                <label>
                  Password <span className="req">*</span>
                </label>
                <div className="signup-input-wrap">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="At least 8 characters"
                    autoComplete="new-password"
                    disabled={loading}
                    required
                  />
                  <button
                    type="button"
                    className="signup-eye"
                    onClick={() => setShowPassword((v) => !v)}
                    tabIndex={-1}
                  >
                    {showPassword ? 'Hide' : 'Show'}
                  </button>
                </div>
              </div>

              <div className="signup-field">
                <label>
                  Confirm password <span className="req">*</span>
                </label>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter password"
                  autoComplete="new-password"
                  disabled={loading}
                  required
                />
              </div>
            </div>

            <div className="signup-field">
              <label>
                Role on the platform <span className="req">*</span>
              </label>
              <div className="signup-roles">
                {ROLES.map((r) => (
                  <button
                    key={r.value}
                    type="button"
                    className={`signup-role ${role === r.value ? 'selected' : ''}`}
                    onClick={() => setRole(r.value)}
                    disabled={loading}
                  >
                    <strong>{r.label}</strong>
                    <span>{r.desc}</span>
                  </button>
                ))}
              </div>
            </div>
          </section>

          {/* ---------------- SECTION 2: BUSINESS ---------------- */}
          <section className="signup-section" ref={sectionRefs.business}>
            <div className="signup-section-head">
              <div className="signup-section-num">2</div>
              <div>
                <h2>Business information</h2>
                <p>Your registered business details</p>
              </div>
            </div>

            <div className="signup-grid">
              <div className="signup-field">
                <label>
                  Business type <span className="req">*</span>
                </label>
                <select
                  value={businessType}
                  onChange={(e) => setBusinessType(e.target.value)}
                  disabled={loading}
                >
                  {BUSINESS_TYPES.map((b) => (
                    <option key={b.value} value={b.value}>
                      {b.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="signup-field">
                <label>
                  Registration number <span className="req">*</span>
                </label>
                <input
                  type="text"
                  value={registrationNumber}
                  onChange={(e) => setRegistrationNumber(e.target.value)}
                  placeholder="e.g. RC-1234567"
                  disabled={loading}
                  required
                />
              </div>

              <div className="signup-field">
                <label>
                  Tax ID / TIN <span className="req">*</span>
                </label>
                <input
                  type="text"
                  value={taxId}
                  onChange={(e) => setTaxId(e.target.value)}
                  placeholder="e.g. TIN-9876543"
                  disabled={loading}
                  required
                />
              </div>

              <div className="signup-field">
                <label>Website (optional)</label>
                <input
                  type="url"
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                  placeholder="https://yourcompany.com"
                  disabled={loading}
                />
              </div>

              <div className="signup-field signup-field-full">
                <label>
                  Physical address <span className="req">*</span>
                </label>
                <input
                  type="text"
                  value={physicalAddress}
                  onChange={(e) => setPhysicalAddress(e.target.value)}
                  placeholder="Street, building number, area"
                  disabled={loading}
                  required
                />
              </div>

              <div className="signup-field">
                <label>
                  City <span className="req">*</span>
                </label>
                <input
                  type="text"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="e.g. Lagos"
                  disabled={loading}
                  required
                />
              </div>

              <div className="signup-field">
                <label>
                  State / Region <span className="req">*</span>
                </label>
                <input
                  type="text"
                  value={state}
                  onChange={(e) => setState(e.target.value)}
                  placeholder="e.g. Lagos State"
                  disabled={loading}
                  required
                />
              </div>
            </div>
          </section>

          {/* ---------------- SECTION 3: CONTACT ---------------- */}
          <section className="signup-section" ref={sectionRefs.contact}>
            <div className="signup-section-head">
              <div className="signup-section-num">3</div>
              <div>
                <h2>Primary contact person</h2>
                <p>Who we'll be in touch with</p>
              </div>
            </div>

            <div className="signup-grid">
              <div className="signup-field">
                <label>
                  Full name <span className="req">*</span>
                </label>
                <input
                  type="text"
                  value={contactPersonName}
                  onChange={(e) => setContactPersonName(e.target.value)}
                  placeholder="e.g. Jane Doe"
                  autoComplete="name"
                  disabled={loading}
                  required
                />
              </div>

              <div className="signup-field">
                <label>
                  Role / Job title <span className="req">*</span>
                </label>
                <input
                  type="text"
                  value={contactPersonRole}
                  onChange={(e) => setContactPersonRole(e.target.value)}
                  placeholder="e.g. Operations Manager"
                  disabled={loading}
                  required
                />
              </div>
            </div>
          </section>

          {/* ---------------- SECTION 4: NOTES ---------------- */}
          <section
            className="signup-section signup-section-muted"
            ref={sectionRefs.notes}
          >
            <div className="signup-section-head">
              <div className="signup-section-num">4</div>
              <div>
                <h2>
                  Anything else?{' '}
                  <span className="signup-optional">(optional)</span>
                </h2>
                <p>Help us understand your business better</p>
              </div>
            </div>

            <div className="signup-field">
              <label>Additional notes for our review team</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Tell us about your existing stock, distribution network, or anything else the reviewer should know."
                rows={4}
                disabled={loading}
              />
            </div>
          </section>

          {/* ---------------- TERMS + SUBMIT ---------------- */}
          <div className="signup-terms-box">
            <label className="signup-checkbox">
              <input
                type="checkbox"
                checked={terms}
                onChange={(e) => setTerms(e.target.checked)}
                disabled={loading}
              />
              <span>
                I confirm the information provided is accurate and I agree to Varyfai's{' '}
                <a href="#terms">Terms of Service</a> and{' '}
                <a href="#privacy">Privacy Policy</a>.
              </span>
            </label>

            {error && (
              <div className="signup-error" role="alert">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M12 8v5M12 16.5h.01" strokeLinecap="round" />
                </svg>
                {error}
              </div>
            )}

            <div className="signup-actions">
              <Link to="/seller/login" className="signup-btn signup-btn-ghost">
                Cancel
              </Link>
              <button
                type="submit"
                className="signup-btn signup-btn-primary"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <span className="signup-spinner" /> Submitting application…
                  </>
                ) : (
                  <>Submit application →</>
                )}
              </button>
            </div>

            <p className="signup-footer-note">
              Already have an account?{' '}
              <Link to="/seller/login">Sign in</Link>
            </p>
          </div>
        </form>
      </main>

      <footer className="signup-footer">
        <p>
          © 2026 Varyfai ·{' '}
          <a href="#privacy">Privacy</a> · <a href="#terms">Terms</a> ·{' '}
          <a href="#contact">Support</a>
        </p>
      </footer>
    </div>
  );
};

export default SellerSignup;