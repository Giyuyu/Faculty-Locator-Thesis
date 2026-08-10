// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { connectAuthEmulator, getAuth } from "firebase/auth";
import { connectDatabaseEmulator, getDatabase } from "firebase/database";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase Authentication
const auth = getAuth(app);

// Initialize Realtime Database
const database = getDatabase(app);

const useFirebaseEmulators = import.meta.env.VITE_USE_FIREBASE_EMULATORS === 'true';

if (useFirebaseEmulators) {
  const emulatorHost = import.meta.env.VITE_FIREBASE_EMULATOR_HOST || '127.0.0.1';
  const authEmulatorPort = Number(import.meta.env.VITE_FIREBASE_AUTH_EMULATOR_PORT || 9099);
  const databaseEmulatorPort = Number(import.meta.env.VITE_FIREBASE_DATABASE_EMULATOR_PORT || 9000);
  connectAuthEmulator(auth, `http://${emulatorHost}:${authEmulatorPort}`, { disableWarnings: true });
  connectDatabaseEmulator(database, emulatorHost, databaseEmulatorPort);
}

// Export the instances for use in other parts of the app
export { app, auth, database, firebaseConfig, useFirebaseEmulators };
