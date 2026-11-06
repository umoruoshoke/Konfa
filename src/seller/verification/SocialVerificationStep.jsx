// src/seller/verification/SocialVerificationStep.jsx
import { useState, useEffect } from 'react';
import { claimSocialHandle, checkHandleAvailability, normalizeHandle } from './socialRegistry';
// 🔑 Import Timestamp to fix the array error
import { doc, getDoc, setDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
import { db } from '../../firebase';
import { SUPPORTED_PLATFORMS } from './sellerVerificationApi';

import '../../brand/BrandPortal.css';
import './sellerVerification.css';

const SocialVerificationStep = ({ verification, onReload, onBack, onNext }) => {
  const sellerUid = verification?.sellerUid || verification?.id;
  const rawAccounts = verification?.accounts || {};
  const [activePlatform, setActivePlatform] = useState(null);

  return (
    <section className="brand-card">
      <header className="brand-card-head">
        <div>
          <h2>Level 3 — Social accounts</h2>
          <p>
            Prove ownership of your official accounts. You can link multiple
            accounts per platform (e.g., a backup Instagram or a second WhatsApp number).
          </p>
        </div>
      </header>

      <div className="brand-accounts-grid">
        {SUPPORTED_PLATFORMS.map((p) => {
          const platformData = rawAccounts[p.key] || [];
          const list = Array.isArray(platformData) 
            ? platformData 
            : Object.values(platformData).filter(a => a && a.handle);
          
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
                  ? (p.key === 'website' || p.key === 'whatsapp' ? list[0].handle : `@${list[0].handle.replace(/^@/, '')}`)
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
          sellerUid={sellerUid}
          onClose={() => setActivePlatform(null)}
          onReload={onReload}
        />
      )}
    </section>
  );
};

const ManageAccountsModal = ({ platform, verification, sellerUid, onClose, onReload }) => {
  const platformLabel = SUPPORTED_PLATFORMS.find((p) => p.key === platform)?.label || platform;
  const rawAccounts = verification?.accounts || {};
  
  const [view, setView] = useState('list');
  const [refreshKey, setRefreshKey] = useState(0);

  const platformData = rawAccounts[platform] || [];
  const accountsList = Array.isArray(platformData) 
    ? platformData 
    : Object.values(platformData).filter(a => a && a.handle);

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
              Manage the accounts linked to your business. You can link multiple accounts per platform.
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
                      {platform === 'website' || platform === 'whatsapp' ? acc.handle : `@${acc.handle.replace(/^@/, '')}`}
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
            sellerUid={sellerUid}
            existingAccounts={accountsList}
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

const AddAccountFlow = ({ platform, sellerUid, existingAccounts, onCancel, onSuccess }) => {
  const [stage, setStage] = useState('input');
  const [handleInput, setHandleInput] = useState('');
  const [handleState, setHandleState] = useState(null);
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const platformLabel = SUPPORTED_PLATFORMS.find((p) => p.key === platform)?.label || platform;
  const isWhatsApp = platform === 'whatsapp';
  const isWebsite = platform === 'website';

  useEffect(() => {
    if (stage !== 'input' || isWebsite || isWhatsApp) return;
    const cleaned = normalizeHandle(platform, handleInput);
    if (!cleaned || cleaned.length < 2) { setHandleState(null); return; }
    let cancelled = false;
    const t = setTimeout(async () => {
      const result = await checkHandleAvailability({ platform, handle: handleInput, sellerUid });
      if (!cancelled) setHandleState(result);
    }, 400);
    return () => { cancelled = true; clearTimeout(t); };
  }, [handleInput, platform, sellerUid, stage, isWebsite, isWhatsApp]);

  const generateCode = () => {
    const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
    let out = '';
    for (let i = 0; i < 6; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)];
    return `KONFA-${out}`;
  };

  const handleStart = async () => {
    setError('');
    let cleaned = handleInput.trim();
    
    if (isWhatsApp) {
      cleaned = cleaned.replace(/[^\d+]/g, '');
      if (cleaned.length < 10) { setError('Please enter a valid phone number.'); return; }
    } else if (!isWebsite) {
      cleaned = normalizeHandle(platform, handleInput);
      if (!cleaned || cleaned.length < 2) { setError('Please enter a valid handle.'); return; }
      if (handleState === 'taken') { setError('This handle has already been verified by another user.'); return; }
    } else {
      if (!cleaned.startsWith('http')) cleaned = 'https://' + cleaned;
    }

    const accountKey = cleaned.toLowerCase();
    const isDuplicate = existingAccounts.some(a => a.handle.toLowerCase() === accountKey);
    if (isDuplicate) { setError('This exact account is already added.'); return; }

    if (!isWebsite && !isWhatsApp) {
      setBusy(true);
      const claim = await claimSocialHandle({ platform, handle: cleaned, sellerUid });
      setBusy(false);
      if (!claim.ok && claim.reason === 'taken') { setHandleState('taken'); setError('Already verified by another user.'); return; }
      if (!claim.ok && claim.reason !== 'invalid') { setError(claim.message); return; }
    }

    setCode(generateCode());
    setHandleInput(cleaned);
    setStage('instructions');
  };

  const saveAccountToFirestore = async (handle, status, verificationCode) => {
    const verRef = doc(db, 'seller_verifications', sellerUid);
    const verSnap = await getDoc(verRef);
    if (!verSnap.exists()) throw new Error('Record not found.');
    
    const baseData = verSnap.data();
    const allRawAccounts = baseData.accounts || {};
    
    let currentArray = allRawAccounts[platform] || [];
    if (!Array.isArray(currentArray)) {
       currentArray = Object.values(currentArray).filter(a => a && a.handle);
    }
    
    // 🔑 FIX: Use Timestamp.now() instead of serverTimestamp() inside the array
    const newAccount = {
      platform,
      handle,
      status,
      pendingCode: verificationCode,
      submittedAt: Timestamp.now(), 
      ...(status === 'verified' ? { verifiedAt: Timestamp.now() } : {})
    };

    const newArray = [...currentArray, newAccount];

    await setDoc(
      verRef,
      {
        accounts: { ...allRawAccounts, [platform]: newArray },
        sellerUid: baseData.sellerUid || sellerUid,
        overallStatus: baseData.overallStatus || 'unverified',
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
  };

  const handleConfirmPosted = async () => {
    setStage('checking'); setBusy(true); setError('');
    try {
      await saveAccountToFirestore(handleInput, 'pending', code);
      setBusy(false); 
      setStage('success-admin');
    } catch (err) {
      console.error("Firestore save error:", err);
      alert("Failed to save to database: " + err.message); 
      setBusy(false); 
      setStage('error'); 
      setError(err.message || 'Error saving account.');
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
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
            {isWebsite ? 'Enter URL.' : isWhatsApp ? 'Enter WhatsApp number.' : `Enter handle.`}
          </p>
          <div className="brand-field">
            <label>Your {platformLabel} {isWhatsApp ? 'number' : isWebsite ? 'URL' : 'handle'}</label>
            <input type="text" value={handleInput} onChange={(e) => setHandleInput(e.target.value)} disabled={busy} />
          </div>
          {!isWebsite && !isWhatsApp && handleState === 'available' && (
            <div className="brand-callout brand-callout-ok"><strong>✓ Available</strong></div>
          )}
          {!isWebsite && !isWhatsApp && handleState === 'taken' && (
            <div className="brand-callout brand-callout-red"><strong>Already verified by another user</strong></div>
          )}
          {error && <div className="brand-error">{error}</div>}
          <div className="brand-modal-actions">
            <button className="brand-btn brand-btn-ghost" onClick={onCancel} disabled={busy}>Cancel</button>
            <button className="brand-btn brand-btn-primary brand-btn-large" onClick={handleStart} disabled={busy || !handleInput || handleState === 'taken'}>Continue →</button>
          </div>
        </>
      )}
      {stage === 'instructions' && (
        <>
          <h2>Post this code in your bio</h2>
          <div className="brand-code-box">
            <div className="brand-code-label">Your code</div>
            <div className="brand-code-value">{code}</div>
            <button className="brand-btn brand-btn-ghost" onClick={handleCopy}>Copy code</button>
          </div>
          <div className="brand-modal-actions">
            <button className="brand-btn brand-btn-ghost" onClick={() => setStage('input')}>← Back</button>
            <button className="brand-btn brand-btn-primary brand-btn-large" onClick={handleConfirmPosted} disabled={busy}>Submit for Review →</button>
          </div>
        </>
      )}
      {stage === 'checking' && <><h2>Submitting…</h2><div className="brand-spinner brand-spinner-lg" /></>}
      {stage === 'success-admin' && (
        <>
          <div className="brand-success-icon" style={{ background: '#f59e0b' }}>⏳</div>
          <h2>Sent to Admin</h2>
          <p className="brand-modal-lead">An admin will check your bio and approve shortly.</p>
          <div className="brand-modal-actions">
            <button className="brand-btn brand-btn-primary brand-btn-large" onClick={() => {
              onSuccess();
              setTimeout(() => window.location.reload(), 100); 
            }}>Done</button>
          </div>
        </>
      )}
    </>
  );
};

export default SocialVerificationStep;