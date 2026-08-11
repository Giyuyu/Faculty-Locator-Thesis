import pyrebase
import os
import json
import urllib.error
import urllib.parse
import urllib.request
import time
from pathlib import Path

APP_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = APP_DIR.parent
ENVIRONMENT = os.getenv("STI_LOCATOR_ENV", "production").strip().lower()
ENV_FILE_BY_MODE = {
    "local": ".env.localdb",
    "development": ".env.localdb",
    "prod": ".env.production",
    "production": ".env.production",
    "stg": ".env.staging",
    "stage": ".env.staging",
    "staging": ".env.staging",
}


def get_current_environment():
    if ENVIRONMENT in ("local", "development"):
        return "local"
    return "staging" if ENVIRONMENT in ("stg", "stage", "staging") else "production"


def _read_env_file(path):
    values = {}
    if not path.exists():
        return values

    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue

        key, value = line.split("=", 1)
        values[key.strip()] = value.strip().strip('"').strip("'")

    return values


def _env_value(values, key):
    return os.getenv(key) or values.get(key, "")


def load_firebase_config():
    env_file_name = ENV_FILE_BY_MODE.get(ENVIRONMENT, ".env.production")
    values = _read_env_file(PROJECT_ROOT / env_file_name)

    return {
        "apiKey": _env_value(values, "VITE_FIREBASE_API_KEY"),
        "authDomain": _env_value(values, "VITE_FIREBASE_AUTH_DOMAIN"),
        "databaseURL": _env_value(values, "VITE_FIREBASE_DATABASE_URL"),
        "projectId": _env_value(values, "VITE_FIREBASE_PROJECT_ID"),
        "storageBucket": _env_value(values, "VITE_FIREBASE_STORAGE_BUCKET"),
        "messagingSenderId": _env_value(values, "VITE_FIREBASE_MESSAGING_SENDER_ID"),
        "appId": _env_value(values, "VITE_FIREBASE_APP_ID"),
        "measurementId": _env_value(values, "VITE_FIREBASE_MEASUREMENT_ID"),
    }


FIREBASE_CONFIG = load_firebase_config()
IS_LOCAL = get_current_environment() == "local"
LOCAL_DATABASE_HOST = os.getenv("STI_LOCATOR_LOCAL_DB_HOST", "127.0.0.1")
LOCAL_DATABASE_PORT = int(os.getenv("STI_LOCATOR_LOCAL_DB_PORT", "9000"))
LOCAL_PROJECT_ID = FIREBASE_CONFIG.get("projectId") or "sti-locator-local"
LOCAL_DATABASE_NAMESPACE = os.getenv(
    "STI_LOCATOR_LOCAL_DB_NAMESPACE", f"{LOCAL_PROJECT_ID}-default-rtdb"
)

# Global Firebase app instance
_firebase_app = None
_firebase_user = None
_authenticated_at = 0


def _desktop_credentials():
    local_values = _read_env_file(PROJECT_ROOT / ".env.desktop.local")
    environment_key = get_current_environment().upper()
    client_key = os.getenv("STI_LOCATOR_DESKTOP_CLIENT", "DEVICE").strip().upper()
    email_key = f"STI_LOCATOR_DESKTOP_{client_key}_{environment_key}_EMAIL"
    password_key = f"STI_LOCATOR_DESKTOP_{client_key}_{environment_key}_PASSWORD"
    email = _env_value(local_values, email_key)
    password = _env_value(local_values, password_key)
    if get_current_environment() == "local" and (not email or not password):
        if client_key == "ADMIN":
            return "admin@sti.edu", "Admin@12345"
        return "device.local@sti.edu", "Device@12345"
    return email, password


def _authenticate_desktop():
    global _firebase_user, _authenticated_at
    email, password = _desktop_credentials()
    if not email or not password:
        raise RuntimeError(
            "Desktop Firebase credentials are missing. Copy .env.desktop.example "
            "to .env.desktop.local and configure the selected environment."
        )

    if IS_LOCAL:
        endpoint = (
            f"http://{LOCAL_DATABASE_HOST}:9099/identitytoolkit.googleapis.com/"
            "v1/accounts:signInWithPassword?key=local-emulator-key"
        )
        request = urllib.request.Request(
            endpoint,
            data=json.dumps({
                "email": email,
                "password": password,
                "returnSecureToken": True,
            }).encode("utf-8"),
            method="POST",
            headers={"Content-Type": "application/json"},
        )
        with urllib.request.urlopen(request, timeout=5) as response:
            _firebase_user = json.loads(response.read().decode("utf-8"))
    else:
        _firebase_user = _firebase_app.auth().sign_in_with_email_and_password(email, password)
    _authenticated_at = time.time()


