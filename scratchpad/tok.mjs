const [email, pw, admin] = process.argv.slice(2)
const r = await fetch('http://localhost:8080/api/v1' + (admin ? '/admin/auth/login' : '/auth/login'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password: pw }) })
const j = await r.json(); const d = j.data ?? j
console.log(JSON.stringify({ a: d.access_token, r: d.refresh_token }))
