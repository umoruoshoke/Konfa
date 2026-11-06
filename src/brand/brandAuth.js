// src/brand/brandAuth.js
// ============================================================
// Authentication + Firestore logic for the Brand (public figure)
// module. Brands are separate from sellers and manufacturers —
// they are public figures, artists, churches, event organizers,
// and other entities that want to prove identity without selling
// products on the platform.
// ============================================================

import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  sendPasswordResetEmail,
  updateProfile,
  deleteUser,
} from 'firebase/auth';
import {
  collection,
  query,
  where,
  getDocs,
  getDoc,
  doc,
  setDoc,
  updateDoc,
  addDoc,
  deleteDoc,
  runTransaction,
  serverTimestamp,
  limit,
} from 'firebase/firestore';
import { auth, db } from '../firebase';
import { normalizeBrandName } from './normalizeName';

export class BrandAuthError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

const AUTH_ERROR_MAP = {
  'auth/email-already-in-use':
    'An account with this email already exists. Try signing in instead.',
  'auth/invalid-email': 'Please enter a valid email address.',
  'auth/weak-password': 'Password must be at least 6 characters.',
  'auth/user-not-found': 'No account found with that email.',
  'auth/wrong-password': 'Incorrect email or password.',
  'auth/invalid-credential': 'Incorrect email or password.',
  'auth/too-many-requests':
    'Too many attempts. Please try again in a few minutes.',
  'auth/network-request-failed':
    'Network error. Check your internet connection.',
};

function friendlyError(err) {
  return AUTH_ERROR_MAP[err.code] || err.message || 'Something went wrong.';
}

// ============================================================
// Normalizers — must match verifyLookupApi.js and searchApi.js
// ============================================================
const digitsOnly = (s = '') =>
  s.toString().replace(/\D/g, '').replace(/^0+/, '');

const tokensOf = (normalizedName = '') =>
  Array.from(
    new Set(
      (normalizedName || '')
        .split(/\s+/)
        .map((t) => t.trim())
        .filter((t) => t.length >= 2),
    ),
  );

// ============================================================
// PUBLIC NAME AVAILABILITY
// ============================================================

export async function isBrandNameAvailable(displayName) {
  const normalized = normalizeBrandName(displayName || '');
  if (!normalized) return { available: false, normalized, reason: 'empty' };
  if (normalized.length < 2) {
    return { available: false, normalized, reason: 'short' };
  }

  const snap = await getDocs(
    query(
      collection(db, 'brandNames'),
      where('__name__', '==', normalized),
      limit(1),
    ),
  );

  return { available: snap.empty, normalized };
}

export async function assertBrandNameAvailable(displayName) {
  const { available, normalized, reason } = await isBrandNameAvailable(
    displayName,
  );

  if (reason === 'empty') {
    throw new BrandAuthError(
      'brand/missing-name',
      'Please enter the name you want to be verified under.',
    );
  }
  if (reason === 'short') {
    throw new BrandAuthError(
      'brand/name-too-short',
      'Name must contain at least 2 letters or numbers.',
    );
  }
  if (!available) {
    throw new BrandAuthError(
      'brand/name-taken',
      'That public name is already taken. Please choose another.',
    );
  }
  return normalized;
}

