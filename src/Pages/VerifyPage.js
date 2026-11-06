// src/Pages/VerifyPage.jsx
import { useState, useEffect, useRef } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { verifyProduct, reportProblem, checkReferenceCode } from './verifyApi';
import { getDeviceFingerprint } from '../utils/deviceFingerprint';
import { auth } from '../firebase';
import './VerifyPage.css';

/* ---------- Inline Konfa logo ---------- */
const KonfaLogo = ({ className = '' }) => (
  <svg className={className} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" aria-label="Konfa logo">
    <defs>
      <linearGradient id="konfaShield" x1="0" y1="0" x2="48" y2="48" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#14b8a6" />
        <stop offset="100%" stopColor="#0d9488" />
      </linearGradient>
      <linearGradient id="konfaInner" x1="0" y1="0" x2="48" y2="48" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#0a1628" />
        <stop offset="100%" stopColor="#1a2d47" />
      </linearGradient>
    </defs>
    <path d="M24 3L6 10v12c0 10.5 7.5 20 18 23 10.5-3 18-12.5 18-23V10L24 3z" fill="url(#konfaInner)" />
    <path d="M24 3L6 10v12c0 10.5 7.5 20 18 23 10.5-3 18-12.5 18-23V10L24 3z" stroke="url(#konfaShield)" strokeWidth="2.5" strokeLinejoin="round" fill="none" />
    <path d="M17 15v18M17 24l10-9M17 24l10 9" stroke="url(#konfaShield)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    <circle cx="33" cy="33" r="6" fill="url(#konfaShield)" />
    <path d="M30.5 33l1.8 1.8 3.2-3.6" stroke="#ffffff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none" />
  </svg>
);

/* ---------- Reusable icons ---------- */
const IconCamera = (p) => (
  <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" strokeLinejoin="round" />
    <circle cx="12" cy="13" r="4" />
  </svg>
);
const IconScan = (p) => (
  <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M3 7V5a2 2 0 012-2h2M17 3h2a2 2 0 012 2v2M21 17v2a2 2 0 01-2 2h-2M7 21H5a2 2 0 01-2-2v-2M7 12h10" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const IconQr = (p) => (
  <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="3" y="3" width="7" height="7" rx="1.5" />
    <rect x="14" y="3" width="7" height="7" rx="1.5" />
    <rect x="3" y="14" width="7" height="7" rx="1.5" />
    <path d="M14 14h3v3h-3zM20 14h1v1h-1zM14 20h1v1h-1zM18 20h3v1h-3z" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const IconCheck = (p) => (
  <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
    <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const IconX = (p) => (
  <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
    <circle cx="12" cy="12" r="10" />
    <path d="M15 9l-6 6M9 9l6 6" strokeLinecap="round" />
  </svg>
);
const IconWarning = (p) => (
  <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
    <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" strokeLinejoin="round" />
    <path d="M12 9v4M12 17h.01" strokeLinecap="round" />
  </svg>
);
const IconClock = (p) => (
  <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
    <circle cx="12" cy="12" r="10" />
    <path d="M12 6v6l4 2" strokeLinecap="round" />
  </svg>
);
const IconLock = (p) => (
  <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
    <rect x="4" y="10" width="16" height="11" rx="2.5" />
    <path d="M8 10V7a4 4 0 018 0v3" strokeLinecap="round" />
  </svg>
);
const IconEdit = (p) => (
  <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M12 20h9M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4z" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const IconXSmall = (p) => (
  <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
    <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
  </svg>
);

/* ============================================================
   Helper — stop all media tracks in a container
   ============================================================ */
function stopAllMediaTracks(containerId) {
  const killVideo = (video) => {
    if (!video) return;
    try {
      const stream = video.srcObject;
      if (stream && typeof stream.getTracks === 'function') {
        stream.getTracks().forEach((track) => {
          try { track.stop(); } catch { /* ignore */ }
        });
      }
    } catch { /* ignore */ }

    try { video.srcObject = null; } catch { /* ignore */ }

    try {
      video.onabort = null;
      video.onerror = null;
      video.onloadedmetadata = null;
      video.onplay = null;
      video.onpause = null;
      video.oncanplay = null;
      video.onplaying = null;
      video.onstalled = null;
      video.onsuspend = null;
      video.onemptied = null;
      video.onended = null;
      video.onloadstart = null;
      video.onprogress = null;
      video.onwaiting = null;
      video.onratechange = null;
      video.onseeked = null;
      video.onseeking = null;
      video.ontimeupdate = null;
      video.onvolumechange = null;
      video.ondurationchange = null;
    } catch { /* ignore */ }

    try { video.pause(); } catch { /* ignore */ }
    try {
      requestAnimationFrame(() => {
        try { video.remove(); } catch { /* ignore */ }
      });
    } catch {
      try { video.remove(); } catch { /* ignore */ }
    }
  };

  try {
    const container = document.getElementById(containerId);
    if (container) container.querySelectorAll('video').forEach(killVideo);
  } catch { /* ignore */ }

  try {
    if (window.__konfaActiveStream) {
      window.__konfaActiveStream.getTracks().forEach((t) => {
        try { t.stop(); } catch { /* ignore */ }
      });
      window.__konfaActiveStream = null;
    }
  } catch { /* ignore */ }

  try {
    document.querySelectorAll('video').forEach(killVideo);
  } catch { /* ignore */ }
}

/* ============================================================
   QR Code extraction from decoded text
   ============================================================ */
function extractReferenceCode(text) {
  if (!text) return null;
  const raw = String(text).trim();

  try {
    const url = new URL(raw);
    const codeFromUrl =
      url.searchParams.get('code') ||
      url.searchParams.get('ref') ||
      url.searchParams.get('c') ||
      url.searchParams.get('refCode');
    if (codeFromUrl) return codeFromUrl;
  } catch { /* not a URL */ }

  const cleaned = raw.toUpperCase().replace(/[^A-Z0-9-]/g, '');
  const stripped = cleaned.replace(/-/g, '');

  if (stripped.length === 8 && /^[A-Z0-9]{8}$/.test(stripped)) {
    return `${stripped.slice(0, 4)}-${stripped.slice(4)}`;
  }

  return cleaned || null;
}

/* ============================================================
   QR Scanner Modal
   ============================================================ */
const QrScannerModal = ({ onClose, onSuccess }) => {
  const [status, setStatus] = useState('starting');
  const [errorMsg, setErrorMsg] = useState('');
  const [foundCode, setFoundCode] = useState('');

  const scannerRef = useRef(null);
  const regionId = 'konfa-verify-qr-region';
  const hasHandledRef = useRef(false);
  const stoppedRef = useRef(false);
  const onSuccessRef = useRef(onSuccess);
  const onCloseRef = useRef(onClose);
  const navigateTimerRef = useRef(null);

  useEffect(() => { onSuccessRef.current = onSuccess; }, [onSuccess]);
  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);

  const shutdownScanner = async () => {
    if (stoppedRef.current) return;
    stoppedRef.current = true;

    const s = scannerRef.current;
    if (s) {
      try { if (s.isScanning) await s.stop(); } catch { /* ignore */ }
      try { s.clear(); } catch { /* ignore */ }
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
    stopAllMediaTracks(regionId);
    scannerRef.current = null;
  };

  const handleValidProduct = async (refCode) => {
    await shutdownScanner();
    setStatus('success');
    setFoundCode(refCode);
    navigateTimerRef.current = setTimeout(() => {
      try {
        if (onSuccessRef.current) onSuccessRef.current(refCode);
      } catch (err) {
        console.error('onSuccess threw:', err);
      }
    }, 700);
  };

  const startScanner = async (mountedRef) => {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Your browser does not support camera access.');
      }

      const scanner = new Html5Qrcode(regionId, { verbose: false });
      scannerRef.current = scanner;

      const cameras = await Html5Qrcode.getCameras();
      if (!cameras || cameras.length === 0) {
        throw new Error('No camera found on this device.');
      }

      const rearCamera = cameras.find(
        (c) =>
          c.label.toLowerCase().includes('back') ||
          c.label.toLowerCase().includes('rear') ||
          c.label.toLowerCase().includes('environment')
      );
      const cameraId = rearCamera ? rearCamera.id : cameras[0].id;

      await scanner.start(
        cameraId,
        { fps: 10, qrbox: { width: 250, height: 250 }, aspectRatio: 1.0 },
        async (decodedText) => {
          if (hasHandledRef.current) return;
          hasHandledRef.current = true;

          const extracted = extractReferenceCode(decodedText);
          if (!extracted) {
            setStatus('error');
            setErrorMsg(
              'That QR code does not look like a Konfa product code. Please try a different product.'
            );
            return;
          }

          setStatus('checking');
          setFoundCode(extracted);

          try {
            const result = await checkReferenceCode(extracted);
            if (result.exists) {
              await handleValidProduct(result.refCode);
            } else {
              setStatus('error');
              setErrorMsg(
                `We couldn't find a product with the code "${extracted}". Please check the QR code and try again.`
              );
            }
          } catch (err) {
            console.error('Reference check failed:', err);
            setStatus('error');
            setErrorMsg(
              'We could not reach the verification service. Please check your internet and try again.'
            );
          }
        },
        () => { /* per-frame decode errors — ignore */ }
      );

      setTimeout(() => {
        try {
          const container = document.getElementById(regionId);
          const video = container?.querySelector('video');
          if (video?.srcObject) {
            window.__konfaActiveStream = video.srcObject;
          }
        } catch { /* ignore */ }
      }, 300);

      if (mountedRef.current) setStatus('scanning');
    } catch (err) {
      console.error('Camera start failed:', err);
      if (!mountedRef.current) return;
      setStatus('error');
      setErrorMsg(
        err?.message ||
          'We could not access your camera. Please check permissions and try again.'
      );
      stopAllMediaTracks(regionId);
    }
  };

  useEffect(() => {
    const mountedRef = { current: true };
    stoppedRef.current = false;
    hasHandledRef.current = false;
    startScanner(mountedRef);
    return () => {
      mountedRef.current = false;
      shutdownScanner();
      setTimeout(() => stopAllMediaTracks(regionId), 50);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const handler = () => stopAllMediaTracks(regionId);
    window.addEventListener('beforeunload', handler);
    window.addEventListener('pagehide', handler);
    return () => {
      window.removeEventListener('beforeunload', handler);
      window.removeEventListener('pagehide', handler);
    };
  }, []);

  const handleClose = async () => {
    if (navigateTimerRef.current) {
      clearTimeout(navigateTimerRef.current);
      navigateTimerRef.current = null;
    }
    await shutdownScanner();
    if (onCloseRef.current) onCloseRef.current();
  };

  const handleRetry = async () => {
    await shutdownScanner();
    hasHandledRef.current = false;
    stoppedRef.current = false;
    setStatus('starting');
    setErrorMsg('');
    setFoundCode('');

    const region = document.getElementById(regionId);
    if (region) region.innerHTML = '';

    setTimeout(() => {
      const mountedRef = { current: true };
      startScanner(mountedRef);
    }, 350);
  };

  const statusText =
    status === 'scanning' ? 'Point your camera at the QR code on the product.' :
    status === 'starting' ? 'Starting camera…' :
    status === 'checking' ? 'Checking product…' :
    status === 'success'  ? 'Product found!' :
    'Something went wrong';

  return (
    <div className="verify-qr-overlay">
      <div className="verify-qr-modal">
        <div className="verify-qr-header">
          <div className="verify-qr-header-text">
            <h3>Scan Product QR Code</h3>
            <p>{statusText}</p>
          </div>
          <button
            className="verify-qr-close"
            onClick={handleClose}
            aria-label="Close scanner"
            title="Close scanner"
          >
            <IconXSmall width="16" height="16" />
          </button>
        </div>

        <div className="verify-qr-stage">
          <div
            id={regionId}
            className="verify-qr-region"
            style={{ display: status === 'error' || status === 'success' ? 'none' : 'block' }}
          />

          {status === 'scanning' && (
            <>
              <div className="verify-qr-frame">
                <span className="verify-qr-corner verify-qr-tl" />
                <span className="verify-qr-corner verify-qr-tr" />
                <span className="verify-qr-corner verify-qr-bl" />
                <span className="verify-qr-corner verify-qr-br" />
              </div>
              <div className="verify-qr-laser" />
            </>
          )}

          {status === 'starting' && (
            <div className="verify-qr-center">
              <div className="verify-qr-spinner" />
              <p>Opening camera…</p>
            </div>
          )}

          {status === 'checking' && (
            <div className="verify-qr-center">
              <div className="verify-qr-spinner" />
              <p>Verifying product code…</p>
              {foundCode && <span className="verify-qr-code">{foundCode}</span>}
            </div>
          )}

          {status === 'success' && (
            <div className="verify-qr-success">
              <div className="verify-qr-success-icon">
                <IconCheck width="34" height="34" />
              </div>
              <p className="verify-qr-success-title">Product found</p>
              {foundCode && <span className="verify-qr-code">{foundCode}</span>}
              <p className="verify-qr-success-hint">Ready to enter your PIN…</p>
            </div>
          )}

          {status === 'error' && (
            <div className="verify-qr-error">
              <div className="verify-qr-error-icon">!</div>
              <p className="verify-qr-error-msg">{errorMsg}</p>
              <button className="verify-qr-btn-primary" onClick={handleRetry}>
                Try again
              </button>
            </div>
          )}
        </div>

        {status === 'scanning' && (
          <div className="verify-qr-hint">
            <IconQr width="16" height="16" />
            <span>Hold steady. The code is detected automatically.</span>
          </div>
        )}

        {(status === 'scanning' || status === 'starting' || status === 'error') && (
          <div className="verify-qr-actions">
            <button type="button" className="verify-qr-cancel" onClick={handleClose}>
              <IconXSmall width="18" height="18" />
              Cancel scanning
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

/* ============================================================
   MAIN COMPONENT
   ============================================================ */
const VerifyPage = ({ onNavigate }) => {
  const [screen, setScreen] = useState('scan');
  const [referenceCode, setReferenceCode] = useState('');
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [reportReason, setReportReason] = useState('');
  const [reportContact, setReportContact] = useState('');
  const [reportSent, setReportSent] = useState(false);

  const [referenceLocked, setReferenceLocked] = useState(false);
  const [showQrModal, setShowQrModal] = useState(false);

  const [verifyProgress, setVerifyProgress] = useState(null);

  // 🆕 Location refs & state — GPS is requested as soon as the page
  //    mounts, so by the time the user submits we usually have it.
  const [locationReady, setLocationReady] = useState(false);
  const coordsRef = useRef(null);
  const locationPromiseRef = useRef(null);

  const deviceIdRef = useRef(null);
  if (deviceIdRef.current === null) {
    try {
      deviceIdRef.current = getDeviceFingerprint();
    } catch {
      deviceIdRef.current = 'dev_unknown';
    }
  }

  const pinEntryStartedAtRef = useRef(null);
  const prefillCoordsRef = useRef(null);

  // 🆕 Request GPS on mount — non-blocking.
  useEffect(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      return;
    }

    let cancelled = false;
    const timer = setTimeout(() => {
      if (!cancelled) setLocationReady(false);
    }, 12000);

    locationPromiseRef.current = new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          clearTimeout(timer);
          const c = {
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
            source: 'gps_passed',
          };
          coordsRef.current = c;
          if (!cancelled) setLocationReady(true);
          resolve(c);
        },
        () => {
          clearTimeout(timer);
          if (!cancelled) setLocationReady(false);
          resolve(null);
        },
        {
          enableHighAccuracy: true,
          timeout: 12000,
          maximumAge: 60000,
        }
      );
    });

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, []);

  // Existing prefill loader
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem('konfa_prefill');
      if (!raw) return;

      const { referenceCode: rc, pin: p, coords: c } = JSON.parse(raw);
      sessionStorage.removeItem('konfa_prefill');

      if (rc) setReferenceCode(rc);
      if (p) setPin(p);

      if (c && typeof c.lat === 'number' && typeof c.lng === 'number') {
        prefillCoordsRef.current = c;
        // 🆕 Also promote the prefilled coords into the live ref so
        //    handleVerify uses them even if fresh GPS never arrives.
        if (!coordsRef.current) {
          coordsRef.current = { ...c, source: c.source || 'gps_passed' };
          setLocationReady(true);
        }
      }

      if (rc) {
        setReferenceLocked(true);
        setScreen('pin');
        return;
      }
      if (p) {
        setScreen('pin');
      }
    } catch {
      /* ignore storage errors */
    }
  }, []);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [screen]);

  useEffect(() => {
    if (screen === 'pin') {
      pinEntryStartedAtRef.current = Date.now();
    } else {
      pinEntryStartedAtRef.current = null;
    }
  }, [screen]);

  // 🆕 Second-chance GPS request when the user reaches the PIN screen.
  useEffect(() => {
    if (screen !== 'pin') return;
    if (coordsRef.current) return;
    if (typeof navigator === 'undefined' || !navigator.geolocation) return;

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        coordsRef.current = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          source: 'gps_passed',
        };
        setLocationReady(true);
      },
      () => { /* ignore — verifyApi still has its own fallbacks */ },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 30000 }
    );
  }, [screen]);

  useEffect(() => {
    document.body.style.overflow = showQrModal ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [showQrModal]);

  const goHome = () => {
    if (onNavigate) onNavigate('Home');
    else window.location.href = '/';
  };

  const handleVerify = async (e) => {
    e.preventDefault();
    if (!referenceCode || pin.length !== 6) return;

    const timeToEnterPinMs = pinEntryStartedAtRef.current
      ? Date.now() - pinEntryStartedAtRef.current
      : null;

    // 🆕 Prefer live GPS, then prefill, then nothing.
    const finalCoords =
      coordsRef.current || prefillCoordsRef.current || null;

    if (finalCoords) {
      console.info('[verify] Passing coords to verifyApi:', {
        source: finalCoords.source,
        lat: finalCoords.lat,
        lng: finalCoords.lng,
      });
    } else {
      console.info(
        '[verify] No GPS available yet — verifyApi will try its own fallbacks.'
      );
    }

    setLoading(true);
    setVerifyProgress({ stage: 'reading', pct: 5, message: 'Starting verification…' });

    try {
      const res = await verifyProduct(referenceCode, pin, {
        deviceId: deviceIdRef.current,
        timeToEnterPinMs,
        coords: finalCoords,
        consumerUid: auth.currentUser?.uid || null,
        onProgress: (p) => {
          const pct = Math.max(0, Math.min(100, p.pct || 0));
          setVerifyProgress({ ...p, pct });
        },
      });
      setResult(res);
      setScreen('result');
    } catch (err) {
      console.error('Verification error:', err);
      setResult({
        result: 'INVALID',
        reason: 'UNKNOWN',
        confidence: 10,
        confidenceLabel: 'Low confidence',
        confidenceReasons: ['An unexpected error occurred.'],
        message:
          'Something went wrong while verifying this product. Please try again.',
      });
      setScreen('result');
    } finally {
      setLoading(false);
      setVerifyProgress(null);
    }
  };

  const handleStartOver = () => {
    setPin('');
    setResult(null);
    setReferenceCode('');
    setReferenceLocked(false);
    setScreen('scan');
  };

  const handleVerifyAnother = () => {
    setPin('');
    setResult(null);
    setReferenceCode('');
    setReferenceLocked(false);
    setScreen('pin');
  };

  const handleUnlockReference = () => {
    setReferenceLocked(false);
  };

  const handleQrSuccess = (refCode) => {
    setShowQrModal(false);
    setReferenceCode(refCode);
    setReferenceLocked(true);
    setPin('');
    setScreen('pin');
  };

  const handleReportSubmit = async (e) => {
    e.preventDefault();
    await reportProblem({
      unitId: result?.unitId,
      referenceCode,
      reason: reportReason,
      contact: reportContact,
    });
    setReportSent(true);
    setTimeout(() => {
      setReportSent(false);
      setReportReason('');
      setReportContact('');
      setScreen('result');
    }, 2500);
  };

  return (
    <div className="verify-page">
      <header className="verify-topbar">
        <button className="verify-brand" onClick={goHome}>
          <KonfaLogo className="verify-brand-icon" />
          <span className="verify-brand-name">Konfa</span>
        </button>
        <button className="verify-topbar-back" onClick={handleStartOver}>
          ← Start over
        </button>
      </header>

      <main className="verify-main">
        {screen === 'scan' && (
          <ScanInstructions
            onStart={() => setScreen('pin')}
            onScanQr={() => setShowQrModal(true)}
            onHome={goHome}
          />
        )}

        {screen === 'pin' && (
          <PinEntry
            referenceCode={referenceCode}
            setReferenceCode={setReferenceCode}
            referenceLocked={referenceLocked}
            onUnlockReference={handleUnlockReference}
            onScanQr={() => setShowQrModal(true)}
            pin={pin}
            setPin={setPin}
            loading={loading}
            onSubmit={handleVerify}
            progress={verifyProgress}
          />
        )}

        {screen === 'result' && result && (
          <ResultScreen
            result={result}
            referenceCode={referenceCode}
            onVerifyAnother={handleVerifyAnother}
            onReport={() => setScreen('report')}
            onHome={goHome}
          />
        )}

        {screen === 'report' && (
          <ReportScreen
            reason={reportReason}
            setReason={setReportReason}
            contact={reportContact}
            setContact={setReportContact}
            sent={reportSent}
            onSubmit={handleReportSubmit}
            onCancel={() => setScreen('result')}
          />
        )}
      </main>

      <footer className="verify-footer">
        <p>© 2025 Konfa. All rights reserved.</p>
        <div className="verify-footer-links">
          <a href="#privacy">Privacy</a>
          <a href="#terms">Terms</a>
          <a href="#contact">Contact</a>
        </div>
      </footer>

      {showQrModal && (
        <QrScannerModal
          onClose={() => setShowQrModal(false)}
          onSuccess={handleQrSuccess}
        />
      )}
    </div>
  );
};

