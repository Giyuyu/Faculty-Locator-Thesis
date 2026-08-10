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
- [Java 21 or newer](https://adoptium.net/), only when using the local Firebase database

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

## Recommended Local Development

Use the Firebase Emulator Suite for routine development. It gives the web,
desktop, and mobile clients one shared local Authentication and Realtime
Database without touching staging or production.

First terminal, kept open:

```powershell
.\run.bat local-db
```

Second terminal, choose a client:

```powershell
.\run.bat web-local
.\run.bat login-local
.\run.bat admin-local
.\run.bat mobile-web-local
.\run.bat mobile-local
```

Firebase Emulator UI: `http://127.0.0.1:4000`

| Local role | Email | Password |
| --- | --- | --- |
| Admin | `admin@sti.edu` | `Admin@12345` |
| Faculty | `faculty.local@sti.edu` | `Faculty@12345` |
| Student | `student.local@sti.edu` | `Student@12345` |

Local records persist under `data/local-firebase/` and are not committed. See
[`docs/local-development.md`](docs/local-development.md) for physical-device,
reset, port, and environment details.

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
| `npm run dev:local` | Local emulator only |
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

The first time a desktop is configured, its local room and RFID settings are saved only on that computer.

## Run the Flutter Mobile Application

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

Local is a third isolated environment:

| Component | Local value |
| --- | --- |
| Web mode | `localdb` |
| Flutter `APP_ENV` | `local` |
| Python `STI_LOCATOR_ENV` | `local` |
| Firebase | Auth and Realtime Database emulators |

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
|-- data/local-firebase/ Persisted local emulator records (Git ignored)
|-- scripts/             Build and project helper scripts
|-- launchers/           Environment-specific Windows batch launchers
|-- firebase.json        Shared local emulator configuration
|-- run.bat              Main interactive and command-based launcher
`-- archive/legacy/      Legacy files retained for reference
```

More detailed mobile commands are available in [`Mobile App/README.md`](Mobile%20App/README.md).
