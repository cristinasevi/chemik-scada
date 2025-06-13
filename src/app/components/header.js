'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { Moon, Sun, User, LogOut, Bell } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { usePathname, useSearchParams } from 'next/navigation';
import Navbar from './navbar';

const Header = () => {
  const { user, logout, profile, getSinglePlant, canAccessMainDashboard } = useAuth();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isDark, setIsDark] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
    const htmlClasses = document.documentElement.className;
    setIsDark(htmlClasses.includes('dark'));
  }, []);

  const toggleTheme = useCallback(() => {
    const newTheme = !isDark;
    setIsDark(newTheme);

    const currentClasses = document.documentElement.className;
    const baseClasses = currentClasses.replace(/\b(light|dark)\b/g, '').trim();
    const themeClass = newTheme ? 'dark' : 'light';

    document.documentElement.className = `${baseClasses} ${themeClass}`.trim();
    localStorage.setItem('theme', themeClass);
  }, [isDark]);

  const handleLogout = useCallback(() => {
    setShowUserMenu(false);
    logout();
  }, [logout]);

  const handleUserMenuToggle = useCallback(() => {
    setShowUserMenu(prev => !prev);
  }, []);

  const handleUserMenuClose = useCallback(() => {
    setShowUserMenu(false);
  }, []);

  const currentContext = useMemo(() => {
    if (pathname.startsWith('/lamaja')) return 'LAMAJA';
    if (pathname.startsWith('/retamar')) return 'RETAMAR';

    const plantaParam = searchParams.get('planta');
    if (plantaParam === 'lamaja') return 'LAMAJA';
    if (plantaParam === 'retamar') return 'RETAMAR';

    return 'MAIN';
  }, [pathname, searchParams]);

  const pageTitle = useMemo(() => {
    if (pathname.startsWith('/lamaja')) {
      const lamajaRoutes = {
        '/lamaja': 'Dashboard',
        '/lamaja/heat-maps': 'Heat Maps',
        '/lamaja/pv-resumen': 'PV Resumen',
        '/lamaja/resumen-inversores': 'Resumen Inversores',
        '/lamaja/detalle-inversor': 'Detalle Inversor',
        '/lamaja/subestacion-cts': 'Subestación y CTs'
      };

      const sectionName = lamajaRoutes[pathname] || 'Dashboard';
      return `La Maja - ${sectionName}`;

    } else if (pathname.startsWith('/retamar')) {
      const retamarRoutes = {
        '/retamar': 'Dashboard',
        '/retamar/heat-maps': 'Heat Maps',
        '/retamar/pv-resumen': 'PV Resumen',
        '/retamar/resumen-inversores': 'Resumen Inversores',
        '/retamar/detalle-inversor': 'Detalle Inversor',
        '/retamar/resumen-trackers': 'Resumen Trackers',
        '/retamar/detalle-tracker': 'Detalle Tracker',
        '/retamar/facturacion': 'Facturación'
      };

      const sectionName = retamarRoutes[pathname] || 'Dashboard';
      return `Retamar - ${sectionName}`;

    } else {
      if (pathname === '/gestion-documentos') {
        if (currentContext === 'LAMAJA') return 'La Maja - Gestión de Documentos';
        if (currentContext === 'RETAMAR') return 'Retamar - Gestión de Documentos';
        return 'Gestión de Documentos';
      }

      if (pathname === '/exportacion-variables') {
        if (currentContext === 'LAMAJA') return 'La Maja - Exportación de Variables';
        if (currentContext === 'RETAMAR') return 'Retamar - Exportación de Variables';
        return 'Exportación de Variables';
      }

      if (pathname === '/usuarios') {
        return 'Gestión de Usuarios';
      }

      const singlePlant = getSinglePlant();
      if (pathname === '/') {
        return singlePlant ?
          `Dashboard ${singlePlant === 'LAMAJA' ? 'La Maja' : 'Retamar'}` :
          'Dashboard Principal';
      }

      return singlePlant ?
        `Dashboard ${singlePlant === 'LAMAJA' ? 'La Maja' : 'Retamar'}` :
        'Dashboard Principal';
    }
  }, [pathname, currentContext, getSinglePlant]);

  const titleColor = useMemo(() => {
    if (pathname.startsWith('/lamaja')) {
      return '';
    } else if (pathname.startsWith('/retamar')) {
      return '';
    }
    return 'text-primary';
  }, [pathname]);

  const restrictionInfo = useMemo(() => {
    return null;
  }, []);

  const userMenuItems = useMemo(() => [
    { label: "Perfil", icon: User, onClick: null },
    { label: "Notificaciones", icon: Bell, onClick: null },
    {
      label: isDark ? "Modo claro" : "Modo oscuro",
      icon: isDark ? Sun : Moon,
      onClick: toggleTheme
    }
  ], [isDark, toggleTheme]);

  if (!isClient || !user) return null;

  return (
    <header className="bg-header sticky top-0 z-50">
      <div className="grid grid-cols-3 items-center px-4 py-1">
        <div className="flex items-center space-x-4">
          <Navbar />
          <div className="flex items-center space-x-2">
            <div className="w-12 h-12 rounded-lg overflow-hidden flex items-center justify-center">
              <img
                src="/images/aresol.jpeg"
                alt="Chemik Scada Logo"
                className="w-full h-full object-contain"
              />
            </div>
          </div>
        </div>

        <div className="flex justify-center">
          <div className="text-center">
            <h1 className={`text-xl font-semibold ${titleColor} hidden sm:block transition-colors duration-200`}>
              {pageTitle}
            </h1>
            {restrictionInfo && (
              <p className="text-xs text-secondary hidden sm:block">
                {restrictionInfo}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center justify-end space-x-2">
          <div className="relative">
            <button
              onClick={handleUserMenuToggle}
              className="flex items-center space-x-2 p-2 rounded-md hover-bg transition-colors cursor-pointer"
            >
              <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-blue-300 rounded-full flex items-center justify-center">
                <User size={16} className="text-white" />
              </div>
              <div className="hidden sm:block text-left">
                <p className="text-sm font-medium text-primary">{user.name}</p>
                <div className="flex items-center gap-1">
                  <p className="text-xs text-secondary">
                    {user.role === 'admin' ? 'Administrador' : 'Cliente'}
                  </p>
                </div>
              </div>
            </button>

            {showUserMenu && (
              <div className="absolute right-0 mt-2 w-56 bg-panel rounded-lg shadow-lg border-custom z-50">
                <div className="p-4 border-b border-custom">
                  <p className="font-semibold text-primary">{user.name}</p>
                  <p className="text-sm text-muted">{user.username}</p>
                  <div className="flex items-center gap-1 mt-1">
                    <p className="text-xs text-secondary capitalize">
                      {user.role === 'admin' ? 'Administrador' : 'Cliente'}
                    </p>
                  </div>
                </div>

                <div className="p-2">
                  {userMenuItems.map((item) => (
                    <UserMenuItem
                      key={item.label}
                      label={item.label}
                      icon={item.icon}
                      onClick={item.onClick}
                    />
                  ))}

                  <div className="border-t border-custom my-2"></div>

                  <UserMenuItem
                    label="Cerrar sesión"
                    icon={LogOut}
                    onClick={handleLogout}
                    className="text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {showUserMenu && (
        <div
          className="fixed inset-0 z-40"
          onClick={handleUserMenuClose}
        />
      )}
    </header>
  );
};

const UserMenuItem = ({ label, icon: Icon, onClick, className = "" }) => {
  const handleClick = useCallback(() => {
    if (onClick) {
      onClick();
    }
  }, [onClick]);

  return (
    <button
      onClick={handleClick}
      className={`w-full text-left px-3 py-2 text-sm text-primary hover-menu rounded-md transition-colors flex items-center space-x-2 cursor-pointer ${className}`}
    >
      {Icon && <Icon size={16} className="text-secondary" />}
      <span>{label}</span>
    </button>
  );
};

export default Header;