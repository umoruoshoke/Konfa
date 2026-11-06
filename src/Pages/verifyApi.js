// src/Pages/verifyApi.js
// Real Firebase-backed verification and reporting logic.
// Mirrors the consumer verification path from the spec:
//   AUTHENTIC | EXPECTED | SUSPICIOUS | NOT_YET_RELEASED | INVALID | DUPLICATE_CODE
//
// 🔒 PRIVACY MODEL:
//   - The MANUFACTURER's name is public (it's on the packaging anyway).
//   - OTHER companies in the movement chain (distributors, retailers,
//     wholesalers) are masked as "Role (Region)" so we don't leak
//     trade identities.
//
// 🛡️  ANTI-COUNTERFEIT HARD RULES:
//   DUPLICATE_CODE fires when ALL of the following are true:
//     1. The unit was previously claimed by a different device
//     2. The current scan is from a different city (>= 30 km away)
//     3. The time delta is too short for physical transport
//     4. No legitimate movement_event (transfer / receive) happened
//        between the first claim and this scan
//
//   When DUPLICATE_CODE fires, a case is opened in `cases/` and the
//   consumer sees a hard block — no product info is disclosed.
//
// 🌍 ANTI-COUNTERFEIT GEOGRAPHY:
//   Every scan is logged with GPS coordinates, nearest city, timestamp,
//   and device info. Impossible travel is detected by comparing against
//   the previous scan of the same unit.
//
// ⚡ SPEED vs ACCURACY:
//   Location lookup is split into TWO phases:
//     - FAST  (≤2.5s): returns cache, IP, or fresh GPS if it locks
//                       quickly. The scan NEVER waits longer than this
//                       before showing the user a verdict.
//     - SLOW  (≤12s):  runs in the background. If real GPS arrives
//                       after the verdict, the scan_event and claim
//                       are patched with accurate coords.
//
//   Result: verdicts show in <500ms when cache is warm, ≤2.5s
//   worst-case, while still capturing accurate GPS in the background.
//
// 📍 LOCATION TIERS (in order of preference):
//   1. Caller-provided coords (highest quality)
//   2. Cached last-good location (≤7 days old, instant)
//   3. Fresh high-accuracy GPS (raced against IP + timer)
//   4. IP-based coarse location (city-level)
//
//   `locationSource` on every scan_event tells you which tier was used.
//
// 📊 CONFIDENCE SCORING:
//   Every result carries a 0–100 confidence score derived from the
//   strength of the evidence.
//
// 🔐 CRYPTO FALLBACK:
//   crypto.subtle is only available in secure contexts. On plain-http
//   dev servers we fall back to the pure-JS js-sha256 package.
//
// 👤 CONSUMER HISTORY:
//   When a signed-in consumer verifies a product, the result is also
//   written to `consumer_scans` — in the background, so it never delays
//   the verdict.

import {
  collection,
  query,
  where,
  getDocs,
  doc,
  getDoc,
  addDoc,
  updateDoc,
  serverTimestamp,
  orderBy,
  limit,
} from 'firebase/firestore';
import { db } from '../firebase';
import { recordFirstClaim, buildClaimSignal } from '../utils/unitClaims';
import { openCase } from '../utils/cases';
import { sha256 as sha256Fallback } from 'js-sha256';
import {
  getCurrentConsumerProfile,
  recordConsumerScan,
} from '../consumer/consumerAuth';

// ============================================================
// HARD-RULE THRESHOLDS
// ============================================================
//   MIN_DISTANCE_FOR_DUPLICATE_KM
//     Below this, treat it as "the same person moving around town".
//     30 km is roughly the width of Lagos — big enough to cover
//     intra-city movement, small enough to catch a different city.
//
//   MAX_MINUTES_FOR_DUPLICATE
//     If more than this elapsed, the product could physically have
//     been moved. 180 minutes (3 hours) is a reasonable upper bound
//     for "same device, moving around" but not for cross-country.
//     We invert: if the time delta is SMALL (< this), it's suspect.
//
//   IMPOSSIBLE_SPEED_KMH
//     Faster than any commercial flight. 900 km/h.
//
const MIN_DISTANCE_FOR_DUPLICATE_KM = 30;
const MAX_MINUTES_FOR_DUPLICATE = 180;
const IMPOSSIBLE_SPEED_KMH = 900;

// ============================================================
// HELPERS
// ============================================================

const normalizeRefCode = (code) =>
  (code || '').toUpperCase().replace(/[^A-Z0-9]/g, '');

const formatRefCode = (code) => {
  const stripped = normalizeRefCode(code);
  return stripped.length === 8
    ? `${stripped.slice(0, 4)}-${stripped.slice(4)}`
    : stripped;
};

function formatDuration(minutes) {
  const m = Math.max(0, Math.round(Number(minutes) || 0));
  if (m < 1) return 'just now';
  if (m < 60) return `${m} minute${m === 1 ? '' : 's'} ago`;
  const hours = Math.floor(m / 60);
  const mins = m % 60;
  if (mins === 0) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  return `${hours} hour${hours === 1 ? '' : 's'} and ${mins} minute${
    mins === 1 ? '' : 's'
  } ago`;
}

function formatDurationShort(minutes) {
  const m = Math.max(0, Math.round(Number(minutes) || 0));
  if (m < 1) return 'under a minute';
  if (m < 60) return `${m} minute${m === 1 ? '' : 's'}`;
  const hours = Math.floor(m / 60);
  const mins = m % 60;
  if (mins === 0) return `${hours} hour${hours === 1 ? '' : 's'}`;
  return `${hours} hour${hours === 1 ? '' : 's'} and ${mins} minute${
    mins === 1 ? '' : 's'
  }`;
}

function emitProgress(onProgress, stage, pct, message) {
  if (typeof onProgress !== 'function') return;
  try {
    onProgress({ stage, pct, message });
  } catch (err) {
    console.warn('onProgress threw:', err);
  }
}

async function sha256Hex(input) {
  if (
    typeof crypto !== 'undefined' &&
    crypto.subtle &&
    typeof crypto.subtle.digest === 'function'
  ) {
    try {
      const enc = new TextEncoder().encode(input);
      const buf = await crypto.subtle.digest('SHA-256', enc);
      return Array.from(new Uint8Array(buf))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
    } catch (err) {
      console.warn(
        'crypto.subtle.digest failed — falling back to js-sha256:',
        err
      );
    }
  }
  return sha256Fallback(input);
}

// ============================================================
// CONFIDENCE SCORING
// ============================================================
const CONFIDENCE_MIN = 5;
const CONFIDENCE_MAX = 99;

function computeConfidence({ base = 95, signals = [], positives = [] } = {}) {
  let score = base;
  const reasons = [];

  const POSITIVE_WEIGHTS = {
    code_matched: 2,
    pin_matched: 2,
    unit_active: 1,
    history_clean: 1,
    first_claim: 2,
  };

  for (const p of positives) {
    if (POSITIVE_WEIGHTS[p]) {
      score += POSITIVE_WEIGHTS[p];
    }
  }

  const SIGNAL_WEIGHTS = {
    claimed_by_other_device: -35,
    impossible_travel: -45,
    fast_travel: -25,
    gps_ip_mismatch: -10,
    too_fast_for_human: -15,
    location_unavailable: -5,
    many_recent_scans: -20,
    pin_consumed: -10,
    pin_already_used: -40,
    far_from_previous_scan: -10,
    batch_under_review: -10,
    batch_quarantined: -30,
    pre_release_scan: -50,
    missing_pin_match: -20,
    code_not_found: -95,
    duplicate_code: -100,
  };

  for (const sig of signals) {
    const code = sig.code || sig;
    const w =
      typeof sig === 'object' && typeof sig.weight === 'number'
        ? sig.weight
        : SIGNAL_WEIGHTS[code] ?? 0;
    score += w;
    if (sig.label) {
      reasons.push(sig.label);
    }
  }

  score = Math.max(CONFIDENCE_MIN, Math.min(CONFIDENCE_MAX, Math.round(score)));

  let label;
  if (score >= 80) label = 'High confidence';
  else if (score >= 50) label = 'Medium confidence';
  else label = 'Low confidence';

  return { score, label, reasons };
}

