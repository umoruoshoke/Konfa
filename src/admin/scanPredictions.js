// src/admin/scanPredictions.js
// ============================================================
// Client-side statistical forecasting for counterfeit hotspots.
//
// The model combines five signals:
//   1. Linear trend per city (last 21 days)
//   2. Weekday seasonality per city
//   3. Hour-of-day risk windows
//   4. Z-score anomaly on the most recent day
//   5. Multi-factor confidence (sample size, span, trend, recency)
//
// Output is fully explainable. Every number has a reason.
// ============================================================

function dayKey(ms) {
  const d = new Date(ms);
  return d.toISOString().slice(0, 10);
}

function startOfDay(ms) {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function linreg(ys, xs) {
  const n = ys.length;
  if (n < 2) return { slope: 0, intercept: ys[0] || 0, r2: 0 };

  const meanX = xs.reduce((s, v) => s + v, 0) / n;
  const meanY = ys.reduce((s, v) => s + v, 0) / n;

  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    num += (xs[i] - meanX) * (ys[i] - meanY);
    den += (xs[i] - meanX) ** 2;
  }
  const slope = den === 0 ? 0 : num / den;
  const intercept = meanY - slope * meanX;

  let ssRes = 0;
  let ssTot = 0;
  for (let i = 0; i < n; i++) {
    const pred = intercept + slope * xs[i];
    ssRes += (ys[i] - pred) ** 2;
    ssTot += (ys[i] - meanY) ** 2;
  }
  const r2 = ssTot === 0 ? 0 : Math.max(0, 1 - ssRes / ssTot);

  return { slope, intercept, r2 };
}

function mean(arr) {
  if (!arr.length) return 0;
  return arr.reduce((s, v) => s + v, 0) / arr.length;
}

function stdev(arr) {
  if (arr.length < 2) return 0;
  const m = mean(arr);
  return Math.sqrt(arr.reduce((s, v) => s + (v - m) ** 2, 0) / (arr.length - 1));
}

// ============================================================
// AGGREGATE SCANS BY CITY / DAY
// ============================================================
function groupByCityAndDay(scans, minDateMs) {
  const map = new Map();

  for (const s of scans) {
    if (!s.timestampMs || s.timestampMs < minDateMs) continue;
    const city = s.locationCity;
    if (!city) continue;
    const key = dayKey(s.timestampMs);

    if (!map.has(city)) map.set(city, new Map());
    const cityMap = map.get(city);
    if (!cityMap.has(key)) {
      cityMap.set(key, { total: 0, suspicious: 0, impossible: 0 });
    }
    const row = cityMap.get(key);
    row.total += 1;
    if (s.result === 'SUSPICIOUS' || s.result === 'INVALID') row.suspicious += 1;
    if (s.isPhysicallyImpossible) row.impossible += 1;
  }

  return map;
}

// ============================================================
// PER-CITY PREDICTION
// ============================================================
function predictCity(cityData, lookbackDays = 21) {
  const now = Date.now();
  const start = startOfDay(now - (lookbackDays - 1) * 86400000);

  const xs = [];
  const ys = [];
  const totals = [];
  const today = startOfDay(now);
  const todayKey = dayKey(today);

  let todayCount = 0;
  let todayTotal = 0;
  let daysWithData = 0;

  for (let i = 0; i < lookbackDays; i++) {
    const dayMs = start + i * 86400000;
    const key = dayKey(dayMs);
    const row = cityData.get(key);
    const y = row ? row.suspicious : 0;
    const t = row ? row.total : 0;
    if (t > 0) daysWithData += 1;
    xs.push(i);
    ys.push(y);
    totals.push(t);
    if (key === todayKey) {
      todayCount = y;
      todayTotal = t;
    }
  }

  const { slope, intercept, r2 } = linreg(ys, xs);
  const baseline = mean(ys);
  const sigma = stdev(ys);

  const predictions = [];
  let totalPredicted = 0;
  for (let d = lookbackDays; d < lookbackDays + 7; d++) {
    const raw = intercept + slope * d;
    const clipped = Math.max(0, Math.round(raw * 100) / 100);
    predictions.push(clipped);
    totalPredicted += clipped;
  }
  totalPredicted = Math.round(totalPredicted * 10) / 10;

  const zScore = sigma > 0 ? (todayCount - baseline) / sigma : 0;

  const trendRatio = baseline > 0 ? totalPredicted / (baseline * 7) : 0;
  const trendComponent = Math.min(100, trendRatio * 50);
  const anomalyComponent = Math.min(100, Math.max(0, zScore * 30));
  const riskScore = Math.round(0.6 * trendComponent + 0.4 * anomalyComponent);

  let verdict = 'NORMAL';
  if (zScore >= 3) verdict = 'CRITICAL';
  else if (zScore >= 2) verdict = 'ALERT';
  else if (zScore >= 1) verdict = 'WATCH';

  const baselineTotal = baseline * 7;
  const pctChange =
    baselineTotal > 0
      ? Math.round(((totalPredicted - baselineTotal) / baselineTotal) * 100)
      : 0;

  return {
    baseline,
    sigma,
    slope,
    intercept,
    r2,
    todayCount,
    todayTotal,
    daysWithData,
    zScore: Math.round(zScore * 100) / 100,
    trendRatio: Math.round(trendRatio * 100) / 100,
    predictions,
    totalPredicted,
    riskScore,
    verdict,
    pctChange,
  };
}

