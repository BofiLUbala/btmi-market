import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { adminCommerceApi } from '@/api/admin'

/* ─────────────────────────────────────────────────────────
   Scoped styles — cip- prefix avoids class name collisions
   ───────────────────────────────────────────────────────── */
const CSS = `
.cip-page{max-width:720px;margin:0 auto;padding:8px 0 48px}
.cip-header{margin-bottom:32px}
.cip-header-icon{display:inline-flex;align-items:center;justify-content:center;width:48px;height:48px;border-radius:14px;background:linear-gradient(135deg,var(--admin-primary) 0%,#7c5cfc 100%);font-size:22px;margin-bottom:16px;box-shadow:0 4px 16px rgba(108,75,252,.28)}
.cip-title{font-size:24px;font-weight:800;color:var(--admin-text);margin:0 0 6px;letter-spacing:-.4px;line-height:1.25}
.cip-subtitle{font-size:14px;color:var(--admin-text-muted);margin:0;line-height:1.55;max-width:520px}
.cip-alert{display:flex;align-items:flex-start;gap:12px;padding:14px 18px;border-radius:10px;font-size:14px;line-height:1.5;margin-bottom:28px;border:1px solid transparent}
.cip-alert-icon{font-size:16px;flex-shrink:0;margin-top:1px}
.cip-alert-error{background-color:var(--admin-danger-soft,#fff0f0);color:var(--admin-danger,#c0392b);border-color:rgba(192,57,43,.18)}
.cip-alert-success{background-color:var(--admin-success-soft,#edfff5);color:var(--admin-success,#1a9e5c);border-color:rgba(26,158,92,.18)}
.cip-success-card{background:var(--admin-surface);border:1px solid var(--admin-border-soft);border-radius:16px;padding:28px 28px 24px}
.cip-url-label{font-size:12px;font-weight:700;color:var(--admin-text-muted);text-transform:uppercase;letter-spacing:.6px;margin-bottom:8px}
.cip-url-box{background:var(--admin-surface-2);border:1px solid var(--admin-border);border-radius:8px;padding:12px 14px;font-family:'SFMono-Regular',Consolas,monospace;font-size:12px;word-break:break-all;color:var(--admin-text);line-height:1.6;margin-bottom:10px}
.cip-success-actions{display:flex;gap:10px;margin-top:20px;flex-wrap:wrap}
.cip-form-card{background:var(--admin-surface);border:1px solid var(--admin-border-soft);border-radius:16px;overflow:hidden}
.cip-section{padding:24px 28px}
.cip-section+.cip-section{border-top:1px solid var(--admin-border-soft)}
.cip-section-header{display:flex;align-items:center;gap:10px;margin-bottom:22px}
.cip-section-dot{width:8px;height:8px;border-radius:50%;background:var(--admin-primary);flex-shrink:0}
.cip-section-title{font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:.7px;color:var(--admin-text-muted);margin:0}
.cip-row{display:grid;grid-template-columns:1fr 1fr;gap:16px}
.cip-field{display:flex;flex-direction:column;gap:7px;margin-bottom:18px}
.cip-field:last-child{margin-bottom:0}
.cip-label{font-size:13px;font-weight:600;color:var(--admin-text);line-height:1;display:flex;align-items:center;gap:4px}
.cip-required{color:var(--admin-danger,#c0392b);font-weight:700;font-size:13px}
.cip-optional{font-size:11px;font-weight:500;color:var(--admin-text-muted);font-style:italic}
.cip-input,.cip-select{width:100%;padding:10px 14px;border-radius:9px;border:1.5px solid var(--admin-border);background:var(--admin-surface-2);color:var(--admin-text);font-size:14px;transition:border-color .15s ease,box-shadow .15s ease;outline:none;box-sizing:border-box;font-family:inherit}
.cip-input:focus,.cip-select:focus{border-color:var(--admin-primary);box-shadow:0 0 0 3px rgba(108,75,252,.12)}
.cip-input::placeholder{color:var(--admin-text-muted);opacity:.7;font-size:13px}
.cip-select{cursor:pointer;appearance:none;-webkit-appearance:none;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%23888' stroke-width='1.5' fill='none' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:right 14px center;padding-right:36px}
.cip-footer{padding:20px 28px;border-top:1px solid var(--admin-border-soft);display:flex;align-items:center;gap:12px;background:var(--admin-surface-2,rgba(255,255,255,.02));flex-wrap:wrap}
.cip-btn{display:inline-flex;align-items:center;gap:7px;padding:11px 22px;border-radius:9px;font-size:14px;font-weight:700;cursor:pointer;transition:opacity .15s ease,transform .1s ease,box-shadow .15s ease;border:none;white-space:nowrap;font-family:inherit}
.cip-btn:active{transform:scale(.98)}
.cip-btn-primary{background:linear-gradient(135deg,var(--admin-primary) 0%,#7c5cfc 100%);color:#fff;box-shadow:0 2px 10px rgba(108,75,252,.3)}
.cip-btn-primary:hover:not(:disabled){box-shadow:0 4px 18px rgba(108,75,252,.45)}
.cip-btn-primary:disabled{opacity:.6;cursor:not-allowed;transform:none}
.cip-btn-secondary{background:var(--admin-surface-2);color:var(--admin-text);border:1.5px solid var(--admin-border)}
.cip-btn-secondary:hover{border-color:var(--admin-text-muted)}
.cip-btn-ghost{background:transparent;color:var(--admin-primary);border:1.5px solid var(--admin-primary);padding:9px 18px}
.cip-btn-ghost:hover{background:rgba(108,75,252,.06)}
.cip-spinner{width:15px;height:15px;border:2px solid rgba(255,255,255,.3);border-top-color:#fff;border-radius:50%;animation:cip-spin .65s linear infinite;flex-shrink:0}
@keyframes cip-spin{to{transform:rotate(360deg)}}
@media(max-width:540px){
  .cip-row{grid-template-columns:1fr}
  .cip-section{padding:20px 18px}
  .cip-footer{padding:16px 18px;flex-direction:column-reverse}
  .cip-footer .cip-btn{width:100%;justify-content:center}
  .cip-page{padding:4px 0 32px}
}
`

