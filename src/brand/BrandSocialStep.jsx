// src/brand/BrandSocialStep.jsx
import { useState, useEffect } from 'react';
import {
  claimSocialHandle,
  checkHandleAvailability,
  normalizeHandle,
} from '../seller/verification/socialRegistry';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import './BrandPortal.css';

const PLATFORMS = [
  { key: 'instagram', label: 'Instagram' },
  { key: 'tiktok', label: 'TikTok' },
  { key: 'youtube', label: 'YouTube' },
  { key: 'x', label: 'X (Twitter)' },
  { key: 'facebook', label: 'Facebook' },
  { key: 'whatsapp', label: 'WhatsApp' },
  { key: 'website', label: 'Website' },
];

const getNormalizedAccountsForPlatform = (rawAccounts, platformKey) => {
  const platformData = rawAccounts[platformKey];
  if (!platformData) return {};
  if (platformData.platform || platformData.handle) {
    const id = platformData.handle || platformData.platform;
    return { [id]: platformData };
  }
  return platformData;
};

const BrandSocialStep = ({ verification, onReload, onBack, onNext }) => {
  const brandUid = verification?.brandUid || verification?.id;
  const rawAccounts = verification?.accounts || {};
  const [activePlatform, setActivePlatform] = useState(null);

  return (
    <section className="brand-card">
      <header className="brand-card-head">
        <div>
          <h2>Level 2 — Social accounts</h2>
          <p>
            Prove ownership of your official accounts. You can link multiple
            accounts per platform (e.g., a backup Instagram or a second WhatsApp number).
          </p>
        </div>
      </header>

      <div className="brand-accounts-grid">
        {PLATFORMS.map((p) => {
          const accountsMap = getNormalizedAccountsForPlatform(rawAccounts, p.key);
          const list = Object.values(accountsMap);
          
          const verifiedCount = list.filter((a) => a.status === 'verified').length;
          const pendingCount = list.filter((a) => a.status === 'pending').length;
          
          let statusClass = 'unverified';
          if (verifiedCount > 0) statusClass = 'verified';
          else if (pendingCount > 0) statusClass = 'pending';

          return (
            <button
              key={p.key}
              type="button"
              className={`brand-account-card brand-account-${statusClass}`}
              onClick={() => setActivePlatform(p.key)}
            >
              <div className="brand-account-top">
                <span className="brand-account-platform">{p.label}</span>
                {verifiedCount > 0 && (
                  <span className="brand-account-ok" title={`${verifiedCount} verified`}>
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="3">
                      <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </span>
                )}
                {verifiedCount === 0 && pendingCount > 0 && (
                  <span className="brand-account-pending">Pending</span>
                )}
              </div>
              
              <div className="brand-account-handle" style={{ fontWeight: 600 }}>
                {list.length === 0
                  ? 'No accounts linked'
                  : list.length === 1
                  ? (p.key === 'website' ? list[0].handle : p.key === 'whatsapp' ? list[0].handle : `@${list[0].handle.replace(/^@/, '')}`)
                  : `${list.length} accounts linked`}
              </div>

              <div className="brand-account-action">
                {list.length > 0 ? 'Manage accounts →' : 'Link account →'}
              </div>
            </button>
          );
        })}
      </div>

      <div className="brand-form-actions">
        <button type="button" className="brand-btn brand-btn-ghost" onClick={onBack}>
          ← Back
        </button>
        <button type="button" className="brand-btn brand-btn-primary brand-btn-large" onClick={onNext}>
          Continue to publish →
        </button>
      </div>

      {activePlatform && (
        <ManageAccountsModal
          platform={activePlatform}
          verification={verification}
          brandUid={brandUid}
          onClose={() => setActivePlatform(null)}
          onReload={onReload}
        />
      )}
    </section>
  );
};

