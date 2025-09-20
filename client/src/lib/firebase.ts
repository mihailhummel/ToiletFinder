import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged, User } from "firebase/auth";

// Firebase configuration - supports both environment variables and defaults
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyAtsQ6Q-VNqVZee2v2Dz_yzfCL-7u1b2kQ",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "findwc-2be85.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "findwc-2be85",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "findwc-2be85.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "823137125904",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:823137125904:web:3c6d8394fbc5ca7995ac95",
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || "G-NLG2BCCRC4"
};

// Log configuration for debugging in production
if (import.meta.env.PROD) {
  console.log("🔑 Firebase Config:", {
    authDomain: firebaseConfig.authDomain,
    projectId: firebaseConfig.projectId,
    usingEnvVars: !!import.meta.env.VITE_FIREBASE_API_KEY
  });
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
