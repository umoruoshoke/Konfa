// src/seller/sellerAuth.js
import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  updatePassword,
  EmailAuthProvider,
  reauthenticateWithCredential,
} from 'firebase/auth';
import {
  collection,
  query,
  where,
  getDocs,
  getDoc,
  doc,
  addDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  limit,
  documentId,
  writeBatch,
} from 'firebase/firestore';
import { auth, db } from '../firebase';

// ============================================================
// Normalizers — must match verifyLookupApi.js
// ============================================================
const lower = (s = '') => s.toString().trim().toLowerCase();
const digitsOnly = (s = '') =>
  s.toString().replace(/\D/g, '').replace(/^0+/, '');

const tokensOf = (normalizedName = '') =>
  Array.from(
    new Set(
      normalizedName
        .split(/\s+/)
        .map((t) => t.trim())
        .filter((t) => t.length >= 2),
    ),
  );

function slugify(name = '') {
  return name
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 40);
}

// ============================================================
// AUTH — LOGIN
// ============================================================

export class SellerLoginError extends Error {
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
  'auth/requires-recent-login':
    'For security, please sign in again before making this change.',
  'auth/missing-email': 'Please enter your email address.',
};

function friendlySellerAuthError(err) {
  return (
    AUTH_ERROR_MAP[err?.code] ||
    err?.message ||
    'Something went wrong. Please try again.'
  );
}

export const loginSeller = async (email, password) => {
  let cred;
  try {
    cred = await signInWithEmailAndPassword(auth, email, password);
  } catch (err) {
    throw err;
  }

  const user = cred.user;

  const sellersRef = collection(db, 'sellers');
  let sellerSnap = await getDocs(
    query(sellersRef, where('firebaseUid', '==', user.uid), limit(1)),
  );
  if (sellerSnap.empty && user.email) {
    sellerSnap = await getDocs(
      query(sellersRef, where('email', '==', user.email), limit(1)),
    );
  }

  if (sellerSnap.empty) {
    const appsRef = collection(db, 'seller_applications');
    let appSnap = await getDocs(
      query(appsRef, where('firebaseUid', '==', user.uid), limit(1)),
    );
    if (appSnap.empty && user.email) {
      appSnap = await getDocs(
        query(appsRef, where('email', '==', user.email), limit(1)),
      );
    }

    await signOut(auth);

    if (!appSnap.empty) {
      const app = appSnap.docs[0].data();
      if (app.status === 'pending') {
        throw new SellerLoginError(
          'seller/pending',
          'Your seller application is still being reviewed. You will be notified by email once approved.',
        );
      }
      if (app.status === 'rejected') {
        throw new SellerLoginError(
          'seller/rejected',
          `Your application was not approved. Reason: ${app.rejectionReason || 'Not provided'}`,
        );
      }
    }

    throw new SellerLoginError(
      'seller/no-profile',
      'Your account is not linked to a seller profile. Please contact support.',
    );
  }

  const seller = { id: sellerSnap.docs[0].id, ...sellerSnap.docs[0].data() };

  if (seller.status !== 'active') {
    await signOut(auth);
    if (seller.status === 'pending') {
      throw new SellerLoginError(
        'seller/pending',
        'Your seller application is still being reviewed. You will be notified by email once approved.',
      );
    }
    if (seller.status === 'suspended') {
      throw new SellerLoginError(
        'seller/suspended',
        `Your seller account is suspended. ${seller.suspensionReason || ''}`.trim(),
      );
    }
    throw new SellerLoginError(
      'seller/inactive',
      'Your seller account is not active. Please contact support.',
    );
  }

  return user;
};

export const logoutSeller = async () => {
  await signOut(auth);
};

export const watchSellerAuth = (callback) => onAuthStateChanged(auth, callback);

