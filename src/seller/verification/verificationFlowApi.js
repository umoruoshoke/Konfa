// src/seller/verification/verificationFlowApi.js
// ============================================================
// Two-level seller verification + social account verification.
//
// Level 1 now stores compressed NIN document + selfie images
// as base64 strings directly on the Firestore document — no
// Firebase Storage required.
//
// Public-facing profile data is mirrored into a separate
// collection (public_seller_profiles/{slug}) so the /s/{slug}
// page never touches the private seller_verifications doc.
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
import { db, auth } from '../../firebase';

// ============================================================
// NAME MATCHING — order-independent, word-by-word
// ============================================================
const TITLE_WORDS = new Set([
  'mr', 'mrs', 'miss', 'ms', 'dr', 'prof', 'engr', 'barr', 'chief',
  'alhaji', 'alhaja', 'hajia', 'pastor', 'rev', 'reverend', 'bishop',
  'apostle', 'evang', 'evangelist', 'sir', 'madam', 'mallam', 'malam',
  'prince', 'princess', 'king', 'queen', 'oba', 'igwe', 'eze',
  'hon', 'honourable', 'senator', 'ambassador',
]);

export function normaliseName(name) {
  return String(name || '')
    .toLowerCase()
    .replace(/[^a-z\s'-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function nameWords(name) {
  return normaliseName(name)
    .split(' ')
    .filter((w) => w.length >= 2 && !TITLE_WORDS.has(w));
}

export function compareNames(legalName, accountName) {
  const legalWords = nameWords(legalName);
  const accountWords = nameWords(accountName);

  if (legalWords.length === 0 || accountWords.length === 0) {
    return {
      matched: false,
      legalWords,
      accountWords,
      missingInAccount: legalWords,
      missingInLegal: accountWords,
      reason: 'One of the name fields is empty or contains only titles.',
    };
  }

  const legalSet = new Set(legalWords);
  const accountSet = new Set(accountWords);

  const missingInAccount = legalWords.filter((w) => !accountSet.has(w));
  const missingInLegal = accountWords.filter((w) => !legalSet.has(w));

  const matched =
    missingInAccount.length === 0 && missingInLegal.length === 0;

  let reason = null;
  if (!matched) {
    const parts = [];
    if (missingInAccount.length > 0) {
      parts.push(
        `"${missingInAccount.join(', ')}" appear${
          missingInAccount.length === 1 ? 's' : ''
        } in your legal name but not in the account name`
      );
    }
    if (missingInLegal.length > 0) {
      parts.push(
        `"${missingInLegal.join(', ')}" appear${
          missingInLegal.length === 1 ? 's' : ''
        } in the account name but not in your legal name`
      );
    }
    reason = `${parts.join('; ')}. An admin will review your submission.`;
  }

  return {
    matched,
    legalWords,
    accountWords,
    missingInAccount,
    missingInLegal,
    reason,
  };
}

// ============================================================
// READ
// ============================================================
export async function fetchMyVerification() {
  const uid = auth.currentUser?.uid;
  if (!uid) return null;

  const ref = doc(db, 'seller_verifications', uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) return emptyRecord(uid);
  return { id: snap.id, ...snap.data() };
}

function emptyRecord(uid) {
  return {
    sellerUid: uid,
    sellerEmail: auth.currentUser?.email || null,
    sellerDisplayName: auth.currentUser?.displayName || null,
    publicSlug: null,
    publicProfile: {
      enabled: false,
      displayName: '',
      category: '',
      description: '',
      showOwnerName: true,
      showBusiness: true,
    },
    owner: { status: 'unsubmitted' },
    business: { status: 'unsubmitted' },
    accounts: {},
    overallStatus: 'unverified',
    createdAt: null,
    updatedAt: null,
  };
}

export async function fetchSellerProfile() {
  const uid = auth.currentUser?.uid;
  if (!uid) return null;
  try {
    const snap = await getDoc(doc(db, 'sellers', uid));
    if (!snap.exists()) return null;
    return { id: snap.id, ...snap.data() };
  } catch (err) {
    console.warn('fetchSellerProfile failed:', err.code);
    return null;
  }
}

// ============================================================
// LEVEL 1 — OWNER IDENTITY
// ============================================================
export async function submitOwnerVerification({
  legalName,
  nin,
  bankName,
  accountNumber,
  accountName,
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
  if (!/^\d{10}$/.test(String(accountNumber || '').trim())) {
    throw new Error('Account number must be exactly 10 digits.');
  }
  if (!bankName || !accountName) {
    throw new Error('Bank name and account name are required.');
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

  const ref = doc(db, 'seller_verifications', uid);
  const snap = await getDoc(ref);
  const base = snap.exists() ? snap.data() : emptyRecord(uid);

  const existingOwnerStatus = base.owner?.status;
  if (existingOwnerStatus === 'pending') {
    throw new Error(
      'Your owner identity is already submitted and pending review. ' +
        'You cannot resubmit while under review.'
    );
  }
  if (existingOwnerStatus === 'verified') {
    throw new Error(
      'Your owner identity is already verified. ' +
        'Contact support if you need to change details.'
    );
  }

  const nameCheck = compareNames(legalName, accountName);

  const ownerBlock = {
    status: 'pending',
    legalName: legalName.trim(),
    nin: String(nin).trim(),
    bankAccount: {
      bankName: bankName.trim(),
      accountNumber: String(accountNumber).trim(),
      accountName: accountName.trim(),
    },
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
    sellerUid: uid,
    sellerEmail: auth.currentUser?.email || base.sellerEmail || null,
    sellerDisplayName:
      auth.currentUser?.displayName || base.sellerDisplayName || null,
    owner: ownerBlock,
    overallStatus: computeOverall({
      owner: ownerBlock,
      business: base.business,
      accounts: base.accounts,
    }),
    updatedAt: serverTimestamp(),
    createdAt: base.createdAt || serverTimestamp(),
  };

  await setDoc(ref, payload, { merge: true });

  await addDoc(collection(db, 'seller_verification_log'), {
    sellerUid: uid,
    platform: 'owner',
    result: 'pending',
    nameMatch: nameCheck.matched,
    submittedAt: serverTimestamp(),
  });

  return {
    ok: true,
    nameMatch: nameCheck.matched,
    nameMatchDetail: nameCheck,
  };
}

// ============================================================
// LEVEL 2 — BUSINESS IDENTITY
// ============================================================
export async function submitBusinessVerification({
  type,
  businessName,
  cacNumber = null,
  certificateUrl = null,
  ownerName = null,
  physicalAddress = '',
  city = '',
  state = '',
  phone = '',
  email = '',
  website = '',
}) {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('Not signed in.');

  const ref = doc(db, 'seller_verifications', uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    throw new Error('Complete Level 1 (Owner Identity) first.');
  }

  const base = snap.data();
  const ownerOk =
    base.owner?.status === 'verified' || base.owner?.status === 'pending';
  if (!ownerOk) {
    throw new Error(
      'Your owner identity must be submitted before your business.'
    );
  }

  if (base.business?.status === 'pending') {
    throw new Error(
      'Your business identity is already submitted and pending review.'
    );
  }

  if (!businessName || businessName.trim().length < 2) {
    throw new Error('Enter the business name.');
  }

  if (type === 'registered') {
    if (!cacNumber || String(cacNumber).trim().length < 3) {
      throw new Error('Enter a valid CAC registration number.');
    }
  } else {
    if (!ownerName) {
      throw new Error('Owner name missing — complete Level 1 first.');
    }
  }

  const businessBlock = {
    status: 'pending',
    type,
    registered:
      type === 'registered'
        ? {
            cacNumber: String(cacNumber).trim(),
            businessName: businessName.trim(),
            certificateUrl,
          }
        : null,
    unregistered:
      type === 'unregistered'
        ? { businessName: businessName.trim(), ownerName }
        : null,
    businessName: businessName.trim(),
    address: {
      physical: physicalAddress.trim(),
      city: city.trim(),
      state: state.trim(),
    },
    contact: {
      phone: phone.trim(),
      email: email.trim(),
      website: website.trim(),
    },
    submittedAt: serverTimestamp(),
    verifiedAt: null,
    verifiedBy: null,
    rejectionReason: null,
  };

  const overallStatus = computeOverall({
    owner: base.owner,
    business: businessBlock,
    accounts: base.accounts,
  });

  await updateDoc(ref, {
    business: businessBlock,
    overallStatus,
    updatedAt: serverTimestamp(),
  });

  await addDoc(collection(db, 'seller_verification_log'), {
    sellerUid: uid,
    platform: 'business',
    result: 'pending',
    submittedAt: serverTimestamp(),
  });

  return { ok: true };
}

// ============================================================
// PUBLIC PROFILE — save settings + mirror to public collection
// ============================================================
export async function savePublicProfile({
  displayName,
  category,
  description,
  enabled,
  showOwnerName,
  showBusiness,
}) {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('Not signed in.');

  const ref = doc(db, 'seller_verifications', uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error('Complete verification first.');

  const base = snap.data();
  let slug = base.publicSlug;
  if (!slug) {
    slug = await generateUniqueSlug(
      displayName || base.sellerDisplayName || uid
    );
  }

  const publicProfile = {
    enabled: !!enabled,
    displayName: (displayName || '').trim(),
    category: (category || '').trim(),
    description: (description || '').trim(),
    showOwnerName: showOwnerName !== false,
    showBusiness: showBusiness !== false,
    updatedAt: serverTimestamp(),
  };

  // 1. Save the full public profile settings on the private doc
  await updateDoc(ref, {
    publicSlug: slug,
    publicProfile,
    updatedAt: serverTimestamp(),
  });

  // 2. Mirror the public-safe fields into public_seller_profiles/{slug}
  //    This is what /s/{slug} reads. Never touches seller_verifications.
  try {
    const mirrorData = buildPublicMirror({
      uid,
      slug,
      base,
      publicProfile,
    });
    await setDoc(doc(db, 'public_seller_profiles', slug), mirrorData, {
      merge: true,
    });
  } catch (err) {
    console.warn('Could not sync public mirror:', err.code);
    // Non-fatal — the private doc is saved. The mirror will be
    // created next time the seller saves. The public page will
    // show "Profile not found" until then.
  }

  return { ok: true, slug };
}

/**
 * Build the public-safe mirror payload from a seller's private
 * verification data. NEVER include NIN, bank account, uploaded
 * documents, pending codes, or any PII beyond what the seller
 * has explicitly chosen to make public.
 */
function buildPublicMirror({ uid, slug, base, publicProfile }) {
  const owner = base.owner || {};
  const business = base.business || {};
  const accounts = base.accounts || {};

  // Only verified accounts, only the fields safe to publish
  const publicAccounts = Object.entries(accounts)
    .filter(([, a]) => a?.status === 'verified')
    .map(([platform, a]) => ({
      platform,
      handle: a.handle || null,
      url: a.url || null,
    }));

  return {
    slug,
    ownerUid: uid,
    enabled: !!publicProfile.enabled,
    displayName: publicProfile.displayName || null,
    category: publicProfile.category || null,
    description: publicProfile.description || null,
    showOwnerName: publicProfile.showOwnerName !== false,
    showBusiness: publicProfile.showBusiness !== false,

    ownerVerified: owner.status === 'verified',
    ownerName:
      publicProfile.showOwnerName !== false
        ? owner.legalName || null
        : null,

    businessVerified: business.status === 'verified',
    business: {
      businessName: business.businessName || null,
      type: business.type || null,
      cacNumber:
        business.type === 'registered'
          ? business.registered?.cacNumber || null
          : null,
      ownerName:
        business.type === 'unregistered'
          ? business.unregistered?.ownerName || null
          : null,
      address:
        publicProfile.showBusiness !== false
          ? {
              physical: business.address?.physical || null,
              city: business.address?.city || null,
              state: business.address?.state || null,
            }
          : null,
      contact:
        publicProfile.showBusiness !== false
          ? {
              phone: business.contact?.phone || null,
              email: business.contact?.email || null,
              website: business.contact?.website || null,
            }
          : null,
    },

    accounts: publicAccounts,

    updatedAt: serverTimestamp(),
  };
}

async function generateUniqueSlug(input) {
  const base =
    String(input || 'seller')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40) || 'seller';

  const candidates = [base];
  for (let i = 0; i < 5; i++) {
    candidates.push(`${base}-${Math.random().toString(36).slice(2, 6)}`);
  }

  for (const candidate of candidates) {
    try {
      const snap = await getDocs(
        query(
          collection(db, 'seller_verifications'),
          where('publicSlug', '==', candidate)
        )
      );
      if (snap.empty) return candidate;
    } catch {
      return `${base}-${Math.random().toString(36).slice(2, 6)}`;
    }
  }
  return `${base}-${Date.now().toString(36)}`;
}

// ============================================================
// PUBLIC PROFILE — read by slug (from the mirror collection)
// ============================================================
export async function fetchPublicProfileBySlug(slug) {
  if (!slug) return null;
  try {
    const snap = await getDoc(doc(db, 'public_seller_profiles', slug));
    if (!snap.exists()) return null;

    const data = snap.data();
    if (!data.enabled) return null;

    // Re-shape into the same structure PublicSellerProfile.jsx
    // already expects, so the component works with no changes.
    return {
      publicSlug: slug,
      publicProfile: {
        enabled: true,
        displayName: data.displayName,
        category: data.category,
        description: data.description,
        showOwnerName: data.showOwnerName,
        showBusiness: data.showBusiness,
      },
      owner: {
        status: data.ownerVerified ? 'verified' : 'unverified',
        legalName: data.ownerName,
      },
      business: {
        status: data.businessVerified ? 'verified' : 'unsubmitted',
        type: data.business?.type,
        businessName: data.business?.businessName,
        registered: data.business?.cacNumber
          ? { cacNumber: data.business.cacNumber }
          : null,
        unregistered: data.business?.ownerName
          ? { ownerName: data.business.ownerName }
          : null,
        address: data.business?.address,
        contact: data.business?.contact,
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
        ])
      ),
      updatedAt: data.updatedAt,
    };
  } catch (err) {
    console.warn('fetchPublicProfileBySlug failed:', err.code);
    return null;
  }
}

// ============================================================
// BACKFILL — admin-only, one-off
// ============================================================
/**
 * Rewrites the public mirror for a single seller. Call this if
 * a seller's public page shows "Profile not found" even though
 * they have saved a public profile and toggled it live.
 *
 * Safe to run multiple times — it merges.
 */
export async function backfillPublicMirror(sellerUid) {
  if (!sellerUid) throw new Error('sellerUid required.');

  const snap = await getDoc(doc(db, 'seller_verifications', sellerUid));
  if (!snap.exists()) throw new Error('Verification doc not found.');

  const base = snap.data();
  const slug = base.publicSlug;
  const publicProfile = base.publicProfile;

  if (!slug) {
    throw new Error('This seller has no public slug yet.');
  }
  if (!publicProfile) {
    throw new Error('This seller has not saved a public profile yet.');
  }

  const mirrorData = buildPublicMirror({
    uid: sellerUid,
    slug,
    base,
    publicProfile,
  });

  await setDoc(doc(db, 'public_seller_profiles', slug), mirrorData, {
    merge: true,
  });

  return { ok: true, slug };
}

// ============================================================
// HELPERS
// ============================================================
export function computeOverall({ owner, business, accounts }) {
  const ownerOk = owner?.status === 'verified';
  const bizOk = business?.status === 'verified';
  const socialList = Object.values(accounts || {});
  const socialVerified = socialList.filter(
    (a) => a.status === 'verified'
  ).length;

  if (ownerOk && bizOk && socialVerified >= 1) return 'fully_verified';
  if (ownerOk && (bizOk || socialVerified >= 1)) return 'partially_verified';
  if (ownerOk) return 'owner_verified';
  return 'unverified';
}

export function overallLabel(status) {
  switch (status) {
    case 'fully_verified':
      return 'Fully verified';
    case 'partially_verified':
      return 'Partially verified';
    case 'owner_verified':
      return 'Owner verified';
    case 'unverified':
    default:
      return 'Not verified';
  }
}

export function maskNin(nin) {
  if (!nin || nin.length < 4) return '•••••••••••';
  return `•••••••${nin.slice(-4)}`;
}

export function maskBankAccount(acc) {
  if (!acc || acc.length < 4) return '•••• ••••';
  return `••••${acc.slice(-4)}`;
}