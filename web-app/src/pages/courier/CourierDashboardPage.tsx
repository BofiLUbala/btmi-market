import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '@/api/client'
import { useAuth } from '@/store/auth'
import { fr } from '@/locales/fr'
import './courier.css'
import { CourierHandoverPanel } from '@/components/courier/CourierHandoverPanel'

// Delivery statuses in which the courier is at the buyer's door.
const HANDOVER_STATUSES=['COURIER_ARRIVED','DELIVERY_SCAN_SUCCESS','AWAITING_BUYER_CONFIRMATION']

type Availability='AVAILABLE'|'BUSY'|'UNAVAILABLE'
type View='dashboard'|'assigned'|'active'|'scanner'|'history'|'availability'|'notifications'|'profile'|'detail'
type Profile={first_name:string;last_name:string;email:string;phone?:string;status:string;availability:Availability;transport_type:string;vehicle_info?:string;service_zone?:string;province?:string;city?:string;commune?:string;street?:string;building_number?:string;landmark?:string;completed_today:number;total_deliveries:number}
type Mission={order_id:string;order_number:string;status:string;delivery_status:string;shop_name:string;business_name:string;shop_address:string;service_zone:string;package_count:number;delivery_address:string;delivery_contact:string;delivery_phone:string;delivery_notes?:string;assigned_at?:string;accepted_at?:string;ready_at?:string;picked_up_at?:string;started_at?:string;arrived_at?:string;delivered_at?:string}
type History={order_id:string;order_number:string;shop_name:string;delivery_address:string;final_status:string;delivered_at?:string}
type Notice={id:string;title:string;body:string;type:string;is_read:boolean;created_at:string;reference_id?:string}
type Translator=(key:string,vars?:Record<string,string|number|undefined|null>)=>string
const t:Translator=(key,vars)=>{const template=(fr as Record<string,string>)[key]??key;return vars?template.replace(/\{(\w+)\}/g,(m,n)=>vars[n]!=null?String(vars[n]):m):template}
const unwrap = <T,>(body: any): T => {
  const d = body?.data?.courier ?? body?.data
  if (d !== undefined) return d as T
  return body as T
}

