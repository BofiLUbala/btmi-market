import { describe, expect, it } from 'vitest'
import type { User } from '@/api/types'
import { resolveMode, scopeUserToMode } from './auth'

function user(account_type: User['account_type'], caps: Partial<NonNullable<User['capabilities']>>): User {
  return {
    id: 'u1',
    first_name: 'A',
    last_name: 'B',
    email: 'a@b.c',
    phone: '+243',
    account_type,
    capabilities: { buyer: false, seller: false, seller_onboarding: false, ...caps },
  } as User
}

describe('active mode for a buyer + seller account', () => {
  const dual = user('SELLER', { buyer: true, seller: true })

  it('signing in as buyer exposes only the buyer role', () => {
    const scoped = scopeUserToMode(dual, resolveMode(dual, 'buyer'))
    expect(scoped.account_type).toBe('BUYER')
    expect(scoped.capabilities).toMatchObject({ buyer: true, seller: false, seller_onboarding: false })
  })

  it('signing in as seller exposes only the seller role', () => {
    const scoped = scopeUserToMode(dual, resolveMode(dual, 'seller'))
    expect(scoped.account_type).toBe('SELLER')
    expect(scoped.capabilities).toMatchObject({ buyer: false, seller: true })
  })

  it('without a stored choice keeps the previous default (the account type)', () => {
    expect(resolveMode(dual, null)).toBe('seller')
    expect(resolveMode(user('BUYER', { buyer: true, seller: true }), null)).toBe('buyer')
  })

  it('a seller still onboarding (no business yet) can pick either space', () => {
    const onboarding = user('SELLER', { buyer: true, seller_onboarding: true })
    expect(scopeUserToMode(onboarding, 'buyer').account_type).toBe('BUYER')
    expect(scopeUserToMode(onboarding, 'seller').capabilities).toMatchObject({ seller_onboarding: true, buyer: false })
  })
})

describe('single-role accounts are unchanged', () => {
  it('a pure buyer asking for the seller space stays a buyer', () => {
    const buyer = user('BUYER', { buyer: true })
    expect(resolveMode(buyer, 'seller')).toBe('buyer')
    expect(scopeUserToMode(buyer, 'buyer')).toEqual(buyer)
  })

  it('a pure seller asking for the buyer space stays a seller', () => {
    const seller = user('SELLER', { seller: true })
    expect(resolveMode(seller, 'buyer')).toBe('seller')
    expect(scopeUserToMode(seller, 'seller')).toEqual(seller)
  })

  it('couriers are never rescoped', () => {
    const courier = user('COURIER', { courier: true, buyer: true })
    expect(scopeUserToMode(courier, 'buyer')).toBe(courier)
  })
})
