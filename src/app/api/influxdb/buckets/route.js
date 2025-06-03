import { NextResponse } from 'next/server';

const INFLUX_URL = process.env.INFLUXDB_URL;
const INFLUX_TOKEN = process.env.INFLUXDB_TOKEN;
const INFLUX_ORG = process.env.INFLUXDB_ORG;

export async function GET() {
  try {
    console.log('🗄️ Fetching buckets from:', INFLUX_URL);
    
    const response = await fetch(`${INFLUX_URL}/api/v2/buckets`, {
      headers: {
        'Authorization': `Token ${INFLUX_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    const buckets = data.buckets.map(bucket => bucket.name);
    
    console.log('✅ Buckets loaded:', buckets);
    return NextResponse.json({ buckets });
  } catch (error) {
    console.error('❌ Error fetching buckets:', error);
    return NextResponse.json({ 
      error: 'Error fetching buckets', 
      buckets: ['DC', 'GeoMap', 'Omie', 'PV', '_monitoring', '_tasks']
    });
  }
}