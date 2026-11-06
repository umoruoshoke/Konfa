// src/admin/adminBrandVerificationApi.js
// ============================================================
// Admin tools for the Brand verification system.
// Mirrors the seller verification admin API but targets the
// brand_verifications collection.
// ============================================================

import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  updateDoc,
  serverTimestamp,
  addDoc,
} from 'firebase/firestore';
import { db, auth } from '../firebase';

// Helper to flatten nested accounts
function getFlattenedAccounts(rawAccounts) {
  const flat = [];
  if (!rawAccounts) return flat;
  
  Object.values(rawAccounts).forEach((platformData) => {
    if (!platformData) return;
    if (platformData.platform || platformData.handle) {
      flat.push(platformData);
    } else {
      Object.values(platformData).forEach((acc) => flat.push(acc));
    }
  });
  return flat;
}

// ============================================================
// READ — PENDING (grouped by brand)
// ============================================================
export async function fetchGroupedPendingBrandVerifications() {
  const col = collection(db, 'brand_verifications');

  const ownerQ = query(
    col,
    where('owner.status', '==', 'pending'),
    limit(100)
  );

  const socialQ = query(
    col,
    where('overallStatus', 'in', ['unverified', 'owner_verified']),
    limit(200)
  );

  const [ownerSnap, socialSnap] = await Promise.all([
    getDocs(ownerQ).catch(() => ({ docs: [] })),
    getDocs(socialQ).catch(() => ({ docs: [] })),
  ]);

  const map = new Map();

  const ingest = (snap) => {
    snap.docs.forEach((d) => {
      const data = d.data();
      const flatAccounts = getFlattenedAccounts(data.accounts);
      const pendingAccounts = flatAccounts.filter(
        (a) => a?.status === 'pending'
      );

      const ownerPending = data.owner?.status === 'pending';
      if (!ownerPending && pendingAccounts.length === 0) return;

      const existing = map.get(d.id) || {
        brandUid: d.id,
        brandDisplayName: data.brandDisplayName || 'Unnamed brand',
        brandEmail: data.brandEmail || '',
        publicSlug: data.publicSlug || null,
        owner: data.owner || {},
        accounts: data.accounts || {},
        pendingByKind: { owner: 0, social: 0 },
        totalPending: 0,
        updatedAt: data.updatedAt || null,
      };

      existing.owner = data.owner || existing.owner;
      existing.accounts = data.accounts || existing.accounts;
      existing.publicSlug = data.publicSlug || existing.publicSlug;

      existing.pendingByKind.owner = ownerPending ? 1 : 0;
      existing.pendingByKind.social = pendingAccounts.length;
      existing.totalPending =
        existing.pendingByKind.owner + existing.pendingByKind.social;

      map.set(d.id, existing);
    });
  };

  ingest(ownerSnap);
  ingest(socialSnap);

  return Array.from(map.values())
    .filter((b) => b.totalPending > 0)
    .sort((a, b) => b.totalPending - a.totalPending);
}

// ============================================================
// READ — ONE BRAND
// ============================================================
export async function fetchBrandVerificationById(brandUid) {
  if (!brandUid) return null;
  const snap = await getDoc(doc(db, 'brand_verifications', brandUid));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() };
}

// ============================================================
// READ — VERIFIED BRANDS
// ============================================================
export async function fetchVerifiedBrands({ max = 50 } = {}) {
  const q = query(
    collection(db, 'brand_verifications'),
    where('overallStatus', 'in', ['owner_verified', 'fully_verified']),
    orderBy('updatedAt', 'desc'),
    limit(max)
  );

  try {
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  } catch {
    const snap = await getDocs(
      query(
        collection(db, 'brand_verifications'),
        where('overallStatus', 'in', ['owner_verified', 'fully_verified']),
        limit(max)
      )
    );
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  }
}

// ============================================================
// WRITE — OWNER DECISION
// ============================================================
export async function decideBrandOwner({
  brandUid,
  decision,
  reason = '',
  adminNote = '',
}) {
  if (!brandUid) throw new Error('Missing brand UID.');
  if (!['approve', 'reject'].includes(decision)) {
    throw new Error('Invalid decision.');
  }
  if (decision === 'reject' && !reason.trim()) {
    throw new Error('A rejection reason is required.');
  }

  const ref = doc(db, 'brand_verifications', brandUid);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error('Brand verification not found.');

  const base = snap.data();
  const owner = base.owner || {};

  const ownerUpdate =
    decision === 'approve'
      ? {
          ...owner,
          status: 'verified',
          verifiedAt: serverTimestamp(),
          verifiedBy: auth.currentUser?.uid || null,
          rejectionReason: null,
          adminNote: adminNote || null,
        }
      : {
          ...owner,
          status: 'rejected',
          verifiedAt: null,
          verifiedBy: auth.currentUser?.uid || null,
          rejectionReason: reason.trim(),
          adminNote: adminNote || null,
        };

  const overallStatus = computeBrandOverall({
    owner: ownerUpdate,
    accounts: base.accounts || {},
  });

  await updateDoc(ref, {
    owner: ownerUpdate,
    overallStatus,
    updatedAt: serverTimestamp(),
  });

  await logBrandDecision({
    brandUid,
    level: 'owner',
    decision,
    reason,
    adminNote,
  });

  if (decision === 'approve' && base.publicSlug) {
    await refreshPublicBrandMirror(brandUid).catch(() => {});
  }

  return { ok: true, owner: ownerUpdate, overallStatus };
}

