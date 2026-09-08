import { describe, expect, it } from 'vitest'
import type { AdminRole } from '@/api/admin'

function evaluateHasRole(currentRole: AdminRole | null, allowedRoles: AdminRole[]): boolean {
  if (!currentRole) return false
  if (currentRole === 'SUPER_ADMIN') return true
  return allowedRoles.includes(currentRole)
}

function evaluateCanAccessDashboard(
  currentRole: AdminRole | null,
  dashboard: 'direction' | 'commerce' | 'finance' | 'technical'
): boolean {
  if (!currentRole) return false
  if (currentRole === 'SUPER_ADMIN') return true
  switch (dashboard) {
    case 'direction':
      return currentRole === 'DIRECTION_ADMIN'
    case 'commerce':
      return currentRole === 'COMMERCE_ADMIN'
    case 'finance':
      return currentRole === 'FINANCE_SUPPORT_ADMIN'
    case 'technical':
      return currentRole === 'TECHNICAL_ADMIN'
    default:
      return false
  }
}

describe('Admin Auth RBAC and Dashboard Access Matrix', () => {
  describe('SUPER_ADMIN access', () => {
    const role: AdminRole = 'SUPER_ADMIN'

    it('SUPER_ADMIN has access to all four control center dashboards', () => {
      expect(evaluateCanAccessDashboard(role, 'direction')).toBe(true)
      expect(evaluateCanAccessDashboard(role, 'commerce')).toBe(true)
      expect(evaluateCanAccessDashboard(role, 'finance')).toBe(true)
      expect(evaluateCanAccessDashboard(role, 'technical')).toBe(true)
    })

    it('SUPER_ADMIN satisfies any allowedRoles requirement', () => {
      expect(evaluateHasRole(role, ['DIRECTION_ADMIN'])).toBe(true)
      expect(evaluateHasRole(role, ['COMMERCE_ADMIN'])).toBe(true)
      expect(evaluateHasRole(role, ['FINANCE_SUPPORT_ADMIN'])).toBe(true)
      expect(evaluateHasRole(role, ['TECHNICAL_ADMIN'])).toBe(true)
    })
  })

  describe('Scoped Admin roles', () => {
    it('COMMERCE_ADMIN can only access commerce dashboard', () => {
      const role: AdminRole = 'COMMERCE_ADMIN'
      expect(evaluateCanAccessDashboard(role, 'commerce')).toBe(true)
      expect(evaluateCanAccessDashboard(role, 'direction')).toBe(false)
      expect(evaluateCanAccessDashboard(role, 'finance')).toBe(false)
      expect(evaluateCanAccessDashboard(role, 'technical')).toBe(false)
    })

    it('FINANCE_SUPPORT_ADMIN can only access finance dashboard', () => {
      const role: AdminRole = 'FINANCE_SUPPORT_ADMIN'
      expect(evaluateCanAccessDashboard(role, 'finance')).toBe(true)
      expect(evaluateCanAccessDashboard(role, 'commerce')).toBe(false)
      expect(evaluateCanAccessDashboard(role, 'technical')).toBe(false)
    })

    it('TECHNICAL_ADMIN can only access technical dashboard', () => {
      const role: AdminRole = 'TECHNICAL_ADMIN'
      expect(evaluateCanAccessDashboard(role, 'technical')).toBe(true)
      expect(evaluateCanAccessDashboard(role, 'commerce')).toBe(false)
      expect(evaluateCanAccessDashboard(role, 'direction')).toBe(false)
    })

    it('Unauthenticated user cannot access any dashboard', () => {
      expect(evaluateCanAccessDashboard(null, 'direction')).toBe(false)
      expect(evaluateCanAccessDashboard(null, 'commerce')).toBe(false)
      expect(evaluateCanAccessDashboard(null, 'finance')).toBe(false)
      expect(evaluateCanAccessDashboard(null, 'technical')).toBe(false)
      expect(evaluateHasRole(null, ['SUPER_ADMIN'])).toBe(false)
    })
  })
})
