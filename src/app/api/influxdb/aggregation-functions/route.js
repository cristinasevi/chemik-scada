import { NextResponse } from 'next/server';

const INFLUX_URL = process.env.INFLUXDB_URL;
const INFLUX_TOKEN = process.env.INFLUXDB_TOKEN;
const INFLUX_ORG = process.env.INFLUXDB_ORG;

export async function GET() {
  try {
    if (!INFLUX_URL || !INFLUX_TOKEN || !INFLUX_ORG) {
      return NextResponse.json({ 
        functions: getDefaultFunctions(),
        source: 'env_error',
        message: 'Variables de entorno de InfluxDB no configuradas'
      });
    }

    // Verificar conectividad básica
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
      return NextResponse.json({ 
        functions: getDefaultFunctions(),
        source: 'connection_error',
        message: `InfluxDB no responde (status: ${connectResponse.status})`
      });
    }

    let availableFunctions = ['none'];

    // Intentar obtener funciones desde universe
    try {
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
      }
    } catch (universeError) {
      // Universe functions failed
    }

    // Si no obtuvimos suficientes funciones, usar lista predefinida
    if (availableFunctions.length <= 5) {
      const predefinedFunctions = [
        'none', 'mean', 'sum', 'count', 'min', 'max', 'first', 'last',
        'median', 'mode', 'stddev', 'spread', 'derivative', 'difference',
        'integral', 'moving_average', 'cumulative_sum', 'exponential_moving_average'
      ];

      const verifiedFunctions = ['none'];
      
      for (const func of predefinedFunctions.slice(1)) {
        try {
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

          if (testResponse.status !== 400) {
            verifiedFunctions.push(func);
          }
        } catch (testError) {
          continue;
        }
      }

      availableFunctions = verifiedFunctions;
    }

    // Si aún tenemos pocas funciones, agregar las básicas
    if (availableFunctions.length <= 3) {
      const basicFunctions = ['none', 'mean', 'sum', 'count', 'min', 'max', 'first', 'last'];
      availableFunctions = [...new Set([...availableFunctions, ...basicFunctions])];
    }

    return NextResponse.json({ 
      functions: availableFunctions,
      source: availableFunctions.length > 10 ? 'influxdb_universe' : 'predefined_verified',
      message: `${availableFunctions.length} funciones disponibles`,
      total_count: availableFunctions.length
    });

  } catch (error) {
    return NextResponse.json({ 
      functions: getDefaultFunctions(),
      source: 'error_fallback',
      error: error.message,
      message: 'Error de conexión con InfluxDB - usando funciones básicas'
    });
  }
}

function getDefaultFunctions() {
  return ['none', 'mean', 'sum', 'count', 'min', 'max', 'first', 'last'];
}