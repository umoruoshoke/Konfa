// src/utils/deviceFingerprint.js
// ============================================================
// Stable per-device identifier used to bind a unit to its first
// consumer, and to raise red flags when a different device
// later verifies the same unit.
//
// Storage strategy:
//   1. localStorage  — persisted across sessions (normal case)
//   2. sessionStorage — persisted for this tab's lifetime (private mode)
//   3. in-memory cache — persists for this page load (nothing else works)
//
// In-memory cache prevents multiple calls per page load from
// re-hashing the fingerprint, which is expensive (canvas + WebGL).
// ============================================================

const STORAGE_KEY = 'konfa_device_id';
const SESSION_KEY = 'konfa_device_id_session';

let memoryCache = null;

function readLocal() {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function writeLocal(id) {
  try {
    localStorage.setItem(STORAGE_KEY, id);
    return true;
  } catch {
    return false;
  }
}

function readSession() {
  try {
    return sessionStorage.getItem(SESSION_KEY);
  } catch {
    return null;
  }
}

function writeSession(id) {
  try {
    sessionStorage.setItem(SESSION_KEY, id);
    return true;
  } catch {
    return false;
  }
}

/**
 * Compute a stable identifier from browser characteristics.
 * This is a fingerprint, not a security primitive.
 */
function buildFingerprint() {
  const parts = [];

  try { parts.push(navigator.userAgent || ''); } catch { /* ignore */ }
  try { parts.push(navigator.language || ''); } catch { /* ignore */ }
  try { parts.push(navigator.platform || ''); } catch { /* ignore */ }
  try { parts.push(String(navigator.hardwareConcurrency || 0)); } catch { /* ignore */ }
  try { parts.push(String(navigator.maxTouchPoints || 0)); } catch { /* ignore */ }

  try {
    const s = window.screen;
    if (s) {
      parts.push(`${s.width}x${s.height}x${s.colorDepth}`);
      parts.push(String(s.availWidth || 0));
      parts.push(String(s.availHeight || 0));
    }
  } catch { /* ignore */ }

  try {
    parts.push(String(window.devicePixelRatio || 1));
  } catch { /* ignore */ }

  try {
    parts.push(Intl.DateTimeFormat().resolvedOptions().timeZone || '');
  } catch { /* ignore */ }

  // Canvas fingerprint — strong discriminator across physical devices
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 200;
    canvas.height = 40;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.textBaseline = 'top';
      ctx.font = '14px "Arial"';
      ctx.fillStyle = '#f60';
      ctx.fillRect(0, 0, 100, 20);
      ctx.fillStyle = '#069';
      ctx.fillText('konfa-device-fp', 2, 15);
      ctx.fillStyle = 'rgba(102, 204, 0, 0.7)';
      ctx.fillText('konfa-device-fp', 4, 17);
      const dataUrl = canvas.toDataURL();
      parts.push(dataUrl.slice(-48));
    }
  } catch { /* ignore */ }

  // WebGL vendor/renderer — even stronger
  try {
    const canvas = document.createElement('canvas');
    const gl =
      canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    if (gl) {
      const dbg = gl.getExtension('WEBGL_debug_renderer_info');
      if (dbg) {
        parts.push(String(gl.getParameter(dbg.UNMASKED_VENDOR_WEBGL) || ''));
        parts.push(String(gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) || ''));
      }
    }
  } catch { /* ignore */ }

  return parts.join('|');
}

function hashString(str) {
  // FNV-1a 32-bit — fast, good enough for a fingerprint
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = (h * 0x01000193) >>> 0;
  }
  return h.toString(36);
}

/**
 * Get the device fingerprint. Computed once, then persisted.
 *
 * Resolution order:
 *   1. In-memory cache (this page load)
 *   2. localStorage (across sessions)
 *   3. sessionStorage (private mode within this tab)
 *   4. Compute fresh + try to persist everywhere
 */
export function getDeviceFingerprint() {
  // 1. In-memory
  if (memoryCache) return memoryCache;

  // 2. localStorage
  const fromLocal = readLocal();
  if (fromLocal) {
    memoryCache = fromLocal;
    return fromLocal;
  }

  // 3. sessionStorage (private mode fallback)
  const fromSession = readSession();
  if (fromSession) {
    memoryCache = fromSession;
    // Try to promote to localStorage in case it's now available.
    writeLocal(fromSession);
    return fromSession;
  }

  // 4. Compute fresh
  const raw = buildFingerprint();
  const hash = hashString(raw);
  const id = `dev_${hash}`;

  memoryCache = id;

  // Try to persist in both. If both fail, memoryCache still
  // keeps it stable for this page load.
  const wroteLocal = writeLocal(id);
  if (!wroteLocal) {
    writeSession(id);
  }

  return id;
}

/**
 * Force-regenerate the fingerprint. Useful for debugging only —
 * do NOT expose this to end users, since it defeats the claim
 * mechanism.
 */
export function regenerateDeviceFingerprint() {
  memoryCache = null;
  try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
  try { sessionStorage.removeItem(SESSION_KEY); } catch { /* ignore */ }
  return getDeviceFingerprint();
}

/**
 * Console helper — call `konfaDeviceInfo()` from devtools to see
 * the current device ID and where it came from. Useful when
 * debugging why scans are flagged as `claimed_elsewhere`.
 */
export function konfaDeviceInfo() {
  const id = getDeviceFingerprint();
  let storedIn = 'memory-only';
  try {
    if (localStorage.getItem(STORAGE_KEY) === id) storedIn = 'localStorage';
    else if (sessionStorage.getItem(SESSION_KEY) === id) storedIn = 'sessionStorage';
  } catch { /* ignore */ }

  const info = {
    deviceId: id,
    storedIn,
    userAgent: (typeof navigator !== 'undefined' && navigator.userAgent) || null,
    timezone: (() => {
      try {
        return Intl.DateTimeFormat().resolvedOptions().timeZone || null;
      } catch {
        return null;
      }
    })(),
    screen: (() => {
      try {
        const s = window.screen;
        return s ? `${s.width}x${s.height}` : null;
      } catch {
        return null;
      }
    })(),
  };

  console.info('[konfa] device info:', info);
  return info;
}

/**
 * Short device summary suitable for display in an admin drawer
 * (kept separate from the fingerprint so the raw fingerprint
 * never appears in analytics).
 */
export function getDeviceSummary() {
  return {
    platform: (navigator.platform || '').slice(0, 60),
    language: (navigator.language || '').slice(0, 20),
    timezone: (() => {
      try {
        return Intl.DateTimeFormat().resolvedOptions().timeZone || '';
      } catch {
        return '';
      }
    })(),
    screen: (() => {
      try {
        const s = window.screen;
        return s ? `${s.width}x${s.height}` : '';
      } catch {
        return '';
      }
    })(),
  };
}