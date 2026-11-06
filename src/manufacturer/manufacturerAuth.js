// src/manufacturer/manufacturerAuth.js
// ============================================================
// Auth + Firestore logic for the Manufacturer Portal.
// ============================================================

import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
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
} from 'firebase/firestore';
import { sha256 } from 'js-sha256';
import { auth, db } from '../firebase';

// ============================================================
// ERROR CLASS
// ============================================================
export class ManufacturerLoginError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

// ============================================================
// ROLE CONSTANTS — keep in sync with the UI
// ============================================================
export const ROLES = {
  OWNER: 'OWNER',
  ADMIN: 'ADMIN',
  GENERATION_OFFICER: 'GENERATION_OFFICER',
  ACTIVATION_OFFICER: 'ACTIVATION_OFFICER',
  SHIPPING_OFFICER: 'SHIPPING_OFFICER',
  SUPERVISOR: 'SUPERVISOR',
  VIEWER: 'VIEWER',
};

export const ROLE_LABELS = {
  OWNER: 'Owner',
  ADMIN: 'Admin',
  GENERATION_OFFICER: 'Generation Officer',
  ACTIVATION_OFFICER: 'Activation Officer',
  SHIPPING_OFFICER: 'Shipping Officer',
  SUPERVISOR: 'Supervisor',
  VIEWER: 'Viewer',
};

const ROLE_CAPABILITIES = {
  OWNER: ['*'],
  ADMIN: ['*'],
  GENERATION_OFFICER: ['dashboard.view', 'batch.view', 'batch.create'],
  ACTIVATION_OFFICER: ['dashboard.view', 'batch.view', 'batch.activate', 'qr.download'],
  SHIPPING_OFFICER: ['dashboard.view', 'batch.view', 'shipment.view', 'shipment.create'],
  SUPERVISOR: ['dashboard.view', 'batch.view', 'qr.download', 'batch.activate', 'staff.view'],
  VIEWER: ['dashboard.view', 'batch.view', 'shipment.view'],
};

export function can(role, capability) {
  if (!role) return false;
  const caps = ROLE_CAPABILITIES[role] || [];
  return caps.includes('*') || caps.includes(capability);
}

// ============================================================
// 🔑 STAFF NORMALIZER
// ============================================================
function normalizeStaff(raw, id) {
  if (!raw) return null;
  const fallbackName = raw.fullName || raw.name || raw.email || 'Staff';
  return {
    ...raw,
    id: id || raw.id,
    fullName: fallbackName,
    name: raw.name || fallbackName,
    email: raw.email || '',
    role: raw.role || 'STAFF',
    status: raw.status || 'active',
  };
}

