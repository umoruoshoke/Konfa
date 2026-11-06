// src/admin/scanAnalytics.js
// ============================================================
// Data fetching + aggregation for the Scan Analytics dashboard.
// ============================================================

import {
  collection,
  query,
  getDocs,
  orderBy,
  limit,
  doc,
  getDoc,
} from 'firebase/firestore';
import { db } from '../firebase';

// ============================================================
// NIGERIAN CITIES
// ============================================================
const CITIES = [
  ['Lagos', 'Lagos', 6.5244, 3.3792],
  ['Abuja', 'FCT', 9.0765, 7.3986],
  ['Kano', 'Kano', 12.0022, 8.5920],
  ['Kaduna', 'Kaduna', 10.5222, 7.4383],
  ['Port Harcourt', 'Rivers', 4.8156, 7.0498],
  ['Benin City', 'Edo', 6.3176, 5.6145],
  ['Auchi', 'Edo', 7.0667, 6.2667],
  ['Ibadan', 'Oyo', 7.3775, 3.9470],
  ['Enugu', 'Enugu', 6.5244, 7.5103],
  ['Uyo', 'Akwa Ibom', 5.0378, 7.9128],
  ['Onitsha', 'Anambra', 6.1400, 6.8000],
  ['Abeokuta', 'Ogun', 7.1557, 3.3451],
  ['Jos', 'Plateau', 9.8965, 8.8583],
  ['Maiduguri', 'Borno', 11.8333, 13.1500],
  ['Sokoto', 'Sokoto', 13.0059, 5.2476],
  ['Warri', 'Delta', 5.5167, 5.7500],
  ['Calabar', 'Cross River', 4.9757, 8.3417],
  ['Makurdi', 'Benue', 7.7322, 8.5391],
  ['Owerri', 'Imo', 5.4836, 7.0333],
  ['Akure', 'Ondo', 7.2571, 5.2058],
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
  let best = null;
  let bestDist = Infinity;
  for (const [city, state, cLat, cLng] of CITIES) {
    const d = haversineKm(lat, lng, cLat, cLng);
    if (d != null && d < bestDist) {
      bestDist = d;
      best = { city, state };
    }
  }
  return best;
}

function normalizeScan(docSnap) {
  const data = docSnap.data();

  let city = data.locationCity || null;
  let state = data.locationState || null;
  if (!city && data.locationLat != null && data.locationLng != null) {
    const geo = nearestCity(data.locationLat, data.locationLng);
    if (geo) {
      city = geo.city;
      state = geo.state;
    }
  }

  const ts =
    data.timestamp ||
    data.scannedAt?.toDate?.()?.toISOString?.() ||
    null;

  return {
    id: docSnap.id,
    unitId: data.unitId || null,
    consumerReferenceCode: data.consumerReferenceCode || null,
    scanType: data.scanType || 'consumer_scan',
    result: data.result || 'UNKNOWN',
    pinCheckResult: data.pinCheckResult || null,
    riskScore: data.riskScore ?? 0,
    flaggedReason: data.flagReason || data.flaggedReason || null,

    locationCity: city,
    locationState: state,
    locationRegion:
      data.locationRegion || (city ? `${city}${state ? `, ${state}` : ''}` : null),
    locationLat: data.locationLat ?? null,
    locationLng: data.locationLng ?? null,
    withinNigeria: data.withinNigeria ?? null,
    locationSource: data.locationSource || null,

    timestamp: ts,
    timestampMs: ts ? new Date(ts).getTime() : 0,

    deviceUserAgent: data.deviceUserAgent || null,
    devicePlatform: data.devicePlatform || null,
    deviceLanguage: data.deviceLanguage || null,
    deviceTimezone: data.deviceTimezone || null,

    isPhysicallyImpossible: data.isPhysicallyImpossible === true,
    impossibilityReason: data.impossibilityReason || null,
    distanceFromPreviousKm: data.distanceFromPreviousKm ?? null,
    minutesSincePrevious: data.minutesSincePrevious ?? null,
    requiredSpeedKmh: data.requiredSpeedKmh ?? null,
    travelVerdict: data.travelVerdict || null,

    previousScanCity: data.previousScanCity || null,
    previousScanTimestamp: data.previousScanTimestamp || null,
  };
}

export async function fetchAllScans({ max = 5000 } = {}) {
  const ref = collection(db, 'scan_events');
  let docs = [];

  try {
    const snap = await getDocs(query(ref, orderBy('timestamp', 'desc'), limit(max)));
    docs = snap.docs;
  } catch (err) {
    console.warn('scan_events ordered query failed, falling back:', err.code);
    const snap = await getDocs(query(ref, limit(max)));
    docs = snap.docs;
  }

  const scans = docs.map(normalizeScan);
  scans.sort((a, b) => b.timestampMs - a.timestampMs);
  return scans;
}

