// One product with 4 buyer-selectable variants in every marketplace category,
// created through the same API sequence as the seller product form
// (DRAFT product -> default variant + 3 more -> shop stock -> attribute sync ->
// PUBLISHED), then checked from the buyer side: public detail, cart preview
// and a real checkout of one chosen variant per category.
//   E2E_API_BASE=http://127.0.0.1:8080/api/v1 node scripts/e2e_category_variants.mjs
import { spawnSync } from 'node:child_process'
import { createHash, randomBytes } from 'node:crypto'
import { get, post, patch, errText } from './e2e_admin_lib.mjs'

const PG = process.env.E2E_PG_CONTAINER || 'backend-postgres-1'
const stamp = Date.now().toString(36)
const password = `Cat!Pass-${stamp}-7`
const ADDR = { province: 'Kinshasa', city: 'Kinshasa', commune: 'Gombe', street: 'Avenue du Commerce', building_number: '8', landmark: 'Près de la poste' }
const phone = () => `+2438${Math.floor(1e7 + Math.random() * 9e7)}`
const log = (...a) => console.error(...a)
const must = (label, r) => { if (!r || r.status >= 300) throw new Error(`${label}: ${errText(r)}`); return r }

function psql(sql) {
  const r = spawnSync('docker', ['exec', PG, 'psql', '-U', 'btmi_user', '-d', 'btmi_market', '-t', '-A', '-c', sql], { encoding: 'utf8' })
  if (r.status !== 0) throw new Error(`psql: ${r.stderr}`)
  return (r.stdout || '').trim()
}
async function activate(email) {
  const raw = randomBytes(32).toString('hex')
  const hash = createHash('sha256').update(raw).digest('hex')
  const id = psql(`SELECT id FROM users WHERE email='${email}'`)
  psql(`INSERT INTO account_activation_tokens (user_id, token_hash, purpose, expires_at) VALUES ('${id}', '${hash}', 'ACTIVATION', NOW() + interval '1 hour')`)
  must(`activate ${email}`, await get(`/auth/activate?token=${raw}`))
}
const login = async (email) => (await post('/auth/login', undefined, { email, password })).json?.access_token

/* One realistic product per category. `product` holds the product-level
   characteristics (copied onto every variant, as the form does); each variant
   differs by the category's variant dimensions. */
