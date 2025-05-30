// src/app/api/grafana-data/route.js
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const metric = searchParams.get('metric'); // 'power', 'energy', 'irradiance'
  const plant = searchParams.get('plant'); // 'LAMAJA', 'RETAMAR', or 'total'
  
  const grafanaUrl = process.env.GRAFANA_URL || 'http://localhost:3000';
  const grafanaToken = process.env.GRAFANA_API_TOKEN;
  
  try {
    // Query específica según el parámetro
    let query = '';
    
    switch (metric) {
      case 'power':
        if (plant === 'total') {
          query = `from(bucket: "PV")
            |> range(start: -24h)
            |> filter(fn: (r) => r["PVO_Plant"] == "LAMAJA" or r["PVO_Plant"] == "RETAMAR")
            |> filter(fn: (r) => r["PVO_id"] == "66KV" or r["PVO_id"] == "CONTADOR01")
            |> filter(fn: (r) => r["_field"] == "P")
            |> aggregateWindow(every: 5m, fn: mean, createEmpty: false)
            |> keep(columns: ["_time","PVO_Plant", "_value"])
            |> pivot(rowKey:["_time"], columnKey: ["PVO_Plant"], valueColumn: "_value")
            |> map(fn: (r) => ({r with suma: (r.LAMAJA + r.RETAMAR) / 1000}))
            |> keep(columns: ["_time","suma"])`;
        } else {
          query = `from(bucket: "PV")
            |> range(start: -24h)
            |> filter(fn: (r) => r["PVO_Plant"] == "${plant}")
            |> filter(fn: (r) => r["PVO_id"] == "66KV" or r["PVO_id"] == "CONTADOR01")
            |> filter(fn: (r) => r["_field"] == "P")
            |> aggregateWindow(every: 5m, fn: mean, createEmpty: false)
            |> map(fn: (r) => ({r with _value: r._value / 1000}))`;
        }
        break;
        
      case 'energy':
        if (plant === 'total') {
          query = `from(bucket: "PV")
            |> range(start: -24h)
            |> filter(fn: (r) => r["PVO_Plant"] == "LAMAJA" or r["PVO_Plant"] == "RETAMAR")
            |> filter(fn: (r) => r["type"] == "calculado")
            |> filter(fn: (r) => r["_field"] == "EPV")
            |> aggregateWindow(every: 1h, fn: sum, createEmpty: false)
            |> keep(columns: ["_time","PVO_Plant", "_value"])
            |> pivot(rowKey:["_time"], columnKey: ["PVO_Plant"], valueColumn: "_value")
            |> map(fn: (r) => ({r with suma: (r.LAMAJA + r.RETAMAR) / 1000}))
            |> keep(columns: ["_time","suma"])`;
        } else {
          query = `from(bucket: "PV")
            |> range(start: -24h)
            |> filter(fn: (r) => r["PVO_Plant"] == "${plant}")
            |> filter(fn: (r) => r["type"] == "calculado")
            |> filter(fn: (r) => r["_field"] == "EPV")
            |> aggregateWindow(every: 1h, fn: sum, createEmpty: false)
            |> map(fn: (r) => ({r with _value: r._value / 1000}))`;
        }
        break;
        
      case 'irradiance':
        if (plant === 'total') {
          query = `from(bucket: "PV")
            |> range(start: -24h)
            |> filter(fn: (r) => r["PVO_Plant"] == "LAMAJA" or r["PVO_Plant"] == "RETAMAR")
            |> filter(fn: (r) => r["PVO_type"] == "METEO")
            |> filter(fn: (r) => r["_field"] == "RadPOA01")
            |> aggregateWindow(every: 15m, fn: mean, createEmpty: false)
            |> keep(columns: ["_time","PVO_Plant", "_value"])
            |> pivot(rowKey:["_time"], columnKey: ["PVO_Plant"], valueColumn: "_value")
            |> map(fn: (r) => ({r with suma: (4400.0*r.LAMAJA + 3300.0*r.RETAMAR)/7700.0}))
            |> keep(columns: ["_time","suma"])`;
        } else {
          query = `from(bucket: "PV")
            |> range(start: -24h)
            |> filter(fn: (r) => r["PVO_Plant"] == "${plant}")
            |> filter(fn: (r) => r["PVO_type"] == "METEO")
            |> filter(fn: (r) => r["_field"] == "RadPOA01")
            |> aggregateWindow(every: 15m, fn: mean, createEmpty: false)`;
        }
        break;
    }

    // Hacer la consulta a Grafana usando su API de datasource
    const response = await fetch(`${grafanaUrl}/api/ds/query`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${grafanaToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        queries: [{
          datasource: { uid: 'influxdb-uid' }, // Reemplazar con tu UID
          expr: query,
          refId: 'A',
          intervalMs: 300000, // 5 minutos
          maxDataPoints: 288  // 24h / 5min
        }]
      })
    });

    const data = await response.json();
    
    // Transformar los datos al formato que necesita la gráfica
    const timeSeriesData = data.results?.A?.frames?.[0]?.data?.values || [[], []];
    const timestamps = timeSeriesData[0] || [];
    const values = timeSeriesData[1] || [];
    
    const chartData = timestamps.map((timestamp, index) => ({
      time: new Date(timestamp).toISOString(),
      value: values[index] || 0,
      timestamp: timestamp
    }));

    return Response.json({
      success: true,
      data: chartData,
      metric,
      plant,
      dataPoints: chartData.length
    });

  } catch (error) {
    console.error('Error fetching Grafana data:', error);
    return Response.json({
      success: false,
      error: 'Error al obtener datos de Grafana',
      data: []
    }, { status: 500 });
  }
}