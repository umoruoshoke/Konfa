// src/Pages/nigeriaCities.js
// ============================================================
// Nigerian cities + geographic helpers used for scan-event
// location tagging and the "impossible travel" anti-counterfeit
// check.
//
// We use a static table instead of an external geocoding API so
// that:
//   1. No API key is required.
//   2. Scans work offline (the nearest-city lookup is pure JS).
//   3. There's no rate limit — customers can scan all day.
//
// Accuracy: within 10–30 km for most Nigerian cities, which is
// more than enough to distinguish Kaduna from Auchi (700 km apart).
// ============================================================

// [name, state, lat, lng]
export const NIGERIA_CITIES = [
  ['Lagos',           'Lagos',        6.5244,  3.3792],
  ['Ikeja',           'Lagos',        6.6018,  3.3515],
  ['Lekki',           'Lagos',        6.4698,  3.5852],
  ['Ikorodu',         'Lagos',        6.6194,  3.5105],
  ['Epe',             'Lagos',        6.5844,  3.9828],
  ['Badagry',         'Lagos',        6.4315,  2.8876],
  ['Eko Atlantic',    'Lagos',        6.4083,  3.4048],

  ['Abuja',           'FCT',          9.0765,  7.3986],
  ['Gwagwalada',      'FCT',          8.9414,  7.0776],
  ['Kuje',            'FCT',          8.8796,  7.2273],
  ['Kwali',           'FCT',          8.8833,  7.0167],

  ['Kano',            'Kano',        12.0022,  8.5920],
  ['Wudil',           'Kano',        11.8089,  8.8444],
  ['Gwarzo',          'Kano',        11.9172,  7.9333],

  ['Kaduna',          'Kaduna',      10.5222,  7.4383],
  ['Zaria',           'Kaduna',      11.0855,  7.7199],
  ['Kafanchan',       'Kaduna',       9.5817,  8.2936],

  ['Port Harcourt',   'Rivers',       4.8156,  7.0498],
  ['Bonny',           'Rivers',       4.4500,  7.1667],
  ['Eleme',           'Rivers',       4.7833,  7.1167],
  ['Okrika',          'Rivers',       4.7333,  7.0833],

  ['Benin City',      'Edo',          6.3176,  5.6145],
  ['Auchi',           'Edo',          7.0667,  6.2667],
  ['Ekpoma',          'Edo',          6.7500,  6.1333],
  ['Uromi',           'Edo',          6.7000,  6.3333],
  ['Igarra',          'Edo',          7.2833,  6.1000],
  ['Sabongida-Ora',   'Edo',          6.9167,  5.9667],
  ['Ubiaja',          'Edo',          6.6500,  6.3333],

  ['Ibadan',          'Oyo',          7.3775,  3.9470],
  ['Ogbomoso',        'Oyo',          8.1333,  4.2500],
  ['Oyo',             'Oyo',          7.8500,  3.9333],

  ['Enugu',           'Enugu',        6.5244,  7.5103],
  ['Nsukka',          'Enugu',        6.8567,  7.3958],

  ['Aba',             'Abia',         5.1167,  7.3667],
  ['Umuahia',         'Abia',         5.5333,  7.4833],

  ['Onitsha',         'Anambra',      6.1400,  6.8000],
  ['Awka',            'Anambra',      6.2109,  7.0740],
  ['Nnewi',           'Anambra',      6.0167,  6.9167],

  ['Jos',             'Plateau',      9.8965,  8.8583],
  ['Bukuru',          'Plateau',      9.7833,  8.8667],

  ['Maiduguri',       'Borno',       11.8333, 13.1500],
  ['Biu',             'Borno',       10.6167, 12.1833],

  ['Sokoto',          'Sokoto',      13.0059,  5.2476],
  ['Katsina',         'Katsina',     12.9908,  7.6018],
  ['Daura',           'Katsina',     13.0333,  8.3167],

  ['Kebbi',           'Kebbi',       12.4500,  4.2000],
  ['Birnin Kebbi',    'Kebbi',       12.4539,  4.1975],

  ['Minna',           'Niger',        9.6139,  6.5470],
  ['Bida',            'Niger',        9.0833,  6.0167],
  ['Suleja',          'Niger',        9.1833,  7.1833],

  ['Lokoja',          'Kogi',         7.8023,  6.7333],
  ['Okene',           'Kogi',         7.5500,  6.2333],
  ['Idah',            'Kogi',         7.1000,  6.7333],
  ['Anyigba',         'Kogi',         7.5000,  7.1833],

  ['Makurdi',         'Benue',        7.7322,  8.5391],
  ['Gboko',           'Benue',        7.3333,  9.0000],
  ['Otukpo',          'Benue',        7.1900,  8.1300],

  ['Yola',            'Adamawa',      9.2035, 12.4954],
  ['Mubi',            'Adamawa',     10.2667, 13.2667],

  ['Bauchi',          'Bauchi',       10.3103,  9.8439],
  ['Azare',           'Bauchi',       11.6750, 10.1917],

  ['Gombe',           'Gombe',        10.2897, 11.1673],

  ['Damaturu',        'Yobe',         11.7479, 11.9660],

  ['Jalingo',         'Taraba',        8.8833, 11.3667],
  ['Wukari',          'Taraba',        7.8500,  9.7833],

  ['Lafia',           'Nasarawa',      8.4939,  8.5157],
  ['Keffi',           'Nasarawa',      8.8481,  7.8736],
  ['Akwanga',         'Nasarawa',      8.9167,  8.4000],

  ['Owerri',          'Imo',           5.4836,  7.0333],
  ['Orlu',            'Imo',           5.7833,  7.0333],

  ['Uyo',             'Akwa Ibom',     5.0378,  7.9128],
  ['Eket',            'Akwa Ibom',     4.6417,  7.9244],

  ['Calabar',         'Cross River',   4.9757,  8.3417],
  ['Ogoja',           'Cross River',   6.6583,  8.7983],
  ['Ikom',            'Cross River',   5.9667,  8.7167],

  ['Warri',           'Delta',         5.5167,  5.7500],
  ['Asaba',           'Delta',         6.1986,  6.7313],
  ['Sapele',          'Delta',         5.8900,  5.6800],
  ['Ughelli',         'Delta',         5.5000,  5.9833],
  ['Agbor',           'Delta',         6.2500,  6.2000],

  ['Osogbo',          'Osun',          7.7719,  4.5569],
  ['Ile-Ife',         'Osun',          7.4667,  4.5667],
  ['Ilesa',           'Osun',          7.6167,  4.7333],
  ['Ede',             'Osun',          7.7333,  4.4333],

  ['Abeokuta',        'Ogun',          7.1557,  3.3451],
  ['Sagamu',          'Ogun',          6.8486,  3.6472],
  ['Ijebu-Ode',       'Ogun',          6.8167,  3.9333],
  ['Ota',             'Ogun',          6.6797,  3.2344],

  ['Akure',           'Ondo',          7.2571,  5.2058],
  ['Ondo',            'Ondo',          7.1000,  4.8333],
  ['Owo',             'Ondo',          7.1961,  5.5869],

  ['Ado-Ekiti',       'Ekiti',         7.6211,  5.2214],
  ['Ikere-Ekiti',     'Ekiti',         7.5000,  5.2333],

  ['Gusau',           'Zamfara',      12.1628,  6.6614],

  ['Dutse',           'Jigawa',       11.7564,  9.3386],
  ['Hadejia',         'Jigawa',       12.4497, 10.0411],

  ['Bida',            'Niger',         9.0833,  6.0167],
];

