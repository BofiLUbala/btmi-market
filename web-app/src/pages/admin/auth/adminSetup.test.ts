import { describe, expect, it } from 'vitest'
import { fr } from '@/locales/fr'
import { en } from '@/locales/en'
import { localizeApiError } from '@/api/errorMessages'

import setupPage from './AdminSetupPage.tsx?raw'
import loginPage from './AdminLoginPage.tsx?raw'
import adminApi from '@/api/admin.ts?raw'
import app from '@/App.tsx?raw'

describe('super admin setup screens', () => {
  it('does not ask for, or send, a setup code', () => {
    // The backend no longer reads one: a code in the payload or an unlabeled
    // field made the form fail with "Some information is invalid".
    expect(setupPage).not.toMatch(/setup_code|setCode|codeLabel/)
    expect(adminApi).not.toMatch(/setup_code/)
    expect(Object.keys(fr).filter((k) => k.startsWith('admin.setupCode.') || k === 'admin.setup.codeLabel')).toEqual([])
  })

  it('shows every message the setup and activation flow can raise, in both languages', () => {
    const keys = [
      'admin.login.accountPending',
      'admin.setup.unavailable',
      'admin.setup.activate.invalid',
      'apiError.ADMIN_ACCOUNT_PENDING',
      'apiError.SETUP_UNAVAILABLE',
      'apiError.SETUP_LINK_EXPIRED',
      'apiError.INVALID_SETUP_LINK',
      'apiError.SETUP_NOT_PENDING',
      'apiError.EMAIL_ALREADY_EXISTS',
    ] as const
    for (const key of keys) {
      expect(fr[key as keyof typeof fr], `fr ${key}`).toBeTruthy()
      expect(en[key as keyof typeof fr], `en ${key}`).toBeTruthy()
    }
  })

  it('tells a pending admin to open the activation e-mail, not that the account is suspended', () => {
    const pending = localizeApiError(401, 'ADMIN_ACCOUNT_PENDING', 'ADMIN_ACCOUNT_PENDING', 'en')
    expect(pending).toBe(en['apiError.ADMIN_ACCOUNT_PENDING'])
    expect(pending).not.toMatch(/suspended/i)
  })

  it('sends the sign-in screen the pending message', () => {
    expect(loginPage).toContain("rawMsg === 'ADMIN_ACCOUNT_PENDING'")
    expect(loginPage).toContain("t('admin.login.accountPending')")
  })

  it('has an activation route, since the e-mailed link opens it', () => {
    expect(app).toContain('path="/admin/setup/activate"')
  })
})