// ============================================================
// GEOGRAPHY — static Nigerian cities + haversine
// ============================================================
const NIGERIA_CITIES = [
  ['Lagos', 'Lagos', 6.5244, 3.3792],
  ['Ikeja', 'Lagos', 6.6018, 3.3515],
  ['Lekki', 'Lagos', 6.4698, 3.5852],
  ['Ikorodu', 'Lagos', 6.6194, 3.5105],
  ['Badagry', 'Lagos', 6.4315, 2.8876],
  ['Abuja', 'FCT', 9.0765, 7.3986],
  ['Gwagwalada', 'FCT', 8.9414, 7.0776],
  ['Kano', 'Kano', 12.0022, 8.5920],
  ['Wudil', 'Kano', 11.8089, 8.8444],
  ['Kaduna', 'Kaduna', 10.5222, 7.4383],
  ['Zaria', 'Kaduna', 11.0855, 7.7199],
  ['Kafanchan', 'Kaduna', 9.5817, 8.2936],
  ['Port Harcourt', 'Rivers', 4.8156, 7.0498],
  ['Bonny', 'Rivers', 4.4500, 7.1667],
  ['Eleme', 'Rivers', 4.7833, 7.1167],
  ['Benin City', 'Edo', 6.3176, 5.6145],
  ['Auchi', 'Edo', 7.0667, 6.2667],
  ['Ekpoma', 'Edo', 6.7500, 6.1333],
  ['Uromi', 'Edo', 6.7000, 6.3333],
  ['Igarra', 'Edo', 7.2833, 6.1000],
  ['Sabongida-Ora', 'Edo', 6.9167, 5.9667],
  ['Ubiaja', 'Edo', 6.6500, 6.3333],
  ['Ibadan', 'Oyo', 7.3775, 3.9470],
  ['Ogbomoso', 'Oyo', 8.1333, 4.2500],
  ['Oyo', 'Oyo', 7.8500, 3.9333],
  ['Enugu', 'Enugu', 6.5244, 7.5103],
  ['Nsukka', 'Enugu', 6.8567, 7.3958],
  ['Aba', 'Abia', 5.1167, 7.3667],
  ['Umuahia', 'Abia', 5.5333, 7.4833],
  ['Onitsha', 'Anambra', 6.1400, 6.8000],
  ['Awka', 'Anambra', 6.2109, 7.0740],
  ['Nnewi', 'Anambra', 6.0167, 6.9167],
  ['Jos', 'Plateau', 9.8965, 8.8583],
  ['Bukuru', 'Plateau', 9.7833, 8.8667],
  ['Maiduguri', 'Borno', 11.8333, 13.1500],
  ['Biu', 'Borno', 10.6167, 12.1833],
  ['Sokoto', 'Sokoto', 13.0059, 5.2476],
  ['Katsina', 'Katsina', 12.9908, 7.6018],
  ['Daura', 'Katsina', 13.0333, 8.3167],
  ['Birnin Kebbi', 'Kebbi', 12.4539, 4.1975],
  ['Minna', 'Niger', 9.6139, 6.5470],
  ['Bida', 'Niger', 9.0833, 6.0167],
  ['Suleja', 'Niger', 9.1833, 7.1833],
  ['Lokoja', 'Kogi', 7.8023, 6.7333],
  ['Okene', 'Kogi', 7.5500, 6.2333],
  ['Idah', 'Kogi', 7.1000, 6.7333],
  ['Anyigba', 'Kogi', 7.5000, 7.1833],
  ['Makurdi', 'Benue', 7.7322, 8.5391],
  ['Gboko', 'Benue', 7.3333, 9.0000],
  ['Otukpo', 'Benue', 7.1900, 8.1300],
  ['Yola', 'Adamawa', 9.2035, 12.4954],
  ['Mubi', 'Adamawa', 10.2667, 13.2667],
  ['Bauchi', 'Bauchi', 10.3103, 9.8439],
  ['Azare', 'Bauchi', 11.6750, 10.1917],
  ['Gombe', 'Gombe', 10.2897, 11.1673],
  ['Damaturu', 'Yobe', 11.7479, 11.9660],
  ['Jalingo', 'Taraba', 8.8833, 11.3667],
  ['Wukari', 'Taraba', 7.8500, 9.7833],
  ['Lafia', 'Nasarawa', 8.4939, 8.5157],
  ['Keffi', 'Nasarawa', 8.8481, 7.8736],
  ['Akwanga', 'Nasarawa', 8.9167, 8.4000],
  ['Owerri', 'Imo', 5.4836, 7.0333],
  ['Orlu', 'Imo', 5.7833, 7.0333],
  ['Uyo', 'Akwa Ibom', 5.0378, 7.9128],
  ['Eket', 'Akwa Ibom', 4.6417, 7.9244],
  ['Calabar', 'Cross River', 4.9757, 8.3417],
  ['Ogoja', 'Cross River', 6.6583, 8.7983],
  ['Ikom', 'Cross River', 5.9667, 8.7167],
  ['Warri', 'Delta', 5.5167, 5.7500],
  ['Asaba', 'Delta', 6.1986, 6.7313],
  ['Sapele', 'Delta', 5.8900, 5.6800],
  ['Ughelli', 'Delta', 5.5000, 5.9833],
  ['Agbor', 'Delta', 6.2500, 6.2000],
  ['Osogbo', 'Osun', 7.7719, 4.5569],
  ['Ile-Ife', 'Osun', 7.4667, 4.5667],
  ['Ilesa', 'Osun', 7.6167, 4.7333],
  ['Ede', 'Osun', 7.7333, 4.4333],
  ['Abeokuta', 'Ogun', 7.1557, 3.3451],
  ['Sagamu', 'Ogun', 6.8486, 3.6472],
  ['Ijebu-Ode', 'Ogun', 6.8167, 3.9333],
  ['Ota', 'Ogun', 6.6797, 3.2344],
  ['Akure', 'Ondo', 7.2571, 5.2058],
  ['Ondo', 'Ondo', 7.1000, 4.8333],
  ['Owo', 'Ondo', 7.1961, 5.5869],
  ['Ado-Ekiti', 'Ekiti', 7.6211, 5.2214],
  ['Ikere-Ekiti', 'Ekiti', 7.5000, 5.2333],
  ['Gusau', 'Zamfara', 12.1628, 6.6614],
  ['Dutse', 'Jigawa', 11.7564, 9.3386],
  ['Hadejia', 'Jigawa', 12.4497, 10.0411],
];

function haversineKm(lat1, lng1, lat2, lng2) {
  if (lat1 == null || lng1 == null || lat2 == null || lng2 == null) return null;
  const R = 6371;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

function nearestCity(lat, lng) {
  if (lat == null || lng == null) return null;
  if (typeof lat !== 'number' || typeof lng !== 'number') return null;
  if (Number.isNaN(lat) || Number.isNaN(lng)) return null;

  let best = null;
  let bestDist = Infinity;
  for (const [city, state, cLat, cLng] of NIGERIA_CITIES) {
    const d = haversineKm(lat, lng, cLat, cLng);
    if (d != null && d < bestDist) {
      bestDist = d;
      best = { city, state, lat: cLat, lng: cLng };
    }
  }
  if (!best) return null;
  return {
    ...best,
    distanceKm: Math.round(bestDist * 10) / 10,
    withinNigeria: lat >= 3.5 && lat <= 14.0 && lng >= 2.5 && lng <= 15.0,
  };
}

function assessImpossibleTravel(prevScan, currLat, currLng, currTimeMs) {
  if (!prevScan) {
    return {
      isImpossible: false,
      requiredSpeedKmh: 0,
      distanceKm: 0,
      minutesElapsed: 0,
      verdict: 'OK',
      reason: null,
    };
  }

  const prevLat = prevScan.locationLat;
  const prevLng = prevScan.locationLng;
  if (prevLat == null || prevLng == null || currLat == null || currLng == null) {
    return {
      isImpossible: false,
      requiredSpeedKmh: 0,
      distanceKm: 0,
      minutesElapsed: 0,
      verdict: 'OK',
      reason: null,
    };
  }

  const distanceKm = haversineKm(prevLat, prevLng, currLat, currLng);
  const prevTimeMs = new Date(
    prevScan.timestamp || prevScan.scannedAt || 0
  ).getTime();

  const elapsedMs = currTimeMs - prevTimeMs;
  const minutesElapsed = Math.max(0, elapsedMs / 60000);

  if (minutesElapsed === 0 || distanceKm == null) {
    return {
      isImpossible: false,
      requiredSpeedKmh: 0,
      distanceKm: distanceKm || 0,
      minutesElapsed,
      verdict: 'OK',
      reason: null,
    };
  }

  const hoursElapsed = minutesElapsed / 60;
  const requiredSpeedKmh = distanceKm / hoursElapsed;

  let verdict;
  let reason;

  if (requiredSpeedKmh <= 150) {
    verdict = 'OK';
    reason = null;
  } else if (requiredSpeedKmh <= 800) {
    verdict = 'FAST';
    reason =
      `This product moved ${Math.round(distanceKm)} km in ` +
      `${formatDurationShort(minutesElapsed)} ` +
      `(${Math.round(requiredSpeedKmh)} km/h). That would require air travel.`;
  } else {
    verdict = 'IMPOSSIBLE';
    reason =
      `This product was scanned in "${prevScan.locationCity || 'another city'}" ` +
      `${formatDurationShort(minutesElapsed)}, and is now being scanned ` +
      `${Math.round(distanceKm)} km away. That would require ` +
      `${Math.round(requiredSpeedKmh)} km/h — faster than any commercial flight. ` +
      `This code has been duplicated.`;
  }

  return {
    isImpossible: verdict === 'IMPOSSIBLE',
    requiredSpeedKmh: Math.round(requiredSpeedKmh),
    distanceKm: Math.round(distanceKm * 10) / 10,
    minutesElapsed: Math.round(minutesElapsed),
    verdict,
    reason,
  };
}

// ============================================================
// GEOLOCATION — two-phase (fast + full)
// ============================================================
// FAST (≤2.5s): used at scan time. Returns cache / IP / GPS if it
//               locks quickly. The user NEVER waits longer than this.
// FULL (≤12s):  runs in the background. If real GPS arrives after
//               the verdict, the scan_event + claim are patched.
// ============================================================

const FAST_GPS_BUDGET_MS = 2500;
const LAST_GOOD_LOCATION_KEY = 'konfa:lastGoodLocation';
const LAST_GOOD_LOCATION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

function readCachedLocation() {
  try {
    if (typeof localStorage === 'undefined') return null;
    const raw = localStorage.getItem(LAST_GOOD_LOCATION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (
      parsed &&
      typeof parsed.lat === 'number' &&
      typeof parsed.lng === 'number' &&
      Date.now() - (parsed.at || 0) < LAST_GOOD_LOCATION_TTL_MS
    ) {
      return {
        lat: parsed.lat,
        lng: parsed.lng,
        accuracy: parsed.accuracy ?? null,
        source: 'cached',
      };
    }
  } catch {
    /* ignore */
  }
  return null;
}

function writeCachedLocation(loc) {
  try {
    if (typeof localStorage === 'undefined') return;
    if (!loc || typeof loc.lat !== 'number' || typeof loc.lng !== 'number') return;
    if (loc.source !== 'gps' && loc.source !== 'gps_passed') return;
    localStorage.setItem(
      LAST_GOOD_LOCATION_KEY,
      JSON.stringify({
        lat: loc.lat,
        lng: loc.lng,
        accuracy: loc.accuracy ?? null,
        at: Date.now(),
      })
    );
  } catch {
    /* ignore */
  }
}

function getBrowserLocationOnce({ timeoutMs, enableHighAccuracy }) {
  if (typeof navigator === 'undefined' || !navigator.geolocation) {
    return Promise.resolve(null);
  }
  return new Promise((resolve) => {
    let settled = false;
    const done = (result) => {
      if (settled) return;
      settled = true;
      resolve(result);
    };
    const timer = setTimeout(() => done(null), timeoutMs + 500);
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
          enableHighAccuracy,
          timeout: timeoutMs,
          maximumAge: enableHighAccuracy ? 30000 : 300000,
        }
      );
    } catch {
      clearTimeout(timer);
      done(null);
    }
  });
}

