import { useEffect, useState, useCallback } from 'react'
import {
  adminDirectionApi,
  type DirectionOverviewStats,
  type AdminUserListItem,
  type AdminAuditLog
} from '@/api/admin'

export default function DirectionDashboardPage() {
  const [activeTab, setActiveTab] = useState<'kpis' | 'users' | 'audit'>('kpis')
  const [stats, setStats] = useState<DirectionOverviewStats | null>(null)
  const [loadingStats, setLoadingStats] = useState(true)

  // Users Tab State
  const [users, setUsers] = useState<AdminUserListItem[]>([])
  const [totalUsers, setTotalUsers] = useState(0)
  const [userSearch, setUserSearch] = useState('')
  const [accountTypeFilter, setAccountTypeFilter] = useState('')
  const [userStatusFilter, setUserStatusFilter] = useState('')
  const [loadingUsers, setLoadingUsers] = useState(false)

  // User Action Modal State
  const [actionTargetUser, setActionTargetUser] = useState<AdminUserListItem | null>(null)
  const [actionType, setActionType] = useState<'suspend' | 'reactivate' | 'force_logout' | null>(null)
  const [actionReason, setActionReason] = useState('')
  const [actionSubmitting, setActionSubmitting] = useState(false)
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // Audit Tab State
  const [auditLogs, setAuditLogs] = useState<AdminAuditLog[]>([])
  const [totalLogs, setTotalLogs] = useState(0)
  const [auditTargetFilter, setAuditTargetFilter] = useState('')
  const [loadingAudit, setLoadingAudit] = useState(false)
  const [selectedAuditLog, setSelectedAuditLog] = useState<AdminAuditLog | null>(null)

  // Fetch KPI Stats
  const loadOverviewStats = useCallback(async () => {
    setLoadingStats(true)
    try {
      const data = await adminDirectionApi.getOverview()
      setStats(data)
    } catch (err) {
      console.error('Failed to load direction KPIs:', err)
    } finally {
      setLoadingStats(false)
    }
  }, [])

  // Fetch Users
  const loadUsers = useCallback(async () => {
    setLoadingUsers(true)
    try {
      const res = await adminDirectionApi.listUsers({
        search: userSearch || undefined,
        account_type: accountTypeFilter || undefined,
        status: userStatusFilter || undefined,
        limit: 30,
        offset: 0
      })
      setUsers(res.users)
      setTotalUsers(res.total)
    } catch (err) {
      console.error('Failed to list users:', err)
    } finally {
      setLoadingUsers(false)
    }
  }, [userSearch, accountTypeFilter, userStatusFilter])

  // Fetch Audit Logs
  const loadAuditLogs = useCallback(async () => {
    setLoadingAudit(true)
    try {
      const res = await adminDirectionApi.listAuditLogs({
        target_type: auditTargetFilter || undefined,
        limit: 40,
        offset: 0
      })
      setAuditLogs(res.logs)
      setTotalLogs(res.total)
    } catch (err) {
      console.error('Failed to list audit logs:', err)
    } finally {
      setLoadingAudit(false)
    }
  }, [auditTargetFilter])

  useEffect(() => {
    void loadOverviewStats()
  }, [loadOverviewStats])

  useEffect(() => {
    if (activeTab === 'users') {
      void loadUsers()
    } else if (activeTab === 'audit') {
      void loadAuditLogs()
    }
  }, [activeTab, loadUsers, loadAuditLogs])

  const handleExecuteUserAction = async () => {
    if (!actionTargetUser || !actionType) return
    if (!actionReason.trim() || actionReason.trim().length < 5) {
      setActionMessage({ type: 'error', text: 'A detailed reason of at least 5 characters is mandatory for auditing.' })
      return
    }

    setActionSubmitting(true)
    setActionMessage(null)
    try {
      if (actionType === 'suspend') {
        await adminDirectionApi.suspendUser(actionTargetUser.id, actionReason)
      } else if (actionType === 'reactivate') {
        await adminDirectionApi.reactivateUser(actionTargetUser.id, actionReason)
      } else if (actionType === 'force_logout') {
        await adminDirectionApi.forceLogoutUser(actionTargetUser.id, actionReason)
      }
      setActionMessage({ type: 'success', text: `Operation successfully executed. Audit record appended.` })
      setTimeout(() => {
        setActionTargetUser(null)
        setActionType(null)
        setActionReason('')
        setActionMessage(null)
        void loadUsers()
        void loadOverviewStats()
      }, 1200)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Action failed'
      setActionMessage({ type: 'error', text: msg })
    } finally {
      setActionSubmitting(false)
    }
  }

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'XAF', maximumFractionDigits: 0 }).format(val)
  }

  return (
    <div>
      {/* View Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, margin: '0 0 6px', display: 'flex', alignItems: 'center', gap: 10 }}>
            <span>🧭</span> Dashboard 1 — Direction / Supervision
          </h1>
          <p style={{ color: '#94a3b8', fontSize: 13, margin: 0 }}>
            Executive governance, strategic KPIs, cross-account supervision, and immutable audit inspection.
          </p>
        </div>

        <button
          onClick={() => {
            void loadOverviewStats()
            if (activeTab === 'users') void loadUsers()
            if (activeTab === 'audit') void loadAuditLogs()
          }}
          style={{
            backgroundColor: '#1e293b',
            color: '#94a3b8',
            border: '1px solid #334155',
            borderRadius: 8,
            padding: '8px 14px',
            fontSize: 13,
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 6
          }}
        >
          <span>🔄</span> Refresh State
        </button>
      </div>

      {/* Sub-tabs */}
      <div style={{ display: 'flex', gap: 8, borderBottom: '1px solid #1e293b', paddingBottom: 12, marginBottom: 24 }}>
        <button
          onClick={() => setActiveTab('kpis')}
          style={{
            padding: '8px 16px',
            borderRadius: 8,
            fontSize: 13,
            fontWeight: 700,
            cursor: 'pointer',
            border: 'none',
            backgroundColor: activeTab === 'kpis' ? '#2563eb' : '#1e293b',
            color: activeTab === 'kpis' ? '#ffffff' : '#94a3b8'
          }}
        >
          📊 Strategic KPIs & Overview
        </button>
        <button
          onClick={() => setActiveTab('users')}
          style={{
            padding: '8px 16px',
            borderRadius: 8,
            fontSize: 13,
            fontWeight: 700,
            cursor: 'pointer',
            border: 'none',
            backgroundColor: activeTab === 'users' ? '#2563eb' : '#1e293b',
            color: activeTab === 'users' ? '#ffffff' : '#94a3b8'
          }}
        >
          👥 User Management ({totalUsers > 0 ? totalUsers : stats?.total_users || 0})
        </button>
        <button
          onClick={() => setActiveTab('audit')}
          style={{
            padding: '8px 16px',
            borderRadius: 8,
            fontSize: 13,
            fontWeight: 700,
            cursor: 'pointer',
            border: 'none',
            backgroundColor: activeTab === 'audit' ? '#2563eb' : '#1e293b',
            color: activeTab === 'audit' ? '#ffffff' : '#94a3b8'
          }}
        >
          📜 Global Audit Ledger ({totalLogs})
        </button>
      </div>

      {/* TAB 1: STRATEGIC KPIS */}
      {activeTab === 'kpis' && (
        <div>
          {loadingStats ? (
            <div style={{ padding: 48, textAlign: 'center', color: '#64748b' }}>
              <div className="spinner" style={{ width: 32, height: 32, margin: '0 auto 12px' }} />
              Querying live database aggregations...
            </div>
          ) : stats ? (
            <div>
              {/* Top Banner with Health */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 20 }}>
                <div style={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: 12, padding: '18px 20px' }}>
                  <div style={{ fontSize: 12, color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', marginBottom: 4 }}>Platform Health</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: '#10b981' }} />
                    <span style={{ fontSize: 20, fontWeight: 800, color: '#10b981' }}>{stats.platform_health}</span>
                  </div>
                  <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>PostgreSQL • Redis • API online</div>
                </div>

                <div style={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: 12, padding: '18px 20px' }}>
                  <div style={{ fontSize: 12, color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', marginBottom: 4 }}>Confirmed Cash Volume</div>
                  <div style={{ fontSize: 20, fontWeight: 800, color: '#f59e0b' }}>{formatCurrency(stats.confirmed_cash)}</div>
                  <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>Double-confirmed transactions</div>
                </div>

                <div style={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: 12, padding: '18px 20px' }}>
                  <div style={{ fontSize: 12, color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', marginBottom: 4 }}>Orders Today</div>
                  <div style={{ fontSize: 24, fontWeight: 800, color: '#38bdf8' }}>{stats.orders_today}</div>
                  <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>Lifetime Orders: {stats.total_orders}</div>
                </div>

                <div style={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: 12, padding: '18px 20px' }}>
                  <div style={{ fontSize: 12, color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', marginBottom: 4 }}>Open Disputes / Claims</div>
                  <div style={{ fontSize: 24, fontWeight: 800, color: stats.open_disputes > 0 ? '#ef4444' : '#10b981' }}>
                    {stats.open_disputes}
                  </div>
                  <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>Requiring mediation</div>
                </div>
              </div>

              {/* Multi-Domain Metric Cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
                {/* Users & Accounts */}
                <div style={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: 12, padding: 20 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #1e293b', paddingBottom: 10, marginBottom: 14 }}>
                    <h3 style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>👥 Accounts Breakdown</h3>
                    <span style={{ fontSize: 18, fontWeight: 800, color: '#f8fafc' }}>{stats.total_users} Total</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 13 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#94a3b8' }}>Buyers:</span>
                      <span style={{ fontWeight: 700 }}>{stats.total_buyers}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#94a3b8' }}>Sellers (Owners):</span>
                      <span style={{ fontWeight: 700 }}>{stats.total_sellers}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#94a3b8' }}>Shop Employees:</span>
                      <span style={{ fontWeight: 700 }}>{stats.total_employees}</span>
                    </div>
                  </div>
                </div>

                {/* Businesses & Shops */}
                <div style={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: 12, padding: 20 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #1e293b', paddingBottom: 10, marginBottom: 14 }}>
                    <h3 style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>🏪 Merchants & Outlets</h3>
                    <span style={{ fontSize: 18, fontWeight: 800, color: '#f8fafc' }}>{stats.total_businesses} Businesses</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 13 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#94a3b8' }}>Total Registered Shops:</span>
                      <span style={{ fontWeight: 700 }}>{stats.total_shops}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#94a3b8' }}>Currently Active Shops:</span>
                      <span style={{ fontWeight: 700, color: '#10b981' }}>{stats.active_shops}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#94a3b8' }}>Inactive / Suspended Shops:</span>
                      <span style={{ fontWeight: 700, color: '#ef4444' }}>{stats.total_shops - stats.active_shops}</span>
                    </div>
                  </div>
                </div>

                {/* Catalog & Inventory */}
                <div style={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: 12, padding: 20 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #1e293b', paddingBottom: 10, marginBottom: 14 }}>
                    <h3 style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>📦 Catalog & Stock</h3>
                    <span style={{ fontSize: 18, fontWeight: 800, color: '#f8fafc' }}>{stats.total_products} Products</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 13 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#94a3b8' }}>Live Published Products:</span>
                      <span style={{ fontWeight: 700, color: '#3b82f6' }}>{stats.published_products}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#94a3b8' }}>Draft / Archived:</span>
                      <span style={{ fontWeight: 700 }}>{stats.total_products - stats.published_products}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#94a3b8' }}>Out of Stock Anomalies:</span>
                      <span style={{ fontWeight: 700, color: stats.out_of_stock_products > 0 ? '#f59e0b' : '#10b981' }}>{stats.out_of_stock_products}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      )}

      {/* TAB 2: USER MANAGEMENT */}
      {activeTab === 'users' && (
        <div>
          {/* Filter Bar */}
          <div style={{ display: 'flex', gap: 12, marginBottom: 16, backgroundColor: '#0f172a', padding: 14, borderRadius: 10, border: '1px solid #1e293b' }}>
            <input
              type="text"
              placeholder="Search by name, email, or phone..."
              value={userSearch}
              onChange={(e) => setUserSearch(e.target.value)}
              style={{
                flex: 1,
                padding: '9px 14px',
                borderRadius: 8,
                backgroundColor: '#1e293b',
                border: '1px solid #334155',
                color: '#ffffff',
                fontSize: 13
              }}
            />
            <select
              value={accountTypeFilter}
              onChange={(e) => setAccountTypeFilter(e.target.value)}
              style={{
                padding: '9px 14px',
                borderRadius: 8,
                backgroundColor: '#1e293b',
                border: '1px solid #334155',
                color: '#ffffff',
                fontSize: 13
              }}
            >
              <option value="">All Account Types</option>
              <option value="BUYER">Buyer</option>
              <option value="SELLER">Seller</option>
              <option value="EMPLOYEE">Employee</option>
            </select>
            <select
              value={userStatusFilter}
              onChange={(e) => setUserStatusFilter(e.target.value)}
              style={{
                padding: '9px 14px',
                borderRadius: 8,
                backgroundColor: '#1e293b',
                border: '1px solid #334155',
                color: '#ffffff',
                fontSize: 13
              }}
            >
              <option value="">All Statuses</option>
              <option value="ACTIVE">Active</option>
              <option value="SUSPENDED">Suspended</option>
              <option value="PENDING_VERIFICATION">Pending Verification</option>
            </select>
            <button
              onClick={() => void loadUsers()}
              style={{
                backgroundColor: '#2563eb',
                color: '#ffffff',
                border: 'none',
                borderRadius: 8,
                padding: '9px 16px',
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              Filter
            </button>
          </div>

          {/* User Table */}
          <div style={{ backgroundColor: '#0f172a', borderRadius: 12, border: '1px solid #1e293b', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13 }}>
              <thead>
                <tr style={{ backgroundColor: '#1e293b', color: '#94a3b8', borderBottom: '1px solid #334155' }}>
                  <th style={{ padding: '12px 16px' }}>User</th>
                  <th style={{ padding: '12px 16px' }}>Contact</th>
                  <th style={{ padding: '12px 16px' }}>Type</th>
                  <th style={{ padding: '12px 16px' }}>Status</th>
                  <th style={{ padding: '12px 16px' }}>Biz / Shops</th>
                  <th style={{ padding: '12px 16px' }}>Orders</th>
                  <th style={{ padding: '12px 16px' }}>Points</th>
                  <th style={{ padding: '12px 16px', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loadingUsers ? (
                  <tr>
                    <td colSpan={8} style={{ padding: 36, textAlign: 'center', color: '#64748b' }}>
                      Loading users...
                    </td>
                  </tr>
                ) : users.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ padding: 36, textAlign: 'center', color: '#64748b' }}>
                      No users found matching query.
                    </td>
                  </tr>
                ) : (
                  users.map((u) => (
                    <tr key={u.id} style={{ borderBottom: '1px solid #1e293b' }}>
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ fontWeight: 700, color: '#ffffff' }}>
                          {u.first_name} {u.last_name}
                        </div>
                        <div style={{ fontSize: 11, color: '#64748b' }}>ID: {u.id.substring(0, 8)}...</div>
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <div>{u.email}</div>
                        <div style={{ fontSize: 11, color: '#94a3b8' }}>{u.phone}</div>
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{
                          fontSize: 11,
                          fontWeight: 700,
                          padding: '3px 8px',
                          borderRadius: 6,
                          backgroundColor: u.account_type === 'SELLER' ? '#1e3a8a' : u.account_type === 'EMPLOYEE' ? '#3730a3' : '#064e3b',
                          color: '#ffffff'
                        }}>
                          {u.account_type}
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{
                          fontSize: 11,
                          fontWeight: 700,
                          padding: '3px 8px',
                          borderRadius: 6,
                          backgroundColor: u.status === 'ACTIVE' ? '#064e3b' : u.status === 'SUSPENDED' ? '#7f1d1d' : '#78350f',
                          color: '#ffffff'
                        }}>
                          {u.status}
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        {u.business_count} biz / {u.shop_count} shops
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        {u.order_count}
                      </td>
                      <td style={{ padding: '12px 16px', fontWeight: 700, color: '#f59e0b' }}>
                        {u.total_points}
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                          {u.status === 'ACTIVE' ? (
                            <button
                              onClick={() => {
                                setActionTargetUser(u)
                                setActionType('suspend')
                                setActionReason('')
                              }}
                              style={{
                                backgroundColor: '#7f1d1d',
                                color: '#fecaca',
                                border: 'none',
                                borderRadius: 6,
                                padding: '5px 10px',
                                fontSize: 11,
                                fontWeight: 700,
                                cursor: 'pointer'
                              }}
                            >
                              Suspend
                            </button>
                          ) : (
                            <button
                              onClick={() => {
                                setActionTargetUser(u)
                                setActionType('reactivate')
                                setActionReason('')
                              }}
                              style={{
                                backgroundColor: '#064e3b',
                                color: '#a7f3d0',
                                border: 'none',
                                borderRadius: 6,
                                padding: '5px 10px',
                                fontSize: 11,
                                fontWeight: 700,
                                cursor: 'pointer'
                              }}
                            >
                              Reactivate
                            </button>
                          )}
                          <button
                            onClick={() => {
                              setActionTargetUser(u)
                              setActionType('force_logout')
                              setActionReason('')
                            }}
                            style={{
                              backgroundColor: '#1e293b',
                              color: '#cbd5e1',
                              border: '1px solid #334155',
                              borderRadius: 6,
                              padding: '5px 10px',
                              fontSize: 11,
                              fontWeight: 600,
                              cursor: 'pointer'
                            }}
                            title="Revoke all active tokens"
                          >
                            Logout
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: AUDIT LEDGER */}
      {activeTab === 'audit' && (
        <div>
          {/* Audit Filter */}
          <div style={{ display: 'flex', gap: 12, marginBottom: 16, backgroundColor: '#0f172a', padding: 14, borderRadius: 10, border: '1px solid #1e293b' }}>
            <select
              value={auditTargetFilter}
              onChange={(e) => setAuditTargetFilter(e.target.value)}
              style={{
                padding: '9px 14px',
                borderRadius: 8,
                backgroundColor: '#1e293b',
                border: '1px solid #334155',
                color: '#ffffff',
                fontSize: 13
              }}
            >
              <option value="">All Target Entities</option>
              <option value="USER">User Actions</option>
              <option value="ADMIN_USER">Admin Auth Events</option>
              <option value="BUSINESS">Business Lifecycle</option>
              <option value="SHOP">Shop Lifecycle</option>
              <option value="PRODUCT">Product Modifications</option>
              <option value="ORDER">Order Overrides</option>
              <option value="POINT_ACCOUNT">Points Adjustments</option>
            </select>
            <button
              onClick={() => void loadAuditLogs()}
              style={{
                backgroundColor: '#2563eb',
                color: '#ffffff',
                border: 'none',
                borderRadius: 8,
                padding: '9px 16px',
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              Filter Audit Log
            </button>
          </div>

          <div style={{ backgroundColor: '#0f172a', borderRadius: 12, border: '1px solid #1e293b', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13 }}>
              <thead>
                <tr style={{ backgroundColor: '#1e293b', color: '#94a3b8', borderBottom: '1px solid #334155' }}>
                  <th style={{ padding: '12px 16px' }}>Timestamp</th>
                  <th style={{ padding: '12px 16px' }}>Administrator</th>
                  <th style={{ padding: '12px 16px' }}>Action</th>
                  <th style={{ padding: '12px 16px' }}>Target</th>
                  <th style={{ padding: '12px 16px' }}>Mandatory Justification</th>
                  <th style={{ padding: '12px 16px', textAlign: 'right' }}>Inspection</th>
                </tr>
              </thead>
              <tbody>
                {loadingAudit ? (
                  <tr>
                    <td colSpan={6} style={{ padding: 36, textAlign: 'center', color: '#64748b' }}>
                      Loading immutable audit ledger...
                    </td>
                  </tr>
                ) : auditLogs.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ padding: 36, textAlign: 'center', color: '#64748b' }}>
                      No audit events recorded for current filter.
                    </td>
                  </tr>
                ) : (
                  auditLogs.map((l) => (
                    <tr key={l.id} style={{ borderBottom: '1px solid #1e293b' }}>
                      <td style={{ padding: '12px 16px', fontSize: 12, color: '#94a3b8' }}>
                        {new Date(l.created_at).toLocaleString()}
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ fontWeight: 700, color: '#ffffff' }}>{l.actor_admin_name || l.actor_admin_email || 'Admin'}</div>
                        <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, backgroundColor: '#334155', color: '#cbd5e1' }}>
                          {l.actor_role}
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{
                          fontSize: 11,
                          fontWeight: 700,
                          padding: '3px 8px',
                          borderRadius: 6,
                          backgroundColor: l.action.includes('SUSPEND') ? '#7f1d1d' : l.action.includes('REACTIVATE') ? '#064e3b' : '#1e293b',
                          color: '#ffffff'
                        }}>
                          {l.action}
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <div>{l.target_type}</div>
                        <div style={{ fontSize: 11, color: '#64748b' }}>{l.target_id.substring(0, 10)}...</div>
                      </td>
                      <td style={{ padding: '12px 16px', color: '#cbd5e1', maxWidth: 300 }}>
                        {l.reason}
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                        {(l.old_value || l.new_value) && (
                          <button
                            onClick={() => setSelectedAuditLog(l)}
                            style={{
                              backgroundColor: '#1e293b',
                              color: '#60a5fa',
                              border: '1px solid #3b82f6',
                              borderRadius: 6,
                              padding: '4px 10px',
                              fontSize: 11,
                              fontWeight: 600,
                              cursor: 'pointer'
                            }}
                          >
                            View Diff
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* USER ACTION MODAL (SUSPEND / REACTIVATE / LOGOUT) */}
      {actionTargetUser && actionType && (
        <div style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.75)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: 20
        }}>
          <div style={{
            maxWidth: 500,
            width: '100%',
            backgroundColor: '#0f172a',
            borderRadius: 16,
            border: '1px solid #334155',
            padding: 28,
            boxShadow: '0 25px 50px rgba(0, 0, 0, 0.6)'
          }}>
            <h3 style={{ fontSize: 18, fontWeight: 800, margin: '0 0 8px', color: actionType === 'suspend' ? '#ef4444' : '#60a5fa' }}>
              Confirm Administrative Action: {actionType.toUpperCase().replace('_', ' ')}
            </h3>
            <p style={{ fontSize: 13, color: '#94a3b8', margin: '0 0 20px', lineHeight: 1.5 }}>
              Target user: <strong>{actionTargetUser.first_name} {actionTargetUser.last_name}</strong> ({actionTargetUser.email}).
              This action mutates live state in PostgreSQL and immediately records an immutable audit log.
            </p>

            {actionMessage && (
              <div style={{
                padding: '10px 14px',
                borderRadius: 8,
                marginBottom: 16,
                fontSize: 13,
                backgroundColor: actionMessage.type === 'error' ? '#450a0a' : '#064e3b',
                color: actionMessage.type === 'error' ? '#fca5a5' : '#a7f3d0'
              }}>
                {actionMessage.text}
              </div>
            )}

            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#cbd5e1', marginBottom: 6 }}>
                Mandatory Justification Reason:
              </label>
              <textarea
                value={actionReason}
                onChange={(e) => setActionReason(e.target.value)}
                placeholder="Specify regulatory, policy, or operational justification for this action..."
                rows={4}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: 8,
                  backgroundColor: '#1e293b',
                  border: '1px solid #334155',
                  color: '#ffffff',
                  fontSize: 13,
                  boxSizing: 'border-box',
                  resize: 'vertical'
                }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button
                onClick={() => {
                  setActionTargetUser(null)
                  setActionType(null)
                  setActionReason('')
                  setActionMessage(null)
                }}
                disabled={actionSubmitting}
                style={{
                  backgroundColor: '#1e293b',
                  color: '#cbd5e1',
                  border: '1px solid #334155',
                  borderRadius: 8,
                  padding: '10px 16px',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleExecuteUserAction}
                disabled={actionSubmitting}
                style={{
                  backgroundColor: actionType === 'suspend' ? '#dc2626' : '#2563eb',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: 8,
                  padding: '10px 20px',
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: actionSubmitting ? 'not-allowed' : 'pointer',
                  opacity: actionSubmitting ? 0.7 : 1
                }}
              >
                {actionSubmitting ? 'Executing...' : 'Confirm & Commit Audit'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* AUDIT DIFF MODAL */}
      {selectedAuditLog && (
        <div style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.75)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: 20
        }}>
          <div style={{
            maxWidth: 640,
            width: '100%',
            backgroundColor: '#0f172a',
            borderRadius: 16,
            border: '1px solid #334155',
            padding: 28,
            boxShadow: '0 25px 50px rgba(0, 0, 0, 0.6)'
          }}>
            <h3 style={{ fontSize: 18, fontWeight: 800, margin: '0 0 6px', color: '#ffffff' }}>
              Audit Mutation Diff: {selectedAuditLog.action}
            </h3>
            <p style={{ fontSize: 12, color: '#64748b', margin: '0 0 18px' }}>
              Event ID: {selectedAuditLog.id} • Target: {selectedAuditLog.target_type} ({selectedAuditLog.target_id})
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 20 }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#ef4444', marginBottom: 6 }}>Previous State (old_value):</div>
                <pre style={{ backgroundColor: '#1e293b', padding: 12, borderRadius: 8, fontSize: 11, color: '#cbd5e1', overflow: 'auto', maxHeight: 200 }}>
                  {JSON.stringify(selectedAuditLog.old_value, null, 2) || 'null'}
                </pre>
              </div>
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#10b981', marginBottom: 6 }}>New State (new_value):</div>
                <pre style={{ backgroundColor: '#1e293b', padding: 12, borderRadius: 8, fontSize: 11, color: '#cbd5e1', overflow: 'auto', maxHeight: 200 }}>
                  {JSON.stringify(selectedAuditLog.new_value, null, 2) || 'null'}
                </pre>
              </div>
            </div>

            <div style={{ textAlign: 'right' }}>
              <button
                onClick={() => setSelectedAuditLog(null)}
                style={{
                  backgroundColor: '#2563eb',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: 8,
                  padding: '9px 18px',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                Close Diff Inspector
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
