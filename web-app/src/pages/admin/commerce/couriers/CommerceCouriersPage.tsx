import { useState, useEffect, useCallback } from 'react'
import { adminLabel } from '@/lib/adminLabels'
import { Link } from 'react-router-dom'
import { adminCommerceApi, type AdminCourierInvitationItem, type AdminCourierListItem } from '@/api/admin'
import { useT } from '@/store/i18n'

export default function CommerceCouriersPage() {
  const t = useT()
  const [couriers, setCouriers] = useState<AdminCourierListItem[]>([])
  const [invitations, setInvitations] = useState<AdminCourierInvitationItem[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('')
  const [page, setPage] = useState(0)
  const [limit] = useState(20)
  const [busyId, setBusyId] = useState('')
  const [actionError, setActionError] = useState('')

  const fetchCouriers = useCallback(async () => {
    setLoading(true)
    try {
      const res = await adminCommerceApi.listCouriers({
        limit,
        offset: page * limit,
      })
      setCouriers(res.couriers ?? [])
      setInvitations(res.invitations ?? [])
      setTotal(res.total ?? 0)
    } catch (err) {
      console.error('Failed to load couriers', err)
    } finally {
      setLoading(false)
    }
  }, [page, limit])

  useEffect(() => {
    void fetchCouriers()
  }, [fetchCouriers])

  const handleSuspend = async (courierId: string) => {
    const reason = prompt(t('admin.commerce.suspendReason'))
    if (!reason) return
    try {
      await adminCommerceApi.suspendCourier(courierId, reason)
      fetchCouriers()
    } catch (err) {
      console.error('Failed to suspend courier', err)
    }
  }

  const handleReactivate = async (courierId: string) => {
    try {
      await adminCommerceApi.reactivateCourier(courierId)
      fetchCouriers()
    } catch (err) {
      console.error('Failed to reactivate courier', err)
    }
  }

  const handleCancelInvitation = async (invitation: AdminCourierInvitationItem) => {
    if (!confirm(t('adminCommerceCouriersCommerceCouriersPage.confirmCancelInvitation', { name: `${invitation.first_name} ${invitation.last_name}`, email: invitation.email }))) return
    setActionError('')
    setBusyId(invitation.id)
    try {
      await adminCommerceApi.cancelCourierInvitation(invitation.id)
      await fetchCouriers()
    } catch (err: any) {
      setActionError(err?.message || t('adminCommerceCouriersCommerceCouriersPage.cancelInvitationFailed'))
    } finally {
      setBusyId('')
    }
  }

  const handleDelete = async (courier: AdminCourierListItem) => {
    if (!confirm(t('adminCommerceCouriersCommerceCouriersPage.confirmDelete', { name: `${courier.first_name} ${courier.last_name}`, email: courier.email }))) return
    setActionError('')
    setBusyId(courier.id)
    try {
      await adminCommerceApi.deleteCourier(courier.id)
      await fetchCouriers()
    } catch (err: any) {
      setActionError(err?.message || t('adminCommerceCouriersCommerceCouriersPage.deleteFailed'))
    } finally {
      setBusyId('')
    }
  }

  const totalPages = Math.ceil(total / limit)

  const copyCourierLogin = async () => {
    await navigator.clipboard.writeText(`${window.location.origin}/livreur/login`)
  }

  return (
    <div>
      <div style={{ marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 800, margin: '0 0 4px', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span>🛵</span> {t('admin.commerce.couriersTitle')}
          </h2>
          <p style={{ color: 'var(--admin-text-muted)', fontSize: 13, margin: 0 }}>
            {t('admin.commerce.couriersSubtitle')}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Link
            to="/admin/commerce/couriers/invite"
            style={{
              backgroundColor: 'var(--admin-primary)',
              color: '#ffffff',
              border: 'none',
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
            ✉ {t('admin.commerce.inviteCourier')}
          </Link>
          <Link
            to="/admin/commerce/delivery-assignments"
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
            📋 {t('admin.commerce.assignOrders')}
          </Link>
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
            🚚 {t('admin.commerce.deliveries')}
          </Link>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(0) }}
          style={{
            padding: '8px 12px',
            borderRadius: 8,
            border: '1px solid var(--admin-border)',
            backgroundColor: 'var(--admin-surface)',
            color: 'var(--admin-text)',
            fontSize: 13,
            minWidth: 140
          }}
        >
          <option value="">{t('admin.commerce.allStatuses')}</option>
          <option value="ACTIVE">{t('admin.commerce.statusActive')}</option>
          <option value="PENDING">{t('admin.commerce.statusPending')}</option>
          <option value="SUSPENDED">{t('admin.commerce.statusSuspended')}</option>
          <option value="DISABLED">{t('admin.commerce.statusDisabled')}</option>
        </select>
        <span style={{ color: 'var(--admin-text-muted)', fontSize: 12 }}>
          {total} {t('admin.commerce.courierCount')}
        </span>
      </div>

      {actionError && (
        <div role="alert" style={{ marginBottom: 16, padding: '10px 14px', borderRadius: 8, background: 'var(--admin-danger-soft)', color: 'var(--admin-danger)', fontSize: 13 }}>
          {actionError}
        </div>
      )}

      {invitations.length > 0 && (
        <div style={{ marginBottom: 16, backgroundColor: 'var(--admin-surface)', borderRadius: 10, border: '1px solid var(--admin-border-soft)', padding: 16 }}>
          <h3 style={{ margin: '0 0 12px' }}>{t('adminCommerceCouriersCommerceCouriersPage.pendingInvitations')}</h3>
          {invitations.map((invitation) => (
            <div key={invitation.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap', padding: '10px 0', borderTop: '1px solid var(--admin-border-soft)' }}>
              <div>
                <strong>{invitation.first_name} {invitation.last_name}</strong>
                <div style={{ color: 'var(--admin-text-muted)', fontSize: 12 }}>{invitation.email}</div>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 6, background: 'var(--admin-warning-soft)', color: 'var(--admin-warning)' }}>{t('adminCommerceCouriersCommerceCouriersPage.invitedBadge')}</span>
                <button
                  onClick={() => void handleCancelInvitation(invitation)}
                  disabled={busyId === invitation.id}
                  style={{ fontSize: 12, color: 'var(--admin-danger)', backgroundColor: 'var(--admin-danger-soft)', padding: '4px 10px', borderRadius: 6, border: '1px solid var(--admin-danger-soft)', fontWeight: 600, cursor: busyId === invitation.id ? 'not-allowed' : 'pointer', opacity: busyId === invitation.id ? 0.6 : 1 }}
                >
                  {busyId === invitation.id ? t('adminCommerceCouriersCommerceCouriersPage.cancelling') : t('adminCommerceCouriersCommerceCouriersPage.cancelInvitation')}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {loading ? (
        <div style={{ padding: 48, textAlign: 'center', color: 'var(--admin-text-muted)' }}>
          <div className="spinner" style={{ width: 32, height: 32, margin: '0 auto 12px' }} />
        </div>
      ) : couriers.length === 0 ? (
        <div style={{ padding: 48, textAlign: 'center', color: 'var(--admin-text-muted)', backgroundColor: 'var(--admin-surface)', borderRadius: 10, border: '1px solid var(--admin-border-soft)' }}>
          {t('admin.commerce.noCouriersFound')}
        </div>
      ) : (
        <div style={{ overflowX: 'auto', backgroundColor: 'var(--admin-surface)', borderRadius: 10, border: '1px solid var(--admin-border-soft)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--admin-border)', backgroundColor: 'var(--admin-surface-2)' }}>
                <th style={{ textAlign: 'left', padding: '12px 14px', color: 'var(--admin-text-muted)', fontWeight: 600 }}>{t('admin.commerce.courierName')}</th>
                <th style={{ textAlign: 'left', padding: '12px 14px', color: 'var(--admin-text-muted)', fontWeight: 600 }}>{t('admin.commerce.contactColumn')}</th>
                <th style={{ textAlign: 'center', padding: '12px 14px', color: 'var(--admin-text-muted)', fontWeight: 600 }}>{t('admin.commerce.transportType')}</th>
                <th style={{ textAlign: 'center', padding: '12px 14px', color: 'var(--admin-text-muted)', fontWeight: 600 }}>{t('admin.commerce.availability')}</th>
                <th style={{ textAlign: 'center', padding: '12px 14px', color: 'var(--admin-text-muted)', fontWeight: 600 }}>{t('admin.commerce.totalDeliveries')}</th>
                <th style={{ textAlign: 'center', padding: '12px 14px', color: 'var(--admin-text-muted)', fontWeight: 600 }}>{t('admin.commerce.status')}</th>
                <th style={{ textAlign: 'right', padding: '12px 14px', color: 'var(--admin-text-muted)', fontWeight: 600 }}>{t('admin.common.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {couriers.map((c) => (
                <tr key={c.id} style={{ borderBottom: '1px solid var(--admin-border-soft)' }}>
                  <td style={{ padding: '12px 14px' }}>
                    <div style={{ fontWeight: 700, color: 'var(--admin-text)' }}>
                      {c.first_name} {c.last_name}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--admin-text-faint)' }}>{t('adminCommerceCouriersCommerceCouriersPage.idShort', { id: c.id.slice(0, 8) })}</div>
                  </td>
                  <td style={{ padding: '12px 14px' }}>
                    <div style={{ color: 'var(--admin-text)' }}>{c.email}</div>
                    <div style={{ fontSize: 11, color: 'var(--admin-text-muted)' }}>{c.phone || '—'}</div>
                  </td>
                  <td style={{ textAlign: 'center', padding: '12px 14px' }}>
                    <span style={{
                      fontSize: 11,
                      fontWeight: 700,
                      padding: '2px 8px',
                      borderRadius: 6,
                      backgroundColor: 'var(--admin-surface-2)',
                      color: 'var(--admin-text)'
                    }}>
                      {c.transport_type ? adminLabel(c.transport_type) : t('admin.common.notAvailable')}
                    </span>
                  </td>
                  <td style={{ textAlign: 'center', padding: '12px 14px' }}>
                    <span style={{
                      fontSize: 11,
                      fontWeight: 700,
                      padding: '2px 8px',
                      borderRadius: 6,
                      backgroundColor: c.availability === 'AVAILABLE' ? 'var(--admin-success-soft)' : c.availability === 'BUSY' ? 'var(--admin-warning-soft)' : 'var(--admin-surface-2)',
                      color: c.availability === 'AVAILABLE' ? 'var(--admin-success)' : c.availability === 'BUSY' ? 'var(--admin-warning)' : 'var(--admin-text-muted)'
                    }}>
                      {c.availability ? adminLabel(c.availability) : t('admin.common.notAvailable')}
                    </span>
                  </td>
                  <td style={{ textAlign: 'center', padding: '12px 14px' }}>
                    <span style={{ fontWeight: 700, color: 'var(--admin-text)' }}>
                      {c.total_deliveries} / {c.successful_deliveries}
                    </span>
                  </td>
                  <td style={{ textAlign: 'center', padding: '12px 14px' }}>
                    <span style={{
                      fontSize: 11,
                      fontWeight: 700,
                      padding: '2px 8px',
                      borderRadius: 6,
                      backgroundColor: c.status === 'ACTIVE' ? 'var(--admin-success-soft)' : c.status === 'SUSPENDED' ? 'var(--admin-danger-soft)' : 'var(--admin-surface-2)',
                      color: c.status === 'ACTIVE' ? 'var(--admin-success)' : c.status === 'SUSPENDED' ? 'var(--admin-danger)' : 'var(--admin-text-muted)'
                    }}>
                      {adminLabel(c.status)}
                    </span>
                  </td>
                  <td style={{ textAlign: 'right', padding: '12px 14px' }}>
                    <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                      <Link
                        to={`/admin/commerce/delivery-assignments?courier_id=${c.id}`}
                        style={{
                          fontSize: 12,
                          color: 'var(--admin-primary)',
                          textDecoration: 'none',
                          fontWeight: 600,
                          backgroundColor: 'var(--admin-surface-2)',
                          padding: '4px 10px',
                          borderRadius: 6,
                          border: '1px solid var(--admin-border-soft)'
                        }}
                      >
                        {t('admin.commerce.assignOrder')}
                      </Link>
                      {c.status === 'ACTIVE' ? (
                        <>
                        <button
                          onClick={() => void copyCourierLogin()}
                          style={{ fontSize: 12, color: 'var(--admin-primary)', backgroundColor: 'var(--admin-surface-2)', padding: '4px 10px', borderRadius: 6, border: '1px solid var(--admin-border-soft)', fontWeight: 600, cursor: 'pointer' }}
                        >{t('adminCommerceCouriersCommerceCouriersPage.copyLoginLink')}</button>
                        <button
                          onClick={() => handleSuspend(c.id)}
                          style={{
                            fontSize: 12,
                            color: 'var(--admin-danger)',
                            backgroundColor: 'var(--admin-danger-soft)',
                            padding: '4px 10px',
                            borderRadius: 6,
                            border: '1px solid var(--admin-danger-soft)',
                            fontWeight: 600,
                            cursor: 'pointer'
                          }}
                        >
                          {t('admin.commerce.suspend')}
                        </button>
                        </>
                      ) : (
                        <button
                          onClick={() => handleReactivate(c.id)}
                          style={{
                            fontSize: 12,
                            color: 'var(--admin-success)',
                            backgroundColor: 'var(--admin-success-soft)',
                            padding: '4px 10px',
                            borderRadius: 6,
                            border: '1px solid var(--admin-success-soft)',
                            fontWeight: 600,
                            cursor: 'pointer'
                          }}
                        >
                          {t('admin.commerce.reactivate')}
                        </button>
                      )}
                      <button
                        onClick={() => void handleDelete(c)}
                        disabled={busyId === c.id}
                        style={{ fontSize: 12, color: '#ffffff', backgroundColor: 'var(--admin-danger)', padding: '4px 10px', borderRadius: 6, border: '1px solid var(--admin-danger)', fontWeight: 600, cursor: busyId === c.id ? 'not-allowed' : 'pointer', opacity: busyId === c.id ? 0.6 : 1 }}
                      >
                        {busyId === c.id ? t('adminCommerceCouriersCommerceCouriersPage.deleting') : t('common.delete')}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 16 }}>
          <button
            disabled={page === 0}
            onClick={() => setPage((p) => p - 1)}
            style={{
              padding: '6px 12px',
              borderRadius: 6,
              border: '1px solid var(--admin-border)',
              backgroundColor: 'var(--admin-surface)',
              color: 'var(--admin-text)',
              cursor: page === 0 ? 'not-allowed' : 'pointer',
              opacity: page === 0 ? 0.5 : 1
            }}
          >
            {t('common.previous')}
          </button>
          <span style={{ padding: '6px 12px', color: 'var(--admin-text-muted)', fontSize: 13 }}>
            {page + 1} / {totalPages}
          </span>
          <button
            disabled={page >= totalPages - 1}
            onClick={() => setPage((p) => p + 1)}
            style={{
              padding: '6px 12px',
              borderRadius: 6,
              border: '1px solid var(--admin-border)',
              backgroundColor: 'var(--admin-surface)',
              color: 'var(--admin-text)',
              cursor: page >= totalPages - 1 ? 'not-allowed' : 'pointer',
              opacity: page >= totalPages - 1 ? 0.5 : 1
            }}
          >
            {t('common.next')}
          </button>
        </div>
      )}
    </div>
  )
}