export default VerifyPage;

/* ============================================================
   SUB-COMPONENTS
   ============================================================ */

/* ---------- Screen 1: Scan Instructions ---------- */
const ScanInstructions = ({ onStart, onScanQr, onHome }) => (
  <div className="verify-screen">
    <div className="verify-card verify-card-center">
      <div className="verify-icon-lg">
        <IconCamera width="32" height="32" />
      </div>

      <h1 className="verify-h1">Verify Your Product</h1>
      <p className="verify-lead">
        Scan the QR code on your product, or enter the codes manually.
      </p>

      <button className="verify-btn primary" onClick={onScanQr}>
        <IconQr width="18" height="18" />
        Scan QR Code
      </button>

      <div className="verify-sample-qr" aria-hidden="true">
        <svg viewBox="0 0 100 100" width="160" height="160">
          <rect width="100" height="100" fill="#fff" />
          <rect x="10" y="10" width="25" height="25" fill="#0a1628" rx="2" />
          <rect x="65" y="10" width="25" height="25" fill="#0a1628" rx="2" />
          <rect x="10" y="65" width="25" height="25" fill="#0a1628" rx="2" />
          <rect x="40" y="40" width="10" height="10" fill="#0a1628" />
          <rect x="55" y="55" width="10" height="10" fill="#0a1628" />
          <rect x="40" y="70" width="10" height="10" fill="#0a1628" />
          <rect x="70" y="70" width="10" height="10" fill="#0a1628" />
          <rect x="55" y="40" width="10" height="10" fill="#0a1628" />
        </svg>
      </div>
      <p className="verify-sample-caption">Sample Consumer QR Code</p>

      <div className="verify-after-scan">
        <h3>What you'll need</h3>
        <p>
          The <strong>Reference Code</strong> printed under the QR code, and the{' '}
          <strong>6-digit PIN</strong> hidden under the scratch panel on your
          product's label.
        </p>
      </div>

      <button className="verify-btn outline" onClick={onStart}>
        <IconScan width="18" height="18" />
        Enter codes manually
      </button>

      <button className="verify-btn outline" onClick={onHome}>
        Back to home
      </button>
    </div>
  </div>
);

