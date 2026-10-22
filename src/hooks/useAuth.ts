import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { User, Session } from '@supabase/supabase-js';
import { toast } from 'sonner';

export type AppRole = 'admin' | 'moderator' | 'user';

export interface Profile {
  id: string;
  user_id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  email: string | null;
  preferences: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchProfile = useCallback(async (userId: string) => {
    try {
      const { data: profileData } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', userId)
        .single();
      
      setProfile(profileData as Profile | null);
    } catch (error) {
      console.error('Error fetching profile:', error);
    }
  }, []);

  const fetchRole = useCallback(async (userId: string) => {
    try {
      const { data } = await supabase.rpc('get_user_role', { _user_id: userId });
      setRole(data as AppRole | null);
    } catch (error) {
      console.error('Error fetching role:', error);
    }
  }, []);

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, newSession) => {
        setSession(newSession);
        setUser(newSession?.user ?? null);
        
        if (newSession?.user) {
          // Use setTimeout to avoid Supabase deadlock
          setTimeout(() => {
            fetchProfile(newSession.user.id);
            fetchRole(newSession.user.id);
          }, 0);
        } else {
          setProfile(null);
          setRole(null);
        }
        
        setIsLoading(false);
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session: existingSession } }) => {
      setSession(existingSession);
      setUser(existingSession?.user ?? null);
      
      if (existingSession?.user) {
        fetchProfile(existingSession.user.id);
        fetchRole(existingSession.user.id);
      }
      
      setIsLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [fetchProfile, fetchRole]);

  const signIn = useCallback(async (email: string, password: string) => {
    setIsLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      toast.error(error.message);
      setIsLoading(false);
      return false;
    }
    toast.success('Signed in successfully');
    return true;
  }, []);

  const signUp = useCallback(async (email: string, password: string) => {
    setIsLoading(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: window.location.origin,
      },
    });
    if (error) {
      toast.error(error.message);
      setIsLoading(false);
      return false;
    }
    toast.success('Check your email for verification link');
    setIsLoading(false);
    return true;
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setProfile(null);
    setRole(null);
    toast.success('Signed out successfully');
  }, []);

  const isAdmin = role === 'admin';
  const isModerator = role === 'moderator' || role === 'admin';

  return {
    user,
    session,
    profile,
    role,
    isLoading,
    isAdmin,
    isModerator,
    signIn,
    signUp,
    signOut,
  };
}
