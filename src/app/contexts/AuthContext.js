'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
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
  const [initialLoad, setInitialLoad] = useState(true); // Nueva bandera
  const router = useRouter();
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
      setInitialLoad(false); // Marcar que ya terminó la carga inicial
    }
  };

  // Listener para cambios de autenticación
  useEffect(() => {
    getSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('Auth state changed:', event, !!session?.user);
      
      if (event === 'SIGNED_IN' && session?.user) {
        setUser(session.user);
        
        // Obtener perfil
        const { data: profileData } = await userService.getCurrentUserProfile();
        setProfile(profileData);
        
      } else if (event === 'SIGNED_OUT') {
        setUser(null);
        setProfile(null);
      }
      
      // Solo cambiar loading si no es la carga inicial
      if (!initialLoad) {
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, [initialLoad]);

  // Manejar redirecciones automáticas
  useEffect(() => {
    // No hacer nada durante la carga inicial
    if (loading || initialLoad || typeof window === 'undefined') return;

    const isPublicRoute = pathname === '/login';
    const isAdminRoute = pathname.startsWith('/usuarios');

    // Redirigir no autenticados a login (preservando la URL actual)
    if (!user && !isPublicRoute) {
      // Guardar la URL actual para volver después del login
      sessionStorage.setItem('returnUrl', pathname);
      router.push('/login');
      return;
    }

    // Redirigir autenticados fuera del login
    if (user && pathname === '/login') {
      // Verificar si hay una URL de retorno guardada
      const returnUrl = sessionStorage.getItem('returnUrl');
      sessionStorage.removeItem('returnUrl');
      
      // Ir a la URL guardada o al dashboard
      router.replace(returnUrl || '/');
      return;
    }

    // Redirigir no-admins fuera de rutas de admin
    if (user && isAdminRoute && profile?.rol !== 'admin') {
      router.replace('/');
      return;
    }
  }, [user, profile, loading, initialLoad, pathname, router]);

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
      
      // Limpiar cualquier URL de retorno guardada
      sessionStorage.removeItem('returnUrl');
      
      router.push('/login');
    } catch (error) {
      console.error('Error en logout:', error);
      router.push('/login');
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
      loading: loading || initialLoad, // Mostrar loading durante carga inicial
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