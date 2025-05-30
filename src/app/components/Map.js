'use client';

import { useEffect, useRef, useState } from 'react';
import { AlertTriangle } from 'lucide-react';

const Map = () => {
  const mapRef = useRef(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [stationsData, setStationsData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const mapInstanceRef = useRef(null);
  const markersRef = useRef([]);

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
      console.error('Error cargando datos de estaciones:', err);
      setError('Error de conexión');
    } finally {
      setLoading(false);
    }
  };

  const updateMapMarkers = () => {
    if (!mapInstanceRef.current || !window.L) return;

    markersRef.current.forEach(marker => {
      mapInstanceRef.current.removeLayer(marker);
    });
    markersRef.current = [];

    stationsData.forEach((station) => {
      if (station.coordinates[0] === 0 && station.coordinates[1] === 0) return;

      const icon = createCustomIcon(station.status);
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
    });
  };

  const createCustomIcon = (status) => {
    const colors = {
      online: '#10b981',
      warning: '#f59e0b',
      alert: '#ef4444',
      offline: '#6b7280'
    };

    const color = colors[status] || colors.offline;

    return window.L.divIcon({
      html: `
        <div style="
          width: 20px;
          height: 20px;
          background-color: ${color};
          border: 3px solid white;
          border-radius: 50%;
          box-shadow: 0 2px 4px rgba(0,0,0,0.2);
        "></div>
      `,
      className: 'custom-marker',
      iconSize: [26, 26],
      iconAnchor: [13, 13]
    });
  };

  const createPopupContent = (station) => {
    const { data } = station;

    // Función para formatear valores según el tipo
    const formatValue = (value, type) => {
      if (value === null || value === undefined) return 'N/A';
      
      switch (type) {
        case 'percentage':
          return `${Math.round(value)} %`;
        case 'irradiance':
          return `${Math.round(value)} W/m²`;
        case 'power_p':
          // Si es >= 1000 kW, mostrar en MW
          if (Math.abs(value) >= 1000) {
            return `${(value / 1000).toFixed(2)} MW`;
          }
          return `${value.toFixed(1)} kW`;
        case 'power_q':
          // Si es >= 1000, mostrar en kVAr sin decimales, sino en VAr con decimales
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
            <span>${formatValue(data.AvEle, 'percentage')}</span>
          </div>
          
          <div style="display: flex; justify-content: space-between;">
            <span style="font-weight: bold;">Irradiancia</span>
            <span>${formatValue(data.Irrad, 'irradiance')}</span>
          </div>
          
          <div style="display: flex; justify-content: space-between;">
            <span style="font-weight: bold;">P</span>
            <span>${formatValue(data.P, 'power_p')}</span>
          </div>
          
          <div style="display: flex; justify-content: space-between;">
            <span style="font-weight: bold;">Q</span>
            <span>${formatValue(data.Q, 'power_q')}</span>
          </div>
          
          <div style="display: flex; justify-content: space-between;">
            <span style="font-weight: bold;">Dispo. Mecánica</span>
            <span>${formatValue(data.AvMec, 'percentage')}</span>
          </div>
        </div>
      </div>
    `;
  };

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (isLoaded) return;

    const loadMap = async () => {
      try {
        if (window.L) {
          initMap();
          return;
        }

        const cssLink = document.createElement('link');
        cssLink.rel = 'stylesheet';
        cssLink.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
        document.head.appendChild(cssLink);

        const script = document.createElement('script');
        script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
        
        script.onload = () => {
          setTimeout(initMap, 100);
        };
        
        document.head.appendChild(script);

      } catch (error) {
        console.error('Error cargando mapa:', error);
        setError('Error cargando el mapa');
      }
    };

    const initMap = () => {
      if (!mapRef.current || !window.L) return;

      try {
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
        loadStationsData();

      } catch (error) {
        console.error('Error creando mapa:', error);
        setError('Error inicializando el mapa');
      }
    };

    loadMap();
  }, [isLoaded]);

  useEffect(() => {
    if (isLoaded && stationsData.length > 0) {
      updateMapMarkers();
    }
  }, [isLoaded, stationsData]);

  useEffect(() => {
    if (!isLoaded) return;

    const interval = setInterval(() => {
      loadStationsData();
    }, 30000);

    return () => clearInterval(interval);
  }, [isLoaded]);

  if (error) {
    return (
      <div className="w-full h-96 bg-panel rounded-lg flex items-center justify-center">
        <div className="text-center text-red-500">
          <AlertTriangle size={48} className="mx-auto mb-2" />
          <p>Error: {error}</p>
          <button 
            onClick={() => {
              setError(null);
              loadStationsData();
            }}
            className="mt-2 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full space-y-4">
      <div className="bg-panel rounded-lg p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-primary">Plantas Fotovoltaicas</h2>
          <div className="flex items-center space-x-4">
            {loading && (
              <div className="flex items-center space-x-2 text-secondary">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>
                <span>Actualizando...</span>
              </div>
            )}
            <div className="flex items-center space-x-4 text-sm">
              <div className="flex items-center space-x-1">
                <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                <span className="text-secondary">Online: {stationsData.filter(s => s.status === 'online').length}</span>
              </div>
              <div className="flex items-center space-x-1">
                <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                <span className="text-secondary">Alertas: {stationsData.filter(s => s.status === 'alert').length}</span>
              </div>
              <div className="flex items-center space-x-1">
                <div className="w-3 h-3 bg-gray-500 rounded-full"></div>
                <span className="text-secondary">Offline: {stationsData.filter(s => s.status === 'offline').length}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-panel rounded-lg overflow-hidden">
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