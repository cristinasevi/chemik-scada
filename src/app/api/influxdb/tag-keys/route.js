import { NextResponse } from 'next/server';

const INFLUX_URL = process.env.INFLUXDB_URL;
const INFLUX_TOKEN = process.env.INFLUXDB_TOKEN;
const INFLUX_ORG = process.env.INFLUXDB_ORG;

export async function POST(request) {
  try {
    const { bucket, measurement } = await request.json();
    
    const timeRanges = ['-1h', '-24h', '-7d', '-30d'];
    
    for (const timeRange of timeRanges) {
      let query;
      if (measurement) {
        query = `
from(bucket: "${bucket}")
  |> range(start: ${timeRange})
  |> filter(fn: (r) => r._measurement == "${measurement}")
  |> limit(n: 1)`;
      } else {
        query = `
from(bucket: "${bucket}")
  |> range(start: ${timeRange})
  |> limit(n: 1)`;
      }

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
          
          const allPossibleFilters = headers.filter(key => {
            const excludeFields = ['result', 'table', ''];
            
            if (excludeFields.includes(key)) return false;
            if (!key || key.trim() === '') return false;
            
            return true;
          });
          
          if (allPossibleFilters.length > 0) {
            return NextResponse.json({ tagKeys: allPossibleFilters });
          }
        }
      }
    }
    
    return NextResponse.json({ tagKeys: [] });
    
  } catch (error) {
    console.error('Error fetching tag keys:', error);
    return NextResponse.json({ 
      error: error.message,
      tagKeys: []
    });
  }
}