'use client';

import { useEffect, useRef, useState } from 'react';

const Map = () => {
  const mapRef = useRef(null);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    // Solo ejecutar en el cliente
    if (typeof window === 'undefined') return;
    
    // Evitar cargar múltiples veces
    if (isLoaded) return;

    const loadMap = async () => {
      try {
        // Si Leaflet ya está disponible
        if (window.L) {
          initMap();
          return;
        }

        // Cargar Leaflet CSS
        const cssLink = document.createElement('link');
        cssLink.rel = 'stylesheet';
        cssLink.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
        document.head.appendChild(cssLink);

        // Cargar Leaflet JS
        const script = document.createElement('script');
        script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
        
        script.onload = () => {
          setTimeout(initMap, 100); // Pequeña pausa para asegurar que está listo
        };
        
        document.head.appendChild(script);

      } catch (error) {
        console.error('Error cargando mapa:', error);
      }
    };

    const initMap = () => {
      if (!mapRef.current || !window.L) return;

      try {
        // Crear el mapa centrado en España
        const map = window.L.map(mapRef.current, {
          center: [40.0, -4.0], // Centro de España
          zoom: 6,
          zoomControl: true,
          scrollWheelZoom: true,
          doubleClickZoom: true,
          dragging: true,
          touchZoom: true,
          boxZoom: true,
          keyboard: true
        });

        // Agregar las tiles de OpenStreetMap
        window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
          maxZoom: 19
        }).addTo(map);

        // Agregar algunos marcadores en ciudades principales
        const cities = [
          { name: 'Madrid', coords: [40.4168, -3.7038] },
          { name: 'Barcelona', coords: [41.3851, 2.1734] },
          { name: 'Valencia', coords: [39.4699, -0.3763] },
          { name: 'Sevilla', coords: [37.3886, -5.9823] },
          { name: 'Bilbao', coords: [43.2630, -2.9350] }
        ];

        cities.forEach(city => {
          const marker = window.L.marker(city.coords).addTo(map);
          marker.bindPopup(`<b>${city.name}</b><br>Estación meteorológica`);
        });

        setIsLoaded(true);
        console.log('✅ Mapa cargado correctamente');

      } catch (error) {
        console.error('Error creando mapa:', error);
      }
    };

    loadMap();
  }, [isLoaded]);

  return (
    <div className="w-full h-full">
      <div
        ref={mapRef}
        className="w-full h-96 bg-gray-100 rounded-lg"
        style={{ minHeight: '500px', zIndex: 1 }}
      />
    </div>
  );
};

export default Map;