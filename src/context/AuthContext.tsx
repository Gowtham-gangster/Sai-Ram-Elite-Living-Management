'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';

export interface AdminUserSession {
  id: string;
  name: string;
  email: string;
  role: string;
  isActive: boolean;
}

export interface AdminProfileCompat {
  id: string;
  full_name: string;
  email: string;
  role: string;
  is_active: boolean;
}

interface AuthContextType {
  user: AdminUserSession | null;
  profile: AdminProfileCompat | null;
  role: string;
  isLoading: boolean;
  isAuthenticated: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AdminUserSession | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const router = useRouter();

  const fetchSession = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/me');
      if (res.ok) {
        const data = await res.json();
        if (data.user) {
          setUser(data.user);
          return;
        }
      }
      setUser(null);
    } catch {
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSession();
  }, [fetchSession]);

  const signOut = async () => {
    try {
      setIsLoading(true);
      await fetch('/api/auth/logout', { method: 'POST' });
      setUser(null);
      router.push('/login');
      router.refresh();
    } catch (err) {
      console.error('Error during logout:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const profileCompat: AdminProfileCompat | null = user
    ? {
        id: user.id,
        full_name: user.name,
        email: user.email,
        role: user.role,
        is_active: user.isActive,
      }
    : null;

  return (
    <AuthContext.Provider
      value={{
        user,
        profile: profileCompat,
        role: user?.role || 'SUPER_ADMIN',
        isLoading,
        isAuthenticated: !!user,
        signOut,
        refreshProfile: fetchSession,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
