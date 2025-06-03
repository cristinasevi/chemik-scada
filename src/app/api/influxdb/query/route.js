import { NextResponse } from 'next/server';

const INFLUX_URL = process.env.INFLUXDB_URL;
const INFLUX_TOKEN = process.env.INFLUXDB_TOKEN;
const INFLUX_ORG = process.env.INFLUXDB_ORG;

export async function POST(request) {
  try {
    const { query } = await request.json();
    const startTime = Date.now();
    
    console.log('🚀 Executing query:', query);
    
    const response = await fetch(`${INFLUX_URL}/api/v2/query?org=${INFLUX_ORG}`, {
      method: 'POST',
      headers: {
        'Authorization': `Token ${INFLUX_TOKEN}`,
        'Content-Type': 'application/vnd.flux',
        'Accept': 'application/csv'
      },
      body: query
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ InfluxDB query error:', errorText);
      throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
    }

    const csvData = await response.text();
    const executionTime = `${Date.now() - startTime}ms`;
    
    // Contar filas (excluyendo header)
    const rows = csvData.split('\n').filter(line => line.trim()).length - 1;
    
    console.log(`✅ Query executed successfully: ${rows} rows in ${executionTime}`);
    
    return NextResponse.json({ 
      data: csvData, 
      rows: Math.max(0, rows),
      query,
      executionTime
    });
  } catch (error) {
    console.error('❌ Error executing query:', error);
    return NextResponse.json({ 
      error: 'Error executing query',
      details: error.message 
    }, { status: 500 });
  }
}