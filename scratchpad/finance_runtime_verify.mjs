const base='http://localhost:8080/api/v1', orderId='907b4032-ff7e-49b8-ac54-378b39266303'
async function call(path, token, method='GET', body){const r=await fetch(base+path,{method,headers:{'content-type':'application/json',...(token?{authorization:`Bearer ${token}`}:{})},body:body?JSON.stringify(body):undefined});const j=await r.json();if(!r.ok)throw new Error(`${path} ${r.status} ${JSON.stringify(j)}`);return j.data??j}
async function login(email,password){return call('/auth/login',null,'POST',{email,password})}
async function adminLogin(email,password){return call('/admin/auth/login',null,'POST',{email,password})}
const seller=await login('seller_rt_1789261221@test.com','StrongPassword123!')
const buyer=await login('buyer_rt_1789261221@test.com','StrongPassword123!')
const admin=await adminLogin('finance.runtime@tbk.test','FinanceRuntime123!')
const sellerDetail=await call(`/seller/finances/sales/${orderId}`,seller.access_token)
const adminDetail=await call(`/admin/finance/commissions/order/${orderId}`,admin.access_token)
const sellerDash=await call('/seller/finances/dashboard',seller.access_token)
const adminDash=await call(`/admin/finance/dashboard?seller_id=${sellerDetail.sale.seller_user_id}`,admin.access_token)
const buyerOrder=await call(`/buyer/orders/${orderId}`,buyer.access_token)
console.log(JSON.stringify({sellerDetail,adminDetail,sellerDash,adminDash,buyerOrder:{order:buyerOrder.order,lines:buyerOrder.lines}},null,2))
