# Desktop App

Python desktop utilities for STI Locator.

## Files

- `login.py` - faculty RFID/manual login and logout app
- `admin.py` - device, room, and RFID registration admin app
- `device_utils.py` - device identification and room assignment helpers
- `rfid_utils.py` - RFID reader auto-detection and scan parsing
- `firebase_config.py` - Firebase access helpers

## Setup

```bat
setup_python_env.bat
```

## Run

```bat
python login.py
python admin.py
```

From the project root, use these launchers:

```bat
run-desktop-login.bat
run-desktop-admin.bat
run-desktop-login-stg.bat
run-desktop-admin-stg.bat
```

`run-desktop-login.bat` and `run-desktop-admin.bat` use production.

`run-desktop-login-stg.bat` and `run-desktop-admin-stg.bat` use staging.

You can also choose the Firebase environment manually:

```bat
set STI_LOCATOR_ENV=production
python desktop_app\login.py
```

```bat
set STI_LOCATOR_ENV=staging
python desktop_app\login.py
```
