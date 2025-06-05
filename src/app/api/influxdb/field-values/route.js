import { NextResponse } from 'next/server';

const INFLUX_URL = process.env.INFLUXDB_URL;
const INFLUX_TOKEN = process.env.INFLUXDB_TOKEN;
const INFLUX_ORG = process.env.INFLUXDB_ORG;

export async function POST(request) {
  try {
    const { bucket, fieldName, timeRange = '-24h', maxValues = 100 } = await request.json();
    
    if (!bucket || !fieldName) {
      return NextResponse.json({ 
        error: 'Bucket y fieldName son requeridos',
        values: [] 
      }, { status: 400 });
    }

    const timeRanges = [timeRange, '-1h', '-6h', '-24h', '-7d'];
    let foundValues = new Set();

    for (const range of timeRanges) {
      if (foundValues.size >= maxValues) break;

      try {
        const query = `
from(bucket: "${bucket}")
  |> range(start: ${range})
  |> filter(fn: (r) => r["_field"] == "${fieldName}")
  |> filter(fn: (r) => exists r["_value"])
  |> keep(columns: ["_value"])
  |> distinct(column: "_value")
  |> limit(n: ${maxValues})
  |> sort(columns: ["_value"])
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
          const lines = csvData.trim().split('\n');
          
          if (lines.length > 1) {
            const headers = lines[0].split(',').map(h => h.replace(/"/g, '').trim());
            const valueIndex = headers.indexOf('_value');
            
            if (valueIndex !== -1) {
              for (let i = 1; i < lines.length; i++) {
                if (!lines[i].trim()) continue;
                
                const row = lines[i].split(',');
                if (row[valueIndex]) {
                  let value = row[valueIndex].replace(/"/g, '').trim();
                  
                  const numValue = parseFloat(value);
                  if (!isNaN(numValue)) {
                    if (numValue % 1 === 0) {
                      value = numValue.toString();
                    } else {
                      value = numValue.toFixed(2);
                    }
                  }
                  
                  if (value && value !== '' && value !== 'null' && value !== 'undefined') {
                    foundValues.add(value);
                  }
                }
              }
            }
          }
        }
      } catch (rangeError) {
        continue;
      }
    }

    let values = Array.from(foundValues);
    
    const allNumbers = values.every(v => !isNaN(parseFloat(v)));
    if (allNumbers) {
      values.sort((a, b) => parseFloat(a) - parseFloat(b));
    } else {
      values.sort();
    }
    
    return NextResponse.json({
      success: true,
      fieldName,
      bucket,
      values: values.slice(0, maxValues),
      totalFound: values.length,
      isNumeric: allNumbers,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error obteniendo valores de field:', error);
    
    return NextResponse.json({
      success: false,
      error: error.message,
      values: [],
      fieldName: '',
      bucket: ''
    }, { status: 500 });
  }
}