import { NextResponse } from 'next/server';

const INFLUX_URL = process.env.INFLUXDB_URL;
const INFLUX_TOKEN = process.env.INFLUXDB_TOKEN;
const INFLUX_ORG = process.env.INFLUXDB_ORG;

export async function GET() {
  try {
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
    
    return NextResponse.json({ buckets });
  } catch (error) {
    console.error('Error fetching buckets:', error);
    
    return NextResponse.json({ 
      error: 'Error fetching buckets', 
      buckets: []
    });
  }
}