const SPECS = {
  fashion: {
    sub: 'clothing', name: 'Chemise en lin col mao', unit: 'PCS', price: 24,
    description: 'Chemise légère en lin lavé, coupe droite, idéale pour la chaleur de Kinshasa.\n\n## Matière et entretien\nLin 100 %. Lavage 30 °C.',
    product: { Material: 'Lin', Gender: 'Homme' },
    variants: [{ Color: 'Blanc', Size: 'M' }, { Color: 'Blanc', Size: 'L' }, { Color: 'Bleu ciel', Size: 'M' }, { Color: 'Bleu ciel', Size: 'L' }],
  },
  shoes: {
    sub: 'running', name: 'Chaussure de course Kivu Run', unit: 'PAIRE', price: 58,
    description: 'Chaussure de running amortie, semelle adhérente pour routes et pistes.',
    product: { Material: 'Mesh respirant', Gender: 'Mixte' },
    variants: [{ Color: 'Noir', 'Shoe Size': '41' }, { Color: 'Noir', 'Shoe Size': '42' }, { Color: 'Rouge', 'Shoe Size': '41' }, { Color: 'Rouge', 'Shoe Size': '42' }],
  },
  children: {
    sub: 'clothing', name: 'Ensemble coton enfant', unit: 'PCS', price: 15,
    description: 'Tee-shirt et short en coton doux pour les enfants.',
    product: { 'Age Range': '4-8 ans' },
    variants: [{ Size: '4 ans', Color: 'Jaune' }, { Size: '6 ans', Color: 'Jaune' }, { Size: '4 ans', Color: 'Vert' }, { Size: '6 ans', Color: 'Vert' }],
  },
  electronics: {
    sub: 'phones', name: 'Smartphone Congo X5', unit: 'PCS', price: 189,
    description: 'Smartphone double SIM, grand écran et batterie longue durée.',
    product: { Model: 'X5 2026' },
    variants: [{ Storage: '64 Go', RAM: '4 Go', Color: 'Noir' }, { Storage: '128 Go', RAM: '4 Go', Color: 'Noir' }, { Storage: '128 Go', RAM: '6 Go', Color: 'Bleu' }, { Storage: '256 Go', RAM: '8 Go', Color: 'Bleu' }],
    prices: [189, 219, 239, 279],
  },
  home: {
    sub: 'furniture', name: 'Étagère murale en bois', unit: 'PCS', price: 42,
    description: 'Étagère murale en bois massif, fixations fournies.',
    product: { Dimensions: '80 x 20 x 18 cm', Material: 'Bois de sapelli' },
    variants: [{ Color: 'Naturel', Capacity: '2 niveaux' }, { Color: 'Naturel', Capacity: '3 niveaux' }, { Color: 'Wengé', Capacity: '2 niveaux' }, { Color: 'Wengé', Capacity: '3 niveaux' }],
    prices: [42, 55, 45, 58],
  },
  beauty: {
    sub: 'skincare', name: 'Beurre de karité parfumé', unit: 'POT', price: 9,
    description: 'Beurre de karité pur, nourrissant pour la peau et les cheveux.',
    product: { 'Skin Type': 'Tous types' },
    variants: [{ Volume: '100 ml', Scent: 'Nature' }, { Volume: '250 ml', Scent: 'Nature' }, { Volume: '100 ml', Scent: 'Vanille' }, { Volume: '250 ml', Scent: 'Vanille' }],
    prices: [9, 18, 10, 20],
  },
  food: {
    sub: 'beverages', name: 'Jus de gingembre artisanal', unit: 'BOUTEILLE', price: 3,
    description: 'Jus de gingembre pressé, peu sucré, fabriqué à Kinshasa.',
    product: { 'Expiration Date': '2027-03-31' },
    variants: [{ Flavor: 'Nature', Volume: '50 cl' }, { Flavor: 'Nature', Volume: '1 L' }, { Flavor: 'Citron', Volume: '50 cl' }, { Flavor: 'Citron', Volume: '1 L' }],
    prices: [3, 5, 3.5, 5.5],
  },
  sport: {
    sub: 'fitness', name: 'Tapis de yoga antidérapant', unit: 'PCS', price: 22,
    description: 'Tapis de yoga épais et antidérapant, avec sangle de transport.',
    product: { Weight: '1,2 kg' },
    variants: [{ Size: 'Standard', Color: 'Violet' }, { Size: 'Large', Color: 'Violet' }, { Size: 'Standard', Color: 'Gris' }, { Size: 'Large', Color: 'Gris' }],
    prices: [22, 27, 22, 27],
  },
  automotive: {
    sub: 'parts', name: 'Huile moteur synthétique 5W-30', unit: 'BIDON', price: 16,
    description: 'Huile moteur synthétique pour moteurs essence et diesel.',
    product: { 'Model Compatibility': 'Toyota, Nissan, Hyundai' },
    variants: [{ Capacity: '1 L', Size: 'Standard' }, { Capacity: '4 L', Size: 'Standard' }, { Capacity: '1 L', Size: 'Pro' }, { Capacity: '4 L', Size: 'Pro' }],
    prices: [16, 52, 19, 60],
  },
  services: {
    sub: 'repair', name: 'Réparation d’écran de téléphone', unit: 'SERVICE', price: 25,
    description: 'Remplacement d’écran réalisé en atelier, garantie 3 mois.',
    product: {},
    // No variant dimension exists for Services: the buyer picks by name.
    variants: [{}, {}, {}, {}],
    names: ['Écran standard', 'Écran premium', 'Écran + vitre arrière', 'Intervention express'],
    prices: [25, 40, 55, 35],
  },
}
const STOCKS = [12, 7, 3, 20]

const results = []
const record = (category, step, ok, detail = '') => {
  results.push({ category, step, ok, detail })
  log(`${ok ? 'OK ' : 'ERR'} [${category}] ${step}${detail ? ` - ${detail}` : ''}`)
}

