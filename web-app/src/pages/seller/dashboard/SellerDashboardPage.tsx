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

interface DashboardData {
  shops: Shop[]
  products: Product[]
  orders: SellerOrder[]
  employees: Employee[]
  cashSummary: CashSummary | null
  growth: SellerGrowth | null
}

export default function SellerDashboardPage() {
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
      setError(err instanceof Error ? err.message : 'Unable to load dashboard metrics.')
    } finally {
      setLoading(false)
    }
  }, [activeBusiness?.id])

  useEffect(() => {
    if (activeBusiness) {
      loadDashboard()
    }
  }, [activeBusiness?.id, loadDashboard])

  if (authLoading) {
    return <LoadingBlock label="Loading seller workspace…" />
  }

  const bizList = Array.isArray(sellerBusinesses) ? sellerBusinesses : []

  // ── 1. No Business exists for this seller ──
  if (bizList.length === 0) {
    return (
      <div className="seller-onboarding-empty-card">
        <div className="empty-icon-wrap">
          <BusinessIcon />
        </div>
        <h2>Welcome to BTMI Seller</h2>
        <p className="lead muted">
          Create your first business to start selling products, managing shops, inventory, and orders across DRC.
        </p>
        <div className="empty-actions">
          <Link to="/seller/onboarding">
            <Button size="lg">
              <PlusIcon /> Create Business
            </Button>
          </Link>
        </div>

        <div className="onboarding-steps-preview">
          <h3>How to get started:</h3>
          <div className="onboarding-step-grid">
            <div className="onboarding-step-item">
              <span className="step-num">1</span>
              <div>
                <strong>Create Business</strong>
                <p className="small muted">Register company name, category, and legal identity.</p>
              </div>
            </div>
            <div className="onboarding-step-item">
              <span className="step-num">2</span>
              <div>
                <strong>Create Shop</strong>
                <p className="small muted">Set up physical points of sale or fulfillment shops.</p>
              </div>
            </div>
            <div className="onboarding-step-item">
              <span className="step-num">3</span>
              <div>
                <strong>Add Products</strong>
                <p className="small muted">Define catalog items, variants, and prices in FC.</p>
              </div>
            </div>
            <div className="onboarding-step-item">
              <span className="step-num">4</span>
              <div>
                <strong>Add Stock</strong>
                <p className="small muted">Assign available inventory quantities to your shops.</p>
              </div>
            </div>
            <div className="onboarding-step-item">
              <span className="step-num">5</span>
              <div>
                <strong>Receive Orders</strong>
                <p className="small muted">Fulfill buyer orders with verified cash payments.</p>
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
        <h2>Select a Business</h2>
        <p className="lead muted">Choose a business to open its operational workspace:</p>
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
                <span className="small muted">{b.category || b.business_type || 'Registered Business'}</span>
              </div>
              <ArrowRightIcon />
            </button>
          ))}
        </div>
        <div style={{ marginTop: 24 }}>
          <Link to="/seller/onboarding">
            <Button variant="outline">
              <PlusIcon /> Add Another Business
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
          <h1>Dashboard</h1>
          <p className="muted">
            Overview and operational controls for <strong>{activeBusiness.name}</strong>
          </p>
        </div>
        <div className="header-actions">
          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={loadDashboard}
            disabled={loading}
            title="Refresh dashboard data"
          >
            <RefreshCwIcon /> Refresh
          </button>
          <Link to="/seller/products/new">
            <Button size="sm">
              <PlusIcon /> Add Product
            </Button>
          </Link>
        </div>
      </div>

      {error && <ErrorBox error={error} onRetry={loadDashboard} />}

      {loading && !data && <LoadingBlock label="Loading business metrics…" />}

      {/* ── Metrics Grid (Row 1) ── */}
      <div className="seller-metrics-grid">
        {/* Shops */}
        <div className="seller-stat-card">
          <div className="stat-header">
            <span className="stat-label">Shops</span>
            <span className="stat-icon stat-icon--shops">
              <StoreIcon />
            </span>
          </div>
          <div className="stat-value">{shopsCount}</div>
          <div className="stat-footer">
            <Link to="/seller/shops" className="stat-link">
              Manage shops <ArrowRightIcon />
            </Link>
          </div>
        </div>

        {/* Products */}
        <div className="seller-stat-card">
          <div className="stat-header">
            <span className="stat-label">Products</span>
            <span className="stat-icon stat-icon--products">
              <BoxIcon />
            </span>
          </div>
          <div className="stat-value">{productsCount}</div>
          <div className="stat-footer">
            <span className="muted small">{publishedProducts} published</span>
            <Link to="/seller/products" className="stat-link">
              View all <ArrowRightIcon />
            </Link>
          </div>
        </div>

        {/* Orders */}
        <div className="seller-stat-card">
          <div className="stat-header">
            <span className="stat-label">Orders</span>
            <span className="stat-icon stat-icon--orders">
              <OrdersIcon />
            </span>
          </div>
          <div className="stat-value">{ordersCount}</div>
          <div className="stat-footer">
            <span className="muted small">{totalRevenue.toLocaleString()} FC</span>
            <Link to="/seller/orders" className="stat-link">
              View orders <ArrowRightIcon />
            </Link>
          </div>
        </div>

        {/* Team / Employees */}
        <div className="seller-stat-card">
          <div className="stat-header">
            <span className="stat-label">Employees</span>
            <span className="stat-icon stat-icon--employees">
              <UsersIcon />
            </span>
          </div>
          <div className="stat-value">{employeesCount}</div>
          <div className="stat-footer">
            <Link to="/seller/employees" className="stat-link">
              Manage team <ArrowRightIcon />
            </Link>
          </div>
        </div>

        {/* Cash Sales */}
        <div className="seller-stat-card">
          <div className="stat-header">
            <span className="stat-label">Cash Sales</span>
            <span className="stat-icon stat-icon--cash">
              <CashIcon />
            </span>
          </div>
          <div className="stat-value">{cashTotal.toLocaleString()} <span className="currency-unit">FC</span></div>
          <div className="stat-footer">
            <Link to="/seller/cash" className="stat-link">
              Cash sessions <ArrowRightIcon />
            </Link>
          </div>
        </div>

        {/* Seller Growth & Trust */}
        <div className="seller-stat-card">
          <div className="stat-header">
            <span className="stat-label">Seller Level</span>
            <span className="stat-icon stat-icon--growth">
              <GrowthIcon />
            </span>
          </div>
          <div className="stat-value stat-value--tier">{sellerLevel}</div>
          <div className="stat-footer">
            <span className="trust-pill">
              <ShieldCheckIcon /> {trustStatus} ({sellerPoints} pts)
            </span>
            <Link to="/seller/growth" className="stat-link">
              Growth <ArrowRightIcon />
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
              <h3>Recent Orders</h3>
              <p className="small muted">Latest orders placed across your shops</p>
            </div>
            <Link to="/seller/orders" className="section-header-link">
              View all orders
            </Link>
          </div>

          {recentOrders.length === 0 ? (
            <div className="section-empty-block">
              <OrdersIcon />
              <p>No orders yet</p>
              <span className="small muted">Customer orders will appear here once purchases are made.</span>
            </div>
          ) : (
            <div className="seller-table-wrap">
              <table className="seller-data-table">
                <thead>
                  <tr>
                    <th>Order #</th>
                    <th>Status</th>
                    <th>Total</th>
                    <th>Date</th>
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
                          {order.status}
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
              <h3>Quick Actions</h3>
              <p className="small muted">Direct navigation to key operations</p>
            </div>
          </div>

          <div className="seller-quick-actions-grid">
            <Link to="/seller/products/new" className="quick-action-btn">
              <span className="qa-icon"><PlusIcon /></span>
              <div className="qa-copy">
                <strong>Add Product</strong>
                <span className="small muted">Create catalog item</span>
              </div>
            </Link>

            <Link to="/seller/stock" className="quick-action-btn">
              <span className="qa-icon"><BoxIcon /></span>
              <div className="qa-copy">
                <strong>Manage Stock</strong>
                <span className="small muted">Update shop inventory</span>
              </div>
            </Link>

            <Link to="/seller/orders" className="quick-action-btn">
              <span className="qa-icon"><OrdersIcon /></span>
              <div className="qa-copy">
                <strong>Process Orders</strong>
                <span className="small muted">Accept & fulfill</span>
              </div>
            </Link>

            <Link to="/seller/shops" className="quick-action-btn">
              <span className="qa-icon"><StoreIcon /></span>
              <div className="qa-copy">
                <strong>Manage Shops</strong>
                <span className="small muted">Locations & hours</span>
              </div>
            </Link>

            <Link to="/seller/employees" className="quick-action-btn">
              <span className="qa-icon"><UsersIcon /></span>
              <div className="qa-copy">
                <strong>Team & Staff</strong>
                <span className="small muted">Invite employees</span>
              </div>
            </Link>

            <Link to="/seller/cash" className="quick-action-btn">
              <span className="qa-icon"><CashIcon /></span>
              <div className="qa-copy">
                <strong>Cash Sessions</strong>
                <span className="small muted">POS & reconciliation</span>
              </div>
            </Link>
          </div>
        </div>
      </div>

      {/* ── Bottom Section: Store Setup Progress ── */}
      <div className="seller-section-card seller-setup-card">
        <div className="section-card-header">
          <div>
            <h3>Store Setup Checklist</h3>
            <p className="small muted">Essential steps to prepare your business for high marketplace sales</p>
          </div>
        </div>

        <div className="seller-checklist-grid">
          <div className="checklist-item checklist-item--done">
            <span className="check-icon"><CheckCircleIcon /></span>
            <div>
              <strong>Business Registered</strong>
              <p className="small muted">{activeBusiness.name}</p>
            </div>
          </div>

          <div className={`checklist-item ${shopsCount > 0 ? 'checklist-item--done' : 'checklist-item--pending'}`}>
            <span className="check-icon"><CheckCircleIcon /></span>
            <div>
              <strong>Create at least one Shop</strong>
              {shopsCount > 0 ? (
                <p className="small muted">{shopsCount} shop(s) active</p>
              ) : (
                <Link to="/seller/shops" className="small checklist-link">Create Shop &rarr;</Link>
              )}
            </div>
          </div>

          <div className={`checklist-item ${productsCount > 0 ? 'checklist-item--done' : 'checklist-item--pending'}`}>
            <span className="check-icon"><CheckCircleIcon /></span>
            <div>
              <strong>Add Products to Catalog</strong>
              {productsCount > 0 ? (
                <p className="small muted">{productsCount} product(s) in catalog</p>
              ) : (
                <Link to="/seller/products/new" className="small checklist-link">Add Product &rarr;</Link>
              )}
            </div>
          </div>

          <div className={`checklist-item ${publishedProducts > 0 ? 'checklist-item--done' : 'checklist-item--pending'}`}>
            <span className="check-icon"><CheckCircleIcon /></span>
            <div>
              <strong>Publish Products</strong>
              {publishedProducts > 0 ? (
                <p className="small muted">{publishedProducts} published on marketplace</p>
              ) : (
                <Link to="/seller/products" className="small checklist-link">Publish &rarr;</Link>
              )}
            </div>
          </div>

          <div className={`checklist-item ${ordersCount > 0 ? 'checklist-item--done' : 'checklist-item--pending'}`}>
            <span className="check-icon"><CheckCircleIcon /></span>
            <div>
              <strong>Receive First Order</strong>
              {ordersCount > 0 ? (
                <p className="small muted">{ordersCount} order(s) processed</p>
              ) : (
                <p className="small muted">Orders will appear here once buyers checkout</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}