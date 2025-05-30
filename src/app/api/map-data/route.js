// src/app/api/map-data/route.js
import { InfluxDB } from '@influxdata/influxdb-client';

const url = process.env.INFLUXDB_URL || 'http://localhost:8086';
const token = process.env.INFLUXDB_TOKEN;
const org = process.env.INFLUXDB_ORG;
const bucket = process.env.INFLUXDB_BUCKET_GEOMAP || 'GeoMap';

// Coordenadas por defecto (centro de España)
const DEFAULT_COORDINATES = [40.136361, -2.372718];

const influxDB = new InfluxDB({ url, token });

export async function GET(request) {
  try {
    const queryApi = influxDB.getQueryApi(org);
    
    // Query genérica que obtiene TODAS las estaciones disponibles
    const fluxQuery = `
      from(bucket: "${bucket}")
        |> range(start: -24h)
        |> filter(fn: (r) => r["_measurement"] == "modbus")
        |> last()
        |> pivot(rowKey:["_time"], columnKey: ["_field"], valueColumn: "_value")
        |> keep(columns: ["AvEle","AvMec","Irrad","P","Q","latitude","longitude","Plant","host","name"])
        |> group()
    `;
    
    const data = [];
    const plantMap = new Map();
    
    return new Promise((resolve, reject) => {
      queryApi.queryRows(fluxQuery, {
        next(row, tableMeta) {
          const rowData = tableMeta.toObject(row);
          
          // Identificar la estación usando múltiples campos posibles
          const plantId = rowData.Plant || 
                          rowData.host || 
                          rowData.name || 
                          rowData._measurement || 
                          `station_${data.length}`;
          
          // Evitar duplicados
          if (plantMap.has(plantId)) return;
          
          // Validar y usar coordenadas (solo si son válidas)
          let coordinates = DEFAULT_COORDINATES;
          const lat = Number(rowData.latitude);
          const lon = Number(rowData.longitude);
          
          // Verificar que las coordenadas sean válidas (no 0,0 y dentro de rangos razonables)
          if (lat && lon && 
              lat !== 0 && lon !== 0 && 
              lat >= -90 && lat <= 90 && 
              lon >= -180 && lon <= 180) {
            coordinates = [lat, lon];
          }
          
          // Determinar el nombre más descriptivo disponible
          const plantName = rowData.Plant || 
                           rowData.name || 
                           rowData.host || 
                           `Estación ${data.length + 1}`;
          
          const stationData = {
            stationId: plantId,
            name: plantName,
            coordinates: coordinates,
            data: {
              // Datos de disponibilidad
              AvEle: parseFloat(rowData.AvEle) || null,
              AvMec: parseFloat(rowData.AvMec) || null,
              
              // Datos ambientales
              Irrad: parseFloat(rowData.Irrad) || null,
              
              // Datos eléctricos
              P: parseFloat(rowData.P) || null,
              Q: parseFloat(rowData.Q) || null,
              
              // Metadatos de ubicación
              latitude: lat || null,
              longitude: lon || null,
              
              // Identificadores
              Plant: rowData.Plant || null,
              host: rowData.host || null,
              name: rowData.name || null,
              
              // Timestamp
              timestamp: rowData._time
            },
            status: determineStationStatus(rowData),
            hasValidCoordinates: coordinates !== DEFAULT_COORDINATES
          };
          
          plantMap.set(plantId, true);
          data.push(stationData);
        },
        error(error) {
          console.error('Error en query InfluxDB:', error);
          reject(new Response(JSON.stringify({ 
            success: false, 
            error: 'Error al obtener datos de las estaciones',
            stations: [],
            timestamp: new Date().toISOString()
          }), { 
            status: 500,
            headers: { 'Content-Type': 'application/json' }
          }));
        },
        complete() {
          // Estadísticas para debug/monitoreo
          const stats = {
            total: data.length,
            withValidCoordinates: data.filter(s => s.hasValidCoordinates).length,
            online: data.filter(s => s.status === 'online').length,
            warning: data.filter(s => s.status === 'warning').length,
            alert: data.filter(s => s.status === 'alert').length,
            offline: data.filter(s => s.status === 'offline').length
          };
          
          resolve(new Response(JSON.stringify({
            success: true,
            stations: data,
            stats: stats,
            timestamp: new Date().toISOString()
          }), {
            headers: { 'Content-Type': 'application/json' }
          }));
        }
      });
    });

  } catch (error) {
    console.error('Error obteniendo datos del mapa:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: 'Error al obtener datos de las estaciones',
      stations: [],
      timestamp: new Date().toISOString()
    }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

function determineStationStatus(data) {
  const now = new Date();
  const dataTime = new Date(data._time);
  const hoursAgo = (now - dataTime) / (1000 * 60 * 60);
  
  // Offline si los datos son muy antiguos
  if (hoursAgo > 24 * 7) return 'offline';
  
  // Condiciones de alerta configurables
  const alertConditions = [
    // Potencia muy negativa (puede indicar problema)
    data.P !== null && data.P < -50,
    
    // Disponibilidad eléctrica muy baja
    data.AvEle !== null && data.AvEle < 50,
    
    // Disponibilidad mecánica muy baja
    data.AvMec !== null && data.AvMec < 50
  ];
  
  // Condiciones de advertencia configurables
  const warningConditions = [
    // Irradiación excesivamente alta
    data.Irrad !== null && data.Irrad > 1200,
    
    // Disponibilidad eléctrica moderadamente baja
    data.AvEle !== null && data.AvEle >= 50 && data.AvEle < 85,
    
    // Disponibilidad mecánica moderadamente baja  
    data.AvMec !== null && data.AvMec >= 50 && data.AvMec < 85
  ];
  
  // Evaluar condiciones
  if (alertConditions.some(condition => condition)) return 'alert';
  if (warningConditions.some(condition => condition)) return 'warning';
  
  // Si hay datos recientes y no hay problemas, considerar online
  return 'online';
}