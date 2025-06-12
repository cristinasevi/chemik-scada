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
  const [mounted, setMounted] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  // Obtener sesión de manera síncrona desde localStorage si está disponible
  const getCachedSession = () => {
    if (typeof window === 'undefined') return null;
    try {
      const cached = localStorage.getItem('supabase.auth.token');
      return cached ? JSON.parse(cached) : null;
    } catch {
      return null;
    }
  };

  // Función para obtener la ruta permitida basada en las plantas del usuario
  const getAllowedRoute = (userProfile) => {
    if (!userProfile) return '/';
    
    // Si es admin, puede acceder a todo
    if (userProfile.rol === 'admin') {
      return '/';
    }

    // Si es cliente, verificar plantas asignadas
    const plantasAsignadas = userProfile.plantas_asignadas || [];
    
    // Si tiene todas las plantas o más de una, puede ir al dashboard principal
    if (plantasAsignadas.includes('TOTAL') || 
        plantasAsignadas.length > 1 ||
        (plantasAsignadas.includes('LAMAJA') && plantasAsignadas.includes('RETAMAR'))) {
      return '/';
    }
    
    // Si solo tiene una planta específica, redirigir a esa planta
    if (plantasAsignadas.length === 1) {
      const planta = plantasAsignadas[0];
      if (planta === 'LAMAJA') {
        return '/lamaja';
      } else if (planta === 'RETAMAR') {
        return '/retamar';
      }
    }
    
    // Por defecto, dashboard principal
    return '/';
  };

  // Función para verificar si el usuario puede acceder a una ruta específica
  const canAccessRoute = (userProfile, currentPath) => {
    if (!userProfile) return false;
    
    // Si es admin, puede acceder a todo
    if (userProfile.rol === 'admin') {
      return true;
    }

    // Rutas públicas siempre permitidas
    if (currentPath === '/login') {
      return true;
    }

    const plantasAsignadas = userProfile.plantas_asignadas || [];
    
    // Si tiene todas las plantas, puede acceder a todo
    if (plantasAsignadas.includes('TOTAL') || 
        (plantasAsignadas.includes('LAMAJA') && plantasAsignadas.includes('RETAMAR'))) {
      return true;
    }

    // Verificar acceso específico por planta
    if (currentPath.startsWith('/lamaja')) {
      return plantasAsignadas.includes('LAMAJA');
    }
    
    if (currentPath.startsWith('/retamar')) {
      return plantasAsignadas.includes('RETAMAR');
    }

    // Para la página principal, verificar si tiene más de una planta
    if (currentPath === '/') {
      return plantasAsignadas.length > 1 || 
             plantasAsignadas.includes('TOTAL') ||
             (plantasAsignadas.includes('LAMAJA') && plantasAsignadas.includes('RETAMAR'));
    }

    // Rutas generales permitidas si tiene al menos una planta
    if (currentPath.startsWith('/gestion-documentos') || 
        currentPath.startsWith('/exportacion-variables')) {
      return plantasAsignadas.length > 0;
    }

    // Por defecto, denegar acceso
    return false;
  };

  // Obtener sesión actual y perfil - OPTIMIZADO para velocidad
  const getSession = async () => {
    try {
      // Primero intentar obtener la sesión del cache local de Supabase
      const { data: { session }, error } = await supabase.auth.getSession();
      
      if (error) {
        console.error('Error obteniendo sesión:', error);
        setLoading(false);
        return;
      }

      if (session?.user) {
        setUser(session.user);
        
        // Optimización: Obtener perfil en paralelo, no secuencial
        const { data: profileData, error: profileError } = await userService.getCurrentUserProfile();
        
        if (profileError) {
          console.error('Error obteniendo perfil:', profileError);
          setProfile(null);
        } else {
          setProfile(profileData);
        }
      } else {
        setUser(null);
        setProfile(null);
      }
    } catch (error) {
      console.error('Error en getSession:', error);
      setUser(null);
      setProfile(null);
    } finally {
      setLoading(false);
    }
  };

  // Inicialización optimizada
  useEffect(() => {
    setMounted(true);
    
    // Ejecutar getSession inmediatamente sin delay
    getSession();
  }, []);

  // Listener para cambios de autenticación - SIMPLIFICADO
  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('Auth state changed:', event, !!session?.user);
      
      if (event === 'SIGNED_IN' && session?.user) {
        setUser(session.user);
        
        // Obtener perfil de manera optimizada
        try {
          const { data: profileData } = await userService.getCurrentUserProfile();
          setProfile(profileData);
        } catch (error) {
          console.error('Error obteniendo perfil en auth change:', error);
          setProfile(null);
        }
        
      } else if (event === 'SIGNED_OUT') {
        setUser(null);
        setProfile(null);
      }
      
      // Siempre completar loading rápidamente
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Manejar redirecciones automáticas - OPTIMIZADO para velocidad
  useEffect(() => {
    // Solo ejecutar cuando esté montado y tengamos datos definidos
    if (!mounted || loading) return;

    const isPublicRoute = pathname === '/login';
    const isAdminRoute = pathname.startsWith('/usuarios');

    // Caso 1: Usuario no autenticado
    if (!user && !isPublicRoute) {
      sessionStorage.setItem('returnUrl', pathname);
      router.push('/login');
      return;
    }

    // Caso 2: Usuario autenticado
    if (user && profile) {
      // Desde login, redirigir inmediatamente
      if (pathname === '/login') {
        sessionStorage.removeItem('returnUrl');
        const allowedRoute = getAllowedRoute(profile);
        router.replace(allowedRoute);
        return;
      }

      // Verificar admin
      if (isAdminRoute && profile.rol !== 'admin') {
        const allowedRoute = getAllowedRoute(profile);
        router.replace(allowedRoute);
        return;
      }

      // REDIRECCIÓN INMEDIATA para rutas no permitidas
      if (!canAccessRoute(profile, pathname)) {
        const allowedRoute = getAllowedRoute(profile);
        router.replace(allowedRoute);
        return;
      }
    }

    // Caso 3: Usuario autenticado pero sin perfil aún
    if (user && !profile && !isPublicRoute) {
      // Esperar a que se cargue el perfil, pero no mostrar loading por mucho tiempo
      const timeout = setTimeout(() => {
        console.warn('Perfil tardando en cargar, redirigiendo a login');
        router.push('/login');
      }, 2000);

      return () => clearTimeout(timeout);
    }

  }, [mounted, loading, user, profile, pathname, router]);

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
      loading, // Loading simplificado
      isAuthenticated: !!user,
      isAdmin: profile?.rol === 'admin',
      // Funciones de utilidad
      hasPermission: (permission) => profile?.permissions?.includes(permission) || false,
      hasPlant: (plant) => profile?.plantas_asignadas?.includes(plant) || false,
      canAccessRoute: (path) => canAccessRoute(profile, path),
      getAllowedRoute: () => getAllowedRoute(profile),
      // Función para verificar si puede acceder al dashboard principal
      canAccessMainDashboard: () => {
        if (!profile) return false;
        if (profile.rol === 'admin') return true;
        const plantas = profile.plantas_asignadas || [];
        return plantas.includes('TOTAL') || 
               plantas.length > 1 || 
               (plantas.includes('LAMAJA') && plantas.includes('RETAMAR'));
      },
      // Función para obtener la planta única si solo tiene una
      getSinglePlant: () => {
        if (!profile || profile.rol === 'admin') return null;
        const plantas = profile.plantas_asignadas || [];
        if (plantas.length === 1 && !plantas.includes('TOTAL')) {
          return plantas[0];
        }
        return null;
      }
    }}>
      {children}
    </AuthContext.Provider>
  );
};