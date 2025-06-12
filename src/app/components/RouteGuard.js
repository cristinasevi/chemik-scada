'use client';

import { useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useRouter, usePathname } from 'next/navigation';

const RouteGuard = ({ children }) => {
  const { user, profile, loading, canAccessRoute, getAllowedRoute } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    // No hacer nada durante la carga
    if (loading || !user || !profile) return;

    // Verificar acceso a la ruta actual y redirigir silenciosamente si es necesario
    if (!canAccessRoute(pathname)) {
      const allowedRoute = getAllowedRoute();
      router.replace(allowedRoute);
    }
  }, [user, profile, loading, pathname, canAccessRoute, getAllowedRoute, router]);

  // Mostrar loading mientras se verifica
  if (loading || !user || !profile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-secondary">Verificando permisos...</p>
        </div>
      </div>
    );
  }

  // Si no puede acceder, mostrar loading mientras redirige (esto debería ser muy breve)
  if (!canAccessRoute(pathname)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-secondary">Redirigiendo...</p>
        </div>
      </div>
    );
  }

  return children;
};

export default RouteGuard;