import { NextResponse } from 'next/server';

const INFLUX_URL = process.env.INFLUXDB_URL;
const INFLUX_TOKEN = process.env.INFLUXDB_TOKEN;
const INFLUX_ORG = process.env.INFLUXDB_ORG;

export async function POST(request) {
  try {
    const { bucket, measurement } = await request.json();
    console.log('🏷️ Loading tag keys for measurement:', measurement);
    
    // Intentar múltiples rangos de tiempo para encontrar datos
    const timeRanges = ['-1h', '-24h', '-7d', '-30d'];
    
    for (const timeRange of timeRanges) {
      console.log(`🔍 Trying time range: ${timeRange}`);
      
      const query = `
from(bucket: "${bucket}")
  |> range(start: ${timeRange})
  |> filter(fn: (r) => r._measurement == "${measurement}")
  |> limit(n: 1)`;

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
        console.log(`📊 Tag keys data for ${timeRange}:`, csvData.substring(0, 200) + '...');
        
        // Parsear headers para obtener tag keys
        const lines = csvData.trim().split('\n');
        if (lines.length > 1) { // Asegurar que hay datos, no solo headers
          const headers = lines[0].split(',').map(h => h.replace(/"/g, '').trim());
          
          // Filtrar solo las columnas que son tags (no campos del sistema)
          const tagKeys = headers.filter(key => 
            !key.startsWith('_') && 
            key !== 'result' && 
            key !== 'table' &&
            key !== 'time' &&
            key !== ''
          );
          
          if (tagKeys.length > 0) {
            console.log(`✅ Tag keys found with ${timeRange}:`, tagKeys);
            return NextResponse.json({ tagKeys });
          }
        }
      } else {
        const errorText = await response.text();
        console.log(`❌ Error with ${timeRange}:`, errorText);
      }
    }
    
    // Si no encontramos nada, devolver tags comunes conocidos
    console.log('🔄 No tag keys found, using common fallbacks');
    const fallbackTags = ['PVO_Plant', 'PVO_Zone', 'PVO_id', 'PVO_type', 'host', 'instance'];
    return NextResponse.json({ tagKeys: fallbackTags });
    
  } catch (error) {
    console.error('❌ Error fetching tag keys:', error);
    return NextResponse.json({ 
      error: error.message,
      tagKeys: ['PVO_Plant', 'PVO_Zone', 'PVO_id']
    });
  }
}