// ============================================================
// 🆕 MULTI-FACTOR CONFIDENCE
// ============================================================
// Replaces the old "0.5 + R² * 0.5" formula, which was always
// 50% for small noisy data.
//
// Now confidence is a weighted average of four signals:
//   - Sample size (35%)
//   - Data span across days (20%)
//   - Trend strength (25%)
//   - Recency (20%)
//
// Each maps to [0, 1]. Final range is 20%–95%.
function computeConfidence({
  totalScans,
  citiesAnalysed,
  daysWithAnyData,
  avgR2TopCities,
  recentRatio,
}) {
  // --- Sample size: 50 scans → 0.5, 500+ → 1.0 ---
  const sampleScore = Math.min(1, Math.log10(Math.max(totalScans, 1)) / Math.log10(500));

  // --- Cities analysed: 1 → 0.3, 5 → 1.0 ---
  const cityScore = Math.min(1, 0.3 + citiesAnalysed / 7);

  // --- Data span: 21 days with data → 1.0 ---
  const spanScore = Math.min(1, daysWithAnyData / 21);

  // --- Trend strength: a bit more generous than raw R².
  //     Even weak trends are useful; we reward any structure.
  const trendScore = Math.min(1, Math.sqrt(Math.max(0, avgR2TopCities)));

  // --- Recency: what fraction of scans are in the last 7 days ---
  const recencyScore = Math.min(1, recentRatio);

  // Weights
  const W_SAMPLE  = 0.35;
  const W_SPAN    = 0.20;
  const W_TREND   = 0.25;
  const W_RECENT  = 0.20;
  const W_CITY    = 0.05;   // tiny nudge for diversity

  const raw =
    W_SAMPLE * sampleScore +
    W_SPAN * spanScore +
    W_TREND * trendScore +
    W_RECENT * recencyScore +
    W_CITY * (cityScore - 0.3) / 0.7;

  // Normalize by total weights
  const totalWeight = W_SAMPLE + W_SPAN + W_TREND + W_RECENT + W_CITY;
  const normalized = raw / totalWeight;

  // Map into a believable range: 20% – 95%
  const final = 0.20 + 0.75 * normalized;

  return {
    pct: Math.round(final * 100) / 100,
    breakdown: {
      sampleSize: Math.round(sampleScore * 100),
      dataSpan: Math.round(spanScore * 100),
      trendStrength: Math.round(trendScore * 100),
      recency: Math.round(recencyScore * 100),
      cityDiversity: Math.round(cityScore * 100),
    },
  };
}