// ============================================================
// LOGIN
// ============================================================
export const loginManufacturer = async (email, password) => {
  const cred = await signInWithEmailAndPassword(auth, email, password);
  const user = cred.user;

  // 1. Find the staff record by firebaseUid, then by email
  const staffRef = collection(db, 'manufacturer_staff');
  let staffSnap = await getDocs(
    query(staffRef, where('firebaseUid', '==', user.uid), limit(1))
  );
  if (staffSnap.empty && user.email) {
    staffSnap = await getDocs(
      query(staffRef, where('email', '==', user.email.toLowerCase()), limit(1))
    );
    if (!staffSnap.empty) {
      try {
        await updateDoc(doc(db, 'manufacturer_staff', staffSnap.docs[0].id), {
          firebaseUid: user.uid,
          lastLoginAt: serverTimestamp(),
        });
      } catch (_) {
        /* non-fatal */
      }
    }
  }

  // 2. No staff record? Check for a pending application
  if (staffSnap.empty) {
    const appSnap = await getDocs(
      query(
        collection(db, 'manufacturer_applications'),
        where('contactEmail', '==', (user.email || '').toLowerCase()),
        limit(1)
      )
    );

    await signOut(auth);

    if (!appSnap.empty) {
      const app = appSnap.docs[0].data();
      if (app.status === 'pending' || app.status === 'under_review') {
        throw new ManufacturerLoginError(
          'manufacturer/pending',
          'Your manufacturer application is still under review. You will be notified by email once approved.'
        );
      }
      if (app.status === 'rejected') {
        throw new ManufacturerLoginError(
          'manufacturer/rejected',
          `Your application was not approved. Reason: ${app.rejectionReason || 'Not provided'}`
        );
      }
    }

    throw new ManufacturerLoginError(
      'manufacturer/no-profile',
      'Your account is not linked to a manufacturer profile. Please contact support.'
    );
  }

  const staff = normalizeStaff(
    staffSnap.docs[0].data(),
    staffSnap.docs[0].id
  );

  if (staff.status === 'suspended' || staff.status === 'removed') {
    await signOut(auth);
    throw new ManufacturerLoginError(
      'manufacturer/staff-suspended',
      `Your staff access is ${staff.status}. Contact your manufacturer admin.`
    );
  }

  // 3. Manufacturer record
  const manufacturerDoc = await getDoc(
    doc(db, 'manufacturers', staff.manufacturerId)
  );

  if (!manufacturerDoc.exists()) {
    await signOut(auth);
    throw new ManufacturerLoginError(
      'manufacturer/not-found',
      'Your manufacturer profile could not be found.'
    );
  }

  const manufacturer = { id: manufacturerDoc.id, ...manufacturerDoc.data() };

  if (manufacturer.status !== 'active' && manufacturer.status !== 'approved') {
    await signOut(auth);
    throw new ManufacturerLoginError(
      'manufacturer/suspended',
      `Your manufacturer account is ${manufacturer.status}. Please contact support.`
    );
  }

  // 4. Update lastLoginAt
  try {
    await updateDoc(doc(db, 'manufacturer_staff', staff.id), {
      lastLoginAt: serverTimestamp(),
    });
  } catch (_) {
    /* non-fatal */
  }

  return { user, manufacturer, staff };
};

export const logoutManufacturer = async () => {
  await signOut(auth);
};

export const watchManufacturerAuth = (callback) =>
  onAuthStateChanged(auth, callback);

export const resetManufacturerPassword = (email) =>
  sendPasswordResetEmail(auth, email);

// ============================================================
// CURRENT PROFILE
// ============================================================
export async function getCurrentManufacturerProfile() {
  const user = auth.currentUser;
  if (!user) return null;

  const staffRef = collection(db, 'manufacturer_staff');
  let staffSnap = await getDocs(
    query(staffRef, where('firebaseUid', '==', user.uid), limit(1))
  );
  if (staffSnap.empty && user.email) {
    staffSnap = await getDocs(
      query(staffRef, where('email', '==', user.email.toLowerCase()), limit(1))
    );
  }
  if (staffSnap.empty) return null;

  const staff = normalizeStaff(
    staffSnap.docs[0].data(),
    staffSnap.docs[0].id
  );

  const manufacturerDoc = await getDoc(
    doc(db, 'manufacturers', staff.manufacturerId)
  );
  if (!manufacturerDoc.exists()) return null;

  const manufacturer = { id: manufacturerDoc.id, ...manufacturerDoc.data() };

  if (manufacturer.status !== 'active' && manufacturer.status !== 'approved') {
    return null;
  }

  return { manufacturer, staff };
}

// ============================================================
// SIGNUP
// ============================================================
export async function signUpManufacturer({
  companyName,
  contactEmail,
  phoneNumber,
  website,
  physicalAddress,
  city,
  state,
  country,
  businessType,
  registrationNumber,
  taxId,
  contactPersonName,
  contactPersonRole,
  password,
}) {
  const cred = await createUserWithEmailAndPassword(auth, contactEmail, password);
  const user = cred.user;

  const docRef = await addDoc(collection(db, 'manufacturer_applications'), {
    companyName,
    contactEmail: contactEmail.toLowerCase(),
    phoneNumber,
    website: website || null,
    address: { physicalAddress, city, state, country: country || 'Nigeria' },
    businessInfo: { businessType, registrationNumber, taxId },
    contactPerson: { fullName: contactPersonName, role: contactPersonRole },
    firebaseUid: user.uid,
    status: 'pending',
    submittedAt: serverTimestamp(),
    reviewedAt: null,
    reviewedBy: null,
    reviewedByName: null,
    rejectionReason: null,
    promotedManufacturerId: null,
  });

  await signOut(auth);
  return { uid: user.uid, applicationId: docRef.id };
}

