// src/search/searchApi.js
// ============================================================
// Public search across verified brands and verified sellers.
// Only PUBLIC fields are read; never email, phone number, NIN,
// legal name, owner's personal contact, or admin notes.
// ============================================================

import {
  collection,
  query,
  where,
  getDocs,
  doc,
  getDoc,
  limit,
} from 'firebase/firestore';
import { db } from '../firebase';

// ------------------------------------------------------------
// Normalizers (must match everything else in the app)
// ------------------------------------------------------------
function normalize(str = '') {
  return str
    .toString()
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokensOf(normalized = '') {
  return Array.from(
    new Set(
      (normalized || '')
        .split(/\s+/)
        .map((t) => t.trim())
        .filter((t) => t.length >= 2),
    ),
  );
}

function digitsOnly(s = '') {
  return s.toString().replace(/\D/g, '').replace(/^0+/, '');
}

// ------------------------------------------------------------
// Public projection — whitelist only. Never add personal fields.
// ------------------------------------------------------------
function toPublicBrand(id, data, reservation = {}) {
  return {
    kind: 'brand',
    id,
    slug: data.publicSlug || reservation.normalizedName || id,
    displayName: data.displayName || reservation.displayName || '',
    normalizedName: data.normalizedName || reservation.normalizedName || '',
    category: data.category || '',
    description: data.bio || '',
    photoURL: data.photoURL || '',
    verified: data.verificationStatus === 'verified',
    verifiedAt: data.verifiedAt || null,
    city: data.city || '',
    state: data.state || '',
    // tokens/digits are used only for filtering; we strip them before display
    _tokens: data.tokens || reservation.tokens || [],
    _digits: data.digits || reservation.digits || [],
    _phoneDigits: data.phoneDigits || '',
  };
}

function toPublicSeller(id, data) {
  const b = data.business || {};
  const addr = (b && b.address) || {};
  return {
    kind: 'seller',
    id,
    slug: data.slug || id,
    displayName: data.displayName || (b.businessName ?? ''),
    category: data.category || b.type || '',
    description: data.description || '',
    city: addr.city || '',
    state: addr.state || '',
    businessType: b.type || '',
    verified: !!(data.businessVerified || data.ownerVerified),
    verifiedAt: data.updatedAt || null,
    _tokens: data._tokens || tokensOf(normalize(data.displayName || b.businessName || '')),
    _digits: data._digits || digitsOnly(data.displayName || b.businessName || ''),
    _phoneDigits: digitsOnly((b.contact && b.contact.phone) || ''),
  };
}

// Strip internal fields before returning to UI.
function stripInternal(p) {
  const { _tokens, _digits, _phoneDigits, ...rest } = p;
  return rest;
}

// ------------------------------------------------------------
// Fetch verified brands
// ------------------------------------------------------------
async function fetchVerifiedBrands(maxResults = 200) {
  const brandsSnap = await getDocs(
    query(
      collection(db, 'brands'),
      where('verificationStatus', '==', 'verified'),
      limit(maxResults),
    ),
  );

  const results = [];
  for (const d of brandsSnap.docs) {
    const data = d.data();
    let reservation = {};

    if (data.normalizedName) {
      try {
        const nameSnap = await getDoc(doc(db, 'brandNames', data.normalizedName));
        if (nameSnap.exists()) reservation = nameSnap.data();
      } catch {
        /* non-fatal */
      }
    }

    results.push(toPublicBrand(d.id, data, reservation));
  }
  return results;
}

// ------------------------------------------------------------
// Fetch verified sellers (from public_seller_profiles only)
// ------------------------------------------------------------
async function fetchVerifiedSellers(maxResults = 200) {
  const snap = await getDocs(
    query(
      collection(db, 'public_seller_profiles'),
      where('enabled', '==', true),
      limit(maxResults),
    ),
  );

  const results = [];
  snap.forEach((d) => results.push(toPublicSeller(d.id, d.data())));
  return results;
}

// ------------------------------------------------------------
// Scoring — tokens first, then prefix matches, then phone.
// ------------------------------------------------------------
function scoreProfile(profile, queryTokens, queryDigits, rawQuery) {
  if (!profile._tokens.length) return 0;

  let score = 0;

  // Token overlap
  for (const q of queryTokens) {
    for (const t of profile._tokens) {
      if (t === q) { score += 10; break; }
      if (t.startsWith(q)) { score += 5; break; }
    }
  }

  // Exact full-name match
  const fullName = profile._tokens.join(' ');
  const fullQuery = queryTokens.join(' ');
  if (fullName === fullQuery) score += 30;
  if (fullName.startsWith(fullQuery)) score += 15;

  // Digit match (phone / numeric ID)
  if (queryDigits && queryDigits.length >= 4) {
    if (profile._digits === queryDigits) score += 20;
    else if (profile._phoneDigits === queryDigits) score += 20;
    else if (profile._phoneDigits.endsWith(queryDigits)) score += 8;
  }

  // Verified sellers get a slight boost (verified badge)
  if (profile.kind === 'seller' && profile.verified) score += 2;

  return score;
}

// ------------------------------------------------------------
// Main entry point
// ------------------------------------------------------------
export async function searchPublic(rawQuery, { maxResults = 20 } = {}) {
  const trimmed = (rawQuery || '').trim();
  if (!trimmed) return { query: trimmed, results: [] };

  const normalized = normalize(trimmed);
  const queryTokens = tokensOf(normalized);
  const queryDigits = digitsOnly(trimmed);

  if (queryTokens.length === 0 && !queryDigits) {
    return { query: trimmed, results: [] };
  }

  const [brands, sellers] = await Promise.all([
    fetchVerifiedBrands(),
    fetchVerifiedSellers(),
  ]);

  const all = [...brands, ...sellers];

  const scored = all
    .map((p) => ({ profile: p, score: scoreProfile(p, queryTokens, queryDigits, trimmed) }))
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, maxResults);

  return {
    query: trimmed,
    results: scored.map(({ profile, score }) => ({
      ...stripInternal(profile),
      _score: score,
    })),
  };
}

// ------------------------------------------------------------
// Public profile fetch by slug (used when the user clicks a result)
// ------------------------------------------------------------
export async function fetchPublicProfile(kind, slugOrId) {
  if (!kind || !slugOrId) return null;

  if (kind === 'brand') {
    // Try brandNames first (normalized name or id)
    try {
      const nameSnap = await getDoc(doc(db, 'brandNames', slugOrId));
      if (nameSnap.exists()) {
        const { brandId } = nameSnap.data();
        const brandSnap = await getDoc(doc(db, 'brands', brandId));
        if (brandSnap.exists()) {
          const data = brandSnap.data();
          if (data.verificationStatus !== 'verified') return null;
          return stripInternal(toPublicBrand(brandSnap.id, data, nameSnap.data()));
        }
      }
    } catch {
      /* fall through */
    }

    // Fall back to direct uid lookup
    const brandSnap = await getDoc(doc(db, 'brands', slugOrId));
    if (brandSnap.exists()) {
      const data = brandSnap.data();
      if (data.verificationStatus !== 'verified') return null;
      return stripInternal(toPublicBrand(brandSnap.id, data));
    }
    return null;
  }

  if (kind === 'seller') {
    const snap = await getDoc(doc(db, 'public_seller_profiles', slugOrId));
    if (!snap.exists()) return null;
    const data = snap.data();
    if (!data.enabled) return null;
    return stripInternal(toPublicSeller(snap.id, data));
  }

  return null;
}