async function tryIpLocation() {
  try {
    if (typeof fetch !== 'function') return null;
    const controller =
      typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timer = controller
      ? setTimeout(() => controller.abort(), 4000)
      : null;
    const res = await fetch('https://ipapi.co/json/', {
      signal: controller ? controller.signal : undefined,
    });
    if (timer) clearTimeout(timer);
    if (!res.ok) return null;
    const data = await res.json();
    if (
      typeof data.latitude === 'number' &&
      typeof data.longitude === 'number'
    ) {
      return {
        lat: data.latitude,
        lng: data.longitude,
        accuracy: 25000,
        source: 'ip',
      };
    }
  } catch {
    /* ignore */
  }
  return null;
}

/**
 * FAST path — used at scan time. Never blocks more than ~2.5s.
 */
async function getBrowserLocationFast({ existingCoords = null } = {}) {
  if (existingCoords && typeof existingCoords.lat === 'number') {
    return {
      ...existingCoords,
      source: existingCoords.source || 'gps_passed',
    };
  }

  // Cached first — instant.
  const cached = readCachedLocation();
  if (cached) {
    return cached;
  }

  // Race: GPS (high-accuracy, 2.5s budget) vs IP vs hard timer.
  const timer = new Promise((resolve) =>
    setTimeout(() => resolve(null), FAST_GPS_BUDGET_MS)
  );
  const gps = getBrowserLocationOnce({
    timeoutMs: FAST_GPS_BUDGET_MS,
    enableHighAccuracy: true,
  });
  const ip = tryIpLocation();

  const winner = await Promise.race([gps, ip, timer]);
  if (winner && typeof winner.lat === 'number') {
    if (winner.source === 'gps') writeCachedLocation(winner);
    return winner;
  }

  // Nothing resolved in time. Return null; the caller proceeds and
  // the slow path (below) will patch later if GPS arrives.
  return null;
}

/**
 * FULL path — runs in the background after the verdict is returned.
 * Tries hard (up to ~20s total) to get a real GPS fix.
 */
async function getBrowserLocationFull() {
  // High-accuracy GPS
  let loc = await getBrowserLocationOnce({
    timeoutMs: 12000,
    enableHighAccuracy: true,
  });
  if (loc) {
    writeCachedLocation(loc);
    return loc;
  }

  // Low-accuracy GPS
  loc = await getBrowserLocationOnce({
    timeoutMs: 8000,
    enableHighAccuracy: false,
  });
  if (loc) {
    writeCachedLocation(loc);
    return loc;
  }

  // Cached
  const cached = readCachedLocation();
  if (cached) return cached;

  // IP
  const ip = await tryIpLocation();
  if (ip) return ip;

  return null;
}

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
    /* ignore */
  }
  return {
    deviceUserAgent: navigator.userAgent || null,
    devicePlatform: navigator.platform || null,
    deviceLanguage: navigator.language || null,
    deviceTimezone: tz,
  };
}

// ============================================================
// PATCH HELPERS (background)
// ============================================================

/**
 * Patch the location fields on an existing scan_events doc.
 * Called from the background when slow GPS finally resolves.
 */
async function patchScanEventLocation(scanEventId, loc) {
  if (
    !scanEventId ||
    !loc ||
    typeof loc.lat !== 'number' ||
    typeof loc.lng !== 'number'
  ) {
    return;
  }
  try {
    const geo = nearestCity(loc.lat, loc.lng);
    const patch = {
      locationLat: loc.lat,
      locationLng: loc.lng,
      locationAccuracy: loc.accuracy ?? null,
      locationSource: loc.source || 'gps',
      locationCity: geo?.city ?? null,
      locationState: geo?.state ?? null,
      locationRegion: geo
        ? `${geo.city}${geo.state ? `, ${geo.state}` : ''}`
        : null,
      withinNigeria: geo?.withinNigeria ?? null,
      locationPatchedAt: serverTimestamp(),
    };
    await updateDoc(doc(db, 'scan_events', scanEventId), patch);
    console.log('📍 scan_event location patched:', scanEventId, {
      city: patch.locationCity,
      source: patch.locationSource,
    });
  } catch (err) {
    console.warn('patchScanEventLocation failed:', err.code);
  }
}

/**
 * Schedule a background patch of a claim's first-claim location
 * once slow GPS resolves.
 *
 * NOTE: field names here (firstClaimLat / firstClaimLng / claimId)
 * are best-guess. Adapt to whatever recordFirstClaim returns and
 * whatever your `unit_claims` schema uses.
 */
function scheduleClaimLocationPatch({ claimId, slowLocationPromise, fastCoords }) {
  if (!claimId || !slowLocationPromise) return;
  // If the fast path already had real GPS, no patch needed.
  if (
    fastCoords &&
    (fastCoords.source === 'gps' || fastCoords.source === 'gps_passed')
  ) {
    return;
  }
  slowLocationPromise
    .then((lateLoc) => {
      if (!lateLoc || typeof lateLoc.lat !== 'number') return;
      return updateDoc(doc(db, 'unit_claims', claimId), {
        firstClaimLat: lateLoc.lat,
        firstClaimLng: lateLoc.lng,
        firstClaimAccuracy: lateLoc.accuracy ?? null,
        firstClaimSource: lateLoc.source || 'gps',
        locationPatchedAt: serverTimestamp(),
      });
    })
    .catch(() => {
      /* ignore — non-fatal */
    });
}

