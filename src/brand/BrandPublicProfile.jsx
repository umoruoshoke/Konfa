// src/brand/BrandPublicProfile.jsx
import { useEffect, useState } from 'react';
import { useParams, Link, useSearchParams } from 'react-router-dom';
import { fetchPublicBrandBySlug } from './brandVerificationApi';
import Header from '../components/Header';
import './BrandPortal.css';

const PLATFORM_META = {
  instagram: { label: 'Instagram', urlPrefix: 'https://instagram.com/', color: 'linear-gradient(135deg, #f58529, #dd2a7b 50%, #8134af)' },
  tiktok: { label: 'TikTok', urlPrefix: 'https://tiktok.com/@', color: '#000' },
  youtube: { label: 'YouTube', urlPrefix: 'https://youtube.com/@', color: '#ff0000' },
  x: { label: 'X', urlPrefix: 'https://x.com/', color: '#000' },
  facebook: { label: 'Facebook', urlPrefix: 'https://facebook.com/', color: '#1877f2' },
  whatsapp: { label: 'WhatsApp', urlPrefix: 'https://wa.me/', color: '#25d366' },
  website: { label: 'Website', urlPrefix: '', color: '#0d9488' },
};

const BrandPublicProfile = () => {
  const { slug } = useParams();
  const [searchParams] = useSearchParams();
  const debug = searchParams.get('debug') === '1';

  const [brand, setBrand] = useState(null);
  const [loading, setLoading] = useState(true);
  // 'ok' | 'not_found' | 'disabled' | 'error'
  const [reason, setReason] = useState('ok');
  const [debugInfo, setDebugInfo] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setReason('ok');
      setBrand(null);
      setDebugInfo(null);
      try {
        // fetchPublicBrandBySlug now returns { status, data } so the
        // page can distinguish "not found" from "disabled".
        const res = await fetchPublicBrandBySlug(slug);
        if (cancelled) return;

        // Backward-compat: if fetchPublicBrandBySlug still returns
        // a plain object (older version), treat it as ok.
        const status = res?.status || (res ? 'ok' : 'not_found');
        const data = res?.data !== undefined ? res.data : res;

        if (status === 'ok' && data) {
          setBrand(data);
          setReason('ok');
        } else if (status === 'disabled') {
          setReason('disabled');
        } else {
          setReason('not_found');
        }

        if (debug) {
          setDebugInfo({ status, hasData: !!data, slug });
        }
      } catch (err) {
        if (cancelled) return;
        console.error(err);
        setReason('error');
        if (debug) {
          setDebugInfo({
            status: 'error',
            code: err?.code,
            message: err?.message,
            slug,
          });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [slug, debug]);

  return (
    <div className="brand-portal-shell">
      {/* ============================================================
          UNIFIED HEADER — visible everywhere, even on the public page
          ============================================================ */}
      <Header sticky />

      {loading && (
        <div className="brand-splash">
          <div className="brand-splash-spinner" />
          <p>Loading…</p>
        </div>
      )}

      {!loading && reason === 'not_found' && (
        <div className="brand-splash" style={{ background: '#fff' }}>
          <h1 style={{ fontSize: '1.3rem', margin: 0 }}>Brand not found</h1>
          <p style={{ color: '#64748b', textAlign: 'center', maxWidth: 400 }}>
            This Varyfai brand link doesn&apos;t match any active brand profile.
          </p>
          <Link to="/" className="brand-btn brand-btn-primary">Go home</Link>
          {debug && debugInfo && (
            <pre style={{ fontSize: 11, color: '#94a3b8', marginTop: 16, maxWidth: 480, textAlign: 'left', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
              {JSON.stringify(debugInfo, null, 2)}
            </pre>
          )}
        </div>
      )}

      {!loading && reason === 'disabled' && (
        <div className="brand-splash" style={{ background: '#fff' }}>
          <h1 style={{ fontSize: '1.3rem', margin: 0 }}>This brand page isn&apos;t live yet</h1>
          <p style={{ color: '#64748b', textAlign: 'center', maxWidth: 420 }}>
            The owner has verified this brand but hasn&apos;t switched the public
            page on. Check back soon.
          </p>
          <Link to="/" className="brand-btn brand-btn-primary">Go home</Link>
          {debug && debugInfo && (
            <pre style={{ fontSize: 11, color: '#94a3b8', marginTop: 16, maxWidth: 480, textAlign: 'left', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
              {JSON.stringify(debugInfo, null, 2)}
            </pre>
          )}
        </div>
      )}

      {!loading && reason === 'error' && (
        <div className="brand-splash" style={{ background: '#fff' }}>
          <h1 style={{ fontSize: '1.3rem', margin: 0 }}>Something went wrong</h1>
          <p style={{ color: '#64748b', textAlign: 'center', maxWidth: 420 }}>
            We couldn&apos;t load this brand page. Please try again later.
          </p>
          <Link to="/" className="brand-btn brand-btn-primary">Go home</Link>
          {debug && debugInfo && (
            <pre style={{ fontSize: 11, color: '#94a3b8', marginTop: 16, maxWidth: 480, textAlign: 'left', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
              {JSON.stringify(debugInfo, null, 2)}
            </pre>
          )}
        </div>
      )}

      {!loading && brand && (
        <div className="brand-page" style={{ maxWidth: 720 }}>
          <article className="brand-card" style={{ padding: '32px 32px 26px' }}>
            <div className="brand-preview-head">
              <div className="brand-preview-avatar" style={{ width: 64, height: 64, fontSize: '1.6rem', borderRadius: 18 }}>
                {((brand.publicProfile?.displayName || 'V').charAt(0)).toUpperCase()}
              </div>
              <div>
                <h1 style={{ fontSize: '1.5rem', fontWeight: 800, letterSpacing: '-0.5px', margin: '0 0 6px' }}>
                  {brand.publicProfile?.displayName || 'Varyfai verified brand'}
                </h1>
                {brand.publicProfile?.category && (
                  <p style={{ fontSize: '0.9rem', color: '#64748b', margin: 0 }}>
                    {brand.publicProfile.category}
                  </p>
                )}
              </div>
            </div>

            {brand.publicProfile?.description && (
              <p className="brand-preview-desc" style={{ marginTop: 20 }}>
                {brand.publicProfile.description}
              </p>
            )}

            {brand.owner?.status === 'verified' && (
              <div className="brand-callout brand-callout-ok" style={{ marginTop: 20 }}>
                <strong>✓ Owner identity verified</strong>
                {brand.publicProfile?.showOwnerName && brand.owner?.legalName ? (
                  <p>The person behind this brand was verified as <strong>{brand.owner.legalName}</strong>.</p>
                ) : (
                  <p>The person behind this brand has been verified.</p>
                )}
              </div>
            )}

            {Object.values(brand.accounts || {}).filter((a) => a.status === 'verified').length > 0 && (
              <section style={{ marginTop: 24 }}>
                <h2 style={{ fontSize: '0.85rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1px', color: '#94a3b8', margin: '0 0 12px' }}>
                  Official accounts
                </h2>
                <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {Object.values(brand.accounts)
                    .filter((a) => a.status === 'verified')
                    .map((a) => {
                      const meta = PLATFORM_META[a.platform] || { label: a.platform, urlPrefix: '', color: '#64748b' };
                      const href = a.url || (meta.urlPrefix ? `${meta.urlPrefix}${(a.handle || '').replace(/^@/, '')}` : null);
                      return (
                        <li
                          key={a.platform}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 12,
                            padding: '12px 14px',
                            background: '#f8fafc',
                            borderRadius: 10,
                            flexWrap: 'wrap',
                          }}
                        >
                          <span style={{ width: 8, alignSelf: 'stretch', background: meta.color, borderRadius: 999 }} />
                          <span style={{ fontSize: '0.85rem', fontWeight: 800, color: '#0a1628', minWidth: 90 }}>
                            {meta.label}
                          </span>
                          <span style={{ flex: 1, fontFamily: 'monospace', fontSize: '0.86rem', color: '#334155', wordBreak: 'break-all' }}>
                            @{(a.handle || '').replace(/^@/, '')}
                          </span>
                          <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#16a34a', textTransform: 'uppercase' }}>
                            ✓ Verified
                          </span>
                          {href && (
                            <a
                              href={href}
                              target="_blank"
                              rel="noreferrer noopener"
                              style={{ fontSize: '0.78rem', fontWeight: 700, color: '#0d9488', textDecoration: 'none' }}
                            >
                              Open ↗
                            </a>
                          )}
                        </li>
                      );
                    })}
                </ul>
              </section>
            )}

            <div className="brand-callout brand-callout-amber" style={{ marginTop: 24 }}>
              <strong>Note</strong>
              <p>
                Varyfai verifies that the accounts and identity listed above belong
                to the person behind this brand. Varyfai does not guarantee conduct,
                products, or services. Always exercise normal due diligence.
              </p>
            </div>

            <footer style={{ marginTop: 24, paddingTop: 20, borderTop: '1px solid #f1f5f9', textAlign: 'center', fontSize: '0.78rem', color: '#94a3b8' }}>
              Verified by Varyfai · varyfai.com/b/{slug}
            </footer>
          </article>

          <div style={{ textAlign: 'center', marginTop: 24 }}>
            <p style={{ fontSize: '0.88rem', color: '#64748b', marginBottom: 12 }}>
              Are you a public figure, brand, or organization?
            </p>
            <Link to="/brand/signup" className="brand-btn brand-btn-primary brand-btn-large">
              Get your brand verified →
            </Link>
          </div>
        </div>
      )}
    </div>
  );
};

export default BrandPublicProfile;