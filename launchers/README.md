# Windows Launchers

Environment-specific batch files are kept in this folder to keep the repository
root clean. Users should normally run the central launcher from the root:

```powershell
.\run.bat
```

It can also receive a command directly:

```powershell
.\run.bat web-stg
.\run.bat admin
.\run.bat admin-stg
.\run.bat login
.\run.bat login-stg
.\run.bat mobile-web
.\run.bat mobile-web-stg
.\run.bat mobile-prod
.\run.bat mobile-stg
.\run.bat local-db
.\run.bat web-local
.\run.bat login-local
.\run.bat admin-local
.\run.bat mobile-web-local
.\run.bat mobile-local
```

## Launcher Differences

| Command | Target | Data source |
| --- | --- | --- |
| `.\run.bat` | Interactive command menu | Selected in menu |
| `.\run.bat local-db` | Firebase Auth and Database emulators | Local |
| `.\run.bat web-local` | React web app | Local emulators |
| `.\run.bat web-stg` | React web app | Staging Firebase |
| `.\run.bat web-prod` | React web app | Production Firebase |
| `.\run.bat login-local` | Python RFID login app | Local emulators |
| `.\run.bat login-stg` | Python RFID login app | Staging Firebase |
| `.\run.bat login` | Python RFID login app | Production Firebase |
| `.\run.bat admin-local` | Python desktop admin app | Local emulators |
| `.\run.bat admin-stg` | Python desktop admin app | Staging Firebase |
| `.\run.bat admin` | Python desktop admin app | Production Firebase |
| `.\run.bat mobile-web-local` | Flutter in Chrome | Local emulators |
| `.\run.bat mobile-web-stg` | Flutter in Chrome | Staging Firebase |
| `.\run.bat mobile-web` | Flutter in Chrome | Production Firebase |
| `.\run.bat mobile-local` | Flutter on device/emulator | Local emulators |
| `.\run.bat mobile-stg` | Flutter on device/emulator | Staging Firebase |
| `.\run.bat mobile-prod` | Flutter on device/emulator | Production Firebase |

Commands containing `mobile-web` force Chrome. Other mobile commands accept
Flutter device options, for example `.\run.bat mobile-stg -d emulator-5554`.
Every local client requires `.\run.bat local-db` to remain running in another
terminal.

Direct execution is available when troubleshooting:

```powershell
.\launchers\run-desktop-admin.bat
```

Each launcher resolves the repository root from its own location, so it can be
started while PowerShell is in another directory.

Local clients require `local-db` to remain open in a separate terminal. The
emulator launcher persists records under `data\local-firebase` and seeds sample
Admin, Faculty, and Student accounts on first use.
