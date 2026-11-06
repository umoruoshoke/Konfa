// src/admin/adminAuth.js
// ============================================================
// Admin-side Firestore helpers.
//
// IMPORTANT — this file checks BOTH admin collections:
//   - `admins`       (newer docs, e.g. ADM001)
//   - `admin_users`  (legacy docs from the original app)
//
// The lookup strategy for each collection is the same:
//   1. getDoc(<collection>/{uid})                 — fast path
//   2. query where firebaseUid == uid             — indexed match
//   3. query where email == user.email            — indexed match
//   4. full-scan + client-side filter             — safety net
//
// Whichever collection and layout matches is used. Every step is
// logged with the [adminLookup] tag so future debugging is easy.
// ============================================================

import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from 'firebase/auth';
import {
  collection,
  query,
  where,
  getDocs,
  getDoc,
  doc,
  addDoc,
  updateDoc,
  serverTimestamp,
  orderBy,
  limit,
} from 'firebase/firestore';
import { auth, db } from '../firebase';

// ============================================================
// ADMIN LOOKUP — tries both `admins` and `admin_users`
// ============================================================

async function tryFindInCollection(collectionName, uid, email) {
  const ref = collection(db, collectionName);

  // ---------- Attempt 1: getDoc by UID as doc ID ----------
  try {
    const snap = await getDoc(doc(db, collectionName, uid));
    if (snap.exists()) {
      console.log(`[adminLookup] ✅ ${collectionName}/${uid} exists (by doc ID)`);
      return { id: snap.id, ...snap.data(), _collection: collectionName };
    }
  } catch (err) {
    console.log(`[adminLookup] ✗ ${collectionName} doc-ID lookup failed:`, err.code);
  }

  // ---------- Attempt 2: query where firebaseUid == uid ----------
  try {
    const snap = await getDocs(
      query(ref, where('firebaseUid', '==', uid), limit(1))
    );
    if (!snap.empty) {
      const d = snap.docs[0];
      console.log(`[adminLookup] ✅ ${collectionName}/${d.id} matched by firebaseUid field`);
      return { id: d.id, ...d.data(), _collection: collectionName };
    }
  } catch (err) {
    console.log(`[adminLookup] ✗ ${collectionName} firebaseUid query failed:`, err.code);
  }

  // ---------- Attempt 3: query where email == email ----------
  if (email) {
    try {
      const snap = await getDocs(
        query(ref, where('email', '==', email.toLowerCase()), limit(1))
      );
      if (!snap.empty) {
        const d = snap.docs[0];
        console.log(`[adminLookup] ✅ ${collectionName}/${d.id} matched by email field`);
        return { id: d.id, ...d.data(), _collection: collectionName };
      }
    } catch (err) {
      console.log(`[adminLookup] ✗ ${collectionName} email query failed:`, err.code);
    }
  }

  // ---------- Attempt 4: full scan + client-side filter ----------
  try {
    const snap = await getDocs(ref);
    console.log(`[adminLookup] ${collectionName} full scan: ${snap.size} docs`);

    for (const d of snap.docs) {
      const data = d.data() || {};
      const candUids = [data.firebaseUid, data.uid, data.authUid]
        .filter(Boolean)
        .map((v) => String(v).trim());
      const candEmail = String(data.email || '').trim().toLowerCase();

      if (candUids.includes(uid) || (email && candEmail === email.toLowerCase())) {
        console.log(`[adminLookup] ✅ ${collectionName}/${d.id} matched by full-scan filter`);
        return { id: d.id, ...data, _collection: collectionName };
      }
    }
  } catch (err) {
    console.log(`[adminLookup] ✗ ${collectionName} full scan failed:`, err.code);
  }

  return null;
}

async function findAdminForUser(user) {
  if (!user) return null;

  const uid = user.uid;
  const email = user.email;

  console.log('[adminLookup] START — uid:', uid, '| email:', email);

  // Try the newer `admins` collection first
  let admin = await tryFindInCollection('admins', uid, email);
  if (admin) return admin;

  // Fall back to the legacy `admin_users` collection
  admin = await tryFindInCollection('admin_users', uid, email);
  if (admin) return admin;

  console.log('[adminLookup] END — no admin doc found in either collection');
  return null;
}

// ============================================================
// AUTH
// ============================================================

export class AdminLoginError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

