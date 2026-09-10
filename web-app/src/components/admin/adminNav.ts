import type { AdminRole } from '@/api/admin'

/** One navigable feature inside a section. */
export type NavItem = {
  to: string
  labelKey: string
  /** Match the route exactly (section roots, which are prefixes of their own children). */
  end?: boolean
}

export type NavSection = {
  key: string
  labelKey: string
  icon: IconName
  accent: string
  /** Roles allowed to open anything in this section. Mirrors the route guards. */
  roles: AdminRole[]
  /** Where the section header itself navigates to. */
  root: string
  items: NavItem[]
}

export type IconName =
  | 'compass' | 'box' | 'wallet' | 'shield'
  | 'users' | 'flag' | 'sliders'
  | 'gauge' | 'list' | 'scroll' | 'tag' | 'layers' | 'clock' | 'cart'
  | 'badge' | 'search' | 'trending' | 'sparkle' | 'percent' | 'store' | 'chart'
  | 'coins' | 'gift' | 'growth' | 'star' | 'storefront' | 'case' | 'alert'
  | 'heart' | 'database' | 'bolt' | 'cog' | 'mail' | 'lock' | 'key' | 'branch' | 'phone'

/** The four operational dashboards, each with the features it owns.
 *
 *  This is the single source of truth for the sidebar, the breadcrumb and the
 *  role-to-section map, so a feature can never appear in navigation without a
 *  route behind it, and `roles` here always matches the guard in App.tsx. */
export const SECTIONS: NavSection[] = [
  {
    key: 'direction',
    labelKey: 'admin.layout.navDirection',
    icon: 'compass',
    accent: '#60a5fa',
    roles: ['DIRECTION_ADMIN', 'SUPER_ADMIN'],
    root: '/admin/direction',
    items: [
      { to: '/admin/direction', labelKey: 'admin.layout.itemOverview', end: true },
      { to: '/admin/direction/users', labelKey: 'admin.layout.itemUserManagement' },
      { to: '/admin/direction/audit', labelKey: 'admin.layout.itemAuditLedger' }
    ]
  },
  {
    key: 'commerce',
    labelKey: 'admin.layout.navCommerce',
    icon: 'box',
    accent: '#34d399',
    roles: ['COMMERCE_ADMIN', 'SUPER_ADMIN'],
    root: '/admin/commerce',
    items: [
      { to: '/admin/commerce', labelKey: 'admin.layout.itemOverview', end: true },
      { to: '/admin/commerce/orders', labelKey: 'admin.layout.itemOrders' },
      { to: '/admin/commerce/products', labelKey: 'admin.layout.itemProducts' },
      { to: '/admin/commerce/categories', labelKey: 'admin.layout.itemCategories' },
      { to: '/admin/commerce/inventory', labelKey: 'admin.layout.itemInventory', end: true },
      { to: '/admin/commerce/inventory/history', labelKey: 'admin.layout.itemStockHistory' },
      { to: '/admin/commerce/employees', labelKey: 'admin.layout.itemEmployees' },
      { to: '/admin/commerce/marketplace/visibility', labelKey: 'admin.layout.itemVisibility' },
      { to: '/admin/commerce/marketplace/search', labelKey: 'admin.layout.itemSearch' },
      { to: '/admin/commerce/marketplace/ranking', labelKey: 'admin.layout.itemRanking' },
      { to: '/admin/commerce/marketplace/quality', labelKey: 'admin.layout.itemQuality' },
      { to: '/admin/commerce/marketplace/promotions', labelKey: 'admin.layout.itemPromotions' },
      { to: '/admin/commerce/performance/sellers', labelKey: 'admin.layout.itemSellerPerf' },
      { to: '/admin/commerce/performance/shops', labelKey: 'admin.layout.itemShopPerf' },
      { to: '/admin/commerce/performance/categories', labelKey: 'admin.layout.itemCategoryPerf' }
    ]
  },
  {
    key: 'finance',
    labelKey: 'admin.layout.navFinance',
    icon: 'wallet',
    accent: '#fbbf24',
    roles: ['FINANCE_SUPPORT_ADMIN', 'SUPER_ADMIN'],
    root: '/admin/finance',
    items: [
      { to: '/admin/finance', labelKey: 'admin.layout.itemOverview', end: true },
      { to: '/admin/finance/payments', labelKey: 'admin.layout.itemCashPayments' },
      { to: '/admin/finance/points', labelKey: 'admin.layout.itemBuyerPoints' },
      { to: '/admin/finance/growth', labelKey: 'admin.layout.itemSellerGrowth' },
      { to: '/admin/finance/reviews-product', labelKey: 'admin.layout.itemProductReviews' },
      { to: '/admin/finance/reviews-shop', labelKey: 'admin.layout.itemShopReviews' },
      { to: '/admin/finance/cases', labelKey: 'admin.layout.itemCases' },
      { to: '/admin/finance/risk', labelKey: 'admin.layout.itemRisk' }
    ]
  },
  {
    key: 'technical',
    labelKey: 'admin.layout.navTechnical',
    icon: 'shield',
    accent: '#2dd4bf',
    roles: ['TECHNICAL_ADMIN', 'SUPER_ADMIN'],
    root: '/admin/technical',
    items: [
      { to: '/admin/technical', labelKey: 'admin.layout.itemOverview', end: true },
      { to: '/admin/technical/health', labelKey: 'admin.layout.itemSystemHealth' },
      { to: '/admin/technical/database', labelKey: 'admin.layout.itemPostgres' },
      { to: '/admin/technical/redis', labelKey: 'admin.layout.itemRedis' },
      { to: '/admin/technical/workers', labelKey: 'admin.layout.itemWorkers' },
      { to: '/admin/technical/email', labelKey: 'admin.layout.itemEmailHealth' },
      { to: '/admin/technical/security', labelKey: 'admin.layout.itemSecurityEvents' },
      { to: '/admin/technical/sessions', labelKey: 'admin.layout.itemSessions' },
      { to: '/admin/technical/migrations', labelKey: 'admin.layout.itemMigrations' },
      { to: '/admin/technical/versions', labelKey: 'admin.layout.itemAppVersions' }
    ]
  }
]

