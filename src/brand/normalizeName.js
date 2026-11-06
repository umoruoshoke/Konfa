// src/brand/normalizeName.js
/**
 * Shared name normalization used by both client and any server/backfill code.
 * Goal: two names that "look the same" to a human must normalize to the same
 * string, so we can enforce uniqueness fairly.
 *
 * Rules:
 *  - trim leading/trailing whitespace
 *  - lowercase
 *  - collapse internal whitespace runs to a single space
 *  - strip punctuation & symbols, keep letters, numbers, and spaces
 *    (Unicode-aware, so non-Latin scripts are preserved)
 */
export const normalizeBrandName = (name = '') =>
  name
    .toString()
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[^\p{L}\p{N} ]/gu, '');