export const loginAdmin = async (email, password) => {
  const cred = await signInWithEmailAndPassword(auth, email, password);
  const user = cred.user;

  const admin = await findAdminForUser(user);

  if (!admin) {
    await signOut(auth);
    throw new AdminLoginError(
      'admin/not-admin',
      'This account is not an administrator.'
    );
  }

  // Accept 'active' and 'invited' — matches the old behavior.
  if (admin.status !== 'active' && admin.status !== 'invited') {
    await signOut(auth);
    throw new AdminLoginError(
      'admin/inactive',
      'This admin account is not active.'
    );
  }

  // Best-effort: stamp lastLoginAt and (if missing) the firebaseUid.
  try {
    const updates = { lastLoginAt: serverTimestamp() };
    if (!admin.firebaseUid) updates.firebaseUid = user.uid;
    await updateDoc(doc(db, admin._collection, admin.id), updates);
  } catch (_) {
    /* non-fatal */
  }

  return { user, admin };
};

export const logoutAdmin = async () => {
  try {
    await signOut(auth);
  } catch (err) {
    console.warn('signOut error (ignored):', err);
  }

  // Clear stale Firebase keys so a non-admin session can't bleed
  // into the admin portal.
  try {
    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith('firebase:authUser:')) keysToRemove.push(k);
    }
    keysToRemove.forEach((k) => localStorage.removeItem(k));
    sessionStorage.clear();
  } catch (err) {
    console.warn('Storage cleanup error (ignored):', err);
  }
};

export const watchAdminAuth = (callback) => onAuthStateChanged(auth, callback);

export async function getCurrentAdminProfile() {
  const user = auth.currentUser;
  if (!user) return null;

  const admin = await findAdminForUser(user);
  if (!admin) return null;

  if (admin.status === 'active' || admin.status === 'invited') return admin;
  return null;
}

// ============================================================
// HELPERS
// ============================================================

function normalizeManufacturerApp(docSnap) {
  const data = docSnap.data ? docSnap.data() : docSnap;
  const id = docSnap.id || data.id;

  return {
    ...data,
    id,
    status: String(data.status || 'pending').toLowerCase(),
    companyName:
      data.companyName ||
      data.businessInfo?.companyName ||
      '(unnamed)',
    contactEmail: data.contactEmail || data.email || '',
    submittedAt: data.submittedAt || data.createdAt || null,
  };
}

function sortBySubmittedDesc(list) {
  return [...list].sort((a, b) => {
    const at =
      a.submittedAt?.toDate?.()?.getTime?.() ||
      new Date(a.submittedAt || 0).getTime() ||
      0;
    const bt =
      b.submittedAt?.toDate?.()?.getTime?.() ||
      new Date(b.submittedAt || 0).getTime() ||
      0;
    return bt - at;
  });
}

// ============================================================
// DASHBOARD STATS
// ============================================================

export async function fetchDashboardStats() {
  const [
    pendingSellerApps,
    pendingManufacturerApps,
    activeSellers,
    activeManufacturers,
    totalUnits,
    flaggedUnits,
    totalScans,
  ] = await Promise.all([
    countSafe('seller_applications', [where('status', '==', 'pending')]),
    countManufacturerPendingSafe(),
    countSafe('sellers', [where('status', '==', 'active')]),
    countSafe('manufacturers', [where('status', '==', 'active')]),
    countSafe('units'),
    countSafe('units', [where('status', '==', 'FLAGGED')]),
    countSafe('scan_events'),
  ]);

  return {
    pendingApplications: pendingSellerApps,
    pendingManufacturerApplications: pendingManufacturerApps,
    activeSellers,
    activeManufacturers,
    totalUnits,
    flaggedUnits,
    totalScans,
  };
}

async function countSafe(name, constraints = []) {
  try {
    const ref = collection(db, name);
    const q = constraints.length ? query(ref, ...constraints) : ref;
    const snap = await getDocs(q);
    return snap.size;
  } catch (e) {
    console.warn(`countSafe(${name}) failed:`, e.code, e.message);
    return 0;
  }
}

