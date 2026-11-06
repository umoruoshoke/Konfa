// src/admin/scanExport.js
// ============================================================
// CSV + Excel export for scan analytics and compliance reports.
// ============================================================

import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import { formatDateTime, prettifyResult } from './scanAnalytics';

// ============================================================
// CSV — good for quick data dumps
// ============================================================
function escapeCsv(v) {
  if (v === null || v === undefined) return '';
  const s = String(v);
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

const CSV_COLUMNS = [
  ['id', 'Scan ID'],
  ['timestamp', 'Timestamp'],
  ['consumerReferenceCode', 'Reference Code'],
  ['unitId', 'Unit ID'],
  ['result', 'Result'],
  ['riskScore', 'Risk Score'],
  ['scanType', 'Scan Type'],
  ['locationCity', 'City'],
  ['locationState', 'State'],
  ['locationLat', 'Latitude'],
  ['locationLng', 'Longitude'],
  ['withinNigeria', 'Within Nigeria'],
  ['isPhysicallyImpossible', 'Impossible Travel'],
  ['impossibilityReason', 'Reason'],
  ['distanceFromPreviousKm', 'Distance from previous (km)'],
  ['minutesSincePrevious', 'Minutes since previous'],
  ['requiredSpeedKmh', 'Required speed (km/h)'],
  ['previousScanCity', 'Previous city'],
  ['devicePlatform', 'Device Platform'],
  ['deviceTimezone', 'Timezone'],
  ['deviceLanguage', 'Language'],
];

export function exportScansToCsv(scans, filename = 'konfa_scans') {
  const header = CSV_COLUMNS.map(([, label]) => escapeCsv(label)).join(',');
  const rows = scans.map((s) =>
    CSV_COLUMNS.map(([key]) => {
      let v = s[key];
      if (key === 'timestamp') v = formatDateTime(s.timestamp);
      if (key === 'result') v = prettifyResult(s.result);
      return escapeCsv(v);
    }).join(',')
  );

  const csv = [header, ...rows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  saveAs(blob, `${filename}_${Date.now()}.csv`);
}

// ============================================================
// XLSX — for compliance / regulators
// ============================================================
export function exportScansToExcel(scans, filename = 'konfa_scans') {
  const rows = scans.map((s) => ({
    'Scan ID': s.id,
    'Timestamp': formatDateTime(s.timestamp),
    'Reference Code': s.consumerReferenceCode || '',
    'Unit ID': s.unitId || '',
    'Result': prettifyResult(s.result),
    'Risk Score': s.riskScore ?? 0,
    'Scan Type': s.scanType || '',
    'City': s.locationCity || '',
    'State': s.locationState || '',
    'Latitude': s.locationLat ?? '',
    'Longitude': s.locationLng ?? '',
    'Within Nigeria': s.withinNigeria === true ? 'Yes' : s.withinNigeria === false ? 'No' : '',
    'Impossible Travel': s.isPhysicallyImpossible ? 'YES' : 'No',
    'Impossibility Reason': s.impossibilityReason || '',
    'Distance from previous (km)': s.distanceFromPreviousKm ?? '',
    'Minutes since previous': s.minutesSincePrevious ?? '',
    'Required speed (km/h)': s.requiredSpeedKmh ?? '',
    'Previous city': s.previousScanCity || '',
    'Device Platform': s.devicePlatform || '',
    'Timezone': s.deviceTimezone || '',
    'Language': s.deviceLanguage || '',
  }));

  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Scans');

  const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([buf], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  saveAs(blob, `${filename}_${Date.now()}.xlsx`);
}

// ============================================================
// COMPLIANCE REPORT — multi-sheet Excel workbook
// ============================================================
export function exportComplianceReport({
  scans,
  prediction,
  summary,
  cityBreakdown,
  rangeLabel,
  filename = 'konfa_compliance_report',
}) {
  const wb = XLSX.utils.book_new();

  // ---- Sheet 1: Cover ----
  const cover = [
    ['KONFA — COMPLIANCE REPORT'],
    [],
    ['Generated', new Date().toLocaleString()],
    ['Reporting period', rangeLabel],
    ['Total scans', summary.total],
    ['Authentic', summary.authentic],
    ['Suspicious', summary.suspicious],
    ['Invalid', summary.invalid],
    ['Impossible travel flags', summary.impossible],
    ['Unique units scanned', summary.uniqueUnits],
    ['Cities', summary.cities],
    ['Flag rate', `${summary.flagRate}%`],
    [],
    ['Prepared by', 'Konfa Anti-Counterfeit Platform'],
    ['For', 'NAFDAC / SON / FCCPC'],
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(cover), 'Cover');

  // ---- Sheet 2: All scans ----
  const scanRows = scans.map((s) => ({
    'Timestamp': formatDateTime(s.timestamp),
    'Reference Code': s.consumerReferenceCode || '',
    'Result': prettifyResult(s.result),
    'Risk Score': s.riskScore ?? 0,
    'City': s.locationCity || '',
    'State': s.locationState || '',
    'Latitude': s.locationLat ?? '',
    'Longitude': s.locationLng ?? '',
    'Impossible Travel': s.isPhysicallyImpossible ? 'YES' : 'No',
    'Reason': s.impossibilityReason || '',
    'Device': s.devicePlatform || '',
  }));
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(scanRows),
    'All Scans'
  );

  // ---- Sheet 3: Flagged only ----
  const flaggedScans = scans.filter(
    (s) => s.isPhysicallyImpossible || s.result === 'SUSPICIOUS' || s.result === 'INVALID'
  );
  const flaggedRows = flaggedScans.map((s) => ({
    'Timestamp': formatDateTime(s.timestamp),
    'Reference Code': s.consumerReferenceCode || '',
    'Result': prettifyResult(s.result),
    'Risk Score': s.riskScore ?? 0,
    'City': s.locationCity || '',
    'Previous City': s.previousScanCity || '',
    'Distance (km)': s.distanceFromPreviousKm ?? '',
    'Minutes between scans': s.minutesSincePrevious ?? '',
    'Required speed (km/h)': s.requiredSpeedKmh ?? '',
    'Reason': s.impossibilityReason || s.flaggedReason || '',
  }));
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(flaggedRows),
    'Flagged Scans'
  );

  // ---- Sheet 4: City breakdown ----
  const cityRows = cityBreakdown.map((c) => ({
    'City': c.city,
    'State': c.state,
    'Total Scans': c.total,
    'Suspicious / Invalid': c.suspicious,
    'Impossible Travel': c.impossible,
    'Risk %': `${c.riskPct}%`,
  }));
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(cityRows),
    'City Breakdown'
  );

  // ---- Sheet 5: Predictions ----
  if (prediction && prediction.cityPredictions.length) {
    const predRows = prediction.cityPredictions.map((c) => ({
      'City': c.city,
      'State': c.state,
      'Risk Score': c.riskScore,
      'Verdict': c.verdict,
      'Baseline (per day)': Math.round(c.baseline * 10) / 10,
      'Today': c.todayCount,
      'Z-Score': c.zScore,
      'Predicted (7d)': c.totalPredicted,
      'Change %': `${c.pctChange >= 0 ? '+' : ''}${c.pctChange}%`,
    }));
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(predRows),
      'Predictions'
    );

    const recs = [
      ['RECOMMENDATIONS FOR REGULATORS'],
      [],
      ['Confidence', `${Math.round(prediction.confidence * 100)}%`],
      [],
      ['Top hotspot cities'],
      ...prediction.cityPredictions.slice(0, 5).map((c) => [
        c.city,
        `Risk ${c.riskScore}/100`,
        `${c.pctChange >= 0 ? '+' : ''}${c.pctChange}% vs baseline`,
      ]),
      [],
      ['Peak risk windows'],
      ...prediction.peakWindows.map((w) => [w.label, `${w.riskPct}% risky`]),
    ];
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.aoa_to_sheet(recs),
      'Recommendations'
    );
  }

  const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([buf], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  saveAs(blob, `${filename}_${Date.now()}.xlsx`);
}