/* ---------- actors ---------- */
const sellerEmail = `cat.vendeur.${stamp}@tbk.test`
const buyerEmail = `cat.acheteur.${stamp}@tbk.test`
must('seller registers', await post('/auth/register/seller', undefined, { first_name: 'Grâce', last_name: 'Mukendi', phone: phone(), email: sellerEmail, password, password_confirmation: password, ...ADDR }))
must('buyer registers', await post('/auth/register', undefined, { first_name: 'Jonas', last_name: 'Ilunga', phone: phone(), email: buyerEmail, password, password_confirmation: password, ...ADDR }))
await activate(sellerEmail)
await activate(buyerEmail)
const seller = await login(sellerEmail)
const buyer = await login(buyerEmail)
await post('/buyer/profile', buyer, { first_name: 'Jonas', last_name: 'Ilunga', phone: phone(), email: buyerEmail, ...ADDR })
const biz = must('business', await post('/businesses', seller, { name: `Mukendi Multi-Rayons ${stamp}`, business_type: 'RETAIL', category: 'general', phone: phone(), email: sellerEmail, country: 'DRC', default_currency: 'USD', ...ADDR }))
const shop = must('shop', await post(`/businesses/${biz.data.id}/shops`, seller, { name: 'Mukendi Rayons Gombe', type: 'PHYSICAL', phone: phone(), address: '8 Avenue du Commerce, Gombe', ...ADDR }))
const businessId = biz.data.id
const shopId = shop.data.id
log(`seller ${sellerEmail} / buyer ${buyerEmail} / shop ${shopId}`)

const categories = (await get('/categories?with_subcategories=true')).data.filter((c) => SPECS[c.slug])
const created = []

for (const cat of categories) {
  const spec = SPECS[cat.slug]
  const sub = (cat.subcategories || []).find((s) => s.slug === spec.sub) || (cat.subcategories || [])[0]
  try {
    /* 1. DRAFT product, exactly like the form */
    const p = await post(`/businesses/${businessId}/products`, seller, {
      name: spec.name, description: spec.description, unit: spec.unit,
      unit_price: spec.price, cost_price: Math.round(spec.price * 0.6 * 100) / 100,
      category_id: cat.id, subcategory_id: sub?.id, publication_status: 'DRAFT',
      self_rating: 4, idempotency_key: `cat-${stamp}-${cat.slug}`,
      discount_active: false, discount_type: 'NONE', discount_value: 0,
    })
    if (p.status >= 300) { record(cat.slug, 'create product', false, errText(p)); continue }
    const productId = p.data.id
    record(cat.slug, 'create product', true, productId)

    /* 2. default variant, then the 3 others */
    const existing = (await get(`/businesses/${businessId}/products/${productId}/variants`, seller)).data || []
    let first = existing[0]
    if (!first) {
      const d = await post(`/businesses/${businessId}/products/${productId}/variants`, seller, { name: spec.name, sale_price: spec.price, unit: spec.unit })
      if (d.status >= 300) { record(cat.slug, 'default variant', false, errText(d)); continue }
      first = d.data
    }
    const variantIds = []
    let failed = false
    for (let i = 0; i < 4; i++) {
      const attrs = { ...spec.product, ...spec.variants[i] }
      const label = spec.names?.[i] || Object.values(spec.variants[i]).join(' / ') || `Variante ${i + 1}`
      const payload = {
        name: `${spec.name} — ${label}`, sku: `${cat.slug.slice(0, 4).toUpperCase()}-${stamp}-${i + 1}`,
        attributes: attrs, sale_price: spec.prices?.[i] ?? spec.price,
        purchase_price: Math.round(spec.price * 0.6 * 100) / 100, unit: spec.unit,
      }
      const r = i === 0
        ? await patch(`/variants/${first.id}`, seller, payload)
        : await post(`/businesses/${businessId}/products/${productId}/variants`, seller, payload)
      if (r.status >= 300) { record(cat.slug, `variant ${i + 1}`, false, errText(r)); failed = true; break }
      variantIds.push(r.data.id)
    }
    if (failed) continue
    record(cat.slug, '4 variants', true)

    /* 3. shop stock per variant */
    for (let i = 0; i < 4; i++) {
      const s = await post(`/shops/${shopId}/stock`, seller, { variant_id: variantIds[i], quantity: STOCKS[i], notes: 'Stock initial' })
      if (s.status >= 300) { record(cat.slug, `stock variant ${i + 1}`, false, errText(s)); failed = true; break }
    }
    if (failed) continue
    record(cat.slug, 'stock', true)

    /* 4. publish */
    const pub = await patch(`/businesses/${businessId}/products/${productId}`, seller, { publication_status: 'PUBLISHED' })
    if (pub.status >= 300) { record(cat.slug, 'publish', false, errText(pub)); continue }
    record(cat.slug, 'publish', true)
    created.push({ category: cat.slug, productId, variantIds, spec })
  } catch (err) {
    record(cat.slug, 'exception', false, err.message)
  }
}

