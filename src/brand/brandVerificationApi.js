// src/brand/brandVerificationApi.js
// ============================================================
// Brand verification (owner identity + social accounts).
// Mirrors the seller verification shape but drops the business
// level entirely — brands are individuals or organizations, not
// merchants.
// ============================================================

import {
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  serverTimestamp,
  collection,
  addDoc,
  query,
  where,
  limit,
} from 'firebase/firestore';
import { db, auth } from '../firebase';
import {
  compareNames,
  normaliseName,
  nameWords,
} from '../seller/verification/verificationFlowApi';

// ============================================================
// READ
// ============================================================
export async function fetchMyBrandVerification() {
  const uid = auth.currentUser?.uid;
  if (!uid) return null;

  const ref = doc(db, 'brand_verifications', uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) return emptyBrandRecord(uid);
  return { id: snap.id, ...snap.data() };
}

function emptyBrandRecord(uid) {
  return {
    brandUid: uid,
    brandEmail: auth.currentUser?.email || null,
    brandDisplayName: auth.currentUser?.displayName || null,
    publicSlug: null,
    publicProfile: {
      enabled: false,
      displayName: '',
      category: '',
      description: '',
      showOwnerName: true,
    },
    owner: { status: 'unsubmitted' },
    accounts: {},
    overallStatus: 'unverified',
    createdAt: null,
    updatedAt: null,
  };
}

// ============================================================
// LEVEL 1 — OWNER IDENTITY
// ============================================================
export async function submitBrandOwnerVerification({
  legalName,
  nin,
  ninDocumentData = null,
  selfieWithNinData = null,
}) {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('Not signed in.');

  if (!legalName || legalName.trim().length < 3) {
    throw new Error('Enter your full legal name as it appears on your NIN.');
  }
  if (!/^\d{11}$/.test(String(nin || '').trim())) {
    throw new Error('NIN must be exactly 11 digits.');
  }
  if (!ninDocumentData) {
    throw new Error('Attach a photo of your NIN slip.');
  }
  if (!selfieWithNinData) {
    throw new Error('Attach a selfie of you holding your NIN.');
  }

  const ninBytes = Math.floor((String(ninDocumentData).length * 3) / 4);
  const selfieBytes = Math.floor((String(selfieWithNinData).length * 3) / 4);
  const MAX_PER_IMAGE = 380 * 1024;
  if (ninBytes > MAX_PER_IMAGE) {
    throw new Error('NIN document is too large. Please use a smaller photo.');
  }
  if (selfieBytes > MAX_PER_IMAGE) {
    throw new Error('Selfie is too large. Please use a smaller photo.');
  }

  const ref = doc(db, 'brand_verifications', uid);
  const snap = await getDoc(ref);
  const base = snap.exists() ? snap.data() : emptyBrandRecord(uid);

  const existingOwnerStatus = base.owner?.status;
  if (existingOwnerStatus === 'pending') {
    throw new Error(
      'Your owner identity is already submitted and pending review.',
    );
  }
  if (existingOwnerStatus === 'verified') {
    throw new Error(
      'Your owner identity is already verified. Contact support to change details.',
    );
  }

  const brandName = base.brandDisplayName || auth.currentUser?.displayName || '';
  const nameCheck = compareNames(legalName, brandName);

  const ownerBlock = {
    status: 'pending',
    legalName: legalName.trim(),
    nin: String(nin).trim(),
    ninDocumentData,
    selfieWithNinData,
    ninDocumentBytes: ninBytes,
    selfieWithNinBytes: selfieBytes,
    nameMatch: nameCheck.matched,
    nameMatchDetail: {
      legalWords: nameCheck.legalWords,
      accountWords: nameCheck.accountWords,
      missingInAccount: nameCheck.missingInAccount,
      missingInLegal: nameCheck.missingInLegal,
    },
    submittedAt: serverTimestamp(),
    verifiedAt: null,
    verifiedBy: null,
    rejectionReason: null,
    adminNote: nameCheck.matched ? null : nameCheck.reason,
  };

  const payload = {
    ...base,
    brandUid: uid,
    brandEmail: auth.currentUser?.email || base.brandEmail || null,
    brandDisplayName: brandName || base.brandDisplayName || null,
    owner: ownerBlock,
    overallStatus: computeBrandOverall({
      owner: ownerBlock,
      accounts: base.accounts,
    }),
    updatedAt: serverTimestamp(),
    createdAt: base.createdAt || serverTimestamp(),
  };

  await setDoc(ref, payload, { merge: true });

  await addDoc(collection(db, 'brand_verification_log'), {
    brandUid: uid,
    level: 'owner',
    result: 'pending',
    nameMatch: nameCheck.matched,
    createdAt: serverTimestamp(),
  });

  return {
    ok: true,
    nameMatch: nameCheck.matched,
    nameMatchDetail: nameCheck,
  };
}

