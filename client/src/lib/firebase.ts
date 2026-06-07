import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged, User } from "firebase/auth";

// Firebase configuration - sourced entirely from environment variables.
// These VITE_* values are public by design (Firebase relies on Security Rules
// and authorized domains, not on the keys being secret), but they must not be
// hardcoded in source so they can be rotated and managed per environment.
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
};

// Fail fast if required configuration is missing rather than silently shipping
// a broken or misconfigured auth setup.
const requiredKeys = ["apiKey", "authDomain", "projectId", "appId"] as const;
const missingKeys = requiredKeys.filter((key) => !firebaseConfig[key]);
if (missingKeys.length > 0) {
  throw new Error(
    `Missing required Firebase env vars: ${missingKeys
      .map((k) => `VITE_FIREBASE_${k.replace(/([A-Z])/g, "_$1").toUpperCase()}`)
      .join(", ")}`
  );
}

// Initialize Firebase (AUTH ONLY)
let app: any = null;
let auth: any = null;

try {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
} catch (error) {
  console.error("❌ Firebase Auth initialization failed:", error);
}

const provider = new GoogleAuthProvider();
// Add prompt to select account for better UX in production
provider.setCustomParameters({
  prompt: 'select_account'
});

// Auth functions only
export const signInWithGoogle = () => {
  if (!auth) {
    throw new Error("Firebase Auth not initialized");
  }
  
  // Enhanced error handling for production
  return signInWithPopup(auth, provider).catch((error) => {
    console.error("Google Sign-In Error:", error);
    
    // Provide user-friendly error messages
    if (error.code === 'auth/popup-blocked') {
      throw new Error("Popup was blocked. Please allow popups for this site and try again.");
    } else if (error.code === 'auth/popup-closed-by-user') {
      throw new Error("Sign-in was cancelled. Please try again.");
    } else if (error.code === 'auth/network-request-failed') {
      throw new Error("Network error. Please check your connection and try again.");
    } else if (error.code === 'auth/unauthorized-domain') {
      throw new Error("This domain is not authorized for Google sign-in. Please contact support.");
    }
    
    throw error;
  });
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
