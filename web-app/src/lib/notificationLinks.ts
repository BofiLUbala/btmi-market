import { safeInternalPath } from '@/lib/returnTo'

/** The screen a notification opens, as resolved by the server (metadata.link).
 * Empty for notifications written before links existed. */
export function notificationLink(item: { metadata?: Record<string, unknown> | null }): string {
  const link = item.metadata?.link
  return typeof link === 'string' ? safeInternalPath(link, '') : ''
}
