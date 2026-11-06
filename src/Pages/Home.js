// src/Pages/Home.jsx
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Html5Qrcode } from 'html5-qrcode';
import { checkReferenceCode } from './verifyApi';
import Header from '../components/Header';
import '../App.css';

/* ============================================================
   Icons
   ============================================================ */
const IconArrowRight = (p) => (
  <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
    <path d="M5 12h14M13 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const IconShieldCheck = (p) => (
  <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
    <path d="M12 2L3 7V12C3 17.55 6.84 22.74 12 24C17.16 22.74 21 17.55 21 12V7L12 2Z" strokeLinejoin="round" />
    <path d="M9 12L11 14L15 10" strokeLinecap="round" strokeLinejoin="round" />
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

const IconX = (p) => (
  <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
    <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
  </svg>
);

const IconCheck = (p) => (
  <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8">
    <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const IconBadge = (p) => (
  <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="12" cy="9" r="6" />
    <path d="M9 12l2 2 4-4" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M8.5 14.5L7 22l5-3 5 3-1.5-7.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const IconLock = (p) => (
  <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="4" y="10" width="16" height="11" rx="2.5" />
    <path d="M8 10V7a4 4 0 018 0v3" strokeLinecap="round" />
  </svg>
);

const IconCamera = (p) => (
  <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M3 8a2 2 0 012-2h2l2-2h6l2 2h2a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2V8z" strokeLinejoin="round" />
    <circle cx="12" cy="13" r="4" />
  </svg>
);

const IconSparkle = (p) => (
  <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M12 2l1.9 5.7L20 9.6l-5.3 3.6 1.4 6.2L12 16.4 7.9 19.4l1.4-6.2L4 9.6l6.1-1.9z" strokeLinejoin="round" />
  </svg>
);

/* ============================================================
   Helpers — stop all media tracks in a container
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

  try { document.querySelectorAll('video').forEach(killVideo); } catch { /* ignore */ }
}

function detachScannerVideoHandlers(containerId) {
  try {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.querySelectorAll('video').forEach((v) => {
      try { v.onabort = null; } catch { /* ignore */ }
      try { v.onerror = null; } catch { /* ignore */ }
      try { v.onemptied = null; } catch { /* ignore */ }
      try { v.onstalled = null; } catch { /* ignore */ }
    });
  } catch { /* ignore */ }
}

/* ============================================================
   QR Scanner Modal
   ============================================================ */
const QrScannerModal = ({ onClose, onSuccess }) => {
  const [status, setStatus] = useState('starting');
  const [errorMsg, setErrorMsg] = useState('');
  const [foundCode, setFoundCode] = useState('');

  const scannerRef = useRef(null);
  const regionId = 'konfa-qr-scanner-region';
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

    detachScannerVideoHandlers(regionId);

    const s = scannerRef.current;
    if (s) {
      try {
        if (s.isScanning) await s.stop();
      } catch (err) {
        const msg = String(err?.message || err);
        if (
          !msg.includes('onabort') &&
          !msg.includes('abort') &&
          !msg.includes('RenderedCameraImpl')
        ) {
          console.warn('scanner.stop() error (non-fatal):', err);
        }
      }
      try { s.clear(); } catch { /* ignore */ }
    }

    await new Promise((resolve) => setTimeout(resolve, 80));
    detachScannerVideoHandlers(regionId);
    stopAllMediaTracks(regionId);
    scannerRef.current = null;
  };

  const handleValidProduct = async (refCode) => {
    await shutdownScanner();
    setStatus('success');
    setFoundCode(refCode);
    navigateTimerRef.current = setTimeout(() => {
      try { onSuccessRef.current?.(refCode); } catch (err) { console.error(err); }
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
              'That QR code does not look like a Varyfai product code. Please try a different product.'
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
        () => { /* Per-frame decode errors are normal — ignore */ }
      );

      setTimeout(() => {
        try {
          const container = document.getElementById(regionId);
          const video = container?.querySelector('video');
          if (video?.srcObject) window.__konfaActiveStream = video.srcObject;
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
      setTimeout(() => {
        detachScannerVideoHandlers(regionId);
        stopAllMediaTracks(regionId);
      }, 100);
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
    onCloseRef.current?.();
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
    <div className="qr-scanner-overlay">
      <div className="qr-scanner-modal">
        <div className="qr-scanner-header">
          <div className="qr-scanner-header-text">
            <h3>Scan Product QR Code</h3>
            <p>{statusText}</p>
          </div>
          <button
            className="qr-scanner-close"
            onClick={handleClose}
            aria-label="Close scanner"
            title="Close scanner"
          >
            <IconX width="16" height="16" />
          </button>
        </div>

        <div className="qr-scanner-stage">
          <div
            id={regionId}
            className="qr-scanner-region"
            style={{
              display: status === 'error' || status === 'success' ? 'none' : 'block',
            }}
          />

          {status === 'scanning' && (
            <>
              <div className="qr-scan-frame">
                <span className="qr-scan-corner qr-scan-tl" />
                <span className="qr-scan-corner qr-scan-tr" />
                <span className="qr-scan-corner qr-scan-bl" />
                <span className="qr-scan-corner qr-scan-br" />
              </div>
              <div className="qr-scan-laser" />
            </>
          )}

          {status === 'starting' && (
            <div className="qr-checking-overlay">
              <div className="qr-checking-spinner" />
              <p>Opening camera…</p>
            </div>
          )}

          {status === 'checking' && (
            <div className="qr-checking-overlay">
              <div className="qr-checking-spinner" />
              <p>Verifying product code…</p>
              {foundCode && (
                <span className="qr-checking-code">{foundCode}</span>
              )}
            </div>
          )}

          {status === 'success' && (
            <div className="qr-success-state">
              <div className="qr-success-icon">
                <IconCheck width="34" height="34" />
              </div>
              <p className="qr-success-title">Product found</p>
              {foundCode && (
                <span className="qr-success-code">{foundCode}</span>
              )}
              <p className="qr-success-hint">Taking you to the PIN entry…</p>
            </div>
          )}

          {status === 'error' && (
            <div className="qr-error-state">
              <div className="qr-error-icon">!</div>
              <p className="qr-error-message">{errorMsg}</p>
              <div className="qr-error-actions">
                <button className="qr-btn qr-btn-primary" onClick={handleRetry}>
                  Try again
                </button>
              </div>
            </div>
          )}
        </div>

        {status === 'scanning' && (
          <div className="qr-scanner-hint">
            <IconQr width="16" height="16" />
            <span>Hold steady. The code is detected automatically.</span>
          </div>
        )}

        {(status === 'scanning' || status === 'starting' || status === 'error') && (
          <div className="qr-scanner-actions">
            <button
              type="button"
              className="qr-cancel-btn"
              onClick={handleClose}
            >
              <IconX width="18" height="18" />
              Cancel scanning
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

/* ============================================================
   Helpers for QR code text extraction
   ============================================================ */
function extractReferenceCode(text) {
  if (!text) return null;

  const raw = String(text)
    .replace(/[\s\u00A0\u1680\u2000-\u200D\u2028\u2029\u202F\u205F\u2060\uFEFF]+/g, '')
    .trim();

  if (!raw) return null;

  try {
    const url = new URL(raw);
    const codeFromUrl =
      url.searchParams.get('code') ||
      url.searchParams.get('ref') ||
      url.searchParams.get('c') ||
      url.searchParams.get('refCode');
    if (codeFromUrl) {
      return normalizeKonfaCode(codeFromUrl);
    }
  } catch { /* not a URL */ }

  return normalizeKonfaCode(raw);
}

function normalizeKonfaCode(input) {
  const cleaned = String(input)
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');

  if (cleaned.length === 8) {
    return `${cleaned.slice(0, 4)}-${cleaned.slice(4)}`;
  }

  if (cleaned.length > 8) {
    const slice = cleaned.slice(0, 8);
    return `${slice.slice(0, 4)}-${slice.slice(4)}`;
  }

  return cleaned || null;
}

/* ============================================================
   Home component
   ============================================================ */
const KonfaHomepage = ({ onNavigate }) => {
  const navigate = useNavigate();

  const [referenceCode, setReferenceCode] = useState('');
  const [pin, setPin] = useState('');
  const [showScannerModal, setShowScannerModal] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [inlineError, setInlineError] = useState(null);

  const [locationBlocked, setLocationBlocked] = useState(false);

  const hasNavigatedRef = useRef(false);
  const lastKnownCoordsRef = useRef(null);

  /* ---------- lock body scroll while scanner is open ---------- */
  useEffect(() => {
    document.body.style.overflow = showScannerModal ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [showScannerModal]);

  /* ---------- escape key closes scanner ---------- */
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') setShowScannerModal(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  /* ---------- pre-fetch geolocation (best effort) ---------- */
  useEffect(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setLocationBlocked(true);
      return;
    }

    let cancelled = false;

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (cancelled) return;
        lastKnownCoordsRef.current = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy ?? null,
        };
        setLocationBlocked(false);
      },
      () => {
        if (cancelled) return;
        setLocationBlocked(true);
      },
      { enableHighAccuracy: false, timeout: 5000, maximumAge: 300000 }
    );

    return () => {
      cancelled = true;
    };
  }, []);

  const proceedToVerify = (coords = null) => {
    setVerifying(true);
    setInlineError(null);

    try {
      sessionStorage.setItem(
        'konfa_prefill',
        JSON.stringify({ referenceCode, pin, coords })
      );
    } catch { /* ignore */ }

    setTimeout(() => {
      setVerifying(false);
      navigate('/verify');
    }, 300);
  };

  const requestLocationBestEffort = () =>
    new Promise((resolve) => {
      if (typeof navigator === 'undefined' || !navigator.geolocation) {
        resolve(null);
        return;
      }

      const attempt = (opts, nextAttempt) => {
        let done = false;
        const timer = setTimeout(() => {
          if (done) return;
          done = true;
          if (nextAttempt) nextAttempt();
        }, (opts.timeout || 5000) + 500);

        navigator.geolocation.getCurrentPosition(
          (pos) => {
            if (done) return;
            done = true;
            clearTimeout(timer);
            resolve({
              lat: pos.coords.latitude,
              lng: pos.coords.longitude,
              accuracy: pos.coords.accuracy ?? null,
            });
          },
          () => {
            if (done) return;
            done = true;
            clearTimeout(timer);
            if (nextAttempt) nextAttempt();
          },
          opts
        );
      };

      attempt(
        { enableHighAccuracy: false, timeout: 3000, maximumAge: 300000 },
        () => {
          attempt(
            { enableHighAccuracy: false, timeout: 8000, maximumAge: 60000 },
            () => resolve(null)
          );
        }
      );
    });

  const handleVerify = async (e) => {
    e.preventDefault();
    if (!referenceCode || pin.length !== 6) return;

    setVerifying(true);
    setInlineError(null);

    let coords = lastKnownCoordsRef.current || null;

    if (!coords) {
      coords = await requestLocationBestEffort();
      if (coords) {
        lastKnownCoordsRef.current = coords;
      }
    }

    if (!coords) {
      setLocationBlocked(true);
      console.info(
        'Location unavailable — proceeding without coordinates. ' +
          'The scan will be logged with reduced certainty.'
      );
    } else {
      setLocationBlocked(false);
    }

    proceedToVerify(coords);
  };

  const handleQrSuccess = (refCode) => {
    if (hasNavigatedRef.current) return;
    hasNavigatedRef.current = true;

    const coords = lastKnownCoordsRef.current || null;

    try {
      sessionStorage.setItem(
        'konfa_prefill',
        JSON.stringify({ referenceCode: refCode, pin: '', coords })
      );
    } catch (err) {
      console.warn('Could not save prefill:', err);
    }

    setShowScannerModal(false);

    setTimeout(() => {
      navigate('/verify');
    }, 50);
  };

  const goToVerifyPage = () => navigate('/verify');
  const goToSellerPortal = () => navigate('/seller/login');
  const goToConsumerLogin = () => navigate('/consumer/login');
  const goToManufacturerPortal = () => navigate('/manufacturer/login');
  const goToBrandSignup = () => navigate('/brand/signup');
  const goToVerifyLookup = () => navigate('/verify-lookup');

  const scrollToVerify = () => {
    document.getElementById('verify-section')?.scrollIntoView({ behavior: 'smooth' });
  };

  const openQrScanner = () => {
    hasNavigatedRef.current = false;
    setShowScannerModal(true);
  };

  return (
    <div className="homepage">
      {/* ============================================================
          HEADER — reusable component
          ============================================================ */}
      <Header
        onNavigate={(path) => {
          if (typeof onNavigate === 'function') onNavigate(path);
          else navigate(path);
        }}
        onScanRequest={openQrScanner}
        sticky
      />

      {/* ============================================================
          HERO
          ============================================================ */}
      <header className="hero" id="home">
        <div className="hero-bg">
          <div className="hero-gradient-orb orb-1"></div>
          <div className="hero-gradient-orb orb-2"></div>
          <div className="hero-grid"></div>
        </div>

        <div className="hero-inner">
          <div className="hero-content">
            {/* Desktop badge */}
            <div className="hero-badge hide-mobile">
              <span className="badge-dot"></span>
              Trusted by 500+ brands worldwide
            </div>

            {/* Mobile badge strip */}
            <div className="hero-mobile-credentials hide-desktop">
              <span className="hero-mobile-cred">
                <IconShieldCheck width="12" height="12" />
                Bank-grade verification
              </span>
              <span className="hero-mobile-cred-divider" />
              <span className="hero-mobile-cred">
                <IconSparkle width="12" height="12" />
                2M+ products verified
              </span>
            </div>

            <h1 className="hero-title">
              <span className="hero-title-line">Buy with Confidence</span>
              <span className="hero-highlight">
                Know who you trust.
                <svg
                  className="highlight-underline"
                  viewBox="0 0 300 12"
                  preserveAspectRatio="none"
                >
                  <path
                    d="M2 8 Q 75 2, 150 6 T 298 4"
                    stroke="currentColor"
                    strokeWidth="3"
                    fill="none"
                    strokeLinecap="round"
                  />
                </svg>
              </span>
            </h1>

            <p className="hero-subtitle">
              Varyfai helps you confirm that the product in your hands is genuine —
              quickly, clearly, and without guesswork.
            </p>

            {/* Desktop actions - PROFESSIONAL GRID */}
            <div className="hero-actions hide-mobile">
              <button className="btn btn-primary" onClick={openQrScanner}>
                <IconQr width="18" height="18" />
                Scan QR Code
              </button>
              
              <button className="btn btn-secondary" onClick={scrollToVerify}>
                Enter Manually
                <IconArrowRight width="16" height="16" />
              </button>
              
              <button className="btn btn-lookup" onClick={goToVerifyLookup}>
                <IconShieldCheck width="18" height="18" />
                Verify a Seller / Brand
              </button>
              
              <button className="btn btn-brand" onClick={goToBrandSignup}>
                <IconBadge width="18" height="18" />
                Get your brand verified
              </button>
            </div>

            {/* Mobile actions — uniform compact buttons */}
            <div className="hero-actions-mobile hide-desktop">
              <button className="hero-action-btn hero-action-btn--primary" onClick={openQrScanner}>
                <span className="hero-action-icon">
                  <IconQr width="18" height="18" />
                </span>
                <span className="hero-action-label">Scan QR Code</span>
                <span className="hero-action-arrow">
                  <IconArrowRight width="16" height="16" />
                </span>
              </button>

              <button className="hero-action-btn hero-action-btn--lookup" onClick={goToVerifyLookup}>
                <span className="hero-action-icon">
                  <IconShieldCheck width="18" height="18" />
                </span>
                <span className="hero-action-label">Verify a Seller / Brand</span>
                <span className="hero-action-arrow">
                  <IconArrowRight width="16" height="16" />
                </span>
              </button>

              <div className="hero-mobile-or">
                <span>or</span>
              </div>

              <button className="hero-action-btn hero-action-btn--manual" onClick={scrollToVerify}>
                <span className="hero-action-icon">
                  <IconLock width="16" height="16" />
                </span>
                <span className="hero-action-label">Enter codes manually</span>
              </button>

              <button className="hero-action-btn hero-action-btn--brand" onClick={goToBrandSignup}>
                <span className="hero-action-icon">
                  <IconBadge width="16" height="16" />
                </span>
                <span className="hero-action-label">Get your brand verified</span>
              </button>
            </div>

            {/* Desktop stats - PROFESSIONAL TRUST BAR */}
            <div className="hero-stats hide-mobile">
              <div className="stat">
                <span className="stat-value">2M+</span>
                <span className="stat-label">Products Verified</span>
              </div>
              <div className="stat-divider"></div>
              <div className="stat">
                <span className="stat-value">500+</span>
                <span className="stat-label">Trusted Brands</span>
              </div>
              <div className="stat-divider"></div>
              <div className="stat">
                <span className="stat-value">99.9%</span>
                <span className="stat-label">Accuracy Rate</span>
              </div>
            </div>
          </div>

          {/* Desktop visual */}
          <div className="hero-visual hide-mobile">
            <div className="visual-halo"></div>
            <div className="visual-card card-1">
              <div className="card-header">
                <div className="status-dot success"></div>
                <span>Authentic</span>
              </div>
              <div className="card-body">
                <div className="mini-qr">
                  <svg viewBox="0 0 100 100" width="60" height="60">
                    <rect width="100" height="100" fill="#ffffff" />
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
                <div className="card-info">
                  <div className="info-line"></div>
                  <div className="info-line short"></div>
                </div>
              </div>
            </div>

            <div className="visual-card card-2">
              <div className="pin-display">
                <span className="pin-label">Scratch-off PIN</span>
                <div className="pin-dots">
                  <span>4</span>
                  <span>7</span>
                  <span>9</span>
                  <span>2</span>
                  <span>•</span>
                  <span>•</span>
                </div>
              </div>
            </div>

            <div className="visual-card card-3">
              <div className="journey-map">
                <div className="journey-dot active"></div>
                <div className="journey-line"></div>
                <div className="journey-dot"></div>
                <div className="journey-line"></div>
                <div className="journey-dot"></div>
              </div>
              <span className="journey-label">Product Journey</span>
            </div>
          </div>
        </div>
      </header>

      {/* ============================================================
          TRUST BAR — desktop
          ============================================================ */}
      <section className="trust-bar hide-mobile">
        <p className="trust-text">Trusted by leading brands across Africa</p>
        <div className="trust-logos">
          <span className="trust-logo">XYZ Foods</span>
          <span className="trust-logo">PharmaPlus</span>
          <span className="trust-logo">AgroFresh</span>
          <span className="trust-logo">BeautyCare</span>
          <span className="trust-logo">TechGuard</span>
        </div>
      </section>

      {/* ============================================================
          MOBILE TRUST STRIP — horizontal scroll pills
          ============================================================ */}
      <section className="trust-strip-mobile hide-desktop">
        <div className="trust-strip-label">
          <span className="trust-strip-dot" />
          Trusted across Africa
        </div>
        <div className="trust-strip-scroll">
          <span className="trust-pill">XYZ Foods</span>
          <span className="trust-pill">PharmaPlus</span>
          <span className="trust-pill">AgroFresh</span>
          <span className="trust-pill">BeautyCare</span>
          <span className="trust-pill">TechGuard</span>
          <span className="trust-pill">Others</span>
        </div>
      </section>

      {/* ============================================================
          VERIFY SECTION
          ============================================================ */}
      <section className="verify-section" id="verify-section">
        <div className="verify-container">
          <div className="verify-header">
            <span className="section-tag">Verify</span>
            <h2 className="verify-title">Check your product in seconds</h2>
            <p className="verify-subtitle">
              Scan the QR code with your camera, or enter the codes manually below.
            </p>
          </div>

          <div className="verify-grid">
            <div className="verify-form-wrapper">
              <button
                type="button"
                className="btn btn-verify-scan"
                onClick={openQrScanner}
              >
                <span className="btn-verify-scan-icon">
                  <IconCamera width="20" height="20" />
                </span>
                <span>Scan QR Code with Camera</span>
                <span className="btn-verify-scan-arrow">
                  <IconArrowRight width="18" height="18" />
                </span>
              </button>

              <div className="verify-divider">
                <span>or enter codes manually</span>
              </div>

              <form className="verify-form" onSubmit={handleVerify}>
                <div className="form-group">
                  <label htmlFor="referenceCode">
                    Reference Code
                    <span className="label-hint">Printed under the QR code</span>
                  </label>
                  <input
                    type="text"
                    id="referenceCode"
                    placeholder="XBAK-7Q2M"
                    value={referenceCode}
                    onChange={(e) =>
                      setReferenceCode(e.target.value.toUpperCase())
                    }
                    maxLength={9}
                    className="form-input"
                    autoComplete="off"
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="pin">
                    Scratch-off PIN
                    <span className="label-hint">Hidden under the panel</span>
                  </label>
                  <input
                    type="text"
                    id="pin"
                    placeholder="• • • • • •"
                    value={pin}
                    onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                    maxLength={6}
                    className="form-input pin-input"
                    inputMode="numeric"
                    autoComplete="off"
                  />
                </div>

                <button
                  type="submit"
                  className="btn btn-verify"
                  disabled={!referenceCode || pin.length !== 6 || verifying}
                >
                  {verifying ? 'Opening…' : 'Verify Product'}
                  <IconArrowRight width="18" height="18" />
                </button>

                {inlineError && (
                  <p className="form-error" role="alert">
                    {inlineError}
                  </p>
                )}
              </form>
            </div>

            <div className="verify-help hide-mobile">
              <div className="help-card">
                <div className="help-icon">
                  <IconQr width="22" height="22" />
                </div>
                <h3>Fastest way — scan the QR</h3>
                <p>
                  Point your camera at the QR code on the product's label. We'll check
                  the code for you instantly and take you straight to the PIN step.
                </p>
              </div>

              <div className="help-card secondary">
                <div className="help-icon">
                  <IconShieldCheck width="22" height="22" />
                </div>
                <h3>Why two codes?</h3>
                <p>
                  The barcode alone can be copied. The secret PIN proves you're
                  holding the <em>real</em> product in your hands.
                </p>
              </div>
            </div>
          </div>

          {/* Mobile reassurance row */}
          <div className="verify-reassurance hide-desktop">
            <div className="verify-reassurance-item">
              <IconLock width="14" height="14" />
              <span>Your scans stay private</span>
            </div>
            <span className="verify-reassurance-sep" />
            <div className="verify-reassurance-item">
              <IconShieldCheck width="14" height="14" />
              <span>Verified against the source</span>
            </div>
          </div>
        </div>
      </section>

      {/* ============================================================
          ABOUT ANCHOR — invisible target for the header's "About" link
          ============================================================ */}
      <span
        id="about"
        style={{ display: 'block', height: 0, margin: 0, padding: 0 }}
        aria-hidden="true"
      />

      {/* ============================================================
          BRAND CTA
          ============================================================ */}
      <section className="brand-cta-section" id="brands">
        <div className="brand-cta-container">
          <div className="brand-cta-content">
            <div className="brand-cta-badge">
              <IconBadge width="18" height="18" />
              For public figures &amp; brands
            </div>
            <h2>Get your brand verified</h2>
            <p>
              Public figures, artists, ministries, event organizers, and
              businesses can prove their identity on Varyfai and share a link
              nobody can fake.
            </p>
            <button className="btn btn-brand-cta" onClick={goToBrandSignup}>
              Get your brand verified
              <IconArrowRight width="16" height="16" />
            </button>
          </div>
        </div>
      </section>

      {/* ============================================================
          MOBILE STEPS — visible on mobile
          ============================================================ */}
      <section className="mobile-steps hide-desktop">
        <div className="mobile-steps-header">
          <span className="section-tag">How it works</span>
          <h2>Three steps to certainty</h2>
        </div>

        <ol className="mobile-steps-list">
          <li className="mobile-step">
            <span className="mobile-step-num">1</span>
            <div className="mobile-step-body">
              <strong>Scan the QR code</strong>
              <p>Point your camera at the label — no app download needed.</p>
            </div>
          </li>
          <li className="mobile-step">
            <span className="mobile-step-num">2</span>
            <div className="mobile-step-body">
              <strong>Scratch &amp; enter the PIN</strong>
              <p>Type the 6-digit code hidden under the panel.</p>
            </div>
          </li>
          <li className="mobile-step">
            <span className="mobile-step-num">3</span>
            <div className="mobile-step-body">
              <strong>Get your answer</strong>
              <p>See instantly if the product is authentic — or suspicious.</p>
            </div>
          </li>
        </ol>
      </section>

      {/* ============================================================
          HOW IT WORKS — desktop
          ============================================================ */}
      <section className="how-it-works hide-mobile">
        <div className="section-container">
          <div className="section-header">
            <span className="section-tag">How It Works</span>
            <h2 className="section-title">
              Simple for you. Powerful for everyone.
            </h2>
            <p className="section-subtitle">
              Three quick steps and you'll know whether your product is genuine.
            </p>
          </div>

          <div className="steps-grid three-col">
            <div className="step-card">
              <div className="step-number">01</div>
              <div className="step-icon">
                <IconQr width="28" height="28" />
              </div>
              <h3>Scan the QR code</h3>
              <p>
                Open the scanner on this page and point it at the QR code printed on
                the product's label. No app download needed.
              </p>
            </div>

            <div className="step-card">
              <div className="step-number">02</div>
              <div className="step-icon">
                <svg
                  width="28"
                  height="28"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                >
                  <rect x="3" y="4" width="18" height="16" rx="2.5" />
                  <path d="M7 9h2M13 9h4M7 13h10M7 17h6" strokeLinecap="round" />
                </svg>
              </div>
              <h3>Enter the scratch-off PIN</h3>
              <p>
                Scratch the panel on your product and type in the secret 6-digit
                code you find underneath.
              </p>
            </div>

            <div className="step-card">
              <div className="step-number">03</div>
              <div className="step-icon">
                <svg
                  width="28"
                  height="28"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                >
                  <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <h3>Get your answer</h3>
              <p>
                See clearly whether the product is authentic, or whether something
                is worth a closer look.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ============================================================
          RESULTS SECTION
          ============================================================ */}
      <section className="results-section hide-mobile">
        <div className="section-container">
          <div className="section-header">
            <span className="section-tag">Clear Results</span>
            <h2 className="section-title">
              Know exactly what you're holding
            </h2>
            <p className="section-subtitle">
              No jargon. No ambiguity. Just a clear answer about your product.
            </p>
          </div>

          <div className="results-grid">
            <div className="result-card authentic">
              <div className="result-badge">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8">
                  <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Authentic
              </div>
              <p>This product is genuine and verified. You're good to go.</p>
            </div>

            <div className="result-card expected">
              <div className="result-badge">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M12 6v6l4 2" strokeLinecap="round" />
                </svg>
                Expected
              </div>
              <p>
                We have a record that this product is on its way here, but it hasn't
                been confirmed yet.
              </p>
            </div>

            <div className="result-card suspicious">
              <div className="result-badge">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" strokeLinejoin="round" />
                  <path d="M12 9v4M12 17h.01" strokeLinecap="round" />
                </svg>
                Suspicious
              </div>
              <p>
                The code is correct, but something doesn't add up. Our team will
                take a closer look.
              </p>
            </div>

            <div className="result-card not-released">
              <div className="result-badge">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M4.93 4.93l14.14 14.14" strokeLinecap="round" />
                </svg>
                Not Released
              </div>
              <p>
                This code exists, but it was never confirmed as ready for sale.
                That's a strong warning sign.
              </p>
            </div>

            <div className="result-card invalid">
              <div className="result-badge">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M15 9l-6 6M9 9l6 6" strokeLinecap="round" />
                </svg>
                Invalid
              </div>
              <p>This code doesn't match our records, or the PIN is incorrect.</p>
            </div>
          </div>
        </div>
      </section>

      {/* ============================================================
          WHY VAR YFAI
          ============================================================ */}
      <section className="features-section hide-mobile">
        <div className="section-container">
          <div className="features-grid">
            <div className="features-content">
              <span className="section-tag">Why Varyfai</span>
              <h2 className="section-title">
                Peace of mind, built into every product
              </h2>
              <p className="features-intro">
                Varyfai gives you a simple way to check what you're buying — and gives
                brands a powerful way to protect their reputation.
              </p>

              <ul className="features-list">
                <li>
                  <div className="feature-check">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5">
                      <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                  <div>
                    <strong>Verify in seconds</strong>
                    <span>No app, no account, no hassle. Just scan, scratch, and know.</span>
                  </div>
                </li>
                <li>
                  <div className="feature-check">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5">
                      <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                  <div>
                    <strong>Built for real-world products</strong>
                    <span>From sachets to cartons, Varyfai works across packaging types.</span>
                  </div>
                </li>
                <li>
                  <div className="feature-check">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5">
                      <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                  <div>
                    <strong>Clear, honest answers</strong>
                    <span>We tell you what we know — and when we don't know, we say so.</span>
                  </div>
                </li>
                <li>
                  <div className="feature-check">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5">
                      <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                  <div>
                    <strong>Privacy respected</strong>
                    <span>We never expose more than you need to see to make a decision.</span>
                  </div>
                </li>
              </ul>
            </div>

            <div className="features-visual">
              <div className="feature-card-stack">
                <div className="stack-card stack-back"></div>
                <div className="stack-card stack-mid"></div>
                <div className="stack-card stack-front">
                  <div className="stack-card-header">
                    <div className="stack-dot"></div>
                    <span>Verified</span>
                  </div>
                  <div className="stack-qr">
                    <svg viewBox="0 0 100 100" width="96" height="96">
                      <rect width="100" height="100" fill="#ffffff" />
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
                  <div className="stack-card-footer">
                    <div className="stack-line"></div>
                    <div className="stack-line short"></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============================================================
          MANUFACTURER CTA — Premium Enterprise Block
          ============================================================ */}
      <section className="cta-section hide-mobile" id="manufacturers">
        <div className="cta-bg">
          <div className="cta-orb cta-orb-1"></div>
          <div className="cta-orb cta-orb-2"></div>
        </div>
        <div className="cta-container">
          <div className="cta-split">
            
            {/* Left: Content */}
            <div className="cta-content">
              <span className="cta-tag">
                <IconBadge width="14" height="14" />
                For Manufacturers
              </span>
              <h2>Protect your products with Varyfai</h2>
              <p>
                Join forward-thinking manufacturers who trust Varyfai to protect their 
                products, their customers, and their reputation.
              </p>
              <div className="cta-actions">
                <button className="btn btn-white" onClick={goToManufacturerPortal}>
                  <span>Get Started</span>
                  <IconArrowRight width="18" height="18" />
                </button>
                <button className="btn btn-ghost" onClick={goToManufacturerPortal}>
                  Talk to Sales
                </button>
              </div>
            </div>

            {/* Right: Custom Visual Graphic */}
            <div className="cta-visual">
              <div className="cta-graphic-card">
                <div className="cta-graphic-header">
                  <div className="cta-graphic-icon">
                    <IconShieldCheck width="24" height="24" />
                  </div>
                  <div className="cta-graphic-lines">
                    <div className="cta-g-line long"></div>
                    <div className="cta-g-line short"></div>
                  </div>
                </div>
                <div className="cta-graphic-body">
                  <div className="cta-g-badge">
                    <span className="cta-g-dot"></span>
                    Brand Verified
                  </div>
                </div>
              </div>
              <div className="cta-floating-ring"></div>
            </div>

          </div>
        </div>
      </section>

      {/* ============================================================
          FOOTER — Premium Modern Layout
          ============================================================ */}
      <footer className="footer" id="contact">
        <div className="footer-container">
          
          {/* Top: Brand & Tagline */}
          <div className="footer-top">
            <a href="/" className="nav-brand">
              <span className="brand-name brand-name-footer">Varyfai</span>
            </a>
            <p className="footer-tagline">
              Helping people know what they're buying — and brands protect what
              they've built.
            </p>
          </div>

          {/* Middle: Links Grid */}
          <div className="footer-grid hide-mobile">
            <div className="footer-column">
              <h4>Platform</h4>
              <a href="#verify" onClick={(e) => { e.preventDefault(); goToVerifyPage(); }}>Verify a Product</a>
              <a href="#lookup" onClick={(e) => { e.preventDefault(); goToVerifyLookup(); }}>Verify a Seller / Brand</a>
              <a href="#brands" onClick={(e) => { e.preventDefault(); goToBrandSignup(); }}>Get your brand verified</a>
              <a href="#manufacturers" onClick={(e) => { e.preventDefault(); goToManufacturerPortal(); }}>For Manufacturers</a>
              <a href="#sellers" onClick={(e) => { e.preventDefault(); goToSellerPortal(); }}>For Sellers</a>
            </div>
            
            <div className="footer-column">
              <h4>Company</h4>
              <a href="#about">About Us</a>
              <a href="#careers">Careers</a>
              <a href="#press">Press</a>
              <a href="#contact">Contact</a>
            </div>
            
            <div className="footer-column">
              <h4>Legal</h4>
              <a href="#privacy">Privacy Policy</a>
              <a href="#terms">Terms of Service</a>
              <a href="#security">Security</a>
              <a href="#compliance">Compliance</a>
            </div>
          </div>

          {/* Mobile Compact Links */}
          <div className="footer-mobile-compact hide-desktop">
            <button onClick={goToVerifyPage}>Verify a Product</button>
            <button onClick={goToVerifyLookup}>Verify a Seller / Brand</button>
            <button onClick={goToBrandSignup}>Get your brand verified</button>
            <button onClick={goToConsumerLogin}>Sign in</button>
          </div>

          {/* Bottom: Socials & Copyright */}
          <div className="footer-bottom">
            <div className="footer-social">
              <a href="#twitter" aria-label="Twitter">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                </svg>
              </a>
              <a href="#linkedin" aria-label="LinkedIn">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
                </svg>
              </a>
              <a href="#github" aria-label="GitHub">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
                </svg>
              </a>
            </div>
            <div className="footer-legal">
              <p>© 2025 Varyfai. All rights reserved.</p>
              <span className="footer-dot">•</span>
              <p className="footer-made">Made with care for authentic products everywhere.</p>
            </div>
          </div>

        </div>
      </footer>

      {showScannerModal && (
        <QrScannerModal
          onClose={() => setShowScannerModal(false)}
          onSuccess={handleQrSuccess}
        />
      )}
    </div>
  );
};

export default KonfaHomepage;