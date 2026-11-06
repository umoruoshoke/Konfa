// src/search/SearchPage.jsx
// ============================================================
// Public search page. Shows verified brands and verified sellers.
// Matches on any non-personal field: name, tokens, category,
// city/state, business type, phone digits, slug.
// ============================================================

import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { searchPublic } from './searchApi';

export default function SearchPage() {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const initial = params.get('q') || '';

  const [query, setQuery] = useState(initial);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [results, setResults] = useState([]);
  const [hasSearched, setHasSearched] = useState(false);

  // Run the search whenever ?q= changes
  useEffect(() => {
    const q = params.get('q') || '';
    if (!q.trim()) {
      setResults([]);
      setHasSearched(false);
      return;
    }

    let alive = true;
    setLoading(true);
    setError(null);

    searchPublic(q)
      .then(({ results }) => {
        if (!alive) return;
        setResults(results);
        setHasSearched(true);
      })
      .catch((err) => {
        if (!alive) return;
        console.error(err);
        setError('Search failed. Please try again.');
      })
      .finally(() => {
        if (!alive) return;
        setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [params]);

  function onSubmit(e) {
    e.preventDefault();
    setParams(query.trim() ? { q: query.trim() } : {});
  }

  function openResult(r) {
    if (r.kind === 'brand') {
      navigate(`/brand/${encodeURIComponent(r.slug)}`);
    } else {
      navigate(`/seller/${encodeURIComponent(r.slug)}`);
    }
  }

  return (
    <div className="search-page">
      <form className="search-form" onSubmit={onSubmit}>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search a name, business, category, city, or phone"
          autoFocus
        />
        <button type="submit" disabled={loading}>
          {loading ? 'Searching…' : 'Search'}
        </button>
      </form>

      {error && <p className="search-error">{error}</p>}

      {hasSearched && results.length === 0 && !loading && (
        <p className="search-empty">No public page found for “{params.get('q')}”.</p>
      )}

      {results.length > 0 && (
        <ul className="search-results">
          {results.map((r) => (
            <li key={`${r.kind}:${r.id}`} onClick={() => openResult(r)}>
              <div className="result-name">
                {r.displayName}
                {r.verified && <span className="verified-badge" title="Verified">✓</span>}
              </div>
              <div className="result-meta">
                <span className="result-kind">
                  {r.kind === 'brand' ? 'Public figure' : 'Seller'}
                </span>
                {r.category && <span> · {r.category}</span>}
                {r.city && <span> · {r.city}</span>}
                {r.state && <span>, {r.state}</span>}
              </div>
              {r.description && (
                <div className="result-desc">{r.description.slice(0, 120)}</div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}