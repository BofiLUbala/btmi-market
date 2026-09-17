import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api } from '@/api/client'
import { useI18n } from '@/store/i18n'
import './courier.css'
import { CourierHandoverPanel } from '@/components/courier/CourierHandoverPanel'

type MissionLine={id:string;product_name:string;variant_name:string;quantity:number;final_unit_price:number}
type MissionHistory={id:string;status:string;notes?:string;created_at:string}
type DeliveryHistory={id:string;previous_status:string;new_status:string;actor_role:string;created_at:string}
type Mission={order_number:string;status:string;delivery_status:string;shop_name:string;business_name:string;shop_address:string;service_zone:string;package_count:number;delivery_address:string;delivery_contact:string;delivery_phone:string;delivery_notes?:string;total_amount:number;currency:string;payment_method:string;payment_status:string;lines?:MissionLine[];history?:MissionHistory[];delivery_history?:DeliveryHistory[];assigned_at?:string;accepted_at?:string;ready_at?:string;picked_up_at?:string;started_at?:string;arrived_at?:string;delivered_at?:string}

export default function CourierMissionPage(){
  const {id=''}=useParams(), navigate=useNavigate(), {t,lang}=useI18n()
  const [m,setM]=useState<Mission|null>(null), [error,setError]=useState('')
  const [actionBusy,setActionBusy]=useState(''), [actionError,setActionError]=useState(''), [actionSuccess,setActionSuccess]=useState('')

  const load=async()=>{
    try {
      const data = await api<Mission>(`/courier/missions/${id}`)
      setM(data)
      setError('')
    } catch {
      setError(t('courier.dashboard.loadError'))
    }
  }

  useEffect(()=>{
    let disposed=false
    const fetchMission=async()=>{
      try {
        const data = await api<Mission>(`/courier/missions/${id}`)
        if (!disposed) {
          setM(data)
          setError('')
        }
      } catch {
        if (!disposed) {
          setError(t('courier.dashboard.loadError'))
        }
      }
    }
    void fetchMission()
    const timer=window.setInterval(()=>{if(document.visibilityState==='visible')void fetchMission()},4000)
    const visible=()=>{if(document.visibilityState==='visible')void fetchMission()}
    document.addEventListener('visibilitychange',visible)
    return ()=>{disposed=true;window.clearInterval(timer);document.removeEventListener('visibilitychange',visible)}
  },[id])

  const act=async(path:string,body?:unknown,message?:string)=>{
    setActionBusy(path)
    setActionError('')
    setActionSuccess('')
    try {
      await api(path, {method:'POST', body: body ? JSON.stringify(body) : undefined})
      setActionSuccess(message || 'Action effectuée avec succès.')
      await load()
    } catch(err: any) {
      const msg = err?.message || err?.error || t('courier.dashboard.actionError')
      setActionError(`Impossible d'effectuer cette action : ${msg}`)
    } finally {
      setActionBusy('')
    }
  }

  const reject=()=>{
    const reason=window.prompt(t('courier.dashboard.rejectReason'))
    if(reason?.trim()) void act(`/courier/missions/${id}/reject`, {reason:reason.trim()}, t('courier.dashboard.rejected'))
  }

  if(error&&!m) return <main className="courier-page"><div className="courier-shell"><div className="courier-error">{error}</div><Link to="/courier/dashboard">← {t('common.back')}</Link></div></main>
  if(!m) return <main className="courier-page"><div className="courier-shell">{t('common.loading')}</div></main>

  const steps=[['courier.timeline.assigned',m.assigned_at],['courier.timeline.accepted',m.accepted_at],['courier.timeline.ready',m.ready_at],['courier.timeline.picked',m.picked_up_at],['courier.timeline.transit',m.started_at],['courier.timeline.arrived',m.arrived_at],['courier.timeline.handover',m.delivered_at]] as const

  const isAccepting = actionBusy.includes(`/missions/${id}/accept`)
  const isRejecting = actionBusy.includes(`/missions/${id}/reject`)
  const isStarting = actionBusy.includes(`/missions/${id}/start`)
  const isArriving = actionBusy.includes(`/missions/${id}/arrive`)
  const isPickingUp = actionBusy.includes('/scans/pickup')

  return (
    <main className="courier-page">
      <div className="courier-shell">
        <Link to="/courier/dashboard" style={{fontWeight:700, color:'var(--color-text)'}}>← {t('common.back')}</Link>
        
        {/* Dedicated Action Card near the top */}
        <section className="courier-card" style={{marginTop:16, borderLeft:'4px solid var(--color-accent)'}}>
          <p className="courier-eyebrow">Action requise & Statut</p>
          <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', gap:12, flexWrap:'wrap', marginBottom:12}}>
            <h2 style={{margin:0}}>Fiche Mission #{m.order_number}</h2>
            <span className="courier-status">{t(`courier.status.${m.delivery_status}`)}</span>
          </div>

          <div className="courier-details" style={{marginBottom:14}}>
            <Detail l="Acteur responsable" v={
              m.delivery_status === 'COURIER_ASSIGNED' ? 'Livreur (Vous)' :
              m.delivery_status === 'COURIER_ACCEPTED' ? (['READY','READY_FOR_PICKUP'].includes(m.status) ? 'Livreur (Vous)' : 'Vendeur') :
              m.delivery_status === 'READY_FOR_PICKUP' ? 'Livreur (Vous)' :
              m.delivery_status === 'PICKED_UP' ? 'Livreur (Vous)' :
              m.delivery_status === 'IN_TRANSIT' ? 'Livreur (Vous)' :
              m.delivery_status === 'COURIER_ARRIVED' ? 'Livreur (Vous)' :
              m.delivery_status === 'PRODUCT_VERIFIED' ? (m.payment_method === 'CASH_ON_DELIVERY' ? 'Livreur (Vous)' : 'Opérateur / Acheteur') :
              ['DELIVERED','COMPLETED','RECEIVED'].includes(m.delivery_status) ? 'Aucun (Terminé)' : 'Système'
            } />
            <Detail l="Explication du statut" v={
              m.delivery_status === 'COURIER_ASSIGNED' ? 'Cette mission vous est attribuée. Vous devez l\'accepter ou la refuser.' :
              m.delivery_status === 'COURIER_ACCEPTED' ? (['READY','READY_FOR_PICKUP'].includes(m.status) ? 'La commande est prête chez le vendeur. Récupérez les colis.' : 'En attente que le vendeur prépare la commande.') :
              m.delivery_status === 'READY_FOR_PICKUP' ? 'La commande est prête chez le vendeur. Récupérez les colis.' :
              m.delivery_status === 'PICKED_UP' ? 'Colis en votre possession. Démarrez la livraison.' :
              m.delivery_status === 'IN_TRANSIT' ? 'Trajet de livraison en cours. Validez votre arrivée une fois sur place.' :
              m.delivery_status === 'COURIER_ARRIVED' ? 'Vous êtes sur place chez l\'acheteur. Procédez aux vérifications de produits et au paiement.' :
              m.delivery_status === 'PRODUCT_VERIFIED' ? 'Produits vérifiés avec succès.' :
              ['DELIVERED','COMPLETED','RECEIVED'].includes(m.delivery_status) ? 'Livraison finalisée.' : 'Suivi de commande.'
            } />
          </div>

          {actionError && <div className="courier-error" style={{marginBottom:12}}>{actionError}</div>}
          {actionSuccess && <div className="courier-muted" style={{color:'var(--color-success)', fontWeight:700, marginBottom:12}}>✓ {actionSuccess}</div>}

          {/* Action buttons */}
          <div className="courier-actions">
            {m.delivery_status === 'COURIER_ASSIGNED' && (
              <>
                <button disabled={!!actionBusy} className="courier-btn courier-btn-primary" onClick={()=>void act(`/courier/missions/${id}/accept`, undefined, t('courier.dashboard.accepted'))}>
                  {isAccepting ? 'Acceptation...' : 'Accepter la mission'}
                </button>
                <button disabled={!!actionBusy} className="courier-btn courier-btn-danger" onClick={reject}>
                  {isRejecting ? 'Refus...' : 'Refuser la mission'}
                </button>
              </>
            )}

            {['COURIER_ACCEPTED','READY_FOR_PICKUP'].includes(m.delivery_status) && ['READY','READY_FOR_PICKUP'].includes(m.status) && (
              <>
                <button disabled={!!actionBusy} className="courier-btn courier-btn-primary" onClick={()=>void act(`/courier/missions/${id}/pickup`, undefined, 'Récupération confirmée.')}>
                  {isPickingUp ? 'Confirmation...' : 'Confirmer la récupération'}
                </button>
                <button className="courier-btn courier-btn-scan" onClick={()=>navigate(`/courier/scan?type=PICKUP&order_id=${id}`)}>
                  Scanner le QR vendeur
                </button>
              </>
            )}

            {m.delivery_status === 'PICKED_UP' && (
              <button disabled={!!actionBusy} className="courier-btn courier-btn-primary" onClick={()=>void act(`/courier/missions/${id}/start`, undefined, t('courier.dashboard.started'))}>
                {isStarting ? 'Démarrage...' : 'Démarrer la livraison'}
              </button>
            )}

            {m.delivery_status === 'IN_TRANSIT' && (
              <button disabled={!!actionBusy} className="courier-btn courier-btn-primary" onClick={()=>void act(`/courier/missions/${id}/arrive`, undefined, t('courier.dashboard.arrived'))}>
                {isArriving ? 'Validation d\'arrivée...' : 'Je suis arrivé à destination'}
              </button>
            )}

            {m.delivery_status === 'COURIER_ARRIVED' && (
              <button className="courier-btn courier-btn-scan" onClick={()=>navigate(`/courier/scan?type=DELIVERY&order_id=${id}`)}>
                Scanner le QR acheteur
              </button>
            )}
          </div>
        </section>

        {/* Full Details Card */}
        <section className="courier-card" style={{marginTop:16}}>
          <h1>{t('courier.dashboard.order')} #{m.order_number}</h1>
          <span className="courier-status">{t(`courier.status.${m.delivery_status}`)}</span>
          <div className="courier-details">
            <Detail l={t('courier.dashboard.shop')} v={`${m.shop_name} · ${m.business_name}`}/>
            <Detail l={t('courier.dashboard.pickupAddress')} v={m.shop_address}/>
            <Detail l={t('courier.dashboard.deliveryAddress')} v={m.delivery_address}/>
            <Detail l={t('courier.dashboard.zone')} v={m.service_zone}/>
            <Detail l={t('courier.dashboard.packages')} v={String(m.package_count)}/>
            <Detail l={t('courier.dashboard.client')} v={m.delivery_contact}/>
            <Detail l={t('courier.dashboard.phone')} v={m.delivery_phone}/>
            <Detail l="Mode de paiement" v={m.payment_method}/>
            <Detail l="Statut du paiement" v={m.payment_status}/>
            <Detail l="Montant" v={`${m.total_amount.toLocaleString(lang)} ${m.currency}`}/>
            {m.delivery_notes&&<Detail l={t('courier.dashboard.instructions')} v={m.delivery_notes}/>}
          </div>
          {m.lines&&m.lines.length>0&&<>
            <h2>Produits</h2>
            <div className="courier-details">
              {m.lines.map(line=><Detail key={line.id} l={`${line.product_name}${line.variant_name?` · ${line.variant_name}`:''}`} v={`${line.quantity} × ${line.final_unit_price.toLocaleString(lang)} ${m.currency}`}/>)}
            </div>
          </>}

          {/* Handover Panel for product check & cash confirmation */}
          <CourierHandoverPanel orderId={id}/>

          <h2>{t('courier.timeline.title')}</h2>
          <ol style={{paddingLeft:0, listStyle:'none'}}>
            {steps.map(([key,at])=><li key={key} style={{padding:'8px 0',opacity:at?1:.45}}><strong>{at?'✓':'○'} {t(key)}</strong>{at&&<div className="courier-muted">{new Date(at).toLocaleString(lang)}</div>}</li>)}
          </ol>

          {m.history&&m.history.length>0&&<>
            <h2>Historique enregistré</h2>
            <ol style={{paddingLeft:0, listStyle:'none'}}>
              {m.history.map(event=><li key={event.id} style={{padding:'8px 0'}}><strong>{event.status}</strong>{event.notes&&<div>{event.notes}</div>}<div className="courier-muted">{new Date(event.created_at).toLocaleString(lang)}</div></li>)}
            </ol>
          </>}
        </section>
      </div>
    </main>
  )
}

function Detail({l,v}:{l:string;v:string}){return <div className="courier-detail"><label>{l}</label>{v||'—'}</div>}

