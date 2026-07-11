import pyrebase
import os

# Firebase configuration
FIREBASE_CONFIG = {
    "apiKey": "AIzaSyA1pD-tdznT18bYas0-lg6gFS1gAt7ZRHo",
    "authDomain": "fac-loc.firebaseapp.com",
    "databaseURL": "https://fac-loc-default-rtdb.firebaseio.com/",
    "projectId": "fac-loc",
    "storageBucket": "fac-loc.firebasestorage.app",
    "messagingSenderId": "1004073148218",
    "appId": "1:1004073148218:web:bb702183860b0fb4083a03",
    "measurementId": "G-TTWB6F24PQ"
}

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