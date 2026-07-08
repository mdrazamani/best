# Offline Operation

This project is prepared so the running application does not depend on international internet access.

## Runtime

- Dashboard fonts are bundled from local npm packages and emitted into the Vite build.
- Android-local fonts and images are bundled into the APK/web assets.
- API label PDFs embed the local Vazirmatn font from `apps/api/src/common/assets`.
- Dashboard API calls use the local `/v1` reverse proxy.
- Android-local stores its data locally and does not call an external API.

## Prepare Offline Packages

Run these once while internet is available:

```powershell
.\scripts\offline\prepare-npm-cache.ps1
.\scripts\offline\prepare-gradle-cache.ps1
```

They create:

- `vendor/npm-cache`
- `vendor/gradle-user-home`
- `vendor/maven`

After that, install npm dependencies without internet:

```powershell
.\scripts\offline\install-offline.ps1
```

Build the Android APK without internet:

```powershell
cd apps\android-local
npm run android:apk:debug:offline
```

## Docker Runtime Offline Bundle

Run once while internet and Docker are available:

```powershell
.\scripts\offline\prepare-docker-images.ps1
```

On the offline machine:

```powershell
.\scripts\offline\load-docker-images.ps1
docker compose up -d --no-build
```

## Guard Against External Runtime Links

Run:

```powershell
node .\scripts\offline\check-runtime-links.mjs
```

This fails if a direct external `http` or `https` runtime URL is added to app sources.