// ============================================================
// Haversine — great-circle distance between two lat/lng points
// Returns kilometers.
// ============================================================
export function haversineKm(lat1, lng1, lat2, lng2) {
  if (
    lat1 == null || lng1 == null ||
    lat2 == null || lng2 == null
  ) return null;

  const R = 6371; // Earth radius in km
  const toRad = (d) => (d * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLng / 2) ** 2;

  return 2 * R * Math.asin(Math.sqrt(a));
}

// ============================================================
// Nearest city lookup
// ============================================================
// Given a lat/lng, find the closest Nigerian city in the table.
// Returns:
//   {
//     city: 'Kaduna',
//     state: 'Kaduna',
//     lat, lng,
//     distanceKm: 12.3,
//     withinNigeria: true/false
//   }
// Returns null if coordinates are invalid.
// ============================================================
export function nearestCity(lat, lng) {
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
    // A rough bounding-box check for Nigeria
    withinNigeria:
      lat >= 3.5 && lat <= 14.0 &&
      lng >= 2.5 && lng <= 15.0,
  };
}

// ============================================================
// "Impossible travel" judgment
// ============================================================
// Given the previous scan and the current scan, decide whether
// the product could physically have moved between the two points
// in the elapsed time.
//
// Returns:
//   {
//     isImpossible: bool,
//     requiredSpeedKmh: number,   // km/h needed to make the trip
//     distanceKm: number,
//     minutesElapsed: number,
//     verdict: 'OK' | 'FAST' | 'IMPOSSIBLE' | 'FLAGGED',
//     reason: 'human-readable explanation'
//   }
// ============================================================
export function assessImpossibleTravel(prevScan, currScan) {
  if (!prevScan || !currScan) {
    return {
      isImpossible: false,
      requiredSpeedKmh: 0,
      distanceKm: 0,
      minutesElapsed: 0,
      verdict: 'OK',
      reason: 'No previous scan to compare against.',
    };
  }

  const prevLat = prevScan.locationLat;
  const prevLng = prevScan.locationLng;
  const currLat = currScan.locationLat;
  const currLng = currScan.locationLng;

  if (
    prevLat == null || prevLng == null ||
    currLat == null || currLng == null
  ) {
    return {
      isImpossible: false,
      requiredSpeedKmh: 0,
      distanceKm: 0,
      minutesElapsed: 0,
      verdict: 'OK',
      reason: 'Insufficient location data for one of the scans.',
    };
  }

  const distanceKm = haversineKm(prevLat, prevLng, currLat, currLng);
  const prevTime = new Date(prevScan.timestamp || prevScan.scannedAt).getTime();
  const currTime = new Date(currScan.timestamp || currScan.scannedAt).getTime();

  const elapsedMs = currTime - prevTime;
  const minutesElapsed = Math.max(0, elapsedMs / 60000);

  if (minutesElapsed === 0 || distanceKm == null) {
    return {
      isImpossible: false,
      requiredSpeedKmh: 0,
      distanceKm: distanceKm || 0,
      minutesElapsed,
      verdict: 'OK',
      reason: 'No elapsed time between scans.',
    };
  }

  const hoursElapsed = minutesElapsed / 60;
  const requiredSpeedKmh = distanceKm / hoursElapsed;

  // ---- Verdict thresholds ----
  // Commercial jets cruise at 800-900 km/h, but a product isn't
  // magically loaded onto a plane within an hour of being scanned
  // in a market. So we're strict:
  //   - Under 150 km/h → a normal road trip. Fine.
  //   - 150-800 km/h → possible by air, but unusual for a product.
  //   - Over 800 km/h → faster than any commercial flight. Impossible.
  let verdict;
  let reason;

  if (requiredSpeedKmh <= 150) {
    verdict = 'OK';
    reason = `Product moved ${Math.round(distanceKm)} km in ${Math.round(minutesElapsed)} minutes (${Math.round(requiredSpeedKmh)} km/h) — physically possible.`;
  } else if (requiredSpeedKmh <= 800) {
    verdict = 'FAST';
    reason = `Product moved ${Math.round(distanceKm)} km in ${Math.round(minutesElapsed)} minutes (${Math.round(requiredSpeedKmh)} km/h). This requires air travel — unusual.`;
  } else {
    verdict = 'IMPOSSIBLE';
    reason = `Product was in "${prevScan.locationCity || 'unknown'}" ${Math.round(minutesElapsed)} minutes ago and is now being scanned ${Math.round(distanceKm)} km away. That would require ${Math.round(requiredSpeedKmh)} km/h — faster than any commercial flight. This code has been duplicated.`;
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