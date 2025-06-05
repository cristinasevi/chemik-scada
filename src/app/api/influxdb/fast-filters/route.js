import { NextResponse } from 'next/server';

const INFLUX_URL = process.env.INFLUXDB_URL;
const INFLUX_TOKEN = process.env.INFLUXDB_TOKEN;
const INFLUX_ORG = process.env.INFLUXDB_ORG;

export async function POST(request) {
  try {
    const { bucket } = await request.json();
    
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

    } catch (schemaError) {
      // Schema functions failed, continue to sampling strategy
    }

    // ESTRATEGIA 2: Si no obtuvimos suficientes datos, hacer sampling de datos reales
    if (measurements.size === 0 || fieldNames.size === 0 || allFields.size === 0) {
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
              const headers = lines[0].split(',').map(h => h.replace(/"/g, '').trim());
              headers.forEach(header => {
                if (header && header !== '' && header !== 'result' && header !== 'table') {
                  allFields.add(header);
                }
              });

              const measurementIndex = headers.indexOf('_measurement');
              const fieldIndex = headers.indexOf('_field');

              for (let i = 1; i < lines.length && i < 200; i++) {
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

            if (measurements.size > 0 && (fieldNames.size > 0 || allFields.size > 5)) {
              break;
            }
          }
        } catch (samplingError) {
          continue;
        }
      }
    }

    // Organizar campos dinámicamente
    const systemFields = [];
    const tagFields = [];

    const excludedSystemFields = new Set([
      '_start',
      '_stop',
      'table',
      '_result',
      '_table'
    ]);

    Array.from(allFields).forEach(field => {
      if (excludedSystemFields.has(field)) {
        return;
      }

      if (field.startsWith('_')) {
        systemFields.push(field);
      } else if (field && field !== 'result' && field !== 'table') {
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

    return NextResponse.json({
      success: true,
      bucket,
      filters: result,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
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