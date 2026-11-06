// src/seller/verification/imageCompressor.js
// ============================================================
// Client-side image compression to base64 data URLs.
//
// Why: Firebase Storage requires CORS configuration that is
// painful for small projects. Storing compressed base64 images
// directly in Firestore gives the same verification power with
// zero external setup — and Firestore rules already protect it.
//
// Limits:
//   - Max dimension: 900px (enough to read NIN + see face)
//   - JPEG quality: 0.62 (good balance)
//   - Target size: 80–160 KB per image
//   - Hard cap: 380 KB per data URL (fits 2–3 images in a
//     Firestore doc under the 1 MB limit with room to spare)
// ============================================================

const MAX_DIMENSION = 900;
const JPEG_QUALITY = 0.62;
const TARGET_MAX_BYTES = 380 * 1024; // 380 KB cap per data URL
const MIN_ACCEPTED_BYTES = 20 * 1024; // reject tiny/corrupted files
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic'];

export async function compressToDataUrl(file, { onProgress } = {}) {
  if (!file) throw new Error('No file selected.');
  if (!ALLOWED_TYPES.includes(file.type) && !file.type.startsWith('image/')) {
    throw new Error('Please upload a JPG, PNG, WEBP, or HEIC image.');
  }

  onProgress?.(10);

  const dataUrl = await readAsDataUrl(file);
  onProgress?.(25);

  const img = await loadImage(dataUrl);
  onProgress?.(45);

  // Scale down to MAX_DIMENSION, preserving aspect ratio
  let { width, height } = img;
  if (width > height && width > MAX_DIMENSION) {
    height = Math.round((height * MAX_DIMENSION) / width);
    width = MAX_DIMENSION;
  } else if (height > MAX_DIMENSION) {
    width = Math.round((width * MAX_DIMENSION) / height);
    height = MAX_DIMENSION;
  }

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Your browser does not support image compression.');

  // White background so PNGs with transparency still render clearly
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(img, 0, 0, width, height);

  onProgress?.(65);

  // First pass — quality 0.62
  let out = canvas.toDataURL('image/jpeg', JPEG_QUALITY);

  // If it's still too big, reduce quality iteratively
  if (dataUrlByteSize(out) > TARGET_MAX_BYTES) {
    for (let q = 0.55; q >= 0.35; q -= 0.05) {
      out = canvas.toDataURL('image/jpeg', q);
      if (dataUrlByteSize(out) <= TARGET_MAX_BYTES) break;
    }
  }

  // If still too big, shrink the canvas further
  if (dataUrlByteSize(out) > TARGET_MAX_BYTES) {
    let scale = 0.75;
    while (scale > 0.4) {
      const w = Math.round(width * scale);
      const h = Math.round(height * scale);
      const tmp = document.createElement('canvas');
      tmp.width = w;
      tmp.height = h;
      const tctx = tmp.getContext('2d');
      tctx.fillStyle = '#ffffff';
      tctx.fillRect(0, 0, w, h);
      tctx.drawImage(img, 0, 0, w, h);
      out = tmp.toDataURL('image/jpeg', 0.6);
      if (dataUrlByteSize(out) <= TARGET_MAX_BYTES) break;
      scale -= 0.1;
    }
  }

  onProgress?.(100);

  const bytes = dataUrlByteSize(out);
  if (bytes < MIN_ACCEPTED_BYTES) {
    throw new Error('The image looks too small or blank. Please try a clearer photo.');
  }
  if (bytes > TARGET_MAX_BYTES) {
    throw new Error(
      'The image could not be compressed enough. Please upload a simpler or smaller photo.'
    );
  }

  return {
    dataUrl: out,
    bytes,
    width,
    height,
    originalName: file.name || '',
    originalSize: file.size || 0,
    originalType: file.type || '',
  };
}

// ------------------------------------------------------------
// Helpers
// ------------------------------------------------------------
function readAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target.result);
    reader.onerror = () => reject(new Error('Could not read the file.'));
    reader.readAsDataURL(file);
  });
}

function loadImage(dataUrl) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('The image could not be decoded.'));
    img.src = dataUrl;
  });
}

function dataUrlByteSize(dataUrl) {
  // Approximate byte size of a base64 data URL
  const base64 = dataUrl.split(',')[1] || '';
  return Math.floor((base64.length * 3) / 4);
}

export function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}