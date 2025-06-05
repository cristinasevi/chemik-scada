import { NextResponse } from 'next/server';

const INFLUX_URL = process.env.INFLUXDB_URL;
const INFLUX_TOKEN = process.env.INFLUXDB_TOKEN;
const INFLUX_ORG = process.env.INFLUXDB_ORG;

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
    const { bucket, measurement, tagKey } = await request.json();
    console.log('🎯 Loading tag values for:', { measurement, tagKey });
    
    // Intentar múltiples rangos de tiempo y estrategias
    const strategies = [
      { range: '-1h', limit: 100 },
      { range: '-24h', limit: 200 },
      { range: '-7d', limit: 500 },
      { range: '-30d', limit: 1000 }
    ];
    
    for (const strategy of strategies) {
      console.log(`🔍 Trying strategy: ${strategy.range} with limit ${strategy.limit}`);
      
      const query = `
from(bucket: "${bucket}")
  |> range(start: ${strategy.range})
  |> filter(fn: (r) => r._measurement == "${measurement}")
  |> filter(fn: (r) => exists r.${tagKey})
  |> keep(columns: ["${tagKey}"])
  |> distinct(column: "${tagKey}")
  |> limit(n: ${strategy.limit})`;

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
        console.log(`📊 Tag values data for ${strategy.range}:`, csvData.substring(0, 200) + '...');
        
        let values = parseCsvToArray(csvData, tagKey);
        
        // Filtrar valores vacíos o null
        values = values.filter(value => 
          value && 
          value !== '' && 
          value !== 'null' && 
          value !== 'undefined' &&
          value.trim() !== ''
        );
        
        if (values.length > 0) {
          console.log(`✅ Tag values found with ${strategy.range}:`, values);
          return NextResponse.json({ values });
        }
      } else {
        const errorText = await response.text();
        console.log(`❌ Error with ${strategy.range}:`, errorText);
      }
    }
    
    // SI NO SE ENCUENTRAN VALORES, devolver array vacío - NO HARDCODEAR
    console.log('🔄 No values found in any time range, returning empty array');
    return NextResponse.json({ values: [] });
    
  } catch (error) {
    console.error('❌ Error fetching tag values:', error);
    return NextResponse.json({ 
      error: error.message,
      values: [] // VACÍO, no hardcodeado
    });
  }
}