// ============================================================
// 🆕 CREATE STAFF MEMBER
// ============================================================
// Creates:
//   1. A Firebase Auth user (via the Identity Toolkit REST API —
//      this works from the client without a backend).
//   2. A manufacturer_staff Firestore doc linked to that Auth user.
//
// The new staff member can then immediately sign in at
// /manufacturer/login with the email + password you set.
//
// Notes:
//   - The Web API key is designed to be public — it identifies the
//     Firebase project, it does NOT grant privileged access.
//     Firestore rules + Firebase Auth enforce actual security.
//   - We use `setDoc` with `newUid` as the doc ID so the staff doc
//     is directly addressable by UID (useful for future rules).
// ============================================================
export async function createStaffMember({
  manufacturerId,
  email,
  password,
  fullName,
  phone,
  role,
  invitedByStaffId,
  invitedByName,
}) {
  if (!manufacturerId) throw new Error('Manufacturer ID is required.');
  if (!email || !password) throw new Error('Email and password are required.');
  if (password.length < 6)
    throw new Error('Password must be at least 6 characters.');

  const cleanEmail = email.trim().toLowerCase();
  const cleanName = (fullName || '').trim() || cleanEmail;

  // ---- 1. Get the Firebase Web API key from the app config ----
  const apiKey =
    auth?.app?.options?.apiKey ||
    process.env.REACT_APP_FIREBASE_API_KEY ||
    '';

  if (!apiKey) {
    throw new Error(
      'Firebase API key not found. Check your firebase.js configuration.'
    );
  }

  // ---- 2. Create the Firebase Auth user via REST ----
  const authResponse = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: cleanEmail,
        password,
        returnSecureToken: false,
      }),
    }
  );

  const authData = await authResponse.json();

  if (!authResponse.ok) {
    const code = authData?.error?.message || 'AUTH_ERROR';
    const messageMap = {
      EMAIL_EXISTS:
        'An account with this email already exists. Try a different email, or ask the staff to use "Forgot password".',
      WEAK_PASSWORD: 'Password too weak. Use at least 6 characters.',
      INVALID_EMAIL: 'Invalid email address.',
      OPERATION_NOT_ALLOWED:
        'Email/password sign-in is disabled for this project. Enable it in Firebase Console → Authentication → Sign-in method.',
      API_KEY_INVALID:
        'Firebase API key is invalid. Check your firebase.js configuration.',
    };
    throw new Error(messageMap[code] || `Could not create account: ${code}`);
  }

  const newUid = authData.localId;
  if (!newUid) {
    throw new Error('Auth user was created but no UID was returned.');
  }

  // ---- 3. Write the Firestore staff doc ----
  // Using setDoc with newUid as the doc ID so the doc is directly
  // addressable as /manufacturer_staff/{firebaseUid}.
  try {
    await setDoc(doc(db, 'manufacturer_staff', newUid), {
      manufacturerId,
      firebaseUid: newUid,
      email: cleanEmail,
      name: cleanName,
      fullName: cleanName,
      phone: (phone || '').trim(),
      role,
      permissions: ['*'],
      status: 'active',
      invitedBy: invitedByStaffId || null,
      invitedByName: invitedByName || null,
      invitedAt: serverTimestamp(),
      acceptedAt: serverTimestamp(),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      lastLoginAt: null,
    });
  } catch (firestoreErr) {
    console.error(
      '⚠️ Auth user created but Firestore write failed. Orphaned UID:',
      newUid,
      firestoreErr
    );
    throw new Error(
      `Staff account was created in Auth, but the profile write failed: ${firestoreErr.message}. Contact support with this UID: ${newUid}`
    );
  }

  return { uid: newUid, email: cleanEmail, fullName: cleanName, role };
}

