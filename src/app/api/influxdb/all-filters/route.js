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
        filters: []
      }, { status: 400 });
    }

    const timeRanges = ['-1h', '-6h', '-24h', '-7d', '-30d'];
    let allFields = new Set();
    let measurements = new Set();
    let fieldNames = new Set();

    for (const timeRange of timeRanges) {
      try {
        // Schema tags
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

        // Field keys
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
                    fieldNames.add(fieldKey);
                    allFields.add(`_field:${fieldKey}`);
                  }
                }
              }
            }
          }
        }

        // Data exploration
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
            const headers = lines[0].split(',').map(h => h.replace(/"/g, '').trim());
            headers.forEach(header => {
              if (header && header !== '' && header !== 'result' && header !== 'table') {
                allFields.add(header);
              }
            });

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

        if (allFields.size > 20) {
          break;
        }

      } catch (rangeError) {
        continue;
      }
    }

    // Get measurements if empty
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
        // Silent fail
      }
    }

    // Organize filters dynamically
    const systemFields = [];
    const tagFields = [];
    const processedFieldNames = [];

    Array.from(allFields).forEach(field => {
      if (field.startsWith('_field:')) {
        processedFieldNames.push(field.replace('_field:', ''));
      } else if (field.startsWith('_')) {
        systemFields.push(field);
      } else if (field && field !== 'result' && field !== 'table') {
        tagFields.push(field);
      }
    });

    Array.from(fieldNames).forEach(field => {
      if (!processedFieldNames.includes(field)) {
        processedFieldNames.push(field);
      }
    });

    const result = {
      systemFields: systemFields.sort(),
      tagFields: tagFields.sort(),
      fieldNames: processedFieldNames.sort(),
      measurements: Array.from(measurements).sort(),
      totalFields: allFields.size,
      summary: {
        systemFields: systemFields.length,
        tagFields: tagFields.length,
        fieldNames: processedFieldNames.length,
        measurements: measurements.size
      }
    };
    
    return NextResponse.json({
      success: true,
      bucket,
      filters: result,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error obteniendo filtros:', error);
    
    return NextResponse.json({
      success: false,
      error: error.message,
      filters: {
        systemFields: [],
        tagFields: [],
        fieldNames: [],
        measurements: [],
        totalFields: 0,
        summary: {
          systemFields: 0,
          tagFields: 0,
          fieldNames: 0,
          measurements: 0
        }
      },
      timestamp: new Date().toISOString()
    });
  }
}