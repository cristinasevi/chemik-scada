import { NextResponse } from 'next/server';

const INFLUX_URL = process.env.INFLUXDB_URL;
const INFLUX_TOKEN = process.env.INFLUXDB_TOKEN;
const INFLUX_ORG = process.env.INFLUXDB_ORG;

export async function POST(request) {
  try {
    const { bucket } = await request.json();
    
    const timeRanges = ['-1h', '-6h', '-24h', '-7d'];
    
    for (const timeRange of timeRanges) {
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
        const lines = csvData.trim().split('\n');
        
        if (lines.length > 1) {
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
          
          const allAvailableFields = headers.filter(h => 
            h && h.trim() !== '' && h !== 'result' && h !== 'table'
          );
          
          return NextResponse.json({ 
            measurements,
            availableTags: allAvailableFields,
            headers: headers,
            sampleData: csvData
          });
        }
      }
    }
    
    return NextResponse.json({ 
      measurements: [],
      availableTags: [],
      headers: [],
      sampleData: ''
    });
    
  } catch (error) {
    console.error('Error exploring bucket:', error);
    return NextResponse.json({ 
      error: error.message,
      measurements: [],
      availableTags: [],
      headers: []
    });
  }
}