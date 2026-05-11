/**
 * SQL escape utilities for db9 queries.
 *
 * db9's client accepts only a SQL string (no parameter array), so these
 * helpers are the last line of defence. Prefer validating inputs against
 * a whitelist (see SAFE_IDENT / SAFE_PATH below) before concatenating.
 */

/** Escape a string for use in SQL single-quoted literals */
export const esc = (s: string): string =>
  s.replace(/\\/g, '\\\\').replace(/'/g, "''")

/**
 * Escape an already-JSON-encoded string for embedding in a Postgres
 * single-quoted literal that will be cast to jsonb. Only the SQL quote
 * needs doubling — backslashes must be preserved as-is so that JSON's own
 * escape sequences (\n, \", \\ etc.) survive round-tripping through
 * the jsonb parser.
 *
 * IMPORTANT: never pass raw user text here; always pass JSON.stringify(...).
 */
export const escJson = (s: string): string => s.replace(/'/g, "''")

/** Escape a string for use in SQL ILIKE patterns */
export const escLike = (s: string): string =>
  esc(s).replace(/%/g, '\\%').replace(/_/g, '\\_')

/** Safe identifier (agent name, kind, etc.) — lowercase/digits/underscore/hyphen */
export const SAFE_IDENT = /^[a-z][a-z0-9_-]{0,63}$/i

/** Safe artifact path — domain/category/item with conservative character set */
export const SAFE_PATH = /^[A-Za-z0-9_/.\-]{1,256}$/
