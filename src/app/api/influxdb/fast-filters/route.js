import { NextResponse } from 'next/server';

const INFLUX_URL = process.env.INFLUXDB_URL;
const INFLUX_TOKEN = process.env.INFLUXDB_TOKEN;
const INFLUX_ORG = process.env.INFLUXDB_ORG;

export async function POST(request) {
  try {
    const { bucket } = await request.json();
    console.log('🚀 Carga MEJORADA de filtros para bucket:', bucket);

    if (!bucket) {
      return NextResponse.json({
        error: 'Bucket requerido',
        filters: { systemFields: [], tagFields: [], fieldNames: [], measurements: [] }
      }, { status: 400 });
    }

    const allFields = new Set();
    const measurements = new Set();
    const fieldNames = new Set();

    // ESTRATEGIA 1: Usar schema functions para obtener información completa
    console.log('📊 Estrategia 1: Usando schema functions...');

    try {
      // Obtener measurements
      const measurementsQuery = `
import "influxdata/influxdb/schema"

schema.measurements(bucket: "${bucket}")
  |> limit(n: 100)
  |> sort()
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
        console.log('📊 Measurements data:', measurementsData);

        const lines = measurementsData.trim().split('\n');
        if (lines.length > 1) {
          const headers = lines[0].split(',').map(h => h.replace(/"/g, '').trim());
          const valueIndex = headers.indexOf('_value');

          if (valueIndex !== -1) {
            for (let i = 1; i < lines.length; i++) {
              if (!lines[i].trim()) continue;
              const row = lines[i].split(',');
              if (row[valueIndex]) {
                const measurement = row[valueIndex].replace(/"/g, '').trim();
                if (measurement && measurement !== 'null') {
                  measurements.add(measurement);
                }
              }
            }
          }
        }
      }

      // Obtener field keys
      const fieldsQuery = `
import "influxdata/influxdb/schema"

schema.fieldKeys(bucket: "${bucket}")
  |> limit(n: 200)
  |> sort()
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
        console.log('📊 Fields data:', fieldsData);

        const lines = fieldsData.trim().split('\n');
        if (lines.length > 1) {
          const headers = lines[0].split(',').map(h => h.replace(/"/g, '').trim());
          const valueIndex = headers.indexOf('_value');

          if (valueIndex !== -1) {
            for (let i = 1; i < lines.length; i++) {
              if (!lines[i].trim()) continue;
              const row = lines[i].split(',');
              if (row[valueIndex]) {
                const field = row[valueIndex].replace(/"/g, '').trim();
                if (field && field !== 'null') {
                  fieldNames.add(field);
                }
              }
            }
          }
        }
      }

      // Obtener tag keys
      const tagKeysQuery = `
import "influxdata/influxdb/schema"

schema.tagKeys(bucket: "${bucket}")
  |> limit(n: 200)
  |> sort()
`;

      const tagKeysResponse = await fetch(`${INFLUX_URL}/api/v2/query?org=${INFLUX_ORG}`, {
        method: 'POST',
        headers: {
          'Authorization': `Token ${INFLUX_TOKEN}`,
          'Content-Type': 'application/vnd.flux',
          'Accept': 'application/csv'
        },
        body: tagKeysQuery
      });

      if (tagKeysResponse.ok) {
        const tagKeysData = await tagKeysResponse.text();
        console.log('📊 Tag keys data:', tagKeysData);

        const lines = tagKeysData.trim().split('\n');
        if (lines.length > 1) {
          const headers = lines[0].split(',').map(h => h.replace(/"/g, '').trim());
          const valueIndex = headers.indexOf('_value');

          if (valueIndex !== -1) {
            for (let i = 1; i < lines.length; i++) {
              if (!lines[i].trim()) continue;
              const row = lines[i].split(',');
              if (row[valueIndex]) {
                const tagKey = row[valueIndex].replace(/"/g, '').trim();
                if (tagKey && tagKey !== 'null') {
                  allFields.add(tagKey);
                }
              }
            }
          }
        }
      }

      console.log('✅ Schema results:', {
        measurements: measurements.size,
        fields: fieldNames.size,
        tags: allFields.size
      });

    } catch (schemaError) {
      console.log('⚠️ Schema functions failed:', schemaError.message);
    }

    // ESTRATEGIA 2: Si no obtuvimos suficientes datos, hacer sampling de datos reales
    if (measurements.size === 0 || fieldNames.size === 0 || allFields.size === 0) {
      console.log('📊 Estrategia 2: Sampling de datos reales...');

      const timeRanges = ['-1h', '-6h', '-24h', '-7d'];

      for (const timeRange of timeRanges) {
        try {
          const samplingQuery = `
from(bucket: "${bucket}")
  |> range(start: ${timeRange})
  |> limit(n: 500)
`;

          const samplingResponse = await fetch(`${INFLUX_URL}/api/v2/query?org=${INFLUX_ORG}`, {
            method: 'POST',
            headers: {
              'Authorization': `Token ${INFLUX_TOKEN}`,
              'Content-Type': 'application/vnd.flux',
              'Accept': 'application/csv'
            },
            body: samplingQuery
          });

          if (samplingResponse.ok) {
            const csvData = await samplingResponse.text();
            const lines = csvData.trim().split('\n');

            if (lines.length > 1) {
              // Extraer headers (todos los campos disponibles)
              const headers = lines[0].split(',').map(h => h.replace(/"/g, '').trim());
              headers.forEach(header => {
                if (header && header !== '' && header !== 'result' && header !== 'table') {
                  allFields.add(header);
                }
              });

              // Extraer measurements y fields de los datos
              const measurementIndex = headers.indexOf('_measurement');
              const fieldIndex = headers.indexOf('_field');

              for (let i = 1; i < lines.length && i < 200; i++) { // Procesar hasta 200 filas
                if (!lines[i].trim()) continue;
                const row = lines[i].split(',');

                if (measurementIndex !== -1 && row[measurementIndex]) {
                  const measurement = row[measurementIndex].replace(/"/g, '').trim();
                  if (measurement && measurement !== 'null') {
                    measurements.add(measurement);
                  }
                }

                if (fieldIndex !== -1 && row[fieldIndex]) {
                  const field = row[fieldIndex].replace(/"/g, '').trim();
                  if (field && field !== 'null') {
                    fieldNames.add(field);
                  }
                }
              }
            }

            console.log(`✅ Sampling ${timeRange} results:`, {
              totalHeaders: headers.length,
              measurementsFound: measurements.size,
              fieldsFound: fieldNames.size,
              tagsFound: allFields.size
            });

            // Si encontramos datos suficientes, salir del loop
            if (measurements.size > 0 && (fieldNames.size > 0 || allFields.size > 5)) {
              break;
            }
          }
        } catch (samplingError) {
          console.log(`⚠️ Sampling error for ${timeRange}:`, samplingError.message);
          continue;
        }
      }
    }

    // Organizar campos dinámicamente
    const systemFields = [];
    const tagFields = [];

    // Lista de campos del sistema que NO queremos mostrar como filtros
    const excludedSystemFields = new Set([
      '_start',        // Tiempo de inicio (ya controlado por Time Range)
      '_stop',         // Tiempo de fin (ya controlado por Time Range)  
      'table',         // Campo interno de tabla
      '_result',       // Variación del campo resultado
      '_table'         // Variación del campo tabla
    ]);

    Array.from(allFields).forEach(field => {
      // Filtrar campos excluidos
      if (excludedSystemFields.has(field)) {
        return; // Skip este campo
      }

      if (field.startsWith('_')) {
        // Es un campo del sistema ÚTIL
        systemFields.push(field);
      } else if (field && field !== 'result' && field !== 'table') {
        // Es un tag personalizado
        tagFields.push(field);
      }
    });

    const result = {
      systemFields: systemFields.sort(),
      tagFields: tagFields.sort(),
      fieldNames: Array.from(fieldNames).sort(),
      measurements: Array.from(measurements).sort(),
      totalFields: allFields.size
    };

    console.log(`✅ RESULTADO FINAL para bucket "${bucket}":`, {
      systemFields: result.systemFields.length,
      tagFields: result.tagFields.length,
      fieldNames: result.fieldNames.length,
      measurements: result.measurements.length,
      totalFields: result.totalFields
    });

    console.log('📋 Datos encontrados:', {
      measurements: result.measurements,
      fields: result.fieldNames,
      systemFields: result.systemFields,
      tagFields: result.tagFields
    });

    return NextResponse.json({
      success: true,
      bucket,
      filters: result,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Error en carga mejorada:', error);

    return NextResponse.json({
      success: false,
      error: error.message,
      filters: {
        systemFields: [],
        tagFields: [],
        fieldNames: [],
        measurements: [],
        totalFields: 0
      },
      timestamp: new Date().toISOString()
    });
  }
}