// ============================================================
// LOG SCAN EVENT
// ============================================================
export async function logScanEvent({
  unitId,
  consumerReferenceCode = null,
  scanType,
  result,
  pinCheckResult,
  baseRiskScore = 5,
  scanningSellerId = null,
  coords = null,
  skipLocation = false, // kept for backwards compat; ignored
}) {
  if (!unitId) {
    console.warn('logScanEvent: unitId is required — skipping write');
    return null;
  }

  // ---- Resolve location (fast path only) ----
  let loc = coords
    ? { ...coords, source: coords.source || 'gps_passed' }
    : null;

  if (!loc) {
    loc = readCachedLocation();
  }

  if (!loc) {
    loc = await getBrowserLocationOnce({
      timeoutMs: FAST_GPS_BUDGET_MS,
      enableHighAccuracy: true,
    });
    if (loc) writeCachedLocation(loc);
  }

  // Last-ditch: IP
  if (!loc) {
    loc = await tryIpLocation();
  }

  const device = getDeviceInfo();

  const locationLat = loc?.lat ?? null;
  const locationLng = loc?.lng ?? null;
  const locationAccuracy = loc?.accuracy ?? null;
  const locationSource = loc?.source ?? 'unknown';

  const geo =
    locationLat != null && locationLng != null
      ? nearestCity(locationLat, locationLng)
      : null;

  const locationCity = geo?.city ?? null;
  const locationState = geo?.state ?? null;
  const locationRegion = geo
    ? `${geo.city}${geo.state ? `, ${geo.state}` : ''}`
    : null;
  const withinNigeria = geo?.withinNigeria ?? null;

  // ---- Fetch previous scan ----
  let previousScan = null;
  try {
    const snap = await getDocs(
      query(
        collection(db, 'scan_events'),
        where('unitId', '==', unitId),
        orderBy('timestamp', 'desc'),
        limit(1)
      )
    );
    if (!snap.empty) {
      previousScan = { id: snap.docs[0].id, ...snap.docs[0].data() };
    }
  } catch (err) {
    try {
      const snap = await getDocs(
        query(
          collection(db, 'scan_events'),
          where('unitId', '==', unitId),
          limit(10)
        )
      );
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      list.sort(
        (a, b) =>
          new Date(b.timestamp || b.scannedAt || 0) -
          new Date(a.timestamp || a.scannedAt || 0)
      );
      previousScan = list[0] || null;
    } catch (err2) {
      console.warn('Could not fetch previous scans:', err2.code);
    }
  }

  const nowMs = Date.now();
  const travelCheck = assessImpossibleTravel(
    previousScan,
    locationLat,
    locationLng,
    nowMs
  );

  let riskScore = baseRiskScore;
  let flagReason = null;

  if (travelCheck.verdict === 'FAST') {
    riskScore = Math.max(riskScore, 60);
    flagReason = travelCheck.reason;
  } else if (travelCheck.verdict === 'IMPOSSIBLE') {
    riskScore = Math.max(riskScore, 95);
    flagReason = travelCheck.reason;
  }

  // ---- Location-availability check ----
  if (locationLat == null || locationLng == null) {
    riskScore = Math.max(riskScore, 15);
    flagReason =
      flagReason ||
      'Location was unavailable for this scan — movement checks could not run.';
  }

  // ---- Frequency check ----
  try {
    const oneHourAgo = nowMs - 60 * 60 * 1000;
    const recentSnap = await getDocs(
      query(
        collection(db, 'scan_events'),
        where('unitId', '==', unitId),
        limit(20)
      )
    );
    const recentCount = recentSnap.docs.filter((d) => {
      const t = new Date(
        d.data().timestamp || d.data().scannedAt || 0
      ).getTime();
      return t >= oneHourAgo;
    }).length;

    if (recentCount >= 3) {
      riskScore = Math.max(riskScore, 70);
      flagReason =
        flagReason ||
        `This code has been scanned ${recentCount} times in the last hour.`;
    }
  } catch (err) {
    /* non-fatal */
  }

  const eventDoc = {
    unitId,
    consumerReferenceCode,
    scanType: scanType || 'consumer_scan',
    result: result || 'UNKNOWN',
    pinCheckResult: pinCheckResult || 'NOT_ATTEMPTED',
    scanningSellerId,

    locationLat,
    locationLng,
    locationAccuracy,
    locationCity,
    locationState,
    locationRegion,
    locationSource,
    withinNigeria,

    timestamp: new Date(nowMs).toISOString(),
    scannedAt: serverTimestamp(),

    deviceUserAgent: device.deviceUserAgent,
    devicePlatform: device.devicePlatform,
    deviceLanguage: device.deviceLanguage,
    deviceTimezone: device.deviceTimezone,

    previousScanId: previousScan?.id || null,
    previousScanCity: previousScan?.locationCity || null,
    previousScanRegion: previousScan?.locationRegion || null,
    previousScanTimestamp: previousScan?.timestamp || null,
    previousScanResult: previousScan?.result || null,

    distanceFromPreviousKm: travelCheck.distanceKm || null,
    minutesSincePrevious: travelCheck.minutesElapsed || null,
    requiredSpeedKmh: travelCheck.requiredSpeedKmh || null,
    travelVerdict: travelCheck.verdict || 'OK',
    isPhysicallyImpossible: travelCheck.isImpossible || false,
    impossibilityReason: travelCheck.isImpossible ? travelCheck.reason : null,

    riskScore,
    flagReason,
  };

  try {
    const ref = await addDoc(collection(db, 'scan_events'), eventDoc);
    console.log('📝 scan_event written:', ref.id, {
      city: locationCity,
      source: locationSource,
      verdict: travelCheck.verdict,
      riskScore,
      result,
    });
    return { id: ref.id, ...eventDoc, travelVerdict: travelCheck.verdict };
  } catch (err) {
    console.error('Failed to write scan_event:', err.code, err.message);
    return null;
  }
}

/**
 * Log a scan event AND schedule a background patch if slow GPS
 * later arrives with better coords. Returns the scan event
 * immediately so the caller isn't blocked.
 */
async function logScanEventAndPatch({
  slowLocationPromise,
  fastCoords,
  ...args
}) {
  const scanEvent = await logScanEvent({
    ...args,
    coords: fastCoords,
    skipLocation: false,
  });

  // If we already had real GPS coords, no patch needed.
  if (
    scanEvent &&
    fastCoords &&
    (fastCoords.source === 'gps' || fastCoords.source === 'gps_passed')
  ) {
    return scanEvent;
  }

  // Otherwise, wait for slow lookup in the background and patch.
  if (scanEvent?.id && slowLocationPromise) {
    slowLocationPromise
      .then((lateLoc) => {
        if (!lateLoc || typeof lateLoc.lat !== 'number') return;
        if (
          fastCoords &&
          (fastCoords.source === 'gps' ||
            fastCoords.source === 'gps_passed')
        ) {
          return;
        }
        return patchScanEventLocation(scanEvent.id, lateLoc);
      })
      .catch((err) => console.warn('late-location patch failed:', err));
  }

  return scanEvent;
}

// ============================================================
// UNIT LOOKUP
// ============================================================

const REF_FIELD_CANDIDATES = [
  'consumerReferenceCode',
  'referenceCode',
  'refCode',
  'code',
];

const TOKEN_FIELD_CANDIDATES = [
  'consumerBarcodeToken',
  'barcodeToken',
  'token',
];

async function findUnitByReference(rawRefCode) {
  const unitsRef = collection(db, 'units');

  const stripped = normalizeRefCode(rawRefCode);
  const dashed = formatRefCode(rawRefCode);
  const candidates = Array.from(new Set([dashed, stripped].filter(Boolean)));

  for (const candidate of candidates) {
    for (const field of REF_FIELD_CANDIDATES) {
      try {
        const snap = await getDocs(
          query(unitsRef, where(field, '==', candidate), limit(1))
        );
        if (!snap.empty) {
          const docSnap = snap.docs[0];
          const data = docSnap.data();
          console.log(`✅ Unit found via ${field}=${candidate}`);
          return {
            ...data,
            id: docSnap.id,
            _firestoreId: docSnap.id,
            _internalId: data.id || null,
          };
        }
      } catch (err) {
        console.warn(`⚠️ Query ${field}=${candidate} failed:`, err.code);
      }
    }

    for (const field of TOKEN_FIELD_CANDIDATES) {
      try {
        const snap = await getDocs(
          query(unitsRef, where(field, '==', candidate), limit(1))
        );
        if (!snap.empty) {
          const docSnap = snap.docs[0];
          const data = docSnap.data();
          console.log(`✅ Unit found via ${field}`);
          return {
            ...data,
            id: docSnap.id,
            _firestoreId: docSnap.id,
            _internalId: data.id || null,
          };
        }
      } catch (err) {
        console.warn(`⚠️ Query ${field}=${candidate} failed:`, err.code);
      }
    }
  }

  console.log('❌ No unit found for any candidate:', candidates);
  return null;
}

// ============================================================
// PRIVACY: mask non-manufacturer actors
// ============================================================
const sellerMaskCache = new Map();

async function getMaskedSellerLabel(sellerId, regionLabel) {
  if (!sellerId) return null;
  let baseLabel;
  if (sellerMaskCache.has(sellerId)) {
    baseLabel = sellerMaskCache.get(sellerId);
  } else {
    try {
      const sellerDoc = await getDoc(doc(db, 'sellers', sellerId));
      if (sellerDoc.exists()) {
        const role = sellerDoc.data().role || 'Seller';
        baseLabel = role.charAt(0).toUpperCase() + role.slice(1);
      } else {
        baseLabel = 'Seller';
      }
    } catch (err) {
      console.warn('Could not fetch seller role:', err.code);
      baseLabel = 'Seller';
    }
    sellerMaskCache.set(sellerId, baseLabel);
  }
  if (regionLabel && regionLabel !== 'Unknown') {
    return `${baseLabel} (${regionLabel})`;
  }
  return baseLabel;
}

async function getManufacturerName(manufacturerId) {
  if (!manufacturerId) return null;
  try {
    const snap = await getDoc(doc(db, 'manufacturers', manufacturerId));
    if (snap.exists()) return snap.data().companyName;
  } catch (err) {
    console.warn('Could not fetch manufacturer name:', err.code);
  }
  return null;
}

async function resolveManufacturerId(unit) {
  if (!unit?.batchId) return null;
  try {
    const batchDoc = await getDoc(doc(db, 'batches', unit.batchId));
    if (!batchDoc.exists()) return null;
    const batch = batchDoc.data();
    if (batch.manufacturerId) return batch.manufacturerId;
    if (!batch.productId) return null;
    const productDoc = await getDoc(doc(db, 'products', batch.productId));
    if (!productDoc.exists()) return null;
    return productDoc.data().manufacturerId || null;
  } catch (err) {
    console.warn('Could not resolve manufacturerId:', err.code);
    return null;
  }
}

// ============================================================
// FETCHERS
// ============================================================

