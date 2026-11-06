// src/utils/unitClaims.js
// ============================================================
// First-consumer claim logic.
//
// When a unit is successfully verified for the first time, we
// record which device claimed it. Any subsequent verification
// from a DIFFERENT device returns a rich comparison object that
// the caller (verifyApi.js) uses to decide whether this is a
// soft re-scan or a hard duplicate-code case.
//
// The claim document is intentionally simple and immutable:
//   unit_claims/{unitId}
//     ├── unitId           — denormalized for convenience
//     ├── consumerReferenceCode
//     ├── deviceId         — from getDeviceFingerprint()
//     ├── claimedAt        — server timestamp
//     ├── claimedFrom      — { lat, lng, accuracy } or null
//     └── claimedCity      — { city, state } or null
//
// 🆕 Location patching:
//   If the first scan had no GPS (cache miss, GPS slow), the claim
//   may be written with claimedFrom: null. verifyApi.js schedules a
//   background patch that writes firstClaimLat/firstClaimLng once
//   slow GPS arrives, so subsequent duplicate detection still works.
// ============================================================

import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';

export async function recordFirstClaim({
  unitId,
  deviceId,
  coords = null,
  city = null,
  consumerRefCode = null,
  currentScan = null,
}) {
  if (!unitId || !deviceId) {
    return { status: 'skipped' };
  }

  const claimRef = doc(db, 'unit_claims', unitId);

  try {
    const existing = await getDoc(claimRef);

    // ---- 1. Nobody has claimed it yet — write the claim ----
    if (!existing.exists()) {
      try {
        await setDoc(claimRef, {
          unitId,
          consumerReferenceCode: consumerRefCode || null,
          deviceId,
          claimedAt: serverTimestamp(),
          claimedFrom: coords || null,
          claimedCity: city || null,
          // 🆕 Flattened fields for the background patch
          firstClaimLat: coords?.lat ?? null,
          firstClaimLng: coords?.lng ?? null,
          firstClaimAccuracy: coords?.accuracy ?? null,
          firstClaimSource: coords?.source ?? (coords ? 'gps_passed' : 'unknown'),
        });
        return {
          status: 'new_claim',
          claimId: unitId,
          firstDeviceId: deviceId,
        };
      } catch (err) {
        // Race condition: two devices claimed simultaneously.
        console.warn('unitClaims: setDoc failed, re-reading:', err.code);
        const second = await getDoc(claimRef);
        if (!second.exists()) {
          return { status: 'error', errorMessage: err.message };
        }
        return compareClaim(second.data(), deviceId, currentScan);
      }
    }

    // ---- 2. Someone has claimed it — build a rich comparison ----
    return compareClaim(existing.data(), deviceId, currentScan);
  } catch (err) {
    console.error('unitClaims: unexpected error:', err.code, err.message);
    return { status: 'error', errorMessage: err.message };
  }
}

function compareClaim(claim, currentDeviceId, currentScan) {
  const claimedAt = toIso(claim.claimedAt);
  const cityLabel = formatCity(claim.claimedCity);
  const firstDeviceId = claim.deviceId || null;
  const sameDevice = firstDeviceId === currentDeviceId;

  // Distance between first claim and current scan, in km.
  // 🆕 Prefer the flattened firstClaimLat/Lng (which the background
  //    patch also updates) if claimedFrom is null.
  const fromLat =
    claim.claimedFrom?.lat ?? claim.firstClaimLat ?? null;
  const fromLng =
    claim.claimedFrom?.lng ?? claim.firstClaimLng ?? null;

  let distanceKm = null;
  if (
    fromLat != null &&
    fromLng != null &&
    currentScan?.lat != null &&
    currentScan?.lng != null
  ) {
    distanceKm = haversineKm(fromLat, fromLng, currentScan.lat, currentScan.lng);
    if (distanceKm != null) {
      distanceKm = Math.round(distanceKm * 10) / 10;
    }
  }

  let minutesSinceClaim = null;
  if (claimedAt) {
    const claimMs = new Date(claimedAt).getTime();
    const nowMs = currentScan?.at
      ? new Date(currentScan.at).getTime()
      : Date.now();
    if (!Number.isNaN(claimMs) && !Number.isNaN(nowMs)) {
      minutesSinceClaim = Math.max(0, Math.round((nowMs - claimMs) / 60000));
    }
  }

  const base = {
    claimedAt,
    claimedCity: cityLabel,
    claimedFrom: claim.claimedFrom || null,
    firstDeviceId,
    currentDeviceId,
    sameDevice,
    distanceKm,
    minutesSinceClaim,
    claimId: claim.unitId || null,
  };

  if (sameDevice) {
    return { status: 'same_device', ...base };
  }

  return { status: 'claimed_elsewhere', ...base };
}

// ------------------------------------------------------------
// Utilities
// ------------------------------------------------------------

const R = 6371; // Earth radius in km

function haversineKm(lat1, lng1, lat2, lng2) {
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

function toIso(value) {
  if (!value) return null;
  try {
    if (typeof value?.toDate === 'function') return value.toDate().toISOString();
    if (value instanceof Date) return value.toISOString();
    return String(value);
  } catch {
    return null;
  }
}

function formatCity(city) {
  if (!city || typeof city !== 'object') return null;
  const { city: c, state: s } = city;
  if (!c) return null;
  return s ? `${c}, ${s}` : c;
}

export function buildClaimSignal(claim) {
  if (!claim || claim.status !== 'claimed_elsewhere') return null;

  const when = claim.claimedAt
    ? new Date(claim.claimedAt).toLocaleDateString([], {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
    : 'a previous date';

  const where = claim.claimedCity ? ` in ${claim.claimedCity}` : '';

  return {
    code: 'claimed_by_other_device',
    label: `This product was first verified on ${when}${where} — from a different device.`,
    severity: 'high',
  };
}