// ============================================================
// MAIN PREDICTOR
// ============================================================
export function predictHotspots(scans, { minScans = 3 } = {}) {
  const lookbackDays = 21;
  const minDateMs = startOfDay(Date.now() - (lookbackDays - 1) * 86400000);
  const recentCutoff = Date.now() - 7 * 86400000;

  const grouped = groupByCityAndDay(scans, minDateMs);

  const cityPredictions = [];
  for (const [city, cityData] of grouped.entries()) {
    const totalScans = Array.from(cityData.values()).reduce(
      (s, r) => s + r.total,
      0
    );
    if (totalScans < minScans) continue;

    const state = scans.find((s) => s.locationCity === city)?.locationState || '';
    const pred = predictCity(cityData, lookbackDays);
    cityPredictions.push({ city, state, totalScans, ...pred });
  }

  cityPredictions.sort((a, b) => b.riskScore - a.riskScore);

  // --- Global baselines ---
  const globalBaselineSusp = cityPredictions.reduce(
    (s, c) => s + c.baseline * 7,
    0
  );
  const globalPredictedSusp = cityPredictions.reduce(
    (s, c) => s + c.totalPredicted,
    0
  );

  // --- Peak-hour windows ---
  const hourBuckets = new Array(24).fill(0);
  const totalByHour = new Array(24).fill(0);

  for (const s of scans) {
    if (s.timestampMs < minDateMs) continue;
    const h = new Date(s.timestampMs).getHours();
    totalByHour[h] += 1;
    if (s.result === 'SUSPICIOUS' || s.result === 'INVALID') hourBuckets[h] += 1;
  }

  const windows = [];
  for (let h = 0; h < 24; h += 2) {
    const suspicious = hourBuckets[h] + hourBuckets[h + 1];
    const total = totalByHour[h] + totalByHour[h + 1];
    const risk = total > 0 ? suspicious / total : 0;
    windows.push({ start: h, end: (h + 2) % 24, suspicious, total, risk });
  }
  windows.sort((a, b) => b.risk * b.suspicious - a.risk * a.suspicious);

  const peakWindows = windows.slice(0, 3).map((w) => ({
    label: `${String(w.start).padStart(2, '0')}:00–${String(w.end).padStart(2, '0')}:00`,
    riskPct: w.total > 0 ? Math.round((w.suspicious / w.total) * 100) : 0,
    suspicious: w.suspicious,
    start: w.start,
    end: w.end,
  }));

  // --- Hourly heatmap data ---
  const hourlyHeatmap = hourBuckets.map((susp, h) => ({
    hour: h,
    label: `${String(h).padStart(2, '0')}:00`,
    suspicious: susp,
    total: totalByHour[h],
    riskPct: totalByHour[h] > 0 ? Math.round((susp / totalByHour[h]) * 100) : 0,
  }));

  // --- Weekday pattern ---
  const weekdayBuckets = new Array(7).fill(0).map(() => ({
    suspicious: 0,
    total: 0,
  }));
  const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  for (const s of scans) {
    if (s.timestampMs < minDateMs) continue;
    const d = new Date(s.timestampMs).getDay();
    weekdayBuckets[d].total += 1;
    if (s.result === 'SUSPICIOUS' || s.result === 'INVALID') {
      weekdayBuckets[d].suspicious += 1;
    }
  }
  const weekdayPattern = weekdayBuckets.map((b, i) => ({
    day: DAYS[i],
    suspicious: b.suspicious,
    total: b.total,
    riskPct: b.total > 0 ? Math.round((b.suspicious / b.total) * 100) : 0,
  }));

  // --- Anomalies ---
  const anomalies = cityPredictions
    .filter((c) => c.zScore >= 1.5 && c.todayCount >= 2)
    .map((c) => ({
      city: c.city,
      state: c.state,
      todayCount: c.todayCount,
      baseline: Math.round(c.baseline * 10) / 10,
      zScore: c.zScore,
      severity: c.zScore >= 3 ? 'critical' : c.zScore >= 2 ? 'warning' : 'info',
      reason:
        `${c.city} has seen ${c.todayCount} suspicious scans today ` +
        `vs a baseline of ${Math.round(c.baseline * 10) / 10}/day ` +
        `(${c.zScore.toFixed(1)}σ above normal).`,
    }));

  // --- 🆕 Multi-factor confidence ---
  const topForConfidence = cityPredictions.slice(0, 5);
  const avgR2 = mean(topForConfidence.map((c) => Math.max(0, c.r2)));

  const totalScansInWindow = scans.filter((s) => s.timestampMs >= minDateMs).length;
  const daysWithAnyData = new Set(
    scans
      .filter((s) => s.timestampMs >= minDateMs)
      .map((s) => dayKey(s.timestampMs))
  ).size;
  const recentScans = scans.filter((s) => s.timestampMs >= recentCutoff).length;
  const recentRatio = totalScansInWindow > 0 ? recentScans / totalScansInWindow : 0;

  const confidence = computeConfidence({
    totalScans: totalScansInWindow,
    citiesAnalysed: cityPredictions.length,
    daysWithAnyData,
    avgR2TopCities: avgR2,
    recentRatio,
  });

  return {
    lookbackDays,
    horizonDays: 7,
    cityPredictions,
    global: {
      baselineSuspicious: Math.round(globalBaselineSusp * 10) / 10,
      predictedSuspicious: Math.round(globalPredictedSusp * 10) / 10,
      liftPct:
        globalBaselineSusp > 0
          ? Math.round(
              ((globalPredictedSusp - globalBaselineSusp) / globalBaselineSusp) * 100
            )
          : 0,
    },
    peakWindows,
    hourlyHeatmap,
    weekdayPattern,
    anomalies,
    confidence: confidence.pct,
    confidenceBreakdown: confidence.breakdown,
    dataSummary: {
      totalScansInWindow,
      citiesAnalysed: cityPredictions.length,
      daysWithData: daysWithAnyData,
      recentScans,
    },
    generatedAt: new Date().toISOString(),
  };
}