def _id_token():
    if not _firebase_user or time.time() - _authenticated_at > 45 * 60:
        _authenticate_desktop()
    return _firebase_user.get("idToken")

# Initialize Firebase
def initialize_firebase():
    """
    Initialize Firebase using Pyrebase4.
    Pyrebase4 provides a simple interface for Firebase Realtime Database.
    """
    global _firebase_app
    if _firebase_app is None:
        try:
            if not FIREBASE_CONFIG.get("apiKey") or not FIREBASE_CONFIG.get("databaseURL"):
                print(f"Firebase configuration is missing for {get_current_environment()} environment.")
                return False
            _firebase_app = "local-emulator" if IS_LOCAL else pyrebase.initialize_app(FIREBASE_CONFIG)
            _authenticate_desktop()
            return True
        except Exception as e:
            _firebase_app = None
            print(f"Firebase initialization error: {e}")
            return False
    return True

# Get database reference
def get_database_ref():
    """Get a reference to the Firebase Realtime Database"""
    try:
        if not initialize_firebase():
            return None
        return None if IS_LOCAL else _firebase_app.database()
    except Exception as e:
        print(f"Error getting database reference: {e}")
        return None

# Helper functions for database operations
def get_data(path=""):
    """Get data from Firebase Realtime Database"""
    try:
        if IS_LOCAL:
            return _local_request("GET", path)
        db = get_database_ref()
        if not db:
            return None
        if path:
            return db.child(path).get(_id_token()).val()
        else:
            return db.get(_id_token()).val()
    except Exception as e:
        print(f"Error getting data from Firebase: {e}")
        return None

def set_data(path, data):
    """Set data in Firebase Realtime Database"""
    try:
        if IS_LOCAL:
            _local_request("PUT", path, data)
            return True
        db = get_database_ref()
        if not db:
            return False
        db.child(path).set(data, _id_token())
        return True
    except Exception as e:
        print(f"Error setting data in Firebase: {e}")
        return False

def update_data(path, data):
    """Update data in Firebase Realtime Database"""
    try:
        if IS_LOCAL:
            _local_request("PATCH", path, data)
            return True
        db = get_database_ref()
        if not db:
            return False
        db.child(path).update(data, _id_token())
        return True
    except Exception as e:
        print(f"Error updating data in Firebase: {e}")
        return False

def delete_data(path):
    """Delete data from Firebase Realtime Database"""
    try:
        if IS_LOCAL:
            _local_request("DELETE", path)
            return True
        db = get_database_ref()
        if not db:
            return False
        db.child(path).remove(_id_token())
        return True
    except Exception as e:
        print(f"Error deleting data from Firebase: {e}")
        return False


def _local_request(method, path="", data=None):
    """Read and write the shared Firebase Realtime Database emulator."""
    clean_path = str(path or "").strip("/")
    encoded_path = "/".join(urllib.parse.quote(part, safe="") for part in clean_path.split("/") if part)
    suffix = f"/{encoded_path}.json" if encoded_path else "/.json"
    query = urllib.parse.urlencode({
        "ns": LOCAL_DATABASE_NAMESPACE,
        "auth": _id_token(),
    })
    url = f"http://{LOCAL_DATABASE_HOST}:{LOCAL_DATABASE_PORT}{suffix}?{query}"
    body = None if data is None else json.dumps(data).encode("utf-8")
    request = urllib.request.Request(
        url,
        data=body,
        method=method,
        headers={"Content-Type": "application/json"},
    )
    try:
        with urllib.request.urlopen(request, timeout=5) as response:
            payload = response.read().decode("utf-8")
            return json.loads(payload) if payload else None
    except urllib.error.URLError as error:
        raise RuntimeError(
            "Local Firebase is not running. Start it with: .\\run.bat local-db"
        ) from error
