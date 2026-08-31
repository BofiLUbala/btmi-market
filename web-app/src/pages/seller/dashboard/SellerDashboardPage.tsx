import { useEffect, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/store/auth'
import {
  shopApi,
  productApi,
  orderApi,
  employeeApi,
  cashApi,
  growthApi,
} from '@/api/seller'
import type { SellerOrder, Shop, Product, Employee, CashSummary, SellerGrowth } from '@/api/types'
import {
  StoreIcon,
  BoxIcon,
  OrdersIcon,
  UsersIcon,
  CashIcon,
  GrowthIcon,
  PlusIcon,
  ShieldCheckIcon,
  RefreshCwIcon,
  ArrowRightIcon,
  BusinessIcon,
  CheckCircleIcon,
} from '@/components/ui/Icons'
import { Button } from '@/components/ui/Button'
import { ErrorBox, LoadingBlock } from '@/components/ui/Feedback'
import { useT } from '@/store/i18n'
import type { TranslationKey } from '@/locales/fr'

const TRUST_STATUS_KEYS: Record<string, TranslationKey> = {
  HIGH: 'seller.growth.trust.HIGH',
  NORMAL: 'seller.growth.trust.NORMAL',
  LOW: 'seller.growth.trust.LOW',
  SUSPENDED: 'seller.growth.trust.SUSPENDED',
}

interface DashboardData {
  shops: Shop[]
  products: Product[]
  orders: SellerOrder[]
  employees: Employee[]
  cashSummary: CashSummary | null
  growth: SellerGrowth | null
}

export default function SellerDashboardPage() {
  const t = useT()
  const { activeBusiness, sellerBusinesses, setActiveBusiness, loading: authLoading } = useAuth()
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const loadDashboard = useCallback(async () => {
    if (!activeBusiness) return
    setLoading(true)
    setError('')
    try {
      const [
        shopsRes,
        productsRes,
        ordersRes,
        employeesRes,
        cashRes,
        growthRes,
      ] = await Promise.allSettled([
        shopApi.listByBusiness(activeBusiness.id),
        productApi.listByBusiness(activeBusiness.id),
        orderApi.listByBusiness(activeBusiness.id, { limit: 10 }),
        employeeApi.listByBusiness(activeBusiness.id),
        cashApi.getBusinessCashSummary(activeBusiness.id),
        growthApi.getLevel(activeBusiness.id),
      ])

      setData({
        shops: shopsRes.status === 'fulfilled' && Array.isArray(shopsRes.value) ? shopsRes.value : [],
        products: productsRes.status === 'fulfilled' && Array.isArray(productsRes.value) ? productsRes.value : [],
        orders: ordersRes.status === 'fulfilled' && Array.isArray(ordersRes.value) ? ordersRes.value : [],
        employees: employeesRes.status === 'fulfilled' && Array.isArray(employeesRes.value) ? employeesRes.value : [],
        cashSummary: cashRes.status === 'fulfilled' ? cashRes.value : null,
        growth: growthRes.status === 'fulfilled' ? growthRes.value : null,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : t('seller.dashboard.loadFailed'))
    } finally {
      setLoading(false)
    }
  }, [activeBusiness?.id, t])

  useEffect(() => {
    if (activeBusiness) {
      loadDashboard()
    }
  }, [activeBusiness?.id, loadDashboard])

  if (authLoading) {
    return <LoadingBlock label={t('seller.dashboard.loadingWorkspace')} />
  }

  const bizList = Array.isArray(sellerBusinesses) ? sellerBusinesses : []

  // ── 1. No Business exists for this seller ──
  if (bizList.length === 0) {
    return (
      <div className="seller-onboarding-empty-card">
        <div className="empty-icon-wrap">
          <BusinessIcon />
        </div>
        <h2>{t('seller.dashboard.welcomeTitle')}</h2>
        <p className="lead muted">
          {t('seller.dashboard.welcomeSubtitle')}
        </p>
        <div className="empty-actions">
          <Link to="/seller/onboarding">
            <Button size="lg">
              <PlusIcon /> {t('seller.onboarding.createBusiness')}
            </Button>
          </Link>
        </div>

        <div className="onboarding-steps-preview">
          <h3>{t('seller.dashboard.howToStart')}</h3>
          <div className="onboarding-step-grid">
            <div className="onboarding-step-item">
              <span className="step-num">1</span>
              <div>
                <strong>{t('seller.onboarding.createBusiness')}</strong>
                <p className="small muted">{t('seller.dashboard.stepCreateBusinessDesc')}</p>
              </div>
            </div>
            <div className="onboarding-step-item">
              <span className="step-num">2</span>
              <div>
                <strong>{t('seller.dashboard.stepCreateShop')}</strong>
                <p className="small muted">{t('seller.dashboard.stepCreateShopDesc')}</p>
              </div>
            </div>
            <div className="onboarding-step-item">
              <span className="step-num">3</span>
              <div>
                <strong>{t('seller.dashboard.stepAddProducts')}</strong>
                <p className="small muted">{t('seller.dashboard.stepAddProductsDesc')}</p>
              </div>
            </div>
            <div className="onboarding-step-item">
              <span className="step-num">4</span>
              <div>
                <strong>{t('seller.dashboard.stepAddStock')}</strong>
                <p className="small muted">{t('seller.dashboard.stepAddStockDesc')}</p>
              </div>
            </div>
            <div className="onboarding-step-item">
              <span className="step-num">5</span>
              <div>
                <strong>{t('seller.dashboard.stepReceiveOrders')}</strong>
                <p className="small muted">{t('seller.dashboard.stepReceiveOrdersDesc')}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ── 2. Seller has businesses, but none currently active ──
  if (!activeBusiness) {
    return (
      <div className="seller-onboarding-empty-card">
        <div className="empty-icon-wrap">
          <BusinessIcon />
        </div>
        <h2>{t('seller.dashboard.selectBusiness')}</h2>
        <p className="lead muted">{t('seller.dashboard.selectBusinessHint')}</p>
        <div className="business-selection-grid">
          {bizList.map((b) => (
            <button
              key={b.id}
              type="button"
              className="business-choice-card"
              onClick={() => setActiveBusiness(b)}
            >
              <div className="choice-brand">
                <BusinessIcon />
              </div>
              <div className="choice-info">
                <strong>{b.name}</strong>
                <span className="small muted">{b.category || b.business_type || t('seller.dashboard.registeredBusiness')}</span>
              </div>
              <ArrowRightIcon />
            </button>
          ))}
        </div>
        <div style={{ marginTop: 24 }}>
          <Link to="/seller/onboarding">
            <Button variant="outline">
              <PlusIcon /> {t('seller.dashboard.addAnotherBusiness')}
            </Button>
          </Link>
        </div>
      </div>
    )
  }

  // ── 3. Active Business Dashboard ──
  const shopsCount = Array.isArray(data?.shops) ? data.shops.length : 0
  const productsCount = Array.isArray(data?.products) ? data.products.length : 0
  const publishedProducts = Array.isArray(data?.products)
    ? data.products.filter((p) => p.publication_status === 'PUBLISHED').length
    : 0
  const ordersCount = Array.isArray(data?.orders) ? data.orders.length : 0
  const totalRevenue = Array.isArray(data?.orders)
    ? data.orders.reduce((sum, o) => sum + (o.final_total || 0), 0)
    : 0
  const employeesCount = Array.isArray(data?.employees) ? data.employees.length : 0
  const cashTotal = data?.cashSummary?.total_cash_sales || 0
  const sellerLevel = data?.growth?.level?.name || 'STARTER'
  const sellerPoints = data?.growth?.points?.current_points || 0
  const trustStatus = data?.growth?.trust?.trust_status || 'NORMAL'
  const recentOrders = Array.isArray(data?.orders) ? data.orders : []

  return (
    <div className="seller-dashboard-page">
      {/* ── Page Top Header ── */}
      <div className="dashboard-page-header">
        <div className="header-titles">
          <h1>{t('seller.dashboard')}</h1>
          <p className="muted">
            {t('seller.dashboard.overviewFor', { name: activeBusiness.name })}
          </p>
        </div>
        <div className="header-actions">
          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={loadDashboard}
            disabled={loading}
            title={t('seller.dashboard.refreshTitle')}
          >
            <RefreshCwIcon /> {t('orders.refresh')}
          </button>
          <Link to="/seller/products/new">
            <Button size="sm">
              <PlusIcon /> {t('seller.dashboard.addProduct')}
            </Button>
          </Link>
        </div>
      </div>

      {error && <ErrorBox error={error} onRetry={loadDashboard} />}

      {loading && !data && <LoadingBlock label={t('seller.dashboard.loadingMetrics')} />}

      {/* ── Metrics Grid (Row 1) ── */}
      <div className="seller-metrics-grid">
        {/* Shops */}
        <div className="seller-stat-card">
          <div className="stat-header">
            <span className="stat-label">{t('seller.shops')}</span>
            <span className="stat-icon stat-icon--shops">
              <StoreIcon />
            </span>
          </div>
          <div className="stat-value">{shopsCount}</div>
          <div className="stat-footer">
            <Link to="/seller/shops" className="stat-link">
              {t('seller.dashboard.manageShops')} <ArrowRightIcon />
            </Link>
          </div>
        </div>

        {/* Products */}
        <div className="seller-stat-card">
          <div className="stat-header">
            <span className="stat-label">{t('seller.products')}</span>
            <span className="stat-icon stat-icon--products">
              <BoxIcon />
            </span>
          </div>
          <div className="stat-value">{productsCount}</div>
          <div className="stat-footer">
            <span className="muted small">{t('seller.dashboard.publishedCount', { count: publishedProducts })}</span>
            <Link to="/seller/products" className="stat-link">
              {t('common.viewAll')} <ArrowRightIcon />
            </Link>
          </div>
        </div>

        {/* Orders */}
        <div className="seller-stat-card">
          <div className="stat-header">
            <span className="stat-label">{t('seller.orders')}</span>
            <span className="stat-icon stat-icon--orders">
              <OrdersIcon />
            </span>
          </div>
          <div className="stat-value">{ordersCount}</div>
          <div className="stat-footer">
            <span className="muted small">{totalRevenue.toLocaleString()} FC</span>
            <Link to="/seller/orders" className="stat-link">
              {t('seller.dashboard.viewOrders')} <ArrowRightIcon />
            </Link>
          </div>
        </div>

        {/* Team / Employees */}
        <div className="seller-stat-card">
          <div className="stat-header">
            <span className="stat-label">{t('seller.employees')}</span>
            <span className="stat-icon stat-icon--employees">
              <UsersIcon />
            </span>
          </div>
          <div className="stat-value">{employeesCount}</div>
          <div className="stat-footer">
            <Link to="/seller/employees" className="stat-link">
              {t('seller.dashboard.manageTeam')} <ArrowRightIcon />
            </Link>
          </div>
        </div>

        {/* Cash Sales */}
        <div className="seller-stat-card">
          <div className="stat-header">
            <span className="stat-label">{t('seller.cash.cashSales')}</span>
            <span className="stat-icon stat-icon--cash">
              <CashIcon />
            </span>
          </div>
          <div className="stat-value">{cashTotal.toLocaleString()} <span className="currency-unit">FC</span></div>
          <div className="stat-footer">
            <Link to="/seller/cash" className="stat-link">
              {t('seller.dashboard.cashSessions')} <ArrowRightIcon />
            </Link>
          </div>
        </div>

        {/* Seller Growth & Trust */}
        <div className="seller-stat-card">
          <div className="stat-header">
            <span className="stat-label">{t('seller.dashboard.sellerLevel')}</span>
            <span className="stat-icon stat-icon--growth">
              <GrowthIcon />
            </span>
          </div>
          <div className="stat-value stat-value--tier">{sellerLevel}</div>
          <div className="stat-footer">
            <span className="trust-pill">
              <ShieldCheckIcon /> {t(TRUST_STATUS_KEYS[trustStatus] ?? 'seller.growth.trust.NORMAL')} ({sellerPoints} pts)
            </span>
            <Link to="/seller/growth" className="stat-link">
              {t('seller.growth')} <ArrowRightIcon />
            </Link>
          </div>
        </div>
      </div>

      {/* ── Main Dashboard Sections (2 Columns) ── */}
      <div className="seller-dashboard-columns">
        {/* Left Column: Recent Orders */}
        <div className="seller-section-card">
          <div className="section-card-header">
            <div>
              <h3>{t('seller.dashboard.recentOrders')}</h3>
              <p className="small muted">{t('seller.dashboard.recentOrdersHint')}</p>
            </div>
            <Link to="/seller/orders" className="section-header-link">
              {t('seller.dashboard.viewAllOrders')}
            </Link>
          </div>

          {recentOrders.length === 0 ? (
            <div className="section-empty-block">
              <OrdersIcon />
              <p>{t('seller.dashboard.noOrdersYet')}</p>
              <span className="small muted">{t('seller.dashboard.noOrdersYetHint')}</span>
            </div>
          ) : (
            <div className="seller-table-wrap">
              <table className="seller-data-table">
                <thead>
                  <tr>
                    <th>{t('seller.dashboard.orderNumberHeader')}</th>
                    <th>{t('common.status')}</th>
                    <th>{t('common.total')}</th>
                    <th>{t('common.date')}</th>
                  </tr>
                </thead>
                <tbody>
                  {recentOrders.slice(0, 5).map((order) => (
                    <tr key={order.id}>
                      <td>
                        <Link to={`/seller/orders`} className="order-code-link">
                          {order.order_number || `#${order.id.slice(0, 8)}`}
                        </Link>
                      </td>
                      <td>
                        <span className={`seller-status-badge status-${order.status?.toLowerCase()}`}>
                          {order.status ? t(`status.${order.status}` as TranslationKey) : '—'}
                        </span>
                      </td>
                      <td>
                        <strong>{order.final_total?.toLocaleString() || '0'} FC</strong>
                      </td>
                      <td className="muted small">
                        {order.created_at ? new Date(order.created_at).toLocaleDateString() : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Right Column: Quick Operational Actions */}
        <div className="seller-section-card">
          <div className="section-card-header">
            <div>
              <h3>{t('seller.dashboard.quickActions')}</h3>
              <p className="small muted">{t('seller.dashboard.quickActionsHint')}</p>
            </div>
          </div>

          <div className="seller-quick-actions-grid">
            <Link to="/seller/products/new" className="quick-action-btn">
              <span className="qa-icon"><PlusIcon /></span>
              <div className="qa-copy">
                <strong>{t('seller.dashboard.addProduct')}</strong>
                <span className="small muted">{t('seller.dashboard.addProductDesc')}</span>
              </div>
            </Link>

            <Link to="/seller/stock" className="quick-action-btn">
              <span className="qa-icon"><BoxIcon /></span>
              <div className="qa-copy">
                <strong>{t('seller.dashboard.manageStock')}</strong>
                <span className="small muted">{t('seller.dashboard.manageStockDesc')}</span>
              </div>
            </Link>

            <Link to="/seller/orders" className="quick-action-btn">
              <span className="qa-icon"><OrdersIcon /></span>
              <div className="qa-copy">
                <strong>{t('seller.dashboard.processOrders')}</strong>
                <span className="small muted">{t('seller.dashboard.processOrdersDesc')}</span>
              </div>
            </Link>

            <Link to="/seller/shops" className="quick-action-btn">
              <span className="qa-icon"><StoreIcon /></span>
              <div className="qa-copy">
                <strong>{t('seller.dashboard.manageShops')}</strong>
                <span className="small muted">{t('seller.dashboard.manageShopsDesc')}</span>
              </div>
            </Link>

            <Link to="/seller/employees" className="quick-action-btn">
              <span className="qa-icon"><UsersIcon /></span>
              <div className="qa-copy">
                <strong>{t('seller.dashboard.teamAndStaff')}</strong>
                <span className="small muted">{t('seller.dashboard.teamAndStaffDesc')}</span>
              </div>
            </Link>

            <Link to="/seller/cash" className="quick-action-btn">
              <span className="qa-icon"><CashIcon /></span>
              <div className="qa-copy">
                <strong>{t('seller.dashboard.cashSessions')}</strong>
                <span className="small muted">{t('seller.dashboard.cashSessionsDesc')}</span>
              </div>
            </Link>
          </div>
        </div>
      </div>

      {/* ── Bottom Section: Store Setup Progress ── */}
      <div className="seller-section-card seller-setup-card">
        <div className="section-card-header">
          <div>
            <h3>{t('seller.dashboard.setupChecklist')}</h3>
            <p className="small muted">{t('seller.dashboard.setupChecklistHint')}</p>
          </div>
        </div>

        <div className="seller-checklist-grid">
          <div className="checklist-item checklist-item--done">
            <span className="check-icon"><CheckCircleIcon /></span>
            <div>
              <strong>{t('seller.dashboard.checkBusinessRegistered')}</strong>
              <p className="small muted">{activeBusiness.name}</p>
            </div>
          </div>

          <div className={`checklist-item ${shopsCount > 0 ? 'checklist-item--done' : 'checklist-item--pending'}`}>
            <span className="check-icon"><CheckCircleIcon /></span>
            <div>
              <strong>{t('seller.dashboard.checkCreateShop')}</strong>
              {shopsCount > 0 ? (
                <p className="small muted">{t('seller.dashboard.shopsActiveCount', { count: shopsCount })}</p>
              ) : (
                <Link to="/seller/shops" className="small checklist-link">{t('seller.dashboard.checkCreateShopLink')}</Link>
              )}
            </div>
          </div>

          <div className={`checklist-item ${productsCount > 0 ? 'checklist-item--done' : 'checklist-item--pending'}`}>
            <span className="check-icon"><CheckCircleIcon /></span>
            <div>
              <strong>{t('seller.dashboard.checkAddProducts')}</strong>
              {productsCount > 0 ? (
                <p className="small muted">{t('seller.dashboard.productsInCatalogCount', { count: productsCount })}</p>
              ) : (
                <Link to="/seller/products/new" className="small checklist-link">{t('seller.dashboard.addProductLink')}</Link>
              )}
            </div>
          </div>

          <div className={`checklist-item ${publishedProducts > 0 ? 'checklist-item--done' : 'checklist-item--pending'}`}>
            <span className="check-icon"><CheckCircleIcon /></span>
            <div>
              <strong>{t('seller.dashboard.checkPublishProducts')}</strong>
              {publishedProducts > 0 ? (
                <p className="small muted">{t('seller.dashboard.publishedMarketplaceCount', { count: publishedProducts })}</p>
              ) : (
                <Link to="/seller/products" className="small checklist-link">{t('seller.dashboard.publishLink')}</Link>
              )}
            </div>
          </div>

          <div className={`checklist-item ${ordersCount > 0 ? 'checklist-item--done' : 'checklist-item--pending'}`}>
            <span className="check-icon"><CheckCircleIcon /></span>
            <div>
              <strong>{t('seller.dashboard.checkReceiveFirstOrder')}</strong>
              {ordersCount > 0 ? (
                <p className="small muted">{t('seller.dashboard.ordersProcessedCount', { count: ordersCount })}</p>
              ) : (
                <p className="small muted">{t('seller.dashboard.ordersAppearHint')}</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}