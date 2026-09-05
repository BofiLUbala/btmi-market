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

  useEffect(() => {
    if (!id) return
    setLoading(true)
    adminCommerceApi.getOrder(id)
      .then(setOrder)
      .catch(() => navigate('/admin/commerce/orders'))
      .finally(() => setLoading(false))
  }, [id, navigate])

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
