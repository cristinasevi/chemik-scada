import { NextResponse } from 'next/server';

const INFLUX_URL = process.env.INFLUXDB_URL || 'http://213.4.39.163:8086';
const INFLUX_TOKEN = process.env.INFLUXDB_TOKEN || '0sGVviGogcFRVmIfvpRbc4VBG8vKU_hYRepoGThTUejr5XgE1pgy2H73-zJqqwwK0Ak2JF34Yq9J41PqtrebBw==';
const INFLUX_ORG = process.env.INFLUXDB_ORG || '53e3d55b34f76d1a';

export async function POST(request) {
  try {
    const { bucket } = await request.json();
    console.log('🔍 Exploring bucket:', bucket);
    
    // Query simple para obtener una muestra de datos
    const query = `
from(bucket: "${bucket}")
  |> range(start: -1h)
  |> limit(n: 5)`;

    const response = await fetch(`${INFLUX_URL}/api/v2/query?org=${INFLUX_ORG}`, {
      method: 'POST',
      headers: {
        'Authorization': `Token ${INFLUX_TOKEN}`,
        'Content-Type': 'application/vnd.flux',
        'Accept': 'application/csv'
      },
      body: query
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ InfluxDB explore error:', errorText);
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const csvData = await response.text();
    console.log('📊 Sample data received:', csvData.substring(0, 300) + '...');
    
    // Parsear headers para obtener todas las columnas disponibles
    const lines = csvData.trim().split('\n');
    if (lines.length > 0) {
      const headers = lines[0].split(',').map(h => h.replace(/"/g, '').trim());
      console.log('📋 Headers found:', headers);
      
      // Obtener measurements únicos
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
      
      // Filtrar tags (columnas que no son del sistema)
      const availableTags = headers.filter(h => 
        !h.startsWith('_') && 
        h !== 'result' && 
        h !== 'table' &&
        h !== 'time'
      );
      
      console.log('✅ Found measurements:', measurements);
      console.log('✅ Found tags:', availableTags);
      
      return NextResponse.json({ 
        measurements,
        availableTags,
        sampleData: csvData,
        headers
      });
    }
    
    return NextResponse.json({ 
      measurements: [],
      availableTags: [],
      sampleData: '',
      headers: []
    });
    
  } catch (error) {
    console.error('❌ Error exploring bucket:', error);
    return NextResponse.json({ 
      error: error.message,
      measurements: [],
      availableTags: []
    });
  }
}