/* ---------- buyer side ---------- */
for (const c of created) {
  const { category, productId, variantIds, spec } = c
  const d = await get(`/marketplace/products/${productId}/detail`, buyer)
  if (d.status >= 300) { record(category, 'buyer detail', false, errText(d)); continue }
  const vs = d.data.variants || []
  const problems = []
  if (vs.length !== 4) problems.push(`${vs.length} variants instead of 4`)
  for (let i = 0; i < 4; i++) {
    const v = vs.find((x) => x.id === variantIds[i])
    if (!v) { problems.push(`variant ${i + 1} missing`); continue }
    if (v.stock_quantity !== STOCKS[i]) problems.push(`variant ${i + 1} stock ${v.stock_quantity} != ${STOCKS[i]}`)
    for (const [k, val] of Object.entries(spec.variants[i])) if (v.attributes?.[k] !== val) problems.push(`variant ${i + 1} ${k}=${v.attributes?.[k]}`)
  }
  if (d.data.shop_id !== shopId) problems.push(`shop ${d.data.shop_id} != ${shopId}`)
  record(category, 'buyer sees 4 selectable variants', problems.length === 0, problems.join('; '))

  // The buyer picks the 3rd variant (a different combination than the default).
  const chosen = variantIds[2]
  const line = { product_id: productId, variant_id: chosen, shop_id: shopId, quantity: 2 }
  const pv = await post('/buyer/cart/preview', buyer, { items: [line], use_points: false })
  const issues = pv.data?.issues || pv.data?.line_issues || []
  record(category, 'cart preview of chosen variant', pv.status < 300 && issues.length === 0, pv.status < 300 ? (issues.length ? JSON.stringify(issues) : '') : errText(pv))

  const co = await post('/buyer/checkout', buyer, { items: [line], use_points: false, idempotency_key: `cat-co-${stamp}-${category}` })
  if (co.status >= 300) { record(category, 'checkout chosen variant', false, errText(co)); continue }
  const orderId = co.data?.orders?.[0]?.id || co.data?.orders?.[0]?.order?.id || co.data?.order_ids?.[0]
  let lineOk = true, detail = ''
  if (orderId) {
    const o = await get(`/buyer/orders/${orderId}`, buyer)
    const lines = o.data?.lines || o.data?.order_lines || []
    const l = lines[0]
    lineOk = Boolean(l && l.variant_id === chosen && l.quantity === 2)
    detail = l ? `line variant=${l.variant_id === chosen ? 'chosen' : l.variant_id} qty=${l.quantity} attrs=${JSON.stringify(l.variant_attributes || {})}` : 'no line'
  } else {
    lineOk = false
    detail = `no order id in ${JSON.stringify(co.data).slice(0, 200)}`
  }
  record(category, 'checkout chosen variant', lineOk, detail)
}

const failures = results.filter((r) => !r.ok)
console.log(JSON.stringify({
  stamp, password, sellerEmail, buyerEmail, businessId, shopId,
  products: created.map((c) => ({ category: c.category, productId: c.productId })),
  failures,
}, null, 2))
