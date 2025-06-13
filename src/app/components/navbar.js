'use client';

import { useState, useMemo, useCallback } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { useAuth } from '../contexts/AuthContext';
import { Menu, Home, Users, Activity, Download, FileText, AlertTriangle, ArrowLeft, Zap, BarChart3, Wrench, Map, PieChart, Calculator } from 'lucide-react';

const Navbar = () => {
  const [showMainMenu, setShowMainMenu] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { isAdmin, profile, canAccessMainDashboard, getSinglePlant } = useAuth();

  const currentContext = useMemo(() => {
    if (pathname.startsWith('/lamaja')) {
      return 'LAMAJA';
    }
    if (pathname.startsWith('/retamar')) {
      return 'RETAMAR';
    }

    const plantaParam = searchParams.get('planta');
    if (plantaParam === 'lamaja') {
      return 'LAMAJA';
    }
    if (plantaParam === 'retamar') {
      return 'RETAMAR';
    }

    const singlePlant = getSinglePlant();
    if (singlePlant && (pathname === '/gestion-documentos' || pathname === '/exportacion-variables')) {
      return singlePlant;
    }

    return 'MAIN';
  }, [pathname, searchParams, getSinglePlant]);

  // Función para obtener plantas disponibles para el usuario
  const availablePlants = useMemo(() => {
    if (!profile) return [];

    if (profile.rol === 'admin') {
      return [
        { id: 'LAMAJA', label: 'La Maja', path: '/lamaja' },
        { id: 'RETAMAR', label: 'Retamar', path: '/retamar' }
      ];
    }

    const plantasAsignadas = profile.plantas_asignadas || [];
    const plants = [];

    if (plantasAsignadas.includes('TOTAL') || plantasAsignadas.includes('LAMAJA')) {
      plants.push({ id: 'LAMAJA', label: 'La Maja', path: '/lamaja' });
    }

    if (plantasAsignadas.includes('TOTAL') || plantasAsignadas.includes('RETAMAR')) {
      plants.push({ id: 'RETAMAR', label: 'Retamar', path: '/retamar' });
    }

    return plants;
  }, [profile]);

  const handleItemClick = useCallback((item) => {
    // Verificaciones de permisos
    if (profile && profile.rol !== 'admin') {
      if (item.path === '/' && !canAccessMainDashboard()) {
        return;
      }

      const plantasAsignadas = profile.plantas_asignadas || [];
      if (item.path.startsWith('/lamaja') && !plantasAsignadas.includes('LAMAJA') && !plantasAsignadas.includes('TOTAL')) {
        return;
      }
      if (item.path.startsWith('/retamar') && !plantasAsignadas.includes('RETAMAR') && !plantasAsignadas.includes('TOTAL')) {
        return;
      }
    }

    setShowMainMenu(false);

    router.push(item.path);
  }, [profile, canAccessMainDashboard, router]);

  const isActive = (path) => {
    if (path.includes('?')) {
      const [basePath, queryString] = path.split('?');
      const urlParams = new URLSearchParams(queryString);

      if (pathname !== basePath) return false;

      for (const [key, value] of urlParams.entries()) {
        if (searchParams.get(key) !== value) return false;
      }

      return true;
    }

    if (pathname === path) return true;

    return false;
  };

  const currentMenuItems = useMemo(() => {
    const items = [];
    const singlePlant = getSinglePlant();

    switch (currentContext) {
      case 'LAMAJA':
        if (singlePlant !== 'LAMAJA') {
          if (canAccessMainDashboard()) {
            items.push({ icon: ArrowLeft, label: "Volver al menú principal", path: "/" });
          } else {
            availablePlants.filter(p => p.id !== 'LAMAJA').forEach(plant => {
              items.push({ icon: Activity, label: `Ir a ${plant.label}`, path: plant.path });
            });
          }
        }

        items.push({ icon: BarChart3, label: "Dashboard La Maja", path: "/lamaja" });

        if (singlePlant === 'LAMAJA') {
          items.push({ icon: PieChart, label: "PV Resumen", path: "/lamaja/pv-resumen" });
        } else {
          items.push(
            { icon: Map, label: "Heat Maps", path: "/lamaja/heat-maps" },
            { icon: PieChart, label: "PV Resumen", path: "/lamaja/pv-resumen" },
            { icon: Zap, label: "Resumen Inversores", path: "/lamaja/resumen-inversores" },
            { icon: Wrench, label: "Detalle Inversor", path: "/lamaja/detalle-inversor" },
            { icon: Activity, label: "Subestación y CTs", path: "/lamaja/subestacion-cts" }
          );
        }
        break;

      case 'RETAMAR':
        if (singlePlant !== 'RETAMAR') {
          if (canAccessMainDashboard()) {
            items.push({ icon: ArrowLeft, label: "Volver al menú principal", path: "/" });
          } else {
            availablePlants.filter(p => p.id !== 'RETAMAR').forEach(plant => {
              items.push({ icon: Activity, label: `Ir a ${plant.label}`, path: plant.path });
            });
          }
        }

        items.push({ icon: BarChart3, label: "Dashboard Retamar", path: "/retamar" });

        if (singlePlant === 'RETAMAR') {
          items.push({ icon: PieChart, label: "PV Resumen", path: "/retamar/pv-resumen" });
        } else {
          items.push(
            { icon: Map, label: "Heat Maps", path: "/retamar/heat-maps" },
            { icon: PieChart, label: "PV Resumen", path: "/retamar/pv-resumen" },
            { icon: Zap, label: "Resumen Inversores", path: "/retamar/resumen-inversores" },
            { icon: Wrench, label: "Detalle Inversor", path: "/retamar/detalle-inversor" },
            { icon: Activity, label: "Resumen Trackers", path: "/retamar/resumen-trackers" },
            { icon: Wrench, label: "Detalle Tracker", path: "/retamar/detalle-tracker" },
            { icon: FileText, label: "Facturación", path: "/retamar/facturacion" }
          );
        }
        break;

      default:
        if (canAccessMainDashboard()) {
          items.push({ icon: Home, label: "Inicio", path: "/" });
        }
        availablePlants.forEach(plant => {
          items.push({ icon: Activity, label: plant.label, path: plant.path });
        });
        break;
    }

    return items;
  }, [currentContext, availablePlants, canAccessMainDashboard, getSinglePlant]);

  const footerItems = useMemo(() => {
    const items = [];
    const singlePlant = getSinglePlant();

    let documentosPath = "/gestion-documentos";
    if (currentContext === 'LAMAJA') {
      documentosPath = "/gestion-documentos?planta=lamaja";
    } else if (currentContext === 'RETAMAR') {
      documentosPath = "/gestion-documentos?planta=retamar";
    }

    items.push({ icon: FileText, label: "Gestión de Documentos", path: documentosPath });

    if (!singlePlant || isAdmin) {
      let exportPath = "/exportacion-variables";
      if (currentContext === 'LAMAJA') {
        exportPath = "/exportacion-variables?planta=lamaja";
      } else if (currentContext === 'RETAMAR') {
        exportPath = "/exportacion-variables?planta=retamar";
      }
      items.push({ icon: Download, label: "Exportación de variables", path: exportPath });
    }

    if (isAdmin) {
      items.push({ icon: Users, label: "Usuarios", path: "/usuarios" });
    }

    return items;
  }, [currentContext, getSinglePlant, isAdmin]);

  const menuTitle = useMemo(() => {
    switch (currentContext) {
      case 'LAMAJA':
        return "La Maja";
      case 'RETAMAR':
        return "Retamar";
      default:
        const singlePlant = getSinglePlant();
        if (singlePlant) {
          return singlePlant === 'LAMAJA' ? 'La Maja' :
            singlePlant === 'RETAMAR' ? 'Retamar' : 'Menú Principal';
        }
        return "Menú Principal";
    }
  }, [currentContext, getSinglePlant]);

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
              <h3 className="text-sm font-semibold text-primary">{menuTitle}</h3>
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
    className={`w-full flex items-center justify-between px-3 py-2.5 text-sm font-medium rounded-md transition-all duration-200 group ${disabled
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
        className={`${disabled
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