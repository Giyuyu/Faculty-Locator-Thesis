# Desktop App

Python desktop utilities for STI Locator.

## Files

- `login.py` - faculty RFID/manual login and logout app
- `admin.py` - device, room, and RFID registration admin app
- `device_utils.py` - device identification and room assignment helpers
- `rfid_utils.py` - RFID reader auto-detection and scan parsing
- `firebase_config.py` - Firebase access helpers

## Setup from PowerShell

From the repository root:

```powershell
.\setup.bat
```

Copy `.env.desktop.example` to `.env.desktop.local` and configure the Firebase
Authentication accounts for each environment before running staging or
production. See `docs/security-hardening.md`. The local emulator credentials are
already documented in the example file.

## Run

```bat
python login.py
python admin.py
```

From the project root, use the central launcher. PowerShell requires `\.\` before a batch file in the current directory:

```powershell
.\run.bat login
.\run.bat admin
.\run.bat login-stg
.\run.bat admin-stg
.\run.bat login-local
.\run.bat admin-local
```

`login` and `admin` use production.

`login-stg` and `admin-stg` use staging.

`login-local` and `admin-local` use the shared Firebase emulator. Start it in a
separate terminal first:

```powershell
.\run.bat local-db
```

The individual batch files are stored in the repository's `launchers\` folder.

You can also choose the Firebase environment manually:

```powershell
$env:STI_LOCATOR_ENV = "production"
.\.venv\Scripts\python.exe desktop_app\login.py
```

```powershell
$env:STI_LOCATOR_ENV = "staging"
.\.venv\Scripts\python.exe desktop_app\login.py
```

```powershell
$env:STI_LOCATOR_ENV = "local"
.\.venv\Scripts\python.exe desktop_app\login.py
```

Local mode uses the Realtime Database emulator at `127.0.0.1:9000`. It never
falls back to staging or production if the emulator is unavailable.

If PowerShell reports that `run.bat` is not recognized, use:

```powershell
.\run.bat admin
```
