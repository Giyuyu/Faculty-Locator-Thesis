# Faculty Locator

STI Locator is a faculty locator and room status system with:

- React/Vite web app for Admin, Faculty, Student, schedules, rooms, and live tracker views
- Flutter mobile counterpart
- Python desktop app for room/device assignment, RFID registration, and faculty login/logout
- Firebase Realtime Database as the shared backend

## Fresh Device Setup

Install these once on the new device:

- Git
- Node.js LTS
- Python 3.11 or newer
- Flutter SDK, only if the mobile app will be used

Then clone and install:

```bash
git clone https://github.com/Giyuyu/Faculty-Locator-Thesis.git
cd Faculty-Locator-Thesis
setup.bat
```

The setup script installs:

- Web dependencies with `npm install`
- Python desktop dependencies inside `.venv`
- Flutter dependencies with `flutter pub get`, when Flutter is installed

## Run The System

### Web App

```bat
run-web.bat
```

This starts the React/Vite app. Open the URL shown in the terminal, usually:

```text
http://localhost:5173
```

### Desktop Faculty Login

```bat
run-desktop-login.bat
```

Use this on room computers where faculty will scan RFID cards or manually enter their faculty ID.

### Desktop Admin Tool

```bat
run-desktop-admin.bat
```

Use this for room/device assignment and faculty RFID registration.

### Mobile App

```bat
run-mobile-web.bat
```

This runs the Flutter app in Chrome for testing.

## Device Migration Notes

When cloning to a new device, local machine settings are intentionally not included in Git:

- `desktop_app/room_config.json`
- `desktop_app/rfid_reader_config.json`
- `.venv/`
- `node_modules/`
- Flutter build folders

This is expected. Each physical desktop should set its own assigned room and RFID reader settings through the desktop admin/login tools.

## Project Structure

```text
.
|-- src/                 # React web app
|   |-- assets/          # Images and videos used by the frontend
|   |-- components/      # Shared React components
|   |-- pages/           # Admin, Faculty, Student, Login, Home, Landing pages
|   `-- utils/           # Shared frontend data/action helpers
|-- Mobile App/          # Flutter mobile app
|-- desktop_app/         # Python desktop app for faculty login, admin device setup, RFID
|-- docs/                # ERD, architecture notes, implementation guides
|-- data/samples/        # Excel schedule/sample upload files
|-- scripts/             # Small local helper scripts
`-- archive/legacy/      # Old or unused legacy files kept for reference
```

## Manual Commands

If you prefer running parts manually:

```bash
npm install
npm run dev
```

```bash
cd "Mobile App"
flutter pub get
flutter run
```

```bash
python -m venv .venv
.venv\Scripts\python -m pip install -r desktop_app\requirements.txt
.venv\Scripts\python desktop_app\login.py
.venv\Scripts\python desktop_app\admin.py
```
