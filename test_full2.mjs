const base = "http://127.0.0.1:8080/api/v1";

async function login(email, pw) {
  const r = await fetch(base + "/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password: pw }) });
  const j = await r.json();
  return (j.data || j).access_token || (j.data || j).token;
}

async function track(label, r) {
  const t = await r.text();
  console.log(label, r.status, t);
}

async function trackBuyer(label) {
  const r = await fetch(base + "/buyer/orders/" + id + "/tracking", { headers: { Authorization: "Bearer " + buyer } });
  const d = await r.json();
  console.log(label, r.status, "del=" + (d.data || {}).delivery_status, "cur=" + (d.data || {}).current_status);
}

async function main() {
  const courier = await login("courier_f25b19a0@tbk.cd", "Password123!");
  const C = { Authorization: "Bearer " + courier, "Content-Type": "application/json" };
  const buyer = await login("buyer_e2e@test.com", "StrongPassword123!");
  const B = { Authorization: "Bearer " + buyer };
  const seller = await login("courier_f3d2ea47@tbk.cd", "StrongPassword123!");
  const S = { "Content-Type": "application/json", Authorization: "Bearer " + seller };
  const id = "f5b23147-4375-42b0-a16c-a0e5bc330aa6";

  async function track(label, r) {
    const t = await r.text();
    console.log(label, r.status, t);
  }

  async function trackBuyer(label) {
    const r = await fetch(base + "/buyer/orders/" + id + "/tracking", { headers: { Authorization: "Bearer " + buyer } });
    const d = await r.json();
    console.log(label, r.status, "del=" + (d.data || {}).delivery_status, "cur=" + (d.data || {}).current_status);
  }

  async function handover() {
    const r = await fetch(base + "/courier/missions/" + id + "/handover", { headers: { Authorization: "Bearer " + courier } });
    return await r.json();
  }

  // Initial state
  await trackBuyer("BUYER_BASE");
  
  // 1. Courier accepts
  let r = await fetch(base + "/courier/missions/" + id + "/accept", { method: "POST", headers: { Authorization: "Bearer " + courier } });
  track("ACCEPT", r);
  await trackBuyer("BUYER_AFTER_ACCEPT");
  
  // 2. Seller prepares
  r = await fetch(base + "/orders/" + id + "/tracking/status", { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + seller }, body: JSON.stringify({ status: "PREPARING" }) });
  track("SELLER_PREPARING", r);
  await trackBuyer("BUYER_PREPARING");
  
  // 3. Seller marks READY
  r = await fetch(base + "/orders/" + id + "/tracking/status", { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + seller }, body: JSON.stringify({ status: "READY" }) });
  track("SELLER_READY", r);
  await trackBuyer("BUYER_AFTER_READY");
  
  // 4. Courier pickup
  r = await fetch(base + "/courier/missions/" + id + "/pickup", { method: "POST", headers: { Authorization: "Bearer " + courier } });
  track("PICKUP", r);
  await trackBuyer("BUYER_AFTER_PICKUP");
  
  // 5. Courier starts delivery
  r = await fetch(base + "/courier/missions/" + id + "/start", { method: "POST", headers: { Authorization: "Bearer " + courier } });
  track("START", r);
  await trackBuyer("BUYER_START");
  
  // 6. Courier arrives
  r = await fetch(base + "/courier/missions/" + id + "/arrive", { method: "POST", headers: { Authorization: "Bearer " + courier } });
  track("ARRIVE", r);
  await trackBuyer("BUYER_ARRIVE");
  
  // 7. Courier verifies product
  r = await fetch(base + "/courier/missions/" + id + "/verify-product", { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + courier }, body: JSON.stringify({ product_number: "PRD-8416f9c6" }) });
  track("VERIFY_PRODUCT", r);
  await trackBuyer("BUYER_VERIFY");
  
  // 8. Courier confirms cash
  r = await fetch(base + "/courier/missions/" + id + "/confirm-cash", { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + courier }, body: JSON.stringify({ confirmed: true, idempotency_key: "cash-" + Date.now() }) });
  track("CONFIRM_CASH", r);
  await trackBuyer("BUYER_CASH");
  
  // 9. Get package QR for delivery scan
  const pkg = await fetch("http://127.0.0.1:8080/api/v1/orders/f5b23147-4375-42b0-a16c-a0e5bc330aa6/package-qr", { headers: { Authorization: "Bearer " + seller, "Content-Type": "application/json" } });
  const pkgD = await pkg.json();
  console.log("PKG_QR", pkgD.data?.token);
  
  // 10. Delivery scan
  const r2 = await fetch("http://127.0.0.1:8080/api/v1/courier/scans/delivery", { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + courier }, body: JSON.stringify({ token: pkgD.data.token, order_id: "f5b23147-4375-42b0-a16c-a0e5bc330aa6", idempotency_key: "del-" + Date.now(), device_metadata: {} }) });
  track("DELIVERY_SCAN", r2);
  await trackBuyer("BUYER_AFTER_SCAN");
  
  // 11. Buyer acknowledges
  const r3 = await fetch(base + "/buyer/orders/" + id + "/handover/acknowledge", { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + buyer }, body: JSON.stringify({ lines: [{ order_line_id: "9e6e1626-7145-4648-8fb8-c69f2434f420", product_received: true, matches_order: true, quantity_correct: true }] }) });
  track("BUYER_ACK", r3);
  await trackBuyer("BUYER_AFTER_ACK");
  
  // 12. Buyer confirms receipt
  const r4 = await fetch(base + "/buyer/orders/" + id + "/confirm-receipt", { method: "POST", headers: { Authorization: "Bearer " + buyer } });
  track("BUYER_RECEIPT", r4);
  await trackBuyer("BUYER_FINAL");
}

main().catch(e => { console.error(e.message); process.exitCode = 1 });