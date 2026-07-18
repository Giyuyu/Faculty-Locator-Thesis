import pyrebase
import os
from pathlib import Path

APP_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = APP_DIR.parent
ENVIRONMENT = os.getenv("STI_LOCATOR_ENV", "production").strip().lower()
ENV_FILE_BY_MODE = {
    "prod": ".env.production",
    "production": ".env.production",
    "stg": ".env.staging",
    "stage": ".env.staging",
    "staging": ".env.staging",
}


def get_current_environment():
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

# Global Firebase app instance
_firebase_app = None

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
            _firebase_app = pyrebase.initialize_app(FIREBASE_CONFIG)
            return True
        except Exception as e:
            print(f"Firebase initialization error: {e}")
            return False
    return True

# Get database reference
def get_database_ref():
    """Get a reference to the Firebase Realtime Database"""
    try:
        if not initialize_firebase():
            return None
        return _firebase_app.database()
    except Exception as e:
        print(f"Error getting database reference: {e}")
        return None

# Helper functions for database operations
def get_data(path=""):
    """Get data from Firebase Realtime Database"""
    try:
        db = get_database_ref()
        if not db:
            return None
        if path:
            return db.child(path).get().val()
        else:
            return db.get().val()
    except Exception as e:
        print(f"Error getting data from Firebase: {e}")
        return None

def set_data(path, data):
    """Set data in Firebase Realtime Database"""
    try:
        db = get_database_ref()
        if not db:
            return False
        db.child(path).set(data)
        return True
    except Exception as e:
        print(f"Error setting data in Firebase: {e}")
        return False

def update_data(path, data):
    """Update data in Firebase Realtime Database"""
    try:
        db = get_database_ref()
        if not db:
            return False
        db.child(path).update(data)
        return True
    except Exception as e:
        print(f"Error updating data in Firebase: {e}")
        return False

def delete_data(path):
    """Delete data from Firebase Realtime Database"""
    try:
        db = get_database_ref()
        if not db:
            return False
        db.child(path).remove()
        return True
    except Exception as e:
        print(f"Error deleting data from Firebase: {e}")
        return False
