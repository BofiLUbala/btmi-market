import { useCallback, useEffect, useState } from 'react'
import { adminUsersApi, type AdminUserManagementItem, type AdminRole } from '@/api/admin'
import { useAdminAuth } from '@/store/adminAuth'
import { useT } from '@/store/i18n'
import { AdminStatusBadge as StatusBadge } from '@/components/admin/AdminStatusBadge'

const INVITABLE_ROLES: AdminRole[] = ['DIRECTION_ADMIN', 'COMMERCE_ADMIN', 'FINANCE_SUPPORT_ADMIN', 'TECHNICAL_ADMIN']

type ActionType = 'suspend' | 'reactivate' | 'force_logout' | 'change_role' | 'delete'

export default function AdminUsersPage() {
  const t = useT()
  // Needed only to keep the operator from deleting the account they are
  // signed in with; the page itself is already SUPER_ADMIN-only.
  const { admin: currentAdmin } = useAdminAuth()
  const [admins, setAdmins] = useState<AdminUserManagementItem[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [banner, setBanner] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const [showInvite, setShowInvite] = useState(false)
  const [inviteForm, setInviteForm] = useState({ full_name: '', email: '', role: INVITABLE_ROLES[0] })
  const [inviteSubmitting, setInviteSubmitting] = useState(false)
  const [inviteError, setInviteError] = useState<string | null>(null)

  const [actionTarget, setActionTarget] = useState<AdminUserManagementItem | null>(null)
  const [actionType, setActionType] = useState<ActionType | null>(null)
  const [actionReason, setActionReason] = useState('')
  const [actionRole, setActionRole] = useState<AdminRole>(INVITABLE_ROLES[0])
  const [actionSubmitting, setActionSubmitting] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const [deleteConfirmEmail, setDeleteConfirmEmail] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await adminUsersApi.list({ search: search || undefined, status: statusFilter || undefined, limit: 50 })
      setAdmins(res.admins || [])
      setTotal(res.total || 0)
    } catch (err) {
      console.error('Failed to load admin users:', err)
    } finally {
      setLoading(false)
    }
  }, [search, statusFilter])

  useEffect(() => {
    void load()
  }, [load])

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault()
    setInviteError(null)
    setInviteSubmitting(true)
    try {
      const nameParts = inviteForm.full_name.trim().split(/\s+/)
      const firstName = nameParts.shift() || ''
      const lastName = nameParts.join(' ') || firstName
      await adminUsersApi.invite({ first_name: firstName, last_name: lastName, email: inviteForm.email, role: inviteForm.role })
      setBanner({ type: 'success', text: t('admin.users.invitationSent', { email: inviteForm.email }) })
      setShowInvite(false)
      setInviteForm({ full_name: '', email: '', role: INVITABLE_ROLES[0] })
      void load()
    } catch (err: unknown) {
      setInviteError(err instanceof Error ? err.message : t('admin.users.failedToInvite'))
    } finally {
      setInviteSubmitting(false)
    }
  }

  const handleResend = async (admin: AdminUserManagementItem) => {
    try {
      await adminUsersApi.resendInvitation(admin.id)
      setBanner({ type: 'success', text: t('admin.users.invitationResent', { email: admin.email }) })
      void load()
    } catch (err: unknown) {
      setBanner({ type: 'error', text: err instanceof Error ? err.message : t('admin.users.failedToResend') })
    }
  }

  const openAction = (admin: AdminUserManagementItem, type: ActionType) => {
    setActionTarget(admin)
    setActionType(type)
    setActionReason('')
    setActionRole(admin.role === 'SUPER_ADMIN' ? INVITABLE_ROLES[0] : admin.role)
    setActionError(null)
    setDeleteConfirmEmail('')
  }

  const closeAction = () => {
    setActionTarget(null)
    setActionType(null)
    setActionReason('')
    setActionError(null)
    setDeleteConfirmEmail('')
  }

  const submitAction = async () => {
    if (!actionTarget || !actionType) return
    if (actionType !== 'change_role' && (!actionReason.trim() || actionReason.trim().length < 5)) {
      setActionError(t('admin.users.justificationRequired'))
      return
    }
    if (actionType === 'change_role' && (!actionReason.trim() || actionReason.trim().length < 5)) {
      setActionError(t('admin.users.justificationRequired'))
      return
    }

    if (actionType === 'delete' && deleteConfirmEmail.trim().toLowerCase() !== actionTarget.email.toLowerCase()) {
      setActionError(t('admin.users.deleteEmailMismatch'))
      return
    }

    setActionSubmitting(true)
    setActionError(null)
    try {
      let serverMessage = ''
      if (actionType === 'suspend') {
        await adminUsersApi.suspend(actionTarget.id, actionReason)
      } else if (actionType === 'reactivate') {
        await adminUsersApi.reactivate(actionTarget.id, actionReason)
      } else if (actionType === 'force_logout') {
        await adminUsersApi.forceLogout(actionTarget.id, actionReason)
      } else if (actionType === 'change_role') {
        await adminUsersApi.changeRole(actionTarget.id, actionRole, actionReason)
      } else if (actionType === 'delete') {
        // The server decides whether the row was erased or retired, so its own
        // sentence is shown rather than a generic "done".
        const res = await adminUsersApi.remove(actionTarget.id, deleteConfirmEmail.trim(), actionReason)
        serverMessage = res?.message ?? ''
      }
      setBanner({ type: 'success', text: serverMessage || t('admin.users.actionExecutedRecorded') })
      closeAction()
      void load()
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : t('admin.users.actionFailed'))
    } finally {
      setActionSubmitting(false)
    }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '9px 12px',
    borderRadius: 8,
    backgroundColor: '#1e293b',
    border: '1px solid #334155',
    color: '#ffffff',
    fontSize: 13,
    boxSizing: 'border-box'
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, margin: '0 0 6px', display: 'flex', alignItems: 'center', gap: 10 }}>
            <span>🔐</span> {t('admin.users.pageTitle')}
          </h1>
          <p style={{ color: '#94a3b8', fontSize: 13, margin: 0 }}>
            {t('admin.users.pageSubtitle')}
          </p>
        </div>
        <button
          onClick={() => { setShowInvite(true); setInviteError(null) }}
          style={{ backgroundColor: '#2563eb', color: '#ffffff', border: 'none', borderRadius: 8, padding: '10px 18px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
        >
          + {t('admin.users.inviteAdmin')}
        </button>
      </div>

      {banner && (
        <div style={{
          padding: '10px 14px', borderRadius: 8, marginBottom: 16, fontSize: 13,
          backgroundColor: banner.type === 'error' ? '#450a0a' : '#064e3b',
          color: banner.type === 'error' ? '#fca5a5' : '#a7f3d0'
        }}>
          {banner.text}
        </div>
      )}

      <div style={{ display: 'flex', gap: 12, marginBottom: 16, backgroundColor: '#0f172a', padding: 14, borderRadius: 10, border: '1px solid #1e293b' }}>
        <input
          type="text"
          placeholder={t('admin.users.searchPlaceholder')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ ...inputStyle, flex: 1 }}
        />
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={inputStyle}>
          <option value="">{t('admin.users.allStatuses')}</option>
          <option value="ACTIVE">{t('admin.users.statusActive')}</option>
          <option value="PENDING">{t('admin.users.statusPendingActivation')}</option>
          <option value="SUSPENDED">{t('admin.users.statusSuspended')}</option>
          <option value="DEACTIVATED">{t('admin.users.statusDeactivated')}</option>
        </select>
        <button onClick={() => void load()} style={{ backgroundColor: '#2563eb', color: '#ffffff', border: 'none', borderRadius: 8, padding: '9px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
          {t('admin.direction.filter')}
        </button>
      </div>

      <div style={{ backgroundColor: '#0f172a', borderRadius: 12, border: '1px solid #1e293b', overflowX: 'auto' }}>
        <table style={{ width: '100%', minWidth: 940, borderCollapse: 'collapse', textAlign: 'left', fontSize: 13 }}>
          <thead>
            <tr style={{ backgroundColor: '#1e293b', color: '#94a3b8', borderBottom: '1px solid #334155' }}>
              <th style={{ padding: '12px 16px' }}>{t('admin.users.thFullName')}</th>
              <th style={{ padding: '12px 16px' }}>{t('admin.users.thProfessionalEmail')}</th>
              <th style={{ padding: '12px 16px' }}>{t('admin.users.thRole')}</th>
              <th style={{ padding: '12px 16px' }}>{t('common.status')}</th>
              <th style={{ padding: '12px 16px' }}>{t('admin.users.thInvitationStatus')}</th>
              <th style={{ padding: '12px 16px' }}>{t('admin.users.thCreated')}</th>
              <th style={{ padding: '12px 16px' }}>{t('admin.users.thLastLogin')}</th>
              <th style={{ padding: '12px 16px', textAlign: 'right' }}>{t('admin.direction.thActions')}</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} style={{ padding: 36, textAlign: 'center', color: '#64748b' }}>{t('admin.users.loadingAdminAccounts')}</td></tr>
            ) : admins.length === 0 ? (
              <tr><td colSpan={8} style={{ padding: 36, textAlign: 'center', color: '#64748b' }}>{t('admin.users.noAdminAccountsFound')}</td></tr>
            ) : (
              admins.map((a) => {
                return (
                  <tr key={a.id} style={{ borderBottom: '1px solid #1e293b' }}>
                    <td style={{ padding: '12px 16px', fontWeight: 700, color: '#ffffff' }}>{a.first_name} {a.last_name}</td>
                    <td style={{ padding: '12px 16px' }}>{a.email}</td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 6, backgroundColor: '#1e3a8a', color: '#bfdbfe' }}>
                        {a.role.replace('_', ' ')}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <StatusBadge status={a.status} />
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: 12, color: '#94a3b8' }}>{a.invitation_status || '—'}</td>
                    <td style={{ padding: '12px 16px', fontSize: 12, color: '#94a3b8' }}>{new Date(a.created_at).toLocaleDateString()}</td>
                    <td style={{ padding: '12px 16px', fontSize: 12, color: '#94a3b8' }}>{a.last_login_at ? new Date(a.last_login_at).toLocaleString() : '—'}</td>
                    <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                        {a.status === 'PENDING' && (
                          <button onClick={() => void handleResend(a)} style={{ backgroundColor: '#1e293b', color: '#fde68a', border: '1px solid #78350f', borderRadius: 6, padding: '5px 10px', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
                            {t('admin.users.resendInvite')}
                          </button>
                        )}
                        {a.status === 'ACTIVE' && (
                          <button onClick={() => openAction(a, 'suspend')} style={{ backgroundColor: '#7f1d1d', color: '#fecaca', border: 'none', borderRadius: 6, padding: '5px 10px', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
                            {t('admin.direction.suspend')}
                          </button>
                        )}
                        {a.status === 'SUSPENDED' && (
                          <button onClick={() => openAction(a, 'reactivate')} style={{ backgroundColor: '#064e3b', color: '#a7f3d0', border: 'none', borderRadius: 6, padding: '5px 10px', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
                            {t('admin.direction.reactivate')}
                          </button>
                        )}
                        {a.status !== 'PENDING' && (
                          <button onClick={() => openAction(a, 'force_logout')} style={{ backgroundColor: '#1e293b', color: '#cbd5e1', border: '1px solid #334155', borderRadius: 6, padding: '5px 10px', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
                            {t('admin.users.forceLogout')}
                          </button>
                        )}
                        {a.role !== 'SUPER_ADMIN' && (
                          <button onClick={() => openAction(a, 'change_role')} style={{ backgroundColor: '#1e293b', color: '#c4b5fd', border: '1px solid #6d28d9', borderRadius: 6, padding: '5px 10px', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
                            {t('admin.users.changeRole')}
                          </button>
                        )}
                        {a.id !== currentAdmin?.id && (
                          <button onClick={() => openAction(a, 'delete')} style={{ backgroundColor: '#450a0a', color: '#fca5a5', border: '1px solid #991b1b', borderRadius: 6, padding: '5px 10px', fontSize: 11, fontWeight: 700, cursor: 'pointer' }} title={t('admin.users.deleteTooltip')}>
                            {t('admin.users.delete')}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
      <div style={{ marginTop: 10, fontSize: 12, color: '#64748b' }}>{t('admin.users.totalAccountsFooter', { count: total })}</div>

      {/* INVITE MODAL */}
      {showInvite && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}>
          <div style={{ maxWidth: 460, width: '100%', backgroundColor: '#0f172a', borderRadius: 16, border: '1px solid #334155', padding: 28, boxShadow: '0 25px 50px rgba(0,0,0,0.6)' }}>
            <h3 style={{ fontSize: 18, fontWeight: 800, margin: '0 0 8px', color: '#ffffff' }}>{t('admin.users.inviteAdmin')}</h3>
            <p style={{ fontSize: 13, color: '#94a3b8', margin: '0 0 20px', lineHeight: 1.5 }}>
              {t('admin.users.inviteModalNotice')}
            </p>

            {inviteError && (
              <div style={{ padding: '10px 14px', borderRadius: 8, marginBottom: 16, fontSize: 13, backgroundColor: '#450a0a', color: '#fca5a5' }}>
                {inviteError}
              </div>
            )}

            <form onSubmit={handleInvite}>
              <div style={{ marginBottom: 14 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#cbd5e1', marginBottom: 6 }}>{t('admin.users.fullNameLabel')}</label>
                  <input required value={inviteForm.full_name} onChange={(e) => setInviteForm({ ...inviteForm, full_name: e.target.value })} style={inputStyle} />
                </div>
              </div>
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#cbd5e1', marginBottom: 6 }}>{t('admin.users.professionalEmailLabel')}</label>
                <input required type="email" value={inviteForm.email} onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })} style={inputStyle} />
              </div>
              <div style={{ marginBottom: 20 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#cbd5e1', marginBottom: 6 }}>{t('admin.users.thRole')}</label>
                <select value={inviteForm.role} onChange={(e) => setInviteForm({ ...inviteForm, role: e.target.value as AdminRole })} style={inputStyle}>
                  {INVITABLE_ROLES.map((r) => <option key={r} value={r}>{r.replace('_', ' ')}</option>)}
                </select>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button type="button" onClick={() => setShowInvite(false)} disabled={inviteSubmitting} style={{ backgroundColor: '#1e293b', color: '#cbd5e1', border: '1px solid #334155', borderRadius: 8, padding: '10px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                  {t('common.cancel')}
                </button>
                <button type="submit" disabled={inviteSubmitting} style={{ backgroundColor: '#2563eb', color: '#ffffff', border: 'none', borderRadius: 8, padding: '10px 20px', fontSize: 13, fontWeight: 700, cursor: inviteSubmitting ? 'not-allowed' : 'pointer', opacity: inviteSubmitting ? 0.7 : 1 }}>
                  {inviteSubmitting ? t('admin.users.sending') : t('admin.users.sendInvitation')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ACTION MODAL */}
      {actionTarget && actionType && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}>
          <div style={{ maxWidth: 480, width: '100%', backgroundColor: '#0f172a', borderRadius: 16, border: '1px solid #334155', padding: 28, boxShadow: '0 25px 50px rgba(0,0,0,0.6)' }}>
            <h3 style={{ fontSize: 18, fontWeight: 800, margin: '0 0 8px', color: actionType === 'suspend' || actionType === 'delete' ? '#ef4444' : '#60a5fa' }}>
              {actionType === 'suspend' && t('admin.users.suspendAdminTitle')}
              {actionType === 'reactivate' && t('admin.users.reactivateAdminTitle')}
              {actionType === 'force_logout' && t('admin.users.forceLogout')}
              {actionType === 'change_role' && t('admin.users.changeAdminRoleTitle')}
              {actionType === 'delete' && t('admin.users.deleteAdminTitle')}
            </h3>
            <p style={{ fontSize: 13, color: '#94a3b8', margin: '0 0 20px', lineHeight: 1.5 }}>
              {t('admin.users.targetLabel')} <strong>{actionTarget.first_name} {actionTarget.last_name}</strong> ({actionTarget.email}).
              {' '}{t('admin.users.mutatesStateNotice')}
            </p>

            {actionType === 'delete' && (
              <div style={{ padding: '12px 14px', borderRadius: 8, marginBottom: 16, fontSize: 13, lineHeight: 1.55, backgroundColor: '#450a0a', color: '#fecaca', border: '1px solid #991b1b' }}>
                {actionTarget.status === 'PENDING'
                  ? t('admin.users.deleteWarningPending')
                  : t('admin.users.deleteWarningActive')}
              </div>
            )}

            {actionError && (
              <div style={{ padding: '10px 14px', borderRadius: 8, marginBottom: 16, fontSize: 13, backgroundColor: '#450a0a', color: '#fca5a5' }}>
                {actionError}
              </div>
            )}

            {actionType === 'change_role' && (
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#cbd5e1', marginBottom: 6 }}>{t('admin.users.newRoleLabel')}</label>
                <select value={actionRole} onChange={(e) => setActionRole(e.target.value as AdminRole)} style={inputStyle}>
                  {INVITABLE_ROLES.map((r) => <option key={r} value={r}>{r.replace('_', ' ')}</option>)}
                </select>
              </div>
            )}

            {actionType === 'delete' && (
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#cbd5e1', marginBottom: 6 }}>
                  {t('admin.users.deleteConfirmEmailLabel', { email: actionTarget.email })}
                </label>
                <input
                  value={deleteConfirmEmail}
                  onChange={(e) => setDeleteConfirmEmail(e.target.value)}
                  placeholder={actionTarget.email}
                  autoComplete="off"
                  style={inputStyle}
                />
              </div>
            )}

            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#cbd5e1', marginBottom: 6 }}>{t('admin.direction.mandatoryJustificationLabel')}</label>
              <textarea
                value={actionReason}
                onChange={(e) => setActionReason(e.target.value)}
                placeholder={t('admin.users.actionJustificationPlaceholder')}
                rows={3}
                style={{ ...inputStyle, resize: 'vertical' }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button onClick={closeAction} disabled={actionSubmitting} style={{ backgroundColor: '#1e293b', color: '#cbd5e1', border: '1px solid #334155', borderRadius: 8, padding: '10px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                {t('common.cancel')}
              </button>
              {(() => {
                const emailMatches = deleteConfirmEmail.trim().toLowerCase() === actionTarget.email.toLowerCase()
                const blocked = actionSubmitting || (actionType === 'delete' && !emailMatches)
                return (
                  <button onClick={() => void submitAction()} disabled={blocked} style={{ backgroundColor: actionType === 'suspend' || actionType === 'delete' ? '#dc2626' : '#2563eb', color: '#ffffff', border: 'none', borderRadius: 8, padding: '10px 20px', fontSize: 13, fontWeight: 700, cursor: blocked ? 'not-allowed' : 'pointer', opacity: blocked ? 0.55 : 1 }}>
                    {actionSubmitting
                      ? t('admin.direction.executing')
                      : actionType === 'delete'
                        ? t('admin.users.deleteConfirmButton')
                        : t('admin.direction.confirmAndCommitAudit')}
                  </button>
                )
              })()}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
