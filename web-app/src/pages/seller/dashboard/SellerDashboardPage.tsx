import { useEffect, useState } from 'react'
import { useAuth } from '@/store/auth'
import { growthApi } from '@/api/seller'
import { orderApi } from '@/api/seller'
import { productApi } from '@/api/seller'
import { inventoryApi } from '@/api/seller'
import { customerApi } from '@/api/seller'
import { cashApi } from '@/api/seller'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Link } from 'react-router-dom'
import { ErrorBox, LoadingBlock } from '@/components/ui/Feedback'

interface DashboardStats {
  totalRevenue: number
  totalOrders: number
  totalProducts: number
  lowStockCount: number
  totalCustomers: number
  cashToday: number
  sellerPoints: number
  sellerLevel: string
  sellerTrust: string
  publishedProducts: number
  hasStock: number
}

export default function SellerDashboardPage() {
  const { activeBusiness, activeShop, loading: authLoading } = useAuth()
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [recentOrders, setRecentOrders] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!activeBusiness) {
      setLoading(false)
      return
    }
    loadDashboard()
  }, [activeBusiness])

  async function loadDashboard() {
    if (!activeBusiness) return
    setLoading(true)
    setError('')
    try {
      const [
        growthData,
        ordersData,
        productsData,
        inventoryData,
        customersData,
        cashData,
      ] = await Promise.allSettled([
        growthApi.getLevel(activeBusiness.id),
        orderApi.listByBusiness(activeBusiness.id, { limit: 5 }),
        productApi.listByBusiness(activeBusiness.id),
        inventoryApi.getShopInventory(activeShop || '', { limit: 100 }),
        customerApi.listByBusiness(activeBusiness.id),
        cashApi.getBusinessCashSummary(activeBusiness.id),
      ])

      let revenue = 0
      let orders = 0
      let products = 0
      let publishedProducts = 0
      let hasStock = 0
      let lowStock = 0
      let customers = 0
      let cashToday = 0
      let sellerPoints = 0
      let sellerLevel = 'STARTER'
      let sellerTrust = 'NORMAL'

      if (growthData.status === 'fulfilled') {
        sellerPoints = growthData.value.points?.current_points || 0
        sellerLevel = growthData.value.level?.name || 'STARTER'
        sellerTrust = growthData.value.trust?.trust_status || 'NORMAL'
      }

      if (ordersData.status === 'fulfilled') {
        orders = ordersData.value.length
        revenue = ordersData.value.reduce((sum, o) => sum + (o.final_total || 0), 0)
      }

      if (productsData.status === 'fulfilled') {
        products = productsData.value.length
        publishedProducts = productsData.value.filter((p) => p.publication_status === 'PUBLISHED').length
      }

      if (inventoryData.status === 'fulfilled') {
        hasStock = inventoryData.value.filter((i) => i.available > 0).length
        lowStock = inventoryData.value.filter((i) => i.available <= 5 && i.available > 0).length
      }

      if (customersData.status === 'fulfilled') {
        customers = customersData.value.length
      }

      if (cashData.status === 'fulfilled') {
        cashToday = cashData.value.total_cash_sales || 0
      }

      setStats({
        totalRevenue: revenue,
        totalOrders: orders,
        totalProducts: products,
        lowStockCount: lowStock,
        totalCustomers: customers,
        cashToday,
        sellerPoints,
        sellerLevel,
        sellerTrust,
        publishedProducts,
        hasStock,
      })

      if (ordersData.status === 'fulfilled') {
        setRecentOrders(ordersData.value)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load dashboard')
    } finally {
      setLoading(false)
    }
  }

  if (authLoading) return <LoadingBlock label="Loading dashboard…" />
  if (!activeBusiness) {
    return (
      <div className="empty-state" style={{ padding: '64px 0', textAlign: 'center' }}>
        <div className="empty-icon" style={{ fontSize: 64 }}>🏢</div>
        <h2>No Business Selected</h2>
        <p className="muted">Create or select a business to access your seller dashboard.</p>
        <Link to="/seller/onboarding">
          <Button size="lg">Create Business</Button>
        </Link>
      </div>
    )
  }

  if (loading) return <LoadingBlock label="Loading dashboard data…" />
  if (error) return <ErrorBox error={error} />

  const statCards = [
    { label: 'Revenue (FC)', value: stats?.totalRevenue.toLocaleString() || '0', icon: '💰', color: 'success' },
    { label: 'Orders', value: String(stats?.totalOrders || 0), icon: '🧾', color: 'primary' },
    { label: 'Products', value: String(stats?.totalProducts || 0), icon: '📦', color: 'info' },
    { label: 'Low Stock', value: String(stats?.lowStockCount || 0), icon: '⚠️', color: stats && stats.lowStockCount > 0 ? 'danger' : 'success' },
    { label: 'Customers', value: String(stats?.totalCustomers || 0), icon: '👤', color: 'purple' },
    { label: 'Cash Today (FC)', value: stats?.cashToday.toLocaleString() || '0', icon: '💵', color: 'warning' },
    { label: 'Seller Points', value: String(stats?.sellerPoints || 0), icon: '⭐', color: 'gold' },
    { label: 'Trust Level', value: stats?.sellerTrust || 'NORMAL', icon: '🛡️', color: stats?.sellerTrust === 'HIGH' ? 'success' : stats?.sellerTrust === 'LOW' || stats?.sellerTrust === 'SUSPENDED' ? 'danger' : 'primary' },
  ]

  return (
    <div className="seller-dashboard">
      <div className="dashboard-header">
        <div>
          <h1>Dashboard</h1>
          <p className="muted">Welcome back, {activeBusiness?.name}</p>
        </div>
        <Link to="/seller/onboarding">
          <Button variant="ghost">⚙️ Onboarding</Button>
        </Link>
      </div>

      <div className="stat-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 24 }}>
        {statCards.map((stat) => (
          <Card key={stat.label} className="stat-card">
            <div className="stat-icon" style={{ backgroundColor: `var(--${stat.color}-bg)`, color: `var(--${stat.color})` }}>
              {stat.icon}
            </div>
            <div className="stat-value" style={{ fontSize: 28, fontWeight: 700 }}>{stat.value}</div>
            <div className="stat-label muted small">{stat.label}</div>
          </Card>
        ))}
      </div>

      <div className="dashboard-sections" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: 24 }}>
        <Card>
          <div className="card-header">
            <h3>Quick Actions</h3>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
            <Link to="/seller/products/new">
              <Button variant="outline" block>➕ Add Product</Button>
            </Link>
            <Link to="/seller/orders">
              <Button variant="outline" block>📋 View Orders</Button>
            </Link>
            <Link to="/seller/stock">
              <Button variant="outline" block>📦 Manage Stock</Button>
            </Link>
            <Link to="/seller/cash">
              <Button variant="outline" block>💵 Cash Session</Button>
            </Link>
            <Link to="/seller/employees">
              <Button variant="outline" block>👥 Employees</Button>
            </Link>
            <Link to="/seller/shops">
              <Button variant="outline" block>🏪 Shops</Button>
            </Link>
          </div>
        </Card>

        <Card>
          <div className="card-header">
            <div>
              <h3>Recent Orders</h3>
            </div>
            <Link to="/seller/orders" className="section-link small">View all</Link>
          </div>
          {recentOrders.length === 0 ? (
            <p className="muted small" style={{ padding: 16, textAlign: 'center' }}>No orders yet</p>
          ) : (
            <div className="table-responsive">
              <table className="data-table">
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
                      <td>{order.order_number || order.id.slice(0, 8)}</td>
                      <td><span className={`badge badge-${getStatusColor(order.status)}`}>{order.status}</span></td>
                      <td>{order.final_total?.toLocaleString() || '0'} FC</td>
                      <td>{new Date(order.created_at).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>

      <Card className="getting-started" style={{ marginTop: 24 }}>
        <h3>Getting Started</h3>
        <ul className="checklist">
          <li><strong>{activeBusiness ? '✓' : '○'} Business created</strong></li>
          <li><strong>{stats && stats.totalProducts > 0 ? '✓' : '○'} Create your first product</strong> {!stats?.totalProducts && <Link to="/seller/products/new" className="small">Add product</Link>}</li>
          <li><strong>{stats && stats.hasStock > 0 ? '✓' : '○'} Add initial stock</strong> {stats && stats.totalProducts > 0 && !stats.hasStock && <Link to="/seller/stock" className="small">Manage stock</Link>}</li>
          <li><strong>{stats && stats.publishedProducts > 0 ? '✓' : '○'} Publish a product</strong> {stats && stats.hasStock > 0 && !stats.publishedProducts && <Link to="/seller/products" className="small">Publish</Link>}</li>
          <li><strong>{stats && stats.totalOrders > 0 ? '✓' : '○'} Receive your first order</strong></li>
        </ul>
      </Card>
    </div>
  )
}

function getStatusColor(status: string): string {
  switch (status) {
    case 'COMPLETED': return 'success'
    case 'PENDING': return 'warning'
    case 'ACCEPTED':
    case 'PREPARING':
    case 'READY': return 'info'
    case 'OUT_FOR_DELIVERY':
    case 'DELIVERED': return 'primary'
    case 'CANCELLED':
    case 'REJECTED': return 'danger'
    default: return 'muted'
  }
}