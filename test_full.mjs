const base = "http://127.0.0.1:8080/api/v1";

async function login(email, pw) {
  const r = await fetch(base + "/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password: pw }) });
  const j = await r.json();
  return (j.data || j).access_token || (j.data || j).token;
}

async function main() {
  const courier = await login("courier_f25b19a0@tbk.cd", "Password123!");
  const C = { Authorization: "Bearer " + courier, "Content-Type": "application/json" };
  const buyer = await login("buyer_e2e@test.com", "StrongPassword123!");
  const B = { Authorization: "Bearer " + buyer };
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
    const r = await fetch(base + "/courier/missions/" + id + "/handover", { headers: C });
    return await r.json();
  }

  await trackBuyer("BUYER_BASE");
  
  let r = await fetch(base + "/courier/missions/" + id + "/pickup", { method: "POST", headers: { Authorization: "Bearer " + courier } });
  track("PICKUP", r);
  
  r = await fetch(base + "/courier/missions/" + id + "/start", { method: "POST", headers: { Authorization: "Bearer " + courier } });
  track("START", r);
  
  r = await fetch(base + "/courier/missions/" + id + "/arrive", { method: "POST", headers: { Authorization: "Bearer " + courier } });
  track("ARRIVE", r);
  
  r = await fetch(base + "/courier/missions/" + id + "/verify-product", { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + courier }, body: JSON.stringify({ product_number: "PRD-8416f9c6" }) });
  track("VERIFY_PRODUCT", r);
  
  r = await fetch(base + "/courier/missions/" + id + "/confirm-cash", { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + courier }, body: JSON.stringify({ confirmed: true, idempotency_key: "cash-" + Date.now() }) });
  track("CONFIRM_CASH", r);
  
  const seller = await login("courier_f3d2ea47@tbk.cd", "StrongPassword123!");
  const S = { "Content-Type": "application/json", Authorization: "Bearer " + seller };
  const pkg = await fetch("http://127.0.0.1:8080/api/v1/orders/f5b23147-4375-42b0-a16c-a0e5bc330aa6/package-qr", { headers: { Authorization: "Bearer " + seller, "Content-Type": "application/json" } });
  const pkgD = await pkg.json();
  console.log("PKG_QR", pkgD.data?.token);
  
  const r2 = await fetch("http://127.0.0.1:8080/api/v1/courier/scans/delivery", { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + courier }, body: JSON.stringify({ token: pkgD.data.token, order_id: "f5b23147-4375-42b0-a16c-a0e5bc330aa6", idempotency_key: "del-" + Date.now(), device_metadata: {} }) });
  track("DELIVERY_SCAN", r2);
  
  const r3 = await fetch(base + "/buyer/orders/" + id + "/handover/acknowledge", { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + buyer }, body: JSON.stringify({ lines: [{ order_line_id: "9e6e1626-7145-4648-8fb8-c69f2434f420", product_received: true, matches_order: true, quantity_correct: true }] }) });
  track("BUYER_ACK", r3);
  
  const r4 = await fetch(base + "/buyer/orders/" + id + "/confirm-receipt", { method: "POST", headers: { Authorization: "Bearer " + buyer } });
  track("BUYER_RECEIPT", r4);
}

main().catch(e => { console.error(e.message); process.exitCode = 1 });