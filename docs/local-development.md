# Local Firebase Development

The local environment uses the Firebase Emulator Suite so web, desktop, and
mobile clients can share test data without reading or changing staging or
production.

## Requirements

- Node.js LTS
- Java 21 or newer for the Firebase Realtime Database emulator
- The normal project setup: `.\setup.bat`

## Start the Local Backend

Open PowerShell in the repository root and keep this terminal open:

```powershell
.\run.bat local-db
```

This starts:

| Service | Address |
| --- | --- |
| Emulator dashboard | `http://127.0.0.1:4000` |
| Firebase Authentication | `127.0.0.1:9099` |
| Realtime Database | `127.0.0.1:9000` |

The launcher seeds sample accounts automatically. Existing local records are
not replaced.

| Role | Email | Password |
| --- | --- | --- |
| Admin | `admin@sti.edu` | `Admin@12345` |
| Faculty | `faculty.local@sti.edu` | `Faculty@12345` |
| Student | `student.local@sti.edu` | `Student@12345` |

Local data is exported on emulator shutdown and restored the next time it is
started. Generated records live under `data/local-firebase/` and are ignored by
Git. The tracked `.gitkeep` only preserves the correct directory after cloning.

## Start a Local Client

Open a second PowerShell terminal and run one client:

```powershell
.\run.bat web-local
.\run.bat login-local
.\run.bat admin-local
.\run.bat mobile-web-local
.\run.bat mobile-local
```

All five commands use the same local database. Keep the `local-db` terminal
open while a local client is running.

## Physical Mobile Device

Android Emulator automatically reaches the host computer through `10.0.2.2`.
For a physical phone, connect it to the same trusted network and pass the host
computer's LAN address:

```powershell
ipconfig
.\run.bat mobile-local -d DEVICE_ID --dart-define=LOCAL_FIREBASE_HOST=192.168.1.10
```

Windows Firewall may ask for permission the first time the emulators listen on
the network. Only allow access on a trusted private network.

## Environment Safety

| Environment | Web | Python | Flutter | Firebase |
| --- | --- | --- | --- | --- |
| Local | `localdb` | `local` | `local` | Emulator only |
| Staging | `staging` | `staging` | `staging` | `fac-loc-stg` |
| Production | `production` | `production` | `production` | `fac-loc` |

Local settings are stored in `.env.localdb`. The local Flutter options are in
`Mobile App/lib/firebase_options_local.dart`. The root `firebase.json` and
`database.rules.json` apply only to the emulator commands in this guide.

## Reset Local Data

Stop the emulator with `Ctrl+C`, remove the generated files inside
`data/local-firebase/` but keep `.gitkeep`, then start `local-db` again. The
sample accounts and base schema will be recreated automatically.
