// src/Pages/VerifyLookup.jsx
import React, {
  useState,
  useEffect,
  useRef,
  useMemo,
  useCallback,
} from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import Header from '../components/Header';
import { searchVerification, classifyQuery } from './verifyLookupApi';
import '../App.css';

/* ============================================================
   Icons
   ============================================================ */
const IconSearch = (p) => (
  <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
    <circle cx="11" cy="11" r="7" />
    <path d="M20 20l-3.5-3.5" strokeLinecap="round" />
  </svg>
);

const IconShieldCheck = (p) => (
  <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
    <path d="M12 2L3 7V12C3 17.55 6.84 22.74 12 24C17.16 22.74 21 17.55 21 12V7L12 2Z" strokeLinejoin="round" />
    <path d="M9 12L11 14L15 10" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const IconStore = (p) => (
  <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M3 9l1.5-5h15L21 9M3 9v10a1 1 0 001 1h16a1 1 0 001-1V9M3 9h18" strokeLinejoin="round" />
    <path d="M9 13h6" strokeLinecap="round" />
  </svg>
);

const IconBadge = (p) => (
  <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="12" cy="9" r="6" />
    <path d="M9 12l2 2 4-4" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M8.5 14.5L7 22l5-3 5 3-1.5-7.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const IconArrowRight = (p) => (
  <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
    <path d="M5 12h14M13 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const IconX = (p) => (
  <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
    <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
  </svg>
);

const IconAt = (p) => (
  <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="12" cy="12" r="4" />
    <path d="M16 8v5a3 3 0 006 0v-1a10 10 0 10-4 8" strokeLinecap="round" />
  </svg>
);

const IconPhone = (p) => (
  <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M22 17v2a2 2 0 01-2.18 2 20 20 0 01-8.63-3.07A19.79 19.79 0 013.07 8.18 20 20 0 012 3.82 2 2 0 013.82 2H6a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L7.09 9.91a16 16 0 006 6l1.27-1.16a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 17z" strokeLinejoin="round" />
  </svg>
);

const IconMail = (p) => (
  <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="3" y="5" width="18" height="14" rx="2.5" />
    <path d="M3 7l9 6 9-6" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const IconUser = (p) => (
  <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="12" cy="8" r="4" />
    <path d="M4 21c0-4 4-7 8-7s8 3 8 7" strokeLinecap="round" />
  </svg>
);

const IconLink = (p) => (
  <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M10 13a5 5 0 007.07 0l3-3a5 5 0 00-7.07-7.07L11 5" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M14 11a5 5 0 00-7.07 0l-3 3a5 5 0 007.07 7.07L13 19" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

/* ============================================================
   Utilities
   ============================================================ */

function extractSlugFromUrl(raw) {
  if (!raw) return null;
  const s = String(raw).trim();
  const m = s.match(/(?:^|\/)([bs])\/([A-Za-z0-9][A-Za-z0-9._-]*)\/?$/);
  if (!m) return null;
  return m[2].toLowerCase();
}

function suggestNextTry(classified, rawQuery) {
  if (!classified) return 'Try a shorter version of the name.';
  switch (classified.kind) {
    case 'handle':
      return 'Handles must match exactly. Try the profile name instead, or the email/phone they registered with.';
    case 'email':
      return 'Try the name they use publicly, or a social handle they own.';
    case 'phone':
      return 'Try the number with or without the leading zero, or search by name.';
    case 'slug':
      return 'Profile links are case-sensitive in the URL bar but we handle that. Try the display name.';
    case 'name':
      return 'Try a shorter version of the name, or a social handle they use.';
    default:
      return `Nothing matched "${rawQuery}". Try a different identifier.`;
  }
}

function describeKind(classified) {
  if (!classified || classified.kind === 'empty') return '';
  switch (classified.kind) {
    case 'name':
      return 'Searching by name';
    case 'handle':
      return classified.platform
        ? `Searching ${classified.platform} handle @${classified.handle}`
        : `Searching social handle @${classified.handle}`;
    case 'email':
      return 'Searching by email';
    case 'phone':
      return 'Searching by phone number';
    case 'slug':
      return 'Searching by profile link';
    default:
      return '';
  }
}

/* ============================================================
   Result card
   ============================================================ */
function ResultCard({ item }) {
  const isBrand = item.type === 'brand';
  const Icon = isBrand ? IconBadge : IconStore;

  return (
    <article className={`lookup-card ${item.verified ? 'is-verified' : ''}`}>
      <div className="lookup-card-avatar">
        {item.avatarUrl ? (
          <img src={item.avatarUrl} alt="" loading="lazy" />
        ) : (
          <Icon width="26" height="26" />
        )}
      </div>

      <div className="lookup-card-body">
        <div className="lookup-card-head">
          <span className={`lookup-type lookup-type-${item.type}`}>
            {isBrand ? 'Brand' : 'Seller'}
          </span>
          {item.verified && (
            <span className="lookup-verified">
              <IconShieldCheck width="14" height="14" />
              Verified
            </span>
          )}
        </div>

        <h3 className="lookup-card-title">{item.displayName}</h3>

        {item.matchedHandle && (
          <p className="lookup-card-match">
            <IconAt width="14" height="14" />
            Matched {item.matchedHandle.platform} @{item.matchedHandle.handle}
          </p>
        )}

        {item.bio && <p className="lookup-card-bio">{item.bio}</p>}

        {item.location && (
          <p className="lookup-card-meta">{item.location}</p>
        )}
      </div>

      {item.publicPath ? (
        <Link to={item.publicPath} className="lookup-card-cta">
          View profile
          <IconArrowRight width="16" height="16" />
        </Link>
      ) : (
        <span
          className="lookup-card-cta lookup-card-cta-disabled"
          title="This account has no public profile page yet."
        >
          No public page
        </span>
      )}
    </article>
  );
}

/* ============================================================
   VerifyLookup page
   ============================================================ */
const VerifyLookup = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const initial = searchParams.get('q') || '';
  const [input, setInput] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [response, setResponse] = useState(null);

  const debounceRef = useRef(null);
  const lastQueriedRef = useRef('');
  const lastUrlRef = useRef(initial);
  const reqSeqRef = useRef(0);
  const inputRef = useRef(null);

  const classified = useMemo(() => classifyQuery(input), [input]);
  const kindLabel = describeKind(classified);

  const runSearch = useCallback(async (q) => {
    const trimmed = (q || '').trim();
    if (!trimmed) {
      setResponse(null);
      lastQueriedRef.current = '';
      return;
    }
    if (trimmed === lastQueriedRef.current) return;
    lastQueriedRef.current = trimmed;

    const seq = ++reqSeqRef.current;
    setBusy(true);

    const res = await searchVerification(trimmed);

    if (seq !== reqSeqRef.current) return;

    setResponse(res);
    setBusy(false);
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    const q = input.trim();
    if (!q) {
      setResponse(null);
      lastQueriedRef.current = '';
      if (searchParams.get('q')) {
        const next = new URLSearchParams(searchParams);
        next.delete('q');
        setSearchParams(next, { replace: true });
        lastUrlRef.current = '';
      }
      return;
    }

    if (q !== lastUrlRef.current) {
      lastUrlRef.current = q;
      const next = new URLSearchParams(searchParams);
      next.set('q', q);
      setSearchParams(next, { replace: true });
    }

    debounceRef.current = setTimeout(() => {
      runSearch(q);
    }, 400);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [input]);

  useEffect(() => {
    if (initial) runSearch(initial);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== '/') return;
      const tag = (e.target?.tagName || '').toLowerCase();
      const isEditable =
        tag === 'input' ||
        tag === 'textarea' ||
        tag === 'select' ||
        e.target?.isContentEditable;
      if (isEditable) return;
      e.preventDefault();
      inputRef.current?.focus();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const onSubmit = (e) => {
    e.preventDefault();

    const slugFromUrl = extractSlugFromUrl(input);
    if (slugFromUrl && slugFromUrl !== input) {
      setInput(slugFromUrl);
      return;
    }

    if (debounceRef.current) clearTimeout(debounceRef.current);
    lastQueriedRef.current = '';
    runSearch(input);
  };

  const clearInput = () => {
    setInput('');
    setResponse(null);
    lastQueriedRef.current = '';
    lastUrlRef.current = '';
    const next = new URLSearchParams(searchParams);
    next.delete('q');
    setSearchParams(next, { replace: true });
    inputRef.current?.focus();
  };

  const handleHeaderNavigate = (path) => navigate(path);

  const handleExample = (value) => {
    setInput(value);
    inputRef.current?.focus();
  };

  const hasResults = !busy && response?.results?.length > 0;
  const noResults =
    !busy &&
    response &&
    !response.error &&
    response.results.length === 0;
  const showInitialEmpty = !response && !busy && !input.trim();
  // ✅ FIX: use response.classified (now returned by the API)
  const nextTip = noResults
    ? suggestNextTry(response.classified, response.query)
    : '';

  return (
    <div className="lookup-page">
      <Header onNavigate={handleHeaderNavigate} sticky />

      <main className="lookup-main">
        <section className="lookup-hero">
          <div className="lookup-hero-inner">
            <span className="lookup-tag">
              <IconShieldCheck width="14" height="14" />
              Public verification
            </span>
            <h1 className="lookup-title">
              Verify a seller or brand
            </h1>
            <p className="lookup-subtitle">
              Search by name, social media handle, email, phone number, or
              profile link. We'll show you what Varyfai has actually verified —
              nothing more, nothing less.
            </p>

            <form className="lookup-search" onSubmit={onSubmit} role="search">
              <span className="lookup-search-icon" aria-hidden="true">
                <IconSearch width="20" height="20" />
              </span>
              <input
                ref={inputRef}
                type="text"
                className="lookup-search-input"
                placeholder="Name, @instagram, email, phone, or profile link"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                autoComplete="off"
                autoFocus
                aria-label="Search for a seller or brand"
                spellCheck={false}
              />
              {input && (
                <button
                  type="button"
                  className="lookup-search-clear"
                  onClick={clearInput}
                  aria-label="Clear search"
                >
                  <IconX width="16" height="16" />
                </button>
              )}
              <button
                type="submit"
                className="lookup-search-submit"
                disabled={busy || !input.trim()}
              >
                {busy ? 'Searching…' : 'Search'}
              </button>
            </form>

            {kindLabel && (
              <p className="lookup-kind-hint" aria-live="polite">
                {kindLabel}
              </p>
            )}

            {!input && (
              <div className="lookup-examples">
                <span className="lookup-examples-label">Try:</span>
                <button
                  type="button"
                  className="lookup-example"
                  onClick={() => handleExample('@jonoks_ent')}
                  aria-label="Search example: at jonoks_ent on Instagram"
                >
                  <IconAt width="14" height="14" /> @jonoks_ent
                </button>
                <button
                  type="button"
                  className="lookup-example"
                  onClick={() => handleExample('instagram:storyca12')}
                  aria-label="Search example: Instagram storyca12"
                >
                  <IconAt width="14" height="14" /> instagram:storyca12
                </button>
                <button
                  type="button"
                  className="lookup-example"
                  onClick={() => handleExample('07035018415')}
                  aria-label="Search example: phone number 07035018415"
                >
                  <IconPhone width="14" height="14" /> 07035018415
                </button>
                <button
                  type="button"
                  className="lookup-example"
                  onClick={() => handleExample('owner@example.com')}
                  aria-label="Search example: owner@example.com"
                >
                  <IconMail width="14" height="14" /> owner@example.com
                </button>
                <button
                  type="button"
                  className="lookup-example"
                  onClick={() => handleExample('Nathaniel Bassey')}
                  aria-label="Search example: Nathaniel Bassey"
                >
                  <IconUser width="14" height="14" /> Nathaniel Bassey
                </button>
                <button
                  type="button"
                  className="lookup-example"
                  onClick={() => handleExample('/b/nathaniel-bassey')}
                  aria-label="Search example: a profile link"
                >
                  <IconLink width="14" height="14" /> /b/nathaniel-bassey
                </button>
              </div>
            )}

            {!input && (
              <p className="lookup-shortcut-hint">
                Tip: press <kbd>/</kbd> anywhere to focus the search box.
              </p>
            )}
          </div>
        </section>

        <section
          className="lookup-results"
          aria-busy={busy}
          aria-live="polite"
        >
          {showInitialEmpty && (
            <div className="lookup-empty">
              <div className="lookup-empty-icon">
                <IconSearch width="28" height="28" />
              </div>
              <h3>Enter anything you know</h3>
              <p>
                A name, a social handle, an email, a phone number, or a
                profile link. We'll look across verified brands and sellers
                and show you what matches.
              </p>
            </div>
          )}

          {busy && (
            <div className="lookup-loading" role="status">
              <div className="lookup-loading-spinner" />
              <p>Searching Varyfai…</p>
            </div>
          )}

          {!busy && response?.error && (
            <div className="lookup-error" role="alert">
              <strong>Search failed</strong>
              <span>{response.error}</span>
            </div>
          )}

          {noResults && (
            <div className="lookup-empty lookup-empty-noresult">
              <div className="lookup-empty-icon lookup-empty-icon-warn">
                <IconSearch width="28" height="28" />
              </div>
              <h3>No matches found</h3>
              <p>
                We couldn't find a verified brand or seller matching{' '}
                <strong>&ldquo;{response.query}&rdquo;</strong>.
              </p>
              <p className="lookup-empty-next">{nextTip}</p>
              <ul className="lookup-empty-tips">
                <li>Try a shorter version of the name</li>
                <li>Try the social handle with or without the @</li>
                <li>Try the email or phone number they registered with</li>
              </ul>
            </div>
          )}

          {hasResults && (
            <>
              <div className="lookup-results-head">
                <h2>
                  {response.results.length} match
                  {response.results.length === 1 ? '' : 'es'}
                </h2>
                <p>
                  Showing public information only. Private data (NIN, bank
                  account, uploaded documents) is never displayed here.
                </p>
              </div>
              <div className="lookup-results-list">
                {response.results.map((item) => (
                  <ResultCard key={`${item.type}:${item.id}`} item={item} />
                ))}
              </div>
            </>
          )}
        </section>
      </main>
    </div>
  );
};

export default VerifyLookup;