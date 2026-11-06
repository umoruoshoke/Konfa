// src/admin/adminVerificationApi.js
import {
  collection,
  query,
  getDocs,
  doc,
  getDoc,
  updateDoc,
  addDoc,
  serverTimestamp,
  orderBy,
  limit,
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
// READ — grouped by seller, pending items only
// ============================================================
export async function fetchGroupedPendingVerifications() {
  const snap = await getDocs(
    query(
      collection(db, 'seller_verifications'),
      orderBy('updatedAt', 'desc'),
      limit(300)
    )
  );

  const now = Date.now();
  const groups = [];

  for (const docSnap of snap.docs) {
    const data = docSnap.data();
    const owner = data.owner || {};
    const business = data.business || {};
    const flatAccounts = getFlattenedAccounts(data.accounts);

    let ownerPending = owner.status === 'pending' ? 1 : 0;
    let businessPending = business.status === 'pending' ? 1 : 0;
    let socialPending = 0;

    for (const acc of flatAccounts) {
      if (acc?.status === 'pending') socialPending += 1;
    }

    const totalPending = ownerPending + businessPending + socialPending;
    if (totalPending === 0) continue;

    const timestamps = [];
    if (ownerPending && owner.submittedAt) {
      const ms = toMs(owner.submittedAt);
      if (ms != null) timestamps.push(ms);
    }
    if (businessPending && business.submittedAt) {
      const ms = toMs(business.submittedAt);
      if (ms != null) timestamps.push(ms);
    }
    for (const acc of flatAccounts) {
      if (acc?.status === 'pending' && acc.codeIssuedAt) {
        const ms = toMs(acc.codeIssuedAt);
        if (ms != null) timestamps.push(ms);
      }
    }

    const oldestMs = timestamps.length ? Math.min(...timestamps) : null;
    const oldestAgeMs = oldestMs != null ? now - oldestMs : null;
    const oldestAgeLabel =
      oldestAgeMs != null
        ? formatAge(Math.round(oldestAgeMs / 60000))
        : 'unknown';

    const lastUpdatedMs = toMs(data.updatedAt);

    groups.push({
      sellerUid: data.sellerUid || docSnap.id,
      sellerEmail: data.sellerEmail || null,
      sellerDisplayName: data.sellerDisplayName || null,
      publicSlug: data.publicSlug || null,
      owner,
      business,
      accounts: data.accounts || {}, 
      pendingByKind: {
        owner: ownerPending,
        business: businessPending,
        social: socialPending,
      },
      totalPending,
      oldestAgeMs,
      oldestAgeLabel,
      lastUpdatedAt: lastUpdatedMs,
    });
  }

  groups.sort((a, b) => {
    const at = a.oldestAgeMs ?? -Infinity;
    const bt = b.oldestAgeMs ?? -Infinity;
    return bt - at;
  });

  return groups;
}

// ============================================================
// READ — verified sellers directory
// ============================================================
export async function fetchVerifiedSellers() {
  const snap = await getDocs(
    query(
      collection(db, 'seller_verifications'),
      orderBy('updatedAt', 'desc'),
      limit(500)
    )
  );

  const out = [];

  for (const docSnap of snap.docs) {
    const data = docSnap.data();
    const owner = data.owner || {};
    const business = data.business || {};
    const flatAccounts = getFlattenedAccounts(data.accounts);

    const ownerVerified = owner.status === 'verified';
    const businessVerified = business.status === 'verified';
    const verifiedAccounts = flatAccounts.filter(
      (a) => a.status === 'verified'
    );

    if (!ownerVerified && !businessVerified && verifiedAccounts.length === 0) {
      continue;
    }

    const verificationMs = [];
    if (ownerVerified && owner.verifiedAt) {
      const ms = toMs(owner.verifiedAt);
      if (ms != null) verificationMs.push(ms);
    }
    if (businessVerified && business.verifiedAt) {
      const ms = toMs(business.verifiedAt);
      if (ms != null) verificationMs.push(ms);
    }
    for (const acc of verifiedAccounts) {
      if (acc.verifiedAt) {
        const ms = toMs(acc.verifiedAt);
        if (ms != null) verificationMs.push(ms);
      }
    }

    const firstVerifiedMs = verificationMs.length
      ? Math.min(...verificationMs)
      : null;
    const lastVerifiedMs = verificationMs.length
      ? Math.max(...verificationMs)
      : null;

    out.push({
      sellerUid: data.sellerUid || docSnap.id,
      sellerEmail: data.sellerEmail || null,
      sellerDisplayName: data.sellerDisplayName || null,
      publicSlug: data.publicSlug || null,
      overallStatus: data.overallStatus || 'unverified',
      owner,
      business,
      accounts: data.accounts || {},
      publicProfile: data.publicProfile || null,
      createdAt: toMs(data.createdAt),
      updatedAt: toMs(data.updatedAt),
      firstVerifiedMs,
      lastVerifiedMs,
      verifiedLevels: {
        owner: ownerVerified,
        business: businessVerified,
        social: verifiedAccounts.length,
      },
      totalVerified:
        (ownerVerified ? 1 : 0) +
        (businessVerified ? 1 : 0) +
        verifiedAccounts.length,
    });
  }

  out.sort((a, b) => {
    const at = a.lastVerifiedMs ?? 0;
    const bt = b.lastVerifiedMs ?? 0;
    return bt - at;
  });

  return out;
}

// ============================================================
// ACTIONS — Owner
// ============================================================
export async function approveOwnerVerification({ sellerUid, note = '' }) {
  if (!auth.currentUser) throw new Error('Not signed in.');
  const adminUid = auth.currentUser.uid;

  const ref = doc(db, 'seller_verifications', sellerUid);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error('Verification doc not found.');

  const data = snap.data();
  if (!data.owner) throw new Error('No owner submission to approve.');

  const owner = {
    ...data.owner,
    status: 'verified',
    verifiedAt: serverTimestamp(),
    verifiedBy: `admin:${adminUid}`,
    rejectionReason: null,
    revokedAt: null,
    revokedBy: null,
    revokeReason: null,
    adminNote: note || null,
  };

  await updateDoc(ref, {
    owner,
    overallStatus: computeOverall({
      owner,
      business: data.business,
      accounts: data.accounts,
    }),
    updatedAt: serverTimestamp(),
  });

  await logAdminAction({
    action: 'approve_owner',
    targetSellerUid: sellerUid,
    platform: 'owner',
    note,
  });

  return { success: true };
}

export async function rejectOwnerVerification({ sellerUid, reason = '' }) {
  if (!auth.currentUser) throw new Error('Not signed in.');
  const adminUid = auth.currentUser.uid;

  const ref = doc(db, 'seller_verifications', sellerUid);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error('Verification doc not found.');

  const data = snap.data();
  if (!data.owner) throw new Error('No owner submission to reject.');

  const owner = {
    ...data.owner,
    status: 'rejected',
    rejectedAt: serverTimestamp(),
    rejectedBy: `admin:${adminUid}`,
    rejectionReason:
      reason || 'Rejected by admin — please review and resubmit.',
  };

  await updateDoc(ref, {
    owner,
    overallStatus: computeOverall({
      owner,
      business: data.business,
      accounts: data.accounts,
    }),
    updatedAt: serverTimestamp(),
  });

  await logAdminAction({
    action: 'reject_owner',
    targetSellerUid: sellerUid,
    platform: 'owner',
    note: reason,
  });

  return { success: true };
}

export async function revokeOwnerVerification({ sellerUid, reason = '' }) {
  if (!auth.currentUser) throw new Error('Not signed in.');
  const adminUid = auth.currentUser.uid;

  if (!reason || reason.trim().length < 5) {
    throw new Error('A reason of at least 5 characters is required to revoke.');
  }

  const ref = doc(db, 'seller_verifications', sellerUid);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error('Verification doc not found.');

  const data = snap.data();
  if (!data.owner) throw new Error('No owner submission to revoke.');
  if (data.owner.status !== 'verified') {
    throw new Error('Only approved owner verifications can be revoked.');
  }

  const owner = {
    ...data.owner,
    status: 'revoked',
    revokedAt: serverTimestamp(),
    revokedBy: `admin:${adminUid}`,
    revokeReason: reason.trim(),
  };

  await updateDoc(ref, {
    owner,
    overallStatus: computeOverall({
      owner,
      business: data.business,
      accounts: data.accounts,
    }),
    updatedAt: serverTimestamp(),
  });

  await logAdminAction({
    action: 'revoke_owner',
    targetSellerUid: sellerUid,
    platform: 'owner',
    note: reason.trim(),
  });

  return { success: true };
}

// ============================================================
// ACTIONS — Business
// ============================================================
export async function approveBusinessVerification({ sellerUid, note = '' }) {
  if (!auth.currentUser) throw new Error('Not signed in.');
  const adminUid = auth.currentUser.uid;

  const ref = doc(db, 'seller_verifications', sellerUid);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error('Verification doc not found.');

  const data = snap.data();
  if (!data.business) throw new Error('No business submission to approve.');

  const business = {
    ...data.business,
    status: 'verified',
    verifiedAt: serverTimestamp(),
    verifiedBy: `admin:${adminUid}`,
    rejectionReason: null,
    revokedAt: null,
    revokedBy: null,
    revokeReason: null,
    adminNote: note || null,
  };

  await updateDoc(ref, {
    business,
    overallStatus: computeOverall({
      owner: data.owner,
      business,
      accounts: data.accounts,
    }),
    updatedAt: serverTimestamp(),
  });

  await logAdminAction({
    action: 'approve_business',
    targetSellerUid: sellerUid,
    platform: 'business',
    note,
  });

  return { success: true };
}

export async function rejectBusinessVerification({ sellerUid, reason = '' }) {
  if (!auth.currentUser) throw new Error('Not signed in.');
  const adminUid = auth.currentUser.uid;

  const ref = doc(db, 'seller_verifications', sellerUid);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error('Verification doc not found.');

  const data = snap.data();
  if (!data.business) throw new Error('No business submission to reject.');

  const business = {
    ...data.business,
    status: 'rejected',
    rejectedAt: serverTimestamp(),
    rejectedBy: `admin:${adminUid}`,
    rejectionReason:
      reason || 'Rejected by admin — please review and resubmit.',
  };

  await updateDoc(ref, {
    business,
    overallStatus: computeOverall({
      owner: data.owner,
      business,
      accounts: data.accounts,
    }),
    updatedAt: serverTimestamp(),
  });

  await logAdminAction({
    action: 'reject_business',
    targetSellerUid: sellerUid,
    platform: 'business',
    note: reason,
  });

  return { success: true };
}

export async function revokeBusinessVerification({ sellerUid, reason = '' }) {
  if (!auth.currentUser) throw new Error('Not signed in.');
  const adminUid = auth.currentUser.uid;

  if (!reason || reason.trim().length < 5) {
    throw new Error('A reason of at least 5 characters is required to revoke.');
  }

  const ref = doc(db, 'seller_verifications', sellerUid);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error('Verification doc not found.');

  const data = snap.data();
  if (!data.business) throw new Error('No business submission to revoke.');
  if (data.business.status !== 'verified') {
    throw new Error('Only approved business verifications can be revoked.');
  }

  const business = {
    ...data.business,
    status: 'revoked',
    revokedAt: serverTimestamp(),
    revokedBy: `admin:${adminUid}`,
    revokeReason: reason.trim(),
  };

  await updateDoc(ref, {
    business,
    overallStatus: computeOverall({
      owner: data.owner,
      business,
      accounts: data.accounts,
    }),
    updatedAt: serverTimestamp(),
  });

  await logAdminAction({
    action: 'revoke_business',
    targetSellerUid: sellerUid,
    platform: 'business',
    note: reason.trim(),
  });

  return { success: true };
}

// ============================================================
// ACTIONS — Social
// ============================================================
export async function approveVerification({ sellerUid, platform, handle, note = '' }) {
  if (!auth.currentUser) throw new Error('Not signed in.');
  const adminUid = auth.currentUser.uid;

  const ref = doc(db, 'seller_verifications', sellerUid);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error('Verification doc not found.');

  const data = snap.data();
  const accounts = { ...(data.accounts || {}) };
  const platformAccounts = accounts[platform] || {};
  
  let normalizedPlatformAccounts = platformAccounts;
  if (platformAccounts.platform || platformAccounts.handle) {
    normalizedPlatformAccounts = { [platformAccounts.handle || platformAccounts.platform]: platformAccounts };
  }

  const accountKey = Object.keys(normalizedPlatformAccounts).find(
    (k) => k.toLowerCase() === handle.toLowerCase()
  );
  if (!accountKey) throw new Error(`Account ${handle} not found.`);

  normalizedPlatformAccounts[accountKey] = {
    ...normalizedPlatformAccounts[accountKey],
    status: 'verified',
    pendingCode: null,
    verifiedAt: serverTimestamp(),
    verifiedBy: `admin:${adminUid}`,
    method: 'admin_manual',
    lastCheckAt: serverTimestamp(),
    lastCheckError: note || null,
    revokedAt: null,
    revokedBy: null,
    revokeReason: null,
  };

  accounts[platform] = normalizedPlatformAccounts;

  await updateDoc(ref, {
    accounts,
    overallStatus: computeOverall({
      owner: data.owner,
      business: data.business,
      accounts,
    }),
    updatedAt: serverTimestamp(),
  });

  await logAdminAction({
    action: 'approve',
    targetSellerUid: sellerUid,
    platform,
    note,
  });

  return { success: true };
}

export async function rejectVerification({ sellerUid, platform, handle, reason = '' }) {
  if (!auth.currentUser) throw new Error('Not signed in.');
  const adminUid = auth.currentUser.uid;

  const ref = doc(db, 'seller_verifications', sellerUid);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error('Verification doc not found.');

  const data = snap.data();
  const accounts = { ...(data.accounts || {}) };
  const platformAccounts = accounts[platform] || {};
  
  let normalizedPlatformAccounts = platformAccounts;
  if (platformAccounts.platform || platformAccounts.handle) {
    normalizedPlatformAccounts = { [platformAccounts.handle || platformAccounts.platform]: platformAccounts };
  }

  const accountKey = Object.keys(normalizedPlatformAccounts).find(
    (k) => k.toLowerCase() === handle.toLowerCase()
  );
  if (!accountKey) throw new Error(`Account ${handle} not found.`);

  normalizedPlatformAccounts[accountKey] = {
    ...normalizedPlatformAccounts[accountKey],
    status: 'unverified',
    pendingCode: null,
    codeIssuedAt: null,
    lastCheckAt: serverTimestamp(),
    lastCheckError: reason || 'Rejected by admin — please try again.',
  };

  accounts[platform] = normalizedPlatformAccounts;

  await updateDoc(ref, {
    accounts,
    overallStatus: computeOverall({
      owner: data.owner,
      business: data.business,
      accounts,
    }),
    updatedAt: serverTimestamp(),
  });

  await logAdminAction({
    action: 'reject',
    targetSellerUid: sellerUid,
    platform,
    note: reason,
  });

  return { success: true };
}

export async function disputeVerification({ sellerUid, platform, handle, reason = '' }) {
  if (!auth.currentUser) throw new Error('Not signed in.');
  const adminUid = auth.currentUser.uid;

  const ref = doc(db, 'seller_verifications', sellerUid);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error('Verification doc not found.');

  const data = snap.data();
  const accounts = { ...(data.accounts || {}) };
  const platformAccounts = accounts[platform] || {};
  
  let normalizedPlatformAccounts = platformAccounts;
  if (platformAccounts.platform || platformAccounts.handle) {
    normalizedPlatformAccounts = { [platformAccounts.handle || platformAccounts.platform]: platformAccounts };
  }

  const accountKey = Object.keys(normalizedPlatformAccounts).find(
    (k) => k.toLowerCase() === handle.toLowerCase()
  );
  if (!accountKey) throw new Error(`Account ${handle} not found.`);

  normalizedPlatformAccounts[accountKey] = {
    ...normalizedPlatformAccounts[accountKey],
    status: 'disputed',
    pendingCode: null,
    disputedAt: serverTimestamp(),
    disputedBy: `admin:${adminUid}`,
    lastCheckError: reason || 'Marked as disputed by admin.',
  };

  accounts[platform] = normalizedPlatformAccounts;

  await updateDoc(ref, {
    accounts,
    overallStatus: computeOverall({
      owner: data.owner,
      business: data.business,
      accounts,
    }),
    updatedAt: serverTimestamp(),
  });

  await logAdminAction({
    action: 'dispute',
    targetSellerUid: sellerUid,
    platform,
    note: reason,
  });

  return { success: true };
}

export async function revokeVerification({ sellerUid, platform, handle, reason = '' }) {
  if (!auth.currentUser) throw new Error('Not signed in.');
  const adminUid = auth.currentUser.uid;

  if (!reason || reason.trim().length < 5) {
    throw new Error('A reason of at least 5 characters is required to revoke.');
  }

  const ref = doc(db, 'seller_verifications', sellerUid);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error('Verification doc not found.');

  const data = snap.data();
  const accounts = { ...(data.accounts || {}) };
  const platformAccounts = accounts[platform] || {};
  
  let normalizedPlatformAccounts = platformAccounts;
  if (platformAccounts.platform || platformAccounts.handle) {
    normalizedPlatformAccounts = { [platformAccounts.handle || platformAccounts.platform]: platformAccounts };
  }

  const accountKey = Object.keys(normalizedPlatformAccounts).find(
    (k) => k.toLowerCase() === handle.toLowerCase()
  );
  if (!accountKey) throw new Error(`Account ${handle} not found.`);
  
  if (normalizedPlatformAccounts[accountKey].status !== 'verified') {
    throw new Error('Only approved accounts can be revoked.');
  }

  normalizedPlatformAccounts[accountKey] = {
    ...normalizedPlatformAccounts[accountKey],
    status: 'revoked',
    revokedAt: serverTimestamp(),
    revokedBy: `admin:${adminUid}`,
    revokeReason: reason.trim(),
  };

  accounts[platform] = normalizedPlatformAccounts;

  await updateDoc(ref, {
    accounts,
    overallStatus: computeOverall({
      owner: data.owner,
      business: data.business,
      accounts,
    }),
    updatedAt: serverTimestamp(),
  });

  await logAdminAction({
    action: 'revoke',
    targetSellerUid: sellerUid,
    platform,
    note: reason.trim(),
  });

  return { success: true };
}

// ============================================================
// LEGACY — single-row flat fetch
// ============================================================
export async function fetchPendingVerifications() {
  const snap = await getDocs(
    query(
      collection(db, 'seller_verifications'),
      orderBy('updatedAt', 'desc'),
      limit(200)
    )
  );
  const out = [];
  const now = Date.now();
  for (const d of snap.docs) {
    const data = d.data();
    const flatAccounts = getFlattenedAccounts(data.accounts);
    
    for (const acc of flatAccounts) {
      if (!acc || acc.status !== 'pending') continue;
      const ms = toMs(acc.codeIssuedAt);
      const mins =
        ms != null ? Math.max(0, Math.round((now - ms) / 60000)) : null;
      out.push({
        sellerUid: data.sellerUid || d.id,
        sellerEmail: data.sellerEmail || null,
        sellerDisplayName: data.sellerDisplayName || null,
        platform: acc.platform,
        handle: acc.handle || '',
        url: acc.url || '',
        code: acc.pendingCode || null,
        codeIssuedAt: acc.codeIssuedAt || null,
        codeIssuedAtMs: ms,
        minutesSinceIssued: mins,
        ageLabel: mins != null ? formatAge(mins) : 'unknown',
        lastCheckAt: acc.lastCheckAt || null,
        lastCheckError: acc.lastCheckError || null,
        docId: d.id,
      });
    }
  }
  return out;
}

// ============================================================
// HELPERS
// ============================================================
async function logAdminAction({ action, targetSellerUid, platform, note }) {
  try {
    await addDoc(collection(db, 'admin_verification_actions'), {
      adminUid: auth.currentUser.uid,
      action,
      targetSellerUid,
      platform: platform || null,
      note: note || null,
      createdAt: serverTimestamp(),
    });
  } catch (err) {
    console.warn('Could not log admin verification action:', err.code);
  }
}

export async function logAdminReveal({ sellerUid, field }) {
  if (!auth.currentUser) return;
  if (!sellerUid || !field) return;

  try {
    await addDoc(collection(db, 'admin_verification_actions'), {
      adminUid: auth.currentUser.uid,
      action: 'reveal_sensitive_field',
      targetSellerUid: sellerUid,
      platform: field,
      note: null,
      createdAt: serverTimestamp(),
    });
  } catch (err) {
    console.warn('Could not log admin reveal:', err.code);
  }
}

function toMs(ts) {
  if (!ts) return null;
  try {
    if (typeof ts.toDate === 'function') return ts.toDate().getTime();
    if (ts instanceof Date) return ts.getTime();
    if (typeof ts === 'number') return ts;
    if (typeof ts === 'string') return new Date(ts).getTime();
  } catch {
    /* ignore */
  }
  return null;
}

function formatAge(minutes) {
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? '' : 's'}`;
}

export function computeOverall({ owner, business, accounts }) {
  const ownerOk = owner?.status === 'verified';
  const bizOk = business?.status === 'verified';
  const flatAccounts = getFlattenedAccounts(accounts);
  const socialVerified = flatAccounts.filter(
    (a) => a.status === 'verified'
  ).length;

  if (ownerOk && bizOk && socialVerified >= 1) return 'fully_verified';
  if (ownerOk && (bizOk || socialVerified >= 1)) return 'partially_verified';
  if (ownerOk) return 'owner_verified';
  return 'unverified';
}