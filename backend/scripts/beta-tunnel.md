# Private beta tunnel (Cloudflare)

Exposes **only** the Docker API (`localhost:8080`) over public HTTPS so external
Firebase App Distribution testers can reach it.

Nothing else is published. PostgreSQL (`5433`), Redis (`6379`) and
visual-search (`8090`) stay bound to loopback / the internal Docker network and
must never be tunnelled.

## 1. Install cloudflared (once)

```bash
winget install --id Cloudflare.cloudflared
```

## 2. Confirm the API is up before tunnelling

```bash
curl -s http://localhost:8080/health
```

Expected: `{"status":"ok"}`

## 3. Start the tunnel

```bash
cloudflared tunnel --url http://localhost:8080
```

`cloudflared` prints a public URL of the form `https://<random>.trycloudflare.com`.

**This quick-tunnel URL changes every time the process restarts**, so it is
never committed to source. A named tunnel on your own domain is the stable
option once the beta grows.

## 4. Verify the public endpoint actually answers

Do this before building the APK — a beta shipped against an unverified URL
fails on every request.

```bash
curl -s https://<random>.trycloudflare.com/health
```

Expected: `{"status":"ok"}`

## 5. Build the preview APK against it

The URL must end with `/api/v1`.

```bash
eas build -p android --profile preview
```

Set `EXPO_PUBLIC_API_URL=https://<random>.trycloudflare.com/api/v1` as an EAS
environment variable for the `preview` profile, or export it in the shell that
runs the build. The app prioritises this value over Metro host discovery; a
release build without it logs an explicit error and cannot reach the API.

## Security notes

- The tunnel makes the API reachable by anyone holding the URL. Treat it as a
  temporary private beta, not a production deployment.
- Keep the tunnel scoped to `http://localhost:8080`. Never pass a database or
  Redis port to `--url`.
- Stop the tunnel (Ctrl+C) when the beta session ends.
