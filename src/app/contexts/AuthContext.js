'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { supabase, userService } from '../lib/supabase';

const AuthContext = createContext({});

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth debe ser usado dentro de un AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const pathname = usePathname();

  // Obtener sesión actual y perfil
  const getSession = async () => {
    try {
      const { data: { session }, error } = await supabase.auth.getSession();
      
      if (error) {
        console.error('Error obteniendo sesión:', error);
        return;
      }

      if (session?.user) {
        setUser(session.user);
        
        // Obtener perfil del usuario
        const { data: profileData, error: profileError } = await userService.getCurrentUserProfile();
        
        if (profileError) {
          console.error('Error obteniendo perfil:', profileError);
        } else {
          setProfile(profileData);
        }
      }
    } catch (error) {
      console.error('Error en getSession:', error);
    } finally {
      setLoading(false);
    }
  };

  // Listener para cambios de autenticación
  useEffect(() => {
    getSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        setUser(session.user);
        
        // Obtener perfil
        const { data: profileData } = await userService.getCurrentUserProfile();
        setProfile(profileData);
        
      } else if (event === 'SIGNED_OUT') {
        setUser(null);
        setProfile(null);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Manejar redirecciones automáticas
  useEffect(() => {
    if (loading || typeof window === 'undefined') return;

    const isPublicRoute = pathname === '/login';
    const isAdminRoute = pathname.startsWith('/usuarios');

    // Redirigir no autenticados a login
    if (!user && !isPublicRoute) {
      window.location.href = '/login';
      return;
    }

    // Redirigir autenticados fuera del login
    if (user && pathname === '/login') {
      window.location.replace('/');
      return;
    }

    // Redirigir no-admins fuera de rutas de admin
    if (user && isAdminRoute && profile?.rol !== 'admin') {
      window.location.replace('/');
      return;
    }
  }, [user, profile, loading, pathname]);

  const login = async (email, password) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true, data };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  const logout = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        console.error('Error en logout:', error);
      }
      
      setUser(null);
      setProfile(null);
      window.location.href = '/login';
    } catch (error) {
      console.error('Error en logout:', error);
      window.location.href = '/login';
    }
  };

  // Función para obtener datos completos del usuario (backward compatibility)
  const getUserData = () => {
    if (!user || !profile) return null;
    
    return {
      id: user.id,
      email: user.email,
      name: profile.nombre,
      username: profile.nombre_usuario,
      role: profile.rol,
      notifyAlarms: profile.notify_alarms,
      assignedPlants: profile.plantas_asignadas || [],
      permissions: profile.permissions || [],
      loginTime: user.last_sign_in_at,
    };
  };

  return (
    <AuthContext.Provider value={{
      user: getUserData(), // Para mantener compatibilidad
      rawUser: user, // Usuario de Supabase Auth
      profile, // Perfil de la tabla profiles
      login,
      logout,
      loading,
      isAuthenticated: !!user,
      isAdmin: profile?.rol === 'admin',
      // Funciones de utilidad
      hasPermission: (permission) => profile?.permissions?.includes(permission) || false,
      hasPlant: (plant) => profile?.plantas_asignadas?.includes(plant) || false,
    }}>
      {children}
    </AuthContext.Provider>
  );
};