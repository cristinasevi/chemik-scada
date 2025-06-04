import { NextResponse } from 'next/server';

const INFLUX_URL = process.env.INFLUXDB_URL;
const INFLUX_TOKEN = process.env.INFLUXDB_TOKEN;
const INFLUX_ORG = process.env.INFLUXDB_ORG;

export async function POST(request) {
  try {
    const { bucket } = await request.json();
    console.log('🔍 Obteniendo TODOS los filtros disponibles para bucket:', bucket);
    
    if (!bucket) {
      return NextResponse.json({ 
        error: 'Bucket requerido',
        filters: []
      }, { status: 400 });
    }

    // Estrategia múltiple para obtener todos los campos posibles
    const timeRanges = ['-1h', '-6h', '-24h', '-7d', '-30d'];
    let allFields = new Set();
    let measurements = new Set();
    let fieldsByMeasurement = new Map();

    for (const timeRange of timeRanges) {
      console.log(`🔍 Explorando rango: ${timeRange}`);
      
      try {
        // 1. Obtener schema completo usando keys() function
        const schemaQuery = `
            import "influxdata/influxdb/schema"

            schema.tagKeys(bucket: "${bucket}")
            |> limit(n: 1000)
            `;

        const schemaResponse = await fetch(`${INFLUX_URL}/api/v2/query?org=${INFLUX_ORG}`, {
          method: 'POST',
          headers: {
            'Authorization': `Token ${INFLUX_TOKEN}`,
            'Content-Type': 'application/vnd.flux',
            'Accept': 'application/csv'
          },
          body: schemaQuery
        });

        if (schemaResponse.ok) {
          const schemaData = await schemaResponse.text();
          console.log(`📊 Schema data (${timeRange}):`, schemaData.substring(0, 200));
          
          // Procesar tags del schema
          const schemaLines = schemaData.trim().split('\n');
          if (schemaLines.length > 1) {
            const headers = schemaLines[0].split(',').map(h => h.replace(/"/g, '').trim());
            const valueIndex = headers.indexOf('_value');
            
            if (valueIndex !== -1) {
              for (let i = 1; i < schemaLines.length; i++) {
                if (!schemaLines[i].trim()) continue;
                const row = schemaLines[i].split(',');
                if (row[valueIndex]) {
                  const tagKey = row[valueIndex].replace(/"/g, '').trim();
                  if (tagKey && tagKey !== '' && tagKey !== 'null') {
                    allFields.add(tagKey);
                  }
                }
              }
            }
          }
        }

        // 2. Obtener fields usando fieldKeys()
        const fieldsQuery = `
            import "influxdata/influxdb/schema"

            schema.fieldKeys(bucket: "${bucket}")
            |> limit(n: 1000)
            `;

        const fieldsResponse = await fetch(`${INFLUX_URL}/api/v2/query?org=${INFLUX_ORG}`, {
          method: 'POST',
          headers: {
            'Authorization': `Token ${INFLUX_TOKEN}`,
            'Content-Type': 'application/vnd.flux',
            'Accept': 'application/csv'
          },
          body: fieldsQuery
        });

        if (fieldsResponse.ok) {
          const fieldsData = await fieldsResponse.text();
          console.log(`📊 Fields data (${timeRange}):`, fieldsData.substring(0, 200));
          
          // Procesar field keys
          const fieldsLines = fieldsData.trim().split('\n');
          if (fieldsLines.length > 1) {
            const headers = fieldsLines[0].split(',').map(h => h.replace(/"/g, '').trim());
            const valueIndex = headers.indexOf('_value');
            
            if (valueIndex !== -1) {
              for (let i = 1; i < fieldsLines.length; i++) {
                if (!fieldsLines[i].trim()) continue;
                const row = fieldsLines[i].split(',');
                if (row[valueIndex]) {
                  const fieldKey = row[valueIndex].replace(/"/g, '').trim();
                  if (fieldKey && fieldKey !== '' && fieldKey !== 'null') {
                    allFields.add(`_field:${fieldKey}`); // Prefix para distinguir
                  }
                }
              }
            }
          }
        }

        // 3. Explorar datos reales para obtener todos los headers
        const dataQuery = `
            from(bucket: "${bucket}")
            |> range(start: ${timeRange})
            |> limit(n: 50)
            `;

        const dataResponse = await fetch(`${INFLUX_URL}/api/v2/query?org=${INFLUX_ORG}`, {
          method: 'POST',
          headers: {
            'Authorization': `Token ${INFLUX_TOKEN}`,
            'Content-Type': 'application/vnd.flux',
            'Accept': 'application/csv'
          },
          body: dataQuery
        });

        if (dataResponse.ok) {
          const csvData = await dataResponse.text();
          const lines = csvData.trim().split('\n');
          
          if (lines.length > 1) {
            // Obtener todos los headers
            const headers = lines[0].split(',').map(h => h.replace(/"/g, '').trim());
            headers.forEach(header => {
              if (header && header !== '' && header !== 'result' && header !== 'table') {
                allFields.add(header);
              }
            });

            // Obtener measurements únicos
            const measurementIndex = headers.indexOf('_measurement');
            if (measurementIndex !== -1) {
              for (let i = 1; i < lines.length; i++) {
                if (!lines[i].trim()) continue;
                const row = lines[i].split(',');
                if (row[measurementIndex]) {
                  const measurement = row[measurementIndex].replace(/"/g, '').trim();
                  if (measurement && measurement !== '' && measurement !== 'null') {
                    measurements.add(measurement);
                  }
                }
              }
            }
          }
        }

        // Si encontramos suficientes campos, podemos parar
        if (allFields.size > 20) {
          console.log(`✅ Suficientes campos encontrados (${allFields.size}) en ${timeRange}`);
          break;
        }

      } catch (rangeError) {
        console.log(`⚠️ Error en rango ${timeRange}:`, rangeError.message);
        continue;
      }
    }

    // 4. Obtener measurements específicos si no los tenemos
    if (measurements.size === 0) {
      try {
        const measurementsQuery = `
            import "influxdata/influxdb/schema"

            schema.measurements(bucket: "${bucket}")
            |> limit(n: 100)
            `;

        const measurementsResponse = await fetch(`${INFLUX_URL}/api/v2/query?org=${INFLUX_ORG}`, {
          method: 'POST',
          headers: {
            'Authorization': `Token ${INFLUX_TOKEN}`,
            'Content-Type': 'application/vnd.flux',
            'Accept': 'application/csv'
          },
          body: measurementsQuery
        });

        if (measurementsResponse.ok) {
          const measurementsData = await measurementsResponse.text();
          const measurementsLines = measurementsData.trim().split('\n');
          
          if (measurementsLines.length > 1) {
            const headers = measurementsLines[0].split(',').map(h => h.replace(/"/g, '').trim());
            const valueIndex = headers.indexOf('_value');
            
            if (valueIndex !== -1) {
              for (let i = 1; i < measurementsLines.length; i++) {
                if (!measurementsLines[i].trim()) continue;
                const row = measurementsLines[i].split(',');
                if (row[valueIndex]) {
                  const measurement = row[valueIndex].replace(/"/g, '').trim();
                  if (measurement && measurement !== '' && measurement !== 'null') {
                    measurements.add(measurement);
                  }
                }
              }
            }
          }
        }
      } catch (error) {
        console.log('⚠️ Error obteniendo measurements:', error.message);
      }
    }

    // Organizar filtros por categorías
    const systemFields = ['_measurement', '_field', '_time', '_value', '_start', '_stop'];
    const tagFields = [];
    const fieldNames = [];
    const customFields = [];

    Array.from(allFields).forEach(field => {
      if (systemFields.includes(field)) {
        // Ya están en systemFields
      } else if (field.startsWith('_field:')) {
        fieldNames.push(field.replace('_field:', ''));
      } else if (field.startsWith('_') && !systemFields.includes(field)) {
        // Campos del sistema no incluidos arriba
        systemFields.push(field);
      } else {
        // Tags personalizados
        tagFields.push(field);
      }
    });

    // Resultado final organizado
    const result = {
      systemFields: systemFields.sort(),
      tagFields: tagFields.sort(),
      fieldNames: fieldNames.sort(),
      measurements: Array.from(measurements).sort(),
      totalFields: allFields.size,
      summary: {
        systemFields: systemFields.length,
        tagFields: tagFields.length,
        fieldNames: fieldNames.length,
        measurements: measurements.size
      }
    };

    console.log('✅ Filtros encontrados:', result.summary);
    
    return NextResponse.json({
      success: true,
      bucket,
      filters: result,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Error obteniendo filtros:', error);
    
    // Fallback con campos básicos conocidos
    return NextResponse.json({
      success: false,
      error: error.message,
      filters: {
        systemFields: ['_measurement', '_field', '_time', '_value'],
        tagFields: ['PVO_Plant', 'PVO_Zone', 'PVO_id', 'PVO_type', 'host', 'instance'],
        fieldNames: ['P', 'Q', 'RadPOA01', 'DispoElec', 'DispoMec', 'EPV', 'H_PoA'],
        measurements: ['LAMAJA', 'RETAMAR', 'modbus'],
        totalFields: 15,
        summary: {
          systemFields: 4,
          tagFields: 6,
          fieldNames: 7,
          measurements: 3
        }
      },
      timestamp: new Date().toISOString()
    });
  }
}