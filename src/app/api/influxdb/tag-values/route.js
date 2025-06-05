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
    
    const values = new Set(); // Usar Set para evitar duplicados
    for (let i = 1; i < lines.length; i++) {
      if (!lines[i].trim()) continue;
      
      const row = lines[i].split(',');
      if (row.length > columnIndex && row[columnIndex]) {
        const value = row[columnIndex].replace(/"/g, '').trim();
        if (value && value !== '' && value !== 'null' && value !== 'undefined') {
          values.add(value);
        }
      }
    }
    
    return Array.from(values).sort();
  } catch (error) {
    console.error('Error parsing CSV:', error);
    return [];
  }
}

export async function POST(request) {
  try {
    const { bucket, tagKey } = await request.json();
    
    if (!bucket || !tagKey) {
      return NextResponse.json({ 
        error: 'Bucket y tagKey son requeridos',
        values: [] 
      }, { status: 400 });
    }

    // Estrategias múltiples para obtener valores del tag
    const timeRanges = ['-1h', '-6h', '-24h', '-7d', '-30d'];
    let foundValues = new Set();

    for (const timeRange of timeRanges) {
      if (foundValues.size >= 1000) break; // Límite para evitar sobrecarga

      try {        
        // Query para obtener valores únicos del tag
        // CORREGIDO: usar la sintaxis correcta para tags personalizados
        const query = `
from(bucket: "${bucket}")
  |> range(start: ${timeRange})
  |> filter(fn: (r) => exists r["${tagKey}"])
  |> keep(columns: ["${tagKey}"])
  |> distinct(column: "${tagKey}")
  |> limit(n: 1000)
  |> sort(columns: ["${tagKey}"])
`;

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
          
          // Parsear usando el nombre correcto de la columna
          const values = parseCsvToArray(csvData, tagKey);
          
          // Añadir valores únicos al Set
          values.forEach(value => foundValues.add(value));
          
          // Si encontramos suficientes valores, podemos parar
          if (foundValues.size >= 100) {
            break;
          }
        } else {
          const errorText = await response.text();
        }
      } catch (rangeError) {
        continue;
      }
    }

    // Convertir Set a array y ordenar
    let values = Array.from(foundValues);
    
    // Intentar ordenar numéricamente si todos son números
    const allNumbers = values.every(v => !isNaN(parseFloat(v)) && isFinite(v));
    if (allNumbers) {
      values.sort((a, b) => parseFloat(a) - parseFloat(b));
    } else {
      values.sort();
    }
    
    return NextResponse.json({
      success: true,
      tagKey,
      bucket,
      values: values,
      totalFound: values.length,
      isNumeric: allNumbers,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error obteniendo valores de tag:', error);
    
    return NextResponse.json({
      success: false,
      error: error.message,
      values: [],
      tagKey: '',
      bucket: ''
    }, { status: 500 });
  }
}