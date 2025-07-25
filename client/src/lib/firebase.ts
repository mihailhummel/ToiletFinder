import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged, User } from "firebase/auth";

// Firebase configuration for findwc-2be85 project (AUTH ONLY)
const firebaseConfig = {
  apiKey: "AIzaSyAtsQ6Q-VNqVZee2v2Dz_yzfCL-7u1b2kQ",
  authDomain: "findwc-2be85.firebaseapp.com",
  projectId: "findwc-2be85",
  storageBucket: "findwc-2be85.firebasestorage.app",
  messagingSenderId: "823137125904",
  appId: "1:823137125904:web:3c6d8394fbc5ca7995ac95",
  measurementId: "G-NLG2BCCRC4"
};

// Initialize Firebase (AUTH ONLY)
let app: any = null;
let auth: any = null;

try {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  console.log("✅ Firebase Auth initialized successfully");
} catch (error) {
  console.error("❌ Firebase Auth initialization failed:", error);
}

const provider = new GoogleAuthProvider();

// Auth functions only
export const signInWithGoogle = () => {
  if (!auth) {
    throw new Error("Firebase Auth not initialized");
  }
  return signInWithPopup(auth, provider);
};

export const signOutUser = () => {
  if (!auth) {
    throw new Error("Firebase Auth not initialized");
  }
  return signOut(auth);
};

export const onAuthStateChange = (callback: (user: User | null) => void) => {
  if (!auth) {
    // Return a mock function that immediately calls callback with null
    callback(null);
    return () => {};
  }
  return onAuthStateChanged(auth, callback);
};

// Export auth instance for useAuth hook
export { auth };
