import { useState, useEffect } from "react";
import { User } from "firebase/auth";

// Simple mock user for testing without Firebase setup
const MOCK_MODE = !import.meta.env.VITE_FIREBASE_API_KEY;

export const useAuth = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(!MOCK_MODE);

  useEffect(() => {
    if (MOCK_MODE) {
      setLoading(false);
      return;
    }

    // Try to load Firebase auth, fallback to mock mode on error
    try {
      import("@/lib/firebase").then(({ onAuthStateChange }) => {
        const unsubscribe = onAuthStateChange((user) => {
          setUser(user);
          setLoading(false);
        });
        return unsubscribe;
      }).catch(() => {
        setLoading(false);
      });
    } catch (error) {
      setLoading(false);
    }
  }, []);

  const signIn = async () => {
    if (MOCK_MODE) {
      // Create a mock user for testing
      setUser({
        uid: 'mock-user-123',
        displayName: 'Test User',
        email: 'test@example.com'
      } as User);
      return;
    }

    try {
      const { signInWithGoogle } = await import("@/lib/firebase");
      const result = await signInWithGoogle();
      console.log("Sign in successful:", result.user);
    } catch (error) {
      console.error("Sign in error:", error);
      
      // Check if it's a configuration error vs popup blocked
      const errorCode = (error as any)?.code;
      if (errorCode === 'auth/popup-blocked') {
        alert('Popup was blocked. Please allow popups for this site and try again.');
      } else if (errorCode === 'auth/unauthorized-domain') {
        alert('Domain not authorized. Please check Firebase configuration.');
      } else {
        alert('Sign in failed. Using test mode instead.');
        // Fallback to mock mode
        setUser({
          uid: 'mock-user-123',
          displayName: 'Test User',
          email: 'test@example.com'
        } as User);
      }
    }
  };

  const signOut = async () => {
    if (MOCK_MODE) {
      setUser(null);
      return;
    }

    try {
      const { signOutUser } = await import("@/lib/firebase");
      await signOutUser();
    } catch (error) {
      console.error("Sign out error:", error);
      setUser(null);
    }
  };

  const isAdmin = user?.email === 'mihail.dilyanov@gmail.com';

  return {
    user,
    loading,
    signIn,
    signOut,
    isAdmin
  };
};
