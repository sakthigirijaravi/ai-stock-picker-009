import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase, UserProfile } from '../lib/supabase';
import { useNavigate, useLocation } from 'react-router-dom';

interface AuthContextType {
  user: User | null;
  userProfile: UserProfile | null;
  session: Session | null;
  loading: boolean;
  isInitialized: boolean;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  restoreSession: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: React.ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [isInitialized, setIsInitialized] = useState(false);

  // Store user's last location for session restoration
  const storeUserLocation = (path: string) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('lastUserLocation', path);
    }
  };

  const getStoredLocation = (): string | null => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('lastUserLocation');
    }
    return null;
  };

  const clearStoredLocation = () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('lastUserLocation');
    }
  };
  useEffect(() => {
    // Get initial session
    const getInitialSession = async () => {
      try {
        setLoading(true);
      const { data: { session }, error } = await supabase.auth.getSession();
      if (error) {
        console.error('Error getting session:', error);
      } else {
        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user) {
          await fetchUserProfile(session.user.id);
        }
      }
      setLoading(false);
    };

    getInitialSession();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        
        if (session?.user) {
          await fetchUserProfile(session.user.id);
        } else {
          setUserProfile(null);
        }
        
        setLoading(false);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  const fetchUserProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Error fetching user profile:', error);
        return;
      }

      if (data) {
        setUserProfile(data);
      } else {
        // Create user profile if it doesn't exist
        await createUserProfile(userId);
      }
    } catch (error) {
      console.error('Error in fetchUserProfile:', error);
    }
  };

  const createUserProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .insert([
          {
            id: userId,
            email: user?.email || '',
            full_name: user?.user_metadata?.full_name || null,
            avatar_url: user?.user_metadata?.avatar_url || null,
            subscription_status: 'free'
            // Store current location if user is authenticated
            const currentPath = window.location.pathname;
            if (currentPath !== '/auth/callback') {
              storeUserLocation(currentPath);
            }
          }
        ])
        .select()
        .single();

      if (error) {
        console.error('Error creating user profile:', error);
      } else {
        setUserProfile(data);
      }
    } catch (error) {
      console.error('Error in createUserProfile:', error);
    }
        setIsInitialized(true);
      }
  };

  const signInWithGoogle = async () => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
        console.log('Auth state change:', event, session?.user?.id);
        
          redirectTo: window.location.origin
        }
      } catch (error) {
        console.error('Error in getInitialSession:', error);
      } finally {
          
          // Handle successful login - restore user's last location
          if (event === 'SIGNED_IN') {
            const lastLocation = getStoredLocation();
            if (lastLocation && lastLocation !== '/auth/callback' && lastLocation !== '/') {
              // Small delay to ensure all auth state is properly set
              setTimeout(() => {
                window.location.href = lastLocation;
              }, 100);
            }
          }
      });
      
          // Clear stored location on sign out
          if (event === 'SIGNED_OUT') {
            clearStoredLocation();
          }
      if (error) {
        console.error('Error signing in with Google:', error);
        if (!loading) {
          setLoading(false);
        }
      }
    } catch (error) {
      // Store current location before redirecting to auth
      const currentPath = window.location.pathname;
      if (currentPath !== '/auth/callback') {
        storeUserLocation(currentPath);
      }
      
      console.error('Error in signInWithGoogle:', error);
      throw error;
    }
          redirectTo: `${window.location.origin}/auth/callback`
  // Track user navigation for session restoration
  useEffect(() => {
    if (user && isInitialized) {
      const currentPath = window.location.pathname;
      if (currentPath !== '/auth/callback') {
        storeUserLocation(currentPath);
      }
    }
  }, [user, isInitialized]);

  const signOut = async () => {
    try {
      setLoading(true);
      const { error } = await supabase.auth.signOut();
      if (error) {
      clearStoredLocation();
        console.error('Error signing out:', error);
        setLoading(false);
        throw error;
      }
      setLoading(false);
    } catch (error) {
      console.error('Error in signOut:', error);
      throw error;
      setLoading(false);
    }
  };
  const restoreSession = async () => {
    try {
      setLoading(true);
      const { data: { session }, error } = await supabase.auth.getSession();
      
      if (error) {
        console.error('Error restoring session:', error);
        return;
      }
      
      if (session?.user) {
        setSession(session);
        setUser(session.user);
        await fetchUserProfile(session.user.id);
      }
    } catch (error) {
      console.error('Error in restoreSession:', error);
    } finally {
      setLoading(false);
    }
  };

  const value = {
    user,
    userProfile,
    session,
    loading,
    isInitialized,
    signInWithGoogle,
    signOut,
    restoreSession
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};