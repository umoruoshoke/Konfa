// src/consumer/consumerAuth.js
// ============================================================
// Authentication + Firestore logic for the Consumer (User) module.
// ============================================================

import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  sendPasswordResetEmail,
  updateProfile,
  EmailAuthProvider,
  reauthenticateWithCredential,
  updatePassword,
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
  serverTimestamp,
  orderBy,
  limit,
} from 'firebase/firestore';
import { auth, db } from '../firebase';

// ============================================================
// ERROR CLASS
// ============================================================
export class ConsumerAuthError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

// ============================================================
// FRIENDLY ERROR MESSAGES
// ============================================================
const AUTH_ERROR_MAP = {
  'auth/email-already-in-use': 'An account with this email already exists. Try signing in instead.',
  'auth/invalid-email': 'Please enter a valid email address.',
  'auth/weak-password': 'Password must be at least 6 characters.',
  'auth/user-not-found': 'No account found with that email.',
  'auth/wrong-password': 'Incorrect email or password.',
  'auth/invalid-credential': 'Incorrect email or password.',
  'auth/too-many-requests': 'Too many attempts. Please try again in a few minutes.',
  'auth/network-request-failed': 'Network error. Check your internet connection.',
  'auth/requires-recent-login': 'For security, please sign in again before making this change.',
};

function friendlyError(err) {
  return AUTH_ERROR_MAP[err.code] || err.message || 'Something went wrong.';
}

// ============================================================
// SIGN UP
// ============================================================
export async function signUpConsumer({
  email,
  password,
  fullName,
  phoneNumber = '',
}) {
  if (!email || !password) {
    throw new ConsumerAuthError('consumer/missing-fields', 'Email and password are required.');
  }
  if (password.length < 6) {
    throw new ConsumerAuthError('consumer/weak-password', 'Password must be at least 6 characters.');
  }
  if (!fullName || fullName.trim().length < 2) {
    throw new ConsumerAuthError('consumer/missing-name', 'Please enter your full name.');
  }

  const cleanEmail = email.trim().toLowerCase();
  const cleanName = fullName.trim();

  let cred;
  try {
    cred = await createUserWithEmailAndPassword(auth, cleanEmail, password);
  } catch (err) {
    throw new ConsumerAuthError(err.code, friendlyError(err));
  }

  const user = cred.user;

  try {
    await updateProfile(user, { displayName: cleanName });
  } catch { /* non-fatal */ }

  try {
    await setDoc(doc(db, 'consumers', user.uid), {
      uid: user.uid,
      email: cleanEmail,
      fullName: cleanName,
      phoneNumber: (phoneNumber || '').trim(),
      status: 'active',
      scanCount: 0,
      savedCount: 0,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      lastLoginAt: serverTimestamp(),
      preferences: {
        emailAlerts: true,
        pushAlerts: false,
      },
    });
  } catch (err) {
    console.error('Failed to create consumer profile:', err);
    throw new ConsumerAuthError(
      'consumer/profile-failed',
      'Account created but profile save failed. Please contact support.'
    );
  }

  return { user, consumerId: user.uid };
}

// ============================================================
// SIGN IN
// ============================================================
export async function signInConsumer(email, password) {
  let cred;
  try {
    cred = await signInWithEmailAndPassword(auth, email.trim().toLowerCase(), password);
  } catch (err) {
    throw new ConsumerAuthError(err.code, friendlyError(err));
  }

  const user = cred.user;

  try {
    await updateDoc(doc(db, 'consumers', user.uid), {
      lastLoginAt: serverTimestamp(),
    });
  } catch { /* non-fatal */ }

  return { user };
}

// ============================================================
// SIGN OUT
// ============================================================
export const signOutConsumer = async () => {
  await signOut(auth);
};

// ============================================================
// WATCH AUTH
// ============================================================
export const watchConsumerAuth = (callback) => onAuthStateChanged(auth, callback);

// ============================================================
// GET CURRENT PROFILE
// ============================================================
export async function getCurrentConsumerProfile() {
  const user = auth.currentUser;
  if (!user) return null;

  try {
    const snap = await getDoc(doc(db, 'consumers', user.uid));
    if (!snap.exists()) return null;
    const data = snap.data();
    return {
      id: snap.id,
      ...data,
      fullName: data.fullName || user.displayName || data.email || 'User',
    };
  } catch (err) {
    console.error('Could not load consumer profile:', err);
    return null;
  }
}

// ============================================================
// PASSWORD RESET
// ============================================================
export async function resetConsumerPassword(email) {
  try {
    await sendPasswordResetEmail(auth, email.trim().toLowerCase());
  } catch (err) {
    throw new ConsumerAuthError(err.code, friendlyError(err));
  }
}

