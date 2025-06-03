import { InfluxDB } from '@influxdata/influxdb-client';

const url = process.env.INFLUXDB_URL || 'http://localhost:8086';
const token = process.env.INFLUXDB_TOKEN;
const org = process.env.INFLUXDB_ORG;

const influxDB = new InfluxDB({ url, token });

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const plant = searchParams.get('plant'); // 'LAMAJA' o 'RETAMAR'
  const startDate = searchParams.get('start');
  const endDate = searchParams.get('end');

  try {
    const queryApi = influxDB.getQueryApi(org);
    
    // Obtener fechas del mes actual si no se proporcionan
    let start, end;
    if (startDate && endDate) {
      start = startDate;
      end = endDate;
    } else {
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      start = startOfMonth.toISOString();
      end = endOfMonth.toISOString();
    }

    // Query replicando la lógica de Grafana
    // Usa DailyEPV que es la energía diaria calculada
    const query = `
      import "date"
      import "experimental"
      
      from(bucket: "PV")
        |> range(start: ${start}, stop: ${end})
        |> filter(fn: (r) => r["PVO_Plant"] == "${plant}")
        |> filter(fn: (r) => r["type"] == "calculado")
        |> filter(fn: (r) => r["_field"] == "DailyEPV")
        |> map(fn: (r) => ({ 
            r with 
            _time: experimental.addDuration(d: -1h, to: r._time) 
        }))
        |> sort(columns: ["_time"])
    `;

    const timeSeriesData = [];

    await new Promise((resolve, reject) => {
      queryApi.queryRows(query, {
        next(row, tableMeta) {
          const rowData = tableMeta.toObject(row);
          
          // El valor ya viene en kWh desde DailyEPV
          let value = rowData._value || 0;
          
          // Filtrar valores negativos o muy pequeños
          if (value < 0.001) {
            value = 0;
          }

          timeSeriesData.push({
            time: rowData._time,
            value: Number(value.toFixed(3)),
            timestamp: new Date(rowData._time).getTime(),
            plant: plant,
            field: 'DailyEPV'
          });
        },
        error(error) {
          console.error(`Error en query de producción mensual para ${plant}:`, error);
          reject(error);
        },
        complete() {
          resolve();
        }
      });
    });

    // Ordenar por timestamp
    timeSeriesData.sort((a, b) => a.timestamp - b.timestamp);

    // Estadísticas adicionales
    const validValues = timeSeriesData.filter(d => d.value > 0).map(d => d.value);
    const stats = {
      total: validValues.reduce((sum, val) => sum + val, 0),
      mean: validValues.length > 0 ? validValues.reduce((sum, val) => sum + val, 0) / validValues.length : 0,
      max: validValues.length > 0 ? Math.max(...validValues) : 0,
      min: validValues.length > 0 ? Math.min(...validValues) : 0,
      daysWithData: validValues.length
    };

    return Response.json({
      success: true,
      data: timeSeriesData,
      plant,
      period: {
        start,
        end,
        daysTotal: timeSeriesData.length
      },
      stats,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error obteniendo datos de producción mensual:', error);
    return Response.json({
      success: false,
      error: 'Error al obtener datos de producción mensual',
      data: [],
      plant,
      stats: {
        total: 0,
        mean: 0,
        max: 0,
        min: 0,
        daysWithData: 0
      }
    }, { status: 500 });
  }
}