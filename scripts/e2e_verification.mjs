import http from 'http';

const API_HOST = 'localhost';
const API_PORT = 8080;

function request(method, path, body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const req = http.request({
      hostname: API_HOST,
      port: API_PORT,
      path,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {}),
        ...headers,
      }
    }, (res) => {
      let chunks = '';
      res.on('data', d => chunks += d);
      res.on('end', () => {
        let parsed = null;
        try {
          parsed = chunks ? JSON.parse(chunks) : null;
        } catch {
          parsed = chunks;
        }
        resolve({ status: res.statusCode, headers: res.headers, data: parsed });
      });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

const results = [];
function assert(name, condition, details = '') {
  if (condition) {
    console.log(`[PASS] ${name}`);
    results.push({ name, pass: true });
  } else {
    console.error(`[FAIL] ${name} - ${details}`);
    results.push({ name, pass: false, details });
  }
}

async function run() {
  console.log('=== STARTING REAL E2E & REGRESSION TEST SUITE ===\n');

  // 1. Health check
  const health = await request('GET', '/health');
  assert('API Health Check', health.status === 200 && health.data.status === 'ok');

  // 2. Admin Authentication
  console.log('\n--- Authenticating Admin & Seller ---');
  const adminLogin = await request('POST', '/api/v1/admin/auth/login', {
    email: 'admin@tbk.market',
    password: 'SuperSecretAdmin2026!'
  });
  assert('Admin Login', adminLogin.status === 200 && !!adminLogin.data?.data?.access_token);
  const adminToken = adminLogin.data?.data?.access_token;
  const adminHeaders = { 'Authorization': `Bearer ${adminToken}` };

  // Seller Authentication
  const sellerLogin = await request('POST', '/api/v1/auth/login', {
    email: 'bofigauthier3@gmail.com',
    password: 'SuperSecretAdmin2026!'
  });
  assert('Seller Login', sellerLogin.status === 200 && !!sellerLogin.data?.access_token);
  const sellerToken = sellerLogin.data?.access_token;
  const sellerHeaders = { 'Authorization': `Bearer ${sellerToken}` };

  // Get Seller business ID
  const businessRes = await request('GET', '/api/v1/businesses', null, sellerHeaders);
  const businesses = businessRes.data?.data || businessRes.data || [];
  const businessId = businesses[0]?.id;
  assert('Seller Business Retrieval', !!businessId, `Business ID: ${businessId}`);

  // Get categories to link product
  const catRes = await request('GET', '/api/v1/categories', null, sellerHeaders);
  const categories = catRes.data?.data || catRes.data || [];
  const categoryId = categories[0]?.id;
  assert('Category Retrieval', !!categoryId, `Category ID: ${categoryId}`);

  // ==========================================
  // 3. BUG 2 — DISCOUNT WRITE PATH VALIDATION
  // ==========================================
  console.log('\n--- BUG 2: Testing Discount Write Path ---');

  // Test invalid discount type
  const badType = await request('POST', `/api/v1/businesses/${businessId}/products`, {
    name: 'Invalid Discount Type Test',
    sku: `SKU-BADTYPE-${Date.now()}`,
    unit_price: 100,
    cost_price: 50,
    unit: 'PIECE',
    category_id: categoryId,
    discount_active: true,
    discount_type: 'INVALID_TYPE',
    discount_value: 20
  }, sellerHeaders);
  assert('Reject Invalid Discount Type', badType.status === 400 && (badType.data?.error?.code === 'INVALID_DISCOUNT_TYPE' || badType.data?.error?.message === 'INVALID_DISCOUNT_TYPE'), `Status: ${badType.status}, Error: ${JSON.stringify(badType.data)}`);

  // Test invalid percentage discount (> 100)
  const badPercent = await request('POST', `/api/v1/businesses/${businessId}/products`, {
    name: 'Invalid Percent Discount Test',
    sku: `SKU-BADPCT-${Date.now()}`,
    unit_price: 100,
    cost_price: 50,
    unit: 'PIECE',
    category_id: categoryId,
    discount_active: true,
    discount_type: 'PERCENTAGE',
    discount_value: 150
  }, sellerHeaders);
  assert('Reject Percentage Discount > 100', badPercent.status === 400 && (badPercent.data?.error?.code === 'INVALID_DISCOUNT_VALUE' || badPercent.data?.error?.message === 'INVALID_DISCOUNT_VALUE'), `Status: ${badPercent.status}`);

  // Test invalid fixed discount (>= unit_price)
  const badFixed = await request('POST', `/api/v1/businesses/${businessId}/products`, {
    name: 'Invalid Fixed Discount Test',
    sku: `SKU-BADFIX-${Date.now()}`,
    unit_price: 100,
    cost_price: 50,
    unit: 'PIECE',
    category_id: categoryId,
    discount_active: true,
    discount_type: 'FIXED',
    discount_value: 120
  }, sellerHeaders);
  assert('Reject Fixed Discount >= Unit Price', badFixed.status === 400 && (badFixed.data?.error?.code === 'INVALID_DISCOUNT_VALUE' || badFixed.data?.error?.message === 'INVALID_DISCOUNT_VALUE'), `Status: ${badFixed.status}`);

  // Create product with VALID PERCENTAGE discount
  const validPercentProd = await request('POST', `/api/v1/businesses/${businessId}/products`, {
    name: `E2E Discounted Product ${Date.now()}`,
    sku: `SKU-DISC-${Date.now()}`,
    description: 'Product created with active percentage discount',
    unit_price: 200,
    cost_price: 100,
    unit: 'PIECE',
    category_id: categoryId,
    discount_active: true,
    discount_type: 'PERCENTAGE',
    discount_value: 25
  }, sellerHeaders);
  assert('Create Product With 25% Discount', validPercentProd.status === 201 && !!validPercentProd.data?.data?.id, `Status: ${validPercentProd.status}`);
  const createdProduct = validPercentProd.data?.data;
  const productId = createdProduct?.id;

  // Verify created product discount fields in GET
  const getProd = await request('GET', `/api/v1/businesses/${businessId}/products/${productId}`, null, sellerHeaders);
  const pData = getProd.data?.data;
  assert('Persisted Discount Active = true', pData?.discount_active === true);
  assert('Persisted Discount Type = PERCENTAGE', pData?.discount_type === 'PERCENTAGE');
  assert('Persisted Discount Value = 25', pData?.discount_value === 25);

  // Update product discount to FIXED $30
  const updateFixed = await request('PATCH', `/api/v1/businesses/${businessId}/products/${productId}`, {
    discount_type: 'FIXED',
    discount_value: 30
  }, sellerHeaders);
  assert('Update Product to FIXED $30 Discount', updateFixed.status === 200, `Status: ${updateFixed.status}`);

  const getUpdatedProd = await request('GET', `/api/v1/businesses/${businessId}/products/${productId}`, null, sellerHeaders);
  const upData = getUpdatedProd.data?.data;
  assert('Updated Persisted Discount Type = FIXED', upData?.discount_type === 'FIXED');
  assert('Updated Persisted Discount Value = 30', upData?.discount_value === 30);

  // ==========================================
  // 4. PROMOTION E2E TEST
  // ==========================================
  console.log('\n--- PROMOTION E2E: Admin Promotion Visibility ---');
  const promoRes = await request('GET', '/api/v1/admin/commerce/promotions', null, adminHeaders);
  assert('GET /api/v1/admin/commerce/promotions Status 200', promoRes.status === 200);
  const promotions = promoRes.data?.data?.promotions || promoRes.data?.promotions || [];
  const targetPromo = promotions.find(p => p.product_id === productId);
  assert('Created Discount Product Found in Promotions List', !!targetPromo, `Found: ${JSON.stringify(targetPromo)}`);
  if (targetPromo) {
    assert('Promotion Sale Price Correct ($170)', targetPromo.sale_price === 170);
    assert('Promotion Regular Price Correct ($200)', targetPromo.regular_price === 200);
    assert('Promotion Off-Badge Active', targetPromo.off_badge === true);
    assert('Promotion Status Active', targetPromo.status === 'ACTIVE');
  }

  // ==========================================
  // 5. BUG 1 & ORDER E2E VALIDATION
  // ==========================================
  console.log('\n--- BUG 1: Order Null-Scan Fix & Order Lifecycle E2E ---');
  const ordersListRes = await request('GET', '/api/v1/admin/commerce/orders?limit=10', null, adminHeaders);
  assert('GET /api/v1/admin/commerce/orders Status 200 (No Null Scan Crash)', ordersListRes.status === 200);
  const orders = ordersListRes.data?.data?.orders || ordersListRes.data?.orders || [];
  assert('Orders Returned Successfully', Array.isArray(orders), `Count: ${orders.length}`);

  if (orders.length > 0) {
    const firstOrderId = orders[0].id;
    const orderDetailRes = await request('GET', `/api/v1/admin/commerce/orders/${firstOrderId}`, null, adminHeaders);
    assert('GET /api/v1/admin/commerce/orders/:id Status 200', orderDetailRes.status === 200);
    const detail = orderDetailRes.data?.data || orderDetailRes.data;
    assert('Order Detail Contains Order, Lines, StatusHistory', !!detail?.order && Array.isArray(detail?.lines) && Array.isArray(detail?.status_history));
  }

  // ==========================================
  // 6. ALL 4 ADMIN RUNTIME PAGES DATA INTEGRITY
  // ==========================================
  console.log('\n--- 4 ADMIN RUNTIME PAGES: API Response Verification ---');

  // Page 1: Product Card Quality
  const qualityRes = await request('GET', `/api/v1/admin/commerce/products/${productId}/card-quality`, null, adminHeaders);
  assert('Page 1 API: Product Card Quality Status 200', qualityRes.status === 200);
  const qData = qualityRes.data?.data || qualityRes.data;
  assert('Quality Model: has_effective_price & regular_price', typeof qData?.has_effective_price === 'boolean' && typeof qData?.regular_price === 'number');
  assert('Quality Model: issues is array', Array.isArray(qData?.issues));

  // Page 2: Promotion Visibility
  assert('Page 2 API: Promotion Visibility Status 200', promoRes.status === 200);
  assert('Promotion Visibility: total is number', typeof (promoRes.data?.data?.total ?? promoRes.data?.total) === 'number');

  // Page 3: Search Admin Analytics & Queries
  const searchAnalytics = await request('GET', '/api/v1/admin/commerce/search/analytics', null, adminHeaders);
  assert('Page 3 API: Search Analytics Status 200', searchAnalytics.status === 200);
  const sAnalyticsData = searchAnalytics.data?.data || searchAnalytics.data;
  assert('Search Analytics Model: available is boolean', typeof sAnalyticsData?.available === 'boolean');

  const searchQueries = await request('GET', '/api/v1/admin/commerce/search/queries?limit=10', null, adminHeaders);
  assert('Page 3 API: Search Queries Log Status 200', searchQueries.status === 200);

  // Page 4: Category Performance & Shop Performance
  const catPerf = await request('GET', '/api/v1/admin/commerce/categories/performance', null, adminHeaders);
  assert('Page 4 API: Category Performance Status 200', catPerf.status === 200);
  const catPerfList = catPerf.data?.data || catPerf.data;
  assert('Category Performance: Array returned', Array.isArray(catPerfList));

  const shopPerf = await request('GET', '/api/v1/admin/commerce/shops/performance', null, adminHeaders);
  assert('Page 4 API: Shop Performance Status 200', shopPerf.status === 200);
  const shopPerfList = shopPerf.data?.data?.performance || shopPerf.data?.performance || [];
  assert('Shop Performance: Array returned', Array.isArray(shopPerfList));

  // ==========================================
  // 7. REGRESSION SUITE: RBAC, AUDIT, VISIBILITY
  // ==========================================
  console.log('\n--- REGRESSION SUITE: RBAC, Audit, Visibility ---');

  // RBAC: Seller cannot access admin endpoints
  const rbacTest = await request('GET', '/api/v1/admin/commerce/overview', null, sellerHeaders);
  assert('RBAC: Seller Rejected on Admin Route (401/403)', rbacTest.status === 401 || rbacTest.status === 403, `Status: ${rbacTest.status}`);

  // RBAC: Anonymous cannot access admin endpoints
  const anonTest = await request('GET', '/api/v1/admin/commerce/overview');
  assert('RBAC: Anonymous Rejected on Admin Route (401)', anonTest.status === 401, `Status: ${anonTest.status}`);

  // Marketplace Visibility Check
  const visRes = await request('GET', `/api/v1/admin/commerce/marketplace/visibility/${productId}`, null, adminHeaders);
  assert('Marketplace Visibility Status 200', visRes.status === 200);
  const visData = visRes.data?.data || visRes.data;
  assert('Marketplace Visibility: is_visible field boolean', typeof visData?.is_visible === 'boolean');

  // Audit Logs
  const auditRes = await request('GET', '/api/v1/admin/direction/audit-log?limit=5', null, adminHeaders);
  assert('Direction Audit Logs Status 200', auditRes.status === 200);

  // Summary
  console.log('\n==========================================');
  const allPassed = results.every(r => r.pass);
  const passedCount = results.filter(r => r.pass).length;
  console.log(`TOTAL CHECKS: ${results.length}, PASSED: ${passedCount}, FAILED: ${results.length - passedCount}`);
  if (allPassed) {
    console.log('ALL TARGETED HTTP/E2E CHECKS PASSED SUCCESSFULLY!');
  } else {
    console.error('SOME CHECKS FAILED!');
    process.exit(1);
  }
}

run().catch(err => {
  console.error('Test script crashed:', err);
  process.exit(1);
});
