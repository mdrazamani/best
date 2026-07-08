# BEST Android Local

Local/offline React application packaged with Capacitor for Android.

## Development

```bash
npm install
npm run dev
```

## Checks

```bash
npm run lint
npm run build
```

## Android

Sync web assets into the Android project:

```bash
npm run android:sync
```

Build a debug APK on Windows:

```bash
npm run android:apk:debug
```

Build a release APK on Windows:

```bash
npm run android:apk:release
```

The Android project lives in `android/` and uses the Capacitor config in `capacitor.config.ts`.
