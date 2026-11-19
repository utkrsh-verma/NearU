import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { User as SupabaseUser } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { api } from '../services/api';
import { CampusConfig, MyProfile } from '../types/nearu';

interface AuthContextValue {
  user: SupabaseUser | null;
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
  const [user, setUser] = useState<SupabaseUser | null>(null);
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
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session?.user) {
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
    let mounted = true;

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!mounted) return;
      const currentUser = session?.user ?? null;
      setUser(currentUser);
      if (!currentUser) {
        setProfile(null);
        setLoading(false);
        return;
      }

      try {
        const { profile: loaded } = await api.getMe();
        if (mounted) {
          setProfile(loaded);
          setAuthError(null);
        }
      } catch (err: any) {
        if (mounted) {
          setAuthError(
            err?.message || 'Could not load your account. Please try signing in again.'
          );
        }
      } finally {
        if (mounted) setLoading(false);
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return;
      const currentUser = session?.user ?? null;
      setUser(currentUser);

      if (event === 'SIGNED_OUT' || !currentUser) {
        setProfile(null);
        setLoading(false);
        return;
      }

      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
        try {
          const { profile: loaded } = await api.getMe();
          if (mounted) {
            setProfile(loaded);
            setAuthError(null);
          }
        } catch (err: any) {
          if (mounted) {
            setAuthError(
              err?.message || 'Could not load your account. Please try signing in again.'
            );
          }
        } finally {
          if (mounted) setLoading(false);
        }
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signInWithGoogle = useCallback(async () => {
    setSigningIn(true);
    setAuthError(null);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin,
          queryParams: {
            prompt: 'select_account',
          },
        },
      });
      if (error) throw error;
    } catch (err: any) {
      setAuthError(err?.message || 'Google sign-in failed. Please try again.');
    } finally {
      setSigningIn(false);
    }
  }, []);

  const signOut = useCallback(async () => {
    setAuthError(null);
    try {
      await supabase.auth.signOut();
      setUser(null);
      setProfile(null);
    } catch (err: any) {
      setAuthError(err?.message || 'Could not sign out cleanly. Please refresh.');
    }
  }, []);

  const deleteAccount = useCallback(async () => {
    setAuthError(null);
    await api.deleteAccount();
    try {
      await supabase.auth.signOut();
    } catch {
      // Ignore sign-out error after account deletion
    }
    setUser(null);
    setProfile(null);
  }, []);

  const clearAuthError = useCallback(() => setAuthError(null), []);

  return (
    <AuthContext.Provider
      value={{
        user,
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