async function countManufacturerPendingSafe() {
  try {
    const ref = collection(db, 'manufacturer_applications');
    const snap = await getDocs(query(ref, where('status', '==', 'pending')));
    if (snap.size > 0) return snap.size;

    const allSnap = await getDocs(ref);
    let count = 0;
    allSnap.forEach((d) => {
      const s = String(d.data()?.status || 'pending').toLowerCase();
      if (s === 'pending') count += 1;
    });
    return count;
  } catch (e) {
    console.warn('countManufacturerPendingSafe failed:', e.code, e.message);
    return 0;
  }
}

// ============================================================
// SELLER APPLICATIONS
// ============================================================

export async function fetchSellerApplications({ status = 'pending', max = 100 } = {}) {
  const ref = collection(db, 'seller_applications');
  const q = status
    ? query(ref, where('status', '==', status), limit(max))
    : query(ref, limit(max));
  const snap = await getDocs(q);
  const apps = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  return sortBySubmittedDesc(apps);
}

export const fetchAllSellerApplications = () =>
  fetchSellerApplications({ status: null });

export const fetchPendingSellerApplications = () =>
  fetchSellerApplications({ status: 'pending' });

export async function fetchApplicationById(applicationId) {
  const snap = await getDoc(doc(db, 'seller_applications', applicationId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() };
}

export const fetchSellerApplicationById = fetchApplicationById;

export async function approveSellerApplication({ applicationId, adminId, adminName }) {
  const app = await fetchApplicationById(applicationId);
  if (!app) throw new Error('Application not found.');

  const newSellerRef = await addDoc(collection(db, 'sellers'), {
    companyName: app.companyName,
    email: app.email,
    phoneNumber: app.phoneNumber,
    firebaseUid: app.firebaseUid,
    role: app.requestedRole,
    status: 'active',
    mfaEnabled: false,
    businessType: app.businessInfo?.businessType || null,
    businessRegistrationNumber: app.businessInfo?.registrationNumber || null,
    taxId: app.businessInfo?.taxId || null,
    physicalAddress: app.businessInfo?.physicalAddress || null,
    city: app.businessInfo?.city || null,
    state: app.businessInfo?.state || null,
    website: app.businessInfo?.website || null,
    contactPersonName: app.contactPerson?.fullName || null,
    contactPersonRole: app.contactPerson?.role || null,
    applicationId,
    approvedAt: serverTimestamp(),
    approvedBy: adminId,
    approvedByName: adminName,
    onboardingSource: 'self_signup',
    suspendedAt: null,
    suspensionReason: null,
    createdAt: serverTimestamp(),
  });

  await updateDoc(doc(db, 'seller_applications', applicationId), {
    status: 'approved',
    reviewedAt: serverTimestamp(),
    reviewedBy: adminId,
    reviewedByName: adminName,
    promotedSellerId: newSellerRef.id,
  });

  await addDoc(collection(db, 'admin_audit_log'), {
    action: 'approve_seller',
    targetType: 'seller_application',
    targetId: applicationId,
    actorId: adminId,
    actorName: adminName,
    details: {
      sellerId: newSellerRef.id,
      companyName: app.companyName,
      email: app.email,
    },
    timestamp: serverTimestamp(),
  });

  return { sellerId: newSellerRef.id };
}

export async function rejectSellerApplication({ applicationId, adminId, adminName, reason }) {
  const app = await fetchApplicationById(applicationId);
  if (!app) throw new Error('Application not found.');

  await updateDoc(doc(db, 'seller_applications', applicationId), {
    status: 'rejected',
    reviewedAt: serverTimestamp(),
    reviewedBy: adminId,
    reviewedByName: adminName,
    rejectionReason: reason || 'Not specified',
  });

  await addDoc(collection(db, 'admin_audit_log'), {
    action: 'reject_seller',
    targetType: 'seller_application',
    targetId: applicationId,
    actorId: adminId,
    actorName: adminName,
    details: { companyName: app.companyName, email: app.email, reason },
    timestamp: serverTimestamp(),
  });

  return { success: true };
}

// ============================================================
// SELLERS
// ============================================================

export async function fetchAllSellers({ status = null, max = 200 } = {}) {
  const ref = collection(db, 'sellers');
  const q = status
    ? query(ref, where('status', '==', status), limit(max))
    : query(ref, limit(max));
  const snap = await getDocs(q);
  const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  list.sort((a, b) => {
    const at = a.createdAt?.toDate?.()?.getTime?.() || 0;
    const bt = b.createdAt?.toDate?.()?.getTime?.() || 0;
    return bt - at;
  });
  return list;
}

export const fetchActiveSellers = () => fetchAllSellers({ status: 'active' });

export async function suspendSeller({ sellerId, adminId, adminName, reason }) {
  await updateDoc(doc(db, 'sellers', sellerId), {
    status: 'suspended',
    suspendedAt: serverTimestamp(),
    suspensionReason: reason || 'Not specified',
  });
  await addDoc(collection(db, 'admin_audit_log'), {
    action: 'suspend_seller',
    targetType: 'seller',
    targetId: sellerId,
    actorId: adminId,
    actorName: adminName,
    details: { reason },
    timestamp: serverTimestamp(),
  });
  return { success: true };
}

export async function reactivateSeller({ sellerId, adminId, adminName }) {
  await updateDoc(doc(db, 'sellers', sellerId), {
    status: 'active',
    suspendedAt: null,
    suspensionReason: null,
  });
  await addDoc(collection(db, 'admin_audit_log'), {
    action: 'reactivate_seller',
    targetType: 'seller',
    targetId: sellerId,
    actorId: adminId,
    actorName: adminName,
    details: {},
    timestamp: serverTimestamp(),
  });
  return { success: true };
}

export async function setSellerStatus(sellerId, status, adminUid, reason = null) {
  await updateDoc(doc(db, 'sellers', sellerId), {
    status,
    statusReason: reason,
    statusChangedBy: adminUid,
    statusChangedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  await addDoc(collection(db, 'admin_audit_log'), {
    action: `${status}_seller`,
    targetType: 'seller',
    targetId: sellerId,
    actorId: adminUid,
    reason,
    timestamp: serverTimestamp(),
  });
}

// ============================================================
// MANUFACTURER APPLICATIONS
// ============================================================

export async function fetchManufacturerApplications({ status = 'pending', max = 100 } = {}) {
  const ref = collection(db, 'manufacturer_applications');
  const snap = await getDocs(query(ref, limit(max)));
  const all = snap.docs.map(normalizeManufacturerApp);

  const filtered = status ? all.filter((a) => a.status === status) : all;
  return sortBySubmittedDesc(filtered);
}

export const fetchPendingManufacturerApplications = () =>
  fetchManufacturerApplications({ status: 'pending' });

export async function fetchManufacturerApplicationById(applicationId) {
  const snap = await getDoc(doc(db, 'manufacturer_applications', applicationId));
  if (!snap.exists()) return null;
  return normalizeManufacturerApp(snap);
}

export async function approveManufacturerApplication({ applicationId, adminId, adminName }) {
  const app = await fetchManufacturerApplicationById(applicationId);
  if (!app) throw new Error('Manufacturer application not found.');
  if (app.status === 'approved') throw new Error('Application already approved.');

  const newManufacturerRef = await addDoc(collection(db, 'manufacturers'), {
    companyName: app.companyName,
    contactEmail: app.contactEmail,
    phoneNumber: app.phoneNumber,
    website: app.website || null,
    physicalAddress: app.address?.physicalAddress || null,
    city: app.address?.city || null,
    state: app.address?.state || null,
    country: app.address?.country || null,
    businessType: app.businessInfo?.businessType || null,
    registrationNumber: app.businessInfo?.registrationNumber || null,
    taxId: app.businessInfo?.taxId || null,
    contactPersonName: app.contactPerson?.fullName || null,
    contactPersonRole: app.contactPerson?.role || null,
    firebaseUid: app.firebaseUid || null,
    registrationStatus: 'approved',
    status: 'active',
    verified: true,
    applicationId,
    approvedAt: serverTimestamp(),
    approvedBy: adminId,
    approvedByName: adminName,
    onboardingSource: 'self_signup',
    metadata: { staffCount: 1, batchCount: 0, unitCount: 0 },
    settings: {
      allowStaffInvites: true,
      notificationsEmail: app.contactEmail,
    },
    suspendedAt: null,
    suspensionReason: null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  const manufacturerId = newManufacturerRef.id;

  if (app.firebaseUid) {
    await addDoc(collection(db, 'manufacturer_staff'), {
      firebaseUid: app.firebaseUid,
      manufacturerId,
      email: (app.contactEmail || '').toLowerCase(),
      name: app.contactPerson?.fullName || app.companyName || '',
      phone: app.phoneNumber || '',
      role: 'OWNER',
      permissions: ['*'],
      status: 'active',
      invitedBy: adminId,
      invitedAt: serverTimestamp(),
      acceptedAt: serverTimestamp(),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      lastLoginAt: null,
      qrDownloadGrantedBy: adminId,
      qrDownloadGrantedAt: serverTimestamp(),
      qrDownloadCount: 0,
      qrLastDownloadAt: null,
    });
  }

  await updateDoc(doc(db, 'manufacturer_applications', applicationId), {
    status: 'approved',
    reviewedAt: serverTimestamp(),
    reviewedBy: adminId,
    reviewedByName: adminName,
    promotedManufacturerId: manufacturerId,
  });

  await addDoc(collection(db, 'admin_audit_log'), {
    action: 'approve_manufacturer',
    targetType: 'manufacturer_application',
    targetId: applicationId,
    actorId: adminId,
    actorName: adminName,
    details: {
      manufacturerId,
      companyName: app.companyName,
      email: app.contactEmail,
    },
    timestamp: serverTimestamp(),
  });

  return { manufacturerId };
}

export async function rejectManufacturerApplication({ applicationId, adminId, adminName, reason }) {
  const app = await fetchManufacturerApplicationById(applicationId);
  if (!app) throw new Error('Manufacturer application not found.');

  await updateDoc(doc(db, 'manufacturer_applications', applicationId), {
    status: 'rejected',
    reviewedAt: serverTimestamp(),
    reviewedBy: adminId,
    reviewedByName: adminName,
    rejectionReason: reason || 'Not specified',
  });

  await addDoc(collection(db, 'admin_audit_log'), {
    action: 'reject_manufacturer',
    targetType: 'manufacturer_application',
    targetId: applicationId,
    actorId: adminId,
    actorName: adminName,
    details: {
      companyName: app.companyName,
      email: app.contactEmail,
      reason: reason || 'Not specified',
    },
    timestamp: serverTimestamp(),
  });

  return { success: true };
}

// ============================================================
// MANUFACTURERS
// ============================================================

export async function fetchAllManufacturers({ status = null, max = 500 } = {}) {
  const ref = collection(db, 'manufacturers');
  const q = status
    ? query(ref, where('status', '==', status), limit(max))
    : query(ref, limit(max));
  const snap = await getDocs(q);
  const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  list.sort((a, b) => {
    const at = a.createdAt?.toDate?.()?.getTime?.() || 0;
    const bt = b.createdAt?.toDate?.()?.getTime?.() || 0;
    return bt - at;
  });
  return list;
}

export const fetchActiveManufacturers = () => fetchAllManufacturers({ status: 'active' });

export async function suspendManufacturer({ manufacturerId, adminId, adminName, reason }) {
  await updateDoc(doc(db, 'manufacturers', manufacturerId), {
    status: 'suspended',
    suspendedAt: serverTimestamp(),
    suspensionReason: reason || 'Not specified',
    updatedAt: serverTimestamp(),
  });
  await addDoc(collection(db, 'admin_audit_log'), {
    action: 'suspend_manufacturer',
    targetType: 'manufacturer',
    targetId: manufacturerId,
    actorId: adminId,
    actorName: adminName,
    details: { reason },
    timestamp: serverTimestamp(),
  });
  return { success: true };
}

export async function reactivateManufacturer({ manufacturerId, adminId, adminName }) {
  await updateDoc(doc(db, 'manufacturers', manufacturerId), {
    status: 'active',
    suspendedAt: null,
    suspensionReason: null,
    updatedAt: serverTimestamp(),
  });
  await addDoc(collection(db, 'admin_audit_log'), {
    action: 'reactivate_manufacturer',
    targetType: 'manufacturer',
    targetId: manufacturerId,
    actorId: adminId,
    actorName: adminName,
    details: {},
    timestamp: serverTimestamp(),
  });
  return { success: true };
}

export async function setManufacturerStatus(manufacturerId, status, adminUid, reason = null) {
  await updateDoc(doc(db, 'manufacturers', manufacturerId), {
    status,
    statusReason: reason,
    statusChangedBy: adminUid,
    statusChangedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  await addDoc(collection(db, 'admin_audit_log'), {
    action: `${status}_manufacturer`,
    targetType: 'manufacturer',
    targetId: manufacturerId,
    actorId: adminUid,
    reason,
    timestamp: serverTimestamp(),
  });
}

// ============================================================
// 🆕 SINGLE-RECORD LOOKUPS (for detail pages)
// ============================================================

/**
 * Fetch a single manufacturer by its document ID.
 * Returns the full document, or throws if not found.
 */
export async function fetchManufacturerById(manufacturerId) {
  if (!manufacturerId) throw new Error('Missing manufacturer ID.');
  const snap = await getDoc(doc(db, 'manufacturers', manufacturerId));
  if (!snap.exists()) throw new Error('Manufacturer not found.');
  return { id: snap.id, ...snap.data() };
}

/**
 * Fetch the original manufacturer_application that produced this
 * manufacturer record. Best-effort: returns null if nothing matches.
 *
 * Matching order:
 *   1. by `applicationId` field on the manufacturer doc
 *   2. by `firebaseUid` field on the application
 *   3. by email on the application
 */
export async function fetchManufacturerApplicationForManufacturer(manufacturer) {
  if (!manufacturer) return null;

  // 1. Direct doc lookup
  if (manufacturer.applicationId) {
    try {
      const snap = await getDoc(
        doc(db, 'manufacturer_applications', manufacturer.applicationId)
      );
      if (snap.exists()) {
        return normalizeManufacturerApp(snap);
      }
    } catch (err) {
      console.warn('Could not load application by applicationId:', err.code);
    }
  }

  // 2. Query by firebaseUid
  if (manufacturer.firebaseUid) {
    try {
      const snap = await getDocs(
        query(
          collection(db, 'manufacturer_applications'),
          where('firebaseUid', '==', manufacturer.firebaseUid),
          limit(1)
        )
      );
      if (!snap.empty) {
        return normalizeManufacturerApp(snap.docs[0]);
      }
    } catch (err) {
      console.warn('Could not load application by firebaseUid:', err.code);
    }
  }

  // 3. Query by email
  const email = manufacturer.contactEmail || manufacturer.email;
  if (email) {
    try {
      const snap = await getDocs(
        query(
          collection(db, 'manufacturer_applications'),
          where('email', '==', String(email).toLowerCase()),
          limit(1)
        )
      );
      if (!snap.empty) {
        return normalizeManufacturerApp(snap.docs[0]);
      }
    } catch (err) {
      console.warn('Could not load application by email:', err.code);
    }
  }

  return null;
}

/**
 * Fetch a single seller by its document ID.
 * Returns the full document, or throws if not found.
 */
export async function fetchSellerById(sellerId) {
  if (!sellerId) throw new Error('Missing seller ID.');
  const snap = await getDoc(doc(db, 'sellers', sellerId));
  if (!snap.exists()) throw new Error('Seller not found.');
  return { id: snap.id, ...snap.data() };
}

/**
 * Fetch the original seller_application that produced this seller.
 * Best-effort: returns null if nothing matches.
 *
 * Matching order:
 *   1. by `applicationId` field on the seller doc
 *   2. by `firebaseUid` on the application
 *   3. by email on the application
 */
export async function fetchSellerApplicationForSeller(seller) {
  if (!seller) return null;

  if (seller.applicationId) {
    try {
      const snap = await getDoc(
        doc(db, 'seller_applications', seller.applicationId)
      );
      if (snap.exists()) {
        return { id: snap.id, ...snap.data() };
      }
    } catch (err) {
      console.warn('Could not load seller application by applicationId:', err.code);
    }
  }

  if (seller.firebaseUid) {
    try {
      const snap = await getDocs(
        query(
          collection(db, 'seller_applications'),
          where('firebaseUid', '==', seller.firebaseUid),
          limit(1)
        )
      );
      if (!snap.empty) {
        return { id: snap.docs[0].id, ...snap.docs[0].data() };
      }
    } catch (err) {
      console.warn('Could not load seller application by firebaseUid:', err.code);
    }
  }

  const email = seller.email;
  if (email) {
    try {
      const snap = await getDocs(
        query(
          collection(db, 'seller_applications'),
          where('email', '==', String(email).toLowerCase()),
          limit(1)
        )
      );
      if (!snap.empty) {
        return { id: snap.docs[0].id, ...snap.docs[0].data() };
      }
    } catch (err) {
      console.warn('Could not load seller application by email:', err.code);
    }
  }

  return null;
}

// ============================================================
// ADMIN USERS
// ============================================================

export async function fetchAllAdmins() {
  // Prefer the new collection; fall back to legacy.
  try {
    const snap = await getDocs(collection(db, 'admins'));
    if (snap.size > 0) return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  } catch (_) {}
  const snap = await getDocs(collection(db, 'admin_users'));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function inviteAdmin({ email, fullName, role, permissions, createdByAdminId, createdByAdminName }) {
  const ref = await addDoc(collection(db, 'admin_users'), {
    email: email.toLowerCase(),
    fullName,
    role,
    permissions,
    firebaseUid: null,
    createdAt: serverTimestamp(),
    createdBy: createdByAdminId,
    status: 'invited',
  });
  await addDoc(collection(db, 'admin_audit_log'), {
    action: 'invite_admin',
    targetType: 'admin',
    targetId: ref.id,
    actorId: createdByAdminId,
    actorName: createdByAdminName,
    details: { email, role },
    timestamp: serverTimestamp(),
  });
  return { adminId: ref.id };
}

export async function updateAdminPermissions({ adminId, permissions, actorId, actorName }) {
  // Try `admins` first, then `admin_users` if it 404s.
  try {
    await updateDoc(doc(db, 'admins', adminId), { permissions });
  } catch (_) {
    await updateDoc(doc(db, 'admin_users', adminId), { permissions });
  }
  await addDoc(collection(db, 'admin_audit_log'), {
    action: 'update_admin_permissions',
    targetType: 'admin',
    targetId: adminId,
    actorId,
    actorName,
    details: { permissions },
    timestamp: serverTimestamp(),
  });
}

export async function deactivateAdmin({ adminId, actorId, actorName }) {
  try {
    await updateDoc(doc(db, 'admins', adminId), { status: 'disabled' });
  } catch (_) {
    await updateDoc(doc(db, 'admin_users', adminId), { status: 'disabled' });
  }
  await addDoc(collection(db, 'admin_audit_log'), {
    action: 'deactivate_admin',
    targetType: 'admin',
    targetId: adminId,
    actorId,
    actorName,
    details: {},
    timestamp: serverTimestamp(),
  });
}

export async function setAdminStatus(adminId, status, actorId = null, actorName = null) {
  const patch = {
    status,
    statusChangedAt: serverTimestamp(),
    ...(actorId ? { statusChangedBy: actorId } : {}),
  };
  try {
    await updateDoc(doc(db, 'admins', adminId), patch);
  } catch (_) {
    await updateDoc(doc(db, 'admin_users', adminId), patch);
  }
  if (actorId) {
    await addDoc(collection(db, 'admin_audit_log'), {
      action: status === 'active' ? 'reactivate_admin' : `${status}_admin`,
      targetType: 'admin',
      targetId: adminId,
      actorId,
      actorName: actorName || 'Admin',
      details: { status },
      timestamp: serverTimestamp(),
    });
  }
}

// ============================================================
// AUDIT LOG
// ============================================================

export async function fetchAuditLog({ max = 100 } = {}) {
  try {
    const snap = await getDocs(
      query(collection(db, 'admin_audit_log'), orderBy('timestamp', 'desc'), limit(max))
    );
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  } catch (e) {
    console.warn('fetchAuditLog failed:', e.code, e.message);
    return [];
  }
}

// ============================================================
// ANALYTICS — Scan events (used by AdminScanAnalytics)
// ============================================================

export async function fetchScanEventsWindow(days = 30) {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
  const ref = collection(db, 'scan_events');
  let snap;
  try {
    snap = await getDocs(
      query(ref, where('timestamp', '>=', since), orderBy('timestamp', 'desc'))
    );
  } catch {
    snap = await getDocs(query(ref, limit(2000)));
  }
  const events = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  return events.filter((e) => !e.timestamp || e.timestamp >= since);
}

export async function fetchAllUnits() {
  const snap = await getDocs(collection(db, 'units'));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function fetchAllBatches() {
  const snap = await getDocs(collection(db, 'batches'));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function fetchAllShipments() {
  const snap = await getDocs(collection(db, 'shipments'));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function fetchConsumerReportsWindow(days = 30) {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
  const ref = collection(db, 'consumer_reports');
  try {
    const snap = await getDocs(query(ref, where('createdAt', '>=', since)));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  } catch {
    const snap = await getDocs(ref);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  }
}