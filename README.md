# Faculty Locator

STI Locator is a faculty locator and room status system with a React/Vite web app, a Flutter mobile counterpart, and Python desktop utilities for device/RFID login.

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

## Web App

```bash
npm install
npm run dev
npm run build
```

## Mobile App

```bash
cd "Mobile App"
flutter pub get
flutter run
```

## Desktop App

```bash
cd desktop_app
setup_python_env.bat
python login.py
python admin.py
```

The desktop app stores local config in `desktop_app/room_config.json` and uses Firebase for shared data.
