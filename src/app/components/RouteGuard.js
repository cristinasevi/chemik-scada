'use client';

import { useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useRouter, usePathname } from 'next/navigation';

const RouteGuard = ({ children }) => {
  const { user, profile, loading, canAccessRoute, getAllowedRoute } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    // Solo verificar cuando tengamos todos los datos
    if (loading || !user || !profile) return;

    // Verificar acceso y redirigir inmediatamente si es necesario
    if (!canAccessRoute(pathname)) {
      const allowedRoute = getAllowedRoute();
      router.replace(allowedRoute);
    }
  }, [user, profile, loading, pathname, canAccessRoute, getAllowedRoute, router]);

  // Mostrar loading mínimo solo si realmente está cargando
  if (loading || !user || !profile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  // Si no puede acceder, no mostrar nada - la redirección será inmediata
  if (!canAccessRoute(pathname)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return children;
};

export default RouteGuard;