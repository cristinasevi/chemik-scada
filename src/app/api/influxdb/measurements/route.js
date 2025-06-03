import { NextResponse } from 'next/server';

const INFLUX_URL = process.env.INFLUXDB_URL || 'http://213.4.39.163:8086';
const INFLUX_TOKEN = process.env.INFLUXDB_TOKEN || '0sGVviGogcFRVmIfvpRbc4VBG8vKU_hYRepoGThTUejr5XgE1pgy2H73-zJqqwwK0Ak2JF34Yq9J41PqtrebBw==';
const INFLUX_ORG = process.env.INFLUXDB_ORG || '53e3d55b34f76d1a';

// Función helper para parsear CSV
function parseCsvToArray(csvData, columnName) {
  try {
    const lines = csvData.trim().split('\n');
    if (lines.length < 2) return [];
    
    const headers = lines[0].split(',').map(h => h.replace(/"/g, '').trim());
    const columnIndex = headers.indexOf(columnName);
    
    if (columnIndex === -1) {
      console.warn(`Column ${columnName} not found in headers:`, headers);
      return [];
    }
    
    const values = [];
    for (let i = 1; i < lines.length; i++) {
      if (!lines[i].trim()) continue;
      
      const row = lines[i].split(',');
      if (row.length > columnIndex && row[columnIndex]) {
        const value = row[columnIndex].replace(/"/g, '').trim();
        if (value && value !== '' && value !== 'null') {
          values.push(value);
        }
      }
    }
    
    return [...new Set(values)].sort();
  } catch (error) {
    console.error('Error parsing CSV:', error);
    return [];
  }
}

export async function POST(request) {
  try {
    const { bucket } = await request.json();
    console.log('📏 Loading measurements for bucket:', bucket);
    
    // Query más simple que evita el problema de tipos
    const query = `
from(bucket: "${bucket}")
  |> range(start: -24h)
  |> keep(columns: ["_measurement"])
  |> distinct(column: "_measurement")
  |> limit(n: 100)`;

    console.log('🔍 Executing query:', query);

    const response = await fetch(`${INFLUX_URL}/api/v2/query?org=${INFLUX_ORG}`, {
      method: 'POST',
      headers: {
        'Authorization': `Token ${INFLUX_TOKEN}`,
        'Content-Type': 'application/vnd.flux',
        'Accept': 'application/csv'
      },
      body: query
    });

    console.log('📡 Response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ InfluxDB error response:', errorText);
      
      // Fallback: usar los measurements del explore que ya funciona
      console.log('🔄 Fallback: usando explore API para obtener measurements...');
      const exploreResponse = await fetch(`${INFLUX_URL}/api/v2/query?org=${INFLUX_ORG}`, {
        method: 'POST',
        headers: {
          'Authorization': `Token ${INFLUX_TOKEN}`,
          'Content-Type': 'application/vnd.flux',
          'Accept': 'application/csv'
        },
        body: `from(bucket: "${bucket}") |> range(start: -1h) |> limit(n: 10)`
      });

      if (exploreResponse.ok) {
        const exploreData = await exploreResponse.text();
        const lines = exploreData.trim().split('\n');
        if (lines.length > 0) {
          const headers = lines[0].split(',').map(h => h.replace(/"/g, '').trim());
          const measurementIndex = headers.indexOf('_measurement');
          const measurements = [];
          
          if (measurementIndex !== -1) {
            for (let i = 1; i < lines.length; i++) {
              if (!lines[i].trim()) continue;
              const row = lines[i].split(',');
              if (row[measurementIndex]) {
                const measurement = row[measurementIndex].replace(/"/g, '').trim();
                if (measurement && !measurements.includes(measurement)) {
                  measurements.push(measurement);
                }
              }
            }
          }
          
          console.log('✅ Fallback measurements loaded:', measurements);
          return NextResponse.json({ measurements });
        }
      }
      
      throw new Error(`HTTP error! status: ${response.status}, details: ${errorText}`);
    }

    const csvData = await response.text();
    console.log('📊 Raw CSV data:', csvData.substring(0, 200) + '...');
    
    const measurements = parseCsvToArray(csvData, '_measurement');
    console.log('✅ Parsed measurements:', measurements);
    
    return NextResponse.json({ measurements });
  } catch (error) {
    console.error('❌ Error fetching measurements:', error);
    
    // Fallback con datos comunes que sabemos que existen
    const fallbackMeasurements = [
      'LAMAJA', 'RETAMAR', 'CPM', 'CT01', 'CT02', 'CT03', 'CT04', 
      'SUBESTACION', 'PVO_Zone', 'modbus', 'influxdb_uptime_seconds'
    ];
    
    console.log('🔄 Using fallback measurements:', fallbackMeasurements);
    return NextResponse.json({ 
      error: error.message,
      measurements: fallbackMeasurements
    });
  }
}