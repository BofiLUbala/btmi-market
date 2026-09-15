const base='http://localhost:8080/api/v1'
async function call(path, token, method='GET', body){
  const r=await fetch(base+path,{method,headers:{'content-type':'application/json',...(token?{authorization:`Bearer ${token}`}:{})},body:body?JSON.stringify(body):undefined})
  const j=await r.json().catch(()=>({}))
  if(!r.ok) throw new Error(`${path} ${r.status} ${JSON.stringify(j).slice(0,200)}`)
  return j.data??j
}
const seller = await call('/auth/login',null,'POST',{email:'seller_rt_1789261221@test.com',password:'StrongPassword123!'})
const admin  = await call('/admin/auth/login',null,'POST',{email:'finance.runtime@tbk.test',password:'FinanceRuntime123!'})
const st=seller.access_token, at=admin.access_token, sellerId=seller.user.id

// buyer delivery status (regression check)
const buyer = await call('/auth/login',null,'POST',{email:'buyer_rt_1789261221@test.com',password:'StrongPassword123!'})
const bo = await call('/buyer/orders/907b4032-ff7e-49b8-ac54-378b39266303', buyer.access_token)
console.log('BUYER delivery_status =', JSON.stringify(bo.order.delivery_status), '| order', bo.order.order_number, '| status', bo.order.status)

const before = await call('/seller/finances/dashboard', st)
console.log('BEFORE  seller due/collected:', before.due_commission, '/', before.collected_commission)

const list = await call('/seller/finances/sales?limit=50', st)
const target = list.sales.find(s=>s.order_number==='BTMI-1149')
console.log('TARGET  ', target.order_number, 'commission', target.commission_amount, 'status', target.status, 'payment', target.payment_status)

await call(`/admin/finance/commissions/${target.id}/collect`, at, 'POST', {notes:'runtime verification'})

const afterS = await call('/seller/finances/dashboard', st)
const afterA = await call(`/admin/finance/dashboard?seller_id=${sellerId}`, at)
console.log('AFTER   seller due/collected:', afterS.due_commission, '/', afterS.collected_commission)
console.log('AFTER   admin  due/collected:', afterA.due_commission, '/', afterA.collected_commission)
const row = (await call('/seller/finances/sales?limit=50', st)).sales.find(s=>s.order_number==='BTMI-1149')
console.log('AFTER   row status:', row.status, '| payment_status:', row.payment_status)

// isolation: another seller must not read this sale
const other = await call('/auth/login',null,'POST',{email:'seller.unify@example.com',password:'StrongPassword123!'}).catch(e=>null)
if (other) {
  try { await call(`/seller/finances/sales/${target.order_id}`, other.access_token); console.log('ISOLATION: FAIL (other seller could read it)') }
  catch(e){ console.log('ISOLATION: blocked ->', String(e.message).slice(0,80)) }
} else console.log('ISOLATION: other seller login unavailable')