// ============================================================
// UPDATE PROFILE
// ============================================================
export async function updateConsumerProfile({ fullName, phoneNumber }) {
  const user = auth.currentUser;
  if (!user) throw new ConsumerAuthError('consumer/not-signed-in', 'You are not signed in.');

  const updates = { updatedAt: serverTimestamp() };
  if (fullName !== undefined) updates.fullName = fullName.trim();
  if (phoneNumber !== undefined) updates.phoneNumber = phoneNumber.trim();

  await updateDoc(doc(db, 'consumers', user.uid), updates);

  if (fullName !== undefined) {
    try {
      await updateProfile(user, { displayName: fullName.trim() });
    } catch { /* non-fatal */ }
  }

  return updates;
}

// ============================================================
// CHANGE PASSWORD
// ============================================================
export async function changeConsumerPassword(currentPassword, newPassword) {
  const user = auth.currentUser;
  if (!user) throw new ConsumerAuthError('consumer/not-signed-in', 'You are not signed in.');
  if (!user.email) throw new ConsumerAuthError('consumer/no-email', 'No email on account.');

  try {
    const credential = EmailAuthProvider.credential(user.email, currentPassword);
    await reauthenticateWithCredential(user, credential);
    await updatePassword(user, newPassword);
  } catch (err) {
    throw new ConsumerAuthError(err.code, friendlyError(err));
  }

  return { success: true };
}

// ============================================================
// SCAN HISTORY
// ============================================================
export async function recordConsumerScan({
  consumerUid,
  unitId,
  referenceCode,
  result,
  productName = null,
  batchCode = null,
  locationCity = null,
  locationRegion = null,
  riskScore = 0,
  flaggedReason = null,
  isImpossible = false,
  // Extended fields
  confidence = null,
  confidenceLabel = null,
  signals = null,
  pinCheckResult = null,
  travelVerdict = null,
  scanEventId = null,
  // 🆕 Location source
  locationSource = null,
}) {
  if (!consumerUid || !unitId) return null;

  try {
    const ref = await addDoc(collection(db, 'consumer_scans'), {
      consumerUid,
      unitId,
      referenceCode: referenceCode || null,
      productName,
      batchCode,
      result,
      locationCity,
      locationRegion,
      locationSource,   // 🆕
      riskScore,
      flaggedReason,
      isImpossible,
      confidence,
      confidenceLabel,
      signals: Array.isArray(signals) ? signals : null,
      pinCheckResult,
      travelVerdict,
      scanEventId,
      scannedAt: serverTimestamp(),
    });

    try {
      const profileRef = doc(db, 'consumers', consumerUid);
      const snap = await getDoc(profileRef);
      if (snap.exists()) {
        const current = snap.data().scanCount || 0;
        await updateDoc(profileRef, { scanCount: current + 1 });
      }
    } catch { /* non-fatal */ }

    return ref.id;
  } catch (err) {
    console.error('Could not record consumer scan:', err.code);
    return null;
  }
}

// ============================================================
// FETCH CONSUMER SCAN HISTORY
// ============================================================
export async function fetchConsumerScans(consumerUid, max = 100) {
  if (!consumerUid) return [];

  try {
    const snap = await getDocs(
      query(
        collection(db, 'consumer_scans'),
        where('consumerUid', '==', consumerUid),
        orderBy('scannedAt', 'desc'),
        limit(max)
      )
    );
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  } catch (err) {
    try {
      const snap = await getDocs(
        query(
          collection(db, 'consumer_scans'),
          where('consumerUid', '==', consumerUid),
          limit(max)
        )
      );
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      list.sort((a, b) => {
        const at = a.scannedAt?.toDate?.()?.getTime?.() || 0;
        const bt = b.scannedAt?.toDate?.()?.getTime?.() || 0;
        return bt - at;
      });
      return list;
    } catch (err2) {
      console.warn('fetchConsumerScans failed:', err2.code);
      return [];
    }
  }
}

// ============================================================
// SAVED PRODUCTS
// ============================================================
export async function saveProduct({
  consumerUid,
  unitId,
  referenceCode,
  productName = null,
  batchCode = null,
  note = '',
}) {
  if (!consumerUid || !unitId) return null;

  const dupSnap = await getDocs(
    query(
      collection(db, 'consumer_saved_products'),
      where('consumerUid', '==', consumerUid),
      where('unitId', '==', unitId)
    )
  );
  if (!dupSnap.empty) {
    return dupSnap.docs[0].id;
  }

  const ref = await addDoc(collection(db, 'consumer_saved_products'), {
    consumerUid,
    unitId,
    referenceCode,
    productName,
    batchCode,
    note,
    savedAt: serverTimestamp(),
  });

  try {
    const profileRef = doc(db, 'consumers', consumerUid);
    const snap = await getDoc(profileRef);
    if (snap.exists()) {
      const current = snap.data().savedCount || 0;
      await updateDoc(profileRef, { savedCount: current + 1 });
    }
  } catch { /* non-fatal */ }

  return ref.id;
}

