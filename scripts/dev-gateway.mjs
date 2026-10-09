import http from 'node:http'

const port = Number(process.env.BTMI_LOCAL_PORT || 5180)
const destinations = {
  market: process.env.BTMI_EXPO_URL || 'http://localhost:19006',
  admin: process.env.BTMI_ADMIN_URL || 'http://localhost:5181',
  api: process.env.BTMI_API_URL || 'http://localhost:8080'
}

function targetFor(pathname) {
  if (pathname === '/_local/gateway') return null
  if (pathname === '/admin' || pathname.startsWith('/admin/')) return destinations.admin
  if (pathname.startsWith('/api/') || pathname.startsWith('/uploads/')) return destinations.api
  if (
    pathname.startsWith('/@vite/') ||
    pathname.startsWith('/@react-refresh') ||
    pathname.startsWith('/src/') ||
    pathname.startsWith('/node_modules/vite/') ||
    pathname.startsWith('/node_modules/@fontsource-variable/') ||
    pathname.startsWith('/node_modules/.vite/') ||
    pathname.startsWith('/admin-hmr') ||
    pathname === '/tbk-admin-logo.png' ||
    pathname === '/logo.png' ||
    pathname.startsWith('/assets/categories/')
  ) return destinations.admin
  // Expo's Metro bundle is also exposed below /node_modules/, so only its
  // Vite-specific dependency cache belongs to the admin app.
  if (pathname.startsWith('/node_modules/')) return destinations.market
  return destinations.market
}

function proxyRequest(req, res) {
  const pathname = new URL(req.url || '/', 'http://localhost').pathname
  if (pathname === '/_local/gateway') {
    res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' })
    res.end(JSON.stringify({ ok: true, routes: { market: destinations.market, admin: destinations.admin, api: destinations.api } }))
    return
  }

  const target = new URL(targetFor(pathname))
  if (process.env.BTMI_GATEWAY_DEBUG === '1') console.log(`${req.method} ${req.url} -> ${target.origin}`)
  const headers = { ...req.headers, host: target.host }
  headers['x-forwarded-host'] = req.headers.host || ''
  headers['x-forwarded-proto'] = 'http'
  const upstream = http.request({
    protocol: target.protocol,
    hostname: target.hostname,
    port: target.port,
    method: req.method,
    path: req.url,
    headers
  }, (upstreamRes) => {
    res.writeHead(upstreamRes.statusCode || 502, upstreamRes.headers)
    upstreamRes.pipe(res)
  })

  upstream.on('error', (error) => {
    if (res.headersSent) return res.destroy(error)
    res.writeHead(502, { 'content-type': 'text/plain; charset=utf-8' })
    res.end(`Local service unavailable (${target.origin}): ${error.message}`)
  })
  req.pipe(upstream)
}

function createGatewayServer() {
  const server = http.createServer(proxyRequest)
  server.on('upgrade', (req, socket, head) => {
  const target = new URL(targetFor(new URL(req.url || '/', 'http://localhost').pathname) || destinations.market)
  const upstream = http.request({
    protocol: target.protocol,
    hostname: target.hostname,
    port: target.port,
    method: req.method,
    path: req.url,
    headers: { ...req.headers, host: target.host }
  })
  upstream.on('upgrade', (response, upstreamSocket, upstreamHead) => {
    const lines = [`HTTP/1.1 ${response.statusCode} ${response.statusMessage}`]
    for (const [name, value] of Object.entries(response.headers)) {
      if (Array.isArray(value)) value.forEach((item) => lines.push(`${name}: ${item}`))
      else if (value !== undefined) lines.push(`${name}: ${value}`)
    }
    socket.write(`${lines.join('\r\n')}\r\n\r\n`)
    if (head.length) upstreamSocket.write(head)
    if (upstreamHead.length) socket.write(upstreamHead)
    upstreamSocket.pipe(socket)
    socket.pipe(upstreamSocket)
  })
  upstream.on('response', (response) => {
    socket.write(`HTTP/1.1 ${response.statusCode || 502} ${response.statusMessage || 'Bad Gateway'}\r\n\r\n`)
    response.pipe(socket)
  })
  upstream.on('error', () => socket.destroy())
  upstream.end()
  })
  return server
}

// Edge and the in-app browser may resolve localhost to different loopback
// families. Bind both loopback addresses explicitly, without exposing the
// development gateway to the LAN.
const servers = [
  createGatewayServer(),
  createGatewayServer()
]
let readyServers = 0
servers[0].listen(port, '127.0.0.1', onListening)
servers[1].listen({ port, host: '::1', ipv6Only: true }, onListening)

function onListening() {
  readyServers += 1
  if (readyServers !== servers.length) return
  console.log(`TBK local gateway: http://localhost:${port}`)
  console.log(`  marketplace, seller, courier -> ${destinations.market}`)
  console.log(`  /admin/* -> ${destinations.admin}`)
  console.log(`  /api/* and /uploads/* -> ${destinations.api}`)
}

servers.forEach((server) => server.on('error', (error) => {
  console.error(`Could not start local gateway on port ${port}: ${error.message}`)
  process.exit(1)
}))
