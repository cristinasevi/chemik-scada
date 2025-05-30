// src/app/api/map-data/route.js
import { InfluxDB } from '@influxdata/influxdb-client';

const url = process.env.INFLUXDB_URL || 'http://localhost:8086';
const token = process.env.INFLUXDB_TOKEN;
const org = process.env.INFLUXDB_ORG;
const bucket = process.env.INFLUXDB_BUCKET_GEOMAP || 'GeoMap';

const influxDB = new InfluxDB({ url, token });

export async function GET(request) {
  try {
    const queryApi = influxDB.getQueryApi(org);
    
    // Query igual que Grafana - últimas 24 horas y datos más recientes
    const fluxQuery = `
      from(bucket: "${bucket}")
        |> range(start: -24h)
        |> filter(fn: (r) => r["_measurement"] == "modbus")
        |> last()
        |> pivot(rowKey:["_time"], columnKey: ["_field"], valueColumn: "_value")
        |> keep(columns: ["AvEle","AvMec","Irrad","P","Q","latitude","longitude","Plant"])
        |> group()
    `;

    console.log('🔧 Query ejecutándose:');
    console.log(fluxQuery);
    
    const data = [];
    const plantMap = new Map();
    
    return new Promise((resolve, reject) => {
      queryApi.queryRows(fluxQuery, {
        next(row, tableMeta) {
          const rowData = tableMeta.toObject(row);
          console.log('📊 Dato recibido:', JSON.stringify(rowData, null, 2));
          
          const plantId = rowData.Plant || rowData.host || rowData.name || `plant_${data.length}`;
          
          if (plantMap.has(plantId)) return;
          
          const coordinates = [
            Number(rowData.latitude) || 40.136361,
            Number(rowData.longitude) || -2.372718
          ];
          
          console.log(`🗺️ ${plantId} - Coordenadas: [${coordinates.join(', ')}]`);
          console.log(`📊 ${plantId} - P: ${rowData.P}, Q: ${rowData.Q}, Irrad: ${rowData.Irrad}`);
          
          const plantName = rowData.Plant || rowData.name || rowData.host || `Planta ${data.length + 1}`;
          
          const stationData = {
            stationId: plantId,
            name: plantName,
            coordinates: coordinates,
            data: {
              AvEle: rowData.AvEle || null,
              AvMec: rowData.AvMec || null,
              Irrad: rowData.Irrad || null,
              P: rowData.P || null,
              Q: rowData.Q || null,
              latitude: rowData.latitude || null,
              longitude: rowData.longitude || null,
              Plant: rowData.Plant || null,
              host: rowData.host || null,
              name: rowData.name || null,
              timestamp: rowData._time
            },
            status: determineStationStatus(rowData)
          };
          
          plantMap.set(plantId, true);
          data.push(stationData);
        },
        error(error) {
          console.error('Error en query InfluxDB:', error);
          reject(new Response(JSON.stringify({ 
            success: false, 
            error: 'Error al obtener datos de las estaciones',
            stations: []
          }), { status: 500 }));
        },
        complete() {
          resolve(new Response(JSON.stringify({
            success: true,
            stations: data,
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
      stations: []
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
  
  // Si los datos son muy antiguos (más de 7 días), marcar como offline
  if (hoursAgo > 24 * 7) return 'offline';
  
  // Verificar alertas basadas en los valores de la planta fotovoltaica
  if (data.P !== null && data.P < -50) return 'alert'; // Potencia muy negativa
  if (data.Irrad !== null && data.Irrad > 1200) return 'warning'; // Irradiación muy alta
  
  // Si hay datos recientes, considerar como online
  return 'online';
}