/** Platform administration. Flat rows rather than a section: each is one page. */
export const ADMINISTRATION: { to: string; labelKey: string; icon: IconName }[] = [
  { to: '/admin/admin-users', labelKey: 'admin.layout.navAdminUsers', icon: 'users' },
  { to: '/admin/platform/feature-flags', labelKey: 'admin.layout.navFlags', icon: 'flag' },
  { to: '/admin/platform/advanced', labelKey: 'admin.layout.navAdvanced', icon: 'sliders' }
]

const SECTION_BY_KEY = new Map(SECTIONS.map((s) => [s.key, s]))

/** The single dashboard an operational role administers. SUPER_ADMIN owns all. */
export const ROLE_SECTION: Record<string, string> = {
  DIRECTION_ADMIN: 'direction',
  COMMERCE_ADMIN: 'commerce',
  FINANCE_SUPPORT_ADMIN: 'finance',
  TECHNICAL_ADMIN: 'technical'
}

/** Sections a role may open. An operational admin gets exactly one; hiding the
 *  rest is what keeps the 4-dashboard switcher out of their sidebar. */
export function sectionsForRole(role: AdminRole | null): NavSection[] {
  if (!role) return []
  if (role === 'SUPER_ADMIN') return SECTIONS
  const key = ROLE_SECTION[role]
  const section = key ? SECTION_BY_KEY.get(key) : undefined
  return section ? [section] : []
}

/** Landing route for a role, so nobody is sent to a dashboard they cannot open. */
export function defaultRouteForRole(role: AdminRole | null): string {
  if (!role) return '/admin/login'
  return sectionsForRole(role)[0]?.root ?? '/admin/login'
}

/** Longest-prefix match, so `/admin/commerce/orders/:id` still resolves to the
 *  Orders item rather than falling back to the Commerce overview. */
export function matchLocation(pathname: string, role: AdminRole | null) {
  const sections = sectionsForRole(role)

  for (const section of sections) {
    if (pathname !== section.root && !pathname.startsWith(`${section.root}/`)) continue
    let best: NavItem | undefined
    for (const item of section.items) {
      const hit = item.end ? pathname === item.to : pathname === item.to || pathname.startsWith(`${item.to}/`)
      if (hit && (!best || item.to.length > best.to.length)) best = item
    }
    return { section, item: best, admin: undefined }
  }

  if (role === 'SUPER_ADMIN') {
    const admin = ADMINISTRATION.find((entry) => pathname === entry.to || pathname.startsWith(`${entry.to}/`))
    if (admin) return { section: undefined, item: undefined, admin }
  }

  return { section: undefined, item: undefined, admin: undefined }
}