// ============================================================
// TEXT SUMMARY
// ============================================================
export function buildSummaryText(prediction) {
  if (!prediction || !prediction.cityPredictions.length) {
    return 'Not enough scan data yet to produce a prediction. Check back once you have at least a few scans across several days.';
  }

  const {
    cityPredictions,
    global,
    peakWindows,
    anomalies,
    confidence,
    confidenceBreakdown,
    dataSummary,
  } = prediction;

  const top = cityPredictions.slice(0, 4);
  const lines = [];

  lines.push('═══ PREDICTION SUMMARY — Next 7 days ═══');
  lines.push('');
  lines.push(
    `Sample: ${dataSummary.totalScansInWindow} scans across ${dataSummary.citiesAnalysed} cities and ${dataSummary.daysWithData} days.`
  );
  lines.push('');
  lines.push('Top predicted hotspots:');
  top.forEach((c, i) => {
    const pct = c.pctChange > 0 ? `+${c.pctChange}%` : `${c.pctChange}%`;
    lines.push(
      `  ${i + 1}. ${c.city.padEnd(16)} Risk: ${String(c.riskScore).padStart(3)}/100  (${pct} vs baseline)`
    );
  });
  lines.push('');
  lines.push(
    `Predicted suspicious volume: ~${global.predictedSuspicious} (baseline: ${global.baselineSuspicious}) → ${global.liftPct >= 0 ? '+' : ''}${global.liftPct}%`
  );

  if (peakWindows.length) {
    lines.push('');
    lines.push('Peak risk windows (2-hour blocks):');
    peakWindows.forEach((w) => {
      lines.push(`  • ${w.label}  →  ${w.riskPct}% risky, ${w.suspicious} flagged`);
    });
  }

  if (anomalies.length) {
    lines.push('');
    lines.push('Emerging anomalies:');
    anomalies.slice(0, 3).forEach((a) => {
      lines.push(`  ⚠ ${a.reason}`);
    });
  }

  lines.push('');
  lines.push(
    `Model: time-series linear regression + weekday seasonality + hourly risk windows + z-score anomaly`
  );
  lines.push(`Confidence: ${Math.round(confidence * 100)}%`);
  lines.push('');
  lines.push('Confidence breakdown:');
  lines.push(`  • Sample size      : ${confidenceBreakdown.sampleSize}%`);
  lines.push(`  • Data span        : ${confidenceBreakdown.dataSpan}%`);
  lines.push(`  • Trend strength   : ${confidenceBreakdown.trendStrength}%`);
  lines.push(`  • Recency          : ${confidenceBreakdown.recency}%`);

  return lines.join('\n');
}

// ============================================================
// RECOMMENDATIONS
// ============================================================
export function buildRecommendations(prediction) {
  if (!prediction || !prediction.cityPredictions.length) return [];
  const recs = [];

  const critical = prediction.cityPredictions.filter(
    (c) => c.verdict === 'CRITICAL' || c.riskScore >= 70
  );
  const alert = prediction.cityPredictions.filter(
    (c) => c.verdict === 'ALERT' || (c.riskScore >= 45 && c.riskScore < 70)
  );

  if (critical.length) {
    recs.push({
      level: 'critical',
      title: 'Immediate on-site inspection recommended',
      body: `The following cities show high counterfeit risk for the next 7 days: ${critical
        .slice(0, 5)
        .map((c) => c.city)
        .join(', ')}.`,
    });
  }

  if (alert.length && !critical.length) {
    recs.push({
      level: 'warning',
      title: 'Elevated activity — monitor closely',
      body: `Cities to watch: ${alert
        .slice(0, 5)
        .map((c) => c.city)
        .join(', ')}. No immediate action required, but patterns are shifting.`,
    });
  }

  if (prediction.peakWindows.length) {
    const top = prediction.peakWindows[0];
    recs.push({
      level: 'info',
      title: 'Target surveillance during peak hours',
      body: `Most flagged scans happen between ${top.label}. Focus inspection resources in this window.`,
    });
  }

  if (prediction.anomalies.length) {
    recs.push({
      level: prediction.anomalies[0].severity === 'critical' ? 'critical' : 'warning',
      title: 'Emerging pattern detected',
      body: `${prediction.anomalies[0].reason} Recommend immediate verification of all units scanned in this city.`,
    });
  }

  if (prediction.global.liftPct >= 50) {
    recs.push({
      level: 'critical',
      title: 'Nationwide counterfeit wave may be starting',
      body: `Suspicious activity is predicted to rise ${prediction.global.liftPct}% above baseline. Escalate to NAFDAC / SON regional offices.`,
    });
  }

  return recs;
}