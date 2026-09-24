// Creates one order and walks it to PICKED_UP (seller ready, admin assign, courier accept + pickup).
import { execFileSync } from 'node:child_process'
const API='http://localhost:8080/api/v1', S=process.argv[2]||'1790207754829', PW='E2eTest!2026'
const sql=(q)=>execFileSync('docker',['exec','backend-postgres-1','psql','-U','btmi_user','-d','btmi_market','-t','-A','-F','|','-c',q]).toString().trim()
const call=async(m,p,tk,b)=>{const r=await fetch(API+p,{method:m,headers:{'Content-Type':'application/json',...(tk?{Authorization:`Bearer ${tk}`}:{})},body:b===undefined?undefined:JSON.stringify(b)});const j=await r.json().catch(()=>({}));if(r.status>=300)throw new Error(`${m} ${p} ${r.status} ${JSON.stringify(j)}`);return j.data??j}
const login=async(e,p=PW,a=false)=>(await call('POST',a?'/admin/auth/login':'/auth/login',null,{email:e,password:p})).access_token
const buyer=await login(`e2e_buyer_${S}@test.local`),seller=await login(`e2e_seller_${S}@test.local`),courier=await login(`e2e_courier_${S}@tbk.test`),admin=await login('commerce.test@tbkmarket.com','TestAdmin@2025!',true)
const [pid,vid,sid]=sql(`SELECT p.id,v.id,i.shop_id FROM products p JOIN product_variants v ON v.product_id=p.id JOIN inventory i ON i.variant_id=v.id WHERE p.name='E2E Test Sneakers ${S}' AND v.name='Black / 40'`).split('|')
const cid=sql(`SELECT id FROM users WHERE email='e2e_courier_${S}@tbk.test'`)
const id=(await call('POST','/buyer/checkout',buyer,{items:[{product_id:pid,variant_id:vid,shop_id:sid,quantity:1}],use_points:false,idempotency_key:`ui-${Date.now()}`})).order_ids[0]
await call('POST',`/buyer/orders/${id}/delivery`,buyer,{method:'TBK_STANDARD',use_points_for_delivery:false,contact_name:'E2E Buyer',phone:'+243817754829',province:'Kinshasa',city:'Kinshasa',commune:'Gombe',street:'Avenue UI',building_number:'3',landmark:'test UI'})
await call('POST',`/buyer/orders/${id}/payment`,buyer,{payment_method:'CASH_ON_DELIVERY'})
for (const s of ['accept','prepare']) await call('POST',`/orders/${id}/${s}`,seller,{})
await call('POST',`/orders/${id}/tracking/status`,seller,{status:'READY'})
await call('POST',`/admin/commerce/orders/${id}/assign-courier`,admin,{courier_id:cid})
await call('POST',`/courier/missions/${id}/accept`,courier,{}); await call('POST',`/courier/missions/${id}/pickup`,courier,{})
if (process.argv[3]==='door') { await call('POST',`/courier/missions/${id}/expected-delivery`,courier,{date:new Date(Date.now()+3600e3).toISOString().slice(0,10),slot:'EVENING'}); for (const s of ['start','arrive']) await call('POST',`/courier/missions/${id}/${s}`,courier,{}) }
console.log(JSON.stringify({id, ...Object.fromEntries(['number','oi','var','sku'].map((k,i)=>[k, sql(`SELECT o.order_number, 'OI-'||UPPER(LEFT(q.public_reference::text,8)), 'VAR-'||UPPER(LEFT(pq.public_reference::text,8)), v.sku FROM orders o JOIN order_lines ol ON ol.order_id=o.id JOIN order_item_qr_codes q ON q.order_line_id=ol.id JOIN product_variants v ON v.id=ol.variant_id LEFT JOIN product_qr_codes pq ON pq.variant_id=ol.variant_id WHERE o.id='${id}'`).split('|')[i]]))}))
