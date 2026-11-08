# Windows Launchers

Run the central launcher from the repository root:

```powershell
.\run.bat
```

Available direct commands:

| Command | Application | Firebase environment |
| --- | --- | --- |
| `.\run.bat web-stg` | React web app | Staging |
| `.\run.bat web-prod` | React web app | Production |
| `.\run.bat login-stg` | Python RFID login | Staging |
| `.\run.bat login` | Python RFID login | Production |
| `.\run.bat admin-stg` | Python desktop admin | Staging |
| `.\run.bat admin` | Python desktop admin | Production |
| `.\run.bat mobile-web-stg` | Flutter in Chrome | Staging |
| `.\run.bat mobile-web` | Flutter in Chrome | Production |
| `.\run.bat mobile-stg` | Flutter on a device | Staging |
| `.\run.bat mobile-prod` | Flutter on a device | Production |

The project configuration is included for both Firebase environments. Desktop
launchers connect directly without a credential file or initialization sign-in.
Flutter device arguments can be appended, for example:

```powershell
.\run.bat mobile-stg -d emulator-5554
```

## Web app with npm

Run these commands from the repository root. The regular development commands
use the staging or production Firebase project; use emulator mode to keep web
development data local.

| Command | Application | Firebase environment |
| --- | --- | --- |
| `npm run dev` | Vite web app | Staging |
| `npm run dev:stg` | Vite web app | Staging |
| `npm run dev:stg:full` | Vite and local Vercel API routes | Staging |
| `npm run dev:prod` | Vite web app | Production |
| `npm run dev:local` | Vite web app | Local Auth and Realtime Database emulators |
| `npm run emulators` | Firebase Auth and Realtime Database emulators | Local (`fac-loc-local`) |

For local emulator development, open two PowerShell terminals in the repository
root. Run `npm run emulators` in the first terminal, then `npm run dev:local` in
the second. Open `http://localhost:5173`; the emulator dashboard is at
`http://127.0.0.1:4000`. Local emulator accounts and data are separate from
staging and production, and start empty unless emulator data import/export is
configured.
