'use client';

import { useAuth } from '../contexts/AuthContext';
import { usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';
import RouteGuard from './RouteGuard';

const ProtectedLayout = ({ children }) => {
  const { user, loading } = useAuth();
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // No renderizar hasta estar montado
  if (!mounted) return null;

  // Rutas públicas se muestran siempre
  if (pathname === '/login') return children;

  // Mostrar loading SOLO durante verificación muy rápida
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  // Sin usuario = el AuthContext se encarga de redirigir
  if (!user) return null;

  // Con usuario válido = mostrar contenido con protección de rutas
  return (
    <RouteGuard>
      {children}
    </RouteGuard>
  );
};

export default ProtectedLayout;