'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

const GrafanaEmbed = ({
  dashboardId = 'eea5x3hn8jdogc',
  dashboardName = 'e2808e-retamar',
  panelId = null,
  from = 'now/d',
  to = 'now',
  refresh = '5s',
  theme = 'auto',
  height = '100vh',
  autoRefresh = true,
  orgId = 1,
  className = ""
}) => {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentTheme, setCurrentTheme] = useState('light');
  const [themeDetected, setThemeDetected] = useState(false);
  const iframeRef = useRef(null);

  // Configuración de Grafana
  const grafanaUrl = 'http://192.168.3.100:3003';
  const defaultDashboardId = '405f439b-2f99-48f9-b4fc-9e35ceec411d';

  // Función para detectar el tema actual
  const detectCurrentTheme = useCallback(() => {
    if (theme === 'auto') {
      const isDark = document.documentElement.classList.contains('dark');
      return isDark ? 'dark' : 'light';
    }
    return theme;
  }, [theme]);

  // Función para construir URL de Grafana
  const buildGrafanaUrl = useCallback((themeToUse = null) => {
    const dashId = dashboardId || defaultDashboardId;
    const dashName = dashboardName || 'new-dashboard';

    let baseUrl;
    if (panelId) {
      baseUrl = `${grafanaUrl}/d-solo/${dashId}/${dashName}`;
    } else {
      baseUrl = `${grafanaUrl}/d/${dashId}/${dashName}`;
    }

    const params = new URLSearchParams({
      orgId: orgId.toString(),
      from: from,
      to: to,
      kiosk: '1',
      timezone: 'browser'
    });

    // Forzar tema específico para evitar problemas
    const finalTheme = themeToUse || currentTheme;
    if (finalTheme && finalTheme !== 'auto') {
      params.append('theme', finalTheme);
    }

    if (panelId) {
      params.append('panelId', panelId.toString());
    }

    if (refresh && autoRefresh) {
      params.append('refresh', refresh);
    }

    return `${baseUrl}?${params.toString()}`;
  }, [dashboardId, defaultDashboardId, dashboardName, panelId, from, to, currentTheme, orgId, refresh, autoRefresh, grafanaUrl]);

  // Actualizar tema automáticamente
  const updateIframeTheme = useCallback((newTheme) => {
    if (iframeRef.current) {
      setIsLoading(true);
      iframeRef.current.src = buildGrafanaUrl(newTheme);
    }
  }, [buildGrafanaUrl]);

  // Detectar cambios de tema inicial
  useEffect(() => {
    const detectedTheme = detectCurrentTheme();
    setCurrentTheme(detectedTheme);
    setThemeDetected(true);
  }, []);

  // Observar cambios en el tema del documento
  useEffect(() => {
    if (theme !== 'auto' || !themeDetected) return;

    const observer = new MutationObserver(() => {
      const newTheme = detectCurrentTheme();
      if (newTheme !== currentTheme) {
        setCurrentTheme(newTheme);
        updateIframeTheme(newTheme);
      }
    });

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class']
    });

    return () => observer.disconnect();
  }, [theme, themeDetected, currentTheme, detectCurrentTheme, updateIframeTheme]);

  const handleIframeLoad = () => {
    setIsLoading(false);
    setError(null);
  };

  const handleIframeError = () => {
    setIsLoading(false);
    setError('Error cargando el dashboard');
  };

  // Timeout para evitar carga infinita
  useEffect(() => {
    const timeout = setTimeout(() => {
      if (isLoading) {
        setIsLoading(false);
        setError('El dashboard está tardando mucho en cargar');
      }
    }, 30000);

    return () => clearTimeout(timeout);
  }, [isLoading]);

  if (error) {
    return (
      <div className={`w-full h-full flex items-center justify-center header-bg ${className}`} style={{ height }}>
        <div className="text-center text-red-500">
          <p className="text-lg font-semibold">Error</p>
          <p className="text-sm">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`w-full relative ${className}`} style={{ height }}>
      {(isLoading || !themeDetected) && (
        <div className="absolute inset-0 flex items-center justify-center header-bg z-10">
          <div className="text-center">
            <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
            <p className="text-sm text-gray-500">Cargando dashboard...</p>
          </div>
        </div>
      )}

      {themeDetected && (
        <iframe
          ref={iframeRef}
          src={buildGrafanaUrl()}
          width="100%"
          height="100%"
          frameBorder="0"
          onLoad={handleIframeLoad}
          onError={handleIframeError}
          className="w-full h-full"
          title="Grafana Dashboard"
          allow="fullscreen"
          sandbox="allow-same-origin allow-scripts allow-forms allow-popups"
        />
      )}
    </div>
  );
};

export default GrafanaEmbed;