// src/brand/BrandPublishStep.jsx
import { useState, useMemo, useEffect } from 'react';
import QRCode from 'qrcode';
import { saveBrandPublicProfile } from './brandVerificationApi';
import { copyToClipboard } from '../utils/clipboard';
import './BrandPortal.css';

const BrandPublishStep = ({ verification, onReload, onBack, showToast }) => {
  const publicProfile = verification?.publicProfile || {};
  const slug = verification?.publicSlug;
  const owner = verification?.owner || {};
  const accounts = verification?.accounts || {};

  const [form, setForm] = useState({
    displayName: publicProfile.displayName || verification?.brandDisplayName || '',
    category: publicProfile.category || '',
    description: publicProfile.description || '',
    enabled: publicProfile.enabled || false,
    showOwnerName: publicProfile.showOwnerName !== false,
  });

  const [busy, setBusy] = useState(false);
  const [toggleBusy, setToggleBusy] = useState(false);
  const [error, setError] = useState('');
  const [savedSlug, setSavedSlug] = useState(slug || '');
  const [copyLabel, setCopyLabel] = useState('Copy link');
  const [showQr, setShowQr] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [lastSavedAt, setLastSavedAt] = useState(null);

  // Tracks if the user has typed in the text fields but hasn't saved yet
  const [isDirty, setIsDirty] = useState(false);

  const notify = (payload) => {
    if (typeof showToast === 'function') {
      showToast(payload);
    } else {
      // eslint-disable-next-line no-console
      console.log('[brand toast]', payload);
    }
  };

  const publicUrl = savedSlug
    ? `${window.location.origin}/b/${savedSlug}`
    : '';

  useEffect(() => {
    if (slug && slug !== savedSlug) setSavedSlug(slug);
  }, [slug, savedSlug]);

  useEffect(() => {
    if (!publicUrl) return;
    QRCode.toDataURL(publicUrl, {
      width: 512,
      margin: 2,
      errorCorrectionLevel: 'H',
      color: { dark: '#0a1628', light: '#ffffff' },
    })
      .then(setQrDataUrl)
      .catch(() => setQrDataUrl(''));
  }, [publicUrl]);

  const update = (k, v) => {
    setForm((p) => ({ ...p, [k]: v }));
    setIsDirty(true);
  };

  const verifiedAccounts = useMemo(
    () => Object.values(accounts).filter((a) => a.status === 'verified'),
    [accounts]
  );

  const brandIsVerified = owner?.status === 'verified';

  // ---------------------------------------------------------
  // SAVE TEXT CHANGES
  // ---------------------------------------------------------
  const handleSave = async (e) => {
    e.preventDefault();
    if (busy) return;

    setBusy(true);
    setError('');

    try {
      const res = await saveBrandPublicProfile(form);
      setSavedSlug(res.slug);
      setLastSavedAt(Date.now());
      setIsDirty(false);

      if (res.published) {
        notify({
          kind: 'success',
          title: '✓ Profile saved and live',
          message: 'Your changes are now live on your public brand page.',
        });
      } else {
        notify({
          kind: 'success',
          title: '✓ Profile saved',
          message: 'Your brand details were updated (page is still private).',
        });
      }

      await onReload();
    } catch (err) {
      const msg = err?.message || 'Could not save your public profile.';
      setError(msg);
      notify({ kind: 'error', title: '✕ Save failed', message: msg });
    } finally {
      setBusy(false);
    }
  };

  // ---------------------------------------------------------
  // TOGGLE LIVE STATUS (Instant Save)
  // ---------------------------------------------------------
  const handleToggleLive = async () => {
    if (toggleBusy || busy) return;

    const next = !form.enabled;
    setToggleBusy(true);
    setError('');

    // Optimistic UI update
    setForm((prev) => ({ ...prev, enabled: next }));

    try {
      // We pass the current form state so the toggle doesn't wipe text changes
      const res = await saveBrandPublicProfile({ ...form, enabled: next });
      
      // Artificial delay so the user sees the spring animation before a "not verified" rejection
      if (next && !res.published) {
        await new Promise((resolve) => setTimeout(resolve, 400));
      }

      setForm((prev) => ({ ...prev, enabled: !!res.published }));
      setSavedSlug(res.slug);

      // NOTE: We do NOT set isDirty to false here. 
      // Toggling does not save the text inputs.

      if (res.published) {
        notify({
          kind: 'success',
          title: '✓ You’re live',
          message: 'Your page is now visible. (Remember to save your text edits).',
        });
      } else if (next) {
        notify({
          kind: 'warning',
          title: '⚠ Can’t go live yet',
          message: brandIsVerified
            ? 'The page was saved but could not be enabled. Please try again.'
            : 'Your brand isn’t verified yet. An admin must approve your identity before your page can go live. The switch was reset.',
        });
      } else {
        notify({
          kind: 'success',
          title: '✓ Profile set to private',
          message: 'Your public brand page is no longer visible.',
        });
      }
    } catch (err) {
      setForm((prev) => ({ ...prev, enabled: !next }));
      const msg = err?.message || 'Could not update live status.';
      setError(msg);
      notify({ kind: 'error', title: '✕ Could not update live status', message: msg });
    } finally {
      setToggleBusy(false);
    }
  };

  const handleCopy = async () => {
    if (!publicUrl) return;
    const ok = await copyToClipboard(publicUrl);
    if (ok) {
      setCopyLabel('Copied ✓');
      setTimeout(() => setCopyLabel('Copy link'), 2000);
    } else {
      window.prompt('Copy your public link:', publicUrl);
    }
  };

  const needsGoLive = verifiedAccounts.length > 0 && !form.enabled;

  return (
    <section className="brand-card">
      <header className="brand-card-head">
        <div>
          <h2>Level 3 — Publish your brand page</h2>
          <p>
            This is what people see when they open your Konfa verification
            link or scan your QR code.
          </p>
        </div>
      </header>

      <form id="brand-publish-form" className="brand-form" onSubmit={handleSave}>
        <div className="brand-field">
          <label>Display name</label>
          <input
            type="text"
            value={form.displayName}
            onChange={(e) => update('displayName', e.target.value)}
            disabled={busy}
          />
          <span className="brand-hint">
            The name people will see at the top of your verified page.
          </span>
        </div>

        <div className="brand-field">
          <label>Category</label>
          <input
            type="text"
            placeholder="e.g. Gospel artist, Event, Ministry"
            value={form.category}
            onChange={(e) => update('category', e.target.value)}
            disabled={busy}
          />
        </div>

        <div className="brand-field">
          <label>Short description</label>
          <textarea
            rows="3"
            placeholder="What you do, where people can reach you, anything important."
            value={form.description}
            onChange={(e) => update('description', e.target.value)}
            disabled={busy}
          />
        </div>

        <label className="brand-check">
          <input
            type="checkbox"
            checked={form.showOwnerName}
            onChange={(e) => update('showOwnerName', e.target.checked)}
            disabled={busy}
          />
          <span>
            Also display my verified legal name on the public page
            <span
              className="brand-hint-inline"
              style={{ display: 'block', marginTop: 4 }}
            >
              Off by default. When off, your page shows only your brand name
              with a &ldquo;✓ Owner verified&rdquo; badge.
            </span>
          </span>
        </label>
      </form>

      {savedSlug && (
        <div className="brand-public-box">
          <div className="brand-public-head">
            <div>
              <h3>Your brand link</h3>
              <p>
                {form.enabled ? 'Live. Share it anywhere.' : 'Private. Turn it on to share.'}
              </p>
            </div>
            <button
              type="button"
              className={`brand-toggle ${form.enabled ? 'on' : ''}`}
              onClick={handleToggleLive}
              disabled={toggleBusy || busy}
              aria-pressed={form.enabled}
              aria-label={form.enabled ? 'Turn public page off' : 'Turn public page on'}
            >
              <span className="brand-toggle-knob" />
            </button>
          </div>

          <div className="brand-url-row">
            <code className="brand-url">{publicUrl}</code>
            <div className="brand-url-actions">
              <button
                type="button"
                className="brand-btn brand-btn-ghost"
                onClick={handleCopy}
              >
                {copyLabel}
              </button>
              <button
                type="button"
                className="brand-btn brand-btn-primary"
                onClick={() => setShowQr(true)}
              >
                Show QR
              </button>
            </div>
          </div>

          {/* WARNING: Not live yet */}
          {needsGoLive && !isDirty && (
            <div className="brand-callout brand-callout-amber" style={{ marginTop: 16 }}>
              <strong>Not live yet</strong>
              <p>
                Toggle the switch above to make your page public. Toggling saves automatically.
              </p>
            </div>
          )}

          {/* WARNING: Unsaved text changes (HIGH PRIORITY) */}
          {isDirty && (
            <div className="brand-callout brand-callout-amber" style={{ marginTop: 16, border: '2px solid var(--brand-amber)' }}>
              <strong style={{ fontSize: '1rem' }}>⚠ You have unsaved text changes</strong>
              <p>
                {form.enabled 
                  ? "Your page is live, but your latest text edits are NOT visible yet." 
                  : "Your text edits have not been saved."} 
                {' '}You must click <b>Save profile</b> at the bottom of the page to apply them.
              </p>
            </div>
          )}
        </div>
      )}

      {verifiedAccounts.length > 0 && (
        <div className="brand-preview">
          <h3>Preview</h3>
          <div className="brand-preview-card">
            <div className="brand-preview-head">
              <div className="brand-preview-avatar">
                {(form.displayName || 'B').charAt(0).toUpperCase()}
              </div>
              <div>
                <div className="brand-preview-name">
                  {form.displayName || 'Your brand'}
                </div>
                {form.category && (
                  <div className="brand-preview-cat">{form.category}</div>
                )}
              </div>
            </div>
            {form.description && (
              <p className="brand-preview-desc">{form.description}</p>
            )}
            {form.showOwnerName && owner.legalName && (
              <div className="brand-preview-row">
                <span>Verified owner</span>
                <strong>{owner.legalName}</strong>
              </div>
            )}
            <div className="brand-preview-accounts">
              <span>Verified accounts</span>
              <ul>
                {verifiedAccounts.map((a) => (
                  <li key={a.platform}>
                    <span className={`brand-acc-pill brand-acc-${a.platform}`}>
                      {a.platform}
                    </span>
                    @{a.handle?.replace(/^@/, '')}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      <div className="brand-publish-actions">
        {error && <div className="brand-error">{error}</div>}
        
        <div className="brand-form-actions">
          <button
            type="button"
            className="brand-btn brand-btn-ghost"
            onClick={onBack}
            disabled={busy}
          >
            ← Back
          </button>

          <button
            type="submit"
            form="brand-publish-form"
            className={`brand-btn brand-btn-large ${isDirty ? 'brand-btn-warning' : 'brand-btn-primary'}`}
            disabled={busy || !isDirty}
            style={{ 
              opacity: isDirty ? 1 : 0.5,
              minWidth: '180px'
            }}
          >
            {busy ? 'Saving…' : isDirty ? 'Save changes to apply ⚠' : '✓ Saved'}
          </button>
        </div>
      </div>

      {showQr && (
        <BrandQrModal
          slug={savedSlug}
          displayName={form.displayName}
          qrDataUrl={qrDataUrl}
          publicUrl={publicUrl}
          onClose={() => setShowQr(false)}
        />
      )}
    </section>
  );
};

const BrandQrModal = ({ slug, displayName, qrDataUrl, publicUrl, onClose }) => (
  <div className="brand-modal-overlay" onClick={onClose}>
    <div className="brand-modal" onClick={(e) => e.stopPropagation()}>
      <button className="brand-modal-close" onClick={onClose}>
        ✕
      </button>
      <h2>Share your brand QR</h2>
      <p className="brand-modal-lead">
        Put this QR on your streams, event slides, posters, or in your bio so
        anyone can verify they&apos;re dealing with the real{' '}
        <strong>{displayName || 'brand'}</strong>.
      </p>
      {qrDataUrl ? (
        <img src={qrDataUrl} alt="Brand QR" className="brand-qr-img" />
      ) : (
        <div className="brand-spinner brand-spinner-lg" />
      )}
      <code className="brand-url">{publicUrl}</code>
      <div className="brand-modal-actions">
        <button
          className="brand-btn brand-btn-ghost"
          onClick={async () => {
            if (navigator.clipboard?.writeText) {
              await navigator.clipboard.writeText(publicUrl);
            } else {
              window.prompt('Copy link:', publicUrl);
            }
          }}
        >
          Copy link
        </button>
        <button
          className="brand-btn brand-btn-primary"
          onClick={() => {
            if (!qrDataUrl) return;
            const a = document.createElement('a');
            a.href = qrDataUrl;
            a.download = `konfa-brand-${slug}.png`;
            a.click();
          }}
        >
          Download PNG
        </button>
      </div>
    </div>
  </div>
);

export default BrandPublishStep;