import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api } from '@/api/client'
import { courierApi } from '@/api/courier'
import { ApiError, type HandoverState, type HandoverVerificationResult } from '@/api/types'
import { useI18n } from '@/store/i18n'
import { lineLabel } from '@/lib/lineLabel'
import { getCourierWorkflow } from '@/lib/courierWorkflow'
import { useOrderEvents } from '@/lib/orderEvents'
import type { TranslationKey } from '@/locales/fr'
import './courier.css'
import { CourierHandoverPanel } from '@/components/courier/CourierHandoverPanel'
import { CourierPlanPanel } from '@/components/courier/CourierPlanPanel'
import type { CourierMission, DeliveryPlan } from '@/api/types'

type MissionLine={id:string;product_name:string;variant_name:string;quantity:number;final_unit_price:number}
type MissionHistory={id:string;status:string;notes?:string;created_at:string}
type DeliveryHistory={id:string;previous_status:string;new_status:string;actor_role:string;created_at:string}
type Mission={order_id:string;order_number:string;status:string;delivery_status:string;shop_name:string;business_name:string;shop_address:string;service_zone:string;package_count:number;delivery_address:string;delivery_contact:string;delivery_phone:string;delivery_notes?:string;total_amount:number;currency:string;payment_method:string;payment_status:string;lines?:MissionLine[];history?:MissionHistory[];delivery_history?:DeliveryHistory[];assigned_at?:string;accepted_at?:string;ready_at?:string;picked_up_at?:string;started_at?:string;arrived_at?:string;delivered_at?:string}&DeliveryPlan

