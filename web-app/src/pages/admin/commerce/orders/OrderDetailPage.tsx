import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { adminCommerceApi, type AdminOrderDetail } from '@/api/admin'
import { useT } from '@/store/i18n'

const STATUS_COLORS: Record<string, { bg: string; fg: string }> = {
  PENDING: { bg: '#78350f', fg: '#fde68a' },
  CONFIRMED: { bg: '#1e3a5f', fg: '#93c5fd' },
  PROCESSING: { bg: '#1e3a5f', fg: '#93c5fd' },
  SHIPPED: { bg: '#064e3b', fg: '#a7f3d0' },
  DELIVERED: { bg: '#064e3b', fg: '#a7f3d0' },
  COMPLETED: { bg: '#064e3b', fg: '#a7f3d0' },
  CANCELLED: { bg: '#7f1d1d', fg: '#fca5a5' },
  REFUNDED: { bg: '#78350f', fg: '#fde68a' },
}

function Badge({ status }: { status: string }) {
  const c = STATUS_COLORS[status] || { bg: '#334155', fg: '#f1f5f9' }
  return <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 6, backgroundColor: c.bg, color: c.fg }}>{status}</span>
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: 10, padding: 16, marginBottom: 16 }}>
      <h4 style={{ fontSize: 14, fontWeight: 700, margin: '0 0 12px', color: '#94a3b8' }}>{title}</h4>
      {children}
    </div>
  )
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 14, color: '#f8fafc' }}>{value || '-'}</div>
    </div>
  )
}

