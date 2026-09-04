# EAS Update (OTA) Setup & Operations Guide

## 1. Existing Internal-Testing Situation
TBK Market's mobile app (`android/`) is configured with Expo SDK 57 and managed via EAS Build under account `@e-attendance`.
- **Project ID**: `c4094f79-8c40-4dbb-aac1-a59b59d7e9d3`
- **Owner**: `e-attendance`
- **Slug**: `tbk`
- **Android Package**: `com.tbk.market`
- **Build Profiles in `eas.json`**:
  - `development` (internal apk, dev client)
  - `preview` (internal testing apk, distribution: internal)
  - `production` (store app-bundle, autoIncrement: true)

The previous test binaries (such as build ID `8599e2bd`, `e4bb5dc8`, `3f86f4b5`) were built **before** `expo-updates` was installed in `package.json` and before `updates.url` & `runtimeVersion` were configured in `app.json`.

---

## 2. Why One New Binary Was Required
`expo-updates` contains native code that runs on app boot to query the EAS Update server (`https://u.expo.dev/<projectId>`), download new JS bundles and assets, and swap the bundle.
- **Old Internal Test Build**: Was compiled without native `expo-updates` libraries embedded in the APK/AAB. Therefore, old binaries **cannot** interpret or receive OTA updates.
- **Rule**: Exactly **ONE new test binary** must be built from the updated project and installed onto testers' devices before any OTA updates can take effect.

---

## 3. EAS Update Configuration
Configured in `android/app.json`:
```json
{
  "expo": {
    "runtimeVersion": {
      "policy": "appVersion"
    },
    "updates": {
      "url": "https://u.expo.dev/c4094f79-8c40-4dbb-aac1-a59b59d7e9d3"
    }
  }
}
```
Installed dependency in `android/package.json`:
- `"expo-updates": "~57.0.21"`

---

## 4. Channels Strategy
Update channels map builds to the update streams they receive. Configured in `android/eas.json`:
- **`internal`**: Targeted by the `preview` build profile. Internal testers receive updates published to the `internal` channel.
- **`production`**: Targeted by the `production` build profile. Store users receive updates published to the `production` channel.

```json
{
  "cli": {
    "version": ">= 5.0.0",
    "appVersionSource": "remote"
  },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal",
      "android": { "buildType": "apk" },
      "channel": "development"
    },
    "preview": {
      "distribution": "internal",
      "env": {
        "EAS_SKIP_AUTO_FINGERPRINT": "1"
      },
      "android": { "buildType": "apk" },
      "channel": "internal"
    },
    "production": {
      "autoIncrement": true,
      "distribution": "store",
      "android": { "buildType": "app-bundle" },
      "channel": "production"
    }
  }
}
```

---

## 5. Runtime Version
- **Strategy**: `"runtimeVersion": { "policy": "appVersion" }`
- **Why**: Ensures that all updates published for `version: 1.0.0` will only be delivered to binaries with `version: 1.0.0`. If a native change or SDK update occurs, incrementing `version` prevents incompatible OTA bundles from crashing older binaries.

---

## 6. Android Internal Flow
1. **Initial Step (Once)**:
   Build the new OTA-compatible preview APK:
   ```bash
   cd android
   eas build --platform android --profile preview
   ```
2. **Install**:
   Internal testers download and install the newly generated APK.
3. **Subsequent JS/UI Changes**:
   No new binary needed. Push to `develop` branch or run:
   ```bash
   eas update --channel internal --message "Feature update description"
   ```
4. **Tester Experience**:
   On app launch (or restart), `expo-updates` fetches the new bundle in the background and applies it.

---

## 7. iOS Internal/TestFlight Flow
- **Current State**: iOS bundle identifier and Apple Developer credentials are not yet configured in `app.json` / EAS.
- **When Ready**:
  1. Add `bundleIdentifier` under `expo.ios` in `app.json` (e.g., `com.tbk.market`).
  2. Configure Apple Developer Team credentials via `eas credentials -p ios`.
  3. Build one compatible iOS binary:
     ```bash
     eas build --platform ios --profile preview
     ```
  4. Once installed, iOS testers on the preview profile will automatically receive updates sent to `--channel internal`.

---

## 8. GitHub Actions Workflow
Automation workflow located at `.github/workflows/eas-internal-update.yml`:
- **Trigger**: Every push to `develop` branch.
- **Steps**:
  1. Checkout repository (`actions/checkout@v4`)
  2. Setup Node.js 20 with npm caching (`actions/setup-node@v4`)
  3. `npm ci` inside `android/`
  4. Expo / EAS authentication (`expo/expo-github-action@v8`) using `secrets.EXPO_TOKEN`
  5. Type-safety verification (`npx tsc --noEmit`)
  6. Publish update: `eas update --channel internal --message "Git ${GITHUB_SHA}" --non-interactive`

---

## 9. EXPO_TOKEN Setup in GitHub
To allow GitHub Actions to publish updates to EAS:
1. Go to [https://expo.dev/settings/access-tokens](https://expo.dev/settings/access-tokens).
2. Create a personal access token or robot token for account `e-attendance` with permissions to create updates for project `tbk`.
3. Go to GitHub repository: **Settings → Secrets and variables → Actions**.
4. Click **New repository secret**.
5. Name: `EXPO_TOKEN`.
6. Value: Paste the token.
7. Click **Add secret**.

*(Never commit the Expo token into code or version control).*

---

## 10. Normal Developer Workflow
For standard JavaScript, TypeScript, React components, and UI changes:
```bash
git add .
git commit -m "fix(mobile): update checkout button and spacing"
git push origin develop
```
Result:
- GitHub Actions triggers automatically.
- Types are verified.
- OTA bundle is published to the `internal` channel.
- Android and iOS internal testers receive the update on their next app launch.

To manually publish without pushing:
```bash
cd android
eas update --channel internal --message "Manual internal test update"
```

---

## 11. When a New EAS Build IS Still Required (Native Changes)
Do NOT send OTA updates when modifying native code or native configurations. A new binary build is strictly required for:
- Adding or removing libraries containing native code (e.g. new camera, bluetooth, or native SDK modules)
- Upgrading Expo SDK version (e.g., SDK 57 → SDK 58)
- Android permissions in `app.json` (`android.permissions`)
- iOS permissions (`ios.infoPlist`)
- Native Firebase configuration files (`google-services.json`, `GoogleService-Info.plist`)
- Expo config plugins in `app.json` (`plugins`)
- `AndroidManifest.xml` or native Gradle/Podfile alterations
- Changing `runtimeVersion` or `version`

---

## 12. Rollback & Recovery Notes
If an OTA update introduces a bug or crash:
1. **Re-publish a known good commit**:
   Checkout the previous stable commit on `develop` and push, or run:
   ```bash
   eas update --channel internal --message "Rollback to stable release"
   ```
2. **Republish previous update via EAS CLI**:
   View update history:
   ```bash
   eas update:list --channel internal
   ```
   Republish an existing update group:
   ```bash
   eas update:republish --channel internal --group <group-id>
   ```
3. **Production Rollback**:
   Production updates are NEVER automated from `develop`. When deploying or rolling back production:
   ```bash
   eas update --channel production --message "Production hotfix / rollback"
   ```
