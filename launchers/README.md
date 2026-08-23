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
