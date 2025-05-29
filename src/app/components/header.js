'use client';

import { useState, useEffect } from 'react';
import { Moon, Sun, Search, Bell, User, LogOut } from 'lucide-react';
import Navbar from './navbar';

const Header = () => {
  const [isDark, setIsDark] = useState(false);
  const [searchValue, setSearchValue] = useState('');
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showMainMenu, setShowMainMenu] = useState(false);

  // Detectar preferencia del sistema al cargar
  useEffect(() => {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const savedTheme = localStorage.getItem('theme');
    
    if (savedTheme) {
      setIsDark(savedTheme === 'dark');
      document.documentElement.className = savedTheme;
    } else {
      setIsDark(prefersDark);
      document.documentElement.className = prefersDark ? 'dark' : 'light';
    }
  }, []);

  // Cambiar tema
  const toggleTheme = () => {
    const newTheme = !isDark;
    setIsDark(newTheme);
    const themeClass = newTheme ? 'dark' : 'light';
    document.documentElement.className = themeClass;
    localStorage.setItem('theme', themeClass);
  };

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
          <h1 className="text-2xl font-semibold text-primary hidden sm:block">
            Chemik Scada
          </h1>
        </div>

        <div className="flex items-center justify-end space-x-2">
          <div className="relative">
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="flex items-center space-x-2 p-2 rounded-md hover-bg transition-colors cursor-pointer"
            >
              <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-blue-300 rounded-full flex items-center justify-center">
                <User size={16} className="text-white" />
              </div>
              <span className="hidden sm:block text-sm font-medium text-primary">Admin</span>
            </button>

            {showUserMenu && (
              <div className="absolute right-0 mt-2 w-48 bg-panel rounded-lg shadow-lg border-custom z-50">
                <div className="p-4 border-b border-custom">
                  <p className="font-semibold text-primary">Administrador</p>
                  <p className="text-sm text-muted">admin@chemik.com</p>
                </div>
                <div className="p-2">
                  <UserMenuItem label="Perfil" icon={User} />
                  <UserMenuItem label="Notificaciones" icon={Bell} />
                  <UserMenuItem 
                    label={isDark ? "Modo claro" : "Modo oscuro"}
                    icon={isDark ? Sun : Moon}
                    onClick={toggleTheme}
                  />
                  <div className="border-t border-custom my-2"></div>
                  <UserMenuItem label="Cerrar sesión" icon={LogOut} />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Overlay para cerrar dropdowns */}
      {showUserMenu && (
        <div 
          className="fixed inset-0 z-40" 
          onClick={() => setShowUserMenu(false)}
        />
      )}
    </header>
  );
};

// Componente para items del menú de usuario
const UserMenuItem = ({ label, icon: Icon, onClick }) => (
  <button 
    onClick={onClick}
    className="w-full text-left px-3 py-2 text-sm text-primary hover-menu rounded-md transition-colors flex items-center space-x-2 cursor-pointer"
  >
    {Icon && <Icon size={16} className="text-secondary" />}
    <span>{label}</span>
  </button>
);

export default Header;