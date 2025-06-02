'use client';

import { useEffect, useRef, useState } from 'react';
import { AlertTriangle } from 'lucide-react';

const Map = () => {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersRef = useRef([]);
  const labelsRef = useRef([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const [stationsData, setStationsData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadStationsData = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/map-data');
      const result = await response.json();

      if (result.success && result.stations) {
        setStationsData(result.stations);
        setError(null);
      } else {
        setError(result.error || 'Error al cargar datos');
      }
    } catch (err) {
      setError('Error de conexión');
    } finally {
      setLoading(false);
    }
  };

  const clearMarkers = () => {
    markersRef.current.forEach(marker => {
      try {
        if (mapInstanceRef.current) {
          mapInstanceRef.current.removeLayer(marker);
        }
      } catch (e) { }
    });
    markersRef.current = [];

    labelsRef.current.forEach(label => {
      try {
        if (mapInstanceRef.current) {
          mapInstanceRef.current.removeLayer(label);
        }
      } catch (e) { }
    });
    labelsRef.current = [];
  };

  const updateMapMarkers = () => {
    if (!mapInstanceRef.current || !window.L || stationsData.length === 0) {
      return;
    }

    clearMarkers();

    stationsData.forEach((station) => {
      if (!station.coordinates || station.coordinates[0] === 0 && station.coordinates[1] === 0) {
        return;
      }

      try {
        // Marcador principal
        const icon = createCustomIcon(station.data?.AvEle);
        const marker = window.L.marker(station.coordinates, { icon })
          .addTo(mapInstanceRef.current);

        marker.bindPopup(createPopupContent(station), {
          offset: [-3, -3],
          closeButton: true,
          autoClose: true,
          autoPan: true,
          className: 'custom-popup'
        });
        markersRef.current.push(marker);

        // Label de datos
        const irradianceLabel = createIrradianceLabel(station);
        const labelMarker = window.L.marker(station.coordinates, {
          icon: irradianceLabel,
          interactive: false
        }).addTo(mapInstanceRef.current);

        labelsRef.current.push(labelMarker);
      } catch (error) {
        // Ignorar errores de marcadores individuales
      }
    });
  };

  const createCustomIcon = (avEle) => {
    let color = '#6b7280'; // gris por defecto

    if (avEle >= 90) {
      color = '#10b981'; // verde
    } else if (avEle >= 50) {
      color = '#f59e0b'; // amarillo
    } else if (avEle >= 0) {
      color = '#ef4444'; // rojo
    }

    return window.L.divIcon({
      html: `
      <div style="
        width: 20px;
        height: 20px;
        background-color: ${color};
        border: 3px solid white;
        border-radius: 50%;
        box-shadow: 0 2px 4px rgba(0,0,0,0.2);
        position: relative;
        z-index: 1000;
      "></div>
    `,
      className: 'custom-marker',
      iconSize: [26, 26],
      iconAnchor: [13, 13]
    });
  };

  const createIrradianceLabel = (station) => {
    const { Irrad, P } = station.data || {};

    const irradianceText = Irrad !== null && Irrad !== undefined
      ? `${Math.round(Irrad)} W/m²`
      : 'N/A';

    const powerText = P !== null && P !== undefined
      ? (Math.abs(P) >= 1000 ? `${(P / 1000).toFixed(2)} MW` : `${P.toFixed(1)} kW`)
      : 'N/A';

    return window.L.divIcon({
      html: `
        <div style="
          background-color: white;
          color: #374151;
          padding: 2px 6px;
          border-radius: 4px;
          font-size: 10px;
          font-family: Inter, sans-serif;
          text-align: left;
          min-width: 70px;
          white-space: nowrap;
          box-shadow: 0 1px 3px rgba(0,0,0,0.3);
          border: 1px solid rgba(0,0,0,0.1);
          position: relative;
          z-index: 999;
          line-height: 1.3;
        ">
          <div><strong>I:</strong> ${irradianceText}</div>
          <div><strong>P:</strong> ${powerText}</div>
        </div>
      `,
      className: 'irradiance-label',
      iconSize: [75, 32],
      iconAnchor: [20, -15]
    });
  };

  const createPopupContent = (station) => {
    const { data } = station;

    const formatValue = (value, type) => {
      if (value === null || value === undefined) return 'N/A';

      switch (type) {
        case 'percentage':
          return `${Math.round(value)} %`;
        case 'irradiance':
          return `${Math.round(value)} W/m²`;
        case 'power_p':
          if (Math.abs(value) >= 1000) {
            return `${(value / 1000).toFixed(2)} MW`;
          }
          return `${value.toFixed(1)} kW`;
        case 'power_q':
          if (Math.abs(value) >= 1000) {
            return `${Math.round(value)} kVAr`;
          }
          return `${value.toFixed(1)} VAr`;
        default:
          return value.toString();
      }
    };

    return `
      <div style="min-width: 200px; font-family: Inter, sans-serif; line-height: 1.2;">
        <div style="border-bottom: 1px solid #e5e7eb; padding-bottom: 4px; margin-bottom: 6px;">
          <div style="font-size: 14px; font-weight: bold;">
            ${station.name}
          </div>
        </div>
        
        <div style="display: flex; flex-direction: column; gap: 3px; font-size: 12px;">
          <div style="display: flex; justify-content: space-between;">
            <span style="font-weight: bold;">Dispo. Eléctrica</span>
            <span>${formatValue(data?.AvEle, 'percentage')}</span>
          </div>
          
          <div style="display: flex; justify-content: space-between;">
            <span style="font-weight: bold;">Irradiancia</span>
            <span>${formatValue(data?.Irrad, 'irradiance')}</span>
          </div>
          
          <div style="display: flex; justify-content: space-between;">
            <span style="font-weight: bold;">P</span>
            <span>${formatValue(data?.P, 'power_p')}</span>
          </div>
          
          <div style="display: flex; justify-content: space-between;">
            <span style="font-weight: bold;">Q</span>
            <span>${formatValue(data?.Q, 'power_q')}</span>
          </div>
          
          <div style="display: flex; justify-content: space-between;">
            <span style="font-weight: bold;">Dispo. Mecánica</span>
            <span>${formatValue(data?.AvMec, 'percentage')}</span>
          </div>
        </div>
      </div>
    `;
  };

  const initializeMap = () => {
    if (!mapRef.current || !window.L) return;

    // Si ya existe un mapa, limpiarlo
    if (mapInstanceRef.current) {
      try {
        mapInstanceRef.current.remove();
      } catch (e) { }
      mapInstanceRef.current = null;
    }

    try {
      mapRef.current.innerHTML = '';

      const map = window.L.map(mapRef.current, {
        center: [40.136361, -2.372718],
        zoom: 6.3,
        zoomControl: true,
        scrollWheelZoom: true,
        doubleClickZoom: true,
        dragging: true,
        touchZoom: true,
        boxZoom: true,
        keyboard: true
      });

      window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19
      }).addTo(map);

      mapInstanceRef.current = map;
      setIsLoaded(true);

      // Cargar datos después de inicializar
      loadStationsData();

    } catch (error) {
      setError('Error inicializando el mapa');
    }
  };

  // Cargar Leaflet e inicializar mapa
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const loadLeaflet = () => {
      if (window.L) {
        initializeMap();
        return;
      }

      const cssLink = document.createElement('link');
      cssLink.rel = 'stylesheet';
      cssLink.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(cssLink);

      const script = document.createElement('script');
      script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
      script.onload = () => setTimeout(initializeMap, 100);
      script.onerror = () => setError('Error cargando la librería del mapa');
      document.head.appendChild(script);
    };

    loadLeaflet();

    return () => {
      if (mapInstanceRef.current) {
        try {
          mapInstanceRef.current.remove();
        } catch (e) { }
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Actualizar marcadores cuando cambien los datos
  useEffect(() => {
    if (isLoaded && stationsData.length > 0 && mapInstanceRef.current) {
      updateMapMarkers();
    }
  }, [isLoaded, stationsData]);

  // Auto-refresh cada 5 minutos
  useEffect(() => {
    if (!isLoaded) return;

    const interval = setInterval(loadStationsData, 300000);
    return () => clearInterval(interval);
  }, [isLoaded]);

  if (error) {
    return (
      <div className="w-full h-96 bg-panel rounded-lg flex items-center justify-center">
        <div className="text-center text-red-500">
          <AlertTriangle size={48} className="mx-auto mb-2" />
          <p>{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-2 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 cursor-pointer"
          >
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full space-y-4">
      <div className="bg-panel rounded-lg overflow-hidden relative">
        {(!isLoaded || loading) && (
          <div className="absolute inset-0 bg-header-table rounded-lg flex items-center justify-center z-10">
            <div className="text-center">
              <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Cargando mapa...
              </p>
            </div>
          </div>
        )}

        <div
          ref={mapRef}
          className="w-full h-96 bg-gray-100"
          style={{ minHeight: '500px', zIndex: 1 }}
        />
      </div>
    </div>
  );
};

export default Map;