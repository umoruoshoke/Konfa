// src/manufacturer/manufacturerQrGenerator.js
// ============================================================
// Generates QR codes for a batch and packs them into a ZIP.
//
// At download time, fresh PINs are generated for every unactivated
// unit. The new hash + salt are written back to Firestore, and the
// plaintext PIN is used ONLY in-memory for the CSV and label PDF.
//
// CONSUMER QR CODES NOW ENCODE A FULL URL:
//   https://konfa.com/verify?ref=<REFERENCE_CODE>
//
// This enables two flows:
//   FLOW A — Native phone camera (iOS/Android) scans the QR code,
//            opens the URL, and lands directly on the PIN entry
//            screen with the reference code already filled in.
//   FLOW B — In-app scanner (html5-qrcode inside VerifyPage)
//            extracts just the reference code from the URL, exactly
//            as it did before when the QR contained a raw code.
//
// SELLER QR CODES STILL ENCODE THE RAW SELLER TOKEN — they are
// used by a POS/dashboard flow, not by consumers.
//
// Output structure:
//   konfa_batch_<CODE>_<TS>.zip
//   ├── png/
//   │   ├── consumer_qr/<UNIT_ID>_consumer.png
//   │   └── seller_qr/<UNIT_ID>_seller.png
//   ├── pdf/
//   │   ├── consumer_labels.pdf       (QR + reference code)
//   │   ├── seller_labels.pdf         (QR + seller token)
//   │   └── labels_with_pins.pdf      (QR + ref + PIN)
//   ├── labels.csv
//   ├── MANIFEST.json
//   └── README.txt
// ============================================================

import QRCode from 'qrcode';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';

// ============================================================
// Constants
// ============================================================
const MM_TO_PT = 2.834645;
const mm = (v) => v * MM_TO_PT;

// ---- Label geometry ----
// We deliberately use a SMALLER label cell than the physical 70×50 mm
// so that there is generous vertical GAP between rows. That gap is
// what keeps the PIN block of one label from covering the QR of the
// label below it.
//
//   Label cell:  70 × 45 mm
//   Row gap:     10 mm between rows (empty space)
//   Effective row pitch: 55 mm
//
// Page math (A4 = 210 × 297 mm):
//   Horizontal:  15 (margin) + 3 × 70 (labels) + 15 (margin) = 240 mm
//                210 mm page width, so 3 columns don't quite fit at
//                70 mm each. We shrink the cell to 66 mm:
//                15 + 3 × 66 + 3 = 216 mm → still tight.
//
//   Better: use 3 columns of 63 mm and center the block:
//     3 × 63 = 189 mm of labels
//     (210 − 189) / 2 = 10.5 mm on each side
//
const LABEL_W_MM = 63;
const LABEL_H_MM = 45;       // physical label height inside the cell
const ROW_GAP_MM = 12;       // 🆕 empty space between two rows
const COL_GAP_MM = 4;        // gap between two columns

const COLS = 3;
const ROWS = 6;
const PER_PAGE = COLS * ROWS;

// Computed page geometry
const PAGE_W_MM = 210;
const PAGE_H_MM = 297;
const PAGE_SIDE_MARGIN_MM = (PAGE_W_MM - COLS * LABEL_W_MM - (COLS - 1) * COL_GAP_MM) / 2;
const PAGE_TOP_MARGIN_MM = 20;   // space reserved for the page header
const PAGE_BOTTOM_MARGIN_MM = 8;

// QR size (fits inside the 45 mm tall cell above the reference/PIN block)
const QR_SIZE_MM = 32;

// How much vertical space the reference/PIN block gets below the QR
const BLOCK_UNDER_QR_MM = 11;   // reference (4mm) + gap (2mm) + PIN (~5mm)

const A4_WIDTH = mm(PAGE_W_MM);
const A4_HEIGHT = mm(PAGE_H_MM);

