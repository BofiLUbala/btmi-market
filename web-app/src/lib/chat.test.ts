import { describe, expect, it } from 'vitest'
import type { ChannelContact, OrderMessage } from '@/api/communication'
import { canWriteTo, groupByDay, initialContact, lastMessageAuthor, startsRun, threadWith } from './chat'

const msg = (id: string, from: OrderMessage['sender_party'], to: OrderMessage['recipient_party'], at: string): OrderMessage => ({
  id, conversation_id: 'c', sender_user_id: 'u', sender_type: 'SELLER', sender_name: '', body: id,
  is_admin_intervention: false, recipient_scope: 'ALL_PARTICIPANTS', sender_party: from, recipient_party: to, created_at: at,
})

describe('private threads', () => {
  const all = [
    msg('c1', 'COURIER', 'SELLER', '2026-09-30T08:00:00Z'),
    msg('a1', 'ADMIN', 'SELLER', '2026-09-30T08:05:00Z'),
    msg('s1', 'SELLER', 'ADMIN', '2026-09-30T08:01:00Z'),
    msg('b1', 'BUYER', 'ADMIN', '2026-09-30T08:02:00Z'),
  ]
  it('keeps only the two parties of the tab, oldest first', () => {
    expect(threadWith(all, 'SELLER', 'ADMIN').map((m) => m.id)).toEqual(['s1', 'a1'])
    expect(threadWith(all, 'SELLER', 'COURIER').map((m) => m.id)).toEqual(['c1'])
    expect(threadWith(all, 'SELLER', '')).toEqual([])
  })
  it('never shows the buyer to TBK message on the seller side', () => {
    expect(threadWith(all, 'SELLER', 'ADMIN').some((m) => m.sender_party === 'BUYER')).toBe(false)
  })
})

describe('tabs', () => {
  const c = (party: ChannelContact['party'], unread = 0, available = true): ChannelContact => ({ party, name: '', unread, available })
  it('opens the tab with unread messages first', () => {
    expect(initialContact([c('ADMIN'), c('COURIER', 2)])).toBe('COURIER')
    expect(initialContact([c('COURIER', 0, false), c('ADMIN')])).toBe('ADMIN')
    expect(initialContact([])).toBe('')
  })
  it('lets the buyer write to the courier before assignment', () => {
    expect(canWriteTo(c('COURIER', 0, false))).toBe(true)
    expect(canWriteTo(c('ADMIN', 0, false))).toBe(false)
    expect(canWriteTo(undefined)).toBe(false)
  })
})

describe('layout of a thread', () => {
  it('groups by calendar day', () => {
    const groups = groupByDay([
      msg('1', 'SELLER', 'ADMIN', '2026-09-29T10:00:00'),
      msg('2', 'ADMIN', 'SELLER', '2026-09-29T11:00:00'),
      msg('3', 'SELLER', 'ADMIN', '2026-09-30T09:00:00'),
    ])
    expect(groups.map((g) => [g.day, g.messages.length])).toEqual([['2026-09-29', 2], ['2026-09-30', 1]])
  })
  it('starts a new run on a new sender or after 5 minutes', () => {
    const a = msg('a', 'SELLER', 'ADMIN', '2026-09-30T08:00:00Z')
    expect(startsRun(undefined, a)).toBe(true)
    expect(startsRun(a, msg('b', 'SELLER', 'ADMIN', '2026-09-30T08:02:00Z'))).toBe(false)
    expect(startsRun(a, msg('c', 'SELLER', 'ADMIN', '2026-09-30T08:06:00Z'))).toBe(true)
    expect(startsRun(a, msg('d', 'ADMIN', 'SELLER', '2026-09-30T08:01:00Z'))).toBe(true)
  })
})

describe('inbox preview', () => {
  it('credits the right side of the last message', () => {
    expect(lastMessageAuthor({ last_message: 'hi', last_sender_party: 'COURIER', last_recipient_party: 'SELLER' }, 'SELLER')).toEqual({ kind: 'them', from: 'COURIER' })
    expect(lastMessageAuthor({ last_message: 'hi', last_sender_party: 'SELLER', last_recipient_party: 'ADMIN' }, 'SELLER')).toEqual({ kind: 'me', to: 'ADMIN' })
    expect(lastMessageAuthor({ last_message: '', last_sender_party: undefined, last_recipient_party: undefined }, 'SELLER')).toEqual({ kind: 'none' })
  })
})
