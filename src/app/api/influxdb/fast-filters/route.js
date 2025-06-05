import { NextResponse } from 'next/server';

const INFLUX_URL = process.env.INFLUXDB_URL;
const INFLUX_TOKEN = process.env.INFLUXDB_TOKEN;
const INFLUX_ORG = process.env.INFLUXDB_ORG;

export async function POST(request) {
  try {
    const { bucket } = await request.json();
    console.log('🚀 Carga rápida de filtros para bucket:', bucket);
    
    if (!bucket) {
      return NextResponse.json({ 
        error: 'Bucket requerido',
        filters: { systemFields: [], tagFields: [], fieldNames: [], measurements: [] }
      }, { status: 400 });
    }

    const allFields = new Set();
    const measurements = new Set();
    const fieldNames = new Set();

    // ESTRATEGIA SIMPLE Y RÁPIDA: Solo una query con datos recientes
    console.log('📊 Obteniendo muestra de datos recientes...');
    
    const quickQuery = `
      from(bucket: "${bucket}")
      |> range(start: -1h)
      |> limit(n: 100)
    `;

    const response = await fetch(`${INFLUX_URL}/api/v2/query?org=${INFLUX_ORG}`, {
      method: 'POST',
      headers: {
        'Authorization': `Token ${INFLUX_TOKEN}`,
        'Content-Type': 'application/vnd.flux',
        'Accept': 'application/csv'
      },
      body: quickQuery
    });

    if (response.ok) {
      const csvData = await response.text();
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

        for (let i = 1; i < lines.length && i < 50; i++) { // Solo procesar primeras 50 filas
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
    }

    // Si no hay datos recientes, intentar con 24h
    if (allFields.size < 5) {
      console.log('📊 Intentando con datos de 24h...');
      
      const fallbackQuery = `
        from(bucket: "${bucket}")
        |> range(start: -24h)
        |> limit(n: 50)
      `;

      const fallbackResponse = await fetch(`${INFLUX_URL}/api/v2/query?org=${INFLUX_ORG}`, {
        method: 'POST',
        headers: {
          'Authorization': `Token ${INFLUX_TOKEN}`,
          'Content-Type': 'application/vnd.flux',
          'Accept': 'application/csv'
        },
        body: fallbackQuery
      });

      if (fallbackResponse.ok) {
        const fallbackCsvData = await fallbackResponse.text();
        const fallbackLines = fallbackCsvData.trim().split('\n');
        
        if (fallbackLines.length > 1) {
          const fallbackHeaders = fallbackLines[0].split(',').map(h => h.replace(/"/g, '').trim());
          fallbackHeaders.forEach(header => {
            if (header && header !== '' && header !== 'result' && header !== 'table') {
              allFields.add(header);
            }
          });
        }
      }
    }

    // Organizar campos dinámicamente - NO asumir nada
    const systemFields = [];
    const tagFields = [];

    Array.from(allFields).forEach(field => {
      if (field.startsWith('_')) {
        // Campos que empiezan con _ son del sistema (solo si realmente existen en los datos)
        systemFields.push(field);
      } else if (field && field !== 'result' && field !== 'table') {
        // Campos que no empiezan con _ son tags personalizados
        tagFields.push(field);
      }
    });

    const result = {
      systemFields: systemFields,
      tagFields: tagFields.sort(),
      fieldNames: Array.from(fieldNames).sort(),
      measurements: Array.from(measurements).sort(),
      totalFields: allFields.size
    };

    console.log(`✅ Filtros cargados rápidamente: ${result.totalFields} campos, ${result.measurements.length} measurements`);
    
    return NextResponse.json({
      success: true,
      bucket,
      filters: result,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Error en carga rápida:', error);
    
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