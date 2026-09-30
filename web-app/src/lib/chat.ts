import type { ChannelContact, ChatParty, ConversationListItem, OrderMessage } from '@/api/communication'

/**
 * Private order channels, shared by every chat screen (buyer, seller, courier,
 * Commerce Admin). A channel is a pair of parties; buyer <-> seller is never
 * one. These helpers hold the rules the screens used to repeat inline.
 */

/** The messages of the two-party thread between me and contact, oldest first. */
export function threadWith(messages: OrderMessage[], me: ChatParty, contact: ChatParty | ''): OrderMessage[] {
  if (!contact) return []
  return messages
    .filter((m) => (m.sender_party === me && m.recipient_party === contact) || (m.sender_party === contact && m.recipient_party === me))
    .sort((a, b) => a.created_at.localeCompare(b.created_at))
}

/**
 * The tab to open first: the one with unread messages, else the first one that
 * can be written to (TBK support is always there), else the first.
 */
export function initialContact(contacts: ChannelContact[]): ChatParty | '' {
  if (!contacts.length) return ''
  return (contacts.find((c) => c.unread > 0) ?? contacts.find((c) => c.available) ?? contacts[0]).party
}

/** The courier tab stays writable before assignment: the courier reads it once assigned. */
export function canWriteTo(contact: ChannelContact | undefined): boolean {
  return !!contact && (contact.available || contact.party === 'COURIER')
}

/** Local calendar day of an ISO timestamp, as YYYY-MM-DD. */
export function dayKey(iso: string): string {
  const d = new Date(iso)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export interface DayGroup { day: string; messages: OrderMessage[] }

/** Messages split by calendar day, for "Aujourd'hui" / date separators. */
export function groupByDay(messages: OrderMessage[]): DayGroup[] {
  const groups: DayGroup[] = []
  for (const m of messages) {
    const day = dayKey(m.created_at)
    const last = groups[groups.length - 1]
    if (last && last.day === day) last.messages.push(m)
    else groups.push({ day, messages: [m] })
  }
  return groups
}

/**
 * Whether a message starts a new visual run (different sender, or more than
 * five minutes after the previous one): only then is the sender line shown.
 */
export function startsRun(prev: OrderMessage | undefined, m: OrderMessage): boolean {
  if (!prev || prev.sender_party !== m.sender_party) return true
  return new Date(m.created_at).getTime() - new Date(prev.created_at).getTime() > 5 * 60_000
}

/**
 * Who the inbox row should credit for its last message, from the viewer's
 * side: "me" (with the party I wrote to), or the party that wrote to me.
 * Never the buyer on a seller's row: sellers do not talk to buyers.
 */
export function lastMessageAuthor(item: Pick<ConversationListItem, 'last_sender_party' | 'last_recipient_party' | 'last_message'>, me: ChatParty):
  | { kind: 'none' }
  | { kind: 'me'; to: ChatParty | undefined }
  | { kind: 'them'; from: ChatParty } {
  if (!item.last_message || !item.last_sender_party) return { kind: 'none' }
  if (item.last_sender_party === me) return { kind: 'me', to: item.last_recipient_party }
  return { kind: 'them', from: item.last_sender_party }
}