// ============================================================
// 🆕 UPDATE STAFF ROLE
// ============================================================
export async function updateStaffRole({
  staffDocId,
  newRole,
  actorStaffId,
}) {
  if (!staffDocId) throw new Error('Staff doc ID is required.');
  if (!newRole) throw new Error('New role is required.');

  await updateDoc(doc(db, 'manufacturer_staff', staffDocId), {
    role: newRole,
    updatedAt: serverTimestamp(),
    updatedBy: actorStaffId || null,
  });
}

// ============================================================
// 🆕 SET STAFF STATUS
// ============================================================
export async function setStaffStatus({
  staffDocId,
  status,
  actorStaffId,
}) {
  if (!staffDocId) throw new Error('Staff doc ID is required.');
  if (!['active', 'suspended', 'removed'].includes(status)) {
    throw new Error('Invalid status.');
  }

  await updateDoc(doc(db, 'manufacturer_staff', staffDocId), {
    status,
    updatedAt: serverTimestamp(),
    updatedBy: actorStaffId || null,
  });
}

// ============================================================
// HELPERS — random codes + hashing
// ============================================================
function randomPin(length = 6) {
  let pin = '';
  for (let i = 0; i < length; i++) pin += Math.floor(Math.random() * 10);
  return pin;
}

function randomRefCodePart(length) {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = '';
  for (let i = 0; i < length; i++) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return out;
}

function formatRefCode() {
  return `${randomRefCodePart(4)}-${randomRefCodePart(4)}`;
}

function randomToken(length = 32) {
  const alphabet =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let out = '';
  for (let i = 0; i < length; i++) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return out;
}

function sha256Hex(input) {
  return sha256(input);
}

