import { useState, useEffect, useCallback } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { adminCommerceApi, adminDirectionApi, type AdminOrderItem, type AdminUserListItem } from '@/api/admin'
import { useT } from '@/store/i18n'

export default function CommerceDeliveryAssignmentsPage() {
  const t = useT()
  const [searchParams] = useSearchParams()
  const initialCourierId = searchParams.get('courier_id') || ''

  const [orders, setOrders] = useState<AdminOrderItem[]>([])
  const [couriers, setCouriers] = useState<AdminUserListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [selectedOrder, setSelectedOrder] = useState<AdminOrderItem | null>(null)
  const [selectedCourierId, setSelectedCourierId] = useState(initialCourierId)
  const [notes, setNotes] = useState('')
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const [orderRes, courierRes] = await Promise.all([
        adminCommerceApi.listOrders({
          limit: 50,
        }),
        adminDirectionApi.listUsers({
          account_type: 'EMPLOYEE',
          status: 'ACTIVE',
          limit: 100,
        }),
      ])
      setOrders(orderRes.orders)
      setCouriers(courierRes.users)
    } catch (err) {
      console.error('Failed to load dispatch queue data', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchData()
  }, [fetchData])

  const handleAssign = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedOrder || !selectedCourierId) return
    setActionLoading(true)
    setMsg(null)
    try {
      await adminCommerceApi.assignCourier(selectedOrder.id, {
        courier_id: selectedCourierId,
        notes: notes || undefined,
      })
      setMsg({ type: 'success', text: t('admin.commerce.courierAssignedSuccess') || `Courier successfully assigned to Order #${selectedOrder.order_number}` })
      setSelectedOrder(null)
      setNotes('')
      await fetchData()
    } catch (err) {
      setMsg({ type: 'error', text: err instanceof Error ? err.message : 'Assignment failed' })
    } finally {
      setActionLoading(false)
    }
  }

  return (
    <div>
      <div style={{ marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 800, margin: '0 0 4px', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span>📋</span> {t('admin.commerce.dispatchQueueTitle') || 'Delivery Assignments & Dispatch Queue'}
          </h2>
          <p style={{ color: 'var(--admin-text-muted)', fontSize: 13, margin: 0 }}>
            {t('admin.commerce.dispatchQueueSubtitle') || 'Assign active drivers and couriers to pending scheduled deliveries.'}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Link
            to="/admin/commerce/deliveries"
            style={{
              backgroundColor: 'var(--admin-surface-2)',
              color: 'var(--admin-text)',
              border: '1px solid var(--admin-border)',
              borderRadius: 8,
              padding: '8px 14px',
              fontSize: 13,
              fontWeight: 700,
              textDecoration: 'none',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6
            }}
          >
            🚚 {t('admin.commerce.allDeliveries') || 'All Deliveries'}
          </Link>
          <Link
            to="/admin/commerce/couriers"
            style={{
              backgroundColor: 'var(--admin-surface-2)',
              color: 'var(--admin-text)',
              border: '1px solid var(--admin-border)',
              borderRadius: 8,
              padding: '8px 14px',
              fontSize: 13,
              fontWeight: 700,
              textDecoration: 'none',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6
            }}
          >
            🛵 {t('admin.commerce.couriers') || 'Couriers'}
          </Link>
        </div>
      </div>

      {msg && (
        <div style={{
          padding: '12px 16px',
          borderRadius: 8,
          marginBottom: 16,
          fontSize: 13,
          fontWeight: 600,
          backgroundColor: msg.type === 'success' ? 'var(--admin-success-soft)' : 'var(--admin-danger-soft)',
          color: msg.type === 'success' ? 'var(--admin-success)' : 'var(--admin-danger)',
          border: `1px solid ${msg.type === 'success' ? 'var(--admin-success)' : 'var(--admin-danger)'}`
        }}>
          {msg.text}
        </div>
      )}

      {/* Assignment Modal */}
      {selectedOrder && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.7)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: 16
        }}>
          <div style={{
            backgroundColor: 'var(--admin-surface)',
            border: '1px solid var(--admin-border)',
            borderRadius: 12,
            padding: 24,
            maxWidth: 480,
            width: '100%',
            color: 'var(--admin-text)'
          }}>
            <h3 style={{ fontSize: 18, fontWeight: 800, margin: '0 0 12px' }}>
              Assign Courier to #{selectedOrder.order_number}
            </h3>
            <p style={{ fontSize: 13, color: 'var(--admin-text-muted)', marginBottom: 16 }}>
              Shop: <strong>{selectedOrder.shop_name}</strong> • Total: <strong>{(selectedOrder.final_total || 0).toLocaleString()} XAF</strong>
            </p>
            <form onSubmit={handleAssign}>
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 6, color: 'var(--admin-text-muted)' }}>
                  Select Available Courier / Driver *
                </label>
                <select
                  required
                  value={selectedCourierId}
                  onChange={(e) => setSelectedCourierId(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: 8,
                    border: '1px solid var(--admin-border)',
                    backgroundColor: 'var(--admin-surface-2)',
                    color: 'var(--admin-text)',
                    fontSize: 13
                  }}
                >
                  <option value="">-- Choose Courier --</option>
                  {couriers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.first_name} {c.last_name} ({c.email})
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ marginBottom: 20 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 6, color: 'var(--admin-text-muted)' }}>
                  Dispatch Instructions / Notes (Optional)
                </label>
                <textarea
                  rows={3}
                  placeholder="e.g. Fragile package, handle with care, gate code..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: 8,
                    border: '1px solid var(--admin-border)',
                    backgroundColor: 'var(--admin-surface-2)',
                    color: 'var(--admin-text)',
                    fontSize: 13,
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button
                  type="button"
                  disabled={actionLoading}
                  onClick={() => setSelectedOrder(null)}
                  style={{
                    padding: '8px 16px',
                    borderRadius: 8,
                    border: '1px solid var(--admin-border)',
                    backgroundColor: 'var(--admin-surface-2)',
                    color: 'var(--admin-text)',
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading || !selectedCourierId}
                  style={{
                    padding: '8px 16px',
                    borderRadius: 8,
                    border: 'none',
                    backgroundColor: 'var(--admin-primary)',
                    color: '#ffffff',
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: actionLoading || !selectedCourierId ? 'not-allowed' : 'pointer',
                    opacity: actionLoading || !selectedCourierId ? 0.6 : 1
                  }}
                >
                  {actionLoading ? 'Assigning...' : 'Confirm Assignment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {loading ? (
        <div style={{ padding: 48, textAlign: 'center', color: 'var(--admin-text-muted)' }}>
          <div className="spinner" style={{ width: 32, height: 32, margin: '0 auto 12px' }} />
        </div>
      ) : orders.length === 0 ? (
        <div style={{ padding: 48, textAlign: 'center', color: 'var(--admin-text-muted)', backgroundColor: 'var(--admin-surface)', borderRadius: 10, border: '1px solid var(--admin-border-soft)' }}>
          ✅ All pending delivery orders have been dispatched or assigned!
        </div>
      ) : (
        <div style={{ overflowX: 'auto', backgroundColor: 'var(--admin-surface)', borderRadius: 10, border: '1px solid var(--admin-border-soft)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--admin-border)', backgroundColor: 'var(--admin-surface-2)' }}>
                <th style={{ textAlign: 'left', padding: '12px 14px', color: 'var(--admin-text-muted)', fontWeight: 600 }}>{t('admin.orders.orderNumberColumn') || 'Order #'}</th>
                <th style={{ textAlign: 'left', padding: '12px 14px', color: 'var(--admin-text-muted)', fontWeight: 600 }}>{t('admin.orders.shopColumn') || 'Shop'}</th>
                <th style={{ textAlign: 'center', padding: '12px 14px', color: 'var(--admin-text-muted)', fontWeight: 600 }}>{t('admin.orders.statusColumn') || 'Fulfillment Status'}</th>
                <th style={{ textAlign: 'right', padding: '12px 14px', color: 'var(--admin-text-muted)', fontWeight: 600 }}>{t('admin.orders.totalColumn') || 'Order Value'}</th>
                <th style={{ textAlign: 'right', padding: '12px 14px', color: 'var(--admin-text-muted)', fontWeight: 600 }}>{t('admin.common.actions') || 'Dispatch Action'}</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.id} style={{ borderBottom: '1px solid var(--admin-border-soft)' }}>
                  <td style={{ padding: '12px 14px' }}>
                    <div style={{ fontWeight: 700, color: 'var(--admin-text)' }}>#{o.order_number}</div>
                    <div style={{ fontSize: 11, color: 'var(--admin-text-muted)' }}>
                      Placed: {new Date(o.created_at).toLocaleString()}
                    </div>
                  </td>
                  <td style={{ padding: '12px 14px' }}>
                    <div style={{ fontWeight: 600, color: 'var(--admin-text)' }}>{o.shop_name}</div>
                    <div style={{ fontSize: 11, color: 'var(--admin-text-faint)' }}>{o.business_name}</div>
                  </td>
                  <td style={{ textAlign: 'center', padding: '12px 14px' }}>
                    <span style={{
                      fontSize: 11,
                      fontWeight: 700,
                      padding: '2px 8px',
                      borderRadius: 6,
                      backgroundColor: 'rgba(99, 102, 241, 0.15)',
                      color: '#818cf8'
                    }}>
                      {o.status} (Awaiting Courier)
                    </span>
                  </td>
                  <td style={{ textAlign: 'right', padding: '12px 14px', fontWeight: 700, color: 'var(--admin-text)' }}>
                    {(o.final_total || 0).toLocaleString()} XAF
                  </td>
                  <td style={{ textAlign: 'right', padding: '12px 14px' }}>
                    <button
                      onClick={() => {
                        setSelectedOrder(o)
                        if (!selectedCourierId && couriers.length > 0) {
                          setSelectedCourierId(couriers[0].id)
                        }
                      }}
                      style={{
                        padding: '6px 12px',
                        borderRadius: 6,
                        border: 'none',
                        backgroundColor: 'var(--admin-primary)',
                        color: '#ffffff',
                        fontSize: 12,
                        fontWeight: 700,
                        cursor: 'pointer'
                      }}
                    >
                      Assign Courier ➔
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
