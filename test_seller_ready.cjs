const fetch = require('node-fetch');

const base = 'http://127.0.0.1:8080/api/v1';

async function login(email, pw) {
  const r = await fetch(base + '/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password: pw }) });
  const j = await r.json();
  return (j.data || j).access_token || (j.data || j).token;
}

async function main() {
  const seller = await login('courier_f3d2ea47@tbk.cd', 'StrongPassword123!');
  const S = { 'Content-Type': 'application/json', Authorization: 'Bearer ' + seller };
  const id = 'f5b23147-4375-42b0-a16c-a0e5bc330aa6';
  
  let order = await (await fetch(base + '/orders/' + id, { headers: { Authorization: 'Bearer ' + seller } })).then(r => r.json());
  console.log('ORDER_STATUS', order.data?.status, 'delivery_status', order.data?.delivery_status);
  
  let r = await fetch(base + '/orders/' + id + '/tracking/status', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + seller }, body: JSON.stringify({ status: 'PREPARING' }) });
  console.log('SELLER_PREPARING', r.status, await r.text());
  let order2 = await (await fetch(base + '/orders/' + id, { headers: { Authorization: 'Bearer ' + seller } })).then(r => r.json());
  console.log('AFTER_PREPARING', order2.data?.status, order2.data?.delivery_status);
  
  r = await fetch(base + '/orders/' + id + '/tracking/status', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + seller }, body: JSON.stringify({ status: 'READY' }) });
  console.log('SELLER_READY', r.status, await r.text());
  let order3 = await (await fetch(base + '/orders/' + id, { headers: { Authorization: 'Bearer ' + seller } })).then(r => r.json());
  console.log('AFTER_READY', order3.data?.status, order3.data?.delivery_status);
  
  const handover = await (await fetch(base + '/courier/missions/' + id + '/handover', { headers: { Authorization: 'Bearer ' + seller } })).then(r => r.json());
  console.log('HANDOVER_AFTER', handover.data?.delivery_status);
}

main().catch(e => { console.error(e.message); process.exitCode = 1 });