// ============================================================
// URL builder for consumer QR codes
// ============================================================
// Builds the URL that gets encoded into a consumer QR code.
// When the user scans it with their phone's native camera, the
// Konfa VerifyPage reads the ?ref= parameter and jumps straight
// to the PIN entry screen with the code pre-filled.
//
// Override the base URL via Vite/React env var:
//   REACT_APP_VERIFY_URL=https://konfa.com/verify
// or
//   VITE_VERIFY_URL=https://konfa.com/verify
//
// Falls back to the production URL if not set.
// ============================================================

function getVerifyBaseUrl() {
  // CRA-style env var (must be prefixed with REACT_APP_)
  if (typeof process !== 'undefined' && process.env?.REACT_APP_VERIFY_URL) {
    return process.env.REACT_APP_VERIFY_URL;
  }
  // Vite-style env var (must be prefixed with VITE_)
  if (typeof import.meta !== 'undefined' && import.meta.env?.VITE_VERIFY_URL) {
    return import.meta.env.VITE_VERIFY_URL;
  }
  // Default (production). Will trigger a warning below in dev.
  if (typeof process !== 'undefined' && process.env?.NODE_ENV !== 'production') {
    console.warn(
      '[Konfa] REACT_APP_VERIFY_URL (or VITE_VERIFY_URL) is not set. ' +
      'Consumer QR codes will point to https://konfa.com/verify. ' +
      'Set it in .env to point at your dev/staging URL.'
    );
  }
  return 'https://konfa.com/verify';
}

function buildConsumerQrUrl(referenceCode) {
  const base = getVerifyBaseUrl();
  // Use URL API to safely append the ref parameter
  const url = new URL(base);
  url.searchParams.set('ref', referenceCode);
  return url.toString();
}

