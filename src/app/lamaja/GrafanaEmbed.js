'use client';

import { useState, useEffect, useRef } from 'react';
import { AlertTriangle, ExternalLink, Maximize2, Minimize2, RefreshCw } from 'lucide-react';

const GrafanaEmbed = ({ 
  dashboardId = null,
  panelId = null, 
  from = 'now-1h',
  to = 'now',
  refresh = '5s',
  theme = 'auto',
  height = '400px',
  showControls = true,
  autoRefresh = true,
  orgId = 1,
  title = "Grafana Dashboard",
  className = "",
  hideHeader = false  // Oculta el header
}) => {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [currentTheme, setCurrentTheme] = useState(theme);
  const iframeRef = useRef(null);

  // Obtener URL base de Grafana desde variables de entorno o usar localhost
  const grafanaUrl = 'http://192.168.3.100:3001/d/3f7b9f97-3329-4557-b6e6-95157d251b8b/new-dashboard?orgId=1&from=now-6h&to=now&timezone=browser';

  // Detectar tema del sistema si es 'auto'
  useEffect(() => {
    if (theme === 'auto') {
      const isDark = document.documentElement.classList.contains('dark');
      setCurrentTheme(isDark ? 'dark' : 'light');
    } else {
      setCurrentTheme(theme);
    }
  }, [theme]);

  // Construir URL de Grafana
  const buildGrafanaUrl = () => {
    let baseUrl = grafanaUrl;
    
    if (panelId && dashboardId) {
      // Panel específico embebido
      baseUrl += `/d-solo/${dashboardId}`;
    } else if (dashboardId) {
      // Dashboard completo embebido
      baseUrl += `/d/${dashboardId}`;
    } else {
      // Dashboard por defecto
      baseUrl += `/d/default-dashboard`;
    }

    const params = new URLSearchParams({
      orgId: orgId.toString(),
      from: from,
      to: to,
      theme: currentTheme,
      // Oculta el header
      kiosk: '1',
    });

    if (panelId) {
      params.append('panelId', panelId.toString());
    }

    if (refresh && autoRefresh) {
      params.append('refresh', refresh);
    }

    return `${baseUrl}?${params.toString()}`;
  };

  const handleIframeLoad = () => {
    setIsLoading(false);
    setError(null);
  };

  const handleIframeError = () => {
    setIsLoading(false);
    setError('Error cargando el dashboard de Grafana');
  };

  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
  };

  const openInNewTab = () => {
    // Para nueva pestaña, usar URL completa sin -solo
    const newTabUrl = buildGrafanaUrl().replace('/d-solo/', '/d/');
    window.open(newTabUrl, '_blank');
  };

  const refreshIframe = () => {
    if (iframeRef.current) {
      setIsLoading(true);
      iframeRef.current.src = buildGrafanaUrl();
    }
  };

  if (error) {
    return (
      <div className={`w-full ${hideHeader ? '' : 'bg-panel rounded-lg border border-custom'} ${className}`}>
        {!hideHeader && (
          <div className="bg-header-table border-b border-custom p-4 flex justify-between items-center">
            <h3 className="text-lg font-semibold text-primary">{title}</h3>
            <button
              onClick={refreshIframe}
              className="p-2 text-secondary hover:text-primary hover:bg-hover-bg rounded transition-colors cursor-pointer"
              title="Reintentar"
            >
              <RefreshCw size={16} />
            </button>
          </div>
        )}
        <div className={`flex items-center justify-center p-6 text-red-500 ${hideHeader ? 'bg-panel rounded-lg' : ''}`} style={{ height }}>
          <div className="text-center">
            <AlertTriangle size={48} className="mx-auto mb-4" />
            <p className="mb-2">{error}</p>
            <button
              onClick={refreshIframe}
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 cursor-pointer"
            >
              Reintentar
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`${isFullscreen ? 'fixed inset-0 z-50 bg-background' : 'w-full'} ${hideHeader ? '' : 'bg-panel rounded-lg border border-custom'} overflow-hidden ${className}`}>
      {/* Header con controles - solo si no está oculto */}
      {!hideHeader && (
        <div className="bg-header-table border-b border-custom p-4 flex justify-between items-center">
          <h3 className="text-lg font-semibold text-primary">{title}</h3>
          
          <div className="flex items-center gap-2">
            <button
              onClick={refreshIframe}
              className="p-2 text-secondary hover:text-primary hover:bg-hover-bg rounded transition-colors cursor-pointer"
              title="Actualizar"
            >
              <RefreshCw size={16} />
            </button>
            
            <button
              onClick={openInNewTab}
              className="p-2 text-secondary hover:text-primary hover:bg-hover-bg rounded transition-colors cursor-pointer"
              title="Abrir en nueva pestaña"
            >
              <ExternalLink size={16} />
            </button>
            
            <button
              onClick={toggleFullscreen}
              className="p-2 text-secondary hover:text-primary hover:bg-hover-bg rounded transition-colors cursor-pointer"
              title={isFullscreen ? "Salir de pantalla completa" : "Pantalla completa"}
            >
              {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
            </button>
          </div>
        </div>
      )}

      {/* Iframe container */}
      <div className="relative" style={{ height: isFullscreen ? 'calc(100vh - 73px)' : height }}>
        {isLoading && (
          <div className={`absolute inset-0 flex items-center justify-center ${hideHeader ? 'bg-panel rounded-lg' : 'bg-header-table'}`}>
            <div className="text-center">
              <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
              <p className="text-sm text-secondary">Cargando dashboard de Grafana...</p>
            </div>
          </div>
        )}

        <iframe
          ref={iframeRef}
          src={buildGrafanaUrl()}
          width="100%"
          height="100%"
          frameBorder="0"
          onLoad={handleIframeLoad}
          onError={handleIframeError}
          className={`w-full h-full ${hideHeader ? 'rounded-lg' : ''}`}
          title={title}
          allow="fullscreen"
        />
      </div>
    </div>
  );
};

export default GrafanaEmbed;