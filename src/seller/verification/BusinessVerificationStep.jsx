// src/seller/verification/BusinessVerificationStep.jsx
import { useEffect, useState } from 'react';
import { submitBusinessVerification, fetchSellerProfile } from './verificationFlowApi';

const BusinessVerificationStep = ({ verification, onReload, onBack, onNext }) => {
  const existing = verification?.business || {};
  const owner = verification?.owner || {};

  // ✅ Accept BOTH 'pending' and 'verified' — do not block seller on
  //    admin review speed. This also enables the business submission
  //    to be queued immediately after Level 1.
  const ownerSubmitted =
    owner.status === 'verified' || owner.status === 'pending';

  const isVerified = existing.status === 'verified';
  const isPending = existing.status === 'pending';
  const isRejected = existing.status === 'rejected';
  const isLocked = isVerified || isPending;

  const [sellerProfile, setSellerProfile] = useState(null);
  const [type, setType] = useState(existing.type || 'registered');
  const [form, setForm] = useState({
    businessName: '',
    cacNumber: '',
    ownerName: '',
    physicalAddress: '',
    city: '',
    state: '',
    phone: '',
    email: '',
    website: '',
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  // ---- Load seller profile for prepopulation ----
  useEffect(() => {
    (async () => {
      const p = await fetchSellerProfile();
      setSellerProfile(p);
    })();
  }, []);

  // ---- Prepopulate from prior submission, seller profile, and owner ----
  useEffect(() => {
    setForm((prev) => {
      const businessName =
        existing.businessName ||
        sellerProfile?.companyName ||
        prev.businessName ||
        '';

      const cacNumber =
        existing.registered?.cacNumber ||
        sellerProfile?.businessRegistrationNumber ||
        prev.cacNumber ||
        '';

      const ownerName =
        existing.unregistered?.ownerName ||
        owner.legalName ||
        sellerProfile?.contactPersonName ||
        prev.ownerName ||
        '';

      const physicalAddress =
        existing.address?.physical ||
        sellerProfile?.physicalAddress ||
        prev.physicalAddress ||
        '';

      const city =
        existing.address?.city ||
        sellerProfile?.city ||
        prev.city ||
        '';

      const state =
        existing.address?.state ||
        sellerProfile?.state ||
        prev.state ||
        '';

      const phone =
        existing.contact?.phone ||
        sellerProfile?.phoneNumber ||
        prev.phone ||
        '';

      const email =
        existing.contact?.email ||
        sellerProfile?.email ||
        prev.email ||
        '';

      const website =
        existing.contact?.website ||
        sellerProfile?.website ||
        prev.website ||
        '';

      return {
        businessName,
        cacNumber,
        ownerName,
        physicalAddress,
        city,
        state,
        phone,
        email,
        website,
      };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [existing.businessName, owner.legalName, sellerProfile]);

  const update = (key, value) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!ownerSubmitted) {
      setError('Complete Level 1 (Owner identity) first.');
      return;
    }
    setBusy(true);
    setError('');
    setSuccess(false);
    try {
      await submitBusinessVerification({ type, ...form });
      setSuccess(true);
      await onReload();
      setTimeout(() => onNext && onNext(), 900);
    } catch (err) {
      setError(err.message || 'Submission failed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="vf-card">
      <header className="vf-card-head">
        <h2>Level 2 — Business identity</h2>
        <p>
          Register your business (registered or informal). The identity of the
          business owner is already established at Level 1.
        </p>
      </header>

      {!ownerSubmitted && (
        <div className="vf-status vf-status-amber">
          <strong>Complete Level 1 first</strong>
          <p>
            Your owner identity must be submitted before we can verify your
            business.
          </p>
          <button className="vf-btn vf-btn-ghost" onClick={onBack}>
            ← Go to Level 1
          </button>
        </div>
      )}

      {ownerSubmitted && owner.status === 'pending' && !isVerified && !isPending && (
        <div className="vf-status vf-status-info">
          <strong>Level 1 is under review</strong>
          <p>
            Your owner identity has been submitted and is being reviewed. You
            can continue with your business details now — the admin will
            review both levels together.
          </p>
        </div>
      )}

      {isVerified && (
        <div className="vf-status vf-status-green">
          <strong>✓ Business verified</strong>
          <p>Your business identity has been verified.</p>
        </div>
      )}

      {isPending && !isVerified && (
        <div className="vf-status vf-status-amber">
          <strong>Awaiting review</strong>
          <p>Your business submission is being reviewed.</p>
          <button
            type="button"
            className="vf-btn vf-btn-primary"
            onClick={onNext}
            style={{ marginTop: 12 }}
          >
            Continue to Level 3 →
          </button>
        </div>
      )}

      {isRejected && (
        <div className="vf-status vf-status-red">
          <strong>Submission rejected</strong>
          <p>{existing.rejectionReason || 'Please review and resubmit.'}</p>
        </div>
      )}

      <form className="vf-form" onSubmit={handleSubmit}>
        {/* Business type toggle */}
        <div className="vf-toggle-group">
          <button
            type="button"
            className={`vf-toggle ${type === 'registered' ? 'active' : ''}`}
            onClick={() => setType('registered')}
            disabled={busy || isLocked}
          >
            <strong>Registered business</strong>
            <span>I have a CAC registration number</span>
          </button>
          <button
            type="button"
            className={`vf-toggle ${type === 'unregistered' ? 'active' : ''}`}
            onClick={() => setType('unregistered')}
            disabled={busy || isLocked}
          >
            <strong>Informal / individual business</strong>
            <span>No CAC — owned by me personally</span>
          </button>
        </div>

        <div className="vf-field">
          <label>Business name</label>
          <input
            type="text"
            placeholder={
              type === 'registered'
                ? 'Exactly as it appears on your CAC certificate'
                : 'The name you use with customers'
            }
            value={form.businessName}
            onChange={(e) => update('businessName', e.target.value)}
            disabled={busy || isLocked}
          />
        </div>

        {type === 'registered' ? (
          <div className="vf-field">
            <label>CAC registration number</label>
            <input
              type="text"
              placeholder="e.g. RC-1234567"
              value={form.cacNumber}
              onChange={(e) =>
                update('cacNumber', e.target.value.toUpperCase())
              }
              disabled={busy || isLocked}
            />
            <span className="vf-hint">
              An admin will verify this against the CAC public registry.
            </span>
          </div>
        ) : (
          <div className="vf-status vf-status-info">
            <strong>Informal business — no CAC required</strong>
            <p>
              Because your identity was verified at Level 1, we&apos;ll show
              this business as{' '}
              <strong>
                Owned by {owner.legalName || '(verified owner)'}
              </strong>
              . Customers will see the verified owner&apos;s name, which is
              what protects them.
            </p>
          </div>
        )}

        <div className="vf-field">
          <label>Physical address</label>
          <input
            type="text"
            placeholder="Shop / office address"
            value={form.physicalAddress}
            onChange={(e) => update('physicalAddress', e.target.value)}
            disabled={busy || isLocked}
          />
        </div>

        <div className="vf-row-2">
          <div className="vf-field">
            <label>City</label>
            <input
              type="text"
              value={form.city}
              onChange={(e) => update('city', e.target.value)}
              disabled={busy || isLocked}
            />
          </div>
          <div className="vf-field">
            <label>State</label>
            <input
              type="text"
              value={form.state}
              onChange={(e) => update('state', e.target.value)}
              disabled={busy || isLocked}
            />
          </div>
        </div>

        <div className="vf-row-2">
          <div className="vf-field">
            <label>Business phone</label>
            <input
              type="tel"
              value={form.phone}
              onChange={(e) => update('phone', e.target.value)}
              disabled={busy || isLocked}
            />
          </div>
          <div className="vf-field">
            <label>Business email</label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => update('email', e.target.value)}
              disabled={busy || isLocked}
            />
          </div>
        </div>

        <div className="vf-field">
          <label>Website (optional)</label>
          <input
            type="url"
            placeholder="https://..."
            value={form.website}
            onChange={(e) => update('website', e.target.value)}
            disabled={busy || isLocked}
          />
        </div>

        {error && <div className="vf-error">{error}</div>}
        {success && (
          <div className="vf-status vf-status-green">
            <strong>✓ Submitted</strong>
            <p>Your business identity is now pending review.</p>
          </div>
        )}

        {!isLocked && (
          <div className="vf-form-actions">
            <button
              type="button"
              className="vf-btn vf-btn-ghost"
              onClick={onBack}
              disabled={busy}
            >
              ← Back
            </button>
            <button
              type="submit"
              className="vf-btn vf-btn-primary"
              disabled={busy || !ownerSubmitted}
            >
              {busy ? 'Submitting…' : 'Submit for review'}
            </button>
          </div>
        )}
      </form>
    </section>
  );
};

export default BusinessVerificationStep;