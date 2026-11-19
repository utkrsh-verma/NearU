import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import {
  User,
  deleteUser,
  onAuthStateChanged,
  signInWithPopup,
  signOut as firebaseSignOut,
} from 'firebase/auth';
import { auth, googleAuthProvider } from '../lib/firebase';
import { api } from '../services/api';
import { CampusConfig, MyProfile } from '../types/nearu';

interface AuthContextValue {
  firebaseUser: User | null;
  profile: MyProfile | null;
  campusConfig: CampusConfig | null;
  loading: boolean;
  authError: string | null;
  signingIn: boolean;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  deleteAccount: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  setProfile: React.Dispatch<React.SetStateAction<MyProfile | null>>;
  clearAuthError: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<MyProfile | null>(null);
  const [campusConfig, setCampusConfig] = useState<CampusConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [signingIn, setSigningIn] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    api
      .getCampusConfig()
      .then(setCampusConfig)
      .catch(() => {
        setCampusConfig({
          campusName: 'GL Bajaj Institute of Technology & Management',
          campusShortName: 'GL Bajaj, Greater Noida',
          allowedDomains: ['glbitm.ac.in'],
          allowAnyGoogleSignIn: true,
          allowRollCodeVerification: true,
          institutionalEmailRequired: false,
          minAge: 18,
        });
      });
  }, []);

  const refreshProfile = useCallback(async () => {
    if (!auth.currentUser) {
      setProfile(null);
      return;
    }
    try {
      const { profile: loaded } = await api.getMe();
      setProfile(loaded);
      setAuthError(null);
    } catch (err: any) {
      setAuthError(err?.message || 'Unable to sync your NearU account.');
    }
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user);
      if (!user) {
        setProfile(null);
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const { profile: loaded } = await api.getMe();
        setProfile(loaded);
        setAuthError(null);
      } catch (err: any) {
        setAuthError(
          err?.message || 'Could not load your account. Please try signing in again.'
        );
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  const signInWithGoogle = useCallback(async () => {
    setSigningIn(true);
    setAuthError(null);
    try {
      await signInWithPopup(auth, googleAuthProvider);
    } catch (err: any) {
      if (err?.code === 'auth/popup-closed-by-user') {
        setAuthError('Sign-in was cancelled. Click Continue with Google to try again.');
      } else if (err?.code === 'auth/popup-blocked') {
        setAuthError('Pop-up was blocked by your browser. Please allow pop-ups and try again.');
      } else {
        setAuthError(err?.message || 'Google sign-in failed. Please try again.');
      }
    } finally {
      setSigningIn(false);
    }
  }, []);

  const signOut = useCallback(async () => {
    setAuthError(null);
    try {
      await firebaseSignOut(auth);
      setProfile(null);
    } catch (err: any) {
      setAuthError(err?.message || 'Could not sign out cleanly. Please refresh.');
    }
  }, []);

  const deleteAccount = useCallback(async () => {
    setAuthError(null);
    const currentUser = auth.currentUser;
    await api.deleteAccount();
    if (currentUser) {
      try {
        await deleteUser(currentUser);
      } catch {
        try {
          await firebaseSignOut(auth);
        } catch {
          // Ignore sign-out error after account deletion
        }
      }
    }
    setFirebaseUser(null);
    setProfile(null);
  }, []);

  const clearAuthError = useCallback(() => setAuthError(null), []);

  return (
    <AuthContext.Provider
      value={{
        firebaseUser,
        profile,
        campusConfig,
        loading,
        authError,
        signingIn,
        signInWithGoogle,
        signOut,
        deleteAccount,
        refreshProfile,
        setProfile,
        clearAuthError,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
