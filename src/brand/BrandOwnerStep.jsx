// src/brand/BrandOwnerStep.jsx
import { useState, useMemo } from 'react';
import { submitBrandOwnerVerification } from './brandVerificationApi';
import { compareNames } from '../seller/verification/verificationFlowApi';

/* ---------- Image compression ---------- */
async function compressImageToDataUrl(file, maxBytes = 380 * 1024) {
  if (!file) throw new Error('No file provided.');

  const dataUrl = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

  const img = await new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = dataUrl;
  });

  const canvas = document.createElement('canvas');
  let { width, height } = img;
  const MAX_DIM = 1400;
  if (width > MAX_DIM || height > MAX_DIM) {
    if (width > height) {
      height = Math.round((height * MAX_DIM) / width);
      width = MAX_DIM;
    } else {
      width = Math.round((width * MAX_DIM) / height);
      height = MAX_DIM;
    }
  }

  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0, width, height);

  let quality = 0.85;
  let out = canvas.toDataURL('image/jpeg', quality);
  while (out.length * 0.75 > maxBytes && quality > 0.4) {
    quality -= 0.1;
    out = canvas.toDataURL('image/jpeg', quality);
  }
  return out;
}

/* ---------- Icons ---------- */
const IconCheck = (p) => (
  <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
    <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const IconInfo = (p) => (
  <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="12" cy="12" r="10" />
    <path d="M12 16v-4M12 8h.01" strokeLinecap="round" />
  </svg>
);

const BrandOwnerStep = ({ verification, brand, onReload, onNext }) => {
  const owner = verification?.owner || {};
  const [form, setForm] = useState({
    legalName: owner.legalName || '',
    nin: owner.nin || '',
  });
  const [ninDoc, setNinDoc] = useState(null);
  const [selfie, setSelfie] = useState(null);
  const [ninPreview, setNinPreview] = useState(owner.ninDocumentData || '');
  const [selfiePreview, setSelfiePreview] = useState(owner.selfieWithNinData || '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const brandName = brand?.displayName || '';
  const nameCheck = useMemo(() => {
    if (!form.legalName) return null;
    return compareNames(form.legalName, brandName);
  }, [form.legalName, brandName]);

  const update = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  const handleFile = async (file, setter, previewSetter) => {
    if (!file) return;
    try {
      const compressed = await compressImageToDataUrl(file);
      setter(file);
      previewSetter(compressed);
    } catch (err) {
      setError(err.message || 'Could not process image.');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    const ninDocData = ninPreview || null;
    const selfieData = selfiePreview || null;

    if (!ninDocData) {
      setError('Attach a photo of your NIN slip.');
      return;
    }
    if (!selfieData) {
      setError('Attach a selfie of you holding your NIN.');
      return;
    }

    setBusy(true);
    try {
      await submitBrandOwnerVerification({
        legalName: form.legalName,
        nin: form.nin,
        ninDocumentData: ninDocData,
        selfieWithNinData: selfieData,
      });
      setSuccess('Owner identity submitted for review.');
      await onReload();
    } catch (err) {
      setError(err.message || 'Could not submit verification.');
    } finally {
      setBusy(false);
    }
  };

  const status = owner.status;
  const locked = status === 'pending' || status === 'verified';

  return (
    <section className="brand-card">
      <header className="brand-card-head">
        <div>
          <h2>Level 1 — Owner identity</h2>
          <p>
            Prove you are the real person behind {brandName || 'this brand'}.
            We compare your legal name on the NIN against your brand name and
            store the documents securely.
          </p>
        </div>
        {status && <StatusBadge status={status} />}
      </header>

      {status === 'verified' && (
        <div className="brand-callout brand-callout-ok">
          <strong>✓ Owner identity verified</strong>
          <p>You can continue to link your social accounts.</p>
        </div>
      )}

      {status === 'pending' && (
        <div className="brand-callout brand-callout-amber">
          <strong>Under review</strong>
          <p>
            Your submission is being reviewed. This usually takes 1–2 business
            days.
          </p>
        </div>
      )}

      {status === 'rejected' && (
        <div className="brand-callout brand-callout-red">
          <strong>Rejected</strong>
          <p>{owner.rejectionReason || 'Please correct the issue and resubmit.'}</p>
        </div>
      )}

      {!locked && (
        <form className="brand-form" onSubmit={handleSubmit}>
          {/* ============================================================
              LEGAL NAME vs PUBLIC NAME — explanatory header
              ============================================================ */}
          <div className="brand-owner-explainer">
            <span className="brand-owner-explainer-icon">
              <IconInfo width="18" height="18" />
            </span>
            <div className="brand-owner-explainer-body">
              <strong>Your legal name can be different from your brand name</strong>
              <p>
                Public figures often use a stage name, and organizations
                usually have a different legal name from the person running
                them. That's completely fine — just enter the legal name on
                your NIN below.
              </p>
            </div>
          </div>

          <div className="brand-field">
            <label htmlFor="bn-legal">
              Full legal name (as it appears on your NIN)
            </label>
            <input
              id="bn-legal"
              type="text"
              placeholder="e.g. Nathaniel Bassey"
              value={form.legalName}
              onChange={(e) => update('legalName', e.target.value)}
              disabled={busy}
              required
            />
            <span className="brand-hint">
              This is only used for verification. It's never shown publicly
              unless you choose to display it.
            </span>
          </div>

          <div className="brand-field">
            <label htmlFor="bn-nin">NIN (11 digits)</label>
            <input
              id="bn-nin"
              type="text"
              inputMode="numeric"
              placeholder="12345678901"
              value={form.nin}
              onChange={(e) =>
                update('nin', e.target.value.replace(/\D/g, '').slice(0, 11))
              }
              disabled={busy}
              required
            />
          </div>

          {/* ============================================================
              NAME-MATCH FEEDBACK
              · Matched     → green "Names match"
              · Not matched → neutral info (NOT a warning)
              ============================================================ */}
          {nameCheck && nameCheck.matched && (
            <div className="brand-callout brand-callout-ok">
              <strong>✓ Names match</strong>
              <p>
                Your legal name matches the brand name &ldquo;{brandName}&rdquo;.
              </p>
            </div>
          )}

          {nameCheck && !nameCheck.matched && (
            <div className="brand-callout brand-callout-info">
              <strong>
                <IconInfo width="14" height="14" /> Different from your brand name — that&apos;s OK
              </strong>
              <p>
                Your legal name &ldquo;{form.legalName}&rdquo; differs from your
                brand name &ldquo;{brandName}&rdquo;. This is completely normal for
                stage names, ministries, and organizations. An admin will review
                and confirm you&apos;re the person behind this brand.
              </p>
            </div>
          )}

          <div className="brand-row-2">
            <label className="brand-upload">
              <span className="brand-upload-label">NIN document</span>
              <input
                type="file"
                accept="image/*"
                onChange={(e) =>
                  handleFile(e.target.files?.[0], setNinDoc, setNinPreview)
                }
                disabled={busy}
              />
              {ninPreview ? (
                <img src={ninPreview} alt="NIN preview" className="brand-upload-preview" />
              ) : (
                <span className="brand-upload-hint">Tap to attach a photo</span>
              )}
            </label>

            <label className="brand-upload">
              <span className="brand-upload-label">Selfie with NIN</span>
              <input
                type="file"
                accept="image/*"
                onChange={(e) =>
                  handleFile(e.target.files?.[0], setSelfie, setSelfiePreview)
                }
                disabled={busy}
              />
              {selfiePreview ? (
                <img src={selfiePreview} alt="Selfie preview" className="brand-upload-preview" />
              ) : (
                <span className="brand-upload-hint">Tap to attach a photo</span>
              )}
            </label>
          </div>

          {error && <div className="brand-error">{error}</div>}
          {success && <div className="brand-info">{success}</div>}

          <div className="brand-form-actions">
            <button
              type="button"
              className="brand-btn brand-btn-ghost"
              onClick={onNext}
              disabled={busy}
            >
              Skip for now →
            </button>
            <button
              type="submit"
              className="brand-btn brand-btn-primary brand-btn-large"
              disabled={busy}
            >
              {busy ? 'Submitting…' : 'Submit for review'}
            </button>
          </div>
        </form>
      )}

      {locked && (
        <div className="brand-form-actions">
          <button
            type="button"
            className="brand-btn brand-btn-primary brand-btn-large"
            onClick={onNext}
          >
            Continue to social accounts →
          </button>
        </div>
      )}
    </section>
  );
};

const StatusBadge = ({ status }) => {
  const map = {
    verified: { label: 'Verified', cls: 'brand-status-green' },
    pending: { label: 'Pending review', cls: 'brand-status-amber' },
    rejected: { label: 'Rejected', cls: 'brand-status-red' },
    unsubmitted: { label: 'Not submitted', cls: 'brand-status-gray' },
  };
  const s = map[status] || map.unsubmitted;
  return <span className={`brand-status ${s.cls}`}>{s.label}</span>;
};

export default BrandOwnerStep;