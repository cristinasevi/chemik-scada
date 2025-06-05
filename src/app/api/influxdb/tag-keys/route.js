import { NextResponse } from 'next/server';

const INFLUX_URL = process.env.INFLUXDB_URL;
const INFLUX_TOKEN = process.env.INFLUXDB_TOKEN;
const INFLUX_ORG = process.env.INFLUXDB_ORG;

export async function POST(request) {
  try {
    const { bucket, measurement } = await request.json();
    console.log('🏷️ Loading ALL tag keys for bucket:', bucket, 'measurement:', measurement);
    
    // Intentar múltiples rangos de tiempo para encontrar datos
    const timeRanges = ['-1h', '-24h', '-7d', '-30d'];
    
    for (const timeRange of timeRanges) {
      console.log(`🔍 Trying time range: ${timeRange}`);
      
      let query;
      if (measurement) {
        // Si tenemos measurement específico, filtrar por él
        query = `
from(bucket: "${bucket}")
  |> range(start: ${timeRange})
  |> filter(fn: (r) => r._measurement == "${measurement}")
  |> limit(n: 1)`;
      } else {
        // Si no hay measurement, obtener datos generales del bucket
        query = `
from(bucket: "${bucket}")
  |> range(start: ${timeRange})
  |> limit(n: 1)`;
      }

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
        
        // Parsear headers para obtener TODOS los tag keys
        const lines = csvData.trim().split('\n');
        if (lines.length > 1) { // Asegurar que hay datos, no solo headers
          const headers = lines[0].split(',').map(h => h.replace(/"/g, '').trim());
          
          // EXTRAER TODOS los campos que podrían ser útiles como filtros
          const allPossibleFilters = headers.filter(key => {
            // Solo excluir campos internos que realmente no sirven
            const excludeFields = ['result', 'table', ''];
            
            if (excludeFields.includes(key)) return false;
            if (!key || key.trim() === '') return false;
            
            // INCLUIR TODO LO DEMÁS, incluso campos que empiecen por _
            return true;
          });
          
          if (allPossibleFilters.length > 0) {
            console.log(`✅ ALL tag keys found with ${timeRange}:`, allPossibleFilters);
            return NextResponse.json({ tagKeys: allPossibleFilters });
          }
        }
      } else {
        const errorText = await response.text();
        console.log(`❌ Error with ${timeRange}:`, errorText);
      }
    }
    
    // SI NO ENCONTRAMOS NADA, devolver array vacío - NO HARDCODEAR
    console.log('🔄 No tag keys found in any time range, returning empty array');
    return NextResponse.json({ tagKeys: [] });
    
  } catch (error) {
    console.error('❌ Error fetching tag keys:', error);
    return NextResponse.json({ 
      error: error.message,
      tagKeys: [] // VACÍO, no hardcodeado
    });
  }
}