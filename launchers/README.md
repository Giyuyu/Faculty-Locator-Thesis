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

Direct execution is available when troubleshooting:

```powershell
.\launchers\run-desktop-admin.bat
```

Each launcher resolves the repository root from its own location, so it can be
started while PowerShell is in another directory.

Local clients require `local-db` to remain open in a separate terminal. The
emulator launcher persists records under `data\local-firebase` and seeds sample
Admin, Faculty, and Student accounts on first use.