// ============================================================
// BATCH CREATION + NOTIFICATION DISPATCH
// ============================================================
export async function createBatchWithUnits({
  manufacturerId,
  productId,
  productName,
  quantity,
  productionLocation,
  productionDate,
  staffId,
  staffName,
  onProgress,
}) {
  if (!quantity || quantity < 1) throw new Error('Quantity must be at least 1.');
  if (quantity > 5000) throw new Error('Max 5000 units per batch.');

  const batchCode = `BTH-${new Date()
    .toISOString()
    .slice(0, 10)
    .replace(/-/g, '')}-${randomRefCodePart(4)}`;

  const batchRef = await addDoc(collection(db, 'batches'), {
    manufacturerId,
    productId: productId || null,
    productName: productName || null,
    batchCode,
    quantity,
    productionLocation,
    productionDate,
    status: 'awaiting_activation',
    createdAt: serverTimestamp(),
    generationRequestedBy: staffId,
    generationRequestedByName: staffName,
    generationApprovedBy: null,
    activatedAt: null,
    activatedBy: null,
    activatedByName: null,
    qrZipGeneratedAt: null,
    qrZipGeneratedBy: null,
    qrZipGenerationCount: 0,
  });

  const batchId = batchRef.id;

  const units = [];
  for (let i = 0; i < quantity; i++) {
    const localUnitId = `U-${Date.now().toString(36)}-${randomRefCodePart(6)}`;
    const consumerReferenceCode = formatRefCode();
    const consumerBarcodeToken = randomToken(24);
    const sellerBarcodeToken = randomToken(24);
    const plainPin = randomPin(6);
    const pinSalt = randomToken(16);
    const pinHash = sha256Hex(plainPin + pinSalt);

    units.push({
      localUnitId,
      batchId,
      manufacturerId,
      productId: productId || null,
      productName: productName || null,
      unitSequence: i + 1,
      consumerReferenceCode,
      consumerBarcodeToken,
      sellerBarcodeToken,
      pinHash,
      pinSalt,
      _plainPin: plainPin,
      status: 'MANUFACTURED',
      currentLocationLabel: productionLocation,
      currentLocationConfidence: 'HIGH',
      activatedByStaffId: null,
      activatedByName: null,
      activatedAt: null,
      createdAt: serverTimestamp(),
    });
  }

  const CHUNK = 200;
  const MAX_RETRIES = 3;
  let written = 0;

  for (let i = 0; i < units.length; i += CHUNK) {
    const slice = units.slice(i, i + CHUNK);
    let attempt = 0;
    let lastErr = null;

    while (attempt < MAX_RETRIES) {
      try {
        await Promise.all(
          slice.map((u) => {
            const { _plainPin, localUnitId, ...writable } = u;
            return addDoc(collection(db, 'units'), writable);
          })
        );
        lastErr = null;
        break;
      } catch (err) {
        lastErr = err;
        attempt++;
        console.warn(
          `Unit chunk write attempt ${attempt}/${MAX_RETRIES} failed:`,
          err.code,
          err.message
        );
        if (attempt < MAX_RETRIES) {
          await new Promise((r) => setTimeout(r, 400 * Math.pow(2, attempt)));
        }
      }
    }

    if (lastErr) {
      try {
        const existing = await getDocs(
          query(collection(db, 'units'), where('batchId', '==', batchId))
        );
        await Promise.all(existing.docs.map((d) => deleteDoc(d.ref)));
      } catch (cleanupErr) {
        console.error('Rollback cleanup failed:', cleanupErr);
      }

      await updateDoc(doc(db, 'batches', batchId), {
        status: 'failed',
        failureReason: lastErr.message,
        failedAt: serverTimestamp(),
      });

      throw new Error(
        `Failed to write units: ${lastErr.message}. Batch ${batchCode} was rolled back.`
      );
    }

    written += slice.length;
    if (onProgress) onProgress(written, units.length);
  }

  const verify = await getDocs(
    query(collection(db, 'units'), where('batchId', '==', batchId))
  );
  if (verify.size !== quantity) {
    throw new Error(
      `Unit count mismatch: expected ${quantity}, found ${verify.size}. Contact support.`
    );
  }

  // Notify ACTIVATION_OFFICER + SUPERVISOR (best-effort)
  try {
    const staffRef = collection(db, 'manufacturer_staff');
    const [activationSnap, supervisorSnap] = await Promise.all([
      getDocs(
        query(
          staffRef,
          where('manufacturerId', '==', manufacturerId),
          where('role', '==', 'ACTIVATION_OFFICER')
        )
      ),
      getDocs(
        query(
          staffRef,
          where('manufacturerId', '==', manufacturerId),
          where('role', '==', 'SUPERVISOR')
        )
      ),
    ]);

    const recipients = [
      ...activationSnap.docs.map((d) => d.data()),
      ...supervisorSnap.docs.map((d) => d.data()),
    ];

    for (const recipient of recipients) {
      if (!recipient.email) continue;
      await addDoc(collection(db, 'staff_notifications'), {
        recipientEmail: recipient.email,
        recipientUid: recipient.firebaseUid || null,
        recipientRole: recipient.role,
        manufacturerId,
        type: 'batch_awaiting_activation',
        subject: `New batch ${batchCode} awaiting activation`,
        body:
          `Batch ${batchCode} (${quantity} units) has been created by ` +
          `${staffName} and is awaiting activation. ` +
          `Please log in to the Activation Queue to generate and download the QR codes.`,
        batchId,
        batchCode,
        quantity,
        createdByStaffId: staffId,
        createdByStaffName: staffName,
        read: false,
        readAt: null,
        createdAt: serverTimestamp(),
      });
    }
  } catch (err) {
    console.warn('Could not dispatch notifications:', err);
  }

  return { batchId, batchCode, units, unitCount: verify.size };
}

// ============================================================
// FETCH BATCHES
// ============================================================
export async function fetchManufacturerBatches(manufacturerId) {
  const ref = collection(db, 'batches');
  const snap = await getDocs(
    query(ref, where('manufacturerId', '==', manufacturerId))
  );
  const batches = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  batches.sort((a, b) => {
    const aT = a.createdAt?.toDate?.()?.getTime?.() || 0;
    const bT = b.createdAt?.toDate?.()?.getTime?.() || 0;
    return bT - aT;
  });
  return batches;
}

