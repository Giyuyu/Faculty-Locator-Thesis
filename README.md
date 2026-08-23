# STI Faculty Locator

STI Locator is a faculty location and room-status system composed of:

- A React/Vite web application for Admin, Faculty, Student, and Kiosk views
- A Flutter mobile application for Faculty and Student viewing
- A Python desktop application for RFID login, room assignment, and device setup
- Firebase Authentication and Realtime Database as the shared backend

## First-Time Setup on Windows

### 1. Install the required software

Install these applications before cloning the project:

- [Git](https://git-scm.com/download/win)
- [Node.js LTS](https://nodejs.org/)
- [Python 3.11 or newer](https://www.python.org/downloads/)
- [Flutter](https://docs.flutter.dev/get-started/install/windows), only when developing or running the mobile app

During Python installation, enable **Add Python to PATH**.

### 2. Clone the project

Open PowerShell and run:

```powershell
git clone https://github.com/Giyuyu/Faculty-Locator-Thesis.git
cd Faculty-Locator-Thesis
```

### 3. Run the setup script

From the project root, run:

```powershell
.\setup.bat
```

The setup script:

- Installs web dependencies with `npm install`
- Creates the Python `.venv` virtual environment
- Installs the Python desktop dependencies
- Installs Flutter packages when Flutter is available

Run this setup once after cloning. Run it again when project dependencies change.

## Important PowerShell Note

PowerShell does not run programs from the current folder by name alone. Prefix local batch files with `.` and a backslash:

```powershell
.\run.bat admin
```

This may fail in PowerShell:

```text
run.bat admin
```

Use the `\.\` prefix for every launcher shown in this guide. Command Prompt (`cmd`) normally allows the filename without this prefix, but using `\.\` consistently is recommended.

Running `\.\run.bat` without an option opens an interactive menu. The individual launchers are organized inside the `launchers\` folder.

## All Launcher Differences

| Command | Application and target | Data environment | When to use it |
| --- | --- | --- | --- |
| `.\run.bat` | Interactive launcher menu | You choose | Use when you want to select a command from a numbered list. |
| `.\run.bat web-stg` | React web app in the default browser | Staging (`fac-loc-stg`) | Test web changes against staging data. |
| `.\run.bat web-prod` | React web app in the default browser | Production (`fac-loc`) | Run the web app locally against live production data. |
| `.\run.bat login-stg` | Python faculty RFID login desktop app | Staging (`fac-loc-stg`) | Test room login and RFID behavior using staging data. |
| `.\run.bat login` | Python faculty RFID login desktop app | Production (`fac-loc`) | Run the faculty room-login station with live data. |
| `.\run.bat admin-stg` | Python desktop administration app | Staging (`fac-loc-stg`) | Configure and test desktop records in staging. |
| `.\run.bat admin` | Python desktop administration app | Production (`fac-loc`) | Configure production room devices and faculty RFID cards. |
| `.\run.bat mobile-web-stg` | Flutter mobile app in Chrome | Staging (`fac-loc-stg`) | Test the mobile UI in Chrome using staging data. |
| `.\run.bat mobile-web` | Flutter mobile app in Chrome | Production (`fac-loc`) | Inspect the mobile UI in Chrome using live data. |
| `.\run.bat mobile-stg` | Flutter app on Android/iOS or an emulator | Staging (`fac-loc-stg`) | Test the device app safely before release. |
| `.\run.bat mobile-prod` | Flutter app on Android/iOS or an emulator | Production (`fac-loc`) | Run the device app using live production data. |

Environment naming is consistent across launchers:

- `-stg` uses the separate staging Firebase project.
- Production commands use either `-prod` or no suffix (`login`, `admin`, and `mobile-web`).
- `mobile-web...` runs Flutter in Chrome; other `mobile...` commands run on a device or emulator.

## Run the Web Application

### Staging web

```powershell
.\run.bat web-stg
```

The browser address is normally:

```text
http://localhost:5173
```

Manual web commands:

```powershell
npm run dev:stg
npm run dev:prod
```

| Command | Firebase project |
| --- | --- |
| `npm run dev` or `npm run dev:stg` | `fac-loc-stg` |
| `npm run dev:prod` | `fac-loc` |

## Run the Python Desktop Applications

Run these commands from the project root.

### Faculty RFID login

Production:

```powershell
.\run.bat login
```

Staging:

```powershell
.\run.bat login-stg
```

Use this application on assigned room computers where faculty scan an RFID card or enter a Faculty ID manually.

### Desktop admin tool

Production:

```powershell
.\run.bat admin
```

Staging:

```powershell
.\run.bat admin-stg
```

Use the admin tool to assign a room to the device and register faculty RFID cards.

Staging and production project settings are included with the repository. The
desktop tools connect directly and do not request initialization credentials.

The first time a desktop is configured, its local room and RFID settings are saved only on that computer.

## Run the Flutter Mobile Application

The complete target and environment comparison is listed in
**All Launcher Differences** above.

### Test in Chrome

Production:

```powershell
.\run.bat mobile-web
```

Staging:

```powershell
.\run.bat mobile-web-stg
```

### Run on an Android or iOS device

Connect a device or start an emulator first.

Production:

```powershell
.\run.bat mobile-prod
```

Staging:

```powershell
.\run.bat mobile-stg
```

To select a specific device:

```powershell
flutter devices
.\run.bat mobile-stg -d emulator-5554
```

The staging app displays an `STG` badge beside the STI Locator name.

## Production and Staging

| Component | Production | Staging |
| --- | --- | --- |
| Web mode | `production` | `staging` |
| Flutter `APP_ENV` | `production` | `staging` |
| Python `STI_LOCATOR_ENV` | `production` | `staging` |
| Firebase project | `fac-loc` | `fac-loc-stg` |

Staging data is separate from production data. Test imports, account changes, roles, schedules, rooms, and RFID configuration against staging before applying them to production.

## Updating an Existing Installation

From the project root:

```powershell
git pull
.\setup.bat
```

If no dependencies changed, running `git pull` and restarting the affected application is normally enough.

## Device Migration Notes

These machine-specific or generated folders are intentionally not stored in Git:

- `.venv\`
- `node_modules\`
- Flutter `build\` and `.dart_tool\`
- `desktop_app\room_config.json`
- `desktop_app\rfid_reader_config.json`

After cloning on another room computer:

1. Run `.\setup.bat`.
2. Run the correct desktop admin environment.
3. Assign that computer to its room.
4. Confirm the RFID reader is detected.
5. Test a faculty login and logout.

## Common Problems

### Batch file is not recognized

Error:

```text
The term 'run.bat' is not recognized...
```

Solution:

```powershell
.\run.bat admin
```

Also confirm PowerShell is currently inside the project root:

```powershell
Get-Location
Get-ChildItem *.bat
```

### Flutter command is not found

Install Flutter, add its `bin` directory to PATH, restart PowerShell, and run:

```powershell
flutter doctor
```

### Python desktop application does not start

Run setup again:

```powershell
.\setup.bat
```

Then confirm the virtual environment exists:

```powershell
Test-Path .\.venv\Scripts\python.exe
```

### Port 5173 is already in use

Vite will usually select another port automatically. Open the URL printed in the terminal.

## Manual Commands

Web:

```powershell
npm install
npm run dev:stg
```

Desktop:

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r desktop_app\requirements.txt
.\.venv\Scripts\python.exe desktop_app\login.py
.\.venv\Scripts\python.exe desktop_app\admin.py
```

Flutter staging:

```powershell
cd "Mobile App"
flutter pub get
flutter run --dart-define=APP_ENV=staging
```

## Project Structure

```text
.
|-- src/                 React/Vite web application
|-- Mobile App/          Flutter mobile application
|-- desktop_app/         Python desktop and RFID applications
|-- docs/                Architecture and database documentation
|-- data/samples/        Sample schedule and account upload files
|-- scripts/             Build and project helper scripts
|-- launchers/           Environment-specific Windows batch launchers
|-- firebase.json        Firebase deployment configuration
|-- run.bat              Main interactive and command-based launcher
`-- archive/legacy/      Legacy files retained for reference
```

More detailed mobile commands are available in [`Mobile App/README.md`](Mobile%20App/README.md).
