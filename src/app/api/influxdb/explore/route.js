import { NextResponse } from 'next/server';

const INFLUX_URL = process.env.INFLUXDB_URL;
const INFLUX_TOKEN = process.env.INFLUXDB_TOKEN;
const INFLUX_ORG = process.env.INFLUXDB_ORG;

export async function POST(request) {
  try {
    const { bucket } = await request.json();
    console.log('🔍 Exploring ALL data in bucket:', bucket);
    
    // Intentar múltiples rangos de tiempo para obtener una muestra representativa
    const timeRanges = ['-1h', '-6h', '-24h', '-7d'];
    
    for (const timeRange of timeRanges) {
      console.log(`🔍 Trying time range: ${timeRange}`);
      
      // Query más amplia para obtener datos de ejemplo del bucket
      const query = `
from(bucket: "${bucket}")
  |> range(start: ${timeRange})
  |> limit(n: 10)`;

      const response = await fetch(`${INFLUX_URL}/api/v2/query?org=${INFLUX_ORG}`, {
        method: 'POST',
        headers: {
          'Authorization': `Token ${INFLUX_TOKEN}`,
          'Content-Type': 'application/vnd.flux',
          'Accept': 'application/csv'
        },
        body: query
      });

      if (response.ok) {
        const csvData = await response.text();
        console.log('📊 Sample data received:', csvData.substring(0, 300) + '...');
        
        // Parsear headers para obtener TODAS las columnas disponibles
        const lines = csvData.trim().split('\n');
        if (lines.length > 1) { // Asegurar que hay datos, no solo headers
          const headers = lines[0].split(',').map(h => h.replace(/"/g, '').trim());
          console.log('📋 ALL Headers found:', headers);
          
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
          
          // NO filtrar tags - devolver TODOS los headers como posibles filtros
          const allAvailableFields = headers.filter(h => 
            h && h.trim() !== '' && h !== 'result' && h !== 'table'
          );
          
          console.log('✅ Found measurements:', measurements);
          console.log('✅ ALL available fields/tags:', allAvailableFields);
          
          return NextResponse.json({ 
            measurements,
            availableTags: allAvailableFields, // Todos los campos disponibles
            headers: headers, // Headers completos para referencia
            sampleData: csvData
          });
        }
      } else {
        const errorText = await response.text();
        console.log(`❌ Error with ${timeRange}:`, errorText);
      }
    }
    
    // SI NO ENCONTRAMOS DATOS, devolver estructura vacía - NO HARDCODEAR
    console.log('🔄 No data found in bucket, returning empty structure');
    return NextResponse.json({ 
      measurements: [],
      availableTags: [], // VACÍO, no hardcodeado
      headers: [],
      sampleData: ''
    });
    
  } catch (error) {
    console.error('❌ Error exploring bucket:', error);
    return NextResponse.json({ 
      error: error.message,
      measurements: [],
      availableTags: [], // VACÍO, no hardcodeado
      headers: []
    });
  }
}