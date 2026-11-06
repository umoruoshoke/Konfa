// src/Pages/scanEvents.js
// ============================================================
// Logs every product scan to the `scan_events` collection with
// full location, time, device, and impossibility metadata.
// ============================================================

import {
  collection,
  addDoc,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../firebase';
import { nearestCity, assessImpossibleTravel } from './nigeriaCities';

// ============================================================
// GEOLOCATION (with a timeout + manual fallback)
// ============================================================
async function getBrowserLocation(timeoutMs = 6000) {
  if (typeof navigator === 'undefined' || !navigator.geolocation) {
    return null;
  }

  return new Promise((resolve) => {
    let resolved = false;

    const done = (result) => {
      if (resolved) return;
      resolved = true;
      resolve(result);
    };

    const timer = setTimeout(() => done(null), timeoutMs);

    try {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          clearTimeout(timer);
          done({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
            source: 'gps',
          });
        },
        () => {
          clearTimeout(timer);
          done(null);
        },
        {
          enableHighAccuracy: true,
          timeout: timeoutMs,
          maximumAge: 60000, // accept a location up to 1 minute old
        }
      );
    } catch {
      clearTimeout(timer);
      done(null);
    }
  });
}

// ============================================================
// DEVICE FINGERPRINTING (best-effort)
// ============================================================
function getDeviceInfo() {
  if (typeof navigator === 'undefined') {
    return {
      deviceUserAgent: null,
      devicePlatform: null,
      deviceLanguage: null,
      deviceTimezone: null,
    };
  }

  let tz = null;
  try {
    tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    tz = null;
  }

  return {
    deviceUserAgent: navigator.userAgent || null,
    devicePlatform: navigator.platform || null,
    deviceLanguage: navigator.language || null,
    deviceTimezone: tz,
  };
}

// ============================================================
// FETCH PREVIOUS SCANS OF THE SAME UNIT
// ============================================================
async function fetchPreviousScans(unitId, maxCount = 20) {
  if (!unitId) return [];

  try {
    const snap = await getDocs(
      query(
        collection(db, 'scan_events'),
        where('unitId', '==', unitId),
        orderBy('timestamp', 'desc'),
        limit(maxCount)
      )
    );
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  } catch (err) {
    // If the index isn't ready yet, fall back to unsorted
    console.warn('fetchPreviousScans ordered query failed:', err.code);
    try {
      const snap = await getDocs(
        query(
          collection(db, 'scan_events'),
          where('unitId', '==', unitId),
          limit(maxCount)
        )
      );
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      list.sort(
        (a, b) =>
          new Date(b.timestamp || b.scannedAt || 0) -
          new Date(a.timestamp || a.scannedAt || 0)
      );
      return list;
    } catch (err2) {
      console.warn('fetchPreviousScans fallback failed:', err2.code);
      return [];
    }
  }
}

