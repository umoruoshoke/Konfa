// src/utils/cases.js
// ============================================================
// Case lifecycle for anti-counterfeit enforcement.
//
// A case is opened whenever a scan produces a hard violation:
//   - DUPLICATE_CODE             — different device, different city,
//                                  time delta impossible, no legitimate
//                                  transfer in between
//   - IMPOSSIBLE_TRAVEL          — same unit, two cities, faster than
//                                  any commercial flight
//   - DEVICE_BINDING_VIOLATION   — second device claims a unit that
//                                  was already claimed
//
// Cases are written to:
//   cases/{caseId}
//
// Admins see them in the console. Brands are notified by polling
// the collection (a Cloud Function can forward to email later).
//
// The case doc is immutable except for status updates.
// ============================================================

import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';

/**
 * Open a new case.
 *
 * @param {object} opts
 *   type            — 'DUPLICATE_CODE' | 'IMPOSSIBLE_TRAVEL' | 'DEVICE_BINDING_VIOLATION'
 *   severity        — 'critical' | 'high' | 'medium'
 *   unitId          — required
 *   referenceCode   — consumer-facing code of the unit
 *   manufacturerId  — resolved upstream (may be null)
 *   productName     — may be null
 *   batchCode       — may be null
 *   signals         — array of { code, label, severity }
 *   firstClaim      — { deviceId, claimedAt, claimedCity, claimedFrom }
 *   currentScan     — { deviceId, scanAt, scanCity, scanCoords }
 *   distanceKm      — number | null
 *   minutesElapsed  — number | null
 *   evidence        — { deviceId, coordinates, userAgent, timezone }
 *
 * @returns {{ ok: boolean, caseId?: string, error?: string }}
 */
export async function openCase({
  type,
  severity = 'high',
  unitId,
  referenceCode = null,
  manufacturerId = null,
  productName = null,
  batchCode = null,
  signals = [],
  firstClaim = null,
  currentScan = null,
  distanceKm = null,
  minutesElapsed = null,
  evidence = {},
}) {
  if (!unitId || !type) {
    return { ok: false, error: 'Missing required case fields.' };
  }

  try {
    const ref = await addDoc(collection(db, 'cases'), {
      type,
      severity,
      unitId,
      referenceCode,
      manufacturerId,
      productName,
      batchCode,

      signals: Array.isArray(signals) ? signals : [],

      firstClaim: firstClaim || null,
      currentScan: currentScan || null,

      distanceKm,
      minutesElapsed,

      evidence: evidence || {},

      status: 'opened',        // opened | investigating | confirmed_counterfeit | false_positive
      openedAt: serverTimestamp(),
      openedAtIso: new Date().toISOString(),

      reviewedAt: null,
      reviewedBy: null,
      reviewedByName: null,
      resolutionNote: null,

      notes: [],
    });

    return { ok: true, caseId: ref.id };
  } catch (err) {
    console.error('openCase failed:', err.code, err.message);
    return { ok: false, error: err.message };
  }
}

/**
 * Idempotency helper: returns true if a case with the same
 * (unitId, type, firstDeviceId, currentDeviceId) has been opened
 * within the last N hours. Prevents the same attacker from
 * flooding the cases collection with duplicates.
 *
 * Optional — used if you want to gate case creation.
 */
export function shouldSuppressRepeatCase() {
  // Placeholder for future rate limiting. Currently a no-op.
  return false;
}