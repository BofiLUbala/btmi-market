import { useAuth } from '@/store/auth'
import { cashApi } from '@/api/seller'
import { Card, CardGrid } from '@/components/ui/Card'
import { useEffect, useState } from 'react'
import { ErrorBox, LoadingBlock } from '@/components/ui/Feedback'
import { Button } from '@/components/ui/Button'
import type { CashSession, CashSummary } from '@/api/types'
import { useT } from '@/store/i18n'
import type { TranslationKey } from '@/locales/fr'

const CASH_SESSION_STATUS_KEYS: Record<string, TranslationKey> = {
  OPEN: 'seller.cash.status.OPEN',
  CLOSED: 'seller.cash.status.CLOSED',
  RECONCILED: 'seller.cash.status.RECONCILED',
}

export default function SellerCashPage() {
  const t = useT()
  const { activeBusiness, activeShop } = useAuth()
  const [summary, setSummary] = useState<CashSummary | null>(null)
  const [sessions, setSessions] = useState<CashSession[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [activeTab, setActiveTab] = useState<'summary' | 'sessions'>('summary')
  const [openingAmount, setOpeningAmount] = useState('')
  const [closingAmounts, setClosingAmounts] = useState<Record<string, string>>({})
  const [actionError, setActionError] = useState('')
  const [acting, setActing] = useState(false)

  useEffect(() => {
    if (activeBusiness) {
      loadCashData()
    }
  }, [activeBusiness, activeShop])

  async function loadCashData() {
    if (!activeBusiness) return
    setLoading(true)
    try {
      const [summaryData, sessionsData] = await Promise.all([
        cashApi.getBusinessCashSummary(activeBusiness.id),
        cashApi.listBusinessSessions(activeBusiness.id, { limit: 10 }),
      ])
      setSummary(summaryData)
      setSessions(Array.isArray(sessionsData) ? sessionsData : [])
    } catch (err) {
      setError(err instanceof Error ? err.message : t('seller.cash.loadFailed'))
      setSessions([])
    } finally {
      setLoading(false)
    }
  }

  async function openSession() {
    if (!activeShop) return
    const amount = parseFloat(openingAmount)
    if (isNaN(amount) || amount < 0) {
      setActionError(t('seller.cash.invalidOpeningAmount'))
      return
    }
    setActing(true)
    setActionError('')
    try {
      await cashApi.openSession(activeShop, amount)
      setOpeningAmount('')
      await loadCashData()
    } catch (err) {
      setActionError(err instanceof Error ? err.message : t('seller.cash.openFailed'))
    } finally {
      setActing(false)
    }
  }

  async function closeSession(session: CashSession) {
    const raw = closingAmounts[session.id]
    const amount = parseFloat(raw)
    if (isNaN(amount) || amount < 0) {
      setActionError(t('seller.cash.invalidClosingAmount'))
      return
    }
    setActing(true)
    setActionError('')
    try {
      await cashApi.closeSession(session.id, amount)
      setClosingAmounts((prev) => ({ ...prev, [session.id]: '' }))
      await loadCashData()
    } catch (err) {
      setActionError(err instanceof Error ? err.message : t('seller.cash.closeFailed'))
    } finally {
      setActing(false)
    }
  }

  if (!activeBusiness) {
    return (
      <div className="empty-state" style={{ padding: '64px 0', textAlign: 'center' }}>
        <div className="empty-icon" style={{ fontSize: 64 }}>💵</div>
        <h2>{t('seller.noBusinessSelected')}</h2>
        <p className="muted">{t('seller.cash.noBusinessSelectedHint')}</p>
      </div>
    )
  }

  const shopName = (shopId: string) =>
    summary?.shop_breakdown?.find((s) => s.shop_id === shopId)?.shop_name || shopId.slice(0, 8)

  return (
    <div className="seller-cash">
      <div className="page-header">
        <h1>{t('seller.cash.title')}</h1>
      </div>

      {loading ? (
        <LoadingBlock label={t('seller.cash.loading')} />
      ) : error ? (
        <ErrorBox error={error} />
      ) : (
        <>
          {actionError && <ErrorBox error={actionError} />}
          <div className="tabs" style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            <Button variant={activeTab === 'summary' ? 'primary' : 'outline'} onClick={() => setActiveTab('summary')}>
              {t('seller.cash.summaryTab')}
            </Button>
            <Button variant={activeTab === 'sessions' ? 'primary' : 'outline'} onClick={() => setActiveTab('sessions')}>
              {t('seller.cash.sessionsTab')}
            </Button>
          </div>

          {activeTab === 'summary' && summary && (
            <>
              <CardGrid>
                <Card>
                  <h3>{t('seller.cash.totalCashSales')}</h3>
                  <div className="stat-value">{summary.total_cash_sales.toLocaleString()} FC</div>
                </Card>
                {(summary.shop_breakdown || []).map((shop) => (
                  <Card key={shop.shop_id}>
                    <h3>{shop.shop_name}</h3>
                    <div className="stat-value">{shop.total_cash_sales.toLocaleString()} FC</div>
                    <p className="muted small">
                      {t('seller.cash.sessionsOpenClosed', { open: shop.open_sessions, closed: shop.closed_sessions })}
                      {shop.total_shortage > 0 && t('seller.cash.shortage', { amount: shop.total_shortage.toLocaleString() })}
                      {shop.total_overage > 0 && t('seller.cash.overage', { amount: shop.total_overage.toLocaleString() })}
                    </p>
                  </Card>
                ))}
              </CardGrid>
              {activeShop && (
                <Card style={{ marginTop: 16 }}>
                  <h3>{t('seller.cash.openSessionTitle')}</h3>
                  <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      placeholder={t('seller.cash.openingFloatPlaceholder')}
                      value={openingAmount}
                      onChange={(e) => setOpeningAmount(e.target.value)}
                      style={{ flex: 1 }}
                    />
                    <Button onClick={openSession} disabled={acting}>
                      {acting ? t('seller.cash.opening') : t('seller.cash.openSession')}
                    </Button>
                  </div>
                </Card>
              )}
            </>
          )}

          {activeTab === 'sessions' && (
            <Card>
              <div className="card-header">
                <h3>{t('seller.cash.recentSessions')}</h3>
              </div>
              {sessions.length === 0 ? (
                <p className="muted small" style={{ padding: 16, textAlign: 'center' }}>{t('seller.cash.noSessionsYet')}</p>
              ) : (
                <div className="table-responsive">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>{t('orders.shop')}</th>
                        <th>{t('seller.cash.employee')}</th>
                        <th>{t('seller.cash.openingColumn')}</th>
                        <th>{t('seller.cash.cashSales')}</th>
                        <th>{t('seller.cash.expected')}</th>
                        <th>{t('seller.cash.declared')}</th>
                        <th>{t('seller.cash.difference')}</th>
                        <th>{t('common.status')}</th>
                        <th>{t('seller.cash.opened')}</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {sessions.map((session) => (
                        <tr key={session.id}>
                          <td>{session.shop_name || shopName(session.shop_id)}</td>
                          <td>{[session.employee_first_name, session.employee_last_name].filter(Boolean).join(' ') || '—'}</td>
                          <td>{session.opening_amount.toLocaleString()}</td>
                          <td>{session.cash_sales_total.toLocaleString()}</td>
                          <td>{session.expected_amount.toLocaleString()}</td>
                          <td>{session.declared_closing_amount?.toLocaleString() || '—'}</td>
                          <td className={!session.difference ? 'success' : 'danger'}>{session.difference?.toLocaleString() ?? '—'}</td>
                          <td><span className={`badge badge-${session.status === 'RECONCILED' ? 'success' : session.status === 'CLOSED' ? 'warning' : 'primary'}`}>{t(CASH_SESSION_STATUS_KEYS[session.status] ?? 'seller.cash.status.OPEN')}</span></td>
                          <td className="small">{new Date(session.opened_at).toLocaleDateString()}</td>
                          <td>
                            {session.status === 'OPEN' && (
                              <div style={{ display: 'flex', gap: 4 }}>
                                <input
                                  type="number"
                                  min="0"
                                  step="any"
                                  placeholder={t('seller.cash.counted')}
                                  value={closingAmounts[session.id] ?? ''}
                                  onChange={(e) => setClosingAmounts((prev) => ({ ...prev, [session.id]: e.target.value }))}
                                  style={{ width: 90 }}
                                />
                                <Button size="sm" onClick={() => closeSession(session)} disabled={acting}>
                                  {t('seller.cash.closeSession')}
                                </Button>
                              </div>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          )}
        </>
      )}
    </div>
  )
}