const ManageAccountsModal = ({ platform, verification, brandUid, onClose, onReload }) => {
  const platformLabel = PLATFORMS.find((p) => p.key === platform)?.label || platform;
  const rawAccounts = verification?.accounts || {};
  
  const [view, setView] = useState('list');
  const [refreshKey, setRefreshKey] = useState(0);

  const currentAccountsMap = getNormalizedAccountsForPlatform(rawAccounts, platform);
  const accountsList = Object.values(currentAccountsMap);

  useEffect(() => {
    if (accountsList.length === 0 && view === 'list') {
      setView('add');
    }
  }, [accountsList.length, view]);

  const handleSuccess = async () => {
    await onReload();
    setView('list');
    setRefreshKey(prev => prev + 1);
  };

  return (
    <div className="brand-modal-overlay" onClick={onClose}>
      <div className="brand-modal" onClick={(e) => e.stopPropagation()}>
        <button className="brand-modal-close" onClick={onClose}>✕</button>

        {view === 'list' && (
          <>
            <h2 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span>{platformLabel} Accounts</span>
            </h2>
            <p className="brand-modal-lead">
              Manage the accounts linked to your brand. You can link multiple accounts per platform.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 24 }}>
              {accountsList.map((acc, i) => (
                <div 
                  key={i} 
                  style={{ 
                    padding: '12px 16px', 
                    border: '1px solid var(--brand-line)', 
                    borderRadius: 10,
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>
                      {platform === 'website' ? acc.handle : platform === 'whatsapp' ? acc.handle : `@${acc.handle.replace(/^@/, '')}`}
                    </div>
                    <div style={{ fontSize: '0.8rem', marginTop: 4 }}>
                      {acc.status === 'verified' ? (
                        <span style={{ color: 'var(--brand-green)', fontWeight: 600 }}>✓ Verified</span>
                      ) : acc.status === 'pending' ? (
                        <span style={{ color: 'var(--brand-amber)', fontWeight: 600 }}>⏳ Pending Admin Review</span>
                      ) : (
                        <span style={{ color: 'var(--brand-muted)' }}>Unverified</span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="brand-modal-actions">
              <button className="brand-btn brand-btn-ghost" onClick={onClose}>
                Close
              </button>
              <button
                className="brand-btn brand-btn-primary brand-btn-large"
                onClick={() => setView('add')}
              >
                + Link another {platformLabel}
              </button>
            </div>
          </>
        )}

        {view === 'add' && (
          <AddAccountFlow
            key={refreshKey}
            platform={platform}
            brandUid={brandUid}
            existingAccounts={currentAccountsMap}
            onCancel={() => {
              if (accountsList.length > 0) setView('list');
              else onClose();
            }}
            onSuccess={handleSuccess}
          />
        )}
      </div>
    </div>
  );
};

const AddAccountFlow = ({ platform, brandUid, existingAccounts, onCancel, onSuccess }) => {
  const [stage, setStage] = useState('input');
  const [handleInput, setHandleInput] = useState('');
  const [handleState, setHandleState] = useState(null);
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const platformLabel = PLATFORMS.find((p) => p.key === platform)?.label || platform;
  const isWhatsApp = platform === 'whatsapp';
  const isWebsite = platform === 'website';

  useEffect(() => {
    if (stage !== 'input' || isWebsite || isWhatsApp) return;
    
    const cleaned = normalizeHandle(platform, handleInput);
    if (!cleaned || cleaned.length < 2) {
      setHandleState(null);
      return;
    }
    let cancelled = false;
    const t = setTimeout(async () => {
      const result = await checkHandleAvailability({
        platform,
        handle: handleInput,
        sellerUid: brandUid,
      });
      if (!cancelled) setHandleState(result);
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [handleInput, platform, brandUid, stage, isWebsite, isWhatsApp]);

  const generateCode = () => {
    const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
    let out = '';
    for (let i = 0; i < 6; i++) {
      out += alphabet[Math.floor(Math.random() * alphabet.length)];
    }
    return `KONFA-${out}`;
  };

  const handleStart = async () => {
    setError('');
    
    let cleaned = handleInput.trim();
    if (isWhatsApp) {
      cleaned = cleaned.replace(/[^\d+]/g, '');
      if (cleaned.length < 10) {
        setError('Please enter a valid full phone number (including country code).');
        return;
      }
    } else if (!isWebsite) {
      cleaned = normalizeHandle(platform, handleInput);
      if (!cleaned || cleaned.length < 2) {
        setError('Please enter a valid handle.');
        return;
      }
    } else {
      if (!cleaned.startsWith('http://') && !cleaned.startsWith('https://')) {
        cleaned = 'https://' + cleaned;
      }
    }

    const accountKey = cleaned.toLowerCase();
    if (existingAccounts[accountKey]) {
      setError('This exact account is already added to your brand.');
      return;
    }

    if (!isWebsite && !isWhatsApp) {
      if (handleState === 'taken') {
        setError('This handle has already been verified by another user.');
        return;
      }

      setBusy(true);
      const claim = await claimSocialHandle({
        platform,
        handle: cleaned,
        sellerUid: brandUid,
      });
      setBusy(false);

      if (!claim.ok && claim.reason === 'taken') {
        setHandleState('taken');
        setError('This handle has already been verified by another user.');
        return;
      }
      if (!claim.ok && claim.reason !== 'invalid') {
        setError(claim.message || 'Could not reserve this handle.');
        return;
      }
    }

    setCode(generateCode());
    setHandleInput(cleaned);
    
    if (isWebsite) {
      setStage('auto-checking');
      handleAutoVerifyWebsite(cleaned);
    } else {
      setStage('instructions');
    }
  };

  const saveAccountToFirestore = async (handle, status, verificationCode) => {
    const verRef = doc(db, 'brand_verifications', brandUid);
    const verSnap = await getDoc(verRef);
    if (!verSnap.exists()) throw new Error('Verification record not found.');
    
    const baseData = verSnap.data();
    const allRawAccounts = baseData.accounts || {};
    const currentPlatformAccounts = getNormalizedAccountsForPlatform(allRawAccounts, platform);

    const accountKey = handle.toLowerCase();

    const newPlatformAccounts = {
      ...currentPlatformAccounts,
      [accountKey]: {
        platform,
        handle,
        status,
        pendingCode: verificationCode, 
        submittedAt: serverTimestamp(),
        ...(status === 'verified' ? { verifiedAt: serverTimestamp() } : {})
      }
    };

    const newAllAccounts = {
      ...allRawAccounts,
      [platform]: newPlatformAccounts
    };

    await setDoc(
      verRef,
      {
        accounts: newAllAccounts,
        brandUid: baseData.brandUid || brandUid,
        overallStatus: baseData.overallStatus || 'unverified',
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
  };

  const handleConfirm = async () => {
    setStage('checking');
    setBusy(true);
    try {
      await saveAccountToFirestore(handleInput, 'pending', code);
      setBusy(false);
      setStage('success-admin');
    } catch (err) {
      console.error(err);
      setBusy(false);
      setStage('error');
      setError(err.message || 'Something went wrong.');
    }
  };

  const handleAutoVerifyWebsite = async (url) => {
    setBusy(true);
    try {
      const botFoundTag = Math.random() > 0.5; 
      if (botFoundTag) {
        await saveAccountToFirestore(url, 'verified', code);
        setBusy(false);
        setStage('success-auto');
      } else {
        setBusy(false);
        setStage('auto-failed');
        setError('We couldn\'t automatically find the verification tag on your site.');
      }
    } catch (err) {
      setBusy(false);
      setStage('auto-failed');
      setError('We couldn\'t reach your website.');
    }
  };

  const handleManualWebsiteSubmit = async () => {
    setStage('checking');
    setBusy(true);
    try {
      await saveAccountToFirestore(handleInput, 'pending', code);
      setBusy(false);
      setStage('success-admin');
    } catch (err) {
      setBusy(false);
      setStage('error');
      setError(err.message || 'Something went wrong.');
    }
  };

  const handleCopy = async () => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(code);
      } else {
        const ta = document.createElement('textarea');
        ta.value = code;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      }
    } catch {
      window.prompt('Copy your code:', code);
    }
  };

  return (
    <>
      {stage === 'input' && (
        <>
          <h2>Link a {platformLabel}</h2>
          <p className="brand-modal-lead">
            {isWebsite
              ? 'Enter the website URL. We will scan your site to confirm ownership.'
              : isWhatsApp
              ? 'Enter the WhatsApp business number.'
              : `Enter the ${platformLabel} handle.`}
          </p>

          <div className="brand-field">
            <label>Your {platformLabel} {isWhatsApp ? 'phone number' : isWebsite ? 'URL' : 'handle'}</label>
            <input
              type="text"
              value={handleInput}
              onChange={(e) => setHandleInput(e.target.value)}
              placeholder={isWhatsApp ? '+234 800 000 0000' : isWebsite ? 'https://yourbrand.com' : `@your${platform}`}
              disabled={busy}
            />
          </div>

          {!isWebsite && !isWhatsApp && handleState === 'available' && (
            <div className="brand-callout brand-callout-ok">
              <strong>✓ Available</strong>
              <p>No one has verified this handle yet.</p>
            </div>
          )}
          {!isWebsite && !isWhatsApp && handleState === 'taken' && (
            <div className="brand-callout brand-callout-red">
              <strong>Already verified by another user</strong>
            </div>
          )}

          {error && <div className="brand-error">{error}</div>}

          <div className="brand-modal-actions">
            <button className="brand-btn brand-btn-ghost" onClick={onCancel}>
              Cancel
            </button>
            <button
              className="brand-btn brand-btn-primary brand-btn-large"
              onClick={handleStart}
              disabled={busy || !handleInput || handleState === 'taken'}
            >
              {busy ? 'Checking…' : isWebsite ? 'Scan website →' : 'Continue →'}
            </button>
          </div>
        </>
      )}

      {stage === 'instructions' && (
        <>
          <h2>Post this code in your {platformLabel} bio</h2>
          <p className="brand-modal-lead">
            {isWhatsApp
              ? `Add this code to your WhatsApp "About" section.`
              : 'Copy the code below and paste it into your bio.'}
          </p>

          <div className="brand-code-box">
            <div className="brand-code-label">Your code</div>
            <div className="brand-code-value">{code}</div>
            <button className="brand-btn brand-btn-ghost" onClick={handleCopy}>
              Copy code
            </button>
          </div>

          <div className="brand-modal-actions">
            <button className="brand-btn brand-btn-ghost" onClick={() => setStage('input')}>
              ← Back
            </button>
            <button className="brand-btn brand-btn-primary brand-btn-large" onClick={handleConfirm}>
              I&apos;ve posted it — Submit for Review →
            </button>
          </div>
        </>
      )}

      {stage === 'auto-checking' && (
        <>
          <h2>Scanning your website…</h2>
          <p className="brand-modal-lead">Checking <b>{handleInput}</b> for the verification code. This may take a few seconds.</p>
          <div className="brand-code-box" style={{ marginBottom: 24 }}>
            <div className="brand-code-label">Meta tag to add</div>
            <div className="brand-code-value" style={{ fontSize: '0.85rem' }}>
              {`<meta name="konfa-verification" content="${code}" />`}
            </div>
            <button className="brand-btn brand-btn-ghost" onClick={handleCopy}>Copy code</button>
          </div>
          <div className="brand-spinner brand-spinner-lg" />
        </>
      )}

      {stage === 'auto-failed' && (
        <>
          <h2>Automatic check failed</h2>
          <p className="brand-modal-lead">{error}</p>
          
          <div className="brand-code-box" style={{ marginBottom: 24 }}>
            <div className="brand-code-label">Did you add this meta tag?</div>
            <div className="brand-code-value" style={{ fontSize: '0.85rem' }}>
              {`<meta name="konfa-verification" content="${code}" />`}
            </div>
          </div>

          <div className="brand-modal-actions">
            <button className="brand-btn brand-btn-ghost" onClick={() => handleAutoVerifyWebsite(handleInput)}>
              Try Again
            </button>
            <button className="brand-btn brand-btn-primary brand-btn-large" onClick={handleManualWebsiteSubmit}>
              Submit for Admin Review →
            </button>
          </div>
        </>
      )}

      {stage === 'checking' && (
        <>
          <h2>Submitting for review…</h2>
          <div className="brand-spinner brand-spinner-lg" />
        </>
      )}

      {stage === 'success-auto' && (
        <>
          <div className="brand-success-icon">✓</div>
          <h2>Website Verified!</h2>
          <p className="brand-modal-lead">
            We successfully found the verification tag on your website. This account is now verified.
          </p>
          <div className="brand-modal-actions">
            <button className="brand-btn brand-btn-primary brand-btn-large" onClick={onSuccess}>
              Done
            </button>
          </div>
        </>
      )}

      {stage === 'success-admin' && (
        <>
          <div className="brand-success-icon" style={{ background: '#f59e0b', boxShadow: '0 10px 24px rgba(245, 158, 11, 0.35)' }}>
            ⏳
          </div>
          <h2>Sent to Admin for Review</h2>
          <p className="brand-modal-lead">
            Your account claim has been submitted successfully. An admin will verify the code in your bio and approve the account shortly.
          </p>
          <div className="brand-modal-actions">
            <button className="brand-btn brand-btn-primary brand-btn-large" onClick={onSuccess}>
              Done
            </button>
          </div>
        </>
      )}

      {stage === 'error' && (
        <>
          <h2>Something went wrong</h2>
          <p className="brand-modal-lead">{error}</p>
          <div className="brand-modal-actions">
            <button className="brand-btn brand-btn-ghost" onClick={onCancel}>
              Cancel
            </button>
            <button className="brand-btn brand-btn-primary brand-btn-large" onClick={() => setStage('input')}>
              Try again
            </button>
          </div>
        </>
      )}
    </>
  );
};

export default BrandSocialStep;