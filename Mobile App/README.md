# STI Locator Mobile App

The Flutter app supports staging and production Firebase environments.

| Environment | Firebase project |
| --- | --- |
| Staging | `fac-loc-stg` |
| Production | `fac-loc` |

From the repository root:

```powershell
.\run.bat mobile-web-stg
.\run.bat mobile-web
.\run.bat mobile-stg
.\run.bat mobile-prod
```

Direct Flutter commands:

```powershell
flutter run --dart-define=APP_ENV=staging
flutter run --dart-define=APP_ENV=production
```

Build releases:

```powershell
flutter build apk --release --dart-define=APP_ENV=staging
flutter build apk --release --dart-define=APP_ENV=production
```

Production options are in `lib/firebase_options.dart`. Staging options are in
`lib/firebase_options_staging.dart`. If `APP_ENV` is omitted, production is used.