/* ---------- Screen 2: PIN Entry with progress ---------- */
const PinEntry = ({
  referenceCode,
  setReferenceCode,
  referenceLocked,
  onUnlockReference,
  onScanQr,
  pin,
  setPin,
  loading,
  onSubmit,
  progress,
}) => {
  const [localRef, setLocalRef] = useState(referenceCode);

  useEffect(() => {
    setLocalRef(referenceCode);
  }, [referenceCode]);

  const handleRefChange = (e) => {
    const value = e.target.value.toUpperCase();
    setLocalRef(value);
    setReferenceCode(value);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!referenceCode || pin.length !== 6) return;
    onSubmit(e);
  };

  const pct = progress?.pct ?? 0;
  const message = progress?.message || 'Verifying…';

  return (
    <div className="verify-screen">
      <div className="verify-card">
        <h1 className="verify-h1 verify-h1-left">Verify Your Product</h1>
        <p className="verify-lead verify-lead-left">
          {referenceLocked
            ? 'Great — we found your product. Now enter the scratch-off PIN.'
            : "Enter the codes printed on your product's label."}
        </p>

        {!referenceLocked && (
          <button
            type="button"
            className="verify-btn outline verify-btn-scan-shortcut"
            onClick={onScanQr}
            disabled={loading}
          >
            <IconQr width="18" height="18" />
            Scan QR Code instead
          </button>
        )}

        <form onSubmit={handleSubmit} className="verify-form">
          <div className="verify-field">
            <label htmlFor="ref">
              Reference Code
              <span className="verify-hint">
                {referenceLocked ? '✓ From QR code' : 'Printed under the QR code'}
              </span>
            </label>

            {referenceLocked ? (
              <div className="verify-locked-field">
                <div className="verify-locked-display">
                  <span className="verify-locked-icon">
                    <IconLock width="14" height="14" />
                  </span>
                  <span className="verify-locked-code">{referenceCode}</span>
                </div>
                <button
                  type="button"
                  className="verify-locked-edit"
                  onClick={onUnlockReference}
                  disabled={loading}
                  aria-label="Change reference code"
                >
                  <IconEdit width="13" height="13" />
                  Change
                </button>
              </div>
            ) : (
              <input
                id="ref"
                type="text"
                placeholder="e.g. XBAK-7Q2M"
                value={localRef}
                onChange={handleRefChange}
                maxLength={9}
                autoComplete="off"
                disabled={loading}
              />
            )}
          </div>

          <div className="verify-field">
            <label htmlFor="pin">
              Scratch-off PIN
              <span className="verify-hint">Hidden under the panel</span>
            </label>
            <input
              id="pin"
              type="text"
              placeholder="Enter 6-digit code"
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
              maxLength={6}
              inputMode="numeric"
              autoComplete="off"
              className="verify-pin"
              disabled={loading}
              autoFocus={referenceLocked}
            />
          </div>

          {loading ? (
            <div className="verify-progress-block">
              <div className="verify-progress-header">
                <span className="verify-progress-message">{message}</span>
                <span className="verify-progress-pct">{pct}%</span>
              </div>
              <div className="verify-progress-track">
                <div
                  className="verify-progress-fill"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          ) : (
            <button
              type="submit"
              className="verify-btn primary"
              disabled={!referenceCode || pin.length !== 6}
            >
              Verify
            </button>
          )}
        </form>

        <div className="verify-help-block">
          <h3>Why two codes?</h3>
          <p>
            The barcode alone can be copied. The secret PIN proves you're holding the{' '}
            <em>real</em> product in your hands.
          </p>
        </div>
      </div>
    </div>
  );
};