// ============================================================
// PASSWORD RESET
// ============================================================
export async function resetSellerPassword(email) {
  const cleanEmail = String(email || '').trim().toLowerCase();
  if (!cleanEmail) {
    throw new SellerLoginError(
      'seller/missing-email',
      'Please enter the email address you signed up with.',
    );
  }

  try {
    await sendPasswordResetEmail(auth, cleanEmail);
  } catch (err) {
    throw new SellerLoginError(err.code, friendlySellerAuthError(err));
  }
}

// ============================================================
// CHANGE PASSWORD
// ============================================================
export async function changeSellerPassword(currentPassword, newPassword) {
  const user = auth.currentUser;
  if (!user) {
    throw new SellerLoginError(
      'seller/not-signed-in',
      'You are not signed in.',
    );
  }
  if (!user.email) {
    throw new SellerLoginError(
      'seller/no-email',
      'No email is associated with this account.',
    );
  }
  if (!newPassword || newPassword.length < 6) {
    throw new SellerLoginError(
      'seller/weak-password',
      'New password must be at least 6 characters.',
    );
  }

  try {
    const credential = EmailAuthProvider.credential(
      user.email,
      currentPassword,
    );
    await reauthenticateWithCredential(user, credential);
    await updatePassword(user, newPassword);
  } catch (err) {
    throw new SellerLoginError(err.code, friendlySellerAuthError(err));
  }

  return { success: true };
}

// ============================================================
// SIGNUP
// ============================================================
export async function signUpSeller({
  companyName,
  email,
  phoneNumber,
  password,
  role,
  businessType,
  registrationNumber,
  taxId,
  physicalAddress,
  city,
  state,
  contactPersonName,
  contactPersonRole,
  website,
  notes,
}) {
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  const user = cred.user;

  const businessNameLower = lower(companyName);
  const phoneDigits = digitsOnly(phoneNumber);
  const nameTokens = tokensOf(businessNameLower);

  const docRef = await addDoc(collection(db, 'seller_applications'), {
    companyName,

    businessNameLower,
    displayNameLower: businessNameLower,
    nameTokens,
    displayNameTokens: nameTokens,
    phoneDigits,

    email: email.toLowerCase(),
    phoneNumber,
    firebaseUid: user.uid,
    requestedRole: role,
    businessInfo: {
      businessType,
      registrationNumber,
      taxId,
      physicalAddress,
      city,
      state,
      website: website || null,
    },
    contactPerson: {
      fullName: contactPersonName,
      role: contactPersonRole,
    },
    notes: notes || null,
    status: 'pending',
    submittedAt: serverTimestamp(),
    reviewedAt: null,
    reviewedBy: null,
    reviewedByName: null,
    rejectionReason: null,
    promotedSellerId: null,
  });

  await signOut(auth);

  return { uid: user.uid, applicationId: docRef.id };
}

// ============================================================
// LOOK UP CURRENT SELLER PROFILE
// ============================================================
export async function getCurrentSellerProfile() {
  const user = auth.currentUser;
  if (!user) return null;

  const sellersRef = collection(db, 'sellers');

  let snap = await getDocs(
    query(sellersRef, where('firebaseUid', '==', user.uid), limit(1)),
  );
  if (!snap.empty) {
    const seller = { id: snap.docs[0].id, ...snap.docs[0].data() };
    return seller.status === 'active' ? seller : null;
  }

  if (user.email) {
    snap = await getDocs(
      query(sellersRef, where('email', '==', user.email), limit(1)),
    );
    if (!snap.empty) {
      const seller = { id: snap.docs[0].id, ...snap.docs[0].data() };
      return seller.status === 'active' ? seller : null;
    }
  }

  return null;
}

export async function fetchSellerByUid(uid) {
  if (!uid) return null;
  const snap = await getDoc(doc(db, 'sellers', uid));
  if (snap.exists()) return { id: snap.id, ...snap.data() };

  const q = await getDocs(
    query(collection(db, 'sellers'), where('firebaseUid', '==', uid), limit(1)),
  );
  if (!q.empty) return { id: q.docs[0].id, ...q.docs[0].data() };

  return null;
}

