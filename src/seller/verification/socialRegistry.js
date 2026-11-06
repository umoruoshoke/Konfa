// src/seller/verification/socialRegistry.js
// ============================================================
// Unique handle registry.
//
// Firestore has no native unique constraint, so we create a
// collection where the DOCUMENT ID is the platform + handle.
// Since doc IDs must be unique, only one seller can ever claim
// a given handle.
//
// Two people clicking "verify" at the same moment can't both
// succeed because we run the claim inside a Firestore transaction.
// ============================================================

import {
  doc,
  getDoc,
  runTransaction,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../../firebase';

// ------------------------------------------------------------
// Normalize a handle so that all of these collapse to the same
// registry key:
//   @NathanielBassey
//   nathanielbassey
//   https://instagram.com/nathanielbassey
//   https://www.instagram.com/nathanielbassey/
//   instagram.com/nathanielbassey
// ------------------------------------------------------------
export function normalizeHandle(platform, rawHandle) {
  if (!rawHandle) return null;

  let handle = String(rawHandle).trim().toLowerCase();

  // Strip any URL prefix
  handle = handle
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .replace(/^(instagram|tiktok|youtube|facebook|twitter|x)\.com\//, '')
    .replace(/\/+$/, '');

  // Strip a leading @
  handle = handle.replace(/^@/, '');

  // Strip trailing query strings
  handle = handle.split('?')[0];

  // For subdomains/paths, keep only the first segment
  handle = handle.split('/')[0];

  // Remove anything that isn't a-z, 0-9, dot, underscore, hyphen
  handle = handle.replace(/[^a-z0-9._-]/g, '');

  return handle || null;
}

export function registryKey(platform, rawHandle) {
  const normalized = normalizeHandle(platform, rawHandle);
  if (!normalized) return null;
  return `${platform}:${normalized}`;
}

// ============================================================
// Try to claim a handle for the given seller.
//
// Returns:
//   { ok: true,  key }                            — claimed (or was already yours)
//   { ok: false, reason: 'taken',   ownerUid }    — someone else has it
//   { ok: false, reason: 'invalid' }              — handle couldn't be parsed
// ============================================================
export async function claimSocialHandle({ platform, handle, sellerUid }) {
  const key = registryKey(platform, handle);
  if (!key || !sellerUid) {
    return { ok: false, reason: 'invalid' };
  }

  const ref = doc(db, 'social_handle_registry', key);

  try {
    const result = await runTransaction(db, async (tx) => {
      const snap = await tx.get(ref);

      if (snap.exists()) {
        const ownerUid = snap.data().ownerUid;
        if (ownerUid === sellerUid) {
          return { ok: true, key, alreadyOwned: true };
        }
        return { ok: false, reason: 'taken', ownerUid, key };
      }

      tx.set(ref, {
        platform,
        handle: normalizeHandle(platform, handle),
        ownerUid: sellerUid,
        claimedAt: serverTimestamp(),
      });

      return { ok: true, key };
    });

    return result;
  } catch (err) {
    console.error('claimSocialHandle failed:', err.code, err.message);
    return { ok: false, reason: 'error', message: err.message };
  }
}

// ============================================================
// Check whether a handle is available, without claiming it.
// Used for live validation on the UI.
//
// Returns:
//   'available'  — nobody owns it
//   'yours'      — this seller already owns it
//   'taken'      — someone else owns it
// ============================================================
export async function checkHandleAvailability({ platform, handle, sellerUid }) {
  const key = registryKey(platform, handle);
  if (!key) return 'invalid';

  try {
    const snap = await getDoc(doc(db, 'social_handle_registry', key));
    if (!snap.exists()) return 'available';
    const ownerUid = snap.data().ownerUid;
    return ownerUid === sellerUid ? 'yours' : 'taken';
  } catch (err) {
    console.warn('checkHandleAvailability failed:', err.code);
    return 'error';
  }
}