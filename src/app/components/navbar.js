'use client';

import { useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '../contexts/AuthContext';
import { Menu, Home, Users, Activity, Download, FileText, AlertTriangle, ArrowLeft, Zap, BarChart3, Wrench, Map, PieChart, Calculator } from 'lucide-react';

const Navbar = () => {
  const [showMainMenu, setShowMainMenu] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const { isAdmin } = useAuth();

  // Determinar si estamos en una subsección
  const isInLamaja = pathname.startsWith('/lamaja');
  const isInRetamar = pathname.startsWith('/retamar');

  // Lista principal de navegación (menú raíz)
  const mainItems = [
    { icon: Home, label: "Inicio", path: "/" },
    { icon: Activity, label: "La Maja", path: "/lamaja" },
    { icon: Activity, label: "Retamar", path: "/retamar" },
    { icon: FileText, label: "Gestión de Documentos", path: "/gestion-documentos" },
    { icon: Download, label: "Exportación de variables", path: "/exportacion-variables" },
  ];

  // Submenú para La Maja
  const lamajaItems = [
    { icon: ArrowLeft, label: "Volver al menú principal", path: "/" },
    { icon: BarChart3, label: "Dashboard La Maja", path: "/lamaja" },
    { icon: Map, label: "Heat Maps", path: "/lamaja/heat-maps" },
    { icon: PieChart, label: "PV Resumen", path: "/lamaja/pv-resumen" },
    { icon: Zap, label: "Resumen Inversores", path: "/lamaja/resumen-inversores" },
    { icon: Wrench, label: "Detalle Inversor", path: "/lamaja/detalle-inversor" },
    { icon: Activity, label: "Subestación y CTs", path: "/lamaja/subestacion-cts" },
  ];

  // Submenú para Retamar
  const retamarItems = [
    { icon: ArrowLeft, label: "Volver al menú principal", path: "/" },
    { icon: BarChart3, label: "Dashboard Retamar", path: "/retamar" },
    { icon: Map, label: "Heat Maps", path: "/retamar/heat-maps" },
    { icon: PieChart, label: "PV Resumen", path: "/retamar/pv-resumen" },
    { icon: Zap, label: "Resumen Inversores", path: "/retamar/resumen-inversores" },
    { icon: Wrench, label: "Detalle Inversor", path: "/retamar/detalle-inversor" },
    { icon: Activity, label: "Resumen Trackers", path: "/retamar/resumen-trackers" },
    { icon: Wrench, label: "Detalle Tracker", path: "/retamar/detalle-tracker" },
    { icon: FileText, label: "Facturación", path: "/retamar/facturacion" },
  ];

  // Items del footer - solo incluir usuarios si es admin
  const footerItems = [
    ...(isAdmin ? [{ icon: Users, label: "Usuarios", path: "/usuarios" }] : [])
  ];

  // Determinar qué items mostrar según la ubicación
  const getMenuItems = () => {
    if (isInLamaja) return lamajaItems;
    if (isInRetamar) return retamarItems;
    return mainItems;
  };

  // Determinar el título del menú
  const getMenuTitle = () => {
    if (isInLamaja) return "La Maja";
    if (isInRetamar) return "Retamar";
    return "Menú Principal";
  };

  const handleItemClick = (item) => {
    router.push(item.path);
    setShowMainMenu(false);
  };

  const isActive = (path) => pathname === path;

  const currentMenuItems = getMenuItems();

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
            {/* Título del menú */}
            <div className="px-4 py-3 border-b border-custom">
              <h3 className="text-sm font-semibold text-primary">{getMenuTitle()}</h3>
            </div>

            <div className="p-2 space-y-1">
              {currentMenuItems.map((item) => (
                <NavbarItem
                  key={item.label}
                  icon={item.icon}
                  label={item.label}
                  active={isActive(item.path)}
                  onClick={() => handleItemClick(item)}
                  isBackButton={item.label.includes('←')}
                />
              ))}
            </div>

            {footerItems.length > 0 && (
              <>
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
              </>
            )}
          </div>

          <div 
            className="fixed inset-0 z-40" 
            onClick={() => setShowMainMenu(false)}
          />
        </>
      )}
    </div>
  );
};

const NavbarItem = ({ icon: Icon, label, active = false, onClick, badge = null, isBackButton = false }) => (
  <button
    onClick={onClick}
    className={`w-full flex items-center justify-between px-3 py-2.5 text-sm font-medium rounded-md transition-all duration-200 group cursor-pointer ${
      active 
        ? 'bg-blue-500 text-white shadow-md' 
        : isBackButton
        ? 'text-secondary hover:text-primary hover:bg-gray-100 dark:hover:bg-gray-800'
        : 'text-primary hover-menu'
    }`}
  >
    <div className="flex items-center space-x-3">
      <Icon 
        size={16} 
        className={`${active ? 'text-white' : isBackButton ? 'text-secondary' : 'text-secondary group-hover:text-primary'} transition-colors`} 
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