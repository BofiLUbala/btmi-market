const base='http://localhost:8080/api/v1'
async function call(path, token, method='GET', body){
  const r=await fetch(base+path,{method,headers:{'content-type':'application/json',...(token?{authorization:`Bearer ${token}`}:{})},body:body?JSON.stringify(body):undefined})
  const j=await r.json().catch(()=>({}))
  if(!r.ok) throw new Error(`${path} ${r.status} ${JSON.stringify(j).slice(0,300)}`)
  return j.data??j
}
const seller = await call('/auth/login',null,'POST',{email:'seller_rt_1789261221@test.com',password:'StrongPassword123!'})
console.log('SELLER LOGIN OK', seller.user?.id || seller.user_id || '')
const sales = await call('/seller/finances/sales?limit=50', seller.access_token)
console.log('TOTAL SALES:', sales.total)
console.log('FIRST ROW:', JSON.stringify(sales.sales?.[0], null, 2))
