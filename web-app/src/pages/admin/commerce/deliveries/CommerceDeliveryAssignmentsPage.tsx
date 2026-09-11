import { useState, useEffect, useCallback } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  adminCommerceApi,
  type AdminOrderItem,
  type AdminUserListItem,
  type AdminOrderDetail,
  type AdminDeliveryHandover
} from '@/api/admin'
import { useT } from '@/store/i18n'

type DeliveryStatusFilter = 'ALL' | 'READY_FOR_PICKUP' | 'COURIER_ASSIGNED' | 'PICKED_UP' | 'IN_TRANSIT' | 'RECEIVED'

export default function CommerceDeliveryAssignmentsPage() {
  const t = useT()
  const [searchParams] = useSearchParams()
  const initialCourierId = searchParams.get('courier_id') || ''

  const [orders, setOrders] = useState<AdminOrderItem[]>([])
  const [couriers, setCouriers] = useState<AdminUserListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [activeTab, setActiveTab] = useState<DeliveryStatusFilter>('ALL')

  // Modal / Drawer states
  const [assigningOrder, setAssigningOrder] = useState<AdminOrderItem | null>(null)
  const [selectedCourierId, setSelectedCourierId] = useState(initialCourierId)
  const [notes, setNotes] = useState('')

  // Operational detail drawer
  const [detailOrder, setDetailOrder] = useState<AdminOrderItem | null>(null)
  const [fullOrderDetail, setFullOrderDetail] = useState<AdminOrderDetail | null>(null)
  const [handoverDetail, setHandoverDetail] = useState<AdminDeliveryHandover | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)

  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const [orderRes, courierRes] = await Promise.all([
        adminCommerceApi.listOrders({
          limit: 100,
        }),
        adminCommerceApi.listOperationalUsers({
          account_type: 'EMPLOYEE',
          status: 'ACTIVE',
          limit: 100,
        }),
      ])
      setOrders(orderRes.orders || [])
      setCouriers(courierRes.users || [])
    } catch (err) {
      console.error('Failed to load dispatch queue data', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchData()
  }, [fetchData])

  // Fetch full detail when an order detail is selected
  const openOperationalDetail = async (order: AdminOrderItem) => {
    setDetailOrder(order)
    setDetailLoading(true)
    try {
      const [detailRes, handoverRes] = await Promise.allSettled([
        adminCommerceApi.getOrder(order.id),
        adminCommerceApi.getDeliveryHandover(order.id)
      ])

      if (detailRes.status === 'fulfilled') setFullOrderDetail(detailRes.value)
      else setFullOrderDetail(null)

      if (handoverRes.status === 'fulfilled') setHandoverDetail(handoverRes.value)
      else setHandoverDetail(null)
    } catch (err) {
      console.error('Failed to load detail', err)
    } finally {
      setDetailLoading(false)
    }
  }

  const handleAssign = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!assigningOrder || !selectedCourierId) return
    setActionLoading(true)
    setMsg(null)
    try {
      await adminCommerceApi.assignCourier(assigningOrder.id, {
        courier_id: selectedCourierId,
        notes: notes || undefined,
      })
      setMsg({
        type: 'success',
        text: `Livreur assigné avec succès à la commande #${assigningOrder.order_number}`
      })
      setAssigningOrder(null)
      setNotes('')
      await fetchData()
    } catch (err) {
      setMsg({ type: 'error', text: err instanceof Error ? err.message : 'Échec de l\'assignation' })
    } finally {
      setActionLoading(false)
    }
  }

  // Filter orders based on active status tab and search query
  const filteredOrders = orders.filter((o) => {
    // Status tab filter
    if (activeTab !== 'ALL') {
      const status = (o.delivery_status || o.status || '').toUpperCase()
      if (activeTab === 'READY_FOR_PICKUP' && !status.includes('READY')) return false
      if (activeTab === 'COURIER_ASSIGNED' && status !== 'COURIER_ASSIGNED') return false
      if (activeTab === 'PICKED_UP' && status !== 'PICKED_UP') return false
      if (activeTab === 'IN_TRANSIT' && status !== 'IN_TRANSIT') return false
      if (activeTab === 'RECEIVED' && status !== 'RECEIVED' && status !== 'DELIVERED') return false
    }

    // Search query filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      const matchesNum = o.order_number.toLowerCase().includes(q)
      const matchesShop = (o.shop_name || '').toLowerCase().includes(q)
      const matchesBuyer = (o.buyer_name || '').toLowerCase().includes(q)
      const matchesPhone = (o.delivery_phone || o.buyer_phone || '').toLowerCase().includes(q)
      if (!matchesNum && !matchesShop && !matchesBuyer && !matchesPhone) return false
    }
    return true
  })

  // Quick stats counters
  const countReady = orders.filter(o => (o.delivery_status || o.status || '').includes('READY')).length
  const countAssigned = orders.filter(o => o.delivery_status === 'COURIER_ASSIGNED').length
  const countInTransit = orders.filter(o => o.delivery_status === 'IN_TRANSIT' || o.delivery_status === 'PICKED_UP').length

  const getStatusBadge = (order: AdminOrderItem) => {
    const status = order.delivery_status || order.status || 'PENDING'
    let bg = 'rgba(148, 163, 184, 0.15)'
    let fg = '#94a3b8'
    let label = status

    if (status.includes('READY')) {
      bg = 'rgba(234, 179, 8, 0.15)'
      fg = '#eab308'
      label = 'Prêt au retrait'
    } else if (status === 'COURIER_ASSIGNED') {
      bg = 'rgba(99, 102, 241, 0.15)'
      fg = '#818cf8'
      label = 'Livreur assigné'
    } else if (status === 'PICKED_UP') {
      bg = 'rgba(14, 165, 233, 0.15)'
      fg = '#38bdf8'
      label = 'Colis récupéré'
    } else if (status === 'IN_TRANSIT') {
      bg = 'rgba(168, 85, 247, 0.15)'
      fg = '#c084fc'
      label = 'En acheminement'
    } else if (status === 'RECEIVED' || status === 'DELIVERED') {
      bg = 'rgba(34, 197, 94, 0.15)'
      fg = '#4ade80'
      label = 'Livré / Reçu'
    }

    return (
      <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 6, backgroundColor: bg, color: fg, display: 'inline-block' }}>
        {label}
      </span>
    )
  }

  return (
    <div style={{ color: 'var(--admin-text)' }}>
      {/* Header section */}
      <div style={{ marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 800, margin: '0 0 4px', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span>🚚</span> {t('admin.commerce.dispatchQueueTitle') || 'Assignations & Supervision des Livraisons'}
          </h2>
          <p style={{ color: 'var(--admin-text-muted)', fontSize: 13, margin: 0 }}>
            {t('admin.commerce.dispatchQueueSubtitle') || 'Affectation des livreurs, suivi des trajets et supervision de la remise de colis TBK.'}
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
            📦 Tous les Colis
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
            🛵 Gestion Livreurs
          </Link>
        </div>
      </div>

      {/* Operational KPI summary pills */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 20 }}>
        <div style={{ backgroundColor: 'var(--admin-surface)', border: '1px solid var(--admin-border-soft)', borderRadius: 10, padding: '14px 16px' }}>
          <div style={{ fontSize: 12, color: 'var(--admin-text-muted)', fontWeight: 600 }}>En attente d'assignation</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: '#eab308', marginTop: 4 }}>{countReady}</div>
        </div>
        <div style={{ backgroundColor: 'var(--admin-surface)', border: '1px solid var(--admin-border-soft)', borderRadius: 10, padding: '14px 16px' }}>
          <div style={{ fontSize: 12, color: 'var(--admin-text-muted)', fontWeight: 600 }}>Livreurs Assignés</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: '#818cf8', marginTop: 4 }}>{countAssigned}</div>
        </div>
        <div style={{ backgroundColor: 'var(--admin-surface)', border: '1px solid var(--admin-border-soft)', borderRadius: 10, padding: '14px 16px' }}>
          <div style={{ fontSize: 12, color: 'var(--admin-text-muted)', fontWeight: 600 }}>En Cours d'Acheminement</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: '#c084fc', marginTop: 4 }}>{countInTransit}</div>
        </div>
        <div style={{ backgroundColor: 'var(--admin-surface)', border: '1px solid var(--admin-border-soft)', borderRadius: 10, padding: '14px 16px' }}>
          <div style={{ fontSize: 12, color: 'var(--admin-text-muted)', fontWeight: 600 }}>Livreurs Disponibles</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: '#4ade80', marginTop: 4 }}>{couriers.length}</div>
        </div>
      </div>

      {/* Alert message if any */}
      {msg && (
        <div style={{
          padding: '12px 16px',
          borderRadius: 8,
          marginBottom: 16,
          fontSize: 13,
          fontWeight: 600,
          backgroundColor: msg.type === 'success' ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)',
          color: msg.type === 'success' ? '#4ade80' : '#f87171',
          border: `1px solid ${msg.type === 'success' ? '#22c55e' : '#ef4444'}`
        }}>
          {msg.text}
        </div>
      )}

      {/* Filter tabs and Search Bar */}
      <div style={{ backgroundColor: 'var(--admin-surface)', borderRadius: 10, border: '1px solid var(--admin-border-soft)', padding: 14, marginBottom: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4 }}>
          {[
            { id: 'ALL', label: 'Toutes les commandes' },
            { id: 'READY_FOR_PICKUP', label: '⚡ Prêtes au retrait' },
            { id: 'COURIER_ASSIGNED', label: '🛵 Livreur Assigné' },
            { id: 'PICKED_UP', label: '📦 Récupérées' },
            { id: 'IN_TRANSIT', label: '🚀 En transit' },
            { id: 'RECEIVED', label: '✅ Livrées' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as DeliveryStatusFilter)}
              style={{
                padding: '6px 14px',
                borderRadius: 8,
                fontSize: 12,
                fontWeight: 700,
                border: 'none',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                backgroundColor: activeTab === tab.id ? 'var(--admin-primary)' : 'var(--admin-surface-2)',
                color: activeTab === tab.id ? '#ffffff' : 'var(--admin-text-muted)',
                transition: 'all 0.15s ease'
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 12 }}>
          <input
            type="text"
            placeholder="Rechercher par N° commande, Boutique, Client ou Téléphone..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              flex: 1,
              padding: '9px 14px',
              borderRadius: 8,
              border: '1px solid var(--admin-border)',
              backgroundColor: 'var(--admin-surface-2)',
              color: 'var(--admin-text)',
              fontSize: 13
            }}
          />
        </div>
      </div>

      {/* Orders Table */}
      {loading ? (
        <div style={{ padding: 48, textAlign: 'center', color: 'var(--admin-text-muted)' }}>
          <div className="spinner" style={{ width: 32, height: 32, margin: '0 auto 12px' }} />
          Chargement de la file d'attente de livraison...
        </div>
      ) : filteredOrders.length === 0 ? (
        <div style={{ padding: 48, textAlign: 'center', color: 'var(--admin-text-muted)', backgroundColor: 'var(--admin-surface)', borderRadius: 10, border: '1px solid var(--admin-border-soft)' }}>
          Aucune commande correspondant aux critères de livraison.
        </div>
      ) : (
        <div style={{ overflowX: 'auto', backgroundColor: 'var(--admin-surface)', borderRadius: 10, border: '1px solid var(--admin-border-soft)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--admin-border)', backgroundColor: 'var(--admin-surface-2)' }}>
                <th style={{ textAlign: 'left', padding: '12px 14px', color: 'var(--admin-text-muted)', fontWeight: 600 }}>Commande</th>
                <th style={{ textAlign: 'left', padding: '12px 14px', color: 'var(--admin-text-muted)', fontWeight: 600 }}>Boutique (Retrait)</th>
                <th style={{ textAlign: 'left', padding: '12px 14px', color: 'var(--admin-text-muted)', fontWeight: 600 }}>Client & Destination</th>
                <th style={{ textAlign: 'center', padding: '12px 14px', color: 'var(--admin-text-muted)', fontWeight: 600 }}>Statut Livraison</th>
                <th style={{ textAlign: 'left', padding: '12px 14px', color: 'var(--admin-text-muted)', fontWeight: 600 }}>Livreur Assigné</th>
                <th style={{ textAlign: 'right', padding: '12px 14px', color: 'var(--admin-text-muted)', fontWeight: 600 }}>Actions Opérationnelles</th>
              </tr>
            </thead>
            <tbody>
              {filteredOrders.map((o) => {
                const assignedCourier = couriers.find(c => c.id === o.assigned_courier_id)
                return (
                  <tr key={o.id} style={{ borderBottom: '1px solid var(--admin-border-soft)' }}>
                    <td style={{ padding: '12px 14px' }}>
                      <div style={{ fontWeight: 800, color: 'var(--admin-text)' }}>#{o.order_number}</div>
                      <div style={{ fontSize: 11, color: 'var(--admin-text-muted)' }}>
                        {new Date(o.created_at).toLocaleString()}
                      </div>
                      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--admin-primary)', marginTop: 2 }}>
                        {(o.final_total || 0).toLocaleString()} XAF
                      </div>
                    </td>

                    <td style={{ padding: '12px 14px' }}>
                      <div style={{ fontWeight: 700, color: 'var(--admin-text)' }}>{o.shop_name}</div>
                      <div style={{ fontSize: 11, color: 'var(--admin-text-muted)' }}>{o.business_name}</div>
                    </td>

                    <td style={{ padding: '12px 14px' }}>
                      <div style={{ fontWeight: 700, color: 'var(--admin-text)' }}>{o.buyer_name || o.delivery_contact_name || 'Client TBK'}</div>
                      <div style={{ fontSize: 11, color: 'var(--admin-text-muted)' }}>📞 {o.delivery_phone || o.buyer_phone || '-'}</div>
                      <div style={{ fontSize: 11, color: 'var(--admin-text-muted)', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={o.delivery_address}>
                        📍 {o.delivery_address || 'Adresse non spécifiée'}
                      </div>
                    </td>

                    <td style={{ textAlign: 'center', padding: '12px 14px' }}>
                      {getStatusBadge(o)}
                    </td>

                    <td style={{ padding: '12px 14px' }}>
                      {assignedCourier ? (
                        <div>
                          <div style={{ fontWeight: 700, color: '#818cf8', display: 'flex', alignItems: 'center', gap: 4 }}>
                            <span>🛵</span> {assignedCourier.first_name} {assignedCourier.last_name}
                          </div>
                          <div style={{ fontSize: 11, color: 'var(--admin-text-muted)' }}>{assignedCourier.email}</div>
                        </div>
                      ) : (
                        <span style={{ fontSize: 12, color: 'var(--admin-text-muted)', fontStyle: 'italic' }}>
                          Non assigné
                        </span>
                      )}
                    </td>

                    <td style={{ textAlign: 'right', padding: '12px 14px' }}>
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6, flexWrap: 'wrap' }}>
                        <button
                          onClick={() => openOperationalDetail(o)}
                          style={{
                            padding: '6px 10px',
                            borderRadius: 6,
                            border: '1px solid var(--admin-border)',
                            backgroundColor: 'var(--admin-surface-2)',
                            color: 'var(--admin-text)',
                            fontSize: 11,
                            fontWeight: 700,
                            cursor: 'pointer'
                          }}
                        >
                          👁️ Fiche Livreur
                        </button>
                        <button
                          onClick={() => {
                            setAssigningOrder(o)
                            setSelectedCourierId(o.assigned_courier_id || (couriers[0]?.id || ''))
                            setNotes(o.courier_notes || '')
                          }}
                          style={{
                            padding: '6px 12px',
                            borderRadius: 6,
                            border: 'none',
                            backgroundColor: o.assigned_courier_id ? '#312e81' : 'var(--admin-primary)',
                            color: '#ffffff',
                            fontSize: 11,
                            fontWeight: 700,
                            cursor: 'pointer'
                          }}
                        >
                          {o.assigned_courier_id ? '🔄 Réassigner' : '🛵 Assigner'}
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Courier Assignment Modal */}
      {assigningOrder && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.75)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 1000, padding: 16
        }}>
          <div style={{
            backgroundColor: 'var(--admin-surface)',
            border: '1px solid var(--admin-border)',
            borderRadius: 12, padding: 24, maxWidth: 520, width: '100%',
            color: 'var(--admin-text)', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.5)'
          }}>
            <h3 style={{ fontSize: 18, fontWeight: 800, margin: '0 0 8px', display: 'flex', alignItems: 'center', gap: 8 }}>
              <span>🛵</span> {assigningOrder.assigned_courier_id ? 'Réassigner la livraison' : 'Assigner un livreur'} #{assigningOrder.order_number}
            </h3>
            <p style={{ fontSize: 13, color: 'var(--admin-text-muted)', marginBottom: 16 }}>
              Boutique: <strong>{assigningOrder.shop_name}</strong> • Client: <strong>{assigningOrder.buyer_name || assigningOrder.delivery_contact_name}</strong>
            </p>

            <form onSubmit={handleAssign}>
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 6, color: 'var(--admin-text-muted)' }}>
                  Sélectionner un livreur actif *
                </label>
                <select
                  required
                  value={selectedCourierId}
                  onChange={(e) => setSelectedCourierId(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: 8,
                    border: '1px solid var(--admin-border)',
                    backgroundColor: 'var(--admin-surface-2)',
                    color: 'var(--admin-text)',
                    fontSize: 13,
                    fontWeight: 600
                  }}
                >
                  <option value="">-- Sélectionner un livreur --</option>
                  {couriers.map((c) => (
                    <option key={c.id} value={c.id}>
                      🛵 {c.first_name} {c.last_name} ({c.email}) - ACTIF
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ marginBottom: 20 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 6, color: 'var(--admin-text-muted)' }}>
                  Consignes et instructions de livraison (Optionnel)
                </label>
                <textarea
                  rows={3}
                  placeholder="Ex: Colis fragile, téléphoner au client 10 min avant, code portail 45B..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
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
                  onClick={() => setAssigningOrder(null)}
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
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={actionLoading || !selectedCourierId}
                  style={{
                    padding: '8px 18px',
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
                  {actionLoading ? 'Assignation...' : 'Confirmer l\'assignation'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Complete Operational Detail Drawer / Modal */}
      {detailOrder && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.8)',
          display: 'flex', justifyContent: 'flex-end',
          zIndex: 1100
        }}>
          <div style={{
            backgroundColor: 'var(--admin-surface)',
            borderLeft: '1px solid var(--admin-border)',
            maxWidth: 600, width: '100%', height: '100%',
            display: 'flex', flexDirection: 'column',
            color: 'var(--admin-text)', overflowY: 'auto'
          }}>
            {/* Drawer Header */}
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--admin-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ fontSize: 18, fontWeight: 800, margin: 0 }}>
                  Fiche Opérationnelle Livreur #{detailOrder.order_number}
                </h3>
                <span style={{ fontSize: 12, color: 'var(--admin-text-muted)' }}>
                  Statut: {detailOrder.delivery_status || detailOrder.status}
                </span>
              </div>
              <button
                onClick={() => setDetailOrder(null)}
                style={{
                  padding: '6px 12px', borderRadius: 6,
                  border: '1px solid var(--admin-border)',
                  backgroundColor: 'var(--admin-surface-2)',
                  color: 'var(--admin-text)', fontWeight: 700, cursor: 'pointer'
                }}
              >
                ✕ Fermer
              </button>
            </div>

            {/* Drawer Content */}
            <div style={{ padding: 20, flex: 1, display: 'flex', flexDirection: 'column', gap: 20 }}>
              {detailLoading ? (
                <div style={{ padding: 40, textAlign: 'center', color: 'var(--admin-text-muted)' }}>
                  Chargement des détails opérationnels...
                </div>
              ) : (
                <>
                  {/* BUYER / DESTINATION DETAILS */}
                  <div style={{ backgroundColor: 'var(--admin-surface-2)', borderRadius: 10, padding: 16, border: '1px solid var(--admin-border-soft)' }}>
                    <h4 style={{ fontSize: 14, fontWeight: 800, margin: '0 0 12px', color: '#38bdf8', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span>👤</span> INFORMATIONS ACHETEUR & DESTINATION
                    </h4>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, fontSize: 13 }}>
                      <div>
                        <div style={{ fontSize: 11, color: 'var(--admin-text-muted)' }}>Nom du Destinataire</div>
                        <div style={{ fontWeight: 700 }}>{detailOrder.delivery_contact_name || detailOrder.buyer_name || 'Client TBK'}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: 11, color: 'var(--admin-text-muted)' }}>Téléphone Contact</div>
                        <div style={{ fontWeight: 700 }}>📞 {detailOrder.delivery_phone || detailOrder.buyer_phone || '-'}</div>
                      </div>
                      <div style={{ gridColumn: 'span 2' }}>
                        <div style={{ fontSize: 11, color: 'var(--admin-text-muted)' }}>Adresse complète de Livraison</div>
                        <div style={{ fontWeight: 700, marginTop: 2 }}>📍 {detailOrder.delivery_address || 'Aucune adresse enregistrée'}</div>
                      </div>
                      {detailOrder.delivery_notes && (
                        <div style={{ gridColumn: 'span 2', backgroundColor: 'rgba(234, 179, 8, 0.1)', padding: 10, borderRadius: 6, border: '1px solid rgba(234, 179, 8, 0.3)' }}>
                          <div style={{ fontSize: 11, color: '#eab308', fontWeight: 700 }}>Instructions particulières:</div>
                          <div style={{ fontSize: 12, color: 'var(--admin-text)', marginTop: 2 }}>{detailOrder.delivery_notes}</div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* SHOP / PICKUP DETAILS */}
                  <div style={{ backgroundColor: 'var(--admin-surface-2)', borderRadius: 10, padding: 16, border: '1px solid var(--admin-border-soft)' }}>
                    <h4 style={{ fontSize: 14, fontWeight: 800, margin: '0 0 12px', color: '#a7f3d0', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span>🏬</span> POINT DE RETRAIT / BOUTIQUE
                    </h4>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, fontSize: 13 }}>
                      <div>
                        <div style={{ fontSize: 11, color: 'var(--admin-text-muted)' }}>Entreprise / Vendeur</div>
                        <div style={{ fontWeight: 700 }}>{detailOrder.business_name}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: 11, color: 'var(--admin-text-muted)' }}>Boutique</div>
                        <div style={{ fontWeight: 700 }}>{detailOrder.shop_name}</div>
                      </div>
                    </div>
                  </div>

                  {/* PRODUCTS / PACKAGE CONTENT */}
                  <div style={{ backgroundColor: 'var(--admin-surface-2)', borderRadius: 10, padding: 16, border: '1px solid var(--admin-border-soft)' }}>
                    <h4 style={{ fontSize: 14, fontWeight: 800, margin: '0 0 12px', color: '#c084fc', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span>📦</span> PRODUITS & CONTENU DU COLIS
                    </h4>
                    {fullOrderDetail?.lines && fullOrderDetail.lines.length > 0 ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {fullOrderDetail.lines.map((line) => (
                          <div key={line.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12, borderBottom: '1px solid var(--admin-border-soft)', paddingBottom: 6 }}>
                            <div>
                              <span style={{ fontWeight: 700 }}>{line.product_name}</span>
                              <span style={{ color: 'var(--admin-text-muted)', marginLeft: 6 }}>x{line.quantity}</span>
                            </div>
                            <div style={{ fontWeight: 700 }}>{(line.final_unit_price * line.quantity).toLocaleString()} XAF</div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div style={{ fontSize: 12, color: 'var(--admin-text-muted)' }}>
                        Nombre total d'articles: <strong>{detailOrder.total_items}</strong>
                      </div>
                    )}
                  </div>

                  {/* QR HANDOVER & AUDIT TRAIL */}
                  {handoverDetail && (
                    <div style={{ backgroundColor: 'var(--admin-surface-2)', borderRadius: 10, padding: 16, border: '1px solid var(--admin-border-soft)' }}>
                      <h4 style={{ fontSize: 14, fontWeight: 800, margin: '0 0 12px', color: '#fde047', display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span>🔍</span> HISTORIQUE DES SCANS ET AUDIT QR
                      </h4>
                      {handoverDetail.events && handoverDetail.events.length > 0 ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                          {handoverDetail.events.map((ev) => (
                            <div key={ev.id} style={{ fontSize: 12, padding: 8, backgroundColor: 'var(--admin-surface)', borderRadius: 6, border: '1px solid var(--admin-border-soft)' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700 }}>
                                <span>TYPE: {ev.scan_type}</span>
                                <span style={{ color: ev.scan_result === 'SUCCESS' ? '#4ade80' : '#f87171' }}>{ev.scan_result}</span>
                              </div>
                              <div style={{ fontSize: 11, color: 'var(--admin-text-muted)', marginTop: 4 }}>
                                Horodatage: {new Date(ev.created_at).toLocaleString()}
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div style={{ fontSize: 12, color: 'var(--admin-text-muted)' }}>
                          Aucun événement de scan enregistré pour le moment.
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
