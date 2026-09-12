import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { adminCommerceApi, type AdminOrderDetail, type AdminDeliveryHandover } from '@/api/admin'
import { OrderChatFeed } from '@/components/communication/OrderChatFeed'
import { useT } from '@/store/i18n'
import { BoxIcon } from '@/components/ui/Icons'
import { AdminStatusBadge as StatusBadge } from '@/components/admin/AdminStatusBadge'

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
  const [courierId, setCourierId] = useState('')
  const [courierNotes, setCourierNotes] = useState('')
  const [showAssign, setShowAssign] = useState(false)
  const [assigning, setAssigning] = useState(false)
  const [assignError, setAssignError] = useState('')
  const [handover, setHandover] = useState<AdminDeliveryHandover | null>(null)

  useEffect(() => {
    if (!id) return
    setLoading(true)
    adminCommerceApi.getOrder(id)
      .then((res) => setOrder(res))
      .catch(() => navigate('/admin/commerce/orders'))
      .finally(() => setLoading(false))
    // The handover view is supplementary: an order without a package yet must still render.
    adminCommerceApi.getDeliveryHandover(id).then(setHandover).catch(() => setHandover(null))
  }, [id, navigate])

  async function handleAssignCourier() {
    if (!id || !courierId.trim()) return
    setAssigning(true)
    setAssignError('')
    try {
      await adminCommerceApi.assignCourier(id, {
        courier_id: courierId.trim(),
        notes: courierNotes.trim() || undefined,
      })
      const refreshed = await adminCommerceApi.getOrder(id)
      setOrder(refreshed)
      setShowAssign(false)
      setCourierId('')
      setCourierNotes('')
    } catch (e: any) {
      setAssignError(e?.message || t('admin.orders.assignCourierFailed'))
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
          <StatusBadge status={order.order.status} />
          <StatusBadge status={order.order.payment_status} />
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
            <Field label={t('admin.orders.fieldPaymentStatus')} value={<StatusBadge status={order.order.payment_status} />} />
            <Field label={t('admin.orders.fieldDeliveryMethod')} value={order.order.delivery_method || t('admin.common.notAvailable')} />
            {order.order.is_stuck && <Field label={t('admin.orders.fieldStuckReason')} value={order.order.stuck_reason || t('admin.orders.stuckReasonDefault')} />}
          </Section>

          <Section title={t('admin.orders.deliveryTitle')}>
            <Field label={t('admin.orders.deliveryStatus')} value={<StatusBadge status={order.order.delivery_status || 'PENDING_TBK_ASSIGNMENT'} />} />
            <Field label={t('admin.orders.deliveryMethodLabel')} value={order.order.delivery_method || 'TBK_STANDARD'} />
            <Field label={t('admin.orders.deliveryContact')} value={order.order.delivery_contact_name || order.order.buyer_name} />
            <Field label={t('admin.orders.deliveryPhone')} value={order.order.delivery_phone || order.order.buyer_phone} />
            <Field label={t('admin.orders.deliveryAddress')} value={order.order.delivery_address || '-'} />
            {order.order.delivery_notes && <Field label={t('admin.orders.deliveryCustomerNotes')} value={order.order.delivery_notes} />}
            {order.order.assigned_courier_id && (
              <>
                <Field label={t('admin.orders.assignedCourierId')} value={order.order.assigned_courier_id} />
                {order.order.courier_assigned_at && (
                  <Field label={t('admin.orders.assignedAt')} value={new Date(order.order.courier_assigned_at).toLocaleString()} />
                )}
                {order.order.courier_notes && <Field label={t('admin.orders.courierNotes')} value={order.order.courier_notes} />}
              </>
            )}

            <div style={{ marginTop: 12, borderTop: '1px solid #1e293b', paddingTop: 12 }}>
              {!showAssign ? (
                <button
                  type="button"
                  onClick={() => setShowAssign(true)}
                  style={{ backgroundColor: '#2563eb', color: '#fff', border: 'none', borderRadius: 6, padding: '6px 12px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
                >
                  {order.order.assigned_courier_id ? t('admin.orders.changeCourier') : t('admin.orders.assignCourier')}
                </button>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, backgroundColor: '#020617', padding: 12, borderRadius: 8 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#93c5fd' }}>{t('admin.orders.assignCourierFormTitle')}</div>
                  <div style={{ fontSize: 11, color: '#f59e0b', backgroundColor: '#451a03', padding: '6px 8px', borderRadius: 6 }}>
                    {t('admin.orders.noCourierDirectoryNotice')}
                  </div>
                  {assignError && <div style={{ color: '#ef4444', fontSize: 12 }}>{assignError}</div>}
                  <div>
                    <label style={{ fontSize: 11, color: '#94a3b8', display: 'block', marginBottom: 2 }}>{t('admin.orders.courierIdLabel')}</label>
                    <input
                      type="text"
                      value={courierId}
                      onChange={(e) => setCourierId(e.target.value)}
                      placeholder={t('admin.orders.courierIdPlaceholder')}
                      style={{ width: '100%', padding: '6px 8px', borderRadius: 4, border: '1px solid #334155', backgroundColor: '#0f172a', color: '#fff', fontSize: 13, fontFamily: 'monospace' }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: 11, color: '#94a3b8', display: 'block', marginBottom: 2 }}>{t('admin.orders.assignNotesLabel')}</label>
                    <input
                      type="text"
                      value={courierNotes}
                      onChange={(e) => setCourierNotes(e.target.value)}
                      placeholder={t('admin.orders.assignNotesPlaceholder')}
                      style={{ width: '100%', padding: '6px 8px', borderRadius: 4, border: '1px solid #334155', backgroundColor: '#0f172a', color: '#fff', fontSize: 13 }}
                    />
                  </div>
                  <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                    <button
                      type="button"
                      disabled={assigning || !courierId.trim()}
                      onClick={handleAssignCourier}
                      style={{ backgroundColor: '#10b981', color: '#fff', border: 'none', borderRadius: 6, padding: '6px 12px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
                    >
                      {assigning ? t('admin.orders.assigning') : t('admin.orders.confirmAssign')}
                    </button>
                    <button
                      type="button"
                      onClick={() => { setShowAssign(false); setAssignError('') }}
                      style={{ backgroundColor: '#334155', color: '#fff', border: 'none', borderRadius: 6, padding: '6px 12px', fontSize: 12, cursor: 'pointer' }}
                    >
                      {t('common.cancel')}
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
                  <div style={{ width: 48, height: 48, borderRadius: 6, backgroundColor: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, color: '#64748b', flexShrink: 0 }}><BoxIcon style={{ width: 24, height: 24 }} /></div>
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
          <Section title="Remise sécurisée (QR)">
            {handover?.package ? (
              <>
                <Field label="Référence colis" value={handover.package.reference} />
                <Field label="Colis n°" value={`#${handover.package.package_number}`} />
                <Field
                  label="État du QR"
                  value={`${handover.package.status}${handover.package.operational ? ' · opérationnel' : ' · non opérationnel'}`}
                />
                <Field label="Livreur assigné" value={handover.assigned_courier_id || 'Non assigné'} />
                <Field
                  label="Scan de récupération"
                  value={handover.package.pickup_verified_at ? new Date(handover.package.pickup_verified_at).toLocaleString() : 'En attente'}
                />
                <Field
                  label="Scan de livraison"
                  value={handover.package.delivery_scanned_at ? new Date(handover.package.delivery_scanned_at).toLocaleString() : 'En attente'}
                />
                <Field
                  label="Réception confirmée"
                  value={handover.package.receipt_confirmed_at ? new Date(handover.package.receipt_confirmed_at).toLocaleString() : 'En attente'}
                />
                <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>
                  La réception de la marchandise est indépendante de la vérification du paiement en espèces.
                </div>
              </>
            ) : (
              <div style={{ fontSize: 13, color: '#94a3b8' }}>Aucun colis QR généré pour cette commande.</div>
            )}
          </Section>

          {(handover?.events ?? []).length > 0 && (
            <Section title="Historique des scans">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {(handover?.events ?? []).map((e) => (
                  <div key={e.id} style={{ display: 'flex', gap: 10, padding: 8, backgroundColor: '#1e293b', borderRadius: 6 }}>
                    <div
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        marginTop: 5,
                        flexShrink: 0,
                        backgroundColor:
                          e.scan_result === 'SUCCESS' ? '#10b981' : e.scan_result === 'DUPLICATE' ? '#f59e0b' : '#ef4444',
                      }}
                    />
                    <div>
                      <div style={{ fontSize: 13, color: '#f8fafc' }}>
                        {e.scan_type} · {e.scan_result}
                        {e.reason ? ` (${e.reason})` : ''}
                      </div>
                      {e.courier_id && <div style={{ fontSize: 12, color: '#94a3b8' }}>Livreur {e.courier_id.slice(0, 8)}</div>}
                      {e.status_before && <div style={{ fontSize: 12, color: '#94a3b8' }}>{e.status_before} → {e.status_after || e.status_before}</div>}
                      {e.latitude != null && e.longitude != null && (
                        <div style={{ fontSize: 11, color: '#64748b' }}>
                          {e.latitude.toFixed(5)}, {e.longitude.toFixed(5)}
                        </div>
                      )}
                      <div style={{ fontSize: 11, color: '#64748b' }}>{new Date(e.created_at).toLocaleString()}</div>
                    </div>
                  </div>
                ))}
              </div>
            </Section>
          )}
        </div>
      </div>

      <div style={{ marginTop: 20 }}>
        <Section title="💬 Supervision Dialogue (Buyer ↔ Seller ↔ Admin)">
          <div style={{ height: 500 }}>
            <OrderChatFeed orderId={id!} role="ADMIN" showHeader={false} />
          </div>
        </Section>
      </div>
    </div>
  )
}
