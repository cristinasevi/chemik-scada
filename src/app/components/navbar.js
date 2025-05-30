'use client';

import { useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Menu, Home, Database, Settings, Users, Activity, AlertTriangle, Cloud, Zap, Gauge, Download, FileText } from 'lucide-react';

const Navbar = () => {
  const [showMainMenu, setShowMainMenu] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  // Lista principal de navegación
  const mainItems = [
    { icon: Home, label: "Inicio", path: "/" },
    { icon: Activity, label: "Datos activos", path: "/datos-activos" },
    { icon: Database, label: "Datos acumulados", path: "/datos-acumulados" },
    { icon: Cloud, label: "Estaciones meteorológicas", path: "/estaciones-meteorologicas" },
    { icon: Zap, label: "Inversores", path: "/inversores" },
    { icon: Gauge, label: "Vatímetros", path: "/vatimetros" },
    { icon: Download, label: "Exportación", path: "/exportacion" },
    { icon: AlertTriangle, label: "Alarmas", path: "/alarmas" },
    { icon: FileText, label: "Informes comerciales", path: "/informes-comerciales" },
    { icon: FileText, label: "Informes dispositivos", path: "/informes-dispositivos" }
  ];

  // Items del footer
  const footerItems = [
    { icon: Settings, label: "Configuración", path: "/config" },
    { icon: Users, label: "Usuarios", path: "/usuarios" }
  ];

  const handleItemClick = (item) => {
    router.push(item.path);
    setShowMainMenu(false);
  };

  const isActive = (path) => {
    return pathname === path;
  };

  return (
    <div className="relative">
      <button
        onClick={() => setShowMainMenu(!showMainMenu)}
        className="p-2 rounded-md hover-bg transition-colors cursor-pointer"
      >
        <Menu size={20} />
      </button>

      {showMainMenu && (
        <>
          <div className="absolute left-0 mt-2 w-64 bg-panel rounded-lg shadow-xl border-custom z-50">
            <div className="p-2 space-y-1">
              {mainItems.map((item) => (
                <NavbarItem
                  key={item.label}
                  icon={item.icon}
                  label={item.label}
                  active={isActive(item.path)}
                  onClick={() => handleItemClick(item)}
                />
              ))}
            </div>

            <div className="border-t border-custom"></div>

            <div className="p-2 space-y-1">
              {footerItems.map((item) => (
                <NavbarItem
                  key={item.label}
                  icon={item.icon}
                  label={item.label}
                  active={isActive(item.path)}
                  onClick={() => handleItemClick(item)}
                />
              ))}
            </div>
          </div>

          {/* Overlay para cerrar el menú */}
          <div 
            className="fixed inset-0 z-40" 
            onClick={() => setShowMainMenu(false)}
          />
        </>
      )}
    </div>
  );
};

// Componente para items individuales del navbar
const NavbarItem = ({ icon: Icon, label, active = false, onClick, badge = null }) => (
  <button
    onClick={onClick}
    className={`w-full flex items-center justify-between px-3 py-2.5 text-sm font-medium rounded-md transition-all duration-200 group cursor-pointer ${
      active 
        ? 'bg-blue-500 text-white shadow-md' 
        : 'text-primary hover-menu'
    }`}
  >
    <div className="flex items-center space-x-3">
      <Icon 
        size={16} 
        className={`${active ? 'text-white' : 'text-secondary group-hover:text-primary'} transition-colors`} 
      />
      <span className="truncate">{label}</span>
    </div>
    {badge && (
      <span className="bg-red-500 text-white text-xs rounded-full px-1.5 py-0.5 min-w-[18px] h-[18px] flex items-center justify-center">
        {badge}
      </span>
    )}
  </button>
);

export default Navbar;