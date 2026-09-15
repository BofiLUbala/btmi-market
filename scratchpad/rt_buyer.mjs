const base='http://localhost:8080/api/v1'
async function call(path, token, method='GET', body){
  const r=await fetch(base+path,{method,headers:{'content-type':'application/json',...(token?{authorization:`Bearer ${token}`}:{})},body:body?JSON.stringify(body):undefined})
  const j=await r.json().catch(()=>({}))
  if(!r.ok) throw new Error(`${path} ${r.status} ${JSON.stringify(j).slice(0,200)}`)
  return j.data??j
}
const orderId='907b4032-ff7e-49b8-ac54-378b39266303'
const buyer = await call('/auth/login',null,'POST',{email:'buyer_rt_1789261221@test.com',password:'StrongPassword123!'})
const o = await call(`/buyer/orders/${orderId}`, buyer.access_token)
console.log('BUYER ORDER:', JSON.stringify({order:o.order, lines:o.lines||o.order?.lines}, null, 1).slice(0,1800))