// ============================================================
// UNIT META CACHE
// ============================================================
const unitCache = new Map();

export async function resolveUnitMeta(unitId) {
  if (!unitId) return null;
  if (unitCache.has(unitId)) return unitCache.get(unitId);

  try {
    const snap = await getDoc(doc(db, 'units', unitId));
    if (!snap.exists()) {
      unitCache.set(unitId, null);
      return null;
    }
    const unit = snap.data();

    let productName = unit.productName || null;
    let batchCode = unit.batchCode || null;

    if (unit.batchId && (!productName || !batchCode)) {
      try {
        const batchSnap = await getDoc(doc(db, 'batches', unit.batchId));
        if (batchSnap.exists()) {
          const batch = batchSnap.data();
          batchCode = batchCode || batch.batchCode || null;
          if (batch.productId && !productName) {
            const productSnap = await getDoc(doc(db, 'products', batch.productId));
            if (productSnap.exists()) {
              productName = productSnap.data().productName || null;
            }
          }
        }
      } catch {
        /* non-fatal */
      }
    }

    const meta = { productName, batchCode };
    unitCache.set(unitId, meta);
    return meta;
  } catch {
    unitCache.set(unitId, null);
    return null;
  }
}

// ============================================================
// DATE HELPERS
// ============================================================
export function getRangeStart(rangeKey) {
  const now = Date.now();
  const day = 24 * 60 * 60 * 1000;
  switch (rangeKey) {
    case '24h':
      return now - day;
    case '7d':
      return now - 7 * day;
    case '30d':
      return now - 30 * day;
    case '90d':
      return now - 90 * day;
    case 'all':
      return 0;
    default:
      return now - 7 * day;
  }
}

export const RANGE_OPTIONS = [
  { key: '24h', label: 'Last 24 hours' },
  { key: '7d', label: 'Last 7 days' },
  { key: '30d', label: 'Last 30 days' },
  { key: '90d', label: 'Last 90 days' },
  { key: 'all', label: 'All time' },
];

export function filterByRange(scans, rangeKey) {
  const start = getRangeStart(rangeKey);
  return scans.filter((s) => s.timestampMs >= start);
}

// ============================================================
// AGGREGATIONS
// ============================================================
export function buildTimeSeries(scans, rangeKey) {
  const now = Date.now();
  const start = getRangeStart(rangeKey);

  let bucketMs;
  let labelFn;

  if (rangeKey === '24h') {
    bucketMs = 60 * 60 * 1000;
    labelFn = (d) => d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } else if (rangeKey === '7d') {
    bucketMs = 6 * 60 * 60 * 1000;
    labelFn = (d) => {
      const h = d.getHours();
      const dayLabel = d.toLocaleDateString([], { day: '2-digit', month: 'short' });
      return `${dayLabel} ${String(h).padStart(2, '0')}h`;
    };
  } else if (rangeKey === 'all') {
    bucketMs = 7 * 24 * 60 * 60 * 1000;
    labelFn = (d) => d.toLocaleDateString([], { day: '2-digit', month: 'short' });
  } else {
    bucketMs = 24 * 60 * 60 * 1000;
    labelFn = (d) => d.toLocaleDateString([], { day: '2-digit', month: 'short' });
  }

  const end = now;
  const buckets = [];
  const firstBucketStart = Math.floor((start || (end - 30 * 24 * 60 * 60 * 1000)) / bucketMs) * bucketMs;

  for (let t = firstBucketStart; t <= end; t += bucketMs) {
    buckets.push({
      time: t,
      label: labelFn(new Date(t)),
      total: 0,
      authentic: 0,
      suspicious: 0,
      duplicate: 0,   // 🆕
      invalid: 0,
      expected: 0,
      impossible: 0,
    });
  }

  const indexFor = (ts) => Math.floor((ts - firstBucketStart) / bucketMs);

  for (const scan of scans) {
    if (!scan.timestampMs) continue;
    const idx = indexFor(scan.timestampMs);
    if (idx < 0 || idx >= buckets.length) continue;
    const b = buckets[idx];
    b.total += 1;
    if (scan.result === 'AUTHENTIC') b.authentic += 1;
    else if (scan.result === 'SUSPICIOUS') b.suspicious += 1;
    else if (scan.result === 'DUPLICATE_CODE') b.duplicate += 1;   // 🆕
    else if (scan.result === 'INVALID') b.invalid += 1;
    else if (scan.result === 'EXPECTED') b.expected += 1;
    if (scan.isPhysicallyImpossible) b.impossible += 1;
  }

  return buckets;
}

