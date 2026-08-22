import { useAuth } from '@/store/auth'
import { cashApi } from '@/api/seller'
import { Card, CardGrid } from '@/components/ui/Card'
import { useEffect, useState } from 'react'
import { ErrorBox, LoadingBlock } from '@/components/ui/Feedback'
import { Button } from '@/components/ui/Button'
import type { CashSession, CashSummary } from '@/api/types'

export default function SellerCashPage() {
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
      setError(err instanceof Error ? err.message : 'Failed to load cash data')
      setSessions([])
    } finally {
      setLoading(false)
    }
  }

  async function openSession() {
    if (!activeShop) return
    const amount = parseFloat(openingAmount)
    if (isNaN(amount) || amount < 0) {
      setActionError('Enter a valid opening amount')
      return
    }
    setActing(true)
    setActionError('')
    try {
      await cashApi.openSession(activeShop, amount)
      setOpeningAmount('')
      await loadCashData()
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to open session')
    } finally {
      setActing(false)
    }
  }

  async function closeSession(session: CashSession) {
    const raw = closingAmounts[session.id]
    const amount = parseFloat(raw)
    if (isNaN(amount) || amount < 0) {
      setActionError('Enter a valid declared closing amount')
      return
    }
    setActing(true)
    setActionError('')
    try {
      await cashApi.closeSession(session.id, amount)
      setClosingAmounts((prev) => ({ ...prev, [session.id]: '' }))
      await loadCashData()
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to close session')
    } finally {
      setActing(false)
    }
  }

  if (!activeBusiness) {
    return (
      <div className="empty-state" style={{ padding: '64px 0', textAlign: 'center' }}>
        <div className="empty-icon" style={{ fontSize: 64 }}>💵</div>
        <h2>No Business Selected</h2>
        <p className="muted">Select a business to manage cash.</p>
      </div>
    )
  }

  const shopName = (shopId: string) =>
    summary?.shop_breakdown?.find((s) => s.shop_id === shopId)?.shop_name || shopId.slice(0, 8)

  return (
    <div className="seller-cash">
      <div className="page-header">
        <h1>Cash Management</h1>
      </div>

      {loading ? (
        <LoadingBlock label="Loading cash data…" />
      ) : error ? (
        <ErrorBox error={error} />
      ) : (
        <>
          {actionError && <ErrorBox error={actionError} />}
          <div className="tabs" style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            <Button variant={activeTab === 'summary' ? 'primary' : 'outline'} onClick={() => setActiveTab('summary')}>
              Summary
            </Button>
            <Button variant={activeTab === 'sessions' ? 'primary' : 'outline'} onClick={() => setActiveTab('sessions')}>
              Sessions
            </Button>
          </div>

          {activeTab === 'summary' && summary && (
            <>
              <CardGrid>
                <Card>
                  <h3>Total Cash Sales</h3>
                  <div className="stat-value">{summary.total_cash_sales.toLocaleString()} FC</div>
                </Card>
                {(summary.shop_breakdown || []).map((shop) => (
                  <Card key={shop.shop_id}>
                    <h3>{shop.shop_name}</h3>
                    <div className="stat-value">{shop.total_cash_sales.toLocaleString()} FC</div>
                    <p className="muted small">
                      {shop.open_sessions} open · {shop.closed_sessions} closed
                      {shop.total_shortage > 0 && ` · shortage ${shop.total_shortage.toLocaleString()}`}
                      {shop.total_overage > 0 && ` · overage ${shop.total_overage.toLocaleString()}`}
                    </p>
                  </Card>
                ))}
              </CardGrid>
              {activeShop && (
                <Card style={{ marginTop: 16 }}>
                  <h3>Open a Cash Session</h3>
                  <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      placeholder="Opening float amount"
                      value={openingAmount}
                      onChange={(e) => setOpeningAmount(e.target.value)}
                      style={{ flex: 1 }}
                    />
                    <Button onClick={openSession} disabled={acting}>
                      {acting ? 'Opening…' : 'Open Session'}
                    </Button>
                  </div>
                </Card>
              )}
            </>
          )}

          {activeTab === 'sessions' && (
            <Card>
              <div className="card-header">
                <h3>Recent Sessions</h3>
              </div>
              {sessions.length === 0 ? (
                <p className="muted small" style={{ padding: 16, textAlign: 'center' }}>No sessions yet</p>
              ) : (
                <div className="table-responsive">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Shop</th>
                        <th>Employee</th>
                        <th>Opening</th>
                        <th>Cash Sales</th>
                        <th>Expected</th>
                        <th>Declared</th>
                        <th>Diff</th>
                        <th>Status</th>
                        <th>Opened</th>
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
                          <td><span className={`badge badge-${session.status === 'RECONCILED' ? 'success' : session.status === 'CLOSED' ? 'warning' : 'primary'}`}>{session.status}</span></td>
                          <td className="small">{new Date(session.opened_at).toLocaleDateString()}</td>
                          <td>
                            {session.status === 'OPEN' && (
                              <div style={{ display: 'flex', gap: 4 }}>
                                <input
                                  type="number"
                                  min="0"
                                  step="any"
                                  placeholder="Counted"
                                  value={closingAmounts[session.id] ?? ''}
                                  onChange={(e) => setClosingAmounts((prev) => ({ ...prev, [session.id]: e.target.value }))}
                                  style={{ width: 90 }}
                                />
                                <Button size="sm" onClick={() => closeSession(session)} disabled={acting}>
                                  Close
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
