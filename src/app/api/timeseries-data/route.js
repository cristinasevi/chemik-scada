import { InfluxDB } from '@influxdata/influxdb-client';

const url = process.env.INFLUXDB_URL || 'http://localhost:8086';
const token = process.env.INFLUXDB_TOKEN;
const org = process.env.INFLUXDB_ORG;

const influxDB = new InfluxDB({ url, token });

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const metric = searchParams.get('metric'); // 'power', 'energy', 'irradiance', 'irradiation', 'profitability', 'elec_dispo', 'pr'
  const plant = searchParams.get('plant'); // 'LAMAJA', 'RETAMAR', or 'total'
  const hours = searchParams.get('hours') || '24'; // Período en horas

  try {
    const queryApi = influxDB.getQueryApi(org);
    let query = '';

    switch (metric) {
      case 'power':
        if (plant === 'total') {
          query = `
            from(bucket: "PV")
              |> range(start: -${hours}h)
              |> filter(fn: (r) => r["PVO_Plant"] == "LAMAJA" or r["PVO_Plant"] == "RETAMAR")
              |> filter(fn: (r) => r["PVO_id"] == "66KV" or r["PVO_id"] == "CONTADOR01")
              |> filter(fn: (r) => r["_field"] == "P")
              |> aggregateWindow(every: 5m, fn: mean, createEmpty: false)
              |> keep(columns: ["_time","PVO_Plant", "_value"])
              |> pivot(rowKey:["_time"], columnKey: ["PVO_Plant"], valueColumn: "_value")
              |> map(fn: (r) => ({
                  r with
                  suma: r.LAMAJA + r.RETAMAR
              }))
              |> keep(columns: ["_time","suma"])
          `;
        } else {
          query = `
            from(bucket: "PV")
              |> range(start: -${hours}h)
              |> filter(fn: (r) => r["PVO_Plant"] == "${plant}")
              |> filter(fn: (r) => r["PVO_id"] == "66KV" or r["PVO_id"] == "CONTADOR01")
              |> filter(fn: (r) => r["_field"] == "P")
              |> aggregateWindow(every: 5m, fn: mean, createEmpty: false)
          `;
        }
        break;

      case 'energy':
        if (plant === 'total') {
          query = `
            from(bucket: "PV")
              |> range(start: -${hours}h)
              |> filter(fn: (r) => r["PVO_Plant"] == "LAMAJA" or r["PVO_Plant"] == "RETAMAR")
              |> filter(fn: (r) => r["type"] == "calculado")
              |> filter(fn: (r) => r["_field"] == "EPV")
              |> keep(columns: ["_time","PVO_Plant", "_value"])
              |> pivot(rowKey:["_time"], columnKey: ["PVO_Plant"], valueColumn: "_value")
              |> cumulativeSum(columns: ["LAMAJA","RETAMAR"])
              |> map(fn: (r) => ({
                  r with
                  suma: r.LAMAJA + r.RETAMAR
              }))
              |> keep(columns: ["_time","suma"])
          `;
        } else {
          query = `
            from(bucket: "PV")
              |> range(start: -${hours}h)
              |> filter(fn: (r) => r["PVO_Plant"] == "${plant}")
              |> filter(fn: (r) => r["type"] == "calculado")
              |> filter(fn: (r) => r["_field"] == "EPV")
              |> cumulativeSum()
          `;
        }
        break;

      case 'irradiance':
        if (plant === 'total') {
          query = `
            from(bucket: "PV")
              |> range(start: -${hours}h)
              |> filter(fn: (r) => r["PVO_Plant"] == "RETAMAR" or r["PVO_Plant"] == "LAMAJA")
              |> filter(fn: (r) => r["PVO_type"] == "METEO")
              |> filter(fn: (r) => r["_field"] == "RadPOA01")
              |> aggregateWindow(every: 15m, fn: mean, createEmpty: false)
              |> keep(columns: ["_time","PVO_Plant", "_value"])
              |> pivot(rowKey:["_time"], columnKey: ["PVO_Plant"], valueColumn: "_value")
              |> map(fn: (r) => ({
                  r with
                  suma: (4400.0*r.LAMAJA + 3300.0*r.RETAMAR)/7700.0
              }))
              |> keep(columns: ["_time","suma"])
          `;
        } else {
          query = `
            from(bucket: "PV")
              |> range(start: -${hours}h)
              |> filter(fn: (r) => r["PVO_Plant"] == "${plant}")
              |> filter(fn: (r) => r["PVO_type"] == "METEO")
              |> filter(fn: (r) => r["_field"] == "RadPOA01")
              |> aggregateWindow(every: 15m, fn: mean, createEmpty: false)
          `;
        }
        break;

      case 'irradiation':
        if (plant === 'total') {
          query = `
            from(bucket: "PV")
              |> range(start: -${hours}h)
              |> filter(fn: (r) => r["PVO_Plant"] == "LAMAJA" or r["PVO_Plant"] == "RETAMAR")
              |> filter(fn: (r) => r["type"] == "calculado")
              |> filter(fn: (r) => r["_field"] == "H_PoA")
              |> keep(columns: ["_time","PVO_Plant", "_value"])
              |> pivot(rowKey:["_time"], columnKey: ["PVO_Plant"], valueColumn: "_value")
              |> cumulativeSum(columns: ["LAMAJA","RETAMAR"])
              |> map(fn: (r) => ({
                  r with
                  suma: r.LAMAJA + r.RETAMAR
              }))
              |> keep(columns: ["_time","suma"])
          `;
        } else {
          query = `
            from(bucket: "PV")
              |> range(start: -${hours}h)
              |> filter(fn: (r) => r["PVO_Plant"] == "${plant}")
              |> filter(fn: (r) => r["type"] == "calculado")
              |> filter(fn: (r) => r["_field"] == "H_PoA")
              |> cumulativeSum()
          `;
        }
        break;

      case 'profitability':
        if (plant === 'total') {
          query = `
            from(bucket: "PV")
              |> range(start: -${hours}h)
              |> filter(fn: (r) => r["PVO_Plant"] == "LAMAJA" or r["PVO_Plant"] == "RETAMAR")
              |> filter(fn: (r) => r["type"] == "calculado")
              |> filter(fn: (r) => r["_field"] == "EPV")
              |> aggregateWindow(every: 1h, fn: sum, createEmpty: false)
              |> keep(columns: ["_time","PVO_Plant", "_value"])
              |> pivot(rowKey:["_time"], columnKey: ["PVO_Plant"], valueColumn: "_value")
              |> map(fn: (r) => ({
                  r with
                  suma: (r.LAMAJA + r.RETAMAR) / 1000.0
              }))
              |> keep(columns: ["_time","suma"])
              |> filter(fn: (r) => r.suma >= 0.0)
              |> cumulativeSum(columns: ["suma"])
          `;
        } else {
          query = `
            from(bucket: "PV")
              |> range(start: -${hours}h)
              |> filter(fn: (r) => r["PVO_Plant"] == "${plant}")
              |> filter(fn: (r) => r["type"] == "calculado")
              |> filter(fn: (r) => r["_field"] == "EPV")
              |> aggregateWindow(every: 1h, fn: sum, createEmpty: false)
              |> map(fn: (r) => ({ r with _value: r._value / 1000.0 }))
              |> filter(fn: (r) => r._value >= 0.0)
              |> cumulativeSum()
          `;
        }
        break;

      case 'elec_dispo':
        if (plant === 'total') {
          query = `
            from(bucket: "PV")
              |> range(start: -${hours}h)
              |> filter(fn: (r) => r["PVO_Plant"] == "RETAMAR" or r["PVO_Plant"] == "LAMAJA")
              |> filter(fn: (r) => r["PVO_id"] == "ESTADO" or r["PVO_id"] == "66KV")
              |> filter(fn: (r) => r["_field"] == "DispoElec" or r["_field"] == "AvEle")
              |> aggregateWindow(every: 30m, fn: mean, createEmpty: false)
              |> keep(columns: ["_time", "PVO_Plant", "_value"])
              |> pivot(rowKey:["_time"], columnKey: ["PVO_Plant"], valueColumn: "_value")
              |> map(fn: (r) => ({
                  r with
                  AvGen: (r.LAMAJA * 4.4 + r.RETAMAR * 3.33) / 7.73
              }))
              |> keep(columns: ["_time","AvGen"])
          `;
        } else if (plant === 'LAMAJA') {
          query = `
            from(bucket: "PV")
              |> range(start: -${hours}h)
              |> filter(fn: (r) => r["_field"] == "AvEle")
              |> filter(fn: (r) => r["PVO_Plant"] == "LAMAJA")
              |> filter(fn: (r) => r["PVO_Zone"] == "SUBESTACION")
              |> filter(fn: (r) => r["PVO_id"] == "66KV")
              |> filter(fn: (r) => r["PVO_type"] == "ESTADO")
              |> aggregateWindow(every: 30m, fn: mean, createEmpty: false)
          `;
        } else {
          query = `
            from(bucket: "PV")
              |> range(start: -${hours}h)
              |> filter(fn: (r) => r["PVO_Plant"] == "RETAMAR")
              |> filter(fn: (r) => r["PVO_id"] == "ESTADO")
              |> filter(fn: (r) => r["_field"] == "DispoElec")
              |> aggregateWindow(every: 30m, fn: mean, createEmpty: false)
          `;
        }
        break;

      case 'pr':
        if (plant === 'total') {
          query = `
            data1 = from(bucket: "PV")
              |> range(start: -${hours}h)
              |> filter(fn: (r) => r["PVO_Plant"] == "LAMAJA" or r["PVO_Plant"] == "RETAMAR")
              |> filter(fn: (r) => r["type"] == "calculado")
              |> filter(fn: (r) => r["_field"] == "H_PoA")
              |> keep(columns: ["_time", "PVO_Plant", "_value"])
              |> pivot(rowKey: ["_time"], columnKey: ["PVO_Plant"], valueColumn: "_value")
              |> cumulativeSum(columns: ["LAMAJA", "RETAMAR"])
              |> map(fn: (r) => ({
                  r with
                  H_POA: (r.LAMAJA*4400.0 + r.RETAMAR*3300.0)/7700.0
              }))
              |> keep(columns: ["_time", "H_POA"])

            data2 = from(bucket: "PV")
              |> range(start: -${hours}h)
              |> filter(fn: (r) => r["PVO_Plant"] == "LAMAJA" or r["PVO_Plant"] == "RETAMAR")
              |> filter(fn: (r) => r["type"] == "calculado")
              |> filter(fn: (r) => r["_field"] == "EPV")
              |> keep(columns: ["_time", "PVO_Plant", "_value"])
              |> pivot(rowKey: ["_time"], columnKey: ["PVO_Plant"], valueColumn: "_value")
              |> cumulativeSum(columns: ["LAMAJA", "RETAMAR"])
              |> map(fn: (r) => ({
                  r with
                  E_PV: r.LAMAJA + r.RETAMAR
              }))
              |> keep(columns: ["_time", "E_PV"])

            join(
              tables: {key1: data1, key2: data2},
              on: ["_time"],
              method: "inner"
            )
            |> map(fn: (r) => ({
              r with
              PR: r.E_PV/([CAPACIDAD_TOTAL]*r.H_POA)*100.0
            }))
            |> keep(columns: ["_time", "PR"])
          `;
        } else if (plant === 'LAMAJA') {
          query = `
            from(bucket: "PV")
              |> range(start: -${hours}h)
              |> filter(fn: (r) => r["PVO_Plant"] == "LAMAJA")
              |> filter(fn: (r) => r["type"] == "calculado")
              |> filter(fn: (r) => r["_field"] == "H_PoA" or r["_field"] == "EPV")
              |> cumulativeSum()  
              |> keep(columns: ["_time","_field", "_value"])
              |> pivot(rowKey:["_time"], columnKey: ["_field"], valueColumn: "_value")
              |> map(fn: (r) => ({
                 r with
                  PR: r.EPV/(4400.0*r.H_PoA)*100.0
              }))  
              |> keep(columns: ["_time", "PR"])
          `;
        } else if (plant === 'RETAMAR') {
          query = `
            from(bucket: "PV")
              |> range(start: -${hours}h)
              |> filter(fn: (r) => r["PVO_Plant"] == "RETAMAR")
              |> filter(fn: (r) => r["type"] == "calculado")
              |> filter(fn: (r) => r["_field"] == "H_PoA" or r["_field"] == "EPV")
              |> cumulativeSum()  
              |> keep(columns: ["_time","_field", "_value"])
              |> pivot(rowKey:["_time"], columnKey: ["_field"], valueColumn: "_value")
              |> map(fn: (r) => ({
                 r with
                  PR: r.EPV/(3300.0*r.H_PoA)*100.0
              }))
              |> keep(columns: ["_time", "PR"])
          `;
        }
        break;

      default:
        return Response.json({
          success: false,
          error: 'Métrica no válida. Usa: power, energy, irradiance, irradiation, profitability, elec_dispo, pr'
        }, { status: 400 });
    }

    const timeSeriesData = [];

    await new Promise((resolve, reject) => {
      queryApi.queryRows(query, {
        next(row, tableMeta) {
          const rowData = tableMeta.toObject(row);
          let value = plant === 'total' ?
            (metric === 'elec_dispo' ? rowData.AvGen :
              metric === 'pr' ? rowData.PR :
                rowData.suma) :
            (metric === 'pr' ? rowData.PR : rowData._value);

          // Para potencia, convertir kW a MW
          if (metric === 'power') {
            value = value / 1000.0;
          }

          // Para energía, convertir kWh a MWh  
          if (metric === 'energy') {
            value = value / 1000.0;
          }

          // NO eliminar valores pequeños negativos, solo valores extremadamente pequeños (< 0.0001)
          if (Math.abs(value) < 0.0001) {
            value = 0;
          }

          timeSeriesData.push({
            time: rowData._time,
            value: Number(value.toFixed(3)),
            timestamp: new Date(rowData._time).getTime()
          });
        },
        error(error) {
          console.error(`Error en query de ${metric} para ${plant}:`, error);
          reject(error);
        },
        complete() {
          resolve();
        }
      });
    });

    // Ordenar por timestamp
    timeSeriesData.sort((a, b) => a.timestamp - b.timestamp);

    return Response.json({
      success: true,
      data: timeSeriesData,
      metric,
      plant,
      dataPoints: timeSeriesData.length,
      period: `${hours}h`,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error obteniendo datos de serie temporal:', error);
    return Response.json({
      success: false,
      error: 'Error al obtener datos de serie temporal',
      data: [],
      metric,
      plant
    }, { status: 500 });
  }
}