// ============================================================
// PUBLISH / UNPUBLISH (public search)
// ------------------------------------------------------------
// Only verified + active sellers are published to
// `public_seller_profiles`. Called after an admin approves a
// seller, and by the one-off backfill.
// ============================================================
export async function publishSellerProfile(sellerDocIdOrUid) {
  let sellerSnap = await getDoc(doc(db, 'sellers', sellerDocIdOrUid));
  let sellerDocId = sellerDocIdOrUid;

  if (!sellerSnap.exists()) {
    const q = query(
      collection(db, 'sellers'),
      where('firebaseUid', '==', sellerDocIdOrUid),
      limit(1),
    );
    const res = await getDocs(q);
    if (res.empty) return null;
    sellerDocId = res.docs[0].id;
    sellerSnap = res.docs[0];
  }

  const s = sellerSnap.data();
  if (!s.firebaseUid || s.status !== 'active') {
    await unpublishSellerProfile(sellerDocId);
    return null;
  }

  // Read verification.
  let verified = false;
  try {
    const vSnap = await getDoc(doc(db, 'seller_verifications', s.firebaseUid));
    if (vSnap.exists()) {
      const v = vSnap.data();
      const ownerOk = v.owner && v.owner.status === 'verified';
      const bizOk = v.business && v.business.status === 'verified';
      verified = ownerOk || bizOk;
    }
  } catch {
    /* non-fatal */
  }

  if (!verified) {
    await unpublishSellerProfile(sellerDocId);
    return null;
  }

  const displayName = s.companyName || 'Seller';
  const baseSlug = slugify(displayName) || 'seller';
  const slug = s.publicSlug || `${baseSlug}-${sellerDocId.slice(-4)}`;

  const tokens = tokensOf(lower(displayName));
  const digits = digitsOnly(displayName);
  const phoneDigits = digitsOnly(s.phoneNumber || '');

  await setDoc(
    doc(db, 'public_seller_profiles', slug),
    {
      slug,
      ownerUid: s.firebaseUid,
      ownerName: s.contactPersonName || '',
      displayName,
      category: s.businessType || '',
      description: '',
      enabled: true,
      businessVerified: true,
      ownerVerified: true,
      showBusiness: true,
      showOwnerName: true,
      business: {
        businessName: displayName,
        type: s.businessType || 'unregistered',
        ownerName: s.contactPersonName || '',
        cacNumber: s.businessRegistrationNumber || null,
        address: {
          physical: s.physicalAddress || '',
          city: s.city || '',
          state: s.state || '',
        },
        contact: {
          email: s.email || '',
          phone: s.phoneNumber || '',
          website: s.website || null,
        },
      },
      tokens,
      digits,
      phoneDigits,
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );

  await updateDoc(doc(db, 'sellers', sellerDocId), {
    publicSlug: slug,
    publicProfileEnabled: true,
  });

  return slug;
}

export async function unpublishSellerProfile(sellerDocIdOrUid) {
  let sellerSnap = await getDoc(doc(db, 'sellers', sellerDocIdOrUid));
  let sellerDocId = sellerDocIdOrUid;

  if (!sellerSnap.exists()) {
    const q = query(
      collection(db, 'sellers'),
      where('firebaseUid', '==', sellerDocIdOrUid),
      limit(1),
    );
    const res = await getDocs(q);
    if (res.empty) return;
    sellerDocId = res.docs[0].id;
    sellerSnap = res.docs[0];
  }

  const s = sellerSnap.data();
  const slug = s.publicSlug;
  if (slug) {
    try {
      await deleteDoc(doc(db, 'public_seller_profiles', slug));
    } catch {
      /* non-fatal */
    }
  }

  await updateDoc(doc(db, 'sellers', sellerDocId), {
    publicProfileEnabled: false,
  });
}

// ============================================================
// PUBLIC — verified sellers for the search page
// ============================================================
export async function fetchVerifiedSellers(maxResults = 200) {
  const snap = await getDocs(
    query(
      collection(db, 'public_seller_profiles'),
      where('enabled', '==', true),
      limit(maxResults),
    ),
  );

  const out = [];
  snap.forEach((d) => {
    const data = d.data();
    const b = data.business || {};
    const addr = (b && b.address) || {};
    out.push({
      kind: 'seller',
      id: d.id,
      slug: data.slug || d.id,
      displayName: data.displayName || b.businessName || '',
      category: data.category || b.type || '',
      description: data.description || '',
      city: addr.city || '',
      state: addr.state || '',
      businessType: b.type || '',
      verified: !!(data.businessVerified || data.ownerVerified),
      verifiedAt: data.updatedAt || null,
      _tokens: data.tokens || tokensOf(lower(data.displayName || '')),
      _digits: data.digits || digitsOnly(data.displayName || ''),
      _phoneDigits: data.phoneDigits || '',
    });
  });
  return out;
}

// ============================================================
// DASHBOARD — QUERIES
// ============================================================
export async function fetchInboundShipments(sellerId) {
  const ref = collection(db, 'shipments');
  const snap = await getDocs(
    query(
      ref,
      where('toSellerId', '==', sellerId),
      where('status', 'in', ['pending', 'in_transit']),
    ),
  );
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function fetchInboundTransfers(sellerId) {
  const ref = collection(db, 'transfers');
  const snap = await getDocs(query(ref, where('toSellerId', '==', sellerId)));
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter((t) => t.status === 'declared' || t.status === 'in_transit');
}

export async function fetchRecentSellerActivity(sellerId, max = 10) {
  const ref = collection(db, 'scan_events');
  const snap = await getDocs(
    query(ref, where('scanningSellerId', '==', sellerId), limit(max)),
  );
  const events = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  events.sort((a, b) => (b.timestamp || '').localeCompare(a.timestamp || ''));
  return events;
}

// ============================================================
// SINGLE UNIT LOOKUPS
// ============================================================
export async function findUnitBySellerBarcode(token) {
  const ref = collection(db, 'units');
  const snap = await getDocs(
    query(ref, where('sellerBarcodeToken', '==', token), limit(1)),
  );
  if (snap.empty) return null;
  return { id: snap.docs[0].id, ...snap.docs[0].data() };
}

const normalizeRefCode = (code) =>
  (code || '').toUpperCase().replace(/[^A-Z0-9]/g, '');

const formatRefCode = (code) => {
  const stripped = normalizeRefCode(code);
  return stripped.length === 8
    ? `${stripped.slice(0, 4)}-${stripped.slice(4)}`
    : stripped;
};

export function parseQrToReferenceCode(text) {
  if (!text) return null;
  const raw = String(text).trim();

  try {
    const url = new URL(raw);
    const fromUrl =
      url.searchParams.get('ref') ||
      url.searchParams.get('code') ||
      url.searchParams.get('c') ||
      url.searchParams.get('refCode');
    if (fromUrl) return formatRefCode(fromUrl);
  } catch {
    /* not a URL */
  }

  return formatRefCode(raw) || null;
}

async function findUnitByAnyCode(rawCode) {
  const unitsRef = collection(db, 'units');
  const stripped = normalizeRefCode(rawCode);
  const dashed = formatRefCode(rawCode);
  const candidates = Array.from(
    new Set([dashed, stripped, rawCode].filter(Boolean)),
  );

  const fields = [
    'consumerReferenceCode',
    'consumerBarcodeToken',
    'referenceCode',
    'refCode',
    'code',
    'sellerBarcodeToken',
    'barcodeToken',
    'token',
  ];

  for (const candidate of candidates) {
    for (const field of fields) {
      try {
        const snap = await getDocs(
          query(unitsRef, where(field, '==', candidate), limit(1)),
        );
        if (!snap.empty) {
          const d = snap.docs[0];
          return { id: d.id, ...d.data(), _matchedField: field };
        }
      } catch {
        /* keep trying */
      }
    }
  }
  return null;
}

// ============================================================
// SHIPMENT LOOKUP
// ============================================================
export async function fetchShipment(shipmentId) {
  const snap = await getDoc(doc(db, 'shipments', shipmentId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() };
}

export async function fetchShipmentUnits(shipment) {
  if (!shipment) return [];

  if (Array.isArray(shipment.unitIds) && shipment.unitIds.length > 0) {
    return await fetchUnitsByIds(shipment.unitIds);
  }

  if (shipment.batchId) {
    try {
      const snap = await getDocs(
        query(
          collection(db, 'units'),
          where('batchId', '==', shipment.batchId),
          limit(shipment.quantity ? shipment.quantity * 2 : 100),
        ),
      );
      const all = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      if (typeof shipment.quantity === 'number' && shipment.quantity > 0) {
        return all.slice(0, shipment.quantity);
      }
      return all;
    } catch (err) {
      console.warn('fetchShipmentUnits batch query failed:', err.code);
      return [];
    }
  }

  return [];
}

export async function fetchUnitsByIds(unitIds) {
  if (!unitIds || unitIds.length === 0) return [];
  const unitsRef = collection(db, 'units');
  const chunks = [];
  for (let i = 0; i < unitIds.length; i += 10) {
    chunks.push(unitIds.slice(i, i + 10));
  }
  const results = [];
  for (const chunk of chunks) {
    try {
      const snap = await getDocs(
        query(unitsRef, where(documentId(), 'in', chunk)),
      );
      snap.docs.forEach((d) => results.push({ id: d.id, ...d.data() }));
    } catch (err) {
      console.warn('fetchUnitsByIds chunk failed:', err.code);
    }
  }
  return results;
}

// ============================================================
// RECEIVE — SINGLE UNIT
// ============================================================
export async function receiveUnitByQr({
  sellerId,
  qrPayload,
  shipmentId = null,
  regionLabel = 'Unknown',
}) {
  if (!sellerId || !qrPayload) {
    return { ok: false, reason: 'error', message: 'Missing parameters.' };
  }

  const refCode = parseQrToReferenceCode(qrPayload);
  if (!refCode) {
    return {
      ok: false,
      reason: 'not_found',
      message: 'This QR code does not contain a valid Konfa reference.',
    };
  }

  const unit = await findUnitByAnyCode(refCode);
  if (!unit) {
    return {
      ok: false,
      reason: 'not_found',
      message: `No product found for "${refCode}".`,
    };
  }

  const evRef = collection(db, 'movement_events');
  const evSnap = await getDocs(query(evRef, where('unitId', '==', unit.id)));
  const events = evSnap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => (b.timestamp || '').localeCompare(a.timestamp || ''));

  const lastEvent = events[0] || null;

  let isInbound = false;

  if (!lastEvent) {
    isInbound = true;
  } else if (lastEvent.actorSellerId === sellerId) {
    isInbound = true;
  } else if (shipmentId) {
    isInbound = true;
  } else if (unit.batchId) {
    const shipRef = collection(db, 'shipments');
    const shipSnap = await getDocs(
      query(
        shipRef,
        where('batchId', '==', unit.batchId),
        where('toSellerId', '==', sellerId),
        where('status', 'in', ['pending', 'in_transit']),
      ),
    );
    isInbound = !shipSnap.empty;
  }

  if (!isInbound) {
    return {
      ok: false,
      reason: 'not_for_this_seller',
      unit,
      message:
        'This product is not part of a shipment addressed to your business. ' +
        'Please contact the sender before accepting it.',
    };
  }

  const alreadyReceived = events.some(
    (e) => e.eventType === 'received' && e.actorSellerId === sellerId,
  );
  if (alreadyReceived) {
    return {
      ok: false,
      reason: 'already_received',
      unit,
      message: 'This unit has already been received by your business.',
    };
  }

  const now = new Date().toISOString();
  const batch = writeBatch(db);

  const unitRef = doc(db, 'units', unit.id);
  batch.update(unitRef, {
    currentSellerId: sellerId,
    currentLocationLabel: regionLabel,
    currentLocationConfidence: 'HIGH',
    lastReceivedAt: now,
  });

  const mvRef = doc(collection(db, 'movement_events'));
  batch.set(mvRef, {
    unitId: unit.id,
    eventType: 'received',
    relatedShipmentId: shipmentId || null,
    relatedTransferId: null,
    actorSellerId: sellerId,
    locationLabel: regionLabel,
    locationConfidence: 'HIGH',
    timestamp: now,
  });

  const scRef = doc(collection(db, 'scan_events'));
  batch.set(scRef, {
    unitId: unit.id,
    scanType: 'seller_scan',
    scanningSellerId: sellerId,
    regionLabel,
    result: 'AUTHENTIC',
    riskScore: 5,
    timestamp: now,
  });

  try {
    await batch.commit();
  } catch (err) {
    console.error('receiveUnitByQr batch failed:', err);
    return {
      ok: false,
      reason: 'error',
      unit,
      message: 'Could not save the receipt. Please try again.',
    };
  }

  return {
    ok: true,
    unit: { ...unit, currentSellerId: sellerId, currentLocationLabel: regionLabel },
    message: `Received unit ${unit.id}.`,
  };
}

// ============================================================
// RECEIVE — BULK
// ============================================================
export async function confirmReceiptBatch({
  sellerId,
  regionLabel,
  unitIds,
  shipmentId = null,
}) {
  if (!sellerId || !Array.isArray(unitIds) || unitIds.length === 0) {
    return { ok: false, count: 0, error: 'No units to confirm.' };
  }

  const MAX_UNITS_PER_BATCH = 150;
  const chunks = [];
  for (let i = 0; i < unitIds.length; i += MAX_UNITS_PER_BATCH) {
    chunks.push(unitIds.slice(i, i + MAX_UNITS_PER_BATCH));
  }

  const now = new Date().toISOString();
  let confirmed = 0;

  for (const chunk of chunks) {
    const batch = writeBatch(db);

    for (const unitId of chunk) {
      const unitRef = doc(db, 'units', unitId);
      batch.update(unitRef, {
        currentSellerId: sellerId,
        currentLocationLabel: regionLabel,
        currentLocationConfidence: 'HIGH',
        lastReceivedAt: now,
      });

      const mvRef = doc(collection(db, 'movement_events'));
      batch.set(mvRef, {
        unitId,
        eventType: 'received',
        relatedShipmentId: shipmentId,
        relatedTransferId: null,
        actorSellerId: sellerId,
        locationLabel: regionLabel,
        locationConfidence: 'HIGH',
        timestamp: now,
      });

      const scRef = doc(collection(db, 'scan_events'));
      batch.set(scRef, {
        unitId,
        scanType: 'seller_scan',
        scanningSellerId: sellerId,
        regionLabel,
        result: 'AUTHENTIC',
        riskScore: 5,
        timestamp: now,
      });
    }

    if (shipmentId && chunk === chunks[chunks.length - 1]) {
      const shipRef = doc(db, 'shipments', shipmentId);
      batch.update(shipRef, {
        status: 'received',
        receivedAt: now,
        receivedBySellerId: sellerId,
        receivedLocationLabel: regionLabel,
      });
    }

    try {
      await batch.commit();
      confirmed += chunk.length;
    } catch (err) {
      console.error('confirmReceiptBatch commit failed:', err);
      return {
        ok: false,
        count: confirmed,
        error:
          confirmed > 0
            ? `Committed ${confirmed} of ${unitIds.length} units before an error occurred.`
            : 'Could not save the receipt. Please try again.',
      };
    }
  }

  return { ok: true, count: confirmed };
}

export async function confirmShipmentReceipt({
  shipmentId,
  sellerId,
  regionLabel,
  unitIds = [],
}) {
  return confirmReceiptBatch({ sellerId, regionLabel, unitIds, shipmentId });
}

export async function confirmRemainingUnits({
  sellerId,
  regionLabel,
  unitIds,
  shipmentId = null,
}) {
  return confirmReceiptBatch({ sellerId, regionLabel, unitIds, shipmentId });
}

// ============================================================
// LOG A HANDOFF SCAN
// ============================================================
export async function logHandoffScan(unitId, sellerId, regionLabel = 'Unknown') {
  const now = new Date().toISOString();
  const batch = writeBatch(db);

  const unitRef = doc(db, 'units', unitId);
  batch.update(unitRef, {
    currentLocationLabel: regionLabel,
    currentLocationConfidence: 'HIGH',
  });

  const mvRef = doc(collection(db, 'movement_events'));
  batch.set(mvRef, {
    unitId,
    eventType: 'seller_scan',
    relatedShipmentId: null,
    relatedTransferId: null,
    actorSellerId: sellerId,
    locationLabel: regionLabel,
    locationConfidence: 'HIGH',
    timestamp: now,
  });

  const scRef = doc(collection(db, 'scan_events'));
  batch.set(scRef, {
    unitId,
    scanType: 'seller_scan',
    scanningSellerId: sellerId,
    regionLabel,
    result: 'AUTHENTIC',
    riskScore: 5,
    timestamp: now,
  });

  await batch.commit();
}

// ============================================================
// TRANSFERS
// ============================================================
export async function findSellerByEmail(email) {
  const ref = collection(db, 'sellers');
  const snap = await getDocs(
    query(ref, where('email', '==', email.toLowerCase()), limit(1)),
  );
  if (snap.empty) return null;
  return { id: snap.docs[0].id, ...snap.docs[0].data() };
}

export async function fetchHeldUnits(sellerId, max = 500) {
  const ref = collection(db, 'units');
  try {
    const snap = await getDocs(
      query(ref, where('currentSellerId', '==', sellerId), limit(max)),
    );
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  } catch (err) {
    console.warn('fetchHeldUnits fast path failed:', err.code);
    return [];
  }
}

export async function createTransfer({
  fromSellerId,
  toSellerId,
  unitIds,
  destinationLabel,
}) {
  if (
    !fromSellerId ||
    !toSellerId ||
    !Array.isArray(unitIds) ||
    unitIds.length === 0
  ) {
    throw new Error('createTransfer: missing parameters or no units selected.');
  }

  const now = new Date().toISOString();

  const transferRef = await addDoc(collection(db, 'transfers'), {
    fromSellerId,
    toSellerId,
    quantity: unitIds.length,
    unitIds,
    destinationLabel: destinationLabel || '',
    status: 'declared',
    declaredAt: now,
    acceptedAt: null,
    completedAt: null,
    cancelledAt: null,
    notes: null,
  });

  // Write a movement event for each unit so the chain of custody
  // stays intact even before the recipient confirms.
  const MAX_UNITS_PER_BATCH = 150;
  const chunks = [];
  for (let i = 0; i < unitIds.length; i += MAX_UNITS_PER_BATCH) {
    chunks.push(unitIds.slice(i, i + MAX_UNITS_PER_BATCH));
  }

  for (const chunk of chunks) {
    const batch = writeBatch(db);
    for (const unitId of chunk) {
      const mvRef = doc(collection(db, 'movement_events'));
      batch.set(mvRef, {
        unitId,
        eventType: 'transfer_declared',
        relatedShipmentId: null,
        relatedTransferId: transferRef.id,
        actorSellerId: fromSellerId,
        locationLabel: destinationLabel || 'Unknown',
        locationConfidence: 'MEDIUM',
        timestamp: now,
      });
    }
    try {
      await batch.commit();
    } catch (err) {
      console.error('createTransfer movement batch failed:', err);
      throw new Error(
        'Transfer created but could not record movement events. Please contact support.',
      );
    }
  }

  return { id: transferRef.id };
}

export async function acceptTransfer(transferId, sellerId) {
  const ref = doc(db, 'transfers', transferId);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error('Transfer not found.');

  const t = snap.data();
  if (t.toSellerId !== sellerId) {
    throw new Error('Only the recipient can accept this transfer.');
  }
  if (t.status !== 'declared') {
    throw new Error(`Transfer is already ${t.status}.`);
  }

  const now = new Date().toISOString();
  await updateDoc(ref, {
    status: 'in_transit',
    acceptedAt: now,
  });

  return { ok: true };
}

export async function cancelTransfer(transferId, sellerId) {
  const ref = doc(db, 'transfers', transferId);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error('Transfer not found.');

  const t = snap.data();
  if (t.fromSellerId !== sellerId) {
    throw new Error('Only the sender can cancel this transfer.');
  }
  if (t.status === 'completed') {
    throw new Error('Completed transfers cannot be cancelled.');
  }

  const now = new Date().toISOString();
  await updateDoc(ref, {
    status: 'cancelled',
    cancelledAt: now,
  });

  return { ok: true };
}

export async function completeTransfer(transferId, sellerId) {
  const ref = doc(db, 'transfers', transferId);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error('Transfer not found.');

  const t = snap.data();
  if (t.toSellerId !== sellerId) {
    throw new Error('Only the recipient can complete this transfer.');
  }
  if (t.status !== 'in_transit') {
    throw new Error(`Transfer is ${t.status}, expected in_transit.`);
  }

  const now = new Date().toISOString();
  const unitIds = Array.isArray(t.unitIds) ? t.unitIds : [];

  // Hand ownership of every unit to the recipient, then close the transfer.
  const MAX_UNITS_PER_BATCH = 150;
  const chunks = [];
  for (let i = 0; i < unitIds.length; i += MAX_UNITS_PER_BATCH) {
    chunks.push(unitIds.slice(i, i + MAX_UNITS_PER_BATCH));
  }

  for (const chunk of chunks) {
    const batch = writeBatch(db);
    for (const unitId of chunk) {
      const unitRef = doc(db, 'units', unitId);
      batch.update(unitRef, {
        currentSellerId: sellerId,
        currentLocationLabel: t.destinationLabel || 'Unknown',
        currentLocationConfidence: 'HIGH',
        lastReceivedAt: now,
      });

      const mvRef = doc(collection(db, 'movement_events'));
      batch.set(mvRef, {
        unitId,
        eventType: 'transfer_completed',
        relatedShipmentId: null,
        relatedTransferId: transferId,
        actorSellerId: sellerId,
        locationLabel: t.destinationLabel || 'Unknown',
        locationConfidence: 'HIGH',
        timestamp: now,
      });

      const scRef = doc(collection(db, 'scan_events'));
      batch.set(scRef, {
        unitId,
        scanType: 'seller_scan',
        scanningSellerId: sellerId,
        regionLabel: t.destinationLabel || 'Unknown',
        result: 'AUTHENTIC',
        riskScore: 5,
        timestamp: now,
      });
    }
    await batch.commit();
  }

  await updateDoc(ref, {
    status: 'completed',
    completedAt: now,
  });

  return { ok: true, count: unitIds.length };
}

// ============================================================
// BACKFILL — one-off admin utility
// ------------------------------------------------------------
// Publishes every active + verified seller into
// `public_seller_profiles`. Run ONCE from the browser console
// while signed in as admin:
//   import('./seller/sellerAuth').then(m => m.backfillSellerPublicProfiles());
// ============================================================
export async function backfillSellerPublicProfiles() {
  const snap = await getDocs(collection(db, 'sellers'));
  let published = 0;
  let skipped = 0;

  for (const d of snap.docs) {
    const s = d.data();
    if (s.status !== 'active' || !s.firebaseUid) {
      skipped += 1;
      continue;
    }
    try {
      const slug = await publishSellerProfile(d.id);
      if (slug) published += 1;
      else skipped += 1;
    } catch (err) {
      console.warn(`Could not publish seller ${d.id}:`, err.code);
      skipped += 1;
    }
  }

  console.log(`✅ Published ${published} sellers, skipped ${skipped}.`);
  return { published, skipped };
}