// src/seller/verification/ShareQrModal.jsx
import { useEffect, useState, useRef } from 'react';
import QRCode from 'qrcode';

/* ============================================================
   Icons (inline — no external dependency)
   ============================================================ */
const IconClose = (p) => (
  <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
    <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
  </svg>
);

const IconShare = (p) => (
  <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="18" cy="5" r="3" />
    <circle cx="6" cy="12" r="3" />
    <circle cx="18" cy="19" r="3" />
    <path d="M8.59 13.51l6.83 3.98M15.41 6.51L8.59 10.49" strokeLinecap="round" />
  </svg>
);

const IconDownload = (p) => (
  <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const IconLink = (p) => (
  <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const IconCheck = (p) => (
  <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
    <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const IconShield = (p) => (
  <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
    <path d="M12 2L3 7V12C3 17.55 6.84 22.74 12 24C17.16 22.74 21 17.55 21 12V7L12 2Z" strokeLinejoin="round" />
    <path d="M9 12L11 14L15 10" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const IconInstagram = (p) => (
  <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="3" y="3" width="18" height="18" rx="5" />
    <circle cx="12" cy="12" r="4" />
    <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
  </svg>
);

const IconWhatsapp = (p) => (
  <svg {...p} viewBox="0 0 24 24" fill="currentColor">
    <path d="M17.5 14.4c-.3-.2-1.9-.9-2.2-1-.3-.1-.5-.2-.7.2-.2.3-.8 1-.9 1.2-.2.2-.3.2-.6.1-.3-.2-1.4-.5-2.6-1.6-1-.9-1.6-2-1.8-2.4-.2-.3 0-.5.1-.6l.4-.5c.1-.2.2-.3.3-.5 0-.2 0-.3 0-.5 0-.2-.7-1.8-1-2.4-.3-.6-.5-.5-.7-.5h-.6c-.2 0-.5.1-.8.4-.3.3-1 1-1 2.5s1.1 2.9 1.2 3.1c.1.2 2.1 3.2 5.1 4.5.7.3 1.3.5 1.7.6.7.2 1.4.2 1.9.1.6-.1 1.9-.8 2.1-1.5.3-.7.3-1.3.2-1.5-.1-.2-.3-.2-.6-.4zM12 2C6.5 2 2 6.5 2 12c0 1.8.5 3.4 1.3 4.9L2 22l5.3-1.3c1.4.8 3 1.3 4.7 1.3 5.5 0 10-4.5 10-10S17.5 2 12 2z" />
  </svg>
);

const IconTiktok = (p) => (
  <svg {...p} viewBox="0 0 24 24" fill="currentColor">
    <path d="M16.5 3c.3 1.9 1.6 3.3 3.5 3.6v2.7c-1.3 0-2.5-.4-3.5-1.1v5.7c0 3.3-2.7 6-6 6s-6-2.7-6-6 2.7-6 6-6c.3 0 .7 0 1 .1v2.8c-.3-.1-.6-.2-1-.2-1.8 0-3.2 1.4-3.2 3.2s1.4 3.2 3.2 3.2 3.2-1.4 3.2-3.2V3h2.8z" />
  </svg>
);

const IconBox = (p) => (
  <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M21 8l-9-5-9 5v8l9 5 9-5z" strokeLinejoin="round" />
    <path d="M3 8l9 5 9-5M12 13v9M7.5 5.5l9 5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const IconStore = (p) => (
  <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M3 9l1.5-5h15L21 9M3 9v10a2 2 0 002 2h14a2 2 0 002-2V9M3 9h18M8 13h8" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const IconArrow = (p) => (
  <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
    <path d="M5 12h14M13 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

/* ============================================================
   Share helper — uses native share sheet when available,
   falls back to clipboard on desktop / unsupported browsers.
   ============================================================ */
async function shareQrCode({ url, title, text, qrDataUrl }) {
  if (!url) return 'failed';

  let file = null;
  if (qrDataUrl) {
    try {
      const res = await fetch(qrDataUrl);
      const blob = await res.blob();
      file = new File([blob], 'konfa-verification-qr.png', {
        type: blob.type || 'image/png',
      });
    } catch {
      file = null;
    }
  }

  if (
    typeof navigator !== 'undefined' &&
    navigator.share &&
    file &&
    navigator.canShare &&
    navigator.canShare({ files: [file] })
  ) {
    try {
      await navigator.share({ title, text, url, files: [file] });
      return 'shared';
    } catch (err) {
      if (err?.name === 'AbortError') return 'cancelled';
    }
  }

  if (typeof navigator !== 'undefined' && navigator.share) {
    try {
      await navigator.share({ title, text: `${text}\n${url}` });
      return 'shared';
    } catch (err) {
      if (err?.name === 'AbortError') return 'cancelled';
    }
  }

  try {
    await navigator.clipboard.writeText(`${text}\n${url}`);
    return 'copied';
  } catch {
    return 'failed';
  }
}

/* ============================================================
   ShareQrModal
   ============================================================ */
const ShareQrModal = ({ verification, onClose }) => {
  const slug = verification?.publicSlug;
  const displayName =
    verification?.publicProfile?.displayName ||
    verification?.business?.businessName ||
    verification?.owner?.legalName ||
    'Your business';

  const [qrDataUrl, setQrDataUrl] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);

  const toastTimerRef = useRef(null);
  const publicUrl = slug ? `${window.location.origin}/s/${slug}` : '';

  /* ---------- QR generation ---------- */
  useEffect(() => {
    if (!publicUrl) {
      setError('No public slug assigned yet. Save your public profile first.');
      setLoading(false);
      return;
    }
    generateQr(publicUrl);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [publicUrl]);

  const generateQr = async (text) => {
    setLoading(true);
    setError('');
    try {
      const dataUrl = await QRCode.toDataURL(text, {
        width: 720,
        margin: 2,
        errorCorrectionLevel: 'H',
        color: { dark: '#0a1628', light: '#ffffff' },
      });
      setQrDataUrl(dataUrl);
    } catch (err) {
      console.error('QR generation failed:', err);
      setError(err.message || 'Could not generate QR code.');
    } finally {
      setLoading(false);
    }
  };

  /* ---------- Toast helper ---------- */
  const showToast = (type, msg) => {
    setToast({ type, msg });
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToast(null), 2200);
  };

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    };
  }, []);

  /* ---------- Esc to close ---------- */
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  /* ---------- Lock body scroll ---------- */
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  /* ---------- Actions ---------- */
  const handleDownload = () => {
    if (!qrDataUrl) return;
    const a = document.createElement('a');
    a.href = qrDataUrl;
    a.download = `konfa-verification-${slug || 'seller'}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleCopyLink = async () => {
    if (!publicUrl) return;
    try {
      if (
        typeof navigator !== 'undefined' &&
        navigator.clipboard &&
        typeof navigator.clipboard.writeText === 'function'
      ) {
        await navigator.clipboard.writeText(publicUrl);
      } else {
        const ta = document.createElement('textarea');
        ta.value = publicUrl;
        ta.setAttribute('readonly', '');
        ta.style.position = 'fixed';
        ta.style.top = '-1000px';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      }
      showToast('copied', 'Link copied — ready to paste');
    } catch {
      showToast('error', 'Could not copy link');
    }
  };

  const handleShare = async () => {
    if (!publicUrl) return;
    const result = await shareQrCode({
      url: publicUrl,
      title: `${displayName} · Verified on Konfa`,
      text: `Scan or tap to view ${displayName}'s verified Konfa profile.`,
      qrDataUrl,
    });

    if (result === 'copied') {
      showToast('copied', 'Link copied — ready to paste');
    } else if (result === 'shared') {
      showToast('shared', 'Shared successfully');
    } else if (result === 'failed') {
      showToast('error', 'Sharing is not available on this device');
    }
  };

  /* ---------- Render ---------- */
  return (
    <div className="vf-modal-overlay" onClick={onClose}>
      <div
        className="vf-modal-qr vf-modal-qr-wide"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="vf-modal-title"
      >
        {/* Close button */}
        <button
          type="button"
          className="vf-modal-close"
          onClick={onClose}
          aria-label="Close"
        >
          <IconClose width="16" height="16" />
        </button>

        {/* Header */}
        <div className="vf-modal-header">
          <div className="vf-modal-badge">
            <IconShield width="14" height="14" />
            <span>Verified Seller</span>
          </div>
          <h2 id="vf-modal-title">Let customers verify you instantly</h2>
          <p className="vf-modal-lead">
            Post this QR code or your verification link where customers can
            see it. When they scan or tap it, they land on your verified Konfa
            profile — proof they&apos;re dealing with the real{' '}
            <strong>{displayName}</strong>.
          </p>
        </div>

        {/* QR preview card */}
        <div className="vf-qr-card">
          <div className="vf-qr-frame">
            {loading && (
              <div className="vf-qr-loading">
                <div className="vf-spinner" />
                <span>Generating QR…</span>
              </div>
            )}

            {!loading && qrDataUrl && (
              <img
                src={qrDataUrl}
                alt="Konfa verification QR"
                width="240"
                height="240"
                className="vf-qr-image"
              />
            )}

            {!loading && error && (
              <div className="vf-qr-error">{error}</div>
            )}
          </div>

          <div className="vf-qr-caption">
            <div className="vf-qr-caption-brand">{displayName}</div>
            <div className="vf-qr-caption-text">
              <span className="vf-qr-caption-dot" />
              Scan to verify on Konfa
            </div>
          </div>
        </div>

        {/* URL row */}
        <div className="vf-url-row">
          <span className="vf-url-label">Public link</span>
          <code className="vf-url" title={publicUrl}>
            {publicUrl || '—'}
          </code>
        </div>

        {/* Primary actions — Share + Download */}
        <div className="vf-modal-actions">
          <button
            type="button"
            className="vf-btn vf-btn-primary"
            onClick={handleShare}
            disabled={!publicUrl || loading}
          >
            <IconShare width="16" height="16" />
            <span>Share</span>
          </button>

          <button
            type="button"
            className="vf-btn vf-btn-secondary"
            onClick={handleDownload}
            disabled={!qrDataUrl}
          >
            <IconDownload width="16" height="16" />
            <span>Download PNG</span>
          </button>
        </div>

        {/* Tertiary — Copy link */}
        <button
          type="button"
          className="vf-btn vf-btn-ghost vf-btn-block"
          onClick={handleCopyLink}
          disabled={!publicUrl}
        >
          <IconLink width="15" height="15" />
          <span>Copy link</span>
        </button>

        {/* =========================================================
            WHERE TO POST IT — tips for the seller
            ========================================================= */}
        <section className="vf-share-tips">
          <div className="vf-share-tips-head">
            <h3>Where to post it</h3>
            <p>
              Put your QR code or link anywhere a stranger might ask
              &ldquo;is this seller real?&rdquo;
            </p>
          </div>

          <ul className="vf-share-tip-list">
            <li className="vf-share-tip">
              <div className="vf-share-tip-icon vf-share-tip-icon-instagram">
                <IconInstagram width="20" height="20" />
              </div>
              <div className="vf-share-tip-body">
                <strong>Social media bio</strong>
                <span>
                  Add the link to your Instagram, TikTok, X, Facebook, or
                  YouTube bio. Customers tap it before they DM or pay you.
                </span>
              </div>
            </li>

            <li className="vf-share-tip">
              <div className="vf-share-tip-icon vf-share-tip-icon-whatsapp">
                <IconWhatsapp width="20" height="20" />
              </div>
              <div className="vf-share-tip-body">
                <strong>WhatsApp status or business profile</strong>
                <span>
                  Post the QR image as a status. Anyone who sees it can scan
                  before they send money.
                </span>
              </div>
            </li>

            <li className="vf-share-tip">
              <div className="vf-share-tip-icon vf-share-tip-icon-box">
                <IconBox width="20" height="20" />
              </div>
              <div className="vf-share-tip-body">
                <strong>Product packaging or receipts</strong>
                <span>
                  Print the QR on every package you ship. Buyers verify the
                  seller as soon as the box arrives.
                </span>
              </div>
            </li>

            <li className="vf-share-tip">
              <div className="vf-share-tip-icon vf-share-tip-icon-store">
                <IconStore width="20" height="20" />
              </div>
              <div className="vf-share-tip-body">
                <strong>Shop counter or business card</strong>
                <span>
                  Put a printed QR on your counter, storefront, or business
                  card so walk-in customers can verify in one tap.
                </span>
              </div>
            </li>
          </ul>
        </section>

        {/* =========================================================
            HOW IT WORKS FOR THE CUSTOMER
            ========================================================= */}
        <section className="vf-share-how">
          <h3>
            <IconShield width="14" height="14" />
            <span>How it works for your customer</span>
          </h3>

          <ol className="vf-share-how-list">
            <li>
              <span className="vf-share-how-num">1</span>
              <div>
                <strong>They scan the QR or tap your link</strong>
                <span>
                  It opens instantly — no app, no login required.
                </span>
              </div>
            </li>
            <li>
              <span className="vf-share-how-num">2</span>
              <div>
                <strong>They see your verified profile</strong>
                <span>
                  Your verified name, business details, and confirmed social
                  accounts — all in one place.
                </span>
              </div>
            </li>
            <li>
              <span className="vf-share-how-num">3</span>
              <div>
                <strong>They know you&apos;re the real you</strong>
                <span>
                  No more wondering if the account is an impersonator. They
                  verify, then they buy with confidence.
                </span>
              </div>
            </li>
          </ol>
        </section>

        {/* =========================================================
            WHY IT MATTERS
            ========================================================= */}
        <section className="vf-share-why">
          <div className="vf-share-why-icon">
            <IconTiktok width="18" height="18" />
          </div>
          <div className="vf-share-why-body">
            <strong>Built for how Nigeria really sells</strong>
            <p>
              Most sales happen on WhatsApp, Instagram, and TikTok — where
              anyone can pretend to be anyone. Your Konfa link is the one thing
              an impostor can&apos;t copy. Share it everywhere you sell.
            </p>
          </div>
        </section>

        {/* Footer hint */}
        <p className="vf-modal-footer-hint">
          Tip: print the QR at least 3&nbsp;cm × 3&nbsp;cm so it scans
          reliably from any phone.
        </p>

        {/* Toast */}
        {toast && (
          <div className={`vf-toast vf-toast-${toast.type}`} role="status">
            {toast.type === 'copied' && <IconCheck width="14" height="14" />}
            {toast.type === 'shared' && <IconCheck width="14" height="14" />}
            {toast.type === 'error' && <IconClose width="14" height="14" />}
            <span>{toast.msg}</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default ShareQrModal;