const iconPaths={dashboard:<><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></>,assigned:<><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></>,active:<><circle cx="12" cy="12" r="9"/><path d="m9 12 2 2 4-5"/></>,scanner:<><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><path d="M14 14h3v3h4v4h-7v-3"/></>,history:<><path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5M12 7v5l3 2"/></>,availability:<><path d="M12 2v4M12 18v4M4.9 4.9l2.8 2.8M16.3 16.3l2.8 2.8M2 12h4M18 12h4M4.9 19.1l2.8-2.8M16.3 7.7l2.8-2.8"/><circle cx="12" cy="12" r="3"/></>,notifications:<><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/></>,profile:<><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></>,logout:<><path d="M10 17l5-5-5-5M15 12H3M21 3v18h-7"/></>,arrow:<><path d="M5 12h14M15 8l4 4-4 4"/></>,empty:<><path d="M4 7h16v12H4zM4 7l3-4h10l3 4M9 12h6"/></>}
type IconName=keyof typeof iconPaths
function Icon({name}:{name:IconName}){return <svg className="courier-icon" viewBox="0 0 24 24" aria-hidden="true">{iconPaths[name]}</svg>}

const nav:Array<{id:View;label:string;icon:IconName}>=[{id:'dashboard',label:'Tableau de bord',icon:'dashboard'},{id:'assigned',label:'Missions assignées',icon:'assigned'},{id:'active',label:'Mission active',icon:'active'},{id:'scanner',label:'Scanner QR',icon:'scanner'},{id:'history',label:'Historique',icon:'history'},{id:'availability',label:'Disponibilité',icon:'availability'},{id:'notifications',label:'Notifications',icon:'notifications'},{id:'profile',label:'Profil',icon:'profile'}]

export default function CourierDashboardPage(){
  const {logout}=useAuth(),navigate=useNavigate();const[view,setView]=useState<View>('dashboard'),[selected,setSelected]=useState<Mission|null>(null),[profile,setProfile]=useState<Profile|null>(null),[missions,setMissions]=useState<Mission[]>([]),[history,setHistory]=useState<History[]>([]),[notices,setNotices]=useState<Notice[]>([]),[loading,setLoading]=useState(true),[busy,setBusy]=useState(''),[error,setError]=useState(''),[missionError,setMissionError]=useState(''),[historyError,setHistoryError]=useState(''),[noticeError,setNoticeError]=useState(''),[success,setSuccess]=useState('')
  const seenNotificationIds=useRef<Set<string>>(new Set()),[toast,setToast]=useState<{message:string;type:'info'|'success'} | null>(null)
const showToast=(message:string,type:'info'|'success'='info')=>{setToast({message,type});setTimeout(()=>setToast(null),5000)}

  const request=useCallback(async<T,>(path:string,init?:RequestInit):Promise<T>=>unwrap<T>(await api<unknown>(path,init)),[])

  const load=useCallback(async()=>{
    setLoading(true);setError('');
    try{
      const p=await request<Profile>('/courier/profile');
      setProfile(p);
      if(p.status==='SUSPENDED'){
        setMissions([]);setHistory([]);
      }else{
        setMissionError('');setHistoryError('');
        const[m,h]=await Promise.all([
          request<Mission[]>('/courier/missions').catch(()=>{setMissionError('Impossible de charger les missions.');return null}),
          request<History[]>('/courier/history?limit=30').catch(()=>{setHistoryError('Impossible de charger l\'historique.');return null})
        ]);
        setMissions(Array.isArray(m)?m:[]);setHistory(Array.isArray(h)?h:[])
      }
      setNoticeError('');
      const n=await request<{items?:Notice[];notifications?:Notice[]}>('/notifications?limit=50&offset=0').catch(():{items?:Notice[];notifications?:Notice[]}=>{setNoticeError('Impossible de charger les notifications.');return{items:[]}});
      const newNotices=n.items??n.notifications??[];
      
      setNotices(newNotices);
      
      // Detect new COURIER_ASSIGNED notifications and show toast
      const newAssignments=newNotices.filter(n=>
        n.type==='COURIER_ASSIGNED' &&
        !n.is_read &&
        !seenNotificationIds.current.has(n.id)
      );
      
      if(newAssignments.length>0){
        newAssignments.forEach(n=>seenNotificationIds.current.add(n.id));
        // Show toast for the first new assignment
        showToast('Nouvelle mission assignée !', 'info');
        // Auto-refresh missions to show the new assignment immediately
        try{
          const m=await request<Mission[]>('/courier/missions');
          if(Array.isArray(m)) setMissions(m);
        }catch{}
      }
      
      // Clean up seen notifications that are now read
      const currentReadIds=new Set(newNotices.filter(n=>n.is_read).map(n=>n.id));
      seenNotificationIds.current=new Set([...seenNotificationIds.current].filter(id=>!currentReadIds.has(id)));
      
    }catch{setError('Impossible de charger le profil livreur.')}finally{setLoading(false)}
  },[request,notices])
 useEffect(()=>{void load();const timer=window.setInterval(()=>void load(),4000);return()=>window.clearInterval(timer)},[load])
 const assigned=missions.filter(m=>m.delivery_status==='COURIER_ASSIGNED'),active=missions.filter(m=>m.delivery_status!=='COURIER_ASSIGNED'&&!['RECEIVED','DELIVERED','COMPLETED','CANCELLED','COURIER_REJECTED'].includes(m.delivery_status)&&!['RECEIVED','COMPLETED','CANCELLED'].includes(m.status)),current=active[0],unread=notices.filter(n=>!n.is_read).length
 const act=async(path:string,body?:unknown,message?:string)=>{setBusy(path);setError('');setSuccess('');try{await request(path,{method:'POST',body:body?JSON.stringify(body):undefined});setSuccess(message||'Action effectuée avec succès.');if(path.includes('/accept')){setView('active')}await load()}catch(err:any){const msg=err?.message||err?.error||t('courier.dashboard.actionError');setError(`Impossible d'effectuer cette action : ${msg}`)}finally{setBusy('')}}
 const reject=(m:Mission)=>{const reason=window.prompt(t('courier.dashboard.rejectReason'));if(reason?.trim())void act(`/courier/missions/${m.order_id}/reject`,{reason:reason.trim()},t('courier.dashboard.rejected'))}
 const availability=async(v:Availability)=>{setBusy('availability');try{await request('/courier/availability',{method:'PATCH',body:JSON.stringify({availability:v})});await load()}catch(err:any){const msg=err?.message||err?.error||t('courier.dashboard.actionError');setError(`Impossible de modifier la disponibilité : ${msg}`)}finally{setBusy('')}}
 const scan=(type:'PICKUP'|'DELIVERY',m:Mission)=>navigate(`/courier/scan?type=${type}&order_id=${m.order_id}`)
 const choose=(next:View)=>{setView(next);setSuccess('');(document.querySelector('.courier-content') as HTMLElement|null)?.scrollTo({top:0,behavior:'smooth'})}
 if(loading&&!profile)return <main className="courier-page courier-loading"><div className="courier-glass courier-skeleton courier-skeleton-side"/><div className="courier-glass courier-skeleton courier-skeleton-main"/></main>
 const title=view==='detail'?'Détails de la mission':nav.find(n=>n.id===view)?.label||'Tableau de bord',initials=`${profile?.first_name?.[0]||''}${profile?.last_name?.[0]||''}`.toUpperCase()
 return <main className="courier-page"><div className="courier-orb courier-orb-one"/><div className="courier-orb courier-orb-two"/><div className="courier-workspace">
  <aside className="courier-glass courier-sidebar"><div className="courier-brand"><div className="courier-brand-mark">TB</div><div><strong>TBK Livreur</strong><span>Espace de livraison</span></div></div><nav aria-label="Navigation livreur">{nav.map(item=><button key={item.id} className={view===item.id?'is-selected':''} aria-current={view===item.id?'page':undefined} onClick={()=>choose(item.id)}><Icon name={item.icon}/><span>{item.label}</span>{item.id==='assigned'&&assigned.length>0&&<b>{assigned.length}</b>}{item.id==='notifications'&&unread>0&&<b>{unread}</b>}</button>)}</nav><div className="courier-sidebar-user"><div className="courier-avatar">{initials||'TB'}</div><div><strong>{profile?.first_name} {profile?.last_name}</strong><span className={profile?.availability==='AVAILABLE'?'is-online':''}>{profile?.availability==='AVAILABLE'?'Disponible':'Indisponible'}</span></div></div><button className="courier-logout" onClick={()=>void logout().then(()=>navigate('/livreur/login'))}><Icon name="logout"/>Déconnexion</button></aside>
  <section className="courier-content"><header className="courier-content-header"><div><p className="courier-eyebrow">TBK Livreur</p><h1>{title}</h1></div><div className={`courier-presence ${profile?.availability==='AVAILABLE'?'is-online':''}`}><span/>{profile?.status==='SUSPENDED'?'Suspendu':profile?.availability==='AVAILABLE'?'Disponible':'Indisponible'}</div></header>{error&&<div className="courier-glass courier-alert courier-alert-error"><span>{error}</span><button onClick={()=>void load()}>Réessayer</button></div>}{success&&<div className="courier-glass courier-alert courier-alert-success">{success}</div>}{toast&&<div className={`courier-glass courier-alert courier-alert-${toast.type}`} style={{position:'fixed',top:20,right:20,zIndex:1000,minWidth:280,maxWidth:400,boxShadow:'0 4px 12px rgba(0,0,0,0.15)'}}><span>{toast.message}</span></div>}<div className="courier-panel">{renderView()}</div></section>
  <nav className="courier-mobile-nav" aria-label="Navigation mobile">{nav.filter(n=>['dashboard','assigned','scanner','history','profile'].includes(n.id)).map(item=><button key={item.id} className={view===item.id?'is-selected':''} onClick={()=>choose(item.id)}><Icon name={item.icon}/><span>{item.id==='dashboard'?'Accueil':item.id==='assigned'?'Missions':item.label}</span>{item.id==='assigned'&&assigned.length>0&&<b>{assigned.length}</b>}</button>)}</nav>
 </div></main>

 function renderView(){switch(view){case'dashboard':return <Overview/>;case'assigned':return <MissionSection items={assigned} empty="Aucune mission assignée." assignedMode/>;case'active':return current?ActiveMission({mission:current}):<Empty title="Aucune mission active." body="Acceptez une mission assignée pour commencer."/>;case'scanner':return <Scanner/>;case'history':return <HistoryPanel/>;case'availability':return <AvailabilityPanel/>;case'notifications':return <NotificationsPanel/>;case'profile':return <ProfilePanel/>;case'detail':return selected?ActiveMission({mission:selected}):<Empty title="Mission introuvable." body="Revenez à la liste des missions."/>}}
 // ActiveMission is called as a plain function, not mounted as <ActiveMission/>: it is
 // redefined on every render of this page, and the page re-renders on its 15s poll. As a
  // component it would get a new type each time and remount the handover panel below it,
  // throwing away a typed product code or an open cash-confirmation dialog mid-handover.
  function Overview() {
    return (
      <>
        <section className="courier-welcome courier-glass">
          <div>
            <p className="courier-eyebrow">Vue d’ensemble</p>
            <h2>Bonjour, {profile?.first_name}</h2>
            <p>{t('courier.dashboard.readySubtitle')}</p>
          </div>
          <div className="courier-avatar courier-avatar-large">{initials || 'TB'}</div>
        </section>
        {missionError || historyError ? (
          <section className="courier-glass courier-section">
            <Heading title="Données indisponibles" eyebrow="Connexion en temps réel" />
            {missionError && <SectionError message={missionError} retry={load} />}
            {historyError && <SectionError message={historyError} retry={load} />}
          </section>
        ) : (
          <>
            <section className="courier-stats">
              <Stat icon="assigned" value={assigned.length} label="Missions assignées" />
              <Stat icon="active" value={active.length} label="Missions actives" />
              <Stat icon="history" value={history.length} label="Livraisons terminées" />
            </section>
            <section className="courier-glass courier-section">
              <Heading title="Mission actuelle" eyebrow="Priorité" />
              {current ? <MissionCard mission={current} /> : <Empty title="Aucune mission active." body={t('courier.dashboard.emptyHint')} />}
            </section>
          </>
        )}
      </>
    )
  }
  function MissionSection({items,empty,assignedMode=false}:{items:Mission[];empty:string;assignedMode?:boolean}){return <section className="courier-glass courier-section"><Heading title={title} eyebrow={`${items.length} mission${items.length===1?'':'s'}`}/>{missionError&&<SectionError message={missionError} retry={load}/>} {items.length?<div className="courier-mission-list">{items.map(m=><MissionCard key={m.order_id} mission={m} assignedMode={assignedMode}/>)}</div>:!missionError&&<Empty title={empty} body={t('courier.dashboard.emptyHint')}/>}</section>}
  function MissionCard({mission:m,assignedMode=false}:{mission:Mission;assignedMode?:boolean}){
    const isAccepting = busy.includes(`/missions/${m.order_id}/accept`)
    const isRejecting = busy.includes(`/missions/${m.order_id}/reject`)
    return <article className="courier-mission"><div className="courier-row"><div><p className="courier-eyebrow">Commande</p><h3>#{m.order_number}</h3></div><span className="courier-status">{t(`courier.status.${m.delivery_status}`)}</span></div><div className="courier-mission-facts"><Fact label="Boutique" value={m.shop_name}/><Fact label="Vendeur / entreprise" value={m.business_name}/><Fact label="Adresse de collecte" value={m.shop_address}/><Fact label="Acheteur" value={m.delivery_contact}/><Fact label="Téléphone" value={m.delivery_phone}/><Fact label="Adresse de livraison" value={m.delivery_address}/><Fact label="Date / heure" value={m.assigned_at?new Date(m.assigned_at).toLocaleString('fr-FR'):'—'}/>{m.delivery_notes&&<Fact label="Instructions" value={m.delivery_notes}/>}</div><div className="courier-actions">{(assignedMode || m.delivery_status === 'COURIER_ASSIGNED') &&<><button disabled={!!busy} className="courier-btn courier-btn-primary" onClick={()=>void act(`/courier/missions/${m.order_id}/accept`,undefined,t('courier.dashboard.accepted'))}>{isAccepting ? 'Acceptation...' : 'Accepter'}</button><button disabled={!!busy} className="courier-btn courier-btn-danger" onClick={()=>reject(m)}>{isRejecting ? 'Refus...' : 'Refuser'}</button></>}<button className="courier-btn courier-btn-quiet" onClick={()=>{setSelected(m);setView('detail')}}>Voir les détails<Icon name="arrow"/></button></div></article>
  }
 function ActiveMission({mission:m}:{mission:Mission}){const atDoor=HANDOVER_STATUSES.includes(m.delivery_status);return <section className="courier-glass courier-section"><Heading title={`Commande #${m.order_number}`} eyebrow="Mission active"/><MissionCard mission={m}/><div className="courier-timeline"><Timeline m={m}/></div><div className="courier-next"><Heading title="Prochaine action" eyebrow={t(`courier.status.${m.delivery_status}`)}/><ActionButtons mission={m}/></div>{/* At the door the handover - product check, cash, remise - is the next action, so it lives here rather than behind a page nothing links to. */}{atDoor&&<CourierHandoverPanel key={m.order_id} orderId={m.order_id}/>}<div className="courier-actions" style={{marginTop:12}}><button className="courier-btn courier-btn-quiet" onClick={()=>navigate(`/courier/missions/${m.order_id}`)}>Ouvrir la fiche mission<Icon name="arrow"/></button></div></section>}
 function Scanner(){const pickup=current&&['COURIER_ACCEPTED','READY_FOR_PICKUP'].includes(current.delivery_status)&&['READY','READY_FOR_PICKUP'].includes(current.status),delivery=current?.delivery_status==='COURIER_ARRIVED';return <section className="courier-scanner-grid"><ScanCard title="Chez le vendeur" body="Scannez le QR de collecte lorsque la commande est prête." enabled={!!pickup} onClick={()=>current&&scan('PICKUP',current)}/><ScanCard title="Chez l’acheteur" body="Scannez le QR de remise après avoir confirmé votre arrivée." enabled={!!delivery} onClick={()=>current&&scan('DELIVERY',current)}/>{!pickup&&!delivery&&<div className="courier-glass courier-empty-wide">Aucune mission ne nécessite un scan actuellement.</div>}</section>}
 function HistoryPanel(){return <section className="courier-glass courier-section"><Heading title="Historique des missions" eyebrow={`${history.length} élément${history.length===1?'':'s'}`}/>{historyError&&<SectionError message={historyError} retry={load}/>} {history.length?<div className="courier-history-list">{history.map(h=><article key={h.order_id}><Icon name="history"/><div><strong>Commande #{h.order_number}</strong><p>{h.shop_name} · {h.delivery_address}</p></div><div><span>{t(`courier.status.${h.final_status}`)}</span><time>{h.delivered_at?new Date(h.delivered_at).toLocaleDateString('fr-FR'):'—'}</time></div></article>)}</div>:!historyError&&<Empty title="Aucune livraison terminée." body="Vos missions terminées ou refusées apparaîtront ici."/>}</section>}
 function AvailabilityPanel(){return <section className="courier-glass courier-section courier-centered"><Heading title="Votre disponibilité" eyebrow="Statut en temps réel"/><div className={`courier-availability-orb ${profile?.availability==='AVAILABLE'?'is-online':''}`}><span/></div><h3>{profile?.status==='SUSPENDED'?'Compte suspendu':profile?.availability==='AVAILABLE'?'Vous êtes disponible':'Vous êtes indisponible'}</h3><p>{profile?.status==='SUSPENDED'?t('courier.dashboard.suspendedBody'):'Votre statut détermine si vous pouvez recevoir de nouvelles missions.'}</p><div className="courier-segmented">{(['AVAILABLE','UNAVAILABLE']as Availability[]).map(v=><button key={v} className={profile?.availability===v?'is-selected':''} disabled={busy==='availability'||profile?.status==='SUSPENDED'} onClick={()=>void availability(v)}>{t(`courier.availability.${v}`)}</button>)}</div></section>}
 function NotificationsPanel(){const handleNotificationClick=(n:Notice)=>{if(!n.is_read)void act(`/notifications/${n.id}/read`);if(n.reference_id && n.type==='COURIER_ASSIGNED'){const mission=missions.find(m=>m.order_id===n.reference_id);if(mission){setSelected(mission);setView('detail');return}navigate(`/courier/missions/${n.reference_id}`)}};return <section className="courier-glass courier-section"><Heading title="Notifications" eyebrow={`${unread} non lue${unread===1?'':'s'}`}/>{unread>0&&<button className="courier-btn courier-btn-quiet courier-read-all" onClick={()=>void act('/notifications/read-all',undefined,'Toutes les notifications sont marquées comme lues.')}>Tout marquer comme lu</button>}{noticeError&&<SectionError message={noticeError} retry={load}/>} {notices.length?<div className="courier-notices">{notices.map(n=><button key={n.id} className={!n.is_read?'is-unread':''} onClick={()=>void handleNotificationClick(n)}><Icon name="notifications"/><div><strong>{n.title}</strong><p>{n.body}</p><time>{new Date(n.created_at).toLocaleString('fr-FR')}</time></div></button>)}</div>:!noticeError&&<Empty title="Aucune notification." body="Vos mises à jour de mission apparaîtront ici."/>}</section>}
 function ProfilePanel(){const addressParts=[profile?.building_number,profile?.street,profile?.commune,profile?.city,profile?.province].filter(Boolean);return <section className="courier-glass courier-section"><div className="courier-profile-head"><div className="courier-avatar courier-avatar-large">{initials||'TB'}</div><div><h2>{profile?.first_name} {profile?.last_name}</h2><p>{profile?.email}</p></div></div><div className="courier-profile-grid"><Fact label="Prénom" value={profile?.first_name}/><Fact label="Nom" value={profile?.last_name}/><Fact label="E-mail" value={profile?.email}/><Fact label="Téléphone" value={profile?.phone}/><Fact label="Transport" value={profile?.transport_type}/><Fact label="Véhicule" value={profile?.vehicle_info}/><Fact label="Zone de service" value={profile?.service_zone}/><Fact label="Adresse" value={addressParts.length?addressParts.join(', '):'—'}/>{profile?.landmark&&<Fact label="Point de repère" value={profile?.landmark}/>}<Fact label="Statut" value={profile?.status}/></div></section>}
  function ActionButtons({mission:m}:{mission:Mission}){
    const isPickingUp = busy.includes(`/missions/${m.order_id}/pickup`)
    const isArriving = busy.includes(`/missions/${m.order_id}/arrive`)
    return (
      <div className="courier-actions">
        {['COURIER_ACCEPTED','READY_FOR_PICKUP'].includes(m.delivery_status) && ['READY','READY_FOR_PICKUP'].includes(m.status) && (
          <>
            <button disabled={!!busy} className="courier-btn courier-btn-primary" onClick={()=>void act(`/courier/missions/${m.order_id}/pickup`, undefined, 'Récupération confirmée.')}>
              {isPickingUp ? 'Confirmation...' : 'Confirmer la récupération'}
            </button>
            <button className="courier-btn courier-btn-scan" onClick={()=>scan('PICKUP',m)}>
              <Icon name="scanner"/>Scanner le QR vendeur
            </button>
          </>
        )}
        {m.delivery_status==='PICKED_UP' && (
          <button disabled={!!busy} className="courier-btn courier-btn-primary" onClick={()=>void act(`/courier/missions/${m.order_id}/start`,undefined,t('courier.dashboard.started'))}>
            {busy.includes(`/missions/${m.order_id}/start`) ? 'Démarrage...' : 'Commencer la livraison'}
          </button>
        )}
        {m.delivery_status==='IN_TRANSIT' && (
          <button disabled={!!busy} className="courier-btn courier-btn-primary" onClick={()=>void act(`/courier/missions/${m.order_id}/arrive`,undefined,t('courier.dashboard.arrived'))}>
            {isArriving ? 'Validation d\'arrivée...' : 'Je suis arrivé'}
          </button>
        )}
        {m.delivery_status==='COURIER_ARRIVED' && (
          <>
            <button disabled={!!busy} className="courier-btn courier-btn-primary" onClick={()=>navigate(`/courier/scan?type=DELIVERY&order_id=${m.order_id}`)}>
              <Icon name="scanner"/>Vérifier les produits
            </button>
            <button className="courier-btn courier-btn-scan" onClick={()=>scan('DELIVERY',m)}>
              <Icon name="scanner"/>Scanner le QR acheteur
            </button>
          </>
        )}
      </div>
    )
  }
}

function Heading({title,eyebrow}:{title:string;eyebrow:string}){return <div className="courier-heading"><div><p className="courier-eyebrow">{eyebrow}</p><h2>{title}</h2></div></div>}
function Stat({icon,value,label}:{icon:IconName;value:number;label:string}){return <article className="courier-glass courier-stat"><span><Icon name={icon}/></span><div><strong>{value}</strong><small>{label}</small></div></article>}
function Fact({label,value}:{label:string;value?:string}){return <div className="courier-fact"><small>{label}</small><strong>{value||'—'}</strong></div>}
function Empty({title,body}:{title:string;body:string}){return <div className="courier-empty"><Icon name="empty"/><strong>{title}</strong><p>{body}</p></div>}
function SectionError({message,retry}:{message:string;retry:()=>void|Promise<void>}){return <div className="courier-section-error" role="alert"><span>{message}</span><button onClick={()=>void retry()}>Réessayer</button></div>}
function ScanCard({title,body,enabled,onClick}:{title:string;body:string;enabled:boolean;onClick:()=>void}){return <article className="courier-glass courier-scan-card"><span><Icon name="scanner"/></span><h2>{title}</h2><p>{body}</p><button className="courier-btn courier-btn-scan" disabled={!enabled} onClick={onClick}>Scanner le QR</button></article>}
function Timeline({m}:{m:Mission}){const steps=[['Assignée',m.assigned_at],['Acceptée',m.accepted_at],['Prête',m.ready_at],['Récupérée',m.picked_up_at],['En route',m.started_at],['Arrivée',m.arrived_at],['Livrée',m.delivered_at]];return <ol>{steps.map(([label,at])=><li key={label} className={at?'is-done':''}><i/><div><strong>{label}</strong>{at&&<time>{new Date(at).toLocaleString('fr-FR')}</time>}</div></li>)}</ol>}
