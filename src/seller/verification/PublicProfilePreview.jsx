// src/seller/verification/PublicProfilePreview.jsx
import { useEffect, useMemo, useState } from 'react';
import { savePublicProfile } from './verificationFlowApi';
import { copyToClipboard } from '../../utils/clipboard';

const PublicProfilePreview = ({
  verification,
  onReload,
  onBack,
  onOpenQr,
}) => {
  const publicProfile = verification?.publicProfile || {};
  const slug = verification?.publicSlug;
  const owner = verification?.owner || {};
  const business = verification?.business || {};
  const accounts = verification?.accounts || {};

  const [form, setForm] = useState({
    displayName:
      publicProfile.displayName ||
      business.businessName ||
      owner.legalName ||
      '',
    category: publicProfile.category || '',
    description: publicProfile.description || '',
    enabled: publicProfile.enabled || false,
    showOwnerName: publicProfile.showOwnerName !== false,
    showBusiness: publicProfile.showBusiness !== false,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [savedSlug, setSavedSlug] = useState(slug || '');
  const [copyLabel, setCopyLabel] = useState('Copy link');
  const [togglingLive, setTogglingLive] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState(null);

  useEffect(() => {
    if (slug && slug !== savedSlug) setSavedSlug(slug);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  const update = (key, value) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const handleSave = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const res = await savePublicProfile(form);
      setSavedSlug(res.slug);
      setLastSavedAt(Date.now());
      await onReload();
    } catch (err) {
      setError(err.message || 'Could not save your public profile.');
    } finally {
      setBusy(false);
    }
  };

  const handleToggleLive = async () => {
    const next = !form.enabled;
    update('enabled', next);
    setTogglingLive(true);
    setError('');
    try {
      await savePublicProfile({ ...form, enabled: next });
      await onReload();
    } catch (err) {
      setError(err.message);
      update('enabled', !next);
    } finally {
      setTogglingLive(false);
    }
  };

  const handleCopy = async () => {
    if (!publicUrl) return;
    const ok = await copyToClipboard(publicUrl);
    if (ok) {
      setCopyLabel('Copied ✓');
      setTimeout(() => setCopyLabel('Copy link'), 2000);
    } else {
      window.prompt('Copy your public link manually:', publicUrl);
    }
  };

  const publicUrl = savedSlug
    ? `${window.location.origin}/s/${savedSlug}`
    : '';

  const verifiedAccounts = useMemo(
    () => Object.values(accounts).filter((a) => a.status === 'verified'),
    [accounts]
  );

  const overallStatus = verification?.overallStatus || 'unverified';

  const statusMeta = {
    fully_verified:     { label: 'Fully verified',     tone: 'green' },
    partially_verified: { label: 'Partially verified', tone: 'amber' },
    owner_verified:     { label: 'Owner verified',     tone: 'teal' },
    verified:           { label: 'Verified',           tone: 'green' },
    unverified:         { label: 'Not verified',       tone: 'slate' },
  }[overallStatus] || { label: 'Not verified', tone: 'slate' };

  // The user has verified content but hasn't turned the profile live yet.
  const needsGoLive = verifiedAccounts.length > 0 && !form.enabled;

  return (
    <section className="vf-card vf-publish-card">
      {/* =========================================================
          HEADER
          ========================================================= */}
      <header className="vf-card-head vf-publish-head">
        <div>
          <h2>Publish your public profile</h2>
          <p>
            This is what customers see when they scan your QR code. Only the
            information you toggle below will be public.
          </p>
        </div>
        <span className={`vf-publish-status vf-publish-status-${statusMeta.tone}`}>
          <span className="vf-publish-status-dot" />
          {statusMeta.label}
        </span>
      </header>

      {/* =========================================================
          FORM — profile details + privacy toggles
          ========================================================= */}
      <form
        id="vf-publish-form"
        className="vf-form"
        onSubmit={handleSave}
      >
        <div className="vf-publish-section">
          <div className="vf-publish-section-label">Profile details</div>

          <div className="vf-field">
            <label>Display name</label>
            <input
              type="text"
              placeholder="e.g. Blessing Phones"
              value={form.displayName}
              onChange={(e) => update('displayName', e.target.value)}
              disabled={busy}
            />
            <span className="vf-hint">
              The name customers will see at the top of your profile.
            </span>
          </div>

          <div className="vf-row-2">
            <div className="vf-field">
              <label>Category</label>
              <input
                type="text"
                placeholder="e.g. Electronics retailer"
                value={form.category}
                onChange={(e) => update('category', e.target.value)}
                disabled={busy}
              />
            </div>
          </div>

          <div className="vf-field">
            <label>Short description</label>
            <textarea
              rows="3"
              placeholder="What you sell, where you operate, anything customers should know."
              value={form.description}
              onChange={(e) => update('description', e.target.value)}
              disabled={busy}
            />
          </div>
        </div>

        {/* ---------- Privacy toggles ---------- */}
        <div className="vf-publish-section">
          <div className="vf-publish-section-label">What customers see</div>

          <div className="vf-toggles">
            <label className="vf-toggle-check">
              <input
                type="checkbox"
                checked={form.showOwnerName}
                onChange={(e) => update('showOwnerName', e.target.checked)}
                disabled={busy}
              />
              <span>
                <strong>Show my verified name</strong>
                <em>The legal name tied to your NIN.</em>
              </span>
            </label>

            <label className="vf-toggle-check">
              <input
                type="checkbox"
                checked={form.showBusiness}
                onChange={(e) => update('showBusiness', e.target.checked)}
                disabled={busy}
              />
              <span>
                <strong>Show business details</strong>
                <em>Address and CAC status (if registered).</em>
              </span>
            </label>
          </div>

          <div className="vf-status vf-status-info">
            <strong>Your private data stays private</strong>
            <p>
              Your NIN, bank account, and uploaded documents are never shown
              publicly. Only the items above are visible on your public page.
            </p>
          </div>
        </div>

        {/* No action buttons here — they live below the preview. */}
      </form>

      {/* =========================================================
          PUBLIC LINK + LIVE TOGGLE
          ========================================================= */}
      {savedSlug && (
        <div className="vf-public-box">
          <div className="vf-public-box-head">
            <div>
              <h3>Your public link</h3>
              <p className="vf-public-box-sub">
                {form.enabled
                  ? 'Your profile is live. Share it anywhere.'
                  : 'Your profile is private. Turn it on to share.'}
              </p>
            </div>
            <button
              type="button"
              className={`vf-toggle-switch ${form.enabled ? 'on' : ''}`}
              onClick={handleToggleLive}
              disabled={busy || togglingLive}
              aria-label={form.enabled ? 'Make profile private' : 'Make profile public'}
            >
              <span className="vf-toggle-switch-knob" />
            </button>
          </div>

          <div className="vf-url-row">
            <code className="vf-url" title={publicUrl}>
              {publicUrl}
            </code>
            <div className="vf-url-actions">
              <button
                type="button"
                className="vf-btn vf-btn-ghost"
                onClick={handleCopy}
              >
                {copyLabel}
              </button>
              <button
                type="button"
                className="vf-btn vf-btn-primary"
                onClick={onOpenQr}
              >
                Get QR code
              </button>
            </div>
          </div>

          {/* Inline prompt: user has content but hasn't gone live */}
          {needsGoLive && (
            <div className="vf-golive-hint">
              <span className="vf-golive-hint-icon">!</span>
              <div>
                <strong>Your profile is not live yet</strong>
                <p>
                  Toggle the switch above to make your profile public, then
                  press <b>Save profile settings</b> below.
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* =========================================================
          PREVIEW — what customers see
          ========================================================= */}
      {verifiedAccounts.length > 0 && (
        <div className="vf-preview">
          <div className="vf-preview-head-row">
            <h3>Preview</h3>
            <span className="vf-preview-badge">Live preview</span>
          </div>

          <div className="vf-preview-card">
            {/* Masthead */}
            <div className="vf-preview-masthead">
              <div className="vf-preview-avatar">
                {(form.displayName || 'K').trim().charAt(0).toUpperCase()}
              </div>
              <div className="vf-preview-masthead-text">
                <div className="vf-preview-name">
                  {form.displayName || 'Your business name'}
                </div>
                {form.category && (
                  <div className="vf-preview-cat">{form.category}</div>
                )}
              </div>
              <div className="vf-preview-verified-pill">
                <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="3">
                  <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Verified
              </div>
            </div>

            {form.description && (
              <p className="vf-preview-description">{form.description}</p>
            )}

            {/* Verified details */}
            <div className="vf-preview-block">
              {form.showOwnerName && owner.legalName && (
                <div className="vf-preview-row">
                  <span className="vf-preview-label">Verified owner</span>
                  <span className="vf-preview-value">
                    <span className="vf-preview-icon">👤</span>
                    {owner.legalName}
                  </span>
                </div>
              )}

              {form.showBusiness && business.businessName && (
                <div className="vf-preview-row">
                  <span className="vf-preview-label">Business</span>
                  <span className="vf-preview-value">
                    <span className="vf-preview-icon">🏢</span>
                    {business.businessName}
                    {business.type === 'registered' ? (
                      <span className="vf-preview-chip">CAC verified</span>
                    ) : (
                      <span className="vf-preview-chip">Owned by verified owner</span>
                    )}
                  </span>
                </div>
              )}

              <div className="vf-preview-row vf-preview-row-accounts">
                <span className="vf-preview-label">Verified accounts</span>
                <ul className="vf-preview-accounts">
                  {verifiedAccounts.map((acc) => (
                    <li key={acc.platform}>
                      <span className={`vf-acc-pill vf-acc-${acc.platform}`}>
                        {acc.platform}
                      </span>
                      <span className="vf-preview-handle">@{acc.handle}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="vf-preview-disclaimer">
              <strong>Konfa verifies identity and account ownership.</strong>{' '}
              We do not guarantee business conduct or transactions.
            </div>
          </div>
        </div>
      )}

      {/* =========================================================
          BOTTOM ACTION BAR — back / save
          ========================================================= */}
      <div className="vf-publish-actions">
        <div className="vf-publish-actions-hint">
          {form.enabled ? (
            <>
              <span className="vf-publish-actions-dot vf-publish-actions-dot-live" />
              <span>
                Profile is <b>live</b>. Save any changes you made above.
              </span>
            </>
          ) : (
            <>
              <span className="vf-publish-actions-dot vf-publish-actions-dot-off" />
              <span>
                Toggle <b>Your public link</b> above to <b>live</b>, then save
                to publish.
              </span>
            </>
          )}
        </div>

        {error && (
          <div className="vf-error vf-publish-actions-error">{error}</div>
        )}

        {lastSavedAt && !error && (
          <div className="vf-publish-saved">
            ✓ Saved{' '}
            {new Date(lastSavedAt).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </div>
        )}

        <div className="vf-publish-actions-row">
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
            form="vf-publish-form"
            className="vf-btn vf-btn-primary vf-btn-large"
            disabled={busy}
          >
            {busy ? 'Saving…' : 'Save profile settings'}
          </button>
        </div>
      </div>
    </section>
  );
};

export default PublicProfilePreview;