// ============================================================
// SIGN UP
// ------------------------------------------------------------
// ✅ Writes `phoneDigits`, `tokens`, and `digits` on both the
// brandNames reservation doc and the brands profile doc so that
// verifyLookupApi.js can find brands by name, token, phone, or
// numeric ID without any extra backfill.
// ============================================================
export async function signUpBrand({
  email,
  password,
  displayName,
  brandType = 'individual',
  phoneNumber = '',
}) {
  if (!email || !password) {
    throw new BrandAuthError(
      'brand/missing-fields',
      'Email and password are required.',
    );
  }
  if (password.length < 6) {
    throw new BrandAuthError(
      'brand/weak-password',
      'Password must be at least 6 characters.',
    );
  }
  if (!displayName || displayName.trim().length < 2) {
    throw new BrandAuthError(
      'brand/missing-name',
      'Please enter the name you want to be verified under.',
    );
  }

  const cleanEmail = email.trim().toLowerCase();
  const cleanName = displayName.trim();
  const normalized = normalizeBrandName(cleanName);

  if (normalized.length < 2) {
    throw new BrandAuthError(
      'brand/name-too-short',
      'Name must contain at least 2 letters or numbers.',
    );
  }

  const tokens = tokensOf(normalized);
  const digits = digitsOnly(cleanName);
  const phoneDigits = digitsOnly(phoneNumber);

  // ---- 1. Create the auth user ----
  let cred;
  try {
    cred = await createUserWithEmailAndPassword(auth, cleanEmail, password);
  } catch (err) {
    throw new BrandAuthError(err.code, friendlyError(err));
  }

  const user = cred.user;

  try {
    await updateProfile(user, { displayName: cleanName });
  } catch {
    /* non-fatal */
  }

  // ---- 2. Atomically reserve the name + create the brand doc ----
  try {
    await runTransaction(db, async (tx) => {
      const nameRef = doc(db, 'brandNames', normalized);
      const existing = await tx.get(nameRef);

      if (existing.exists()) {
        const owner = existing.data()?.brandId;
        if (owner && owner !== user.uid) {
          throw new BrandAuthError(
            'brand/name-taken',
            'That public name is already taken. Please choose another.',
          );
        }
        tx.set(
          nameRef,
          {
            brandId: user.uid,
            displayName: cleanName,
            normalizedName: normalized,
            tokens,
            digits,
            createdAt: existing.data()?.createdAt || serverTimestamp(),
          },
          { merge: true },
        );
      } else {
        tx.set(nameRef, {
          brandId: user.uid,
          displayName: cleanName,
          normalizedName: normalized,
          tokens,
          digits,
          createdAt: serverTimestamp(),
        });
      }

      tx.set(doc(db, 'brands', user.uid), {
        uid: user.uid,
        email: cleanEmail,
        displayName: cleanName,
        normalizedName: normalized,
        tokens,
        digits,
        brandType,
        phoneNumber: (phoneNumber || '').trim(),
        phoneDigits, // ✅ enables phone search
        status: 'active',
        verificationStatus: 'unverified',
        publicProfileEnabled: false,
        publicSlug: null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        lastLoginAt: serverTimestamp(),
      });
    });
  } catch (err) {
    try {
      await deleteUser(user);
    } catch (rollbackErr) {
      console.error('Rollback failed — orphan auth user:', rollbackErr);
    }

    if (err instanceof BrandAuthError) throw err;
    console.error('Brand signup transaction failed:', err);
    throw new BrandAuthError(
      'brand/profile-failed',
      'Could not reserve that name. Please try again.',
    );
  }

  return { user, brandId: user.uid, normalizedName: normalized };
}

// ============================================================
// SIGN IN
// ============================================================
export async function signInBrand(email, password) {
  let cred;
  try {
    cred = await signInWithEmailAndPassword(
      auth,
      email.trim().toLowerCase(),
      password,
    );
  } catch (err) {
    throw new BrandAuthError(err.code, friendlyError(err));
  }

  const user = cred.user;

  try {
    await updateDoc(doc(db, 'brands', user.uid), {
      lastLoginAt: serverTimestamp(),
    });
  } catch {
    /* non-fatal */
  }

  return { user };
}

// ============================================================
// SIGN OUT
// ============================================================
export const signOutBrand = async () => {
  await signOut(auth);
};

// ============================================================
// AUTH WATCHER
// ============================================================
export const watchBrandAuth = (callback) => onAuthStateChanged(auth, callback);

// ============================================================
// GET CURRENT BRAND PROFILE
// ============================================================
export async function getCurrentBrandProfile() {
  const user = auth.currentUser;
  if (!user) return null;

  try {
    const snap = await getDoc(doc(db, 'brands', user.uid));
    if (!snap.exists()) return null;
    const data = snap.data();
    return {
      id: snap.id,
      ...data,
      displayName:
        data.displayName || user.displayName || data.email || 'Brand',
    };
  } catch (err) {
    console.error('Could not load brand profile:', err);
    return null;
  }
}

