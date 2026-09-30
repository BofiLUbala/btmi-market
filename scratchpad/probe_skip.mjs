import { readFileSync } from 'node:fs'
import { post, get, adminLogin, ROLE_ACCOUNTS } from '../scripts/e2e_admin_lib.mjs'
const a = JSON.parse(readFileSync(process.argv[2], 'utf8'))
const O = process.argv[3]
const login = async (e, p) => (await post('/auth/login', undefined, { email: e, password: p })).json?.access_token
const seller = await login(a.sellerEmail, a.password)
const courier = await login(a.courierEmail, a.password)
const other = await login(a.buyerEmail, a.password)
const grace = await login(a.uiBuyerEmail, a.uiBuyerPassword)
const fin = await adminLogin(ROLE_ACCOUNTS.FINANCE_SUPPORT_ADMIN)
const show = (label, r, expectRefused = true) => {
  const code = r.json?.error?.code || r.json?.code || ''
  const ok = expectRefused ? r.status >= 400 : r.status < 300
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label} -> ${r.status} ${code}`)
}
show('autre acheteur lit la commande de Grace', await get(`/buyer/orders/${O}`, other))
show('autre acheteur lit son suivi', await get(`/buyer/orders/${O}/tracking`, other))
show('Grace lit sa commande', await get(`/buyer/orders/${O}`, grace), false)
show('vendeur saute PENDING->READY', await post(`/orders/${O}/tracking/status`, seller, { status: 'READY' }))
show('vendeur saute PENDING->OUT_FOR_DELIVERY', await post(`/orders/${O}/tracking/status`, seller, { status: 'OUT_FOR_DELIVERY' }))
show('vendeur marque DELIVERED', await post(`/orders/${O}/tracking/status`, seller, { status: 'DELIVERED' }))
show('Grace confirme reçu avant livraison', await post(`/buyer/orders/${O}/received`, grace, {}))
show('livreur non assigné accepte la mission', await post(`/courier/missions/${O}/accept`, courier, {}))
show('livreur non assigné confirme pickup', await post(`/courier/missions/${O}/pickup`, courier, {}))
show('acheteur appelle assign-courier admin', await post(`/admin/commerce/orders/${O}/assign-courier`, grace, { courier_id: '00000000-0000-0000-0000-000000000000' }))
show('admin FINANCE appelle assign-courier (mauvais rôle)', await post(`/admin/commerce/orders/${O}/assign-courier`, fin, { courier_id: '00000000-0000-0000-0000-000000000000' }))
show('vendeur lit la finance admin', await get(`/admin/finance/dashboard`, seller))
