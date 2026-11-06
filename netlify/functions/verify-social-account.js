// netlify/functions/verify-social-account.js
// ============================================================
// Konfa verification backend.
//
// Receives { platform, handle, url, code } from the seller
// verification modal, fetches the public social profile
// server-side (bypassing CORS), and checks whether the code
// is present in the visible content.
//
// Returns { ok: true } on success, or { ok: false, reason }
// on failure. Rate-limited by IP.
//
// Deploy: place this file in netlify/functions/. Netlify
// auto-deploys it to /.netlify/functions/verify-social-account
// and (with the redirect rule in netlify.toml) also to
// /api/verify-social-account.
// ============================================================

const RATE_LIMIT_WINDOW_MS = 60_000;    // 1 minute
const RATE_LIMIT_MAX = 10;              // 10 checks per IP per minute

// Simple in-memory rate limiter (per Lambda instance).
// For production, back this with Firestore or Upstash.
const rateMap = new Map();

function rateLimit(ip) {
  const now = Date.now();
  const entry = rateMap.get(ip) || { count: 0, resetAt: now + RATE_LIMIT_WINDOW_MS };
  if (now > entry.resetAt) {
    entry.count = 0;
    entry.resetAt = now + RATE_LIMIT_WINDOW_MS;
  }
  entry.count += 1;
  rateMap.set(ip, entry);
  return entry.count <= RATE_LIMIT_MAX;
}

const PLATFORM_URL_BUILDERS = {
  instagram: (handle) => `https://www.instagram.com/${handle}/`,
  tiktok: (handle) => `https://www.tiktok.com/@${handle}`,
  youtube: (handle) => `https://www.youtube.com/@${handle}`,
  facebook: (handle) => `https://www.facebook.com/${handle}`,
  x: (handle) => `https://x.com/${handle}`,
  whatsapp: (handle) => `https://wa.me/${handle.replace(/\D/g, '')}`,
  website: (handle, url) => url || `https://${handle}`,
};

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

exports.handler = async (event) => {
  // ---- Only POST ----
  if (event.httpMethod !== 'POST') {
    return json(405, { ok: false, reason: 'Method not allowed' });
  }

  // ---- Rate limit ----
  const ip =
    event.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
    event.headers['client-ip'] ||
    'unknown';
  if (!rateLimit(ip)) {
    return json(429, {
      ok: false,
      reason: 'Too many verification attempts. Please wait a minute and try again.',
    });
  }

  // ---- Parse body ----
  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return json(400, { ok: false, reason: 'Invalid JSON body.' });
  }

  const { platform, handle, url, code } = body;

  if (!platform || !code) {
    return json(400, { ok: false, reason: 'Missing platform or code.' });
  }

  const codeRegex = new RegExp(escapeRegex(code), 'i');

  const urlBuilder = PLATFORM_URL_BUILDERS[platform];
  if (!urlBuilder) {
    return json(400, { ok: false, reason: `Unsupported platform: ${platform}` });
  }

  let targetUrl;
  try {
    targetUrl = urlBuilder((handle || '').replace(/^@/, ''), url);
  } catch {
    return json(400, { ok: false, reason: 'Could not build profile URL.' });
  }

  if (!targetUrl || !/^https?:\/\//.test(targetUrl)) {
    return json(400, { ok: false, reason: 'Invalid profile URL.' });
  }

  // ---- Fetch the profile ----
  let html;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12_000);

    const res = await fetch(targetUrl, {
      signal: controller.signal,
      headers: {
        // Identify ourselves honestly
        'User-Agent':
          'KonfaVerificationBot/1.0 (+https://konfa.ng/bot)',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      redirect: 'follow',
    });
    clearTimeout(timer);

    if (!res.ok) {
      return json(200, {
        ok: false,
        reason: `We could not load your ${platform} profile (HTTP ${res.status}). Make sure the profile is public.`,
      });
    }

    html = await res.text();
  } catch (err) {
    const isTimeout = err?.name === 'AbortError';
    return json(200, {
      ok: false,
      reason: isTimeout
        ? `${platform} took too long to respond. Please try again in a moment.`
        : `Could not reach ${platform}. Make sure the profile is public.`,
    });
  }

  // ---- Look for the code ----
  // Match against the raw HTML (bio text appears in multiple places:
  // meta description, og:description, JSON-LD, and visible body).
  if (codeRegex.test(html)) {
    return json(200, { ok: true });
  }

  // ---- Not found: give a helpful reason per platform ----
  const hints = {
    instagram:
      'The code was not found in your Instagram bio. Instagram sometimes caches bios — wait 1–2 minutes, then try again.',
    tiktok:
      'The code was not found in your TikTok bio. Make sure your profile is public.',
    youtube:
      'The code was not found in your YouTube channel description. Add it under "About" and try again.',
    facebook:
      'The code was not found on your Facebook page. Make sure the About section is public.',
    x: 'The code was not found in your X bio. Make sure your profile is public.',
    whatsapp:
      'The code was not found in your WhatsApp Business About. Make sure WhatsApp Business is set up and the About is publicly visible.',
    website:
      'The code was not found on your website. Add it to any visible page — a homepage footer or a /verify page both work.',
  };

  return json(200, {
    ok: false,
    reason: hints[platform] || 'The code was not found on your profile.',
  });
};

function json(statusCode, body) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
    },
    body: JSON.stringify(body),
  };
}