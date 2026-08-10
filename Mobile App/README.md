# STI Locator Mobile App

The Flutter app supports local, production, and staging Firebase environments.

| Environment | Firebase project | Realtime Database |
| --- | --- | --- |
| Local | `sti-locator-local` | Firebase emulator |
| Production | `fac-loc` | `fac-loc-default-rtdb` |
| Staging | `fac-loc-stg` | `fac-loc-stg-default-rtdb` |

## Windows Launchers

From the repository root, use the central launcher:

```powershell
.\run.bat mobile-web
.\run.bat mobile-web-stg
.\run.bat mobile-prod
.\run.bat mobile-stg
.\run.bat mobile-web-local
.\run.bat mobile-local
```

The web launchers open Chrome directly. The generic mobile launchers use a
connected Android/iOS device or ask Flutter to select one.

You can pass Flutter device arguments through the generic launcher:

```powershell
.\run.bat mobile-stg -d emulator-5554
```

The environment-specific batch files are organized in the root `launchers\`
folder. Run `\.\run.bat` without arguments to use the interactive menu.

## Flutter Commands

Run production:

```powershell
flutter run --dart-define=APP_ENV=production
```

Run staging:

```powershell
flutter run --dart-define=APP_ENV=staging
```

Run local after starting `.\run.bat local-db` in another terminal:

```powershell
flutter run --dart-define=APP_ENV=local
```

For a physical device, pass the development computer's LAN address:

```powershell
flutter run --dart-define=APP_ENV=local --dart-define=LOCAL_FIREBASE_HOST=192.168.1.10
```

Build production:

```powershell
flutter build apk --release --dart-define=APP_ENV=production
flutter build web --release --dart-define=APP_ENV=production
```

Build staging:

```powershell
flutter build apk --release --dart-define=APP_ENV=staging
flutter build web --release --dart-define=APP_ENV=staging
```

If `APP_ENV` is omitted, the app uses production.

## Firebase Configuration

- Production options: `lib/firebase_options.dart`
- Staging options: `lib/firebase_options_staging.dart`
- Local emulator options: `lib/firebase_options_local.dart`

The app uses named Firebase instances in staging and local modes. This keeps
their Auth and Realtime Database traffic separate even when a native platform
has already auto-initialized the production Firebase app. Local mode connects
Auth on port `9099` and Realtime Database on port `9000`.
