/** Only allow internal application paths (no open redirects). */
export function safeInternalPath(path: string | null | undefined, fallback = '/'): string {
  if (!path) return fallback
  if (!path.startsWith('/')) return fallback
  if (path.startsWith('//') || path.includes('\\')) return fallback
  if (/^\/[a-z]+:/i.test(path)) return fallback
  return path
}

/** Build a login path that preserves the intended destination. */
export function loginWithReturnTo(intendedPath: string): string {
  return `/login?returnTo=${encodeURIComponent(safeInternalPath(intendedPath))}`
}
