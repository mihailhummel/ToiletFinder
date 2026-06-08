import { useState, useEffect } from 'react';
import { auth, signInWithGoogle as firebaseSignInWithGoogle } from '../lib/firebase';
import {
  signOut as firebaseSignOut,
  onAuthStateChanged,
  User
} from 'firebase/auth';
import { apiRequest } from '@/lib/queryClient';
import { CONSENT_VERSION } from '@/lib/consent';

// Record terms/privacy acceptance once per consent version per browser. The
// server is insert-once, so this is just to avoid a redundant POST on each load.
async function recordConsentOnce() {
  const flag = `toaletna-consent-recorded-v${CONSENT_VERSION}`;
  if (localStorage.getItem(flag)) return;
  try {
    await apiRequest('POST', '/api/consent', {
      version: CONSENT_VERSION,
      acceptedTerms: true,
      acceptedPrivacy: true,
    });
    localStorage.setItem(flag, '1');
  } catch {
    /* non-critical — will retry on next load */
  }
}

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
        // Record terms/privacy consent for this signed-in user (GDPR audit trail).
        recordConsentOnce();
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
