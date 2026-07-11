// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getDatabase } from "firebase/database";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyA1pD-tdznT18bYas0-lg6gFS1gAt7ZRHo",
  authDomain: "fac-loc.firebaseapp.com",
  projectId: "fac-loc",
  storageBucket: "fac-loc.firebasestorage.app",
  messagingSenderId: "1004073148218",
  appId: "1:1004073148218:web:bb702183860b0fb4083a03",
  measurementId: "G-TTWB6F24PQ"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase Authentication
const auth = getAuth(app);

// Initialize Realtime Database
const database = getDatabase(app);

// Export the instances for use in other parts of the app
export { app, auth, database, firebaseConfig };
