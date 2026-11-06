// src/Pages/verifyLookupApi.js
// ============================================================
// Public lookup — "Verify a Seller or Brand"
// ------------------------------------------------------------
// Universal lookup: the user can type ANY of the following and
// we'll try every plausible interpretation in parallel:
//
//   · name fragment               "oshoke", "Oshoke Entertainment"
//   · social handle               "@jonoks_ent", "jonoks_ent"
//   · platform:handle             "instagram:jonoks_ent"
//   · full profile URL            "https://site.com/b/xyz"
//   · relative URL                "/b/xyz", "/s/xyz"
//   · bare slug                   "jonoks-entertainment"
//   · email                       "owner@example.com"
//   · phone (any format)          "07035018415", "+2347035018415"
//   · raw Firebase UID            28-char alphanumeric string
//
// Only PUBLIC collections are read. Never touches
// `seller_verifications` or `brand_verifications`.
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

/* ============================================================
   Normalizers (must match signup code + backfill)
   ============================================================ */

const normalizeName = (s = '') =>
  s
    .toString()
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[^\p{L}\p{N} ]/gu, '');

const normalizePhone = (s = '') =>
  s.toString().replace(/\D/g, '').replace(/^0+/, '');

const normalizeHandle = (s = '') =>
  s.toString().trim().toLowerCase().replace(/^@+/, '');

// Firestore sorts by Unicode; this char sorts after everything
// printable — the standard "prefix" upper bound.
const PREFIX_HIGH = '\uf8ff';

// Known social platforms.
const PLATFORMS = new Set([
  'instagram', 'tiktok', 'twitter', 'x', 'facebook',
  'youtube', 'whatsapp', 'telegram', 'linkedin',
  'threads', 'snapchat', 'pinterest',
]);

/* ============================================================
   URL + pattern helpers
   ============================================================ */

