# Android API Environment Setup

## 1. Current API URL Resolution

The Android app resolves the backend API URL via `src/api/client.ts` using this priority chain:

```
1. EXPO_PUBLIC_API_URL (if set and non-empty)
   ↓
2. Constants.expoConfig.hostUri (local Expo/Metro discovery)
   ↓
3. Fallback: http://10.0.2.2:8080/api/v1 (Android emulator)
```

**Core function:** `resolveApiUrl()` in `src/api/client.ts`

```typescript
function resolveApiUrl() {
  const explicit = process.env.EXPO_PUBLIC_API_URL?.trim()
  if (explicit) return explicit.replace(/\/+$/, '')

  if (!__DEV__) {
    console.error('[TBK] EXPO_PUBLIC_API_URL is not set in this release build.')
  }
  return developmentApiUrl()
}
```

## 2. Local Development Behavior

When running `npx expo start` (dev mode):

- `Constants.expoConfig.hostUri` provides the Metro bundler host
- The app extracts the hostname and appends `:8080/api/v1`
- Works automatically for phones on the same Wi-Fi as the dev machine
- Fallback: `http://10.0.2.2:8080/api/v1` for Android emulator

**No `.env` file needed for local dev** — Metro host discovery handles it.

## 3. Preview / Beta Build Behavior

For EAS preview builds (`eas build -p android --profile preview`):

- Set `EXPO_PUBLIC_API_URL` as an EAS environment variable at build time
- The value is baked into the APK at build time
- No local IP, no localhost, no Metro dependency

```bash
eas build -p android --profile preview --env EXPO_PUBLIC_API_URL=https://<your-api-host>/api/v1
```

## 4. Production Build Behavior

For EAS production builds (`eas build -p android --profile production`):

- Set `EXPO_PUBLIC_API_URL` as an EAS environment variable at build time
- Same mechanism as preview

## 5. EXPO_PUBLIC_API_URL Usage

| Context | Source | Example |
|---------|--------|---------|
| Local dev | Not set (auto-discovered) | — |
| Local dev (override) | `.env` file | `EXPO_PUBLIC_API_URL=http://192.168.1.50:8080/api/v1` |
| Preview build | EAS env variable | `EXPO_PUBLIC_API_URL=https://api.example.com/api/v1` |
| Production build | EAS env variable | `EXPO_PUBLIC_API_URL=https://api.example.com/api/v1` |

**Important:** The value must end with `/api/v1`.

## 6. Example Commands

### Local development (no env var needed)
```bash
cd android
npx expo start
# Phone on same Wi-Fi → auto-discovers Metro host → API on :8080
```

### Local development with explicit IP
```bash
# Create .env from template
cp .env.example .env
# Edit .env and set:
# EXPO_PUBLIC_API_URL=http://192.168.1.50:8080/api/v1
```

### Preview build
```bash
cd android
eas build -p android --profile preview --env EXPO_PUBLIC_API_URL=https://your-northflank-url.run/api/v1
```

### Production build
```bash
cd android
eas build -p android --profile production --env EXPO_PUBLIC_API_URL=https://your-northflank-url.run/api/v1
```

## 7. EAS Configuration

`eas.json` defines three build profiles:

| Profile | Build Type | EXPO_PUBLIC_API_URL |
|---------|-----------|-------------------|
| `development` | APK (dev client) | Not set (uses Metro discovery) |
| `preview` | APK | Set at build time |
| `production` | AAB (app bundle) | Set at build time |

The `preview` and `production` profiles have `"EXPO_PUBLIC_API_URL": ""` in `eas.json`. The actual value should be provided via the `--env` flag or EAS dashboard environment variables.

## 8. How to Test Against Northflank

1. Get the Northflank public HTTPS URL (e.g., `https://your-service.code.run`)
2. Append `/api/v1` → `https://your-service.code.run/api/v1`
3. Build preview APK:
   ```bash
   eas build -p android --profile preview --env EXPO_PUBLIC_API_URL=https://your-service.code.run/api/v1
   ```
4. Install APK on device
5. App will use the explicit URL for all API calls

## 9. Security Notes

- Never commit `EXPO_PUBLIC_API_URL` to source control
- Use EAS environment variables or `.env` (gitignored) for sensitive URLs
- The `.env.example` template is committed; actual `.env` is gitignored
- Northflank URLs should not be hardcoded in source code
- `FRONTEND_URL` (backend → web frontend) is a separate variable; do not reuse for Android

## 10. Testing With a VPN Active on the Phone

A VPN on the phone routes traffic away from the local network, so it can no
longer reach the dev machine's LAN IP. This breaks both the Metro connection
(Expo Go shows "Something went wrong") and, if you'd gotten past that, the
`:8080` API guess in `developmentApiUrl()`. Both Metro and the backend need to
be reachable over the public internet instead:

```bash
# Terminal 1 -- tunnel Metro (bundle + dev tools) via the ngrok already
# bundled as a devDependency
cd android
npm run start:phone

# Terminal 2 -- tunnel the backend API on :8080 the same way
cd android
npm run tunnel:api
# ngrok prints a URL like https://abcd1234.ngrok-free.app
```

Then put the printed URL in `android/.env` (create it from `.env.example` if
it doesn't exist yet):

```
EXPO_PUBLIC_API_URL=https://abcd1234.ngrok-free.app/api/v1
```

Restart `npm run start:phone` so the new env var is picked up, and reload the
app. With this in place, both the dev bundle and the API calls go over the
public internet, so an active VPN on the phone no longer matters.

If `Constants.expoConfig.hostUri` resolves to a tunnel domain (not a bare LAN
IP) and `EXPO_PUBLIC_API_URL` is still unset, `client.ts` now logs a warning
explaining exactly this instead of silently guessing a broken `:8080` URL.

## 11. Known Limitations

- **`expo export` on Windows:** May fail with `spawn UNKNOWN` due to Metro/Hermes bytecode generation issues on Windows. This is a known Expo/Metro issue, not related to API configuration.
- **Emulator fallback:** `10.0.2.2` only works inside the Android emulator. Physical devices must use LAN IP or `EXPO_PUBLIC_API_URL`.
- **No CORS changes needed:** React Native HTTP requests are not subject to browser CORS restrictions.
