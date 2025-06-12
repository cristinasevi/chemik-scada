'use client';

import { useState } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { useAuth } from '../contexts/AuthContext';
import { Menu, Home, Users, Activity, Download, FileText, AlertTriangle, ArrowLeft, Zap, BarChart3, Wrench, Map, PieChart, Calculator } from 'lucide-react';

const Navbar = () => {
  const [showMainMenu, setShowMainMenu] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { isAdmin, profile, canAccessMainDashboard, getSinglePlant } = useAuth();

  // Determinar si estamos en una subsección o en contexto de planta
  const plantaParam = searchParams.get('planta');
  const isInLamaja = pathname.startsWith('/lamaja') || plantaParam === 'lamaja';
  const isInRetamar = pathname.startsWith('/retamar') || plantaParam === 'retamar';

  // Función para obtener plantas disponibles para el usuario
  const getAvailablePlants = () => {
    if (!profile) return [];
    
    if (profile.rol === 'admin') {
      return [
        { id: 'LAMAJA', label: 'La Maja', path: '/lamaja' },
        { id: 'RETAMAR', label: 'Retamar', path: '/retamar' }
      ];
    }

    const plantasAsignadas = profile.plantas_asignadas || [];
    const availablePlants = [];

    if (plantasAsignadas.includes('TOTAL') || plantasAsignadas.includes('LAMAJA')) {
      availablePlants.push({ id: 'LAMAJA', label: 'La Maja', path: '/lamaja' });
    }

    if (plantasAsignadas.includes('TOTAL') || plantasAsignadas.includes('RETAMAR')) {
      availablePlants.push({ id: 'RETAMAR', label: 'Retamar', path: '/retamar' });
    }

    return availablePlants;
  };

  // Lista principal de navegación (menú raíz)
  const getMainItems = () => {
    const items = [];
    
    // Solo agregar "Inicio" si el usuario puede acceder al dashboard principal
    if (canAccessMainDashboard()) {
      items.push({ icon: Home, label: "Inicio", path: "/" });
    }

    // Agregar plantas disponibles
    const availablePlants = getAvailablePlants();
    availablePlants.forEach(plant => {
      items.push({ 
        icon: Activity, 
        label: plant.label, 
        path: plant.path 
      });
    });

    return items;
  };

  // Submenú para La Maja
  const getLamajaItems = () => {
    const items = [];
    
    // Solo agregar "Volver al menú principal" si puede acceder al dashboard principal
    if (canAccessMainDashboard()) {
      items.push({ icon: ArrowLeft, label: "Volver al menú principal", path: "/" });
    } else {
      // Si no puede acceder al dashboard principal, mostrar plantas disponibles
      const availablePlants = getAvailablePlants().filter(p => p.id !== 'LAMAJA');
      availablePlants.forEach(plant => {
        items.push({ icon: Activity, label: `Ir a ${plant.label}`, path: plant.path });
      });
    }

    items.push(
      { icon: BarChart3, label: "Dashboard La Maja", path: "/lamaja" },
      { icon: Map, label: "Heat Maps", path: "/lamaja/heat-maps" },
      { icon: PieChart, label: "PV Resumen", path: "/lamaja/pv-resumen" },
      { icon: Zap, label: "Resumen Inversores", path: "/lamaja/resumen-inversores" },
      { icon: Wrench, label: "Detalle Inversor", path: "/lamaja/detalle-inversor" },
      { icon: Activity, label: "Subestación y CTs", path: "/lamaja/subestacion-cts" }
    );

    return items;
  };

  // Submenú para Retamar
  const getRetamarItems = () => {
    const items = [];
    
    // Solo agregar "Volver al menú principal" si puede acceder al dashboard principal
    if (canAccessMainDashboard()) {
      items.push({ icon: ArrowLeft, label: "Volver al menú principal", path: "/" });
    } else {
      // Si no puede acceder al dashboard principal, mostrar plantas disponibles
      const availablePlants = getAvailablePlants().filter(p => p.id !== 'RETAMAR');
      availablePlants.forEach(plant => {
        items.push({ icon: Activity, label: `Ir a ${plant.label}`, path: plant.path });
      });
    }

    items.push(
      { icon: BarChart3, label: "Dashboard Retamar", path: "/retamar" },
      { icon: Map, label: "Heat Maps", path: "/retamar/heat-maps" },
      { icon: PieChart, label: "PV Resumen", path: "/retamar/pv-resumen" },
      { icon: Zap, label: "Resumen Inversores", path: "/retamar/resumen-inversores" },
      { icon: Wrench, label: "Detalle Inversor", path: "/retamar/detalle-inversor" },
      { icon: Activity, label: "Resumen Trackers", path: "/retamar/resumen-trackers" },
      { icon: Wrench, label: "Detalle Tracker", path: "/retamar/detalle-tracker" },
      { icon: FileText, label: "Facturación", path: "/retamar/facturacion" }
    );

    return items;
  };

  // Items del footer - incluir contexto de planta en exportación
  const getFooterItems = () => {
    const exportPath = isInLamaja ? "/exportacion-variables?planta=lamaja" : 
                     isInRetamar ? "/exportacion-variables?planta=retamar" : 
                     "/exportacion-variables";

    const items = [
      { icon: FileText, label: "Gestión de Documentos", path: "/gestion-documentos" },
      { icon: Download, label: "Exportación de variables", path: exportPath }
    ];

    // Solo agregar gestión de usuarios si es admin
    if (isAdmin) {
      items.push({ icon: Users, label: "Usuarios", path: "/usuarios" });
    }

    return items;
  };

  // Determinar qué items mostrar según la ubicación
  const getMenuItems = () => {
    if (isInLamaja) return getLamajaItems();
    if (isInRetamar) return getRetamarItems();
    return getMainItems();
  };

  // Determinar el título del menú
  const getMenuTitle = () => {
    if (isInLamaja) return "La Maja";
    if (isInRetamar) return "Retamar";
    
    // Si el usuario solo tiene una planta, mostrar el nombre de esa planta
    const singlePlant = getSinglePlant();
    if (singlePlant) {
      return singlePlant === 'LAMAJA' ? 'La Maja' : 
             singlePlant === 'RETAMAR' ? 'Retamar' : 'Menú Principal';
    }
    
    return "Menú Principal";
  };

  const handleItemClick = (item) => {
    // Verificar si el usuario puede acceder a esa ruta
    if (profile && profile.rol !== 'admin') {
      // Para la página principal, verificar acceso
      if (item.path === '/' && !canAccessMainDashboard()) {
        return; // No permitir navegación
      }
      
      // Para rutas de plantas, verificar asignación
      const plantasAsignadas = profile.plantas_asignadas || [];
      if (item.path.startsWith('/lamaja') && !plantasAsignadas.includes('LAMAJA') && !plantasAsignadas.includes('TOTAL')) {
        return;
      }
      if (item.path.startsWith('/retamar') && !plantasAsignadas.includes('RETAMAR') && !plantasAsignadas.includes('TOTAL')) {
        return;
      }
    }

    router.push(item.path);
    setShowMainMenu(false);
  };

  const isActive = (path) => {
    // Para exportacion-variables, considerar activo sin importar query params
    if (path.includes('/exportacion-variables') && pathname === '/exportacion-variables') {
      return true;
    }
    return pathname === path;
  };

  const currentMenuItems = getMenuItems();
  const footerItems = getFooterItems();

  // Si el usuario no tiene plantas asignadas, no mostrar menú
  if (profile && profile.rol !== 'admin' && (!profile.plantas_asignadas || profile.plantas_asignadas.length === 0)) {
    return (
      <div className="relative">
        <button className="p-2 rounded-md opacity-50 cursor-not-allowed">
          <Menu size={20} />
        </button>
      </div>
    );
  }

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
                  isBackButton={item.label.includes('Volver') || item.label.includes('Ir a')}
                  disabled={
                    profile && profile.rol !== 'admin' && (
                      (item.path === '/' && !canAccessMainDashboard()) ||
                      (item.path.startsWith('/lamaja') && !profile.plantas_asignadas?.includes('LAMAJA') && !profile.plantas_asignadas?.includes('TOTAL')) ||
                      (item.path.startsWith('/retamar') && !profile.plantas_asignadas?.includes('RETAMAR') && !profile.plantas_asignadas?.includes('TOTAL'))
                    )
                  }
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

const NavbarItem = ({ icon: Icon, label, active = false, onClick, badge = null, isBackButton = false, disabled = false }) => (
  <button
    onClick={disabled ? undefined : onClick}
    className={`w-full flex items-center justify-between px-3 py-2.5 text-sm font-medium rounded-md transition-all duration-200 group ${
      disabled 
        ? 'opacity-50 cursor-not-allowed text-secondary'
        : active 
        ? 'bg-blue-500 text-white shadow-md cursor-pointer' 
        : isBackButton
        ? 'text-secondary hover:text-primary hover-menu cursor-pointer'
        : 'text-primary hover-menu cursor-pointer'
    }`}
    disabled={disabled}
  >
    <div className="flex items-center space-x-3">
      <Icon 
        size={16} 
        className={`${
          disabled 
            ? 'text-secondary' 
            : active 
            ? 'text-white' 
            : isBackButton 
            ? 'text-secondary' 
            : 'text-secondary group-hover:text-primary'
        } transition-colors`} 
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