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
      // Si no encontramos la columna exacta, buscar por _value (para casos especiales)
      const valueIndex = headers.indexOf('_value');
      if (valueIndex !== -1) {
        console.log(`Using _value column instead of ${columnName}`);
        return parseCsvToArray(csvData, '_value');
      }
      console.warn(`Column ${columnName} not found in headers:`, headers);
      return [];
    }
    
    const values = new Set();
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
    const { bucket, fieldName, timeRange = '-24h', maxValues = 500 } = await request.json();
    console.log('🎯 Obteniendo valores únicos para field:', { bucket, fieldName, timeRange });
    
    if (!bucket || !fieldName) {
      return NextResponse.json({ 
        error: 'Bucket y fieldName son requeridos',
        values: [] 
      }, { status: 400 });
    }

    // Estrategias múltiples para obtener valores
    const timeRanges = [timeRange, '-1h', '-6h', '-24h', '-7d', '-30d'];
    let foundValues = new Set();

    for (const range of timeRanges) {
      if (foundValues.size >= maxValues) break;

      try {
        console.log(`🔍 Intentando rango: ${range} para field: ${fieldName}`);
        
        let query;
        
        // Diferentes estrategias según el tipo de campo
        if (fieldName === '_measurement') {
          // Para measurements, usar schema.measurements()
          query = `
import "influxdata/influxdb/schema"

schema.measurements(bucket: "${bucket}")
  |> limit(n: ${maxValues})
  |> sort()
`;
        } else if (fieldName === '_field') {
          // Para field names, usar schema.fieldKeys()
          query = `
import "influxdata/influxdb/schema"

schema.fieldKeys(bucket: "${bucket}")
  |> limit(n: ${maxValues})
  |> sort()
`;
        } else if (fieldName.startsWith('_')) {
          // Para campos del sistema, hacer query directa
          query = `
from(bucket: "${bucket}")
  |> range(start: ${range})
  |> filter(fn: (r) => exists r["${fieldName}"])
  |> keep(columns: ["${fieldName}"])
  |> distinct(column: "${fieldName}")
  |> limit(n: ${maxValues})
  |> sort(columns: ["${fieldName}"])
`;
        } else {
          // Para tags personalizados, usar schema.tagValues()
          query = `
import "influxdata/influxdb/schema"

schema.tagValues(bucket: "${bucket}", tag: "${fieldName}")
  |> limit(n: ${maxValues})
  |> sort()
`;
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
          console.log(`📊 Valores encontrados en ${range}:`, csvData.substring(0, 200));
          
          const lines = csvData.trim().split('\n');
          if (lines.length > 1) {
            const headers = lines[0].split(',').map(h => h.replace(/"/g, '').trim());
            
            // Buscar la columna correcta (puede ser _value o el nombre del campo)
            let columnName = '_value';
            if (headers.includes(fieldName)) {
              columnName = fieldName;
            }
            
            const values = parseCsvToArray(csvData, columnName);
            
            console.log(`📊 ${values.length} valores únicos encontrados para ${fieldName} en ${range}`);
            
            // Añadir valores únicos
            values.forEach(value => {
              if (value && value.trim()) {
                foundValues.add(value.trim());
              }
            });
          }
        } else {
          const errorText = await response.text();
          console.log(`❌ Error con ${range}:`, errorText);
        }
      } catch (rangeError) {
        console.log(`⚠️ Error en rango ${range}:`, rangeError.message);
        continue;
      }
    }

    // Convertir a array y ordenar
    let values = Array.from(foundValues);
    
    // Intentar ordenar numéricamente si todos son números
    const allNumbers = values.every(v => !isNaN(parseFloat(v)) && isFinite(v));
    if (allNumbers) {
      values.sort((a, b) => parseFloat(a) - parseFloat(b));
    } else {
      values.sort();
    }

    // Limitar resultados
    values = values.slice(0, maxValues);

    console.log(`✅ Valores finales encontrados para ${fieldName}:`, {
      total: values.length,
      sample: values.slice(0, 10),
      isNumeric: allNumbers
    });
    
    return NextResponse.json({
      success: true,
      fieldName,
      bucket,
      values: values,
      totalFound: values.length,
      isNumeric: allNumbers,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Error obteniendo valores de field:', error);
    
    return NextResponse.json({
      success: false,
      error: error.message,
      values: [],
      fieldName: '',
      bucket: ''
    }, { status: 500 });
  }
}