export default function OrderDetailPage() {
  const t = useT()
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [order, setOrder] = useState<AdminOrderDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [showAssign, setShowAssign] = useState(false)
  const [courierName, setCourierName] = useState('')
  const [courierPhone, setCourierPhone] = useState('')
  const [courierNotes, setCourierNotes] = useState('')
  const [assigning, setAssigning] = useState(false)
  const [assignError, setAssignError] = useState('')

  useEffect(() => {
    if (!id) return
    setLoading(true)
    adminCommerceApi.getOrder(id)
      .then((res) => {
        setOrder(res)
        if (res.order.assigned_courier_id) {
          setCourierName(res.order.assigned_courier_id)
        }
      })
      .catch(() => navigate('/admin/commerce/orders'))
      .finally(() => setLoading(false))
  }, [id, navigate])

  async function handleAssignCourier() {
    if (!id || !courierName.trim()) return
    setAssigning(true)
    setAssignError('')
    try {
      await adminCommerceApi.assignCourier(id, {
        courier_name: courierName.trim(),
        courier_phone: courierPhone.trim() || undefined,
        notes: courierNotes.trim() || undefined,
      })
      const refreshed = await adminCommerceApi.getOrder(id)
      setOrder(refreshed)
      setShowAssign(false)
    } catch (e: any) {
      setAssignError(e?.message || 'Erreur lors de l’assignation du livreur')
    } finally {
      setAssigning(false)
    }
  }

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>{t('admin.orders.loadingDetail')}</div>
  if (!order) return <div style={{ padding: 40, textAlign: 'center', color: '#dc2626' }}>{t('admin.orders.notFound')}</div>

  return (
    <div>
      <button onClick={() => navigate('/admin/commerce/orders')} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: 13, marginBottom: 8 }}>&larr; {t('admin.orders.backToList')}</button>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 800, margin: '0 0 4px' }}>{t('admin.orders.detailTitle', { number: order.order.order_number })}</h2>
          <div style={{ color: '#64748b', fontSize: 12 }}>{t('admin.orders.placedAt', { date: new Date(order.order.created_at).toLocaleString() })}</div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <Badge status={order.order.status} />
          <Badge status={order.order.payment_status} />
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div>
          <Section title={t('admin.orders.summaryTitle')}>
            <Field label={t('admin.orders.fieldOrderNumber')} value={order.order.order_number} />
            <Field label={t('common.total')} value={`$${order.order.final_total.toFixed(2)}`} />
            <Field label={t('admin.orders.fieldBaseTotal')} value={`$${order.order.base_total.toFixed(2)}`} />
            <Field label={t('admin.orders.fieldDeliveryFee')} value={`$${order.order.delivery_fee.toFixed(2)}`} />
            <Field label={t('admin.orders.fieldPointsDiscount')} value={order.order.points_discount > 0 ? `-$${order.order.points_discount.toFixed(2)}` : '$0.00'} />
            {order.payment && <Field label={t('admin.orders.fieldPaymentMethod')} value={order.payment.payment_method} />}
            <Field label={t('admin.orders.fieldPaymentStatus')} value={<Badge status={order.order.payment_status} />} />
            <Field label={t('admin.orders.fieldDeliveryMethod')} value={order.order.delivery_method || t('admin.common.notAvailable')} />
            {order.order.is_stuck && <Field label={t('admin.orders.fieldStuckReason')} value={order.order.stuck_reason || t('admin.orders.stuckReasonDefault')} />}
          </Section>

          <Section title="Livraison TBK">
            <Field label="Statut de livraison" value={<Badge status={order.order.delivery_status || 'PENDING_TBK_ASSIGNMENT'} />} />
            <Field label="Méthode" value={order.order.delivery_method || 'TBK_STANDARD'} />
            <Field label="Contact livraison" value={order.order.delivery_contact_name || order.order.buyer_name} />
            <Field label="Téléphone livraison" value={order.order.delivery_phone || order.order.buyer_phone} />
            <Field label="Adresse de livraison" value={order.order.delivery_address || '-'} />
            {order.order.delivery_notes && <Field label="Notes client" value={order.order.delivery_notes} />}
            {order.order.assigned_courier_id && (
              <>
                <Field label="Livreur assigné" value={order.order.assigned_courier_id} />
                {order.order.courier_assigned_at && (
                  <Field label="Assigné le" value={new Date(order.order.courier_assigned_at).toLocaleString()} />
                )}
                {order.order.courier_notes && <Field label="Notes livreur" value={order.order.courier_notes} />}
              </>
            )}

            <div style={{ marginTop: 12, borderTop: '1px solid #1e293b', paddingTop: 12 }}>
              {!showAssign ? (
                <button
                  type="button"
                  onClick={() => setShowAssign(true)}
                  style={{ backgroundColor: '#2563eb', color: '#fff', border: 'none', borderRadius: 6, padding: '6px 12px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
                >
                  {order.order.assigned_courier_id ? 'Changer de livreur' : 'Assigner un livreur TBK'}
                </button>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, backgroundColor: '#020617', padding: 12, borderRadius: 8 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#93c5fd' }}>Assigner un livreur</div>
                  {assignError && <div style={{ color: '#ef4444', fontSize: 12 }}>{assignError}</div>}
                  <div>
                    <label style={{ fontSize: 11, color: '#94a3b8', display: 'block', marginBottom: 2 }}>Nom / ID du livreur *</label>
                    <input
                      type="text"
                      value={courierName}
                      onChange={(e) => setCourierName(e.target.value)}
                      placeholder="Ex: Livreur Kinshasa #12"
                      style={{ width: '100%', padding: '6px 8px', borderRadius: 4, border: '1px solid #334155', backgroundColor: '#0f172a', color: '#fff', fontSize: 13 }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: 11, color: '#94a3b8', display: 'block', marginBottom: 2 }}>Téléphone livreur</label>
                    <input
                      type="text"
                      value={courierPhone}
                      onChange={(e) => setCourierPhone(e.target.value)}
                      placeholder="+243..."
                      style={{ width: '100%', padding: '6px 8px', borderRadius: 4, border: '1px solid #334155', backgroundColor: '#0f172a', color: '#fff', fontSize: 13 }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: 11, color: '#94a3b8', display: 'block', marginBottom: 2 }}>Notes d’assignation</label>
                    <input
                      type="text"
                      value={courierNotes}
                      onChange={(e) => setCourierNotes(e.target.value)}
                      placeholder="Instructions internes pour le livreur..."
                      style={{ width: '100%', padding: '6px 8px', borderRadius: 4, border: '1px solid #334155', backgroundColor: '#0f172a', color: '#fff', fontSize: 13 }}
                    />
                  </div>
                  <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                    <button
                      type="button"
                      disabled={assigning || !courierName.trim()}
                      onClick={handleAssignCourier}
                      style={{ backgroundColor: '#10b981', color: '#fff', border: 'none', borderRadius: 6, padding: '6px 12px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
                    >
                      {assigning ? 'Assignation...' : 'Confirmer l’assignation'}
                    </button>
                    <button
                      type="button"
                      onClick={() => { setShowAssign(false); setAssignError('') }}
                      style={{ backgroundColor: '#334155', color: '#fff', border: 'none', borderRadius: 6, padding: '6px 12px', fontSize: 12, cursor: 'pointer' }}
                    >
                      Annuler
                    </button>
                  </div>
                </div>
              )}
            </div>
          </Section>

          <Section title={t('admin.orders.customerTitle')}>
            <Field label={t('common.name')} value={order.order.buyer_name} />
            <Field label={t('admin.orders.fieldPhone')} value={order.order.buyer_phone} />
          </Section>

          <Section title={t('admin.orders.shopTitle')}>
            <Field label={t('admin.orders.fieldShopName')} value={order.order.shop_name} />
            <Field label={t('admin.orders.fieldBusiness')} value={order.order.business_name} />
          </Section>
        </div>

        <div>
          <Section title={t('admin.orders.itemsTitle', { count: (order.lines ?? []).length })}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {(order.lines ?? []).map((item) => (
                <div key={item.id} style={{ display: 'flex', gap: 12, padding: 10, backgroundColor: '#1e293b', borderRadius: 8, alignItems: 'center' }}>
                  <div style={{ width: 48, height: 48, borderRadius: 6, backgroundColor: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, color: '#64748b', flexShrink: 0 }}>📦</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#f8fafc' }}>{item.product_name || t('admin.common.notAvailable')}</div>
                    <div style={{ fontSize: 11, color: '#94a3b8' }}>{t('admin.orders.qty', { count: item.quantity })}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#f8fafc' }}>${(item.final_unit_price * item.quantity).toFixed(2)}</div>
                    <div style={{ fontSize: 11, color: '#94a3b8' }}>{t('admin.orders.each', { price: `$${item.final_unit_price.toFixed(2)}` })}</div>
                  </div>
                </div>
              ))}
            </div>
          </Section>

          {(order.status_history ?? []).length > 0 && (
            <Section title={t('admin.orders.timelineTitle')}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {(order.status_history ?? []).map((event) => (
                  <div key={event.id} style={{ display: 'flex', gap: 10, padding: 8, backgroundColor: '#1e293b', borderRadius: 6 }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#10b981', marginTop: 5, flexShrink: 0 }} />
                    <div>
                      <div style={{ fontSize: 13, color: '#f8fafc' }}>{event.status}</div>
                      {event.notes && <div style={{ fontSize: 12, color: '#94a3b8' }}>{event.notes}</div>}
                      <div style={{ fontSize: 11, color: '#64748b' }}>{new Date(event.created_at).toLocaleString()}</div>
                    </div>
                  </div>
                ))}
              </div>
            </Section>
          )}
        </div>
      </div>
    </div>
  )
}
