'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';

const AuthContext = createContext({});

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth debe ser usado dentro de un AuthProvider');
  }
  return context;
};

// Usuarios válidos
const validUsers = [
  { username: 'admin@chemik.com', password: 'ChemikAdmin2025!', name: 'Administrador', role: 'admin' },
  { username: 'juan.garcia@chemik.com', password: 'JuanGarcia#2025', name: 'Juan García', role: 'admin' },
  { username: 'maria.lopez@chemik.com', password: 'MariaL0pez$2025', name: 'María López', role: 'cliente' },
  { username: 'carlos.ruiz@chemik.com', password: 'CarlosR&2025!', name: 'Carlos Ruiz', role: 'cliente' },
  { username: 'test@chemik.com', password: 'TestUser123!', name: 'Usuario de Prueba', role: 'cliente' }
];

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const pathname = usePathname();

  // Verificar usuario guardado al cargar
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    try {
      const savedUser = localStorage.getItem('user');
      if (savedUser?.trim()) {
        const userData = JSON.parse(savedUser);
        if (userData?.username && userData?.name && userData?.role) {
          setUser(userData);
        } else {
          localStorage.removeItem('user');
        }
      }
    } catch (error) {
      localStorage.removeItem('user');
    } finally {
      setLoading(false);
    }
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

    // Redirigir no-admins fuera de rutas de admin (silenciosamente)
    if (user && isAdminRoute && user.role !== 'admin') {
      window.location.replace('/');
      return;
    }
  }, [user, loading, pathname]);

  const login = (userData) => {
    try {
      setUser(userData);
      localStorage.setItem('user', JSON.stringify(userData));
      window.location.href = '/';
    } catch (error) {
      console.error('Error en login:', error);
    }
  };

  const logout = () => {
    try {
      setUser(null);
      localStorage.removeItem('user');
      window.location.href = '/login';
    } catch (error) {
      window.location.href = '/login';
    }
  };

  const validateCredentials = (username, password) => {
    return validUsers.find(u => u.username === username && u.password === password);
  };

  return (
    <AuthContext.Provider value={{
      user,
      login,
      logout,
      loading,
      isAuthenticated: !!user,
      validateCredentials,
      isAdmin: user?.role === 'admin'
    }}>
      {children}
    </AuthContext.Provider>
  );
};