export async function unsaveProduct(consumerUid, savedDocId) {
  if (!consumerUid || !savedDocId) return;

  await deleteDoc(doc(db, 'consumer_saved_products', savedDocId));

  try {
    const profileRef = doc(db, 'consumers', consumerUid);
    const snap = await getDoc(profileRef);
    if (snap.exists()) {
      const current = snap.data().savedCount || 0;
      await updateDoc(profileRef, {
        savedCount: Math.max(0, current - 1),
      });
    }
  } catch { /* non-fatal */ }
}

export async function fetchSavedProducts(consumerUid, max = 100) {
  if (!consumerUid) return [];

  try {
    const snap = await getDocs(
      query(
        collection(db, 'consumer_saved_products'),
        where('consumerUid', '==', consumerUid),
        orderBy('savedAt', 'desc'),
        limit(max)
      )
    );
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  } catch (err) {
    try {
      const snap = await getDocs(
        query(
          collection(db, 'consumer_saved_products'),
          where('consumerUid', '==', consumerUid),
          limit(max)
        )
      );
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      list.sort((a, b) => {
        const at = a.savedAt?.toDate?.()?.getTime?.() || 0;
        const bt = b.savedAt?.toDate?.()?.getTime?.() || 0;
        return bt - at;
      });
      return list;
    } catch (err2) {
      console.warn('fetchSavedProducts failed:', err2.code);
      return [];
    }
  }
}

export async function isProductSaved(consumerUid, unitId) {
  if (!consumerUid || !unitId) return null;
  const snap = await getDocs(
    query(
      collection(db, 'consumer_saved_products'),
      where('consumerUid', '==', consumerUid),
      where('unitId', '==', unitId),
      limit(1)
    )
  );
  if (snap.empty) return null;
  return { id: snap.docs[0].id, ...snap.docs[0].data() };
}

// ============================================================
// ALERTS
// ============================================================
export async function fetchConsumerAlerts(consumerUid, max = 50) {
  if (!consumerUid) return [];

  try {
    const snap = await getDocs(
      query(
        collection(db, 'consumer_alerts'),
        where('consumerUid', '==', consumerUid),
        orderBy('createdAt', 'desc'),
        limit(max)
      )
    );
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  } catch (err) {
    try {
      const snap = await getDocs(
        query(
          collection(db, 'consumer_alerts'),
          where('consumerUid', '==', consumerUid),
          limit(max)
        )
      );
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      list.sort((a, b) => {
        const at = a.createdAt?.toDate?.()?.getTime?.() || 0;
        const bt = b.createdAt?.toDate?.()?.getTime?.() || 0;
        return bt - at;
      });
      return list;
    } catch (err2) {
      return [];
    }
  }
}

export async function markAlertRead(alertDocId) {
  await updateDoc(doc(db, 'consumer_alerts', alertDocId), {
    read: true,
    readAt: serverTimestamp(),
  });
}

// ============================================================
// DASHBOARD STATS
// ============================================================
export async function fetchConsumerStats(consumerUid) {
  const [scans, saved, alerts] = await Promise.all([
    fetchConsumerScans(consumerUid, 1000),
    fetchSavedProducts(consumerUid, 1000),
    fetchConsumerAlerts(consumerUid, 1000),
  ]);

  const unreadAlerts = alerts.filter((a) => !a.read).length;
  const flaggedScans = scans.filter(
    (s) => s.result === 'SUSPICIOUS' || s.result === 'INVALID'
  ).length;
  const authenticScans = scans.filter((s) => s.result === 'AUTHENTIC').length;
  const expectedScans = scans.filter((s) => s.result === 'EXPECTED').length;

  const byResult = scans.reduce((acc, s) => {
    const k = s.result || 'UNKNOWN';
    acc[k] = (acc[k] || 0) + 1;
    return acc;
  }, {});

  const byConfidence = { high: 0, medium: 0, low: 0, unknown: 0 };
  for (const s of scans) {
    if (typeof s.confidence !== 'number') byConfidence.unknown++;
    else if (s.confidence >= 80) byConfidence.high++;
    else if (s.confidence >= 50) byConfidence.medium++;
    else byConfidence.low++;
  }

  const cities = new Set(scans.map((s) => s.locationCity).filter(Boolean));

  const lastScanAt = scans.length
    ? scans.reduce((latest, s) => {
        const t = s.scannedAt?.toDate?.()?.getTime?.() || 0;
        return t > latest ? t : latest;
      }, 0)
    : null;

  return {
    totalScans: scans.length,
    authenticScans,
    flaggedScans,
    expectedScans,
    savedProducts: saved.length,
    unreadAlerts,
    totalAlerts: alerts.length,
    byResult,
    byConfidence,
    distinctCities: cities.size,
    lastScanAt: lastScanAt ? new Date(lastScanAt) : null,
  };
}