import { NextResponse } from 'next/server';

const INFLUX_URL = process.env.INFLUXDB_URL;
const INFLUX_TOKEN = process.env.INFLUXDB_TOKEN;
const INFLUX_ORG = process.env.INFLUXDB_ORG;

function parseCsvToArray(csvData, columnName) {
  try {
    const lines = csvData.trim().split('\n');
    if (lines.length < 2) return [];
    
    const headers = lines[0].split(',').map(h => h.replace(/"/g, '').trim());
    const columnIndex = headers.indexOf(columnName);
    
    if (columnIndex === -1) {
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
    
    const query = `
from(bucket: "${bucket}")
  |> range(start: -24h)
  |> keep(columns: ["_measurement"])
  |> distinct(column: "_measurement")
  |> limit(n: 100)`;

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
      
      // Fallback básico
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
          
          return NextResponse.json({ measurements });
        }
      }
      
      throw new Error(`HTTP error! status: ${response.status}, details: ${errorText}`);
    }

    const csvData = await response.text();
    const measurements = parseCsvToArray(csvData, '_measurement');
    
    return NextResponse.json({ measurements });
  } catch (error) {
    console.error('Error fetching measurements:', error);
    
    return NextResponse.json({ 
      error: error.message,
      measurements: []
    });
  }
}