async function fetchMovementHistory(unit) {
  if (!unit.id) {
    console.warn('fetchMovementHistory: unit.id is missing — skipping');
    return [];
  }

  let movementEvents = [];
  try {
    const snap = await getDocs(
      query(collection(db, 'movement_events'), where('unitId', '==', unit.id))
    );
    movementEvents = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  } catch (err) {
    console.warn('Could not read movement_events:', err.code);
  }

  let scanEvents = [];
  try {
    const snap = await getDocs(
      query(
        collection(db, 'scan_events'),
        where('unitId', '==', unit.id),
        limit(50)
      )
    );
    scanEvents = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  } catch (err) {
    console.warn('Could not read scan_events:', err.code);
  }

  let manufacturerName = null;
  try {
    if (unit.batchId) {
      const batchDoc = await getDoc(doc(db, 'batches', unit.batchId));
      if (batchDoc.exists()) {
        const productId = batchDoc.data().productId;
        if (productId) {
          const productDoc = await getDoc(doc(db, 'products', productId));
          if (productDoc.exists()) {
            const mfrId = productDoc.data().manufacturerId;
            manufacturerName = await getManufacturerName(mfrId);
          }
        }
      }
    }
  } catch (err) {
    console.warn('Could not resolve manufacturer:', err.code);
  }

  const movementRows = movementEvents.map((ev) => {
    const eventType = ev.eventType;
    const regionLabel = ev.locationLabel || 'Unknown';
    let actorLabel = null;

    if (eventType === 'manufactured' || eventType === 'activated') {
      actorLabel = manufacturerName || 'Manufacturer';
    } else if (eventType === 'received' || eventType === 'transferred') {
      actorLabel = regionLabel ? `Seller (${regionLabel})` : 'Seller';
    } else if (eventType === 'seller_scan') {
      actorLabel = `Seller (${regionLabel})`;
    } else if (eventType === 'assigned_to_shipment') {
      actorLabel = manufacturerName || 'Manufacturer';
    }

    return {
      id: ev.id,
      source: 'movement',
      label: prettifyEventType(eventType),
      location: regionLabel,
      time: formatTimestamp(ev.timestamp),
      timeRaw: ev.timestamp || null,
      confidence: (ev.locationConfidence || 'UNKNOWN').toUpperCase(),
      actor: actorLabel,
      flag: false,
      result: null,
      riskScore: null,
      isImpossible: false,
      impossibilityReason: null,
    };
  });

  const scanRows = scanEvents.map((ev) => {
    const regionLabel =
      ev.locationRegion ||
      ev.locationCity ||
      ev.previousScanRegion ||
      'Unknown';

    let actorLabel = null;
    if (ev.scanType === 'consumer_scan') {
      actorLabel = 'A consumer';
    } else if (ev.scanType === 'seller_scan') {
      actorLabel = ev.scanningSellerId ? 'A seller' : 'A seller';
    } else {
      actorLabel = 'Someone';
    }

    let label;
    if (ev.result === 'AUTHENTIC') {
      label = 'Verified authentic';
    } else if (ev.result === 'SUSPICIOUS') {
      label = '⚠ Suspicious scan';
    } else if (ev.result === 'DUPLICATE_CODE') {
      label = '⚠ Duplicate code detected';
    } else if (ev.result === 'INVALID') {
      label = 'Invalid attempt';
    } else if (ev.result === 'EXPECTED') {
      label = 'Scanned (in transit)';
    } else if (ev.result === 'NOT_YET_RELEASED') {
      label = '⚠ Scanned before release';
    } else {
      label = 'Scanned';
    }

    return {
      id: ev.id,
      source: 'scan',
      label,
      location: regionLabel,
      time: formatTimestamp(ev.timestamp),
      timeRaw: ev.timestamp || null,
      confidence: ev.locationLat
        ? 'GPS'
        : ev.locationSource === 'unknown'
        ? 'UNKNOWN'
        : (ev.locationSource || 'UNKNOWN').toUpperCase(),
      actor: actorLabel,
      flag: ev.isPhysicallyImpossible === true,
      result: ev.result || null,
      riskScore: ev.riskScore ?? null,
      isImpossible: ev.isPhysicallyImpossible === true,
      impossibilityReason: ev.impossibilityReason || null,
      deviceTimezone: ev.deviceTimezone || null,
    };
  });

  const combined = [...movementRows, ...scanRows];
  combined.sort((a, b) => {
    const at = new Date(a.timeRaw || 0).getTime();
    const bt = new Date(b.timeRaw || 0).getTime();
    return at - bt;
  });

  return combined;
}

async function fetchProductAndBatch(unit) {
  let productName = null;
  let batchCode = unit.batchId;

  try {
    if (unit.batchId) {
      const batchDoc = await getDoc(doc(db, 'batches', unit.batchId));
      if (batchDoc.exists()) {
        const batch = batchDoc.data();
        batchCode = batch.batchCode || unit.batchId;

        if (batch.productId) {
          const productDoc = await getDoc(doc(db, 'products', batch.productId));
          if (productDoc.exists()) {
            productName = productDoc.data().productName;
          }
        }
      }
    }
  } catch (err) {
    console.warn('Could not fetch product/batch info:', err.code, err.message);
  }

  return { productName, batchCode };
}

async function fetchExpectedLocation(unit) {
  if (!unit.batchId) return null;
  try {
    const shipmentsRef = collection(db, 'shipments');
    const snap = await getDocs(
      query(shipmentsRef, where('batchId', '==', unit.batchId))
    );
    if (!snap.empty) {
      const s = snap.docs[0].data();
      if (s.destinationLabel) return `${s.destinationLabel} (expected)`;
    }
  } catch (err) {
    console.warn('Could not fetch expected location:', err.code);
  }
  return null;
}

async function fetchRiskInfo(unitId) {
  if (!unitId) {
    return {
      riskScore: 0,
      flaggedReason: null,
      flags: [],
      lastScan: null,
      impossibleTravel: null,
    };
  }

  try {
    const scansRef = collection(db, 'scan_events');
    let snap;
    try {
      snap = await getDocs(
        query(
          scansRef,
          where('unitId', '==', unitId),
          orderBy('timestamp', 'desc'),
          limit(20)
        )
      );
    } catch {
      snap = await getDocs(
        query(scansRef, where('unitId', '==', unitId), limit(20))
      );
    }

    const events = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    if (events.length === 0) {
      return {
        riskScore: 0,
        flaggedReason: null,
        flags: [],
        lastScan: null,
        impossibleTravel: null,
      };
    }

    events.sort(
      (a, b) =>
        new Date(b.timestamp || b.scannedAt || 0) -
        new Date(a.timestamp || a.scannedAt || 0)
    );

    const top = events.reduce(
      (max, ev) => ((ev.riskScore || 0) > (max.riskScore || 0) ? ev : max),
      { riskScore: 0 }
    );

    const impossible = events.find((e) => e.isPhysicallyImpossible);
    const flagged = events.filter((ev) => ev.result === 'SUSPICIOUS');

    let flaggedReason = null;
    if (impossible) {
      flaggedReason = impossible.impossibilityReason;
    } else if (flagged.length >= 2) {
      flaggedReason =
        'Multiple suspicious scans detected within a short window.';
    } else if (top.riskScore > 70) {
      flaggedReason = `High risk score (${top.riskScore}) on a recent scan.`;
    }

    return {
      riskScore: top.riskScore || 0,
      flaggedReason,
      flags: flagged.map((ev) => ev.id),
      lastScan: events[0],
      impossibleTravel: impossible || null,
    };
  } catch (err) {
    console.warn('Could not read scan_events:', err.code, err.message);
    return {
      riskScore: 0,
      flaggedReason: null,
      flags: [],
      lastScan: null,
      impossibleTravel: null,
    };
  }
}

