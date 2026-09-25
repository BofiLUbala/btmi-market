// Finishes an order at the door: courier scans the buyer QR, buyer acknowledges and confirms.
const API='http://localhost:8080/api/v1', id=process.argv[2], PW='E2eTest!2026', S='1790207754829'
const call=async(m,p,tk,b)=>{const r=await fetch(API+p,{method:m,headers:{'Content-Type':'application/json',...(tk?{Authorization:`Bearer ${tk}`}:{})},body:b===undefined?undefined:JSON.stringify(b)});const j=await r.json().catch(()=>({}));if(r.status>=300)throw new Error(`${m} ${p} ${r.status} ${JSON.stringify(j)}`);return j.data??j}
const login=async(e)=>(await call('POST','/auth/login',null,{email:e,password:PW})).access_token
const buyer=await login(`e2e_buyer_${S}@test.local`), courier=await login(`e2e_courier_${S}@tbk.test`)
const qr=await call('GET',`/buyer/orders/${id}/delivery-qr`,buyer)
await call('POST','/courier/scans/delivery',courier,{token:qr.token,order_id:id,idempotency_key:`fin-${id}`})
const ho=await call('GET',`/buyer/orders/${id}/handover`,buyer)
await call('POST',`/buyer/orders/${id}/handover/acknowledge`,buyer,{lines:ho.lines.map(l=>({order_line_id:l.order_line_id,product_received:true,matches_order:true,quantity_correct:true}))})
await call('POST',`/buyer/orders/${id}/confirm-receipt`,buyer)
console.log('done')
