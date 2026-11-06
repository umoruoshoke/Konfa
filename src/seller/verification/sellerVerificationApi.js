// src/seller/verification/sellerVerificationApi.js
import { doc, getDoc, collection, query, where, getDocs, limit } from 'firebase/firestore';
import { db, auth } from '../../firebase';

export const SUPPORTED_PLATFORMS = [
  { key: 'instagram', label: 'Instagram', color: '#E1306C' },
  { key: 'tiktok', label: 'TikTok', color: '#000000' },
  { key: 'youtube', label: 'YouTube', color: '#FF0000' },
  { key: 'facebook', label: 'Facebook', color: '#1877F2' },
  { key: 'x', label: 'X (Twitter)', color: '#000000' },
  { key: 'whatsapp', label: 'WhatsApp', color: '#25D366' },
  { key: 'website', label: 'Website', color: '#0d9488' },
];

export async function fetchMySellerVerification() {
  const uid = auth.currentUser?.uid;
  if (!uid) return null;

  const ref = doc(db, 'seller_verifications', uid);
  const snap = await getDoc(ref);

  if (!snap.exists()) {
    return {
      sellerUid: uid,
      sellerEmail: auth.currentUser?.email || null,
      accounts: {},
      overallStatus: 'unverified',
    };
  }

  return { id: snap.id, ...snap.data() };
}

export async function fetchVerificationBySlug(slug) {
  if (!slug) return null;
  try {
    const snap = await getDocs(
      query(
        collection(db, 'seller_verifications'),
        where('publicSlug', '==', slug),
        limit(1)
      )
    );
    if (snap.empty) return null;
    return { id: snap.docs[0].id, ...snap.docs[0].data() };
  } catch (err) {
    console.warn('fetchVerificationBySlug failed:', err.code);
    return null;
  }
}

export function getFlattenedAccounts(accounts) {
  const flat = [];
  Object.values(accounts || {}).forEach((platformData) => {
    if (!platformData) return;
    if (Array.isArray(platformData)) {
      platformData.forEach((a) => flat.push(a));
    } else if (platformData.platform || platformData.handle) {
      flat.push(platformData);
    } else {
      Object.values(platformData).forEach((a) => flat.push(a));
    }
  });
  return flat;
}

export function computeOverallStatus(accounts) {
  const flat = getFlattenedAccounts(accounts);

  if (flat.length === 0) return 'unverified';
  const verified = flat.filter((a) => a && a.status === 'verified').length;
  if (verified === 0) return 'unverified';
  if (verified === flat.length) return 'verified';
  return 'partially_verified';
}

export function platformMeta(key) {
  return (
    SUPPORTED_PLATFORMS.find((p) => p.key === key) || {
      key,
      label: key,
      color: '#64748b',
      placeholder: '',
      verifyHint: '',
      profileUrlTemplate: null,
    }
  );
}