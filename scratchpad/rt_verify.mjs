const base='http://localhost:8080/api/v1'
async function call(path, token, method='GET', body){
  const r=await fetch(base+path,{method,headers:{'content-type':'application/json',...(token?{authorization:`Bearer ${token}`}:{})},body:body?JSON.stringify(body):undefined})
  const j=await r.json().catch(()=>({}))
  if(!r.ok) throw new Error(`${path} ${r.status} ${JSON.stringify(j).slice(0,300)}`)
  return j.data??j
}
const out = {}
const seller = await call('/auth/login',null,'POST',{email:'seller_rt_1789261221@test.com',password:'StrongPassword123!'})
const admin  = await call('/admin/auth/login',null,'POST',{email:'finance.runtime@tbk.test',password:'FinanceRuntime123!'})
const st = seller.access_token, at = admin.access_token
const sellerId = seller.user?.id

out.seller_dashboard  = await call('/seller/finances/dashboard', st)
out.seller_summary    = await call('/seller/finances/summary', st)
out.admin_seller_dash = await call(`/admin/finance/dashboard?seller_id=${sellerId}`, at)
out.admin_global_dash = await call('/admin/finance/dashboard', at)

const sales = await call('/seller/finances/sales?limit=50', st)
out.seller_sales_total = sales.total
out.seller_sales = sales.sales.map(s=>({n:s.order_number, gross:s.gross_amount, comm:s.commission_amount, net:s.seller_net_amount, cur:s.currency, st:s.status, pay:s.payment_status, del:s.delivery_status, qty:s.total_quantity, buyer:s.buyer_name}))

const adminList = await call(`/admin/finance/commissions?seller_id=${sellerId}&limit=50`, at)
out.admin_sales_total = adminList.total
out.admin_sales = adminList.commissions.map(s=>({n:s.order_number, gross:s.gross_amount, comm:s.commission_amount, net:s.seller_net_amount, cur:s.currency, st:s.status}))

out.seller_shop_breakdown    = await call('/seller/finances/breakdown?group=shop', st)
out.seller_product_breakdown = await call('/seller/finances/breakdown?group=product', st)
out.admin_shop_breakdown     = await call(`/admin/finance/breakdown?group=shop&seller_id=${sellerId}`, at)
out.admin_product_breakdown  = await call(`/admin/finance/breakdown?group=product&seller_id=${sellerId}`, at)

const orderId = sales.sales[0].order_id
out.seller_detail = await call(`/seller/finances/sales/${orderId}`, st)
out.admin_detail  = await call(`/admin/finance/commissions/order/${orderId}`, at)
console.log(JSON.stringify(out,null,2))
