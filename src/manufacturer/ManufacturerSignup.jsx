// src/manufacturer/ManufacturerSignup.jsx
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { signUpManufacturer } from './manufacturerAuth';
import Header from '../components/Header';
import './ManufacturerPortal.css';

const BUSINESS_TYPES = [
  { value: 'sole_proprietor', label: 'Sole Proprietor' },
  { value: 'limited_company', label: 'Limited Liability Company' },
  { value: 'partnership', label: 'Partnership' },
  { value: 'public_company', label: 'Public Company' },
  { value: 'cooperative', label: 'Cooperative' },
  { value: 'other', label: 'Other' },
];

const ManufacturerSignup = () => {
  const navigate = useNavigate();

  const [form, setForm] = useState({
    companyName: '',
    contactEmail: '',
    phoneNumber: '',
    website: '',
    physicalAddress: '',
    city: '',
    state: '',
    country: 'Nigeria',
    businessType: 'limited_company',
    registrationNumber: '',
    taxId: '',
    contactPersonName: '',
    contactPersonRole: '',
    password: '',
    confirmPassword: '',
    terms: false,
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const update = (key) => (e) => {
    const value = key === 'terms' ? e.target.checked : e.target.value;
    setForm((f) => ({ ...f, [key]: value }));
  };

  const validate = () => {
    if (form.companyName.trim().length < 2) return 'Enter your company name.';
    if (!/^\S+@\S+\.\S+$/.test(form.contactEmail))
      return 'Enter a valid contact email.';
    if (!/^[+\d][\d\s\-()]{7,}$/.test(form.phoneNumber.trim()))
      return 'Enter a valid phone number.';
    if (form.physicalAddress.trim().length < 5)
      return 'Enter your physical address.';
    if (form.city.trim().length < 2) return 'Enter your city.';
    if (form.state.trim().length < 2) return 'Enter your state.';
    if (form.registrationNumber.trim().length < 3)
      return 'Enter your registration number.';
    if (form.taxId.trim().length < 3) return 'Enter your tax ID.';
    if (form.contactPersonName.trim().length < 2)
      return 'Enter the primary contact name.';
    if (form.contactPersonRole.trim().length < 2)
      return 'Enter the contact person role.';
    if (form.password.length < 8)
      return 'Password must be at least 8 characters.';
    if (form.password !== form.confirmPassword)
      return "Passwords don't match.";
    if (!form.terms) return 'You must accept the terms.';
    return null;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const v = validate();
    if (v) {
      setError(v);
      return;
    }

    setLoading(true);
    setError('');
    try {
      await signUpManufacturer({
        companyName: form.companyName.trim(),
        contactEmail: form.contactEmail.trim().toLowerCase(),
        phoneNumber: form.phoneNumber.trim(),
        website: form.website.trim(),
        physicalAddress: form.physicalAddress.trim(),
        city: form.city.trim(),
        state: form.state.trim(),
        country: form.country.trim(),
        businessType: form.businessType,
        registrationNumber: form.registrationNumber.trim(),
        taxId: form.taxId.trim(),
        contactPersonName: form.contactPersonName.trim(),
        contactPersonRole: form.contactPersonRole.trim(),
        password: form.password,
      });
      setSuccess(true);
    } catch (err) {
      console.error(err);
      const map = {
        'auth/email-already-in-use': 'An account with this email already exists.',
        'auth/invalid-email': 'Invalid email address.',
        'auth/weak-password': 'Password too weak.',
      };
      setError(
        map[err.code] || 'Could not submit your application. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  // ------------------------------------------------------------
  // Success screen
  // ------------------------------------------------------------
  if (success) {
    return (
      <div className="mf-auth-shell">
        <Header sticky />
        <main className="mf-auth-stage">
          <div className="mf-auth-card-clean mf-auth-success">
            <div className="mf-auth-success-icon">✓</div>
            <h1 className="mf-auth-title">Application received</h1>
            <p className="mf-auth-subtitle">
              Thanks, <strong>{form.companyName}</strong>. Our team will review your
              application and email you at <strong>{form.contactEmail}</strong> once
              your account is approved — usually within 1 business day.
            </p>
            <button
              className="mf-auth-submit"
              onClick={() => navigate('/manufacturer/login')}
            >
              Back to sign in
            </button>
          </div>
        </main>
      </div>
    );
  }

  // ------------------------------------------------------------
  // Main form
  // ------------------------------------------------------------
  return (
    <div className="mf-auth-shell">
      {/* ============================================================
          UNIFIED HEADER
          ============================================================ */}
      <Header sticky />

      <main className="mf-signup-main">
        <div className="mf-signup-header">
          <div className="mf-auth-badge">Manufacturer Registration</div>
          <h1 className="mf-signup-title">Register your factory</h1>
          <p className="mf-signup-subtitle">
            Complete this form to apply. Applications are reviewed within 1 business day.
          </p>
        </div>

        <form className="mf-signup-form" onSubmit={handleSubmit}>
          {/* Company */}
          <section className="mf-signup-section">
            <h2 className="mf-signup-section-title">Company details</h2>
            <div className="mf-signup-grid">
              <div className="mf-signup-field mf-signup-field-full">
                <label>Registered company name *</label>
                <input
                  value={form.companyName}
                  onChange={update('companyName')}
                  placeholder="e.g. XYZ Foods Ltd"
                  required
                />
              </div>

              <div className="mf-signup-field">
                <label>Contact email *</label>
                <input
                  type="email"
                  value={form.contactEmail}
                  onChange={update('contactEmail')}
                  placeholder="admin@company.com"
                  required
                />
              </div>

              <div className="mf-signup-field">
                <label>Phone number *</label>
                <input
                  type="tel"
                  value={form.phoneNumber}
                  onChange={update('phoneNumber')}
                  placeholder="+234 801 234 5678"
                  required
                />
              </div>

              <div className="mf-signup-field mf-signup-field-full">
                <label>Website (optional)</label>
                <input
                  type="url"
                  value={form.website}
                  onChange={update('website')}
                  placeholder="https://yourcompany.com"
                />
              </div>
            </div>
          </section>

          {/* Address */}
          <section className="mf-signup-section">
            <h2 className="mf-signup-section-title">Factory address</h2>
            <div className="mf-signup-grid">
              <div className="mf-signup-field mf-signup-field-full">
                <label>Physical address *</label>
                <input
                  value={form.physicalAddress}
                  onChange={update('physicalAddress')}
                  placeholder="Street, building number, area"
                  required
                />
              </div>

              <div className="mf-signup-field">
                <label>City *</label>
                <input
                  value={form.city}
                  onChange={update('city')}
                  placeholder="Lagos"
                  required
                />
              </div>

              <div className="mf-signup-field">
                <label>State / Region *</label>
                <input
                  value={form.state}
                  onChange={update('state')}
                  placeholder="Lagos State"
                  required
                />
              </div>

              <div className="mf-signup-field">
                <label>Country *</label>
                <input
                  value={form.country}
                  onChange={update('country')}
                  placeholder="Nigeria"
                  required
                />
              </div>
            </div>
          </section>

          {/* Business info */}
          <section className="mf-signup-section">
            <h2 className="mf-signup-section-title">Business information</h2>
            <div className="mf-signup-grid">
              <div className="mf-signup-field">
                <label>Business type *</label>
                <select
                  value={form.businessType}
                  onChange={update('businessType')}
                >
                  {BUSINESS_TYPES.map((b) => (
                    <option key={b.value} value={b.value}>
                      {b.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="mf-signup-field">
                <label>Registration number *</label>
                <input
                  value={form.registrationNumber}
                  onChange={update('registrationNumber')}
                  placeholder="e.g. RC-1234567"
                  required
                />
              </div>

              <div className="mf-signup-field">
                <label>Tax ID / TIN *</label>
                <input
                  value={form.taxId}
                  onChange={update('taxId')}
                  placeholder="e.g. TIN-9876543"
                  required
                />
              </div>
            </div>
          </section>

          {/* Contact person */}
          <section className="mf-signup-section">
            <h2 className="mf-signup-section-title">Primary contact</h2>
            <div className="mf-signup-grid">
              <div className="mf-signup-field">
                <label>Full name *</label>
                <input
                  value={form.contactPersonName}
                  onChange={update('contactPersonName')}
                  placeholder="e.g. Jane Doe"
                  required
                />
              </div>

              <div className="mf-signup-field">
                <label>Role / Job title *</label>
                <input
                  value={form.contactPersonRole}
                  onChange={update('contactPersonRole')}
                  placeholder="e.g. Operations Manager"
                  required
                />
              </div>
            </div>
          </section>

          {/* Password */}
          <section className="mf-signup-section">
            <h2 className="mf-signup-section-title">Account password</h2>
            <div className="mf-signup-grid">
              <div className="mf-signup-field">
                <label>Password *</label>
                <input
                  type="password"
                  value={form.password}
                  onChange={update('password')}
                  placeholder="At least 8 characters"
                  required
                />
              </div>

              <div className="mf-signup-field">
                <label>Confirm password *</label>
                <input
                  type="password"
                  value={form.confirmPassword}
                  onChange={update('confirmPassword')}
                  placeholder="Re-enter password"
                  required
                />
              </div>
            </div>
          </section>

          <label className="mf-signup-checkbox">
            <input
              type="checkbox"
              checked={form.terms}
              onChange={update('terms')}
            />
            <span>
              I confirm the information provided is accurate and I agree to Varyfai's{' '}
              <a href="#terms">Terms</a> and <a href="#privacy">Privacy Policy</a>.
            </span>
          </label>

          {error && (
            <div className="mf-auth-error">
              <span>{error}</span>
            </div>
          )}

          <div className="mf-signup-actions">
            <Link to="/manufacturer/login" className="mf-auth-secondary">
              Cancel
            </Link>
            <button
              type="submit"
              className="mf-auth-submit"
              disabled={loading}
            >
              {loading ? 'Submitting…' : 'Submit application'}
            </button>
          </div>
        </form>
      </main>
    </div>
  );
};

export default ManufacturerSignup;