const TRANSPORT_OPTIONS = [
  { value: 'MOTORBIKE', label: '🏍️  Moto' },
  { value: 'BICYCLE',   label: '🚲  Vélo' },
  { value: 'CAR',       label: '🚗  Voiture' },
  { value: 'VAN',       label: '🚐  Fourgonnette' },
  { value: 'WALKING',   label: '🚶  À pied' },
]

export default function CourierInvitePage() {
  const navigate = useNavigate()

  const [firstName,     setFirstName]     = useState('')
  const [lastName,      setLastName]      = useState('')
  const [email,         setEmail]         = useState('')
  const [phone,         setPhone]         = useState('')
  const [transportType, setTransportType] = useState('MOTORBIKE')
  const [vehicleInfo,   setVehicleInfo]   = useState('')
  const [serviceZone,   setServiceZone]   = useState('')
  const [loading,       setLoading]       = useState(false)
  const [error,         setError]         = useState('')
  const [success,       setSuccess]       = useState(false)
  const [invitationUrl, setInvitationUrl] = useState('')
  const [copied,        setCopied]        = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const result = await adminCommerceApi.inviteCourier({
        first_name:     firstName,
        last_name:      lastName,
        email,
        phone:          phone     || undefined,
        transport_type: transportType,
        vehicle_info:   vehicleInfo  || undefined,
        service_zone:   serviceZone  || undefined,
        frontend_url:   window.location.origin,
      })
      const invitationUrl = result.invitation_url ?? ''
      setInvitationUrl(invitationUrl ? new URL(invitationUrl, window.location.origin).toString() : '')
      setSuccess(true)
    } catch (err: any) {
      setError(err.message || "Une erreur s'est produite. Veuillez réessayer.")
    } finally {
      setLoading(false)
    }
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(invitationUrl).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    }).catch(() => setError("Impossible de copier le lien. Sélectionnez-le manuellement."))
  }

  const resetForm = () => {
    setSuccess(false); setInvitationUrl(''); setFirstName(''); setLastName('')
    setEmail(''); setPhone(''); setVehicleInfo(''); setServiceZone('')
    setTransportType('MOTORBIKE')
  }

  return (
    <>
      <style>{CSS}</style>
      <div className="cip-page">

        {/* ── Header ── */}
        <div className="cip-header">
          <div className="cip-header-icon">✉️</div>
          <h1 className="cip-title">Inviter un livreur</h1>
          <p className="cip-subtitle">
            Créez le profil du livreur et envoyez-lui une invitation pour activer son compte TBK.
          </p>
        </div>

        {/* ── Error banner ── */}
        {error && (
          <div className="cip-alert cip-alert-error" role="alert">
            <span className="cip-alert-icon">⚠️</span>
            <span>{error}</span>
          </div>
        )}

        {/* ── Success state ── */}
        {success ? (
          <div className="cip-success-card">
            <div className="cip-alert cip-alert-success" style={{ margin: '0 0 20px' }}>
              <span className="cip-alert-icon">✅</span>
              <div>
                <strong>Invitation envoyée avec succès !</strong>
                <br />
                <span style={{ fontSize: 13 }}>
                  Le livreur <strong>{firstName} {lastName}</strong> recevra un e-mail à{' '}
                  <strong>{email}</strong> pour activer son compte.
                </span>
              </div>
            </div>

            {invitationUrl && (
              <>
                <div className="cip-url-label">Lien d'activation</div>
                <div className="cip-url-box">{invitationUrl}</div>
                <p style={{ fontSize: 12, color: 'var(--admin-text-muted)', margin: '4px 0 0' }}>
                  Partagez ce lien directement si l'e-mail n'est pas reçu.
                </p>
              </>
            )}

            <div className="cip-success-actions">
              {invitationUrl && (
                <button className="cip-btn cip-btn-ghost" onClick={handleCopy}>
                  {copied ? '✓ Copié !' : '📋 Copier le lien'}
                </button>
              )}
              <button
                className="cip-btn cip-btn-primary"
                onClick={() => navigate('/admin/commerce/couriers')}
              >
                Voir tous les livreurs →
              </button>
              <button className="cip-btn cip-btn-secondary" onClick={resetForm}>
                Inviter un autre livreur
              </button>
            </div>
          </div>

        ) : (

        /* ── Form ── */
          <form onSubmit={handleSubmit} noValidate>
            <div className="cip-form-card">

              {/* Section 1 — Informations personnelles */}
              <div className="cip-section">
                <div className="cip-section-header">
                  <div className="cip-section-dot" />
                  <p className="cip-section-title">Informations personnelles</p>
                </div>

                <div className="cip-row">
                  <div className="cip-field">
                    <label className="cip-label" htmlFor="cip-firstName">
                      Prénom <span className="cip-required">*</span>
                    </label>
                    <input
                      id="cip-firstName"
                      className="cip-input"
                      type="text"
                      value={firstName}
                      onChange={e => setFirstName(e.target.value)}
                      placeholder="Ex : Moussa"
                      required
                      autoComplete="given-name"
                    />
                  </div>
                  <div className="cip-field">
                    <label className="cip-label" htmlFor="cip-lastName">
                      Nom <span className="cip-required">*</span>
                    </label>
                    <input
                      id="cip-lastName"
                      className="cip-input"
                      type="text"
                      value={lastName}
                      onChange={e => setLastName(e.target.value)}
                      placeholder="Ex : Traoré"
                      required
                      autoComplete="family-name"
                    />
                  </div>
                </div>

                <div className="cip-field">
                  <label className="cip-label" htmlFor="cip-email">
                    Adresse e-mail <span className="cip-required">*</span>
                  </label>
                  <input
                    id="cip-email"
                    className="cip-input"
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="ex : moussa.traore@email.com"
                    required
                    autoComplete="email"
                  />
                </div>

                <div className="cip-field">
                  <label className="cip-label" htmlFor="cip-phone">
                    Téléphone <span className="cip-optional">(facultatif)</span>
                  </label>
                  <input
                    id="cip-phone"
                    className="cip-input"
                    type="tel"
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                    placeholder="Ex : +225 07 00 00 00 00"
                    autoComplete="tel"
                  />
                </div>
              </div>

              {/* Section 2 — Informations de livraison */}
              <div className="cip-section">
                <div className="cip-section-header">
                  <div className="cip-section-dot" style={{ background: '#f59e0b' }} />
                  <p className="cip-section-title">Informations de livraison</p>
                </div>

                <div className="cip-field">
                  <label className="cip-label" htmlFor="cip-transport">
                    Type de transport <span className="cip-required">*</span>
                  </label>
                  <select
                    id="cip-transport"
                    className="cip-select"
                    value={transportType}
                    onChange={e => setTransportType(e.target.value)}
                    required
                  >
                    {TRANSPORT_OPTIONS.map(o => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>

                <div className="cip-row">
                  <div className="cip-field">
                    <label className="cip-label" htmlFor="cip-vehicle">
                      Informations véhicule <span className="cip-optional">(facultatif)</span>
                    </label>
                    <input
                      id="cip-vehicle"
                      className="cip-input"
                      type="text"
                      value={vehicleInfo}
                      onChange={e => setVehicleInfo(e.target.value)}
                      placeholder="Ex : Honda Dio 2023, AB-1234"
                    />
                  </div>
                  <div className="cip-field">
                    <label className="cip-label" htmlFor="cip-zone">
                      Zone de couverture <span className="cip-optional">(facultatif)</span>
                    </label>
                    <input
                      id="cip-zone"
                      className="cip-input"
                      type="text"
                      value={serviceZone}
                      onChange={e => setServiceZone(e.target.value)}
                      placeholder="Ex : Plateau, Cocody"
                    />
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="cip-footer">
                <button type="submit" className="cip-btn cip-btn-primary" disabled={loading}>
                  {loading
                    ? <><div className="cip-spinner" /> Envoi en cours…</>
                    : <>✉️ Envoyer l'invitation</>
                  }
                </button>
                <button
                  type="button"
                  className="cip-btn cip-btn-secondary"
                  onClick={() => navigate('/admin/commerce/couriers')}
                >
                  Annuler
                </button>
              </div>

            </div>
          </form>
        )}
      </div>
    </>
  )
}
