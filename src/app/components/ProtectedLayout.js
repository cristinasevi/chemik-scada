'use client';

import { useAuth } from '../contexts/AuthContext';
import { usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';

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

  // Mostrar loading solo mientras verifica autenticación
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-secondary">Verificando autenticación...</p>
        </div>
      </div>
    );
  }

  // Sin usuario = el AuthContext se encarga de redirigir
  if (!user) return null;

  // Con usuario válido = mostrar contenido
  return children;
};

export default ProtectedLayout;