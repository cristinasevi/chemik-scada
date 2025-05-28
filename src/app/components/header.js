'use client';

import { useState, useEffect } from 'react';
import { Moon, Sun, Search, Bell, User, BarChart3, Settings, LogOut } from 'lucide-react';
import Navbar from './navbar';

const Header = () => {
  const [isDark, setIsDark] = useState(false);
  const [searchValue, setSearchValue] = useState('');
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
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

//   // Datos de ejemplo para notificaciones
//   const notifications = [
//     { id: 1, title: 'Alert: High CPU Usage', time: '2 min ago', type: 'warning' },
//     { id: 2, title: 'Dashboard Updated', time: '5 min ago', type: 'info' },
//     { id: 3, title: 'Server Response Time', time: '10 min ago', type: 'error' },
//   ];

  return (
    <header className="bg-header sticky top-0 z-50 shadow-sm">
      <div className="grid grid-cols-3 items-center px-4 py-3">
        {/* Logo y navegación izquierda */}
        <div className="flex items-center space-x-4">
          {/* Componente Navbar */}
          <Navbar />

          {/* Logo */}
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-lg overflow-hidden flex items-center justify-center">
              <img 
                src="/images/aresol.jpeg" 
                alt="Chemik Scada Logo" 
                className="w-full h-full object-contain"
              />
            </div>
          </div>
        </div>

        {/* Título central - perfectamente centrado */}
        <div className="flex justify-center">
          <h1 className="text-2xl font-semibold text-primary hidden sm:block">
            Chemik Scada
          </h1>
        </div>

        {/* Acciones derecha */}
        <div className="flex items-center justify-end space-x-2">
          {/* Búsqueda móvil */}
          <button className="sm:hidden p-2 rounded-md hover-bg transition-colors">
            <Search size={18} />
          </button>

          {/* Notificaciones */}
          <div className="relative">
            <button
              onClick={() => setShowNotifications(!showNotifications)}
              className="p-2 rounded-md hover-bg transition-colors relative cursor-pointer"
            >
              <Bell size={18} />
              <span className="absolute -top-0 -right-0 w-3 h-3 bg-red-500 rounded-full flex items-center justify-center">
                <span className="text-xs text-white font-bold">3</span>
              </span>
            </button>

            {/* Dropdown notificaciones */}
            {showNotifications && (
              <div className="absolute right-0 mt-2 w-80 bg-panel rounded-lg shadow-lg border-custom z-50">
                <div className="p-4 border-b border-custom">
                  <h3 className="font-semibold text-primary">Notificaciones</h3>
                </div>
                <div className="max-h-96 overflow-y-auto">
                  {/* {notifications.map((notification) => (
                    <div key={notification.id} className="p-4 hover-bg border-b border-custom last:border-b-0">
                      <div className="flex items-start space-x-3">
                        <div className={`w-2 h-2 rounded-full mt-2 ${
                          notification.type === 'error' ? 'bg-red-500' :
                          notification.type === 'warning' ? 'bg-yellow-500' : 'bg-blue-500'
                        }`} />
                        <div className="flex-1">
                          <p className="text-sm font-medium text-primary">{notification.title}</p>
                          <p className="text-xs text-muted mt-1">{notification.time}</p>
                        </div>
                      </div>
                    </div>
                  ))} */}
                </div>
                <div className="p-4 border-t border-custom">
                  <button className="text-sm text-blue-500 hover:text-blue-600 cursor-pointer">
                    Ver todas las notificaciones
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Usuario */}
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

            {/* Dropdown usuario */}
            {showUserMenu && (
              <div className="absolute right-0 mt-2 w-48 bg-panel rounded-lg shadow-lg border-custom z-50">
                <div className="p-4 border-b border-custom">
                  <p className="font-semibold text-primary">Administrador</p>
                  <p className="text-sm text-muted">admin@chemik.com</p>
                </div>
                <div className="p-2">
                  <UserMenuItem label="Perfil" icon={User} />
                  <UserMenuItem label="Preferencias" icon={Settings} />
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
      {(showUserMenu || showNotifications) && (
        <div 
          className="fixed inset-0 z-40" 
          onClick={() => {
            setShowUserMenu(false);
            setShowNotifications(false);
          }}
        />
      )}
    </header>
  );
};

// Componente para items del menú de usuario
const UserMenuItem = ({ label, icon: Icon, onClick }) => (
  <button 
    onClick={onClick}
    className="w-full text-left px-3 py-2 text-sm text-primary hover-bg rounded-md transition-colors flex items-center space-x-2 cursor-pointer"
  >
    {Icon && <Icon size={16} className="text-secondary" />}
    <span>{label}</span>
  </button>
);

export default Header;