// ============================================================
// PUBLIC PROFILE — owner-controlled, only published when verified
// ------------------------------------------------------------
// A brand is considered "verified" if EITHER:
//   • brands/{uid}.verificationStatus === 'verified'   (admin-marked), OR
//   • brand_verifications/{uid}.owner.status === 'verified'
//     (admin approved the owner identity, which implies the brand).
//
// If the owner is verified but the brands/{uid} doc is stale
// (missing verificationStatus), we repair it with a narrowly-scoped
// write that keeps displayName/normalizedName unchanged so the
// `brands` update rule (Case A) passes.
// ============================================================
export async function saveBrandPublicProfile({
  displayName,
  category,
  description,
  enabled,
  showOwnerName,
}) {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('Not signed in.');

  const ref = doc(db, 'brand_verifications', uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error('Complete verification first.');

  const base = snap.data();
  const ownerVerified = base.owner?.status === 'verified';

  // Read the *live* brand doc for verificationStatus.
  const brandRef = doc(db, 'brands', uid);
  const brandSnap = await getDoc(brandRef);
  const brandData = brandSnap.exists() ? brandSnap.data() : {};

  // The brand is verified if either source says so.
  const verified =
    brandData.verificationStatus === 'verified' || ownerVerified;

  // ── Self-heal brands/{uid} ──
  // IMPORTANT: the `brands` rule forbids changing displayName or
  // normalizedName unless the new normalizedName is reserved to
  // this uid in `brandNames`. So we only touch verificationStatus
  // here, keeping displayName/normalizedName exactly as they are.
  // A separate bootstrap (if the doc is missing entirely) is done
  // by `brandAuth.js` at signup, not here.
  if (verified && brandData.verificationStatus !== 'verified') {
    try {
      await setDoc(
        brandRef,
        {
          verificationStatus: 'verified',
          verifiedAt: brandData.verifiedAt || serverTimestamp(),
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      );
    } catch (err) {
      console.warn('Could not repair brands/{uid} verificationStatus:', err);
    }
  }

  // Slug: reuse the stored one, otherwise generate a unique one.
  let slug = base.publicSlug || brandData.publicSlug;
  if (!slug) {
    slug = await generateUniqueBrandSlug(
      displayName || base.brandDisplayName || uid,
    );
  }

  const publicProfile = {
    enabled: !!enabled && verified,
    displayName: (displayName || '').trim(),
    category: (category || '').trim(),
    description: (description || '').trim(),
    showOwnerName: showOwnerName !== false,
    updatedAt: serverTimestamp(),
  };

  await updateDoc(ref, {
    publicSlug: slug,
    publicProfile,
    updatedAt: serverTimestamp(),
  });

  const brandDisplay =
    (displayName || base.brandDisplayName || brandData.displayName || '')
      .toString()
      .trim();
  const normalized =
    brandData.normalizedName || normalizeBrandName(brandDisplay);

  // Write the same-name fields to brands. `displayName` and
  // `normalizedName` are included only to satisfy the CASE A check
  // of the `brands` rule (they must equal the existing values). If
  // the brand doc doesn't exist, we skip this write — creating it
  // from here would be blocked by the create rule unless a name
  // reservation exists, which is out of scope for a save.
  if (brandSnap.exists()) {
    await setDoc(
      brandRef,
      {
        publicSlug: slug,
        publicProfileEnabled: publicProfile.enabled,
        category: publicProfile.category,
        bio: publicProfile.description,
        // Do NOT send displayName/normalizedName here — they are
        // unchanged, and the rule will accept the write because
        // request.resource.data (merged) will carry the same values
        // as resource.data (existing).
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    );
  }

  if (verified && publicProfile.enabled) {
    try {
      const mirror = buildPublicBrandMirror({
        uid,
        slug,
        base,
        publicProfile,
        brandData,
      });
      await setDoc(doc(db, 'public_brand_profiles', slug), mirror, {
        merge: true,
      });
    } catch (err) {
      console.error('Could not sync brand mirror:', err);
    }
  } else {
    try {
      await setDoc(
        doc(db, 'public_brand_profiles', slug),
        {
          slug,
          ownerUid: uid,
          brandId: uid,
          entityType: 'brand',
          enabled: false,
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      );
    } catch (err) {
      console.error('Could not disable stale brand mirror:', err);
    }
  }

  return { ok: true, slug, published: verified && publicProfile.enabled };
}

// ============================================================
// PUBLISH / UNPUBLISH (called by admin when verification changes)
// ============================================================
export async function publishBrandProfile(brandUid) {
  const ref = doc(db, 'brands', brandUid);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;

  const data = snap.data();
  if (data.verificationStatus !== 'verified') {
    await unpublishBrandProfile(brandUid);
    return null;
  }

  const normalized =
    data.normalizedName || normalizeBrandName(data.displayName || '');
  const slug = data.publicSlug || normalized || brandUid;

  const tokens = tokensOf(normalized);
  const digits = digitsOnly(data.displayName || '');

  await setDoc(
    doc(db, 'public_brand_profiles', slug),
    {
      slug,
      brandId: brandUid,
      ownerUid: brandUid,
      entityType: 'brand',
      displayName: data.displayName || '',
      normalizedName: normalized,
      category: data.category || '',
      description: data.bio || '',
      photoURL: data.photoURL || '',
      city: data.city || '',
      state: data.state || '',
      verified: true,
      verifiedAt: data.verifiedAt || serverTimestamp(),
      enabled: true,
      updatedAt: serverTimestamp(),
      tokens,
      digits,
      phoneDigits: data.phoneDigits || '',
    },
    { merge: true },
  );

  await updateDoc(ref, {
    publicSlug: slug,
    publicProfileEnabled: true,
    updatedAt: serverTimestamp(),
  });

  return slug;
}

export async function unpublishBrandProfile(brandUid) {
  const ref = doc(db, 'brands', brandUid);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;

  const data = snap.data();
  const slug =
    data.publicSlug ||
    data.normalizedName ||
    normalizeBrandName(data.displayName || '');

  if (slug) {
    try {
      await setDoc(
        doc(db, 'public_brand_profiles', slug),
        {
          slug,
          ownerUid: brandUid,
          brandId: brandUid,
          entityType: 'brand',
          enabled: false,
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      );
    } catch (err) {
      console.error('Could not disable brand mirror on unpublish:', err);
    }
  }

  await updateDoc(ref, {
    publicProfileEnabled: false,
    updatedAt: serverTimestamp(),
  });
}

function buildPublicBrandMirror({ uid, slug, base, publicProfile, brandData }) {
  const owner = base.owner || {};
  const accounts = base.accounts || {};

  const publicAccounts = Object.entries(accounts)
    .filter(([, a]) => a?.status === 'verified')
    .map(([platform, a]) => ({
      platform,
      handle: a.handle || null,
      url: a.url || null,
    }));

  return {
    slug,
    brandId: uid,
    ownerUid: uid,
    entityType: 'brand',
    enabled: !!publicProfile.enabled,
    displayName: publicProfile.displayName || brandData.displayName || null,
    normalizedName:
      brandData.normalizedName ||
      normalizeBrandName(publicProfile.displayName || ''),
    category: publicProfile.category || null,
    description: publicProfile.description || null,
    photoURL: brandData.photoURL || null,
    city: brandData.city || null,
    state: brandData.state || null,
    showOwnerName: publicProfile.showOwnerName !== false,

    verified: brandData.verificationStatus === 'verified',
    ownerVerified: owner.status === 'verified',
    ownerName:
      publicProfile.showOwnerName !== false
        ? owner.legalName || null
        : null,

    accounts: publicAccounts,

    tokens: tokensOf(
      brandData.normalizedName ||
        normalizeBrandName(publicProfile.displayName || ''),
    ),
    digits: digitsOnly(
      publicProfile.displayName || brandData.displayName || '',
    ),
    phoneDigits: brandData.phoneDigits || '',

    updatedAt: serverTimestamp(),
  };
}

// ------------------------------------------------------------
// Slug generation — queries PUBLIC collections only.
// ------------------------------------------------------------
async function generateUniqueBrandSlug(input) {
  const base =
    String(input || 'brand')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40) || 'brand';

  const candidates = [base];
  for (let i = 0; i < 5; i++) {
    candidates.push(`${base}-${Math.random().toString(36).slice(2, 6)}`);
  }

  for (const candidate of candidates) {
    const [publicBrandSnap, publicSellerSnap] = await Promise.all([
      getDocs(
        query(
          collection(db, 'public_brand_profiles'),
          where('slug', '==', candidate),
          limit(1),
        ),
      ),
      getDocs(
        query(
          collection(db, 'public_seller_profiles'),
          where('slug', '==', candidate),
          limit(1),
        ),
      ),
    ]);
    if (publicBrandSnap.empty && publicSellerSnap.empty) {
      return candidate;
    }
  }
  return `${base}-${Date.now().toString(36)}`;
}

// ============================================================
// READ PUBLIC BRAND PROFILE BY SLUG
// ============================================================
export async function fetchPublicBrandBySlug(slug) {
  if (!slug) return { status: 'not_found', data: null };

  try {
    const snap = await getDoc(doc(db, 'public_brand_profiles', slug));
    if (!snap.exists()) return { status: 'not_found', data: null };

    const data = snap.data();
    if (!data.enabled) return { status: 'disabled', data: null };

    return {
      status: 'ok',
      data: {
        publicSlug: slug,
        entityType: 'brand',
        publicProfile: {
          enabled: true,
          displayName: data.displayName,
          category: data.category,
          description: data.description,
          showOwnerName: data.showOwnerName,
        },
        owner: {
          status: data.ownerVerified ? 'verified' : 'unverified',
          legalName: data.ownerName,
        },
        accounts: Object.fromEntries(
          (data.accounts || []).map((a) => [
            a.platform,
            {
              platform: a.platform,
              handle: a.handle,
              url: a.url,
              status: 'verified',
            },
          ]),
        ),
        updatedAt: data.updatedAt,
      },
    };
  } catch (err) {
    console.warn('fetchPublicBrandBySlug failed:', err.code);
    throw err;
  }
}

// ============================================================
// HELPERS
// ============================================================
export function computeBrandOverall({ owner, accounts }) {
  const ownerOk = owner?.status === 'verified';
  const socialVerified = Object.values(accounts || {}).filter(
    (a) => a.status === 'verified',
  ).length;

  if (ownerOk && socialVerified >= 1) return 'fully_verified';
  if (ownerOk) return 'owner_verified';
  return 'unverified';
}

export function brandOverallLabel(status) {
  switch (status) {
    case 'fully_verified':
      return 'Fully verified';
    case 'owner_verified':
      return 'Owner verified';
    case 'unverified':
    default:
      return 'Not verified';
  }
}

// Local helpers used above (must match brandAuth.js and searchApi.js).
function normalizeBrandName(str = '') {
  return str
    .toString()
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokensOf(normalizedName = '') {
  return Array.from(
    new Set(
      (normalizedName || '')
        .split(/\s+/)
        .map((t) => t.trim())
        .filter((t) => t.length >= 2),
    ),
  );
}

function digitsOnly(s = '') {
  return s.toString().replace(/\D/g, '').replace(/^0+/, '');
}

// Re-export so brand pages can use them without a second import
export { normaliseName, nameWords, compareNames };