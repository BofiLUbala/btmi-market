import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { adminCommerceApi, type AdminOrderDetail } from '@/api/admin'

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

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>Loading order...</div>
  if (!order) return <div style={{ padding: 40, textAlign: 'center', color: '#dc2626' }}>Order not found</div>

  return (
    <div>
      <button onClick={() => navigate('/admin/commerce/orders')} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: 13, marginBottom: 8 }}>&larr; Back to Orders</button>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 800, margin: '0 0 4px' }}>Order {order.order.order_number}</h2>
          <div style={{ color: '#64748b', fontSize: 12 }}>Placed {new Date(order.order.created_at).toLocaleString()}</div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <Badge status={order.order.fulfillment_status} />
          <Badge status={order.order.payment_status} />
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div>
          <Section title="Order Summary">
            <Field label="Order Number" value={order.order.order_number} />
            <Field label="Total" value={`$${order.order.total.toFixed(2)}`} />
            <Field label="Subtotal" value={`$${order.order.subtotal.toFixed(2)}`} />
            <Field label="Tax" value={`$${order.order.tax.toFixed(2)}`} />
            <Field label="Discount" value={order.order.discount > 0 ? `-$${order.order.discount.toFixed(2)}` : '$0.00'} />
            <Field label="Payment Method" value={order.order.payment_method} />
            <Field label="Payment Status" value={<Badge status={order.order.payment_status} />} />
            <Field label="Delivery Method" value={order.order.delivery_method} />
            {order.order.delivery_address && <Field label="Delivery Address" value={order.order.delivery_address} />}
            {order.order.scheduled_delivery_time && <Field label="Scheduled Delivery" value={order.order.scheduled_delivery_time} />}
          </Section>

          <Section title="Customer">
            <Field label="Name" value={order.order.customer_name} />
            <Field label="Phone" value={order.order.customer_phone} />
            {order.order.customer_email && <Field label="Email" value={order.order.customer_email} />}
            {order.order.points_used > 0 && <Field label="Points Used" value={order.order.points_used} />}
          </Section>

          <Section title="Shop">
            <Field label="Shop Name" value={order.shop_name} />
            <Field label="Business" value={order.business_name} />
          </Section>
        </div>

        <div>
          <Section title={`Items (${order.items.length})`}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {order.items.map((item, idx) => (
                <div key={idx} style={{ display: 'flex', gap: 12, padding: 10, backgroundColor: '#1e293b', borderRadius: 8, alignItems: 'center' }}>
                  {item.product_image ? (
                    <img src={item.product_image} alt="" style={{ width: 48, height: 48, borderRadius: 6, objectFit: 'cover' }} />
                  ) : (
                    <div style={{ width: 48, height: 48, borderRadius: 6, backgroundColor: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, color: '#64748b' }}>📦</div>
                  )}
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#f8fafc' }}>{item.product_name}</div>
                    <div style={{ fontSize: 11, color: '#94a3b8' }}>SKU: {item.sku} &middot; Qty: {item.quantity}</div>
                    {item.variant_name && <div style={{ fontSize: 11, color: '#64748b' }}>{item.variant_name}</div>}
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#f8fafc' }}>${item.line_total.toFixed(2)}</div>
                    <div style={{ fontSize: 11, color: '#94a3b8' }}>${item.unit_price.toFixed(2)} each</div>
                  </div>
                </div>
              ))}
            </div>
          </Section>

          {order.timeline && order.timeline.length > 0 && (
            <Section title="Order Timeline">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {order.timeline.map((event, idx) => (
                  <div key={idx} style={{ display: 'flex', gap: 10, padding: 8, backgroundColor: '#1e293b', borderRadius: 6 }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#10b981', marginTop: 5, flexShrink: 0 }} />
                    <div>
                      <div style={{ fontSize: 13, color: '#f8fafc' }}>{event.status}</div>
                      {event.note && <div style={{ fontSize: 12, color: '#94a3b8' }}>{event.note}</div>}
                      <div style={{ fontSize: 11, color: '#64748b' }}>{new Date(event.timestamp).toLocaleString()}</div>
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
