// src/seller/verification/SocialVerificationStep.jsx
import { useState, useEffect } from 'react';
import { claimSocialHandle, checkHandleAvailability, normalizeHandle } from './socialRegistry';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../firebase';
import './sellerVerification.css'; // Adjust if your CSS is named differently

const PLATFORMS = [
  { key: 'instagram', label: 'Instagram' },
  { key: 'tiktok', label: 'TikTok' },
  { key: 'youtube', label: 'YouTube' },
  { key: 'x', label: 'X (Twitter)' },
  { key: 'facebook', label: 'Facebook' },
  { key: 'whatsapp', label: 'WhatsApp' },
  { key: 'website', label: 'Website' },
];

export const getNormalizedAccountsForPlatform = (rawAccounts, platformKey) => {
  const platformData = rawAccounts[platformKey];
  if (!platformData) return {};
  
  if (Array.isArray(platformData)) {
    const map = {};
    platformData.forEach((acc, idx) => {
      if (acc && acc.handle) map[acc.handle.toLowerCase()] = acc;
      else map[`idx-${idx}`] = acc;
    });
    return map;
  }

  if (platformData.platform || platformData.handle) {
    const id = (platformData.handle || platformData.platform).toLowerCase();
    return { [id]: platformData };
  }
  
  return platformData;
};