// ============================================================
// Crypto helpers
// ============================================================
async function sha256Hex(input) {
  const enc = new TextEncoder().encode(input);
  const buf = await crypto.subtle.digest('SHA-256', enc);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function randomPin(length = 6) {
  let pin = '';
  for (let i = 0; i < length; i++) {
    pin += Math.floor(Math.random() * 10);
  }
  return pin;
}

function randomSalt(bytes = 16) {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return Array.from(arr, (b) => b.toString(16).padStart(2, '0')).join('');
}

async function ensureFreshPins(units) {
  const results = [];
  for (const unit of units) {
    if (unit._plainPin) {
      results.push(unit);
      continue;
    }

    const plainPin = randomPin(6);
    const salt = randomSalt(16);
    const hash = await sha256Hex(plainPin + salt);

    try {
      await updateDoc(doc(db, 'units', unit.id), {
        pinHash: hash,
        pinSalt: salt,
      });
    } catch (err) {
      console.error(`Failed to update PIN for unit ${unit.id}:`, err);
    }

    results.push({ ...unit, _plainPin: plainPin });
  }
  return results;
}

// ============================================================
// Small utilities
// ============================================================
function escapeCsv(value) {
  if (value === null || value === undefined) return '';
  const s = String(value);
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function buildCsv(units) {
  const header = [
    'unit_id',
    'batch_id',
    'unit_sequence',
    'consumer_reference_code',
    'consumer_barcode_token',
    'seller_barcode_token',
    'plain_pin',
    'status',
    'product_id',
  ].join(',');

  const rows = units.map((u) =>
    [
      u.id,
      u.batchId,
      u.unitSequence,
      u.consumerReferenceCode,
      u.consumerBarcodeToken,
      u.sellerBarcodeToken,
      u._plainPin || '',
      u.status,
      u.productId || '',
    ]
      .map(escapeCsv)
      .join(',')
  );

  return [header, ...rows].join('\n');
}

function buildReadme(batch, units) {
  return [
    'KONFA BATCH EXPORT',
    '==================',
    '',
    `Batch Code:      ${batch.batchCode}`,
    `Batch ID:        ${batch.id}`,
    `Units:           ${units.length}`,
    `Generated:       ${new Date().toISOString()}`,
    '',
    'ARCHIVE LAYOUT',
    '--------------',
    'png/consumer_qr/  One PNG per consumer QR code.',
    '                  QR encodes: <VERIFY_BASE_URL>?ref=<REFERENCE_CODE>',
    '                  Filename: <UNIT_ID>_consumer.png',
    'png/seller_qr/    One PNG per seller QR code.',
    '                  QR encodes the raw seller token.',
    '                  Filename: <UNIT_ID>_seller.png',
    '',
    'pdf/consumer_labels.pdf    Ready-to-print A4 sheets of consumer QR codes',
    '                           with the reference code printed below.',
    'pdf/seller_labels.pdf      Ready-to-print A4 sheets of seller QR codes.',
    'pdf/labels_with_pins.pdf   CONSUMER QR + REFERENCE + PLAINTEXT PIN.',
    '',
    'labels.csv        Full manifest (contains plaintext PINs).',
    'MANIFEST.json     Machine-readable summary.',
    '',
    'SCANNING BEHAVIOUR',
    '------------------',
    'Consumer QR codes contain a full URL, so they work in two ways:',
    '  1. Native camera (iOS/Android): opens the browser directly at',
    '     the verification page with the reference pre-filled.',
    '  2. In-app scanner (html5-qrcode inside VerifyPage): extracts',
    '     only the reference code from the URL.',
    '',
    'PRINTING',
    '--------',
    `Label size:     ${LABEL_W_MM} × ${LABEL_H_MM} mm`,
    `Row gap:        ${ROW_GAP_MM} mm (empty space between rows)`,
    `Grid:           ${COLS} columns × ${ROWS} rows (${PER_PAGE} labels/page)`,
    'Paper:          A4',
    'Scale:          100% — do NOT use "fit to page"',
    'Cut:            Along the light gray borders',
    '',
    '⚠️  SECURITY',
    '-----------',
    'The following files contain PLAINTEXT PINs:',
    '  - labels.csv',
    '  - pdf/labels_with_pins.pdf',
    '',
    'After printing:',
    '  1. Destroy these files locally.',
    '  2. Deliver only printed labels to the packaging line.',
    '  3. Once all units are activated, the plaintext PINs are',
    '     not retrievable from Konfa — only hashes remain.',
  ].join('\n');
}

function buildManifest(batch, units) {
  return JSON.stringify(
    {
      batch: {
        id: batch.id,
        code: batch.batchCode,
        quantity: units.length,
        productionLocation: batch.productionLocation,
        productionDate: batch.productionDate,
      },
      generatedAt: new Date().toISOString(),
      files: {
        png: { consumer: units.length, seller: units.length },
        pdf: [
          'consumer_labels.pdf',
          'seller_labels.pdf',
          'labels_with_pins.pdf',
        ],
        csv: 'labels.csv',
      },
      units: units.map((u) => ({
        id: u.id,
        sequence: u.unitSequence,
        referenceCode: u.consumerReferenceCode,
        sellerToken: u.sellerBarcodeToken,
      })),
    },
    null,
    2
  );
}

// ============================================================
// QR PNG generation
// ============================================================
async function qrToPngDataUrl(text, size = 512) {
  return QRCode.toDataURL(text, {
    errorCorrectionLevel: 'M',
    width: size,
    margin: 2,
    color: { dark: '#0a1628', light: '#ffffff' },
  });
}

function dataUrlToBytes(dataUrl) {
  const base64 = dataUrl.split(',')[1];
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

// ============================================================
// PDF label sheet generator
// ============================================================
//
// Each label cell is 63 × 45 mm and contains, from top to bottom:
//
//   ┌───────────────────────────────┐  ← top of cell
//   │  ┌───────────────────────┐    │
//   │  │                       │    │
//   │  │        QR 32×32       │    │  ← 32 mm tall QR
//   │  │                       │    │
//   │  └───────────────────────┘    │
//   │      A8C8-URSY (10pt bold)    │  ← reference code
//   │      ┌───────────────┐        │
//   │      │   PIN 483920  │        │  ← PIN (with colored box)
//   │      └───────────────┘        │
//   └───────────────────────────────┘  ← bottom of cell
//
//   ───── 12 mm empty gap ─────         ← ROW_GAP_MM, prevents overlap
//
//   ┌───────────────────────────────┐  ← top of next cell
//   │  ... next label ...           │
//
// The 12 mm gap between rows is what guarantees that the PIN block
// of one label can never visually collide with the QR of the label
// below it.
//
// NOTE: qrContentIsUrl controls whether the QR encodes a full URL
// (consumer labels) or the raw value (seller labels).
//
async function buildLabelsPdf({
  title,
  units,
  qrContentKey,
  qrContentIsUrl = false,
  showReference,
  showSellerToken = false,
  showPin = false,
}) {
  const pdfDoc = await PDFDocument.create();
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontMono = await pdfDoc.embedFont(StandardFonts.Courier);

  // Pre-generate QR PNGs
  const qrDataUrls = [];
  const BATCH = 50;
  for (let i = 0; i < units.length; i += BATCH) {
    const chunk = units.slice(i, i + BATCH);
    const urls = await Promise.all(
      chunk.map((u) => {
        const rawValue = u[qrContentKey];
        // 🆕 If this PDF's QR should encode a URL, wrap it
        const qrValue = qrContentIsUrl
          ? buildConsumerQrUrl(rawValue)
          : rawValue;
        return qrToPngDataUrl(qrValue, 400);
      })
    );
    qrDataUrls.push(...urls);
  }

  const totalPages = Math.ceil(units.length / PER_PAGE);

  // Vertical pitch of each row = label height + row gap
  const ROW_PITCH_MM = LABEL_H_MM + ROW_GAP_MM;

  for (let p = 0; p < totalPages; p++) {
    const page = pdfDoc.addPage([A4_WIDTH, A4_HEIGHT]);

    // ---- Page header ----
    page.drawText(title, {
      x: mm(PAGE_SIDE_MARGIN_MM),
      y: A4_HEIGHT - mm(10),
      size: 12,
      font: fontBold,
      color: rgb(0.04, 0.09, 0.16),
    });
    page.drawText(
      `Page ${p + 1} of ${totalPages} · ${units.length} labels total · Cut along the light gray borders`,
      {
        x: mm(PAGE_SIDE_MARGIN_MM),
        y: A4_HEIGHT - mm(15),
        size: 8,
        font: fontRegular,
        color: rgb(0.4, 0.45, 0.5),
      }
    );

    const pageUnits = units.slice(p * PER_PAGE, (p + 1) * PER_PAGE);

    for (let i = 0; i < pageUnits.length; i++) {
      const unit = pageUnits[i];
      const globalIndex = p * PER_PAGE + i;
      const qrImageBytes = dataUrlToBytes(qrDataUrls[globalIndex]);

      const col = i % COLS;
      const row = Math.floor(i / COLS);

      // ---- Cell origin (bottom-left corner) ----
      // labelTopOfPage = top edge of the top row of this page
      const labelLeft =
        mm(PAGE_SIDE_MARGIN_MM) + mm(col * (LABEL_W_MM + COL_GAP_MM));
      const labelBottom =
        A4_HEIGHT -
        mm(PAGE_TOP_MARGIN_MM) -
        mm((row + 1) * ROW_PITCH_MM) +
        mm(ROW_GAP_MM); // 👈 adds the gap BELOW the label
      const labelTop = labelBottom + mm(LABEL_H_MM);

      // ---- Cell border (light gray, for cutting guidance) ----
      page.drawRectangle({
        x: labelLeft,
        y: labelBottom,
        width: mm(LABEL_W_MM),
        height: mm(LABEL_H_MM),
        borderColor: rgb(0.85, 0.88, 0.92),
        borderWidth: 0.5,
      });

      // ============================================================
      // QR CODE — top of cell, horizontally centered
      // ============================================================
      const qrX = labelLeft + (mm(LABEL_W_MM) - mm(QR_SIZE_MM)) / 2;
      const qrTopY = labelTop - mm(2); // small margin from cell top
      const qrY = qrTopY - mm(QR_SIZE_MM);

      const qrImage = await pdfDoc.embedPng(qrImageBytes);
      page.drawImage(qrImage, {
        x: qrX,
        y: qrY,
        width: mm(QR_SIZE_MM),
        height: mm(QR_SIZE_MM),
      });

      // ============================================================
      // TEXT ZONE — everything below the QR, inside the same cell
      // ============================================================
      // We anchor the text zone at the QR's bottom edge + a small gap.
      // All text is placed here, top-down, in the remaining ~11 mm
      // between the QR's bottom and the cell's bottom edge.

      let textCursorY = qrY - mm(1); // 1 mm below the QR's bottom edge

      // ---- Reference code ----
      if (showReference) {
        const referenceText = unit.consumerReferenceCode || '';
        const refFontSize = 10;
        const refWidth = fontBold.widthOfTextAtSize(
          referenceText,
          refFontSize
        );
        const refX = labelLeft + (mm(LABEL_W_MM) - refWidth) / 2;

        page.drawText(referenceText, {
          x: refX,
          y: textCursorY - mm(3.5),
          size: refFontSize,
          font: fontBold,
          color: rgb(0.04, 0.09, 0.16),
        });
        textCursorY -= mm(5.5);
      }

      // ---- Seller token (for seller_labels.pdf) ----
      if (showSellerToken) {
        const sellerToken = unit.sellerBarcodeToken || '';
        const maxChars = 22;
        const display =
          sellerToken.length > maxChars
            ? sellerToken.slice(0, maxChars - 1) + '…'
            : sellerToken;
        const tkFontSize = 6.5;
        const tkWidth = fontMono.widthOfTextAtSize(display, tkFontSize);
        const tkX = labelLeft + (mm(LABEL_W_MM) - tkWidth) / 2;

        page.drawText(display, {
          x: tkX,
          y: textCursorY - mm(2.5),
          size: tkFontSize,
          font: fontMono,
          color: rgb(0.35, 0.4, 0.5),
        });
        textCursorY -= mm(4.5);
      }

      // ---- PIN block (only for labels_with_pins.pdf) ----
      if (showPin && unit._plainPin) {
        const pinText = String(unit._plainPin);
        const pinFontSize = 11;
        const pinWidth = fontBold.widthOfTextAtSize(pinText, pinFontSize);

        // Background + border box for the PIN
        const pinBoxWidth = pinWidth + mm(6);
        const pinBoxHeight = mm(5.5);
        const pinBoxX = labelLeft + (mm(LABEL_W_MM) - pinBoxWidth) / 2;
        const pinBoxY = textCursorY - pinBoxHeight;

        page.drawRectangle({
          x: pinBoxX,
          y: pinBoxY,
          width: pinBoxWidth,
          height: pinBoxHeight,
          color: rgb(0.98, 0.94, 0.85),
          borderColor: rgb(0.85, 0.7, 0.35),
          borderWidth: 0.6,
        });

        // PIN digits, centered inside the box
        page.drawText(pinText, {
          x: pinBoxX + (pinBoxWidth - pinWidth) / 2,
          y: pinBoxY + mm(1.4),
          size: pinFontSize,
          font: fontBold,
          color: rgb(0.55, 0.35, 0.05),
        });

        textCursorY -= pinBoxHeight + mm(0.5);
      }

      // ============================================================
      // FOOTER — tiny unit ID at the very bottom of the cell
      // ============================================================
      page.drawText(`${unit.id.slice(-10)}`, {
        x: labelLeft + mm(2),
        y: labelBottom + mm(1),
        size: 5.5,
        font: fontRegular,
        color: rgb(0.6, 0.65, 0.72),
      });
    }
  }

  return pdfDoc.save();
}

// ============================================================
// MAIN — generate + download
// ============================================================
export async function generateBatchQrZip({ batch, units, onProgress }) {
  if (!units || units.length === 0) {
    throw new Error('No units provided.');
  }

  // ============================================================
  // STEP 1 — Regenerate PINs and update Firestore hashes
  // ============================================================
  const unitsWithPins = await ensureFreshPins(units);

  const zip = new JSZip();
  const pngFolder = zip.folder('png');
  const pngConsumer = pngFolder.folder('consumer_qr');
  const pngSeller = pngFolder.folder('seller_qr');
  const pdfFolder = zip.folder('pdf');

  zip.file('labels.csv', buildCsv(unitsWithPins));
  zip.file('README.txt', buildReadme(batch, unitsWithPins));
  zip.file('MANIFEST.json', buildManifest(batch, unitsWithPins));

  // ============================================================
  // STEP 2 — PNGs
  // ============================================================
  const totalSteps = unitsWithPins.length * 2 + 3;
  let done = 0;

  const report = () => {
    if (onProgress) onProgress(done, totalSteps);
  };

  for (const unit of unitsWithPins) {
    // 🆕 Consumer QR now encodes a full URL (?ref=...) instead of the raw code
    const consumerDataUrl = await qrToPngDataUrl(
      buildConsumerQrUrl(unit.consumerReferenceCode),
      512
    );
    pngConsumer.file(
      `${unit.id}_consumer.png`,
      consumerDataUrl.split(',')[1],
      { base64: true }
    );
    done += 1;
    report();

    // Seller QR stays raw (used by POS/dashboard, not consumers)
    const sellerDataUrl = await qrToPngDataUrl(unit.sellerBarcodeToken, 512);
    pngSeller.file(
      `${unit.id}_seller.png`,
      sellerDataUrl.split(',')[1],
      { base64: true }
    );
    done += 1;
    report();
  }

  // ============================================================
  // STEP 3 — Consumer labels PDF
  // ============================================================
  const consumerPdfBytes = await buildLabelsPdf({
    title: `Consumer Labels · ${batch.batchCode}`,
    units: unitsWithPins,
    qrContentKey: 'consumerReferenceCode',
    qrContentIsUrl: true,        // 🆕 consumer labels encode URL
    showReference: true,
    showSellerToken: false,
    showPin: false,
  });
  pdfFolder.file('consumer_labels.pdf', consumerPdfBytes);
  done += 1;
  report();

  // ============================================================
  // STEP 4 — Seller labels PDF
  // ============================================================
  const sellerPdfBytes = await buildLabelsPdf({
    title: `Seller Labels · ${batch.batchCode}`,
    units: unitsWithPins,
    qrContentKey: 'sellerBarcodeToken',
    qrContentIsUrl: false,       // 🆕 seller labels stay raw
    showReference: false,
    showSellerToken: true,
    showPin: false,
  });
  pdfFolder.file('seller_labels.pdf', sellerPdfBytes);
  done += 1;
  report();

  // ============================================================
  // STEP 5 — Labels with PINs PDF
  // ============================================================
  const labelsWithPinsBytes = await buildLabelsPdf({
    title: `Consumer Labels with PINs · ${batch.batchCode}`,
    units: unitsWithPins,
    qrContentKey: 'consumerReferenceCode',
    qrContentIsUrl: true,        // 🆕 matches consumer labels
    showReference: true,
    showSellerToken: false,
    showPin: true,
  });
  pdfFolder.file('labels_with_pins.pdf', labelsWithPinsBytes);
  done += 1;
  report();

  // ============================================================
  // STEP 6 — Zip + download
  // ============================================================
  const blob = await zip.generateAsync({
    type: 'blob',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  });

  const filename = `konfa_batch_${batch.batchCode || batch.id}_${Date.now()}.zip`;
  saveAs(blob, filename);

  return {
    filename,
    size: blob.size,
    count: unitsWithPins.length,
    pngCount: unitsWithPins.length * 2,
    pdfCount: 3,
  };
}