export default function CourierMissionPage(){
  const {id=''}=useParams(), navigate=useNavigate(), {t,lang}=useI18n()
  const [m,setM]=useState<Mission|null>(null), [error,setError]=useState('')
  const [handover,setHandover]=useState<HandoverState|null>(null)
  const [actionBusy,setActionBusy]=useState(''), [actionError,setActionError]=useState(''), [actionSuccess,setActionSuccess]=useState('')
  const [productCode,setProductCode]=useState(''), [verifying,setVerifying]=useState(false), [verdict,setVerdict]=useState<HandoverVerificationResult|null>(null), [verifyError,setVerifyError]=useState('')
  const handoverRef = useRef<HTMLElement>(null)

  const load=async()=>{
    try {
      const data = await api<Mission>(`/courier/missions/${id}`)
      if (!data || data.order_id !== id) throw new Error('MISSION_NOT_FOUND')
      setM(data)
      setError('')
      // The action panel reads the handover flags, so they move with the mission.
      setHandover(await courierApi.handover(id).catch(() => null))
    } catch {
      setM(null)
      setError(t('courier.dashboard.loadError'))
    }
  }

  // Pushed the moment the buyer, the seller or TBK changes this order.
  useOrderEvents(() => void load(), { orderId: id })

  // Auto-scroll to handover panel when the next action lands there
  const scrollToHandover = useCallback(() => {
    handoverRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [])

  useEffect(()=>{
    setM(null)
    setError('')
    let disposed=false
    const fetchMission=async()=>{
      try {
        const data = await api<Mission>(`/courier/missions/${id}`)
        if (!data || data.order_id !== id) throw new Error('MISSION_NOT_FOUND')
        if (!disposed) {
          setM(data)
          setError('')
        }
        const hs = await courierApi.handover(id)
        if (!disposed) setHandover(hs)
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
    if(reason?.trim() && m) void act(`/courier/missions/${m.order_id}/reject`, {reason:reason.trim()}, t('courier.dashboard.rejected'))
  }

  async function verifyProduct() {
    const code = productCode.trim()
    if (!code || !m) return
    setVerifying(true); setVerifyError(''); setVerdict(null)
    try {
      const isQrToken = code.toLowerCase().startsWith('tbk.')
      const result = await courierApi.verifyProduct(
        m.order_id,
        isQrToken ? { token: code } : { product_number: code }
      )
      setVerdict(result)
      if (result.result === 'VALID' || result.result === 'ALREADY_USED') {
        setProductCode('')
        await load()
      }
    } catch (e) {
      setVerifyError(e instanceof ApiError ? e.message : "Impossible de vérifier le produit.")
    } finally {
      setVerifying(false)
    }
  }

  if(error&&!m) return <main className="courier-page"><div className="courier-shell"><div className="courier-error">{error}</div><Link to="/courier/dashboard">← {t('common.back')}</Link></div></main>
  if(!m) return <main className="courier-page"><div className="courier-shell">{t('common.loading')}</div></main>

  const steps=[['courier.timeline.assigned',m.assigned_at],['courier.timeline.accepted',m.accepted_at],['courier.timeline.ready',m.ready_at],['courier.timeline.picked',m.picked_up_at],['courier.timeline.transit',m.started_at],['courier.timeline.arrived',m.arrived_at],['courier.timeline.handover',m.delivered_at]] as const

  const isAccepting = m && actionBusy.includes(`/missions/${m.order_id}/accept`)
  const isRejecting = m && actionBusy.includes(`/missions/${m.order_id}/reject`)
  const isStarting = m && actionBusy.includes(`/missions/${m.order_id}/start`)
  const isArriving = m && actionBusy.includes(`/missions/${m.order_id}/arrive`)
  const isConfirmingPickup = m && actionBusy.includes(`/courier/missions/${m.order_id}/pickup`)

  // Central workflow resolver - pass handover state when available so the action
  // panel is driven by the server's permission flags, not by the delivery status alone.
  const workflow = m ? getCourierWorkflow(
    m.delivery_status,
    m.status,
    m.payment_method,
    handover ? {
      allProductsVerified: handover.all_products_verified,
      allLinesAcknowledged: handover.all_lines_acknowledged,
      receiptConfirmed: handover.receipt_confirmed,
      paymentVerified: handover.payment_verified,
      courierCanVerifyProduct: handover.courier_can_verify_product,
      courierCanConfirmCash: handover.courier_can_confirm_cash,
      blockedReason: undefined
    } : {
      allProductsVerified: false,
      courierCanVerifyProduct: false,
      courierCanConfirmCash: false,
      allLinesAcknowledged: false,
      receiptConfirmed: false,
      blockedReason: undefined
    }
  ) : null

  return (
    <main className="courier-page">
      <div className="courier-shell">
        <Link to="/courier/dashboard" style={{fontWeight:700, color:'var(--color-text)'}}>← {t('common.back')}</Link>

        {/* Action Panel — always visible at the top */}
        {workflow && (
          <section className="courier-card" style={{marginTop:16, borderLeft:'4px solid var(--color-accent)'}}>
            <p className="courier-eyebrow">Statut actuel &amp; action requise</p>
            <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', gap:12, flexWrap:'wrap', marginBottom:12}}>
              <h2 style={{margin:0}}>Fiche Mission #{m.order_number}</h2>
              <span className="courier-status">{t(`courier.status.${m.delivery_status}`)}</span>
            </div>

            <div className="courier-details" style={{marginBottom:14}}>
              <Detail l="Acteur responsable" v={workflow.responsibleActor} />
              <Detail l="Prochaine action" v={workflow.explanation} />
            </div>

            {actionError && <div className="courier-error" style={{marginBottom:12}}>{actionError}</div>}
            {actionSuccess && <div className="courier-muted" style={{color:'var(--color-success)', fontWeight:700, marginBottom:12}}>✓ {actionSuccess}</div>}

            {/* Dynamic action buttons from workflow resolver */}
            <div className="courier-actions">
              {workflow.actionType === 'ACCEPT_REJECT' && m && (
                <>
                  <button disabled={!!actionBusy} className="courier-btn courier-btn-primary" onClick={()=>void act(`/courier/missions/${m.order_id}/accept`, undefined, t('courier.dashboard.accepted'))}>
                    {isAccepting ? 'Acceptation...' : (workflow.primaryButtonText || 'Accepter')}
                  </button>
                  <button disabled={!!actionBusy} className="courier-btn courier-btn-danger" onClick={reject}>
                    {isRejecting ? 'Refus...' : (workflow.secondaryButtonText || 'Refuser')}
                  </button>
                </>
              )}

              {workflow.actionType === 'WAIT_SELLER' && (
                <div className="courier-waiting">
                  <p style={{fontWeight:700, color:'var(--color-text)'}}>Prochaine action</p>
                  <p>Responsable: <strong>{workflow.responsibleActor}</strong></p>
                  <p className="courier-muted">{workflow.explanation}</p>
                </div>
              )}

              {workflow.actionType === 'PICKUP' && m && (
                <>
                  <button disabled={!!actionBusy} className="courier-btn courier-btn-primary" onClick={()=>void act(`/courier/missions/${m.order_id}/pickup`, undefined, 'Récupération confirmée.')}>
                    {isConfirmingPickup ? 'Confirmation...' : (workflow.primaryButtonText || 'Confirmer la récupération')}
                  </button>
                  <button className="courier-btn courier-btn-scan" onClick={()=>m && navigate(`/courier/scan?type=PICKUP&order_id=${m.order_id}`)}>
                    {workflow.secondaryButtonText || 'Scanner le QR vendeur'}
                  </button>
                </>
              )}

              {workflow.actionType === 'START_DELIVERY' && m && !m.expected_delivery_date && (
                <p className="courier-muted" style={{margin:0}}>{t('courierPlan.required')}</p>
              )}
              {workflow.actionType === 'START_DELIVERY' && m && (
                <button disabled={!!actionBusy || !m.expected_delivery_date} className="courier-btn courier-btn-primary" onClick={()=>void act(`/courier/missions/${m.order_id}/start`, undefined, t('courier.dashboard.started'))}>
                  {isStarting ? 'Démarrage...' : (workflow.primaryButtonText || 'Démarrer la livraison')}
                </button>
              )}

              {workflow.actionType === 'ARRIVE' && m && (
                <button disabled={!!actionBusy} className="courier-btn courier-btn-primary" onClick={()=>void act(`/courier/missions/${m.order_id}/arrive`, undefined, t('courier.dashboard.arrived'))}>
                  {isArriving ? 'Validation d\'arrivée...' : (workflow.primaryButtonText || 'Je suis arrivé')}
                </button>
              )}

              {workflow.actionType === 'VERIFY_PRODUCT' && m && (
                <div style={{display:'flex', flexDirection:'column', gap:8, alignItems:'flex-start'}}>
                  <p style={{fontWeight:700, color:'var(--color-text)'}}>Prochaine action</p>
                  <p>Responsable: <strong>{workflow.responsibleActor}</strong></p>
                  <p className="courier-muted">{workflow.explanation}</p>
                  <div style={{display:'flex', gap:8, flexWrap:'wrap', marginTop:8, width:'100%'}}>
                    <input
                      type="text"
                      value={productCode}
                      onChange={(e) => setProductCode(e.target.value)}
                      placeholder={t('courier.handover.verifyPlaceholder')}
                      autoComplete="off"
                      autoCapitalize="characters"
                      autoCorrect="off"
                      spellCheck={false}
                      enterKeyHint="go"
                      onKeyDown={(e) => { if (e.key === 'Enter' && productCode.trim() && !verifying) void verifyProduct() }}
                      style={{minHeight:48, padding:'0 12px', borderRadius:10, flex:'1 1 100%', minWidth:0, width:'100%', fontSize:16, boxSizing:'border-box'}}
                    />
                    <button disabled={verifying || !productCode.trim()} className="courier-btn courier-btn-scan" style={{flex:'1 1 100%'}} onClick={()=>void verifyProduct()}>
                      {verifying ? t('common.loading') : t('courier.handover.verifyTitle')}
                    </button>
                  </div>
                  <small className="courier-muted">{t('courier.handover.verifyHint')}</small>
                  {verifyError && <p className="courier-error" role="status">{verifyError}</p>}
                  {verdict && (
                    <p className={verdict.result === 'VALID' || verdict.result === 'ALREADY_USED' ? 'courier-muted' : 'courier-error'} role="status">
                      {verdict.reason === 'ORDER_NUMBER_NOT_PRODUCT'
                        ? t('courier.handover.verdict.ORDER_NUMBER_NOT_PRODUCT')
                        : ['VALID','ALREADY_USED','WRONG_ORDER','WRONG_PRODUCT','WRONG_VARIANT','WRONG_SHOP','INVALID_QR'].includes(verdict.result)
                        ? t(`courier.handover.verdict.${verdict.result}` as TranslationKey)
                        : verdict.result}
                    </p>
                  )}
                </div>
              )}

              {workflow.actionType === 'CONFIRM_CASH' && m && (
                <div style={{display:'flex', flexDirection:'column', gap:8, alignItems:'flex-start'}}>
                  <p style={{fontWeight:700, color:'var(--color-text)'}}>Prochaine action</p>
                  <p>Responsable: <strong>{workflow.responsibleActor}</strong></p>
                  <p className="courier-muted">{workflow.explanation} Montant à encaisser : <strong>{m.total_amount.toLocaleString(lang)} {m.currency}</strong></p>
                  {/* Cash is confirmed in the handover panel, which first asks whether the
                      exact amount was received: no one-tap money confirmation here. */}
                  <button className="courier-btn courier-btn-primary" onClick={scrollToHandover}>
                    {workflow.primaryButtonText || t('courier.handover.confirmCashAction')} ↓
                  </button>
                </div>
              )}

              {workflow.actionType === 'WAIT_PAYMENT' && (
                <div className="courier-waiting">
                  <p style={{fontWeight:700, color:'var(--color-text)'}}>Prochaine action</p>
                  <p>Responsable: <strong>{workflow.responsibleActor}</strong></p>
                  <p className="courier-muted">{workflow.explanation}</p>
                </div>
              )}

              {workflow.actionType === 'WAIT_BUYER' && (
                <div className="courier-waiting">
                  <p style={{fontWeight:700, color:'var(--color-text)'}}>Prochaine action</p>
                  <p>Responsable: <strong>{workflow.responsibleActor}</strong></p>
                  <p className="courier-muted">{workflow.explanation}</p>
                </div>
              )}

              {workflow.actionType === 'COMPLETED' && (
                <div className="courier-waiting">
                  <p style={{fontWeight:700, color:'var(--color-success)'}}>✓ Livraison terminée</p>
                  <p className="courier-muted">{workflow.explanation}</p>
                </div>
              )}
            </div>
          </section>
        )}

        {/* The day and slot promised to the buyer (required before leaving), and
            "buyer not found" once on the way - same panel as the dashboard. */}
        <CourierPlanPanel key={`plan-${m.order_id}`} mission={m as unknown as CourierMission} onChanged={load}/>

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
              {m.lines.map(line=><Detail key={line.id} l={lineLabel(line.product_name,line.variant_name)} v={`${line.quantity} × ${line.final_unit_price.toLocaleString(lang)} ${m.currency}`}/>)}
            </div>
          </>}

          {/* Handover Panel — auto-scroll when next action is product/payment/delivery scan */}
          <CourierHandoverPanel 
            orderId={m?.order_id || ''} 
            ref={handoverRef}
            onActionReady={scrollToHandover}
          />

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