export function buildTopCities(scans, max = 10) {
  const map = new Map();
  for (const s of scans) {
    const key = s.locationCity || 'Unknown';
    if (!map.has(key)) {
      map.set(key, {
        city: key,
        state: s.locationState || '',
        total: 0,
        suspicious: 0,
        duplicate: 0,   // 🆕
        impossible: 0,
        authentic: 0,
        invalid: 0,
        expected: 0,
        riskScores: [],
      });
    }
    const row = map.get(key);
    row.total += 1;
    if (s.result === 'AUTHENTIC') row.authentic += 1;
    if (s.result === 'SUSPICIOUS') row.suspicious += 1;
    if (s.result === 'DUPLICATE_CODE') row.duplicate += 1;   // 🆕
    if (s.result === 'INVALID') row.invalid += 1;
    if (s.result === 'EXPECTED') row.expected += 1;
    if (s.isPhysicallyImpossible) row.impossible += 1;
    if (typeof s.riskScore === 'number') row.riskScores.push(s.riskScore);
  }

  const rows = Array.from(map.values());
  rows.sort((a, b) => b.total - a.total);
  return rows.slice(0, max).map((r) => {
    const { riskScores, ...rest } = r;
    const avgRisk = riskScores.length ? Math.round(riskScores.reduce((s, v) => s + v, 0) / riskScores.length) : 0;
    return {
      ...rest,
      riskPct: r.total > 0 ? Math.round(((r.suspicious + r.duplicate) / r.total) * 100) : 0,
      avgRisk,
    };
  });
}

export function buildResultDistribution(scans) {
  const counts = {
    AUTHENTIC: 0,
    SUSPICIOUS: 0,
    INVALID: 0,
    EXPECTED: 0,
    NOT_YET_RELEASED: 0,
    DUPLICATE_CODE: 0,   // 🆕
  };
  for (const s of scans) {
    if (counts[s.result] !== undefined) counts[s.result] += 1;
  }
  const COLORS = {
    AUTHENTIC: '#16a34a',
    SUSPICIOUS: '#dc2626',
    INVALID: '#991b1b',
    EXPECTED: '#d97706',
    NOT_YET_RELEASED: '#7c3aed',
    DUPLICATE_CODE: '#7f1d1d',   // 🆕 darkest red
  };
  return Object.entries(counts)
    .filter(([, v]) => v > 0)
    .map(([k, v]) => ({
      name: prettifyResult(k),
      key: k,
      value: v,
      color: COLORS[k] || '#64748b',
    }));
}