// ============================================================
// PASSWORD RESET
// ============================================================
export async function resetBrandPassword(email) {
  try {
    await sendPasswordResetEmail(auth, email.trim().toLowerCase());
  } catch (err) {
    throw new BrandAuthError(err.code, friendlyError(err));
  }
}

// ============================================================
// FETCH BRAND BY EMAIL
// ============================================================
export async function findBrandByEmail(email) {
  if (!email) return null;
  const ref = collection(db, 'brands');
  const snap = await getDocs(
    query(ref, where('email', '==', email.toLowerCase()), limit(1)),
  );
  if (snap.empty) return null;
  return { id: snap.docs[0].id, ...snap.docs[0].data() };
}

// ============================================================
// FETCH BRAND BY PUBLIC NAME
// ============================================================
export async function findBrandByPublicName(displayName) {
  const normalized = normalizeBrandName(displayName || '');
  if (!normalized) return null;

  const snap = await getDoc(doc(db, 'brandNames', normalized));
  if (!snap.exists()) return null;

  const { brandId } = snap.data();
  if (!brandId) return null;

  const brandSnap = await getDoc(doc(db, 'brands', brandId));
  if (!brandSnap.exists()) return null;

  return { id: brandSnap.id, ...brandSnap.data() };
}

// ============================================================
// FETCH BRAND BY UID (used by verifyLookupApi.js)
// ============================================================
export async function fetchBrandByUid(uid) {
  if (!uid) return null;
  const snap = await getDoc(doc(db, 'brands', uid));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() };
}

// ============================================================
// FETCH BRAND BY PHONE (used by verifyLookupApi.js)
// ============================================================
export async function findBrandByPhone(phoneNumber) {
  const digits = digitsOnly(phoneNumber || '');
  if (!digits) return null;

  const snap = await getDocs(
    query(
      collection(db, 'brands'),
      where('phoneDigits', '==', digits),
      limit(1),
    ),
  );
  if (snap.empty) return null;
  return { id: snap.docs[0].id, ...snap.docs[0].data() };
}

// ============================================================
// FETCH ONLY VERIFIED BRANDS
// ------------------------------------------------------------
// Used by the public search page. Only returns brands whose
// `verificationStatus === 'verified'`. Fields returned are the
// public-safe projection — no email, no NIN, no owner data.
// ============================================================
export async function fetchVerifiedBrands(maxResults = 200) {
  const snap = await getDocs(
    query(
      collection(db, 'brands'),
      where('verificationStatus', '==', 'verified'),
      limit(maxResults),
    ),
  );

  const out = [];
  for (const d of snap.docs) {
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

    out.push({
      kind: 'brand',
      id: d.id,
      slug:
        data.publicSlug ||
        reservation.normalizedName ||
        data.normalizedName ||
        d.id,
      displayName: data.displayName || reservation.displayName || '',
      normalizedName: data.normalizedName || reservation.normalizedName || '',
      category: data.category || '',
      description: data.bio || '',
      photoURL: data.photoURL || '',
      city: data.city || '',
      state: data.state || '',
      verified: true,
      verifiedAt: data.verifiedAt || null,
      _tokens: data.tokens || reservation.tokens || [],
      _digits: data.digits || reservation.digits || [],
      _phoneDigits: data.phoneDigits || '',
    });
  }
  return out;
}

// ============================================================
// UPDATE PROFILE (allow-list)
// ------------------------------------------------------------
// Keeps `tokens` and `digits` in sync when the display name
// changes, and `phoneDigits` when the phone changes.
// ============================================================
export async function updateBrandProfile({
  displayName,
  phoneNumber,
  category,
  bio,
  photoURL,
} = {}) {
  const user = auth.currentUser;
  if (!user) throw new BrandAuthError('brand/not-signed-in', 'Not signed in.');

  const updates = { updatedAt: serverTimestamp() };

  if (typeof displayName === 'string' && displayName.trim().length >= 2) {
    const cleanName = displayName.trim();
    const normalized = normalizeBrandName(cleanName);
    updates.displayName = cleanName;
    updates.normalizedName = normalized;
    updates.tokens = tokensOf(normalized);
    updates.digits = digitsOnly(cleanName);
  }

  if (phoneNumber !== undefined) {
    updates.phoneNumber = (phoneNumber || '').trim();
    updates.phoneDigits = digitsOnly(phoneNumber);
  }

  if (typeof category === 'string') updates.category = category;
  if (typeof bio === 'string') updates.bio = bio;
  if (typeof photoURL === 'string') updates.photoURL = photoURL;

  await updateDoc(doc(db, 'brands', user.uid), updates);
  return updates;
}