export async function fetchBatchById(batchId) {
  const snap = await getDoc(doc(db, 'batches', batchId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() };
}

export async function fetchBatchUnits(batchId) {
  const ref = collection(db, 'units');
  const snap = await getDocs(query(ref, where('batchId', '==', batchId)));
  const units = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  units.sort((a, b) => (a.unitSequence || 0) - (b.unitSequence || 0));
  return units;
}

export async function fetchManufacturerProducts(manufacturerId) {
  const ref = collection(db, 'products');
  const snap = await getDocs(
    query(ref, where('manufacturerId', '==', manufacturerId))
  );
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

// ============================================================
// DASHBOARD STATS
// ============================================================
export async function fetchManufacturerStats(manufacturerId) {
  const batches = await fetchManufacturerBatches(manufacturerId);

  const awaiting = batches.filter((b) => b.status === 'awaiting_activation').length;
  const activated = batches.filter((b) => b.status === 'activated').length;
  const flagged = batches.filter((b) => b.status === 'flagged').length;
  const recalled = batches.filter((b) => b.status === 'recalled').length;

  const unitsRef = collection(db, 'units');
  const unitsSnap = await getDocs(
    query(unitsRef, where('manufacturerId', '==', manufacturerId))
  );
  const units = unitsSnap.docs.map((d) => d.data());

  return {
    totalBatches: batches.length,
    awaitingActivationBatches: awaiting,
    activatedBatches: activated,
    flaggedBatches: flagged,
    recalledBatches: recalled,
    totalUnits: units.length,
    activeUnits: units.filter((u) => u.status === 'ACTIVE').length,
    manufacturedUnits: units.filter((u) => u.status === 'MANUFACTURED').length,
    flaggedUnits: units.filter((u) => u.status === 'FLAGGED').length,
    recalledUnits: units.filter((u) => u.status === 'RECALLED').length,
  };
}

// ============================================================
// ACTIVATION — MARK UNITS ACTIVE + CLOSE NOTIFICATIONS
// ============================================================
export async function markUnitsAsActivated({
  batchId,
  staffId,
  staffName,
  unitIds,
  onProgress,
}) {
  const now = new Date().toISOString();
  let done = 0;

  for (const unitId of unitIds) {
    await updateDoc(doc(db, 'units', unitId), {
      status: 'ACTIVE',
      activatedByStaffId: staffId,
      activatedByName: staffName,
      activatedAt: serverTimestamp(),
    });

    await addDoc(collection(db, 'movement_events'), {
      unitId,
      eventType: 'activated',
      actorSellerId: null,
      actorStaffId: staffId,
      actorStaffName: staffName,
      locationLabel: 'Manufacturing Facility',
      locationConfidence: 'HIGH',
      timestamp: now,
    });

    done++;
    if (onProgress) onProgress(done, unitIds.length);
  }

  await updateDoc(doc(db, 'batches', batchId), {
    status: 'activated',
    activatedAt: serverTimestamp(),
    activatedBy: staffId,
    activatedByName: staffName,
  });

  try {
    const notifRef = collection(db, 'staff_notifications');
    const snap = await getDocs(query(notifRef, where('batchId', '==', batchId)));
    await Promise.all(
      snap.docs.map((n) =>
        updateDoc(doc(db, 'staff_notifications', n.id), {
          read: true,
          readAt: serverTimestamp(),
          readByStaffId: staffId,
        })
      )
    );
  } catch (err) {
    console.warn('Could not mark notifications as read:', err);
  }

  return { success: true, activatedCount: unitIds.length };
}

// ============================================================
// AUDIT LOG — QR ZIP downloads
// ============================================================
export async function logQrZipDownload({
  manufacturerId,
  batchId,
  staffId,
  staffName,
  unitCount,
}) {
  await addDoc(collection(db, 'audit_log'), {
    manufacturerId,
    actorUid: staffId,
    actorName: staffName,
    action: 'qr_zip_downloaded',
    targetType: 'batch',
    targetId: batchId,
    metadata: { unitCount },
    timestamp: serverTimestamp(),
  });

  await updateDoc(doc(db, 'batches', batchId), {
    qrZipGeneratedAt: serverTimestamp(),
    qrZipGeneratedBy: staffId,
    qrZipGeneratedByName: staffName,
  });
}

// ============================================================
// NOTIFICATIONS
// ============================================================
export async function fetchMyNotifications(staffUidOrEmail, max = 50) {
  const ref = collection(db, 'staff_notifications');

  let snap = await getDocs(
    query(ref, where('recipientUid', '==', staffUidOrEmail), limit(max))
  );

  if (snap.empty) {
    snap = await getDocs(
      query(ref, where('recipientEmail', '==', staffUidOrEmail), limit(max))
    );
  }

  const notifications = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  notifications.sort((a, b) => {
    const aT = a.createdAt?.toDate?.()?.getTime?.() || 0;
    const bT = b.createdAt?.toDate?.()?.getTime?.() || 0;
    return bT - aT;
  });
  return notifications;
}

export async function fetchUnreadNotifications(staffUid, staffEmail) {
  const all = await fetchMyNotifications(staffUid || staffEmail);
  return all.filter((n) => !n.read);
}

export async function markNotificationRead(notificationId) {
  await updateDoc(doc(db, 'staff_notifications', notificationId), {
    read: true,
    readAt: serverTimestamp(),
  });
}

export async function markAllMyNotificationsRead(staffUid) {
  const ref = collection(db, 'staff_notifications');
  const snap = await getDocs(
    query(ref, where('recipientUid', '==', staffUid), where('read', '==', false))
  );
  await Promise.all(
    snap.docs.map((n) =>
      updateDoc(doc(db, 'staff_notifications', n.id), {
        read: true,
        readAt: serverTimestamp(),
      })
    )
  );
  return snap.size;
}

// ============================================================
// RECALL
// ============================================================
export async function recallBatch({ batchId, reason, staffId, staffName }) {
  await updateDoc(doc(db, 'batches', batchId), {
    status: 'recalled',
    recallReason: reason,
    recalledAt: serverTimestamp(),
    recalledBy: staffId,
    recalledByName: staffName,
  });

  const unitsRef = collection(db, 'units');
  const snap = await getDocs(query(unitsRef, where('batchId', '==', batchId)));

  await Promise.all(
    snap.docs.map((unitDoc) =>
      updateDoc(doc(db, 'units', unitDoc.id), {
        status: 'RECALLED',
        recallReason: reason,
        recalledAt: serverTimestamp(),
      })
    )
  );

  return { success: true, unitsRecalled: snap.size };
}

// ============================================================
// SHIPMENTS
// ============================================================
export async function fetchManufacturerShipments(manufacturerId) {
  const ref = collection(db, 'shipments');
  const snap = await getDocs(ref);
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter((s) => s.manufacturerId === manufacturerId);
}

export async function createShipment({
  manufacturerId,
  batchId,
  toSellerId,
  quantity,
  destinationLabel,
  staffId,
  staffName,
}) {
  const ref = await addDoc(collection(db, 'shipments'), {
    manufacturerId,
    batchId,
    toSellerId,
    quantity,
    destinationLabel,
    unitIdRange: null,
    status: 'pending',
    createdAt: serverTimestamp(),
    createdBy: staffId,
    createdByName: staffName,
  });
  return ref.id;
}

// ============================================================
// RECONCILIATION
// ============================================================
export async function fetchReconciliation(manufacturerId) {
  const batches = await fetchManufacturerBatches(manufacturerId);
  const rows = [];

  for (const batch of batches) {
    const unitsRef = collection(db, 'units');
    const snap = await getDocs(
      query(unitsRef, where('batchId', '==', batch.id))
    );
    const units = snap.docs.map((d) => d.data());
    const generated = batch.quantity || units.length;
    const activated = units.filter(
      (u) => u.status === 'ACTIVE' || u.status === 'FLAGGED'
    ).length;
    const gap = generated - activated;

    rows.push({
      batchId: batch.id,
      batchCode: batch.batchCode,
      batchStatus: batch.status,
      generated,
      activated,
      gap,
      createdAt: batch.createdAt,
    });
  }

  return rows;
}