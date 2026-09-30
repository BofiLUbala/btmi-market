// Every Direction overview figure must equal the total of the list it links to.
import { ROLE_ACCOUNTS, adminLogin, get } from '../scripts/e2e_admin_lib.mjs'

const dir = await adminLogin(ROLE_ACCOUNTS.DIRECTION_ADMIN)
const com = await adminLogin(ROLE_ACCOUNTS.COMMERCE_ADMIN)
const s = (await get('/admin/direction/overview', dir)).data
const total = async (path, tok) => (await get(path, tok)).data?.total

const rows = [
  ['users total', s.total_users, s.total_buyers + s.total_sellers + s.total_employees + s.total_couriers],
  ['buyers', s.total_buyers, await total('/admin/direction/users?account_type=BUYER&limit=1', dir)],
  ['sellers', s.total_sellers, await total('/admin/direction/users?account_type=SELLER&limit=1', dir)],
  ['employees', s.total_employees, await total('/admin/direction/users?account_type=EMPLOYEE&limit=1', dir)],
  ['shops total', s.total_shops, await total('/admin/commerce/shops?limit=1', com)],
  ['shops rows sum', s.total_shops, s.active_shops + s.inactive_shops + s.suspended_shops],
  ['active shops', s.active_shops, await total('/admin/commerce/shops?status=ACTIVE&limit=1', com)],
  ['businesses', s.total_businesses, await total('/admin/commerce/businesses?limit=1', com)],
  ['products total', s.total_products, await total('/admin/commerce/products?limit=1', com)],
  ['products rows sum', s.total_products, s.published_products + s.draft_products + s.archived_products],
  ['published', s.published_products, await total('/admin/commerce/products?publication_status=PUBLISHED&limit=1', com)],
  ['drafts', s.draft_products, await total('/admin/commerce/products?publication_status=DRAFT&limit=1', com)],
  ['out of stock', s.out_of_stock_products, await total('/admin/commerce/products?publication_status=PUBLISHED&stock_status=OUT_OF_STOCK&limit=1', com)],
  ['orders total', s.total_orders, await total('/admin/commerce/orders?limit=1', com)],
  ['orders today', s.orders_today, await total('/admin/commerce/orders?period=today&limit=1', com)],
]
let bad = 0
for (const [name, a, b] of rows) {
  const okRow = a === b
  if (!okRow) bad++
  console.log(`${okRow ? 'OK  ' : 'DIFF'} ${name.padEnd(18)} overview=${a} list=${b}`)
}
process.exit(bad ? 1 : 0)
