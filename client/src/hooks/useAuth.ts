import { useState, useEffect } from 'react';
import { auth, signInWithGoogle as firebaseSignInWithGoogle } from '../lib/firebase';
import {
  signOut as firebaseSignOut,
  onAuthStateChanged,
  User
} from 'firebase/auth';

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setUser(user);
      
      // Check if user is admin by looking at custom claims
      if (user) {
        try {
          const token = await user.getIdTokenResult();
          const isUserAdmin = token.claims?.admin === true;
          setIsAdmin(isUserAdmin);
        } catch (error) {
          console.error('Error checking admin status:', error);
          setIsAdmin(false);
        }
      } else {
        setIsAdmin(false);
      }
      
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const signInWithGoogle = firebaseSignInWithGoogle;

  const signOut = async () => {
    try {
      await firebaseSignOut(auth);
    } catch (error) {
      console.error('Sign out error:', error);
      throw error;
    }
  };

  return {
    user,
    loading,
    isAdmin,
    signInWithGoogle,
    signOut
  };
}
