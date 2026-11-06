// src/seller/verification/OwnerVerificationStep.jsx
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  submitOwnerVerification,
  compareNames,
  maskNin,
  fetchSellerProfile,
} from './verificationFlowApi';
import { compressToDataUrl, formatBytes } from './imageCompressor';
import './IdentityUpload.css';

const BANKS = [
  'Access Bank', 'Citibank', 'Ecobank', 'Fidelity Bank', 'First Bank',
  'First City Monument Bank (FCMB)', 'Guaranty Trust Bank (GTB)',
  'Heritage Bank', 'Keystone Bank', 'Kuda', 'Moniepoint MFB',
  'Opay', 'Polaris Bank', 'Providus Bank', 'Stanbic IBTC',
  'Standard Chartered', 'Sterling Bank', 'Union Bank',
  'United Bank for Africa (UBA)', 'Unity Bank', 'Wema Bank', 'Zenith Bank',
];

const OwnerVerificationStep = ({ verification, onReload, onNext }) => {
  const existing = verification?.owner || {};
  const isVerified = existing.status === 'verified';
  const isPending = existing.status === 'pending';
  const isRejected = existing.status === 'rejected';
  const isLocked = isVerified || isPending;

  const [sellerProfile, setSellerProfile] = useState(null);
  const [form, setForm] = useState({
    legalName: '',
    nin: '',
    bankName: '',
    accountNumber: '',
    accountName: '',
    ninDocumentData: existing.ninDocumentData || '',
    selfieWithNinData: existing.selfieWithNinData || '',
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    (async () => {
      const p = await fetchSellerProfile();
      setSellerProfile(p);
    })();
  }, []);

  useEffect(() => {
    setForm((prev) => ({
      ...prev,
      legalName:
        existing.legalName ||
        sellerProfile?.contactPersonName ||
        sellerProfile?.companyName ||
        prev.legalName ||
        '',
      bankName: existing.bankAccount?.bankName || prev.bankName || '',
      accountName: existing.bankAccount?.accountName || prev.accountName || '',
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [existing.legalName, sellerProfile]);

  const update = (key, value) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const nameCheck = useMemo(() => {
    if (!form.legalName || !form.accountName) return null;
    return compareNames(form.legalName, form.accountName);
  }, [form.legalName, form.accountName]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isLocked) return;

    if (!form.ninDocumentData) {
      setError('Please attach a photo of your NIN slip or card.');
      return;
    }
    if (!form.selfieWithNinData) {
      setError('Please attach a selfie of you holding your NIN.');
      return;
    }

    setBusy(true);
    setError('');
    setSuccess(false);
    try {
      const result = await submitOwnerVerification(form);
      setSuccess(true);
      const delay = result.nameMatch ? 1200 : 2200;
      setTimeout(() => onNext && onNext(), delay);
      await onReload();
    } catch (err) {
      setError(err.message || 'Submission failed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="vf-card">
      <header className="vf-card-head">
        <h2>Level 1 — Owner identity</h2>
        <p>
          We verify that the person behind this Konfa profile is a real,
          identifiable individual. You&apos;ll need your NIN slip and a
          selfie holding it.
        </p>
      </header>

      {isVerified && (
        <div className="vf-status vf-status-green">
          <strong>✓ Owner identity verified</strong>
          <p>
            Your legal name, NIN, and bank account have been verified. Contact
            support if any of these details need to change.
          </p>
          <button
            type="button"
            className="vf-btn vf-btn-primary"
            onClick={onNext}
            style={{ marginTop: 12 }}
          >
            Continue to Level 2 →
          </button>
        </div>
      )}

      {isPending && (
        <div className="vf-status vf-status-amber">
          <strong>Awaiting review</strong>
          <p>
            Your submission is being reviewed. This usually takes 1–2 business
            days. You can continue to Level 2 while you wait.
          </p>
          <button
            type="button"
            className="vf-btn vf-btn-primary"
            onClick={onNext}
            style={{ marginTop: 12 }}
          >
            Continue to Level 2 →
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
        <div className="vf-field">
          <label>Full legal name</label>
          <input
            type="text"
            placeholder="As it appears on your NIN"
            value={form.legalName}
            onChange={(e) => update('legalName', e.target.value)}
            disabled={busy || isLocked}
            autoComplete="name"
          />
          <span className="vf-hint">
            Must match the name on your bank account. Order doesn&apos;t matter.
          </span>
        </div>

        <div className="vf-field">
          <label>NIN (National Identity Number)</label>
          <input
            type="text"
            placeholder="11 digits"
            value={form.nin}
            onChange={(e) =>
              update('nin', e.target.value.replace(/\D/g, '').slice(0, 11))
            }
            disabled={busy || isLocked}
            inputMode="numeric"
            maxLength={11}
            autoComplete="off"
          />
          <span className="vf-hint">
            {existing.nin ? `On file: ${maskNin(existing.nin)} · ` : ''}
            Stored securely. Never shown publicly.
          </span>
        </div>

        {/* ---- NIN document ---- */}
        <CompressedImageField
          label="Photo of your NIN slip or NIN card"
          hint="The NIN number must be clearly visible. Hold the camera steady and use good lighting."
          existingData={form.ninDocumentData}
          disabled={busy || isLocked}
          onChange={(data) => update('ninDocumentData', data)}
        />

        {/* ---- Selfie with NIN ---- */}
        <CompressedImageField
          label="Selfie of you holding your NIN"
          hint="Face and NIN must both be visible in the same photo. Hold the NIN beside your face."
          existingData={form.selfieWithNinData}
          disabled={busy || isLocked}
          onChange={(data) => update('selfieWithNinData', data)}
        />

        <div className="vf-field">
          <label>Bank name</label>
          <select
            value={form.bankName}
            onChange={(e) => update('bankName', e.target.value)}
            disabled={busy || isLocked}
          >
            <option value="">Select your bank</option>
            {BANKS.map((b) => (
              <option key={b} value={b}>{b}</option>
            ))}
          </select>
        </div>

        <div className="vf-field">
          <label>Account number</label>
          <input
            type="text"
            placeholder="10 digits"
            value={form.accountNumber}
            onChange={(e) =>
              update(
                'accountNumber',
                e.target.value.replace(/\D/g, '').slice(0, 10)
              )
            }
            disabled={busy || isLocked}
            inputMode="numeric"
            maxLength={10}
            autoComplete="off"
          />
        </div>

        <div className="vf-field">
          <label>Account name</label>
          <input
            type="text"
            placeholder="Exactly as shown by your bank"
            value={form.accountName}
            onChange={(e) => update('accountName', e.target.value)}
            disabled={busy || isLocked}
            autoComplete="off"
          />
          <span className="vf-hint">
            Must match the legal name above. Used to confirm you control this
            account.
          </span>
        </div>

        {nameCheck && !isLocked && (
          <div
            className={`vf-namecheck ${
              nameCheck.matched ? 'vf-namecheck-ok' : 'vf-namecheck-warn'
            }`}
          >
            {nameCheck.matched ? (
              <>
                <div className="vf-namecheck-title">
                  <span className="vf-namecheck-icon">✓</span>
                  Names match
                </div>
                <p>
                  Every name in <strong>{form.legalName}</strong> also appears
                  in <strong>{form.accountName}</strong>. Good.
                </p>
              </>
            ) : (
              <>
                <div className="vf-namecheck-title">
                  <span className="vf-namecheck-icon">!</span>
                  Names don&apos;t fully match
                </div>
                <p>{nameCheck.reason}</p>
                {nameCheck.missingInAccount.length > 0 && (
                  <div className="vf-namecheck-row">
                    <strong>Missing from account name:</strong>{' '}
                    {nameCheck.missingInAccount.join(', ')}
                  </div>
                )}
                {nameCheck.missingInLegal.length > 0 && (
                  <div className="vf-namecheck-row">
                    <strong>Missing from legal name:</strong>{' '}
                    {nameCheck.missingInLegal.join(', ')}
                  </div>
                )}
                <p className="vf-namecheck-footer">
                  You can still submit — an admin will review manually.
                </p>
              </>
            )}
          </div>
        )}

        {error && <div className="vf-error">{error}</div>}

        {success && (
          <div className="vf-status vf-status-green">
            <strong>✓ Submitted</strong>
            <p>Your owner identity is now pending review.</p>
          </div>
        )}

        {!isLocked && (
          <div className="vf-form-actions">
            <button
              type="submit"
              className="vf-btn vf-btn-primary vf-btn-large"
              disabled={busy}
            >
              {busy ? 'Submitting…' : 'Submit for review'}
            </button>
          </div>
        )}
      </form>
    </section>
  );
};

// ============================================================
// COMPRESSED IMAGE FIELD
// ============================================================
// Replaces the old upload widget. Instead of uploading to
// Firebase Storage, this compresses the image and stores it
// as a base64 data URL directly in the Firestore document.
// ============================================================
const CompressedImageField = ({
  label,
  hint,
  existingData,
  disabled,
  onChange,
}) => {
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [info, setInfo] = useState(null);
  const [error, setError] = useState('');
  const inputRef = useRef(null);

  const handleFile = async (file) => {
    if (!file) return;
    setError('');
    setBusy(true);
    setProgress(0);
    try {
      const result = await compressToDataUrl(file, {
        onProgress: (pct) => setProgress(pct),
      });
      setInfo({
        bytes: result.bytes,
        width: result.width,
        height: result.height,
        name: result.originalName,
      });
      onChange(result.dataUrl);
    } catch (err) {
      setError(err.message || 'Could not process the image.');
    } finally {
      setBusy(false);
      setProgress(0);
    }
  };

  const handleRemove = () => {
    onChange('');
    setInfo(null);
    setError('');
    if (inputRef.current) inputRef.current.value = '';
  };

  return (
    <div className={`iu-widget ${existingData ? 'has-image' : ''} ${error ? 'error' : ''}`}>
      <div>
        <div className="iu-label">{label}</div>
        <div className="iu-hint">{hint}</div>
      </div>

      {existingData && !busy && (
        <div className="iu-preview">
          <img src={existingData} alt={label} className="iu-preview-img" />
          <div className="iu-preview-info">
            <div className="iu-preview-name">Attached ✓</div>
            {info && (
              <div className="iu-preview-meta">
                {info.width}×{info.height}px · {formatBytes(info.bytes)} compressed
              </div>
            )}
            <div className="iu-preview-meta">
              Stored securely with your verification.
            </div>
            <div className="iu-preview-actions">
              <button
                type="button"
                className="iu-btn iu-btn-ghost"
                onClick={() => inputRef.current?.click()}
                disabled={disabled}
              >
                Replace
              </button>
              <button
                type="button"
                className="iu-btn iu-btn-danger"
                onClick={handleRemove}
                disabled={disabled}
              >
                Remove
              </button>
            </div>
          </div>
        </div>
      )}

      {!existingData && !busy && (
        <div
          className="iu-drop"
          role="button"
          tabIndex={0}
          onClick={() => !disabled && inputRef.current?.click()}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              inputRef.current?.click();
            }
          }}
          onDrop={(e) => {
            e.preventDefault();
            if (disabled) return;
            const file = e.dataTransfer?.files?.[0];
            if (file) handleFile(file);
          }}
          onDragOver={(e) => e.preventDefault()}
          style={{ cursor: disabled ? 'not-allowed' : 'pointer' }}
        >
          <div className="iu-drop-icon">
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 4v16M4 12h16" strokeLinecap="round" />
            </svg>
          </div>
          <div className="iu-drop-title">Click to attach</div>
          <div className="iu-drop-sub">or drag and drop a photo here</div>
          <div className="iu-drop-sub" style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
            Compressed automatically · JPG · PNG · WEBP · HEIC
          </div>
        </div>
      )}

      {busy && (
        <div className="iu-progress">
          <div className="iu-progress-head">
            <span>Compressing…</span>
            <span>{progress}%</span>
          </div>
          <div className="iu-progress-track">
            <div className="iu-progress-fill" style={{ width: `${progress}%` }} />
          </div>
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={(e) => handleFile(e.target.files?.[0])}
        disabled={disabled || busy}
      />

      {error && <div className="iu-error">{error}</div>}
    </div>
  );
};

export default OwnerVerificationStep;