// ============================================================
// RENAME BRAND (atomic across brandNames + brands)
// ============================================================
export async function renameBrand(brandId, newDisplayName) {
  const uid = auth.currentUser?.uid;
  if (!uid || uid !== brandId) {
    throw new BrandAuthError(
      'brand/not-authorised',
      'You can only rename your own brand.',
    );
  }

  const cleanName = (newDisplayName || '').trim();
  const newNormalized = normalizeBrandName(cleanName);

  if (newNormalized.length < 2) {
    throw new BrandAuthError(
      'brand/name-too-short',
      'Name must contain at least 2 letters or numbers.',
    );
  }

  const newTokens = tokensOf(newNormalized);
  const newDigits = digitsOnly(cleanName);

  await runTransaction(db, async (tx) => {
    const brandRef = doc(db, 'brands', brandId);
    const newNameRef = doc(db, 'brandNames', newNormalized);

    const brandSnap = await tx.get(brandRef);
    if (!brandSnap.exists()) {
      throw new BrandAuthError('brand/not-found', 'Brand not found.');
    }

    const newNameSnap = await tx.get(newNameRef);
    if (newNameSnap.exists() && newNameSnap.data().brandId !== brandId) {
      throw new BrandAuthError(
        'brand/name-taken',
        'That public name is already taken. Please choose another.',
      );
    }

    const oldNormalized = brandSnap.data().normalizedName;
    const oldNameRef = oldNormalized
      ? doc(db, 'brandNames', oldNormalized)
      : null;

    if (oldNameRef && oldNormalized !== newNormalized) {
      tx.delete(oldNameRef);
    }

    tx.set(newNameRef, {
      brandId,
      displayName: cleanName,
      normalizedName: newNormalized,
      tokens: newTokens,
      digits: newDigits,
      createdAt: serverTimestamp(),
    });

    tx.update(brandRef, {
      displayName: cleanName,
      normalizedName: newNormalized,
      tokens: newTokens,
      digits: newDigits,
      updatedAt: serverTimestamp(),
    });
  });

  try {
    if (auth.currentUser) {
      await updateProfile(auth.currentUser, { displayName: cleanName });
    }
  } catch {
    /* non-fatal */
  }

  return newNormalized;
}

// ============================================================
// RELEASE A RESERVED NAME
// ============================================================
export async function releaseBrandName(displayNameOrNormalized) {
  const normalized = normalizeBrandName(displayNameOrNormalized || '');
  if (!normalized) return;
  await deleteDoc(doc(db, 'brandNames', normalized));
}

// ============================================================
// DELETE ACCOUNT (profile + name reservation + auth user)
// ============================================================
export async function deleteBrandAccount(uid) {
  const currentUid = uid || auth.currentUser?.uid;
  if (!currentUid) {
    throw new BrandAuthError('brand/not-signed-in', 'Not signed in.');
  }
  if (auth.currentUser && auth.currentUser.uid !== currentUid) {
    throw new BrandAuthError(
      'brand/not-authorised',
      'You can only delete your own account.',
    );
  }

  const brandRef = doc(db, 'brands', currentUid);
  const snap = await getDoc(brandRef);

  if (snap.exists()) {
    const data = snap.data();
    const normalized = data.normalizedName;
    if (normalized) {
      try {
        await deleteDoc(doc(db, 'brandNames', normalized));
      } catch {
        /* non-fatal */
      }
    }
    if (data.publicSlug) {
      try {
        await deleteDoc(doc(db, 'public_brand_profiles', data.publicSlug));
      } catch {
        /* non-fatal */
      }
    }
    await deleteDoc(brandRef);
  }

  if (auth.currentUser && auth.currentUser.uid === currentUid) {
    try {
      await deleteUser(auth.currentUser);
    } catch (err) {
      throw new BrandAuthError(
        err.code || 'auth/unknown',
        'Please sign in again before deleting your account.',
      );
    }
  }
}