function extractSlugFromUrl(input) {
  if (!input) return null;
  const s = String(input).trim();
  const m = s.match(/(?:^|\/)([bs])\/([A-Za-z0-9][A-Za-z0-9._-]*)\/?(?:[?#]|$)/);
  if (m) return { type: m[1], slug: m[2].toLowerCase() };
  return null;
}

function looksLikeEmail(s) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

function looksLikePhone(s) {
  const digits = s.replace(/\D/g, '');
  if (digits.length < 10 || digits.length > 15) return false;
  return /^[+\d][\d\s\-().]+$/.test(s);
}

function looksLikeUid(s) {
  return /^[A-Za-z0-9]{20,40}$/.test(s);
}

function looksLikeSlug(s) {
  return /^[a-z0-9]+(?:-[a-z0-9]+)+$/i.test(s);
}

function extractPlatformPrefix(s) {
  const idx = s.indexOf(':');
  if (idx <= 0) return null;
  const prefix = s.slice(0, idx).toLowerCase();
  if (!PLATFORMS.has(prefix)) return null;
  return {
    platform: prefix === 'x' ? 'twitter' : prefix,
    rest: s.slice(idx + 1),
  };
}

/* ============================================================
   Interpretations
   ============================================================ */

function interpret(raw) {
  const s = (raw || '').trim();
  if (!s) return [];

  const out = [];
  const seen = new Set();
  const push = (obj) => {
    const key = JSON.stringify(obj);
    if (!seen.has(key)) { seen.add(key); out.push(obj); }
  };

  // 1. URL — takes priority, slug is definitive
  const url = extractSlugFromUrl(s);
  if (url) {
    push({ kind: 'slug', value: url.slug });
    push({ kind: 'name', value: normalizeName(url.slug) });
    return out;
  }

  // 2. platform:handle
  const pfx = extractPlatformPrefix(s);
  if (pfx) {
    const handle = normalizeHandle(pfx.rest);
    if (handle) {
      push({ kind: 'handle', platform: pfx.platform, handle });
      push({ kind: 'name', value: normalizeName(pfx.rest) });
    }
    return out;
  }

  // 3. @handle
  if (s.startsWith('@')) {
    const handle = normalizeHandle(s);
    if (handle) {
      push({ kind: 'handle', platform: null, handle });
      push({ kind: 'name', value: normalizeName(handle) });
    }
    return out;
  }

  // 4. email  (checked BEFORE uid — "a@b.co" isn't a UID)
  if (looksLikeEmail(s)) {
    push({ kind: 'email', value: s.toLowerCase() });
    return out;
  }

  // 5. phone
  if (looksLikePhone(s)) {
    push({ kind: 'phone', value: normalizePhone(s) });
    return out;
  }

  // 6. Firebase UID (long alphanumeric)
  if (looksLikeUid(s)) {
    push({ kind: 'uid', value: s });
    push({ kind: 'name', value: normalizeName(s) });
    return out;
  }

  // 7. Slug (kebab-case)
  if (looksLikeSlug(s)) {
    push({ kind: 'slug', value: s.toLowerCase() });
    push({ kind: 'name', value: normalizeName(s.replace(/-/g, ' ')) });
    return out;
  }

  // 8. Fallback — treat as name AND as a handle
  const normalized = normalizeName(s);
  if (normalized) {
    push({ kind: 'name', value: normalized });
  }
  if (/^[a-z0-9._]+$/i.test(s)) {
    push({ kind: 'handle', platform: null, handle: normalizeHandle(s) });
  }

  return out;
}

/* ============================================================
   Individual lookups
   ============================================================ */

async function getBrandById(id) {
  if (!id) return null;
  try {
    const snap = await getDoc(doc(db, 'brands', id));
    if (!snap.exists()) return null;
    return shapeResult('brand', snap.id, snap.data(), { matchKind: 'id' });
  } catch { return null; }
}

async function getSellerById(id) {
  if (!id) return null;
  try {
    const snap = await getDoc(doc(db, 'sellers', id));
    if (!snap.exists()) return null;
    return shapeResult('seller', snap.id, snap.data(), { matchKind: 'id' });
  } catch { return null; }
}

async function getBrandBySlug(slug) {
  if (!slug) return null;
  try {
    const snap = await getDoc(doc(db, 'public_brand_profiles', slug));
    if (snap.exists()) {
      const data = snap.data();
      if (data.ownerUid) {
        const brand = await getBrandById(data.ownerUid);
        if (brand) return { ...brand, matchedSlug: slug };
      }
      return shapeResult('brand', snap.id, data, { matchKind: 'slug' });
    }
  } catch { /* fall through */ }

  try {
    const snap = await getDocs(
      query(collection(db, 'brands'), where('slug', '==', slug), limit(1))
    );
    if (!snap.empty) {
      const d = snap.docs[0];
      return shapeResult('brand', d.id, d.data(), { matchKind: 'slug' });
    }
  } catch { /* ignore */ }

  return null;
}

async function getSellerBySlug(slug) {
  if (!slug) return null;
  try {
    const snap = await getDoc(doc(db, 'public_seller_profiles', slug));
    if (snap.exists()) {
      const data = snap.data();
      if (data.ownerUid) {
        const seller = await getSellerById(data.ownerUid);
        if (seller) return { ...seller, matchedSlug: slug };
      }
      return shapeResult('seller', snap.id, data, { matchKind: 'slug' });
    }
  } catch { /* fall through */ }

  try {
    const snap = await getDocs(
      query(collection(db, 'sellers'), where('slug', '==', slug), limit(1))
    );
    if (!snap.empty) {
      const d = snap.docs[0];
      return shapeResult('seller', d.id, d.data(), { matchKind: 'slug' });
    }
  } catch { /* ignore */ }

  return null;
}

async function findBySlug(slug) {
  if (!slug) return [];
  const [brand, seller] = await Promise.all([
    getBrandBySlug(slug),
    getSellerBySlug(slug),
  ]);
  return [brand, seller].filter(Boolean);
}

/**
 * Prefix search on a field. Uses >= / <= with PREFIX_HIGH.
 *
 * If Firestore says an index is missing, we surface it once via
 * console.error so the developer sees it — but we still return []
 * so the rest of the search can continue.
 */
async function prefixSearch(collectionName, field, prefix, max = 10) {
  if (!prefix) return [];
  try {
    const snap = await getDocs(
      query(
        collection(db, collectionName),
        where(field, '>=', prefix),
        where(field, '<=', prefix + PREFIX_HIGH),
        limit(max)
      )
    );
    return snap.docs;
  } catch (err) {
    const key = `${collectionName}:${field}`;
    if (!prefixSearch._warned) prefixSearch._warned = new Set();
    if (!prefixSearch._warned.has(key)) {
      prefixSearch._warned.add(key);
      console.error(
        `[verifyLookup] prefix query FAILED on ${collectionName}.${field}. ` +
        `This is likely a missing composite index. Open the Firestore console ` +
        `and create the index Firestore suggests. Underlying error: ${err.message}`
      );
    }
    return [];
  }
}

async function findByPrefixName(normalizedName) {
  if (!normalizedName) return [];

  const [brandDocs, sellerBizDocs, sellerNameDocs] = await Promise.all([
    prefixSearch('brands', 'normalizedName', normalizedName),
    prefixSearch('sellers', 'businessNameLower', normalizedName),
    prefixSearch('sellers', 'displayNameLower', normalizedName),
  ]);

  const results = [];

  for (const d of brandDocs) {
    results.push(shapeResult('brand', d.id, d.data(), { matchKind: 'name' }));
  }
  for (const d of sellerBizDocs) {
    results.push(shapeResult('seller', d.id, d.data(), { matchKind: 'name' }));
  }
  for (const d of sellerNameDocs) {
    results.push(shapeResult('seller', d.id, d.data(), { matchKind: 'name' }));
  }

  return dedupe(results);
}

async function findByEmail(email) {
  if (!email) return [];
  const [brandSnap, sellerSnap] = await Promise.allSettled([
    getDocs(query(collection(db, 'brands'), where('email', '==', email), limit(5))),
    getDocs(query(collection(db, 'sellers'), where('email', '==', email), limit(5))),
  ]);
  const results = [];
  if (brandSnap.status === 'fulfilled') {
    results.push(...brandSnap.value.docs.map((d) =>
      shapeResult('brand', d.id, d.data(), { matchKind: 'email' })));
  }
  if (sellerSnap.status === 'fulfilled') {
    results.push(...sellerSnap.value.docs.map((d) =>
      shapeResult('seller', d.id, d.data(), { matchKind: 'email' })));
  }
  return results;
}

async function findByPhone(digits) {
  if (!digits) return [];

  const [b1, b2, s1, s2] = await Promise.allSettled([
    getDocs(query(collection(db, 'brands'), where('phoneDigits', '==', digits), limit(5))),
    getDocs(query(collection(db, 'brands'), where('phoneNumber', '==', digits), limit(5))),
    getDocs(query(collection(db, 'sellers'), where('phoneDigits', '==', digits), limit(5))),
    getDocs(query(collection(db, 'sellers'), where('phone', '==', digits), limit(5))),
  ]);

  const results = [];
  if (b1.status === 'fulfilled') results.push(...b1.value.docs.map((d) =>
    shapeResult('brand', d.id, d.data(), { matchKind: 'phone' })));
  if (b2.status === 'fulfilled') results.push(...b2.value.docs.map((d) =>
    shapeResult('brand', d.id, d.data(), { matchKind: 'phone' })));
  if (s1.status === 'fulfilled') results.push(...s1.value.docs.map((d) =>
    shapeResult('seller', d.id, d.data(), { matchKind: 'phone' })));
  if (s2.status === 'fulfilled') results.push(...s2.value.docs.map((d) =>
    shapeResult('seller', d.id, d.data(), { matchKind: 'phone' })));

  return results;
}

async function findByHandle(handle, platform) {
  if (!handle) return [];
  const handleLower = normalizeHandle(handle);
  const platformLower = platform
    ? (platform === 'x' ? 'twitter' : platform).toLowerCase()
    : null;

  let snap = null;

  // Preferred: indexed `handleLower`
  try {
    snap = await getDocs(
      query(
        collection(db, 'social_handle_registry'),
        where('handleLower', '==', handleLower),
        limit(10)
      )
    );
  } catch { /* fall through */ }

  // Fallback: legacy `handle` (exact case)
  if (!snap || snap.empty) {
    try {
      snap = await getDocs(
        query(
          collection(db, 'social_handle_registry'),
          where('handle', '==', handle),
          limit(10)
        )
      );
    } catch { /* ignore */ }
  }

  if (!snap || snap.empty) return [];

  let hits = snap.docs.map((d) => d.data());
  if (platformLower) {
    hits = hits.filter(
      (r) => (r.platformLower || r.platform || '').toLowerCase() === platformLower
    );
  }

  if (!hits.length) return [];

  const results = [];
  for (const hit of hits) {
    if (!hit.ownerUid) continue; // defensive
    const [brand, seller] = await Promise.all([
      getBrandById(hit.ownerUid),
      getSellerById(hit.ownerUid),
    ]);
    // Note: if neither brand nor seller exists (orphaned registry
    // entry), we silently skip. That's the @storyca12 case.
    if (brand) {
      results.push({
        ...brand,
        matchedHandle: { platform: hit.platform, handle: hit.handle },
        matchKind: 'handle',
      });
    } else if (seller) {
      results.push({
        ...seller,
        matchedHandle: { platform: hit.platform, handle: hit.handle },
        matchKind: 'handle',
      });
    }
  }
  return results;
}

async function findByUid(uid) {
  if (!uid) return [];
  const [brand, seller] = await Promise.all([
    getBrandById(uid),
    getSellerById(uid),
  ]);
  return [brand, seller].filter(Boolean).map((r) => ({ ...r, matchKind: 'id' }));
}

/* ============================================================
   Public-safe shape
   ============================================================ */

function shapeResult(type, id, raw, opts = {}) {
  const isBrand = type === 'brand';
  const displayName =
    raw.displayName || raw.businessName || raw.companyName || raw.name || 'Unnamed';
  const slug = raw.slug || raw.publicSlug || null;
  const verified =
    raw.verificationStatus === 'verified' ||
    raw.verificationStatus === 'fully_verified' ||
    raw.overallStatus === 'verified' ||
    raw.overallStatus === 'fully_verified';

  return {
    type,
    id,
    displayName,
    slug,
    verified,
    avatarUrl: raw.avatarUrl || raw.logoUrl || null,
    location: raw.location || raw.city || null,
    bio: raw.bio || raw.tagline || null,
    publicPath: slug ? (isBrand ? `/b/${slug}` : `/s/${slug}`) : null,
    matchedHandle: null,
    matchedSlug: null,
    matchKind: opts.matchKind || 'unknown',
  };
}

function dedupe(list) {
  const seen = new Set();
  const out = [];
  for (const item of list) {
    if (!item) continue;
    const key = `${item.type}:${item.id}`;
    if (seen.has(key)) {
      const existing = out.find((x) => `${x.type}:${x.id}` === key);
      if (existing) {
        if (!existing.matchedHandle && item.matchedHandle) existing.matchedHandle = item.matchedHandle;
        if (!existing.matchedSlug && item.matchedSlug) existing.matchedSlug = item.matchedSlug;
        const rank = { handle: 5, slug: 4, email: 4, phone: 4, id: 3, name: 2, unknown: 0 };
        if ((rank[item.matchKind] || 0) > (rank[existing.matchKind] || 0)) {
          existing.matchKind = item.matchKind;
        }
      }
      continue;
    }
    seen.add(key);
    out.push(item);
  }
  return out;
}

/* ============================================================
   Ranking
   ============================================================ */
function rankResults(results, query) {
  const qNorm = normalizeName(query);
  const rankKind = {
    handle: 6, slug: 6, email: 6, phone: 6, id: 6,
    name: 4, unknown: 0,
  };

  return results.slice().sort((a, b) => {
    if (a.verified !== b.verified) return a.verified ? -1 : 1;

    const aExact = normalizeName(a.displayName) === qNorm ? 1 : 0;
    const bExact = normalizeName(b.displayName) === qNorm ? 1 : 0;
    if (aExact !== bExact) return bExact - aExact;

    const aK = rankKind[a.matchKind] || 0;
    const bK = rankKind[b.matchKind] || 0;
    if (aK !== bK) return bK - aK;

    if (a.type !== b.type) return a.type === 'brand' ? -1 : 1;

    return a.displayName.localeCompare(b.displayName);
  });
}

/* ============================================================
   Public entry point
   ============================================================ */

export async function searchVerification(rawQuery) {
  const query_ = (rawQuery || '').trim();

  if (!query_) {
    return { query: rawQuery, interpretations: [], results: [], classified: null };
  }

  const interpretations = interpret(query_);

  if (!interpretations.length) {
    return { query: rawQuery, interpretations, results: [], classified: null };
  }

  try {
    const lookups = interpretations.map((interp) => {
      switch (interp.kind) {
        case 'slug':   return findBySlug(interp.value);
        case 'handle': return findByHandle(interp.handle, interp.platform);
        case 'email':  return findByEmail(interp.value);
        case 'phone':  return findByPhone(interp.value);
        case 'uid':    return findByUid(interp.value);
        case 'name':   return findByPrefixName(interp.value);
        default:       return Promise.resolve([]);
      }
    });

    const settled = await Promise.allSettled(lookups);

    const merged = [];
    for (const r of settled) {
      if (r.status === 'fulfilled' && Array.isArray(r.value)) {
        merged.push(...r.value);
      }
    }

    const results = rankResults(dedupe(merged), query_);

    return {
      query: rawQuery,
      interpretations,
      classified: interpretations[0] || null,
      results,
    };
  } catch (err) {
    console.error('searchVerification failed:', err);
    return {
      query: rawQuery,
      interpretations,
      classified: interpretations[0] || null,
      results: [],
      error:
        'We could not complete the search right now. Please try again in a moment.',
    };
  }
}

/**
 * Backwards-compat export.
 */
export function classifyQuery(raw) {
  const interps = interpret(raw);
  return interps[0] || { kind: 'empty' };
}