function formatTimestamp(iso) {
  if (!iso) return 'Unknown';
  try {
    const d = new Date(iso);
    const today = new Date();
    const sameDay =
      d.getDate() === today.getDate() &&
      d.getMonth() === today.getMonth() &&
      d.getFullYear() === today.getFullYear();

    if (sameDay) {
      return `Today, ${d.toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      })}`;
    }
    return d.toLocaleDateString([], {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return iso;
  }
}

function prettifyEventType(type) {
  if (!type) return 'Event';
  const map = {
    manufactured: 'Manufactured',
    activated: 'Activated',
    assigned_to_shipment: 'Assigned to shipment',
    received: 'Received',
    transferred: 'Transferred',
    seller_scan: 'Seller scan',
    consumer_scan: 'You scanned it',
  };
  return (
    map[type] ||
    type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
  );
}

async function hasLegitimateTransferBetween(unitId, fromIso, toIso) {
  if (!unitId || !fromIso) return false;
  try {
    const snap = await getDocs(
      query(
        collection(db, 'movement_events'),
        where('unitId', '==', unitId),
        where('eventType', 'in', ['transferred', 'received']),
        limit(50)
      )
    );
    const fromMs = new Date(fromIso).getTime();
    const toMs = toIso ? new Date(toIso).getTime() : Date.now();
    return snap.docs.some((d) => {
      const t = new Date(d.data().timestamp || 0).getTime();
      return t > fromMs && t < toMs;
    });
  } catch (err) {
    console.warn('Could not check transfers between scans:', err.code);
    return false;
  }
}

// ============================================================
// Fire-and-forget writer to consumer history
// ============================================================
function writeToConsumerHistory({
  consumerUid = null,
  unitId,
  referenceCode,
  result,
  productName,
  batchCode,
  claimCity,
  riskScore,
  flaggedReason,
  isImpossible,
  confidence,
  confidenceLabel,
  signals,
  pinCheckResult,
  travelVerdict,
  scanEventId,
}) {
  (async () => {
    try {
      let uid = consumerUid;
      if (!uid) {
        const current = await getCurrentConsumerProfile();
        uid = current?.id || null;
      }
      if (!uid) return;

      await recordConsumerScan({
        consumerUid: uid,
        unitId,
        referenceCode,
        result,
        productName,
        batchCode,
        locationCity: claimCity?.city || null,
        locationRegion: claimCity
          ? `${claimCity.city}, ${claimCity.state}`
          : null,
        riskScore,
        flaggedReason,
        isImpossible,
        confidence,
        confidenceLabel,
        signals,
        pinCheckResult,
        travelVerdict,
        scanEventId,
      });
    } catch (err) {
      console.warn('Could not record consumer scan:', err);
    }
  })();
}

// ============================================================
// MAIN: verifyProduct
// ============================================================
export const verifyProduct = async (referenceCode, pin, context = {}) => {
  const {
    deviceId = null,
    timeToEnterPinMs = null,
    coords = null,
    consumerUid = null,
    onProgress = null,
  } = context;

  const refCode = normalizeRefCode(referenceCode);

  console.log('🔍 verifyProduct called');
  console.log('   raw input   :', referenceCode);
  console.log('   normalized  :', refCode);
  console.log('   deviceId    :', deviceId);
  console.log('   consumerUid :', consumerUid);
  console.log('   timeToPinMs :', timeToEnterPinMs);
  console.log('   coords      :', coords ? `${coords.lat},${coords.lng}` : 'none');

  emitProgress(onProgress, 'reading', 10, 'Reading product code…');

  // ============================================================
  // LOCATION — kicked off in parallel, NOT awaited to completion.
  // ============================================================
  // - fastLocationPromise resolves in ≤2.5s (cache / IP / quick GPS).
  // - slowLocationPromise runs in the background and, if it gets a
  //   real GPS fix later, patches the scan_event and claim.
  const fastLocationPromise = getBrowserLocationFast({
    existingCoords: coords,
  });
  const slowLocationPromise = getBrowserLocationFull();

  // Small progress bump so the UI feels responsive.
  emitProgress(onProgress, 'locating', 18, 'Determining your location…');

  // Wait at most ~2.5s for the fast path.
  let effectiveCoords = await fastLocationPromise;

  if (effectiveCoords) {
    console.info('verifyProduct: fast location:', {
      source: effectiveCoords.source,
      lat: effectiveCoords.lat,
      lng: effectiveCoords.lng,
      accuracy: effectiveCoords.accuracy,
    });
  } else {
    console.info(
      'verifyProduct: fast location unavailable — proceeding without it.'
    );
  }

  emitProgress(onProgress, 'looking_up', 25, 'Locating product in registry…');

  let unit;
  try {
    unit = await findUnitByReference(referenceCode);
  } catch (err) {
    console.error('❌ Firestore lookup failed:', err.code);
    const conf = computeConfidence({
      base: 10,
      signals: [
        {
          code: 'code_not_found',
          label: 'Could not reach verification service.',
        },
      ],
    });
    emitProgress(onProgress, 'done', 100, 'Verification failed.');
    return {
      result: 'INVALID',
      reason: 'DB_ERROR',
      confidence: conf.score,
      confidenceLabel: conf.label,
      confidenceReasons: conf.reasons,
      message:
        'We could not reach our verification service. Please try again in a moment.',
    };
  }

  if (!unit) {
    const conf = computeConfidence({
      base: 15,
      signals: [
        {
          code: 'code_not_found',
          label: 'This code does not match any product in our records.',
        },
      ],
    });
    emitProgress(onProgress, 'done', 100, 'Code not found.');
    return {
      result: 'INVALID',
      reason: 'NOT_FOUND',
      confidence: conf.score,
      confidenceLabel: conf.label,
      confidenceReasons: conf.reasons,
      message: "This code doesn't match any product in our records.",
    };
  }

  console.log('✅ Unit found:', unit._firestoreId, 'status:', unit.status);

  if (!unit._firestoreId && !unit._internalId) {
    const conf = computeConfidence({
      base: 20,
      signals: [
        { code: 'code_not_found', label: 'Product record is incomplete.' },
      ],
    });
    emitProgress(onProgress, 'done', 100, 'Product record incomplete.');
    return {
      result: 'INVALID',
      reason: 'BAD_UNIT',
      confidence: conf.score,
      confidenceLabel: conf.label,
      confidenceReasons: conf.reasons,
      message:
        'We found a matching product but its record is incomplete. Please report this to support.',
    };
  }

  const queryId = unit._internalId || unit._firestoreId;

  emitProgress(onProgress, 'verifying_pin', 45, 'Verifying PIN…');

  let computedHash;
  try {
    computedHash = await sha256Hex(pin + (unit.pinSalt || ''));
  } catch (err) {
    console.error('❌ HASH_ERROR during verify:', err);

    const isInsecureContext =
      typeof window !== 'undefined' &&
      window.location &&
      window.location.protocol !== 'https:' &&
      window.location.hostname !== 'localhost' &&
      window.location.hostname !== '127.0.0.1';

    const conf = computeConfidence({
      base: 20,
      signals: [
        {
          code: 'missing_pin_match',
          label: isInsecureContext
            ? 'Your browser blocked the crypto API because this page is not served over HTTPS.'
            : 'An unexpected error occurred while processing your PIN.',
        },
      ],
    });
    emitProgress(onProgress, 'done', 100, 'PIN could not be verified.');
    return {
      result: 'INVALID',
      reason: 'HASH_ERROR',
      confidence: conf.score,
      confidenceLabel: conf.label,
      confidenceReasons: conf.reasons,
      message: isInsecureContext
        ? 'This page must be served over HTTPS for verification to work. ' +
          'Please ask your seller for a secure link.'
        : 'Unable to verify the PIN. Please try again.',
    };
  }

  if (computedHash !== unit.pinHash) {
    emitProgress(onProgress, 'done', 100, 'PIN did not match.');

    const scanResult = await logScanEventAndPatch({
      slowLocationPromise,
      fastCoords: effectiveCoords,
      unitId: queryId,
      consumerReferenceCode: unit.consumerReferenceCode,
      scanType: 'consumer_scan',
      result: 'INVALID',
      pinCheckResult: 'MISMATCH',
      baseRiskScore: 40,
    });

    const conf = computeConfidence({
      base: 35,
      signals: [
        {
          code: 'missing_pin_match',
          label: 'The PIN you entered does not match the one on record.',
        },
      ],
    });

    writeToConsumerHistory({
      consumerUid,
      unitId: queryId,
      referenceCode: unit.consumerReferenceCode,
      result: 'INVALID',
      productName: null,
      batchCode: null,
      claimCity: null,
      riskScore: scanResult?.riskScore ?? 40,
      flaggedReason: 'PIN did not match.',
      isImpossible: false,
      confidence: conf.score,
      confidenceLabel: conf.label,
      signals: [
        {
          code: 'missing_pin_match',
          label: 'The PIN you entered does not match the one on record.',
        },
      ],
      pinCheckResult: 'MISMATCH',
      travelVerdict: scanResult?.travelVerdict || 'OK',
      scanEventId: scanResult?.id || null,
    });

    return {
      result: 'INVALID',
      reason: 'PIN_MISMATCH',
      confidence: conf.score,
      confidenceLabel: conf.label,
      confidenceReasons: conf.reasons,
      message:
        "The PIN you entered doesn't match our records for this product.",
      scanEvent: scanResult,
    };
  }

  console.log('✅ PIN matched');

  emitProgress(onProgress, 'checking_history', 65, 'Checking scan history…');

  const [{ productName, batchCode }, riskInfo] = await Promise.all([
    fetchProductAndBatch(unit),
    fetchRiskInfo(queryId),
  ]);

  let claimCity = null;
  if (effectiveCoords?.lat != null && effectiveCoords?.lng != null) {
    const geo = nearestCity(effectiveCoords.lat, effectiveCoords.lng);
    if (geo) claimCity = { city: geo.city, state: geo.state };
  }

  emitProgress(onProgress, 'finalising', 85, 'Running authenticity checks…');

  // ============================================================
  // MANUFACTURED — pre-release scan
  // ============================================================
  if (unit.status === 'MANUFACTURED') {
    const scanResult = await logScanEventAndPatch({
      slowLocationPromise,
      fastCoords: effectiveCoords,
      unitId: queryId,
      consumerReferenceCode: unit.consumerReferenceCode,
      scanType: 'consumer_scan',
      result: 'SUSPICIOUS',
      pinCheckResult: 'MATCH',
      baseRiskScore: 100,
    });

    const conf = computeConfidence({
      base: 40,
      positives: ['code_matched', 'pin_matched'],
      signals: [
        {
          code: 'pre_release_scan',
          label: 'This code was never activated for sale.',
        },
      ],
    });

    writeToConsumerHistory({
      consumerUid,
      unitId: queryId,
      referenceCode: unit.consumerReferenceCode,
      result: 'NOT_YET_RELEASED',
      productName,
      batchCode,
      claimCity,
      riskScore: scanResult?.riskScore ?? 100,
      flaggedReason: 'This code was never activated for sale.',
      isImpossible: false,
      confidence: conf.score,
      confidenceLabel: conf.label,
      signals: [
        {
          code: 'pre_release_scan',
          label: 'This code was never activated for sale.',
        },
      ],
      pinCheckResult: 'MATCH',
      travelVerdict: scanResult?.travelVerdict || 'OK',
      scanEventId: scanResult?.id || null,
    });

    emitProgress(onProgress, 'done', 100, 'Not yet released.');
    return {
      result: 'NOT_YET_RELEASED',
      product: productName,
      batch: batchCode,
      unitId: queryId,
      confidence: conf.score,
      confidenceLabel: conf.label,
      confidenceReasons: conf.reasons,
      message:
        "This code exists in the manufacturer's records, but has never been " +
        'confirmed as physically applied to a real product. This is a strong ' +
        'signal that this code may have been leaked before release rather than ' +
        'legitimately sold to you.',
      scanEvent: scanResult,
    };
  }

  // ============================================================
  // IMPOSSIBLE TRAVEL
  // ============================================================
  if (riskInfo.impossibleTravel) {
    const [history, scanResult] = await Promise.all([
      fetchMovementHistory({ ...unit, id: queryId }),
      logScanEventAndPatch({
        slowLocationPromise,
        fastCoords: effectiveCoords,
        unitId: queryId,
        consumerReferenceCode: unit.consumerReferenceCode,
        scanType: 'consumer_scan',
        result: 'SUSPICIOUS',
        pinCheckResult: 'MATCH',
        baseRiskScore: 95,
      }),
    ]);

    const conf = computeConfidence({
      base: 90,
      positives: ['code_matched', 'pin_matched', 'unit_active'],
      signals: [
        {
          code: 'impossible_travel',
          label: riskInfo.impossibleTravel.impossibilityReason,
        },
      ],
    });

    writeToConsumerHistory({
      consumerUid,
      unitId: queryId,
      referenceCode: unit.consumerReferenceCode,
      result: 'SUSPICIOUS',
      productName,
      batchCode,
      claimCity,
      riskScore: 95,
      flaggedReason: riskInfo.impossibleTravel.impossibilityReason,
      isImpossible: true,
      confidence: conf.score,
      confidenceLabel: conf.label,
      signals: [
        {
          code: 'impossible_travel',
          label: riskInfo.impossibleTravel.impossibilityReason,
        },
      ],
      pinCheckResult: 'MATCH',
      travelVerdict: scanResult?.travelVerdict || 'IMPOSSIBLE',
      scanEventId: scanResult?.id || null,
    });

    emitProgress(onProgress, 'done', 100, 'Suspicious activity detected.');
    return {
      result: 'SUSPICIOUS',
      product: productName,
      batch: batchCode,
      unitId: queryId,
      riskScore: 95,
      confidence: conf.score,
      confidenceLabel: conf.label,
      confidenceReasons: conf.reasons,
      flaggedReason: riskInfo.impossibleTravel.impossibilityReason,
      impossibleTravel: riskInfo.impossibleTravel,
      history,
      scanEvent: scanResult,
    };
  }

  // ============================================================
  // HIGH RISK
  // ============================================================
  if (riskInfo.riskScore > 70) {
    const [history, scanResult] = await Promise.all([
      fetchMovementHistory({ ...unit, id: queryId }),
      logScanEventAndPatch({
        slowLocationPromise,
        fastCoords: effectiveCoords,
        unitId: queryId,
        consumerReferenceCode: unit.consumerReferenceCode,
        scanType: 'consumer_scan',
        result: 'SUSPICIOUS',
        pinCheckResult: 'MATCH',
        baseRiskScore: riskInfo.riskScore,
      }),
    ]);

    const conf = computeConfidence({
      base: 90,
      positives: ['code_matched', 'pin_matched', 'unit_active'],
      signals: [
        {
          code: 'many_recent_scans',
          label: riskInfo.flaggedReason || 'High risk pattern detected.',
        },
      ],
    });

    writeToConsumerHistory({
      consumerUid,
      unitId: queryId,
      referenceCode: unit.consumerReferenceCode,
      result: 'SUSPICIOUS',
      productName,
      batchCode,
      claimCity,
      riskScore: riskInfo.riskScore,
      flaggedReason: riskInfo.flaggedReason,
      isImpossible: false,
      confidence: conf.score,
      confidenceLabel: conf.label,
      signals: [
        {
          code: 'many_recent_scans',
          label: riskInfo.flaggedReason || 'High risk pattern detected.',
        },
      ],
      pinCheckResult: 'MATCH',
      travelVerdict: scanResult?.travelVerdict || 'OK',
      scanEventId: scanResult?.id || null,
    });

    emitProgress(onProgress, 'done', 100, 'High risk pattern detected.');
    return {
      result: 'SUSPICIOUS',
      product: productName,
      batch: batchCode,
      unitId: queryId,
      riskScore: riskInfo.riskScore,
      confidence: conf.score,
      confidenceLabel: conf.label,
      confidenceReasons: conf.reasons,
      flaggedReason: riskInfo.flaggedReason,
      history,
      scanEvent: scanResult,
    };
  }

  // ============================================================
  // IN TRANSIT
  // ============================================================
  if (unit.status === 'DISPATCHED' || unit.status === 'IN_TRANSIT') {
    const [history, expectedLocation, scanResult] = await Promise.all([
      fetchMovementHistory({ ...unit, id: queryId }),
      fetchExpectedLocation(unit),
      logScanEventAndPatch({
        slowLocationPromise,
        fastCoords: effectiveCoords,
        unitId: queryId,
        consumerReferenceCode: unit.consumerReferenceCode,
        scanType: 'consumer_scan',
        result: 'EXPECTED',
        pinCheckResult: 'MATCH',
        baseRiskScore: 10,
      }),
    ]);

    const conf = computeConfidence({
      base: 75,
      positives: ['code_matched', 'pin_matched'],
      signals: [
        {
          code: 'gps_ip_mismatch',
          label: 'Product is still marked as in transit.',
        },
      ],
    });

    writeToConsumerHistory({
      consumerUid,
      unitId: queryId,
      referenceCode: unit.consumerReferenceCode,
      result: 'EXPECTED',
      productName,
      batchCode,
      claimCity,
      riskScore: scanResult?.riskScore ?? 10,
      flaggedReason: null,
      isImpossible: false,
      confidence: conf.score,
      confidenceLabel: conf.label,
      signals: [],
      pinCheckResult: 'MATCH',
      travelVerdict: scanResult?.travelVerdict || 'OK',
      scanEventId: scanResult?.id || null,
    });

    emitProgress(onProgress, 'done', 100, 'In transit.');
    return {
      result: 'EXPECTED',
      product: productName,
      batch: batchCode,
      unitId: queryId,
      confidence: conf.score,
      confidenceLabel: conf.label,
      confidenceReasons: conf.reasons,
      expectedLocation,
      history,
      scanEvent: scanResult,
    };
  }

  // ============================================================
  // AUTHENTIC PATH
  // ============================================================
  // The claim check runs FIRST because it decides the result.
  // Only AFTER we know the outcome do we call logScanEventAndPatch.

  const currentScanAt = new Date().toISOString();

  // ---- 1. Claim check ----
  let claim = { status: 'skipped' };
  if (deviceId) {
    try {
      claim = await recordFirstClaim({
        unitId: queryId,
        deviceId,
        coords: effectiveCoords
          ? {
              lat: effectiveCoords.lat,
              lng: effectiveCoords.lng,
              accuracy: effectiveCoords.accuracy ?? null,
            }
          : null,
        city: claimCity,
        consumerRefCode: unit.consumerReferenceCode,
        currentScan: {
          lat: effectiveCoords?.lat ?? null,
          lng: effectiveCoords?.lng ?? null,
          city: claimCity?.city || null,
          state: claimCity?.state || null,
          at: currentScanAt,
        },
      });
    } catch (err) {
      console.warn('Claim check failed (non-fatal):', err);
      claim = { status: 'error', errorMessage: String(err) };
    }
  }

  // Schedule a background patch of the claim location if slow GPS
  // arrives later (only applies to fresh claims).
  if (claim.status === 'new_claim' && claim.claimId) {
    scheduleClaimLocationPatch({
      claimId: claim.claimId,
      slowLocationPromise,
      fastCoords: effectiveCoords,
    });
  }

  // ---- 2. Decide whether this is a hard duplicate ----
  let isHardDuplicate = false;
  let duplicateSignals = [];

  if (claim.status === 'claimed_elsewhere') {
    const distance = claim.distanceKm;
    const minutes = claim.minutesSinceClaim;

    const differentCity =
      distance != null && distance >= MIN_DISTANCE_FOR_DUPLICATE_KM;
    const tooSoon =
      minutes != null && minutes <= MAX_MINUTES_FOR_DUPLICATE;

    const legitimateTransfer = await hasLegitimateTransferBetween(
      queryId,
      claim.claimedAt,
      currentScanAt
    );

    isHardDuplicate = differentCity && tooSoon && !legitimateTransfer;

    if (isHardDuplicate) {
      duplicateSignals = [
        {
          code: 'claimed_by_other_device',
          severity: 'high',
          label:
            minutes != null
              ? `First claimed by another device ${formatDuration(minutes)}.`
              : 'First claimed by another device.',
        },
        {
          code: 'different_city',
          severity: 'high',
          label: claim.claimedCity
            ? `First scan was in ${claim.claimedCity}; this scan is about ${Math.round(
                distance
              )} km away.`
            : `First scan was about ${Math.round(distance)} km away.`,
        },
        {
          code: 'duplicate_code',
          severity: 'critical',
          label:
            'This code has been duplicated. Only one physical unit can legitimately carry this reference.',
        },
      ];
    }
  }

  // ---- 3. Log scan event with the correct result ----
  const finalResult = isHardDuplicate
    ? 'DUPLICATE_CODE'
    : claim.status === 'claimed_elsewhere'
    ? 'SUSPICIOUS'
    : 'AUTHENTIC';

  const finalBaseRisk = isHardDuplicate
    ? 100
    : claim.status === 'claimed_elsewhere'
    ? 80
    : 5;

  const scanResult = await logScanEventAndPatch({
    slowLocationPromise,
    fastCoords: effectiveCoords,
    unitId: queryId,
    consumerReferenceCode: unit.consumerReferenceCode,
    scanType: 'consumer_scan',
    result: finalResult,
    pinCheckResult: 'MATCH',
    baseRiskScore: finalBaseRisk,
  });

  // ---- 4. Hard duplicate ----
  if (isHardDuplicate) {
    const manufacturerId = await resolveManufacturerId(unit);

    openCase({
      type: 'DUPLICATE_CODE',
      severity: 'critical',
      unitId: queryId,
      referenceCode: unit.consumerReferenceCode || null,
      manufacturerId,
      productName,
      batchCode,
      signals: duplicateSignals,
      firstClaim: {
        deviceId: claim.firstDeviceId,
        claimedAt: claim.claimedAt,
        claimedCity: claim.claimedCity,
        claimedFrom: claim.claimedFrom,
      },
      currentScan: {
        deviceId: claim.currentDeviceId,
        scanAt: currentScanAt,
        scanCity: claimCity
          ? `${claimCity.city}, ${claimCity.state}`
          : null,
        scanCoords: effectiveCoords,
      },
      distanceKm: claim.distanceKm,
      minutesElapsed: claim.minutesSinceClaim,
      evidence: {
        deviceId: claim.currentDeviceId,
        coordinates: effectiveCoords,
        userAgent:
          typeof navigator !== 'undefined' ? navigator.userAgent : null,
        timezone:
          typeof Intl !== 'undefined'
            ? Intl.DateTimeFormat().resolvedOptions().timeZone
            : null,
      },
    }).catch((err) => console.warn('openCase failed:', err));

    writeToConsumerHistory({
      consumerUid,
      unitId: queryId,
      referenceCode: unit.consumerReferenceCode,
      result: 'DUPLICATE_CODE',
      productName: null,
      batchCode: null,
      claimCity,
      riskScore: 100,
      flaggedReason: 'This code has been duplicated.',
      isImpossible: false,
      confidence: 5,
      confidenceLabel: 'Low confidence',
      signals: duplicateSignals,
      pinCheckResult: 'MATCH',
      travelVerdict: scanResult?.travelVerdict || 'OK',
      scanEventId: scanResult?.id || null,
    });

    emitProgress(onProgress, 'done', 100, 'Duplicate code detected.');
    return {
      result: 'DUPLICATE_CODE',
      reason: 'DUPLICATE_CODE',
      message:
        'This code has been duplicated. Only one physical unit can legitimately carry this reference. ' +
        'The product you are holding is almost certainly a copy of a genuine label.',
      confidence: 5,
      confidenceLabel: 'Low confidence',
      confidenceReasons: duplicateSignals.map((s) => s.label),
      signals: duplicateSignals,
      caseOpened: true,
      _diagnostic: {
        distanceKm: claim.distanceKm,
        minutesElapsed: claim.minutesSinceClaim,
        claimedCity: claim.claimedCity,
      },
    };
  }

  // ---- 5. Soft claim collision ----
  if (claim.status === 'claimed_elsewhere') {
    const signals = [
      {
        code: 'claimed_by_other_device',
        severity: 'high',
        label:
          claim.minutesSinceClaim != null
            ? `Previously verified on another device ${formatDuration(
                claim.minutesSinceClaim
              )}.`
            : 'Previously verified on another device.',
      },
      {
        code: 'pin_already_used',
        severity: 'high',
        label: 'This PIN has already been used to verify this product.',
      },
    ];

    if (claim.distanceKm != null && claim.distanceKm > 50) {
      signals.push({
        code: 'far_from_previous_scan',
        severity: claim.distanceKm > 500 ? 'high' : 'medium',
        label: `The first scan happened about ${Math.round(
          claim.distanceKm
        )} km away.`,
      });
    }

    const conf = computeConfidence({
      base: 55,
      positives: ['code_matched', 'pin_matched', 'unit_active'],
      signals,
    });

    writeToConsumerHistory({
      consumerUid,
      unitId: queryId,
      referenceCode: unit.consumerReferenceCode,
      result: 'SUSPICIOUS',
      productName,
      batchCode,
      claimCity,
      riskScore: 80,
      flaggedReason: 'PIN already used on another device.',
      isImpossible: false,
      confidence: conf.score,
      confidenceLabel: conf.label,
      signals,
      pinCheckResult: 'MATCH',
      travelVerdict: scanResult?.travelVerdict || 'OK',
      scanEventId: scanResult?.id || null,
    });

    emitProgress(onProgress, 'done', 100, 'PIN already used.');
    return {
      result: 'SUSPICIOUS',
      reason: 'PIN_ALREADY_USED',
      product: productName,
      batch: batchCode,
      unitId: queryId,
      riskScore: 80,
      confidence: conf.score,
      confidenceLabel: conf.label,
      confidenceReasons: conf.reasons,
      message:
        'The PIN on this product has already been used to verify another unit. ' +
        'If you scratched the panel yourself and this is your first scan, ' +
        'please contact the seller — the label may have been tampered with or copied. ' +
        'If you bought this from a shop, do not consume the product until you ' +
        'confirm its authenticity with the seller or the Konfa team.',
      signals,
      history: await fetchMovementHistory({ ...unit, id: queryId }),
      currentScanLocation: claimCity
        ? `${claimCity.city}, ${claimCity.state}`
        : null,
      flaggedReason: 'PIN already used on another device.',
      scanEvent: scanResult,
    };
  }

  // ---- 6. AUTHENTIC ----
  const history = await fetchMovementHistory({ ...unit, id: queryId });

  const signals = [];
  const positives = ['code_matched', 'pin_matched', 'unit_active'];

  if (claim.status === 'new_claim') {
    signals.push({
      code: 'first_claim',
      label:
        'This is the first time this product has been verified. It is now linked to your device.',
      severity: 'info',
    });
    positives.push('first_claim');
  }

  if (!effectiveCoords) {
    signals.push({
      code: 'location_unavailable',
      label:
        'Location was unavailable for this scan — the check is slightly weaker without it.',
    });
  }

  if (typeof timeToEnterPinMs === 'number' && timeToEnterPinMs < 1500) {
    signals.push({
      code: 'too_fast_for_human',
      label:
        'The PIN was submitted very quickly — this may be an automated tool.',
    });
  }

  const conf = computeConfidence({
    base: 93,
    positives,
    signals,
  });

  writeToConsumerHistory({
    consumerUid,
    unitId: queryId,
    referenceCode: unit.consumerReferenceCode,
    result: 'AUTHENTIC',
    productName,
    batchCode,
    claimCity,
    riskScore: scanResult?.riskScore ?? 5,
    flaggedReason: null,
    isImpossible: false,
    confidence: conf.score,
    confidenceLabel: conf.label,
    signals,
    pinCheckResult: 'MATCH',
    travelVerdict: scanResult?.travelVerdict || 'OK',
    scanEventId: scanResult?.id || null,
  });

  emitProgress(onProgress, 'done', 100, 'Verified.');

  return {
    result: 'AUTHENTIC',
    product: productName,
    batch: batchCode,
    unitId: queryId,
    confidence: conf.score,
    confidenceLabel: conf.label,
    confidenceReasons: conf.reasons,
    history,
    signals,
    scanEvent: scanResult,
  };
};

// ============================================================
// reportProblem
// ============================================================
export const reportProblem = async ({
  unitId,
  referenceCode,
  reason,
  contact,
}) => {
  try {
    let resolvedUnitId = unitId;
    if (!resolvedUnitId && referenceCode) {
      const unit = await findUnitByReference(referenceCode);
      resolvedUnitId = unit?._internalId || unit?._firestoreId || null;
    }

    const docRef = await addDoc(collection(db, 'consumer_reports'), {
      unitId: resolvedUnitId || null,
      reporterContact: contact || null,
      reason,
      status: 'open',
      createdAt: serverTimestamp(),
      referenceCode: formatRefCode(referenceCode),
    });

    return { success: true, reportId: docRef.id };
  } catch (err) {
    console.error('Failed to submit report:', err);
    return { success: false, error: err.message };
  }
};

// ============================================================
// markUnitAsCounterfeit
// ============================================================
export const markUnitAsCounterfeit = async (unitId, adminNote = '') => {
  try {
    await updateDoc(doc(db, 'units', unitId), {
      status: 'COUNTERFEIT',
      adminNote,
      flaggedAt: serverTimestamp(),
    });
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
};

// ============================================================
// checkReferenceCode
// ============================================================
export const checkReferenceCode = async (rawRefCode) => {
  const refCode = normalizeRefCode(rawRefCode);
  if (!refCode) return { exists: false, reason: 'EMPTY' };

  const dashed = formatRefCode(rawRefCode);
  const stripped = refCode;
  const candidates = Array.from(new Set([dashed, stripped].filter(Boolean)));

  const unitsRef = collection(db, 'units');

  const fieldsToTry = [
    'consumerReferenceCode',
    'referenceCode',
    'refCode',
    'code',
    'consumerBarcodeToken',
    'barcodeToken',
    'token',
  ];

  let lastError = null;

  for (const candidate of candidates) {
    for (const field of fieldsToTry) {
      try {
        const snap = await getDocs(
          query(unitsRef, where(field, '==', candidate), limit(1))
        );
        if (!snap.empty) {
          console.log(
            `✅ checkReferenceCode found unit via ${field}=${candidate}`
          );
          return { exists: true, refCode: candidate, matchedField: field };
        }
      } catch (err) {
        if (!lastError) lastError = err;
      }
    }
  }

  if (lastError) {
    console.error(
      '❌ checkReferenceCode lookup failed:',
      lastError.code,
      lastError.message
    );
    return {
      exists: false,
      reason: 'DB_ERROR',
      errorCode: lastError.code,
      errorMessage: lastError.message,
    };
  }

  return { exists: false, reason: 'NOT_FOUND' };
};

// ============================================================
// Get most recent scan for a unit
// ============================================================
export async function getMostRecentScan(unitId) {
  if (!unitId) return null;
  try {
    const snap = await getDocs(
      query(
        collection(db, 'scan_events'),
        where('unitId', '==', unitId),
        limit(10)
      )
    );
    const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    list.sort(
      (a, b) =>
        new Date(b.timestamp || b.scannedAt || 0) -
        new Date(a.timestamp || a.scannedAt || 0)
    );
    return list[0] || null;
  } catch (err) {
    console.warn('getMostRecentScan failed:', err.code);
    return null;
  }
}