// ============================================================
// SEARCH BRANDS BY NAME (token-based) — verified only
// ============================================================
export async function searchBrandsByName(rawQuery, maxResults = 10) {
  const normalized = normalizeBrandName(rawQuery || '');
  if (!normalized || normalized.length < 2) return [];

  const tokens = tokensOf(normalized);
  if (tokens.length === 0) return [];

  const snap = await getDocs(
    query(
      collection(db, 'brands'),
      where('tokens', 'array-contains', tokens[0]),
      limit(maxResults),
    ),
  );

  const results = [];
  snap.forEach((d) => {
    const data = d.data();
    const hasAll = tokens.every((t) => (data.tokens || []).includes(t));
    if (hasAll && data.verificationStatus === 'verified') {
      results.push({ id: d.id, ...data });
    }
  });

  return results;
}

// ============================================================
// LOG VERIFICATION ATTEMPT
// ============================================================
export async function logBrandVerification({
  brandUid,
  level,
  result,
  note = null,
}) {
  try {
    await addDoc(collection(db, 'brand_verification_log'), {
      brandUid,
      level,
      result,
      note,
      createdAt: serverTimestamp(),
    });
  } catch (err) {
    console.warn('Could not log brand verification:', err.code);
  }
}

// ============================================================
// SEARCH-FIELD BACKFILL (one-off admin utility)
// ------------------------------------------------------------
// Adds `normalizedName`, `uid`, `tokens`, `digits`, and
// `phoneDigits` to every existing brand doc that's missing them,
// and re-mirrors each name into `brandNames`.
//
// Run ONCE from the browser console while signed in as admin:
//   import('./brand/brandAuth').then(m => m.backfillBrandSearchFields());
// ============================================================
export async function backfillBrandSearchFields() {
  const brandsSnap = await getDocs(collection(db, 'brands'));
  let patched = 0;
  let mirrored = 0;

  for (const d of brandsSnap.docs) {
    const data = d.data();
    const patch = {};

    const normalized =
      data.normalizedName || normalizeBrandName(data.displayName || '');

    if (!data.normalizedName && normalized) {
      patch.normalizedName = normalized;
    }
    if (!data.uid) patch.uid = d.id;
    if (!data.tokens && normalized) {
      patch.tokens = tokensOf(normalized);
    }
    if (!data.digits && data.displayName) {
      patch.digits = digitsOnly(data.displayName);
    }
    if (!data.phoneDigits && data.phoneNumber) {
      patch.phoneDigits = digitsOnly(data.phoneNumber);
    }

    if (Object.keys(patch).length > 0) {
      try {
        await updateDoc(doc(db, 'brands', d.id), patch);
        patched += 1;
      } catch (err) {
        console.warn(`Could not patch brand ${d.id}:`, err.code);
      }
    }

    // Mirror into brandNames if missing.
    if (normalized) {
      try {
        const nameRef = doc(db, 'brandNames', normalized);
        const nameSnap = await getDoc(nameRef);
        if (!nameSnap.exists()) {
          await setDoc(nameRef, {
            brandId: d.id,
            displayName: data.displayName || '',
            normalizedName: normalized,
            tokens: tokensOf(normalized),
            digits: digitsOnly(data.displayName || ''),
            createdAt: data.createdAt || serverTimestamp(),
          });
          mirrored += 1;
        }
      } catch (err) {
        console.warn(
          `Could not mirror ${normalized} into brandNames:`,
          err.code,
        );
      }
    }
  }

  console.log(`✅ Backfilled ${patched} brand docs, mirrored ${mirrored} names.`);
  return { patched, mirrored };
}