export function buildImpossibilitySeries(scans) {
  const map = new Map();
  for (const s of scans) {
    if (!s.isPhysicallyImpossible) continue;
    const d = new Date(s.timestampMs);
    const key = d.toISOString().slice(0, 10);
    map.set(key, (map.get(key) || 0) + 1);
  }
  return Array.from(map.entries())
    .map(([date, count]) => ({
      date,
      label: new Date(date).toLocaleDateString([], { day: '2-digit', month: 'short' }),
      count,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

export function buildDeviceBreakdown(scans) {
  const map = new Map();
  for (const s of scans) {
    const key = s.devicePlatform || 'Unknown';
    map.set(key, (map.get(key) || 0) + 1);
  }
  return Array.from(map.entries())
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);
}

export function buildTimezoneBreakdown(scans) {
  const map = new Map();
  for (const s of scans) {
    const key = s.deviceTimezone || 'Unknown';
    map.set(key, (map.get(key) || 0) + 1);
  }
  return Array.from(map.entries())
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);
}

export function buildHourlyRisk(scans) {
  const buckets = new Array(24).fill(0).map(() => ({ total: 0, flagged: 0 }));
  for (const s of scans) {
    if (!s.timestampMs) continue;
    const h = new Date(s.timestampMs).getHours();
    buckets[h].total += 1;
    if (
      s.result === 'SUSPICIOUS' ||
      s.result === 'INVALID' ||
      s.result === 'DUPLICATE_CODE'
    ) {
      buckets[h].flagged += 1;
    }
  }
  return buckets.map((b, h) => ({
    hour: h,
    label: `${String(h).padStart(2, '0')}:00`,
    total: b.total,
    flagged: b.flagged,
    riskPct: b.total > 0 ? Math.round((b.flagged / b.total) * 100) : 0,
  }));
}

export function buildWeekdayRisk(scans) {
  const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const buckets = new Array(7).fill(0).map(() => ({ total: 0, flagged: 0 }));
  for (const s of scans) {
    if (!s.timestampMs) continue;
    const d = new Date(s.timestampMs).getDay();
    buckets[d].total += 1;
    if (
      s.result === 'SUSPICIOUS' ||
      s.result === 'INVALID' ||
      s.result === 'DUPLICATE_CODE'
    ) {
      buckets[d].flagged += 1;
    }
  }
  return buckets.map((b, i) => ({
    day: DAYS[i],
    total: b.total,
    flagged: b.flagged,
    riskPct: b.total > 0 ? Math.round((b.flagged / b.total) * 100) : 0,
  }));
}

// High-risk units — units scanned more than once with any suspicious
export function buildHighRiskUnits(scans, max = 20) {
  const map = new Map();
  for (const s of scans) {
    if (!s.unitId) continue;
    if (!map.has(s.unitId)) {
      map.set(s.unitId, {
        unitId: s.unitId,
        referenceCode: s.consumerReferenceCode,
        scans: 0,
        suspicious: 0,
        duplicate: 0,   // 🆕
        impossible: 0,
        cities: new Set(),
        lastScanTs: 0,
      });
    }
    const row = map.get(s.unitId);
    row.scans += 1;
    if (s.result === 'SUSPICIOUS' || s.result === 'INVALID') row.suspicious += 1;
    if (s.result === 'DUPLICATE_CODE') row.duplicate += 1;   // 🆕
    if (s.isPhysicallyImpossible) row.impossible += 1;
    if (s.locationCity) row.cities.add(s.locationCity);
    if (s.timestampMs > row.lastScanTs) row.lastScanTs = s.timestampMs;
  }
  return Array.from(map.values())
    .map((r) => ({
      ...r,
      cities: Array.from(r.cities),
      cityCount: r.cities.length,
    }))
    .filter((r) => r.suspicious > 0 || r.impossible > 0 || r.duplicate > 0)   // 🆕
    .sort(
      (a, b) =>
        b.duplicate - a.duplicate ||   // 🆕 duplicates first
        b.impossible - a.impossible ||
        b.suspicious - a.suspicious ||
        b.scans - a.scans
    )
    .slice(0, max);
}

// Geographic spread — count of unique cities per result type
export function buildGeoSpread(scans) {
  const byCity = new Map();
  for (const s of scans) {
    const key = s.locationCity || 'Unknown';
    if (!byCity.has(key)) {
      byCity.set(key, {
        city: key,
        state: s.locationState || '',
        lat: s.locationLat,
        lng: s.locationLng,
        total: 0,
        authentic: 0,
        suspicious: 0,
        duplicate: 0,   // 🆕
        invalid: 0,
      });
    }
    const row = byCity.get(key);
    row.total += 1;
    if (s.result === 'AUTHENTIC') row.authentic += 1;
    if (s.result === 'SUSPICIOUS') row.suspicious += 1;
    if (s.result === 'DUPLICATE_CODE') row.duplicate += 1;   // 🆕
    if (s.result === 'INVALID') row.invalid += 1;
    if (!row.lat && s.locationLat) {
      row.lat = s.locationLat;
      row.lng = s.locationLng;
    }
  }
  return Array.from(byCity.values()).sort((a, b) => b.total - a.total);
}

export function buildSummaryStats(scans) {
  const total = scans.length;
  const authentic = scans.filter((s) => s.result === 'AUTHENTIC').length;
  const suspicious = scans.filter((s) => s.result === 'SUSPICIOUS').length;
  const duplicate = scans.filter((s) => s.result === 'DUPLICATE_CODE').length;   // 🆕
  const invalid = scans.filter((s) => s.result === 'INVALID').length;
  const expected = scans.filter((s) => s.result === 'EXPECTED').length;
  const impossible = scans.filter((s) => s.isPhysicallyImpossible).length;
  const cities = new Set(scans.map((s) => s.locationCity).filter(Boolean)).size;
  const uniqueUnits = new Set(scans.map((s) => s.unitId).filter(Boolean)).size;

  return {
    total,
    authentic,
    suspicious,
    duplicate,   // 🆕
    invalid,
    expected,
    impossible,
    cities,
    uniqueUnits,
    flagRate:
      total > 0
        ? Math.round(((suspicious + invalid + duplicate) / total) * 100)
        : 0,
    impossibleRate: total > 0 ? Math.round((impossible / total) * 100) : 0,
  };
}

// ============================================================
// FORMATTERS
// ============================================================
export function prettifyResult(r) {
  return (
    {
      AUTHENTIC: 'Authentic',
      SUSPICIOUS: 'Suspicious',
      INVALID: 'Invalid',
      EXPECTED: 'Expected',
      NOT_YET_RELEASED: 'Not Released',
      DUPLICATE_CODE: 'Duplicate Code',   // 🆕
    }[r] || r
  );
}

export function formatDateTime(ts) {
  if (!ts) return '—';
  try {
    const d = new Date(ts);
    return d.toLocaleString([], {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '—';
  }
}

export function formatRelativeTime(ts) {
  if (!ts) return '—';
  try {
    const d = new Date(ts);
    const diff = Date.now() - d.getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    if (days < 7) return `${days}d ago`;
    return d.toLocaleDateString([], { day: '2-digit', month: 'short' });
  } catch {
    return '—';
  }
}