/* ============================================================
   Screen 3: Result
   ============================================================ */
const ResultScreen = ({ result, referenceCode, onVerifyAnother, onReport, onHome }) => {
  if (result.result === 'DUPLICATE_CODE') {
    return (
      <div className="verify-screen">
        <div className="verify-block-screen">
          <div className="verify-block-icon">
            <IconWarning width="48" height="48" />
          </div>

          <h1 className="verify-block-title">This code has been duplicated</h1>

          <p className="verify-block-lead">
            Only one physical product can legitimately carry this code. The
            product in your hands is not the original — it is a copy of a
            genuine label.
          </p>

          <div className="verify-block-callout">
            <strong>Do not use this product</strong>
            <p>
              If you bought it from a shop, return it to the seller and ask
              for a refund or a replacement. If you bought it online, contact
              the seller and report it to us immediately.
            </p>
          </div>

          <div className="verify-block-actions">
            <button
              className="verify-btn danger verify-btn-large"
              onClick={onReport}
            >
              Report this product
            </button>
            <button className="verify-btn outline" onClick={onHome}>
              Back to home
            </button>
          </div>

          <p className="verify-block-footnote">
            Reference: <span className="verify-block-ref">{referenceCode}</span>
          </p>
        </div>
      </div>
    );
  }

  const banners = {
    AUTHENTIC:               { label: 'AUTHENTIC',                  Icon: IconCheck,   cls: 'banner-green' },
    AUTHENTIC_WITH_WARNING:  { label: 'AUTHENTIC — WITH CAVEATS',   Icon: IconWarning, cls: 'banner-amber' },
    EXPECTED:                { label: 'EXPECTED, NOT YET VERIFIED', Icon: IconClock,   cls: 'banner-blue' },
    SUSPICIOUS:              { label: 'SUSPICIOUS — UNDER REVIEW',  Icon: IconWarning, cls: 'banner-amber' },
    NOT_YET_RELEASED:        { label: 'NOT YET RELEASED',           Icon: IconX,       cls: 'banner-red' },
    INVALID:                 { label: 'INVALID CODE',               Icon: IconX,       cls: 'banner-red' },
  };

  const banner = banners[result.result] || banners.INVALID;
  const BannerIcon = banner.Icon;

  const signals = Array.isArray(result.signals) ? result.signals : [];
  const isClaimCollision = signals.some(
    (s) => s.code === 'claimed_by_other_device'
  );
  const isFirstClaim = signals.some((s) => s.code === 'first_claim');
  const otherSignals = signals.filter(
    (s) => s.code !== 'claimed_by_other_device' && s.code !== 'first_claim'
  );

  const confidence = typeof result.confidence === 'number' ? result.confidence : null;
  const confidenceLabel = result.confidenceLabel || null;
  const confidenceReasons = Array.isArray(result.confidenceReasons)
    ? result.confidenceReasons
    : [];

  const confidenceTier =
    confidence == null ? 'unknown' :
    confidence >= 80 ? 'high' :
    confidence >= 50 ? 'medium' : 'low';

  return (
    <div className="verify-screen">
      <div className={`verify-banner ${banner.cls}`}>
        <BannerIcon width="22" height="22" />
        {banner.label}
      </div>

      {confidence != null && (
        <div className={`verify-confidence-panel verify-confidence-${confidenceTier}`}>
          <div className="verify-confidence-head">
            <div className="verify-confidence-head-text">
              <strong>{confidence}% confidence</strong>
              {confidenceLabel && <span>{confidenceLabel}</span>}
            </div>
            <div className="verify-confidence-bar-track">
              <div
                className="verify-confidence-bar-fill"
                style={{ width: `${confidence}%` }}
              />
            </div>
          </div>

          {confidenceReasons.length > 0 && (
            <ul className="verify-confidence-reasons">
              {confidenceReasons.slice(0, 4).map((r, i) => (
                <li key={i}>{r}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {result.product && (
        <div className="verify-product-info">
          <h2>{result.product}</h2>
          <p>
            Batch {result.batch}
            {result.unitId && ` · Unit ${result.unitId}`}
          </p>
        </div>
      )}

      {isClaimCollision && (
        <div className="verify-claim-callout">
          <div className="verify-claim-callout-icon">
            <IconWarning width="22" height="22" />
          </div>
          <div className="verify-claim-callout-body">
            <strong>This product was already verified</strong>
            <p>
              {signals.find((s) => s.code === 'claimed_by_other_device')?.label ||
                'Another device has already claimed this code.'}
            </p>
            <p className="verify-claim-callout-hint">
              If you bought this from a shop, the label may have been copied.
              Please report it below.
            </p>
          </div>
        </div>
      )}

      {(result.result === 'AUTHENTIC' || result.result === 'AUTHENTIC_WITH_WARNING') && (
        <>
          {result.result === 'AUTHENTIC_WITH_WARNING' && result.message && (
            <div className="verify-note amber">
              <h3>Good news — with one caveat</h3>
              <p>{result.message}</p>
            </div>
          )}

          {isFirstClaim && (
            <div className="verify-first-claim">
              <div className="verify-first-claim-icon">
                <IconCheck width="16" height="16" />
              </div>
              <div className="verify-first-claim-body">
                <strong>This product is now linked to your device</strong>
                <p>
                  No one else has verified this code before. Future scans from a
                  different device will be flagged.
                </p>
              </div>
            </div>
          )}

          <HistoryBlock history={result.history} title="Full product history" />
        </>
      )}

      {result.result === 'EXPECTED' && (
        <>
          <div className="verify-note blue">
            <h3>What this means</h3>
            <p>
              We have a record that this product is on its way
              {result.expectedLocation ? ` to ${result.expectedLocation}` : ''}, but
              it hasn't been confirmed as physically received yet. This is normal
              during shipping — but if you bought this from a shop, ask the seller
              to confirm receipt.
            </p>
          </div>
          <HistoryBlock history={result.history} title="Recent activity" />
        </>
      )}

      {result.result === 'SUSPICIOUS' && (
        <>
          {!isClaimCollision && (
            <div className="verify-note amber">
              <h3>What this means</h3>
              <p>
                {result.message ||
                  'This code has been verified in a way that doesn\'t quite add up. This doesn\'t necessarily mean your item is fake — our team is taking a closer look.'}
              </p>
            </div>
          )}

          {otherSignals.length > 0 && (
            <div className="verify-signals">
              <h3>Why we flagged this</h3>
              <ul>
                {otherSignals.map((s, i) => (
                  <li
                    key={i}
                    className={`verify-signal verify-signal-${s.severity || 'medium'}`}
                  >
                    {s.label || s.code || 'Unusual pattern detected'}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <HistoryBlock
            history={result.history}
            title="Recent scan activity"
            showFlags
          />

          {result.flaggedReason && !isClaimCollision && (
            <div className="verify-flag-box">
              <strong>Flagged reason</strong>
              <p>{result.flaggedReason}</p>
            </div>
          )}
        </>
      )}

      {result.result === 'NOT_YET_RELEASED' && (
        <div className="verify-note red">
          <h3>This product has not been activated</h3>
          <p>{result.message}</p>
        </div>
      )}

      {result.result === 'INVALID' && (
        <div className="verify-note red">
          <h3>We couldn't verify this product</h3>
          <p>{result.message}</p>
        </div>
      )}

      <div className="verify-actions">
        {result.result !== 'EXPECTED' && (
          <button
            className={`verify-btn ${
              result.result === 'AUTHENTIC' ? 'outline' : 'danger'
            }`}
            onClick={onReport}
          >
            Report {result.result === 'AUTHENTIC' ? 'a Problem' : 'This Product'}
          </button>
        )}

        {result.result === 'INVALID' && (
          <button className="verify-btn outline" onClick={onVerifyAnother}>
            Try Again
          </button>
        )}

        <button className="verify-btn outline" onClick={onVerifyAnother}>
          Verify another product
        </button>
      </div>
    </div>
  );
};

/* ---------- History block ---------- */
const HistoryBlock = ({ history, title, showFlags = false }) => {
  if (!history || history.length === 0) return null;

  return (
    <div className="verify-history">
      <h3>{title}</h3>
      <ul>
        {history.map((event, i) => (
          <li key={i} className={event.flag && showFlags ? 'flagged' : ''}>
            <div className="verify-history-left">
              <strong>{event.label}</strong>
              <span>{event.location} · {event.time}</span>
              {event.actor && (
                <span className="verify-history-actor">{event.actor}</span>
              )}
            </div>
            <div className="verify-history-right">
              {event.flag && showFlags && (
                <span className="verify-flag-pill">
                  <IconWarning width="12" height="12" />
                  FLAG
                </span>
              )}
              {event.confidence && (
                <span className={`verify-confidence ${event.confidence.toLowerCase()}`}>
                  {event.confidence}
                </span>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
};

/* ---------- Screen 4: Report ---------- */
const ReportScreen = ({ reason, setReason, contact, setContact, sent, onSubmit, onCancel }) => {
  if (sent) {
    return (
      <div className="verify-screen">
        <div className="verify-card verify-card-center">
          <div className="verify-icon-lg green">
            <IconCheck width="32" height="32" />
          </div>
          <h2 className="verify-h2">Report submitted</h2>
          <p className="verify-lead">
            Thank you. Our team will review your report and take action.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="verify-screen">
      <div className="verify-card">
        <div className="verify-icon-lg amber">
          <IconWarning width="28" height="28" />
        </div>
        <h1 className="verify-h1 verify-h1-left">Report a Problem</h1>
        <p className="verify-lead verify-lead-left">
          Tell us what's wrong with this product. No login required — contact info is optional.
        </p>

        <form onSubmit={onSubmit} className="verify-form">
          <div className="verify-field">
            <label htmlFor="reason">What's the problem?</label>
            <textarea
              id="reason"
              rows="4"
              placeholder="e.g. The PIN was already scratched when I bought it, or I suspect this product is fake."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              required
            />
          </div>

          <div className="verify-field">
            <label htmlFor="contact">
              Contact (optional)
              <span className="verify-hint">Email or phone</span>
            </label>
            <input
              id="contact"
              type="text"
              placeholder="you@example.com"
              value={contact}
              onChange={(e) => setContact(e.target.value)}
            />
          </div>

          <div className="verify-actions">
            <button type="submit" className="verify-btn danger">
              Submit Report
            </button>
            <button type="button" className="verify-btn outline" onClick={onCancel}>
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};