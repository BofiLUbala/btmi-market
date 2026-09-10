import http from 'http'

const passwords = [
  'TestPassword123!',
  'Password123!',
  'SuperAdmin123!',
  'Admin123456!',
  'Admin123!',
  'BtmiMarket2026!',
  'TbK_Market_2026!',
  'TbK@Market2026!'
]

for (const password of passwords) {
  const payload = JSON.stringify({
    email: 'roletest.super@tbk.test',
    password
  })

  const res = await fetch('http://localhost:8080/api/v1/admin/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: payload
  })

  const body = await res.json()
  console.log(`Password: ${password} -> HTTP ${res.status}`, body)
  if (res.status === 200) {
    console.log('FOUND CORRECT PASSWORD:', password)
    break
  }
}