const SocialVerificationStep = ({ verification, onReload, onBack, onNext }) => {
  const sellerUid = verification?.sellerUid || verification?.id;
  const rawAccounts = verification?.accounts || {};
  const [activePlatform, setActivePlatform] = useState(null);

  return (
    <section className="vf-card">
      <header className="vf-card-head">
        <h2>Level 3 — Social accounts</h2>
        <p>
          Prove ownership of your Instagram, TikTok, YouTube, Facebook, X,
          WhatsApp, or website. You can link multiple accounts per platform.
        </p>
      </header>

      <div className="sva-grid">
        {PLATFORMS.map((p) => {
          const accountsMap = getNormalizedAccountsForPlatform(rawAccounts, p.key);
          const list = Object.values(accountsMap);
          
          const verifiedCount = list.filter((a) => a.status === 'verified').length;
          const pendingCount = list.filter((a) => a.status === 'pending').length;
          
          let statusClass = 'unverified';
          if (verifiedCount > 0) statusClass = 'verified';
          else if (pendingCount > 0) statusClass = 'pending';

          return (
            <div
              key={p.key}
              className={`sva-card sva-card-${statusClass}`}
              onClick={() => setActivePlatform(p.key)}
              role="button"
              tabIndex={0}
            >
              <div className="sva-card-accent" style={{ background: p.color }} />
              <div className="sva-card-body">
                <div className="sva-card-head">
                  <span className="sva-platform">{p.label}</span>
                  
                  <div style={{ display: 'flex', gap: 6 }}>
                    {verifiedCount > 0 && (
                      <span className="sva-status sva-status-verified">
                        <span className="sva-status-dot" />
                        {verifiedCount} Verified
                      </span>
                    )}
                    {pendingCount > 0 && (
                      <span className="sva-status sva-status-pending">
                        <span className="sva-status-dot" />
                        {pendingCount} Pending
                      </span>
                    )}
                  </div>
                </div>

                <div className="sva-handle" style={{ fontWeight: 600 }}>
                  {list.length === 0
                    ? 'No accounts linked'
                    : list.length === 1
                    ? (p.key === 'website' ? list[0].handle : `@${list[0].handle.replace(/^@/, '')}`)
                    : `${list.length} accounts linked`}
                </div>

                <div className="sva-card-actions" style={{ marginTop: 12 }}>
                  <button className="sva-btn sva-btn-primary" type="button">
                    {list.length > 0 ? 'Manage accounts →' : 'Link account →'}
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="vf-form-actions">
        <button className="vf-btn vf-btn-ghost" onClick={onBack}>
          ← Back
        </button>
        <button className="vf-btn vf-btn-primary" onClick={onNext}>
          Continue to publish →
        </button>
      </div>

      {activePlatform && (
        <SellerVerificationModal
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

/* ============================================================
   SellerVerificationModal — The exact same logic as Brand
   ============================================================ */
const SellerVerificationModal = ({ platform, verification, sellerUid, onClose, onReload }) => {
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
    <div className="vf-modal-overlay" onClick={onClose}>
      <div className="vf-modal-qr" onClick={(e) => e.stopPropagation()}>
        <button className="vf-modal-close" onClick={onClose} aria-label="Close">✕</button>

        {view === 'list' && (
          <>
            <h2>{platformLabel} Accounts</h2>
            <p className="vf-modal-lead">
              Manage the accounts linked to your business.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 24 }}>
              {accountsList.map((acc, i) => (
                <div key={i} style={{ padding: '12px 16px', border: '1px solid #e2e8f0', borderRadius: 10, display: 'flex', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>
                      {platform === 'website' || platform === 'whatsapp' ? acc.handle : `@${acc.handle.replace(/^@/, '')}`}
                    </div>
                    <div style={{ fontSize: '0.8rem', marginTop: 4 }}>
                      {acc.status === 'verified' ? <span style={{ color: '#16a34a' }}>✓ Verified</span> : 
                       acc.status === 'pending' ? <span style={{ color: '#d97706' }}>⏳ Pending Admin Review</span> : 
                       <span style={{ color: '#64748b' }}>Unverified</span>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="vf-modal-actions">
              <button className="vf-btn vf-btn-ghost" onClick={onClose}>Close</button>
              <button className="vf-btn vf-btn-primary" onClick={() => setView('add')}>+ Link another {platformLabel}</button>
            </div>
          </>
        )}

        {view === 'add' && (
          <AddAccountFlow
            key={refreshKey}
            platform={platform}
            sellerUid={sellerUid}
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

const AddAccountFlow = ({ platform, sellerUid, existingAccounts, onCancel, onSuccess }) => {
  const [stage, setStage] = useState('input');
  const [handleInput, setHandleInput] = useState('');
  const [handleState, setHandleState] = useState(null);
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [copyLabel, setCopyLabel] = useState('Copy code');

  const platformLabel = PLATFORMS.find((p) => p.key === platform)?.label || platform;
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
    if (existingAccounts[accountKey]) { setError('This exact account is already added.'); return; }

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
    const currentPlatformAccounts = getNormalizedAccountsForPlatform(allRawAccounts, platform);

    const newPlatformAccounts = {
      ...currentPlatformAccounts,
      [handle.toLowerCase()]: {
        platform,
        handle,
        status,
        pendingCode: verificationCode,
        submittedAt: serverTimestamp(),
        ...(status === 'verified' ? { verifiedAt: serverTimestamp() } : {})
      }
    };

    await setDoc(
      verRef,
      {
        accounts: { ...allRawAccounts, [platform]: newPlatformAccounts },
        sellerUid: baseData.sellerUid || sellerUid,
        overallStatus: baseData.overallStatus || 'unverified',
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
  };

  const handleConfirm = async () => {
    setStage('checking'); setBusy(true); setError('');
    try {
      await saveAccountToFirestore(handleInput, 'pending', code);
      setBusy(false); setStage('success-admin');
    } catch (err) {
      setBusy(false); setStage('error'); setError(err.message || 'Error.');
    }
  };

  const handleCopy = async () => {
    const ok = await copyToClipboard(code);
    if (ok) { setCopyLabel('Copied ✓'); setTimeout(() => setCopyLabel('Copy code'), 2000); }
    else window.prompt('Copy your code:', code);
  };

  return (
    <>
      {stage === 'input' && (
        <>
          <h2>Link a {platformLabel}</h2>
          <p className="vf-modal-lead">
            {isWebsite ? 'Enter URL.' : isWhatsApp ? 'Enter WhatsApp number.' : `Enter handle.`}
          </p>
          <div className="vf-field" style={{ textAlign: 'left', marginBottom: 12 }}>
            <label>Your {platformLabel} {isWhatsApp ? 'number' : isWebsite ? 'URL' : 'handle'}</label>
            <input type="text" value={handleInput} onChange={(e) => setHandleInput(e.target.value)} disabled={busy} />
          </div>
          {!isWebsite && !isWhatsApp && handleState === 'available' && (
            <div className="vf-namecheck vf-namecheck-ok" style={{ textAlign: 'left' }}><span className="vf-namecheck-icon">✓</span> Available</div>
          )}
          {!isWebsite && !isWhatsApp && handleState === 'taken' && (
            <div className="vf-namecheck vf-namecheck-warn" style={{ textAlign: 'left' }}><span className="vf-namecheck-icon">!</span> Already verified</div>
          )}
          {error && <div className="vf-error">{error}</div>}
          <div className="vf-modal-actions">
            <button className="vf-btn vf-btn-ghost" onClick={onCancel} disabled={busy}>Cancel</button>
            <button className="vf-btn vf-btn-primary" onClick={handleStart} disabled={busy || !handleInput || handleState === 'taken'}>Continue →</button>
          </div>
        </>
      )}
      {stage === 'instructions' && (
        <>
          <h2>Post this code in your bio</h2>
          <div className="vf-code-box">
            <div className="vf-code-value">{code}</div>
            <button className="vf-btn vf-btn-ghost" onClick={handleCopy}>{copyLabel}</button>
          </div>
          <div className="vf-modal-actions">
            <button className="vf-btn vf-btn-ghost" onClick={() => setStage('input')}>← Back</button>
            <button className="vf-btn vf-btn-primary" onClick={handleConfirm} disabled={busy}>Submit for Review →</button>
          </div>
        </>
      )}
      {stage === 'checking' && <><h2>Submitting…</h2><div className="vf-spinner" /></>}
      {stage === 'success-admin' && (
        <>
          <div className="vf-success-icon" style={{ background: '#d97706' }}>⏳</div>
          <h2>Sent to Admin</h2>
          <p className="vf-modal-lead" style={{ textAlign: 'center' }}>An admin will check your bio and approve shortly.</p>
          <button className="vf-btn vf-btn-primary" onClick={onSuccess}>Done</button>
        </>
      )}
    </>
  );
};

function generateCode() {
  const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  let out = '';
  for (let i = 0; i < 6; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)];
  return `KONFA-${out}`;
}

async function copyToClipboard(text) {
  if (navigator?.clipboard?.writeText) {
    try { await navigator.clipboard.writeText(text); return true; } catch {}
  }
  return false;
}

export default SocialVerificationStep;