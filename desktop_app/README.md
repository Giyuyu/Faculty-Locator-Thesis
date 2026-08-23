# Desktop App

Python desktop utilities for STI Locator:

- `login.py` - faculty RFID/manual login and logout
- `admin.py` - room, device, and RFID registration
- `device_utils.py` - device identification and room assignment
- `rfid_utils.py` - RFID reader detection and scan parsing
- `firebase_config.py` - staging/production Firebase access

Install dependencies from the repository root:

```powershell
.\setup.bat
```

Run staging:

```powershell
.\run.bat login-stg
.\run.bat admin-stg
```

Run production:

```powershell
.\run.bat login
.\run.bat admin
```

The tracked staging and production project configurations are loaded
automatically. No `.env.desktop.local`, desktop account, or initialization
sign-in is required.