// ============================================================
// WRITE — SOCIAL ACCOUNT DECISION
// ============================================================
export async function decideBrandSocial({
  brandUid,
  platform,
  handle, // 🔑 Added handle to target the specific nested account
  decision,
  reason = '',
}) {
  if (!brandUid || !platform || !handle) throw new Error('Missing brand, platform, or handle.');
  if (!['approve', 'reject', 'dispute'].includes(decision)) {
    throw new Error('Invalid decision.');
  }

  const ref = doc(db, 'brand_verifications', brandUid);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error('Brand verification not found.');

  const base = snap.data();
  const accounts = { ...(base.accounts || {}) };
  
  // Normalize platform data to map format
  const platformAccounts = accounts[platform] || {};
  let normalizedPlatformAccounts = platformAccounts;
  if (platformAccounts.platform || platformAccounts.handle) {
    normalizedPlatformAccounts = { [platformAccounts.handle || platformAccounts.platform]: platformAccounts };
  }

  // Find the specific account by handle (case insensitive)
  const accountKey = Object.keys(normalizedPlatformAccounts).find(
    (k) => k.toLowerCase() === handle.toLowerCase()
  );
  
  if (!accountKey) throw new Error(`Account ${handle} not found on ${platform}.`);
  
  const current = normalizedPlatformAccounts[accountKey];

  const next = {
    ...current,
    platform,
    status:
      decision === 'approve'
        ? 'verified'
        : decision === 'reject'
        ? 'rejected'
        : 'disputed',
    pendingCode: null, // 🔑 Clear the code
    decidedAt: serverTimestamp(),
    decidedBy: auth.currentUser?.uid || null,
    rejectionReason: decision === 'reject' ? reason.trim() : null,
    disputeReason: decision === 'dispute' ? reason.trim() : null,
  };

  normalizedPlatformAccounts[accountKey] = next;
  accounts[platform] = normalizedPlatformAccounts;

  const overallStatus = computeBrandOverall({
    owner: base.owner || {},
    accounts,
  });

  await updateDoc(ref, {
    accounts,
    overallStatus,
    updatedAt: serverTimestamp(),
  });

  await logBrandDecision({
    brandUid,
    level: 'social',
    platform,
    decision,
    reason,
  });

  if (decision === 'approve' && base.publicSlug) {
    await refreshPublicBrandMirror(brandUid).catch(() => {});
  }

  return { ok: true, account: next, overallStatus };
}

// ============================================================
// HELPERS
// ============================================================
function computeBrandOverall({ owner, accounts }) {
  const ownerOk = owner?.status === 'verified';
  const flatAccounts = getFlattenedAccounts(accounts);
  const socialVerified = flatAccounts.filter(
    (a) => a?.status === 'verified'
  ).length;

  if (ownerOk && socialVerified >= 1) return 'fully_verified';
  if (ownerOk) return 'owner_verified';
  return 'unverified';
}

async function logBrandDecision({
  brandUid,
  level,
  platform = null,
  decision,
  reason = '',
  adminNote = '',
}) {
  try {
    await addDoc(collection(db, 'brand_verification_log'), {
      brandUid,
      level,
      platform,
      result: decision,
      reason: reason || null,
      adminNote: adminNote || null,
      actorUid: auth.currentUser?.uid || null,
      actorName: auth.currentUser?.displayName || null,
      createdAt: serverTimestamp(),
    });
  } catch (err) {
    console.warn('Could not log brand decision:', err.code);
  }

  try {
    await addDoc(collection(db, 'admin_audit_log'), {
      action:
        decision === 'approve'
          ? level === 'owner'
            ? 'approve_brand_owner'
            : 'approve_brand_social'
          : decision === 'reject'
          ? level === 'owner'
            ? 'reject_brand_owner'
            : 'reject_brand_social'
          : 'dispute_brand_social',
      actorUid: auth.currentUser?.uid || null,
      actorName: auth.currentUser?.displayName || 'Admin',
      details: { brandUid, level, platform, reason },
      timestamp: serverTimestamp(),
    });
  } catch (err) {
    console.warn('Could not write audit log:', err.code);
  }
}

async function refreshPublicBrandMirror(brandUid) {
  const snap = await getDoc(doc(db, 'brand_verifications', brandUid));
  if (!snap.exists()) return;
  const base = snap.data();
  const slug = base.publicSlug;
  if (!slug) return;

  const owner = base.owner || {};
  const flatAccounts = getFlattenedAccounts(base.accounts);

  const publicAccounts = flatAccounts
    .filter((a) => a?.status === 'verified')
    .map((a) => ({
      platform: a.platform,
      handle: a.handle || null,
      url: a.url || null,
    }));

  const publicProfile = base.publicProfile || {};

  await updateDoc(doc(db, 'public_brand_profiles', slug), {
    ownerVerified: owner.status === 'verified',
    ownerName:
      publicProfile.showOwnerName !== false ? owner.legalName || null : null,
    accounts: publicAccounts,
    updatedAt: serverTimestamp(),
  }).catch(() => {});
}