import { NextResponse } from 'next/server';

const INFLUX_URL = process.env.INFLUXDB_URL;
const INFLUX_TOKEN = process.env.INFLUXDB_TOKEN;
const INFLUX_ORG = process.env.INFLUXDB_ORG;

export async function GET() {
  try {
    console.log('🔍 Obteniendo funciones de agregación mejoradas desde InfluxDB');
    
    // Verificar que tenemos las variables de entorno necesarias
    if (!INFLUX_URL || !INFLUX_TOKEN || !INFLUX_ORG) {
      console.error('❌ Variables de entorno de InfluxDB no configuradas');
      return NextResponse.json({ 
        functions: getDefaultFunctions(),
        source: 'env_error',
        message: 'Variables de entorno de InfluxDB no configuradas'
      });
    }

    // Primero, verificar conectividad básica con InfluxDB
    console.log('🔗 Verificando conectividad con InfluxDB...');
    
    const connectivityQuery = `
from(bucket: "PV")
  |> range(start: -1m)
  |> limit(n: 1)`;

    const connectResponse = await fetch(`${INFLUX_URL}/api/v2/query?org=${INFLUX_ORG}`, {
      method: 'POST',
      headers: {
        'Authorization': `Token ${INFLUX_TOKEN}`,
        'Content-Type': 'application/vnd.flux',
        'Accept': 'application/csv'
      },
      body: connectivityQuery
    });

    if (!connectResponse.ok) {
      console.error('❌ InfluxDB no responde:', connectResponse.status);
      return NextResponse.json({ 
        functions: getDefaultFunctions(),
        source: 'connection_error',
        message: `InfluxDB no responde (status: ${connectResponse.status})`
      });
    }

    console.log('✅ InfluxDB responde correctamente');

    // ESTRATEGIA 1: Intentar obtener funciones desde universe
    let availableFunctions = ['none']; // Siempre incluir 'none'

    try {
      console.log('🔍 Estrategia 1: Obteniendo funciones desde universe...');
      
      const universeQuery = `
import "universe"

universe.functions()
  |> filter(fn: (r) => r.category == "aggregates" or r.category == "transformations")
  |> keep(columns: ["name"])
  |> distinct(column: "name")
  |> limit(n: 100)
  |> sort(columns: ["name"])`;

      const universeResponse = await fetch(`${INFLUX_URL}/api/v2/query?org=${INFLUX_ORG}`, {
        method: 'POST',
        headers: {
          'Authorization': `Token ${INFLUX_TOKEN}`,
          'Content-Type': 'application/vnd.flux',
          'Accept': 'application/csv'
        },
        body: universeQuery
      });

      if (universeResponse.ok) {
        const csvData = await universeResponse.text();
        console.log('📊 Universe functions response:', csvData.substring(0, 300) + '...');
        
        const lines = csvData.trim().split('\n');
        if (lines.length > 1) {
          const headers = lines[0].split(',').map(h => h.replace(/"/g, '').trim());
          const nameIndex = headers.indexOf('_value') !== -1 ? headers.indexOf('_value') : 
                           headers.indexOf('name') !== -1 ? headers.indexOf('name') : 0;
          
          if (nameIndex !== -1) {
            for (let i = 1; i < lines.length; i++) {
              if (!lines[i].trim()) continue;
              const row = lines[i].split(',');
              if (row[nameIndex]) {
                const funcName = row[nameIndex].replace(/"/g, '').trim();
                if (funcName && funcName !== '' && funcName !== 'null') {
                  availableFunctions.push(funcName);
                }
              }
            }
          }
        }

        console.log('✅ Universe functions encontradas:', availableFunctions.length);
      } else {
        console.warn('⚠️ Universe functions falló, intentando estrategia 2...');
      }

    } catch (universeError) {
      console.error('❌ Error con universe functions:', universeError.message);
    }

    // ESTRATEGIA 2: Si no obtuvimos suficientes funciones, usar lista predefinida mejorada
    if (availableFunctions.length <= 5) {
      console.log('🔄 Estrategia 2: Usando lista predefinida mejorada...');
      
      const predefinedFunctions = [
        'none',
        'mean',
        'sum',
        'count',
        'min',
        'max',
        'first',
        'last',
        'median',
        'mode',
        'stddev',
        'spread',
        'derivative',
        'difference',
        'integral',
        'moving_average',
        'cumulative_sum',
        'exponential_moving_average'
      ];

      // Verificar qué funciones están realmente disponibles
      const verifiedFunctions = ['none']; // none siempre disponible
      
      for (const func of predefinedFunctions.slice(1)) { // skip 'none'
        try {
          // Test query simple para verificar si la función existe
          const testQuery = `
from(bucket: "PV")
  |> range(start: -1h)
  |> limit(n: 1)
  |> aggregateWindow(every: 1h, fn: ${func}, createEmpty: false)
  |> limit(n: 1)`;

          const testResponse = await fetch(`${INFLUX_URL}/api/v2/query?org=${INFLUX_ORG}`, {
            method: 'POST',
            headers: {
              'Authorization': `Token ${INFLUX_TOKEN}`,
              'Content-Type': 'application/vnd.flux',
              'Accept': 'application/csv'
            },
            body: testQuery
          });

          // Si no da error de sintaxis, la función existe
          if (testResponse.status !== 400) {
            verifiedFunctions.push(func);
          }
        } catch (testError) {
          // Función no disponible o error de sintaxis
          continue;
        }
      }

      availableFunctions = verifiedFunctions;
      console.log('✅ Funciones verificadas:', availableFunctions);
    }

    // ESTRATEGIA 3: Si aún tenemos pocas funciones, agregar las más comunes sin verificar
    if (availableFunctions.length <= 3) {
      console.log('🔄 Estrategia 3: Agregando funciones básicas...');
      
      const basicFunctions = [
        'none',
        'mean',
        'sum',
        'count',
        'min',
        'max',
        'first',
        'last'
      ];

      availableFunctions = [...new Set([...availableFunctions, ...basicFunctions])];
    }

    console.log('✅ Funciones finales disponibles:', availableFunctions);

    return NextResponse.json({ 
      functions: availableFunctions,
      source: availableFunctions.length > 10 ? 'influxdb_universe' : 'predefined_verified',
      message: `${availableFunctions.length} funciones disponibles`,
      total_count: availableFunctions.length
    });

  } catch (error) {
    console.error('❌ Error general:', error);
    
    return NextResponse.json({ 
      functions: getDefaultFunctions(),
      source: 'error_fallback',
      error: error.message,
      message: 'Error de conexión con InfluxDB - usando funciones básicas'
    });
  }
}

// Funciones por defecto como último recurso
function getDefaultFunctions() {
  return [
    'none',
    'mean',
    'sum',
    'count',
    'min',
    'max',
    'first',
    'last'
  ];
}