// ============================================================
// MAIN: logScanEvent
// ============================================================
// This is called whenever a scan happens — from the homepage
// QR scanner, from /verify, or from any future scan entry point.
//
// It does the following, in order:
//   1. Captures the device location (GPS, with 6s timeout).
//   2. Reverse-geocodes lat/lng to the nearest Nigerian city.
//   3. Fetches the most recent previous scan for this unit.
//   4. Runs the "impossible travel" check.
//   5. Writes a rich scan_event document to Firestore.
//   6. Returns a summary the caller can use to update the UI.
// ============================================================
export async function logScanEvent({
  unitId,
  consumerReferenceCode,
  scanType,           // 'consumer_scan' | 'seller_scan'
  result,             // 'AUTHENTIC' | 'SUSPICIOUS' | 'INVALID' | etc.
  pinCheckResult,     // 'MATCH' | 'MISMATCH' | 'NOT_ATTEMPTED'
  baseRiskScore = 5,  // caller-provided baseline risk (e.g. 5 for AUTHENTIC)
}) {
  if (!unitId) {
    console.warn('logScanEvent: unitId is required — skipping write');
    return null;
  }

  // ---- 1. Location ----
  const loc = await getBrowserLocation(6000);
  const device = getDeviceInfo();

  let locationLat = null;
  let locationLng = null;
  let locationAccuracy = null;
  let locationSource = 'unknown';

  if (loc) {
    locationLat = loc.lat;
    locationLng = loc.lng;
    locationAccuracy = loc.accuracy;
    locationSource = loc.source;
  }

  // ---- 2. Nearest city ----
  const geo =
    locationLat != null && locationLng != null
      ? nearestCity(locationLat, locationLng)
      : null;

  const locationCity = geo?.city || null;
  const locationState = geo?.state || null;
  const locationRegion = geo
    ? `${geo.city}${geo.state ? `, ${geo.state}` : ''}`
    : null;
  const withinNigeria = geo?.withinNigeria ?? null;

  // ---- 3. Previous scan ----
  const previousScans = await fetchPreviousScans(unitId, 5);
  const previousScan = previousScans[0] || null;

  // ---- 4. Impossible-travel check ----
  const currentForCompare = {
    locationLat,
    locationLng,
    locationCity,
    timestamp: new Date().toISOString(),
  };
  const travelCheck = assessImpossibleTravel(previousScan, currentForCompare);

  // ---- 5. Compute final risk score ----
  // Base score from the caller + travel-check adjustments.
  let riskScore = baseRiskScore;
  let reason = null;

  if (travelCheck.verdict === 'FAST') {
    riskScore = Math.max(riskScore, 60);
    reason = travelCheck.reason;
  } else if (travelCheck.verdict === 'IMPOSSIBLE') {
    riskScore = Math.max(riskScore, 95);
    reason = travelCheck.reason;
  }

  // Additional red flag: previous scan was outside Nigeria entirely
  if (
    previousScan &&
    previousScan.locationLat != null &&
    previousScan.withinNigeria === false &&
    withinNigeria === true
  ) {
    riskScore = Math.max(riskScore, 85);
    reason =
      reason ||
      'This code was previously scanned outside Nigeria and is now being scanned in Nigeria.';
  }

  // Additional red flag: more than 3 scans in the last hour
  const oneHourAgo = Date.now() - 60 * 60 * 1000;
  const recentScanCount = previousScans.filter((s) => {
    const t = new Date(s.timestamp || s.scannedAt || 0).getTime();
    return t >= oneHourAgo;
  }).length;
  if (recentScanCount >= 3) {
    riskScore = Math.max(riskScore, 70);
    reason = reason || `This code has been scanned ${recentScanCount} times in the last hour.`;
  }

  // ---- 6. Build the scan_event doc ----
  const scanEventDoc = {
    // Identity
    unitId,
    consumerReferenceCode: consumerReferenceCode || null,
    scanType: scanType || 'consumer_scan',
    result: result || 'UNKNOWN',
    pinCheckResult: pinCheckResult || 'NOT_ATTEMPTED',

    // Location
    locationLat,
    locationLng,
    locationAccuracy,
    locationCity,
    locationState,
    locationRegion,
    locationSource,
    withinNigeria,

    // Time
    timestamp: new Date().toISOString(),
    scannedAt: serverTimestamp(),

    // Device
    ...device,

    // Previous-scan comparison
    previousScanId: previousScan?.id || null,
    previousScanCity: previousScan?.locationCity || null,
    previousScanRegion: previousScan?.locationRegion || null,
    previousScanTimestamp: previousScan?.timestamp || null,
    previousScanResult: previousScan?.result || null,

    // Impossibility check
    distanceFromPreviousKm: travelCheck.distanceKm || null,
    minutesSincePrevious: travelCheck.minutesElapsed || null,
    requiredSpeedKmh: travelCheck.requiredSpeedKmh || null,
    travelVerdict: travelCheck.verdict || 'OK',
    isPhysicallyImpossible: travelCheck.isImpossible || false,
    impossibilityReason: travelCheck.isImpossible ? travelCheck.reason : null,

    // Risk
    riskScore,
    flagReason: reason,
  };

  // ---- 7. Write ----
  try {
    const ref = await addDoc(collection(db, 'scan_events'), scanEventDoc);
    console.log('📝 scan_event written:', ref.id, {
      city: locationCity,
      verdict: travelCheck.verdict,
      riskScore,
    });
    return {
      id: ref.id,
      ...scanEventDoc,
      travelVerdict: travelCheck.verdict,
      isImpossible: travelCheck.isImpossible,
      reason: travelCheck.reason,
    };
  } catch (err) {
    console.error('Failed to write scan_event:', err.code, err.message);
    return null;
  }
}

// ============================================================
// READ: get most recent scan for a unit
// ============================================================
export async function getMostRecentScan(unitId) {
  if (!unitId) return null;
  const scans = await fetchPreviousScans(unitId, 1);
  return scans[0] || null;
}