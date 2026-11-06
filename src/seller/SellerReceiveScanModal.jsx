// src/seller/SellerReceiveScanModal.jsx
// ============================================================
// Camera-based scanner used inside SellerReceive.
// ============================================================

import { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { receiveUnitByQr, parseQrToReferenceCode } from './sellerAuth';

const REGION_ID = 'konfa-seller-receive-region';

const IconX = (p) => (
  <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
    <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
  </svg>
);

const IconCheck = (p) => (
  <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
    <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

/**
 * Detach the onabort/onerror handlers from any <video> inside the
 * scanner region. html5-qrcode attaches its own handlers that
 * throw when the camera stops; we remove them before cleanup so
 * React's dev overlay doesn't catch a spurious abort error.
 */
function detachVideoHandlers(containerId) {
  try {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.querySelectorAll('video').forEach((video) => {
      try { video.onabort = null; } catch { /* ignore */ }
      try { video.onerror = null; } catch { /* ignore */ }
      try { video.onemptied = null; } catch { /* ignore */ }
      try { video.onstalled = null; } catch { /* ignore */ }
    });
  } catch { /* ignore */ }
}

/** Stop media tracks and remove the video element. */
function killVideos(containerId) {
  try {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.querySelectorAll('video').forEach((video) => {
      try {
        const stream = video.srcObject;
        if (stream && typeof stream.getTracks === 'function') {
          stream.getTracks().forEach((t) => {
            try { t.stop(); } catch { /* ignore */ }
          });
        }
      } catch { /* ignore */ }
      try { video.srcObject = null; } catch { /* ignore */ }
      try { video.pause(); } catch { /* ignore */ }
      try { video.remove(); } catch { /* ignore */ }
    });
  } catch { /* ignore */ }
}

const SellerReceiveScanModal = ({
  sellerId,
  shipmentId = null,
  regionLabel = 'Unknown',
  onClose,
  onSuccess,
  onFailure,
}) => {
  const [status, setStatus] = useState('starting');
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [lastCode, setLastCode] = useState('');

  const scannerRef = useRef(null);
  const handledRef = useRef(false);
  const stoppedRef = useRef(false);
  const onCloseRef = useRef(onClose);
  const onSuccessRef = useRef(onSuccess);
  const onFailureRef = useRef(onFailure);
  const timerRef = useRef(null);

  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);
  useEffect(() => { onSuccessRef.current = onSuccess; }, [onSuccess]);
  useEffect(() => { onFailureRef.current = onFailure; }, [onFailure]);

  // ------------------------------------------------------------
  // Shutdown — the tricky part.
  //
  // The order matters:
  //   1. Detach the video's onabort/onerror handlers so the
  //      library's internal handler can't fire when we stop.
  //   2. Call scanner.stop() inside a try/catch that swallows
  //      the "onabort called" error if the library still throws.
  //   3. Clean up any leftover video elements.
  // ------------------------------------------------------------
  const shutdown = async () => {
    if (stoppedRef.current) return;
    stoppedRef.current = true;

    // Step 1: detach handlers FIRST.
    detachVideoHandlers(REGION_ID);

    const s = scannerRef.current;
    if (s) {
      try {
        if (s.isScanning) await s.stop();
      } catch (err) {
        // html5-qrcode throws "RenderedCameraImpl video surface
        // onabort() called" when the video is stopped. It is
        // harmless — the scan already succeeded or the user is
        // closing the modal. Swallow it.
        const msg = String(err?.message || err);
        if (
          msg.includes('onabort') ||
          msg.includes('abort') ||
          msg.includes('RenderedCameraImpl')
        ) {
          // known noisy error — ignore
        } else {
          console.warn('scanner.stop() error (non-fatal):', err);
        }
      }
      try {
        s.clear();
      } catch { /* ignore */ }
    }

    // Step 2: give the DOM a tick to settle, then remove any
    // remaining video elements and detach handlers again in case
    // the library re-attached them during stop().
    await new Promise((r) => setTimeout(r, 80));
    detachVideoHandlers(REGION_ID);
    killVideos(REGION_ID);

    scannerRef.current = null;
  };

  const startScanner = async () => {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Your browser does not support camera access.');
      }

      const scanner = new Html5Qrcode(REGION_ID, { verbose: false });
      scannerRef.current = scanner;

      const cameras = await Html5Qrcode.getCameras();
      if (!cameras || cameras.length === 0) {
        throw new Error('No camera found on this device.');
      }

      const rear = cameras.find((c) =>
        /back|rear|environment/i.test(c.label || '')
      );
      const cameraId = rear ? rear.id : cameras[0].id;

      await scanner.start(
        cameraId,
        { fps: 10, qrbox: { width: 250, height: 250 }, aspectRatio: 1.0 },
        async (decodedText) => {
          if (handledRef.current) return;
          handledRef.current = true;

          const refCode = parseQrToReferenceCode(decodedText);
          setLastCode(refCode || decodedText);

          if (!refCode) {
            setStatus('error');
            setErrorMsg(
              'That QR code does not contain a Konfa reference. Please scan a valid product label.'
            );
            return;
          }

          setStatus('checking');

          try {
            const result = await receiveUnitByQr({
              sellerId,
              qrPayload: decodedText,
              shipmentId,
              regionLabel,
            });

            if (result.ok) {
              setStatus('success');
              setSuccessMsg(result.message || 'Unit received.');
              timerRef.current = setTimeout(() => {
                if (onSuccessRef.current) onSuccessRef.current(result);
              }, 900);
            } else if (result.reason === 'already_received') {
              setStatus('error');
              setErrorMsg(result.message || 'This unit was already received.');
            } else {
              setStatus('error');
              setErrorMsg(result.message || 'Could not receive this unit.');
            }
          } catch (err) {
            console.error('receiveUnitByQr failed:', err);
            setStatus('error');
            setErrorMsg('Something went wrong. Please try again.');
          }
        },
        () => { /* per-frame errors — ignore */ }
      );

      setStatus('scanning');
    } catch (err) {
      console.error('Camera start failed:', err);
      setStatus('error');
      setErrorMsg(
        err?.message ||
          'We could not access your camera. Please check permissions and try again.'
      );
    }
  };

  useEffect(() => {
    stoppedRef.current = false;
    handledRef.current = false;
    startScanner();

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      // Fire-and-forget cleanup. We deliberately don't await here
      // because unmount cannot be async; the shutdown sequence
      // detaches handlers before calling stop, so the library's
      // abort throw is neutralised.
      shutdown();
      setTimeout(() => {
        detachVideoHandlers(REGION_ID);
        killVideos(REGION_ID);
      }, 100);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleClose = async () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    await shutdown();
    if (onCloseRef.current) onCloseRef.current();
  };

  const handleGiveUp = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (onFailureRef.current) onFailureRef.current(errorMsg);
    handleClose();
  };

  const handleRetry = async () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    await shutdown();
    stoppedRef.current = false;
    handledRef.current = false;
    setErrorMsg('');
    setSuccessMsg('');
    setLastCode('');
    const region = document.getElementById(REGION_ID);
    if (region) region.innerHTML = '';
    setStatus('starting');
    setTimeout(startScanner, 350);
  };

  const headerText =
    status === 'scanning' ? 'Point at the QR code on the unit'
    : status === 'starting' ? 'Starting camera…'
    : status === 'checking' ? 'Checking unit…'
    : status === 'success' ? 'Unit received'
    : 'Something went wrong';

  return (
    <div className="seller-scan-overlay">
      <div className="seller-scan-modal">
        <div className="seller-scan-head">
          <div>
            <h3>Scan Unit to Receive</h3>
            <p>{headerText}</p>
          </div>
          <button
            className="seller-scan-close"
            onClick={handleClose}
            aria-label="Close scanner"
          >
            <IconX width="16" height="16" />
          </button>
        </div>

        <div className="seller-scan-stage">
          <div
            id={REGION_ID}
            className="seller-scan-region"
            style={{
              display:
                status === 'error' || status === 'success' ? 'none' : 'block',
            }}
          />

          {status === 'scanning' && (
            <>
              <div className="seller-scan-frame">
                <span className="seller-scan-corner seller-scan-tl" />
                <span className="seller-scan-corner seller-scan-tr" />
                <span className="seller-scan-corner seller-scan-bl" />
                <span className="seller-scan-corner seller-scan-br" />
              </div>
              <div className="seller-scan-laser" />
            </>
          )}

          {status === 'starting' && (
            <div className="seller-scan-center">
              <div className="seller-scan-spinner" />
              <p>Opening camera…</p>
            </div>
          )}

          {status === 'checking' && (
            <div className="seller-scan-center">
              <div className="seller-scan-spinner" />
              <p>Recording receipt…</p>
              {lastCode && <span className="seller-scan-code">{lastCode}</span>}
            </div>
          )}

          {status === 'success' && (
            <div className="seller-scan-success">
              <div className="seller-scan-success-icon">
                <IconCheck width="34" height="34" />
              </div>
              <p className="seller-scan-success-title">Unit received</p>
              {lastCode && <span className="seller-scan-code">{lastCode}</span>}
              <p className="seller-scan-success-hint">{successMsg}</p>
            </div>
          )}

          {status === 'error' && (
            <div className="seller-scan-error">
              <div className="seller-scan-error-icon">!</div>
              <p className="seller-scan-error-msg">{errorMsg}</p>
              <div className="seller-scan-error-actions">
                <button className="seller-scan-retry" onClick={handleRetry}>
                  Try again
                </button>
                <button className="seller-scan-giveup" onClick={handleGiveUp}>
                  Back
                </button>
              </div>
            </div>
          )}
        </div>

        {status === 'scanning' && (
          <div className="seller-scan-hint">
            Hold steady. The unit is captured automatically.
          </div>
        )}

        {(status === 'scanning' || status === 'starting' || status === 'error') && (
          <div className="seller-scan-actions">
            <button
              type="button"
              className="seller-scan-cancel"
              onClick={handleClose}
            >
              Cancel scanning
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default SellerReceiveScanModal;