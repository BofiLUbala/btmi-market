import { useEffect, useState, useCallback } from 'react'
import {
  adminDirectionApi,
  type DirectionOverviewStats,
  type AdminUserListItem,
  type AdminAuditLog
} from '@/api/admin'
import { useT } from '@/store/i18n'

export default function DirectionDashboardPage() {
  const t = useT()
  const [activeTab, setActiveTab] = useState<'kpis' | 'users' | 'audit'>('kpis')
  const [stats, setStats] = useState<DirectionOverviewStats | null>(null)
  const [loadingStats, setLoadingStats] = useState(true)
  const [statsError, setStatsError] = useState<string | null>(null)

  // Users Tab State
  const [users, setUsers] = useState<AdminUserListItem[]>([])
  const [totalUsers, setTotalUsers] = useState(0)
  const [userSearch, setUserSearch] = useState('')
  const [accountTypeFilter, setAccountTypeFilter] = useState('')
  const [userStatusFilter, setUserStatusFilter] = useState('')
  const [loadingUsers, setLoadingUsers] = useState(false)
  const [usersError, setUsersError] = useState<string | null>(null)

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
  const [auditError, setAuditError] = useState<string | null>(null)
  const [selectedAuditLog, setSelectedAuditLog] = useState<AdminAuditLog | null>(null)

  // Fetch KPI Stats
  const loadOverviewStats = useCallback(async () => {
    setLoadingStats(true)
    setStatsError(null)
    try {
      const data = await adminDirectionApi.getOverview()
      setStats(data)
    } catch (err) {
      console.error('Failed to load direction KPIs:', err)
      setStatsError(err instanceof Error ? err.message : t('admin.direction.kpisLoadError'))
    } finally {
      setLoadingStats(false)
    }
  }, [t])

  // Fetch Users
  const loadUsers = useCallback(async () => {
    setLoadingUsers(true)
    setUsersError(null)
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
      setUsersError(err instanceof Error ? err.message : t('admin.direction.usersLoadError'))
    } finally {
      setLoadingUsers(false)
    }
  }, [userSearch, accountTypeFilter, userStatusFilter, t])

  // Fetch Audit Logs
  const loadAuditLogs = useCallback(async () => {
    setLoadingAudit(true)
    setAuditError(null)
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
      setAuditError(err instanceof Error ? err.message : t('admin.direction.auditLoadError'))
    } finally {
      setLoadingAudit(false)
    }
  }, [auditTargetFilter, t])

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
      setActionMessage({ type: 'error', text: t('admin.direction.reasonRequired') })
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
      setActionMessage({ type: 'success', text: t('admin.direction.actionExecutedSuccess') })
      setTimeout(() => {
        setActionTargetUser(null)
        setActionType(null)
        setActionReason('')
        setActionMessage(null)
        void loadUsers()
        void loadOverviewStats()
      }, 1200)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : t('admin.direction.actionFailed')
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
            <span>🧭</span> {t('admin.direction.pageTitle')}
          </h1>
          <p style={{ color: '#94a3b8', fontSize: 13, margin: 0 }}>
            {t('admin.direction.pageSubtitle')}
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
          <span>🔄</span> {t('admin.direction.refreshState')}
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
          📊 {t('admin.direction.tabKpis')}
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
          👥 {t('admin.direction.tabUserManagement', { count: totalUsers > 0 ? totalUsers : stats?.total_users || 0 })}
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
          📜 {t('admin.direction.tabAuditLedger', { count: totalLogs })}
        </button>
      </div>

      {/* TAB 1: STRATEGIC KPIS */}
      {activeTab === 'kpis' && (
        <div>
          {statsError && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, backgroundColor: 'var(--admin-danger-soft)', border: '1px solid var(--admin-danger)', borderRadius: 10, padding: '12px 16px', marginBottom: 16, color: 'var(--admin-text)' }}>
              <span>⚠️ {t('admin.direction.kpisLoadErrorPrefix')} {statsError}</span>
              <button
                onClick={() => void loadOverviewStats()}
                style={{ backgroundColor: 'var(--admin-surface-2)', color: 'var(--admin-text)', border: '1px solid var(--admin-border)', borderRadius: 8, padding: '6px 12px', fontSize: 13, fontWeight: 700, cursor: 'pointer', flexShrink: 0 }}
              >
                {t('admin.direction.retry')}
              </button>
            </div>
          )}
          {loadingStats ? (
            <div style={{ padding: 48, textAlign: 'center', color: '#64748b' }}>
              <div className="spinner" style={{ width: 32, height: 32, margin: '0 auto 12px' }} />
              {t('admin.direction.queryingAggregations')}
            </div>
          ) : stats ? (
            <div>
              {/* Top Banner with Health */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 20 }}>
                <div style={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: 12, padding: '18px 20px' }}>
                  <div style={{ fontSize: 12, color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', marginBottom: 4 }}>{t('admin.direction.platformHealth')}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: '#10b981' }} />
                    <span style={{ fontSize: 20, fontWeight: 800, color: '#10b981' }}>{stats.platform_health}</span>
                  </div>
                  <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>{t('admin.direction.platformHealthDetail')}</div>
                </div>

                <div style={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: 12, padding: '18px 20px' }}>
                  <div style={{ fontSize: 12, color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', marginBottom: 4 }}>{t('admin.direction.confirmedCashVolume')}</div>
                  <div style={{ fontSize: 20, fontWeight: 800, color: '#f59e0b' }}>{formatCurrency(stats.confirmed_cash)}</div>
                  <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>{t('admin.direction.doubleConfirmedTransactions')}</div>
                </div>

                <div style={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: 12, padding: '18px 20px' }}>
                  <div style={{ fontSize: 12, color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', marginBottom: 4 }}>{t('admin.direction.ordersToday')}</div>
                  <div style={{ fontSize: 24, fontWeight: 800, color: '#38bdf8' }}>{stats.orders_today}</div>
                  <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>{t('admin.direction.lifetimeOrders', { count: stats.total_orders })}</div>
                </div>

                <div style={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: 12, padding: '18px 20px' }}>
                  <div style={{ fontSize: 12, color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', marginBottom: 4 }}>{t('admin.direction.openDisputes')}</div>
                  <div style={{ fontSize: 24, fontWeight: 800, color: stats.open_disputes > 0 ? '#ef4444' : '#10b981' }}>
                    {stats.open_disputes}
                  </div>
                  <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>{t('admin.direction.requiringMediation')}</div>
                </div>
              </div>

              {/* Multi-Domain Metric Cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
                {/* Users & Accounts */}
                <div style={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: 12, padding: 20 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #1e293b', paddingBottom: 10, marginBottom: 14 }}>
                    <h3 style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>👥 {t('admin.direction.accountsBreakdown')}</h3>
                    <span style={{ fontSize: 18, fontWeight: 800, color: '#f8fafc' }}>{t('admin.direction.totalCount', { count: stats.total_users })}</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 13 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#94a3b8' }}>{t('admin.direction.buyers')}</span>
                      <span style={{ fontWeight: 700 }}>{stats.total_buyers}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#94a3b8' }}>{t('admin.direction.sellersOwners')}</span>
                      <span style={{ fontWeight: 700 }}>{stats.total_sellers}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#94a3b8' }}>{t('admin.direction.shopEmployees')}</span>
                      <span style={{ fontWeight: 700 }}>{stats.total_employees}</span>
                    </div>
                  </div>
                </div>

                {/* Businesses & Shops */}
                <div style={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: 12, padding: 20 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #1e293b', paddingBottom: 10, marginBottom: 14 }}>
                    <h3 style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>🏪 {t('admin.direction.merchantsAndOutlets')}</h3>
                    <span style={{ fontSize: 18, fontWeight: 800, color: '#f8fafc' }}>{t('admin.direction.businessesCount', { count: stats.total_businesses })}</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 13 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#94a3b8' }}>{t('admin.direction.totalRegisteredShops')}</span>
                      <span style={{ fontWeight: 700 }}>{stats.total_shops}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#94a3b8' }}>{t('admin.direction.currentlyActiveShops')}</span>
                      <span style={{ fontWeight: 700, color: '#10b981' }}>{stats.active_shops}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#94a3b8' }}>{t('admin.direction.inactiveSuspendedShops')}</span>
                      <span style={{ fontWeight: 700, color: '#ef4444' }}>{stats.total_shops - stats.active_shops}</span>
                    </div>
                  </div>
                </div>

                {/* Catalog & Inventory */}
                <div style={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: 12, padding: 20 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #1e293b', paddingBottom: 10, marginBottom: 14 }}>
                    <h3 style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>📦 {t('admin.direction.catalogAndStock')}</h3>
                    <span style={{ fontSize: 18, fontWeight: 800, color: '#f8fafc' }}>{t('admin.direction.productsCount', { count: stats.total_products })}</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 13 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#94a3b8' }}>{t('admin.direction.livePublishedProducts')}</span>
                      <span style={{ fontWeight: 700, color: '#3b82f6' }}>{stats.published_products}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#94a3b8' }}>{t('admin.direction.draftArchived')}</span>
                      <span style={{ fontWeight: 700 }}>{stats.total_products - stats.published_products}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#94a3b8' }}>{t('admin.direction.outOfStockAnomalies')}</span>
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
          {usersError && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, backgroundColor: 'var(--admin-danger-soft)', border: '1px solid var(--admin-danger)', borderRadius: 10, padding: '12px 16px', marginBottom: 16, color: 'var(--admin-text)' }}>
              <span>⚠️ {t('admin.direction.usersLoadErrorPrefix')} {usersError}</span>
              <button
                onClick={() => void loadUsers()}
                style={{ backgroundColor: 'var(--admin-surface-2)', color: 'var(--admin-text)', border: '1px solid var(--admin-border)', borderRadius: 8, padding: '6px 12px', fontSize: 13, fontWeight: 700, cursor: 'pointer', flexShrink: 0 }}
              >
                {t('admin.direction.retry')}
              </button>
            </div>
          )}
          {/* Filter Bar */}
          <div style={{ display: 'flex', gap: 12, marginBottom: 16, backgroundColor: '#0f172a', padding: 14, borderRadius: 10, border: '1px solid #1e293b' }}>
            <input
              type="text"
              placeholder={t('admin.direction.searchUsersPlaceholder')}
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
              <option value="">{t('admin.direction.allAccountTypes')}</option>
              <option value="BUYER">{t('admin.direction.accountTypeBuyer')}</option>
              <option value="SELLER">{t('admin.direction.accountTypeSeller')}</option>
              <option value="EMPLOYEE">{t('admin.direction.accountTypeEmployee')}</option>
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
              <option value="">{t('admin.direction.allStatuses')}</option>
              <option value="ACTIVE">{t('admin.direction.statusActive')}</option>
              <option value="SUSPENDED">{t('admin.direction.statusSuspended')}</option>
              <option value="PENDING_VERIFICATION">{t('admin.direction.statusPendingVerification')}</option>
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
              {t('admin.direction.filter')}
            </button>
          </div>

          {/* User Table */}
          <div style={{ backgroundColor: '#0f172a', borderRadius: 12, border: '1px solid #1e293b', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13 }}>
              <thead>
                <tr style={{ backgroundColor: '#1e293b', color: '#94a3b8', borderBottom: '1px solid #334155' }}>
                  <th style={{ padding: '12px 16px' }}>{t('admin.direction.thUser')}</th>
                  <th style={{ padding: '12px 16px' }}>{t('admin.direction.thContact')}</th>
                  <th style={{ padding: '12px 16px' }}>{t('admin.direction.thType')}</th>
                  <th style={{ padding: '12px 16px' }}>{t('common.status')}</th>
                  <th style={{ padding: '12px 16px' }}>{t('admin.direction.thBizShops')}</th>
                  <th style={{ padding: '12px 16px' }}>{t('admin.direction.thOrders')}</th>
                  <th style={{ padding: '12px 16px' }}>{t('admin.direction.thPoints')}</th>
                  <th style={{ padding: '12px 16px', textAlign: 'right' }}>{t('admin.direction.thActions')}</th>
                </tr>
              </thead>
              <tbody>
                {loadingUsers ? (
                  <tr>
                    <td colSpan={8} style={{ padding: 36, textAlign: 'center', color: '#64748b' }}>
                      {t('admin.direction.loadingUsers')}
                    </td>
                  </tr>
                ) : users.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ padding: 36, textAlign: 'center', color: '#64748b' }}>
                      {t('admin.direction.noUsersFound')}
                    </td>
                  </tr>
                ) : (
                  users.map((u) => (
                    <tr key={u.id} style={{ borderBottom: '1px solid #1e293b' }}>
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ fontWeight: 700, color: '#ffffff' }}>
                          {u.first_name} {u.last_name}
                        </div>
                        <div style={{ fontSize: 11, color: '#64748b' }}>{t('admin.direction.idPrefix', { id: u.id.substring(0, 8) })}</div>
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
                        {t('admin.direction.bizShopsValue', { biz: u.business_count, shops: u.shop_count })}
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
                              {t('admin.direction.suspend')}
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
                              {t('admin.direction.reactivate')}
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
                            title={t('admin.direction.revokeTokensTooltip')}
                          >
                            {t('admin.direction.logout')}
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
          {auditError && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, backgroundColor: 'var(--admin-danger-soft)', border: '1px solid var(--admin-danger)', borderRadius: 10, padding: '12px 16px', marginBottom: 16, color: 'var(--admin-text)' }}>
              <span>⚠️ {t('admin.direction.auditLoadErrorPrefix')} {auditError}</span>
              <button
                onClick={() => void loadAuditLogs()}
                style={{ backgroundColor: 'var(--admin-surface-2)', color: 'var(--admin-text)', border: '1px solid var(--admin-border)', borderRadius: 8, padding: '6px 12px', fontSize: 13, fontWeight: 700, cursor: 'pointer', flexShrink: 0 }}
              >
                {t('admin.direction.retry')}
              </button>
            </div>
          )}
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
              <option value="">{t('admin.direction.allTargetEntities')}</option>
              <option value="USER">{t('admin.direction.targetUserActions')}</option>
              <option value="ADMIN_USER">{t('admin.direction.targetAdminAuthEvents')}</option>
              <option value="BUSINESS">{t('admin.direction.targetBusinessLifecycle')}</option>
              <option value="SHOP">{t('admin.direction.targetShopLifecycle')}</option>
              <option value="PRODUCT">{t('admin.direction.targetProductModifications')}</option>
              <option value="ORDER">{t('admin.direction.targetOrderOverrides')}</option>
              <option value="POINT_ACCOUNT">{t('admin.direction.targetPointsAdjustments')}</option>
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
              {t('admin.direction.filterAuditLog')}
            </button>
          </div>

          <div style={{ backgroundColor: '#0f172a', borderRadius: 12, border: '1px solid #1e293b', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13 }}>
              <thead>
                <tr style={{ backgroundColor: '#1e293b', color: '#94a3b8', borderBottom: '1px solid #334155' }}>
                  <th style={{ padding: '12px 16px' }}>{t('admin.direction.thTimestamp')}</th>
                  <th style={{ padding: '12px 16px' }}>{t('admin.direction.thAdministrator')}</th>
                  <th style={{ padding: '12px 16px' }}>{t('admin.direction.thAction')}</th>
                  <th style={{ padding: '12px 16px' }}>{t('admin.direction.thTarget')}</th>
                  <th style={{ padding: '12px 16px' }}>{t('admin.direction.thMandatoryJustification')}</th>
                  <th style={{ padding: '12px 16px', textAlign: 'right' }}>{t('admin.direction.thInspection')}</th>
                </tr>
              </thead>
              <tbody>
                {loadingAudit ? (
                  <tr>
                    <td colSpan={6} style={{ padding: 36, textAlign: 'center', color: '#64748b' }}>
                      {t('admin.direction.loadingAuditLedger')}
                    </td>
                  </tr>
                ) : auditLogs.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ padding: 36, textAlign: 'center', color: '#64748b' }}>
                      {t('admin.direction.noAuditEvents')}
                    </td>
                  </tr>
                ) : (
                  auditLogs.map((l) => (
                    <tr key={l.id} style={{ borderBottom: '1px solid #1e293b' }}>
                      <td style={{ padding: '12px 16px', fontSize: 12, color: '#94a3b8' }}>
                        {new Date(l.created_at).toLocaleString()}
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ fontWeight: 700, color: '#ffffff' }}>{l.actor_admin_name || l.actor_admin_email || t('admin.direction.adminFallback')}</div>
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
                            {t('admin.direction.viewDiff')}
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
              {t('admin.direction.confirmActionTitle', { action: actionType.toUpperCase().replace('_', ' ') })}
            </h3>
            <p style={{ fontSize: 13, color: '#94a3b8', margin: '0 0 20px', lineHeight: 1.5 }}>
              {t('admin.direction.targetUserLabel')} <strong>{actionTargetUser.first_name} {actionTargetUser.last_name}</strong> ({actionTargetUser.email}).
              {' '}{t('admin.direction.mutatesLiveStateNotice')}
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
                {t('admin.direction.mandatoryJustificationLabel')}
              </label>
              <textarea
                value={actionReason}
                onChange={(e) => setActionReason(e.target.value)}
                placeholder={t('admin.direction.justificationPlaceholder')}
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
                {t('common.cancel')}
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
                {actionSubmitting ? t('admin.direction.executing') : t('admin.direction.confirmAndCommitAudit')}
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
              {t('admin.direction.auditMutationDiff', { action: selectedAuditLog.action })}
            </h3>
            <p style={{ fontSize: 12, color: '#64748b', margin: '0 0 18px' }}>
              {t('admin.direction.eventIdTarget', { id: selectedAuditLog.id, targetType: selectedAuditLog.target_type, targetId: selectedAuditLog.target_id })}
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 20 }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#ef4444', marginBottom: 6 }}>{t('admin.direction.previousStateLabel')}</div>
                <pre style={{ backgroundColor: '#1e293b', padding: 12, borderRadius: 8, fontSize: 11, color: '#cbd5e1', overflow: 'auto', maxHeight: 200 }}>
                  {JSON.stringify(selectedAuditLog.old_value, null, 2) || 'null'}
                </pre>
              </div>
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#10b981', marginBottom: 6 }}>{t('admin.direction.newStateLabel')}</div>
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
                {t('admin.direction.closeDiffInspector')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
