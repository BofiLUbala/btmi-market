# TBK — private Android beta

## What Firebase does and does not do

Firebase App Distribution **delivers the APK file** to testers. That is all it
does here.

It does **not** host the API. Once the app is installed, it still calls
whatever `EXPO_PUBLIC_API_URL` was baked into the build. A tester on mobile data
cannot reach `http://172.30.244.53:8080` — that address only exists on the
development Wi-Fi.

So a remote beta needs two independent things:

| Need | Solved by |
|---|---|
| Getting the APK onto the tester's phone | Firebase App Distribution |
| The app being able to reach the backend | The production server (Part 1) |

---

## Part 1 — Public API

The whole Docker stack runs on the production server, behind Caddy for HTTPS
(see `backend/deploy/README.md`):

```
https://tbk-z.duckdns.org/api/v1
```

Only ports 80/443 are public. PostgreSQL, Redis and visual-search stay on the
server's internal Docker network. This address is `EXPO_PUBLIC_API_URL` in the
EAS `production` and `preview` environments.

---

## Part 2 — Firebase App Distribution setup

Independent of the hosting choice. These steps need your Google account, so
they have to be done by you in the console.

### 2.1 Create the Firebase project and register the app

1. Open the Firebase console and create a project (or reuse one).
2. Add an **Android** app.
3. Package name — must match `app.json` exactly:

   ```
   com.tbk.market
   ```

4. Copy the **App ID**, of the form `1:1234567890:android:abcdef123456`.

`google-services.json` is only required if you later add Firebase SDKs
(Analytics, Crashlytics, Auth). **App Distribution alone does not need it**, and
none of those SDKs are installed today — do not add them just to distribute.

### 2.2 Install the Firebase CLI

```bash
npm install -g firebase-tools
```

```bash
firebase login
```

### 2.3 Build the preview APK

The public HTTPS URL from Part 1 goes in here, and must end with `/api/v1`:

```bash
eas build -p android --profile preview
```

Set `EXPO_PUBLIC_API_URL` as an EAS environment variable on the `preview`
profile before building. The app prioritises it over Metro host discovery; a
release build without it logs an explicit error instead of silently failing.

### 2.4 Distribute to testers

```bash
firebase appdistribution:distribute ./build.apk --app <APP_ID> --testers "tester@example.com"
```

Groups work too, via `--groups "beta"`.

---

## Pre-flight checklist

Do not ship a build until every line passes:

- [ ] Public HTTPS chosen and running
- [ ] `curl https://<host>/health` returns `{"status":"ok"}`
- [ ] `curl https://<host>/api/v1/marketplace/categories` returns 200
- [ ] `EXPO_PUBLIC_API_URL` set on the `preview` profile, ending in `/api/v1`
- [ ] APK built from the `preview` profile, not `development`
- [ ] Postgres / Redis / visual-search still unreachable from outside
- [ ] Login and product listing verified from a phone on mobile data
