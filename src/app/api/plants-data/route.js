// src/app/api/plants-data/route.js
import { InfluxDB } from '@influxdata/influxdb-client';

const url = process.env.INFLUXDB_URL || 'http://localhost:8086';
const token = process.env.INFLUXDB_TOKEN;
const org = process.env.INFLUXDB_ORG;

const influxDB = new InfluxDB({ url, token });

export async function GET(request) {
  try {
    const queryApi = influxDB.getQueryApi(org);

    // 1. Auto-descubrir plantas disponibles
    const discoverPlantsQuery = `
      from(bucket: "PV")
        |> range(start: -7d)
        |> filter(fn: (r) => r["_field"] == "P")
        |> filter(fn: (r) => r["PVO_id"] == "66KV" or r["PVO_id"] == "CONTADOR01")
        |> group(columns: ["PVO_Plant"])
        |> distinct(column: "PVO_Plant")
        |> keep(columns: ["_value"])
    `;

    let availablePlants = [];

    await new Promise((resolve, reject) => {
      queryApi.queryRows(discoverPlantsQuery, {
        next(row, tableMeta) {
          const rowData = tableMeta.toObject(row);
          if (rowData._value) {
            availablePlants.push(rowData._value);
          }
        },
        error(error) {
          console.error('Error descubriendo plantas:', error);
          resolve();
        },
        complete() {
          resolve();
        }
      });
    });

    // Si no encuentra plantas, usar fallback
    if (availablePlants.length === 0) {
      availablePlants = ['LAMAJA', 'RETAMAR'];
    }

    // DEFINIR TODAS LAS QUERIES
    const totalPowerQuery = `
      from(bucket: "PV")
        |> range(start: -24h)
        |> filter(fn: (r) => ${availablePlants.map(plant => `r["PVO_Plant"] == "${plant}"`).join(' or ')})
        |> filter(fn: (r) => r["PVO_id"] == "66KV" or r["PVO_id"] == "CONTADOR01")
        |> filter(fn: (r) => r["_field"] == "P")
        |> aggregateWindow(every: 20m, fn: mean, createEmpty: false)
        |> last()
        |> keep(columns: ["_time","PVO_Plant", "_value"])
        |> pivot(rowKey:["_time"], columnKey: ["PVO_Plant"], valueColumn: "_value")
        |> map(fn: (r) => ({
            r with
            suma: r.LAMAJA + r.RETAMAR
        }))
        |> keep(columns: ["_time","suma"])
    `;

    const totalEnergyQuery = `
      from(bucket: "PV")
        |> range(start: -24h)
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
        |> last(column: "suma")
    `;

    const totalIrradianceQuery = `
      from(bucket: "PV")
        |> range(start: -24h)
        |> filter(fn: (r) => r["PVO_Plant"] == "RETAMAR" or r["PVO_Plant"] == "LAMAJA")
        |> filter(fn: (r) => r["PVO_type"] == "METEO")
        |> filter(fn: (r) => r["_field"] == "RadPOA01")
        |> aggregateWindow(every: 15m, fn: mean, createEmpty: false)
        |> last()
        |> keep(columns: ["_time","PVO_Plant", "_value"])
        |> pivot(rowKey:["_time"], columnKey: ["PVO_Plant"], valueColumn: "_value")
        |> map(fn: (r) => ({
            r with
            suma: (4400.0*r.LAMAJA + 3300.0*r.RETAMAR)/7700.0
        }))
        |> keep(columns: ["_time","suma"])
    `;

    const totalIrradiationQuery = `
      from(bucket: "PV")
        |> range(start: -24h)
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
        |> last(column: "suma")
    `;

    // ✅ QUERY CORREGIDA PARA RENTABILIDAD TOTAL
    const totalProfitabilityQuery = `
      from(bucket: "PV")
        |> range(start: -24h)
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
        |> sum(column: "suma")
    `;

    // ✅ QUERY CORREGIDA PARA DISPOSICIÓN ELÉCTRICA TOTAL
    const totalElecDispoQuery = `
      from(bucket: "PV")
        |> range(start: -24h)
        |> filter(fn: (r) => r["PVO_Plant"] == "RETAMAR" or r["PVO_Plant"] == "LAMAJA")
        |> filter(fn: (r) => r["PVO_id"] == "ESTADO" or r["PVO_id"] == "66KV")
        |> filter(fn: (r) => r["_field"] == "DispoElec" or r["_field"] == "AvEle")
        |> aggregateWindow(every: 30m, fn: mean, createEmpty: false)
        |> keep(columns: ["_time", "PVO_Plant", "_value"])
        |> last()
        |> pivot(rowKey:["_time"], columnKey: ["PVO_Plant"], valueColumn: "_value")
        |> map(fn: (r) => ({
            r with
            AvGen: (r.LAMAJA * 4.4 + r.RETAMAR * 3.33) / 7.73
        }))
        |> keep(columns: ["_time","AvGen"])
    `;

    const totalMecDispoQuery = `
      from(bucket: "PV")
        |> range(start: -24h)
        |> filter(fn: (r) => r["PVO_Plant"] == "RETAMAR")
        |> filter(fn: (r) => r["PVO_id"] == "ESTADO")
        |> filter(fn: (r) => r["_field"] == "DispoMec")
        |> aggregateWindow(every: 30m, fn: mean, createEmpty: false)
        |> last()
    `;

    // ✅ QUERY CORREGIDA PARA PR (PERFORMANCE RATIO) TOTAL - REPLICANDO GRAFANA EXACTO
    const totalPRQuery = `
      data1 = from(bucket: "PV")
        |> range(start: -24h)
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
        |> range(start: -24h)
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
        PR: r.E_PV/(7700.0*r.H_POA)*100.0
      }))
      |> keep(columns: ["_time", "PR"])
      |> last()
    `;

    const geoDataQuery = `
      from(bucket: "GeoMap")
        |> range(start: -24h)
        |> filter(fn: (r) => r["_measurement"] == "modbus")
        |> last()
        |> pivot(rowKey:["_time"], columnKey: ["_field"], valueColumn: "_value")
        |> keep(columns: ["AvEle","AvMec","Irrad","latitude","longitude","Plant"])
    `;

    // FUNCIONES PARA QUERIES INDIVIDUALES
    const createPowerQueryForPlant = (plantName) => `
      from(bucket: "PV")
        |> range(start: -24h)
        |> filter(fn: (r) => r["PVO_Plant"] == "${plantName}")
        |> filter(fn: (r) => r["PVO_id"] == "66KV" or r["PVO_id"] == "CONTADOR01")
        |> filter(fn: (r) => r["_field"] == "P")
        |> aggregateWindow(every: 20m, fn: mean, createEmpty: false)
        |> last()
    `;

    const createEnergyQueryForPlant = (plantName) => `
      from(bucket: "PV")
        |> range(start: -24h)
        |> filter(fn: (r) => r["PVO_Plant"] == "${plantName}")
        |> filter(fn: (r) => r["type"] == "calculado")
        |> filter(fn: (r) => r["_field"] == "EPV")
        |> cumulativeSum()
        |> last()
    `;

    const createIrradianceQueryForPlant = (plantName) => `
      from(bucket: "PV")
        |> range(start: -24h)
        |> filter(fn: (r) => r["PVO_Plant"] == "${plantName}")
        |> filter(fn: (r) => r["PVO_type"] == "METEO")
        |> filter(fn: (r) => r["_field"] == "RadPOA01")
        |> aggregateWindow(every: 15m, fn: mean, createEmpty: false)
        |> last()
    `;

    const createIrradiationQueryForPlant = (plantName) => `
      from(bucket: "PV")
        |> range(start: -24h)
        |> filter(fn: (r) => r["PVO_Plant"] == "${plantName}")
        |> filter(fn: (r) => r["type"] == "calculado")
        |> filter(fn: (r) => r["_field"] == "H_PoA")
        |> cumulativeSum()
        |> last()
    `;

    // ✅ FUNCIÓN CORREGIDA PARA RENTABILIDAD INDIVIDUAL
    const createProfitabilityQueryForPlant = (plantName) => `
      from(bucket: "PV")
        |> range(start: -24h)
        |> filter(fn: (r) => r["PVO_Plant"] == "${plantName}")
        |> filter(fn: (r) => r["type"] == "calculado")
        |> filter(fn: (r) => r["_field"] == "EPV")
        |> aggregateWindow(every: 1h, fn: sum, createEmpty: false)
        |> map(fn: (r) => ({ r with _value: r._value / 1000.0 }))
        |> filter(fn: (r) => r._value >= 0.0)
        |> sum(column: "_value")
    `;

    const createPRQueryForPlant = (plantName) => {
      if (plantName === 'LAMAJA') {
        return `
      from(bucket: "PV")
        |> range(start: -24h)
        |> filter(fn: (r) => r["PVO_Plant"] == "LAMAJA")
        |> filter(fn: (r) => r["type"] == "calculado")
        |> filter(fn: (r) => r["_field"] == "H_PoA" or r["_field"] == "EPV")
        |> cumulativeSum()  
        |> last()
        |> keep(columns: ["_time","_field", "_value"])
        |> pivot(rowKey:["_time"], columnKey: ["_field"], valueColumn: "_value")
        |> map(fn: (r) => ({
           r with
            PR: r.EPV/(4400.0*r.H_PoA)*100.0
        }))  
        |> keep(columns: ["_time", "PR"])
    `;
      } else if (plantName === 'RETAMAR') {
        return `
      from(bucket: "PV")
        |> range(start: -24h)
        |> filter(fn: (r) => r["PVO_Plant"] == "RETAMAR")
        |> filter(fn: (r) => r["type"] == "calculado")
        |> filter(fn: (r) => r["_field"] == "H_PoA" or r["_field"] == "EPV")
        |> cumulativeSum()  
        |> last()
        |> keep(columns: ["_time","_field", "_value"])
        |> pivot(rowKey:["_time"], columnKey: ["_field"], valueColumn: "_value")
        |> map(fn: (r) => ({
           r with
            PR: r.EPV/(3300.0*r.H_PoA)*100.0
        }))
        |> keep(columns: ["_time", "PR"])
    `;
      }
    };

    const createElecDispoQueryForPlant = (plantName) => {
      return `
        from(bucket: "PV")
          |> range(start: -24h)
          |> filter(fn: (r) => r["PVO_Plant"] == "${plantName}")
          |> filter(fn: (r) => r["_field"] == "DispoElec")
          |> aggregateWindow(every: 30m, fn: mean, createEmpty: false)
          |> last()
      `;
    };

    const createMecDispoQueryForPlant = (plantName) => {
      if (plantName === 'LAMAJA') {
        // LAMAJA no tiene datos de disposición mecánica, retornar query que no devuelve resultados
        return `
          from(bucket: "PV")
            |> range(start: -24h)
            |> filter(fn: (r) => r["PVO_Plant"] == "LAMAJA")
            |> filter(fn: (r) => r["PVO_id"] == "ESTADO")
            |> filter(fn: (r) => r["_field"] == "DispoMec")
            |> aggregateWindow(every: 30m, fn: mean, createEmpty: false)
            |> last()
        `;
      } else {
        return `
          from(bucket: "PV")
            |> range(start: -24h)
            |> filter(fn: (r) => r["PVO_Plant"] == "RETAMAR")
            |> filter(fn: (r) => r["PVO_id"] == "ESTADO")
            |> filter(fn: (r) => r["_field"] == "DispoMec")
            |> aggregateWindow(every: 30m, fn: mean, createEmpty: false)
            |> last()
        `;
      }
    };

    // VARIABLES PARA ALMACENAR RESULTADOS
    let totalPower = 0;
    let totalEnergy = 0;
    let totalIrradiance = 0;
    let totalIrradiation = 0;
    let totalProfitability = 0;
    let totalElecDispo = 0;
    let totalMecDispo = 0;
    let totalPR = 0;
    let plantsData = new Map();
    let geoData = [];

    // EJECUTAR QUERIES TOTALES

    // Potencia total
    try {
      await new Promise((resolve, reject) => {
        queryApi.queryRows(totalPowerQuery, {
          next(row, tableMeta) {
            const rowData = tableMeta.toObject(row);
            totalPower = (rowData.suma || 0) / 1000;
          },
          error(error) {
            console.error('Error en query de potencia total:', error);
            resolve();
          },
          complete() {
            resolve();
          }
        });
      });
    } catch (error) {
      console.error('Exception en query de potencia total:', error);
    }

    // Energía total
    try {
      await new Promise((resolve, reject) => {
        queryApi.queryRows(totalEnergyQuery, {
          next(row, tableMeta) {
            const rowData = tableMeta.toObject(row);
            totalEnergy = (rowData.suma || 0) / 1000;
          },
          error(error) {
            console.error('Error en query de energía total:', error);
            resolve();
          },
          complete() {
            resolve();
          }
        });
      });
    } catch (error) {
      console.error('Exception en query de energía total:', error);
    }

    // Irradiancia total
    try {
      await new Promise((resolve, reject) => {
        queryApi.queryRows(totalIrradianceQuery, {
          next(row, tableMeta) {
            const rowData = tableMeta.toObject(row);
            totalIrradiance = rowData.suma || 0;
          },
          error(error) {
            console.error('Error en query de irradiancia total:', error);
            resolve();
          },
          complete() {
            resolve();
          }
        });
      });
    } catch (error) {
      console.error('Exception en query de irradiancia total:', error);
    }

    // Irradiación total
    try {
      await new Promise((resolve, reject) => {
        queryApi.queryRows(totalIrradiationQuery, {
          next(row, tableMeta) {
            const rowData = tableMeta.toObject(row);
            totalIrradiation = rowData.suma || 0;
          },
          error(error) {
            console.error('Error en query de irradiación total:', error);
            resolve();
          },
          complete() {
            resolve();
          }
        });
      });
    } catch (error) {
      console.error('Exception en query de irradiación total:', error);
    }

    // ✅ RENTABILIDAD TOTAL - CON LOGGING MEJORADO
    try {
      console.log('🔍 Ejecutando query de rentabilidad total corregida...');
      console.log('📋 Query:', totalProfitabilityQuery);

      let dataCount = 0;
      await new Promise((resolve, reject) => {
        queryApi.queryRows(totalProfitabilityQuery, {
          next(row, tableMeta) {
            const rowData = tableMeta.toObject(row);
            dataCount++;
            console.log(`✅ DATOS RENTABILIDAD TOTAL [${dataCount}]:`, {
              suma: rowData.suma,
              mean: rowData.mean,
              value: rowData._value,
              time: rowData._time,
              allFields: rowData
            });

            // El resultado de sum() viene en _value
            totalProfitability = rowData._value || rowData.suma || rowData.mean || 0;
          },
          error(error) {
            console.error('❌ Error en query de rentabilidad total:', error);
            resolve();
          },
          complete() {
            console.log(`🏁 Query rentabilidad total completada. Filas: ${dataCount}, Valor final: ${totalProfitability}`);
            resolve();
          }
        });
      });
    } catch (error) {
      console.error('💥 Exception en query de rentabilidad total:', error);
    }

    // Disposición eléctrica total
    try {
      await new Promise((resolve, reject) => {
        queryApi.queryRows(totalElecDispoQuery, {
          next(row, tableMeta) {
            const rowData = tableMeta.toObject(row);
            totalElecDispo = rowData.AvGen || 0;
          },
          error(error) {
            console.error('Error en query de disposición eléctrica total:', error);
            resolve();
          },
          complete() {
            resolve();
          }
        });
      });
    } catch (error) {
      console.error('Exception en query de disposición eléctrica total:', error);
    }

    // Disposición mecánica total
    try {
      await new Promise((resolve, reject) => {
        queryApi.queryRows(totalMecDispoQuery, {
          next(row, tableMeta) {
            const rowData = tableMeta.toObject(row);
            totalMecDispo = rowData._value || 0; // Solo RETAMAR
          },
          error(error) {
            console.error('Error en query de disposición mecánica total:', error);
            resolve();
          },
          complete() {
            resolve();
          }
        });
      });
    } catch (error) {
      console.error('Exception en query de disposición mecánica total:', error);
    }

    // ✅ PR (Performance Ratio) total - CON LOGGING
    try {
      console.log('🔍 Ejecutando query de PR total corregida...');
      let dataCount = 0;
      await new Promise((resolve, reject) => {
        queryApi.queryRows(totalPRQuery, {
          next(row, tableMeta) {
            const rowData = tableMeta.toObject(row);
            dataCount++;
            console.log(`✅ DATOS PR TOTAL [${dataCount}]:`, {
              PR: rowData.PR,
              E_PV: rowData.E_PV,
              H_POA: rowData.H_POA,
              time: rowData._time,
              calculation: `${rowData.E_PV}/(7700.0*${rowData.H_POA})*100 = ${rowData.PR}`,
              allFields: rowData
            });
            totalPR = rowData.PR || 0;
          },
          error(error) {
            console.error('❌ Error en query de PR total:', error);
            resolve();
          },
          complete() {
            console.log(`🏁 Query PR total completada. Filas: ${dataCount}, Valor final: ${totalPR}`);
            resolve();
          }
        });
      });
    } catch (error) {
      console.error('💥 Exception en query de PR total:', error);
    }

    // EJECUTAR QUERIES INDIVIDUALES PARA CADA PLANTA
    for (const plantName of availablePlants) {

      // Potencia individual
      try {
        await new Promise((resolve, reject) => {
          queryApi.queryRows(createPowerQueryForPlant(plantName), {
            next(row, tableMeta) {
              const rowData = tableMeta.toObject(row);
              if (!plantsData.has(plantName)) {
                plantsData.set(plantName, {});
              }
              plantsData.get(plantName).power = (rowData._value || 0) / 1000;
              plantsData.get(plantName).timestamp = rowData._time;
            },
            error(error) {
              console.error(`Error en query de potencia para ${plantName}:`, error);
              resolve();
            },
            complete() {
              resolve();
            }
          });
        });
      } catch (error) {
        console.error(`Exception en query de potencia para ${plantName}:`, error);
      }

      // Energía individual
      try {
        await new Promise((resolve, reject) => {
          queryApi.queryRows(createEnergyQueryForPlant(plantName), {
            next(row, tableMeta) {
              const rowData = tableMeta.toObject(row);
              if (!plantsData.has(plantName)) {
                plantsData.set(plantName, {});
              }
              plantsData.get(plantName).energy = (rowData._value || 0) / 1000;
            },
            error(error) {
              console.error(`Error en query de energía para ${plantName}:`, error);
              resolve();
            },
            complete() {
              resolve();
            }
          });
        });
      } catch (error) {
        console.error(`Exception en query de energía para ${plantName}:`, error);
      }

      // Irradiancia individual
      try {
        await new Promise((resolve, reject) => {
          queryApi.queryRows(createIrradianceQueryForPlant(plantName), {
            next(row, tableMeta) {
              const rowData = tableMeta.toObject(row);
              if (!plantsData.has(plantName)) {
                plantsData.set(plantName, {});
              }
              plantsData.get(plantName).irradiance = rowData._value || 0;
            },
            error(error) {
              console.error(`Error en query de irradiancia para ${plantName}:`, error);
              resolve();
            },
            complete() {
              resolve();
            }
          });
        });
      } catch (error) {
        console.error(`Exception en query de irradiancia para ${plantName}:`, error);
      }

      // Irradiación individual
      try {
        await new Promise((resolve, reject) => {
          queryApi.queryRows(createIrradiationQueryForPlant(plantName), {
            next(row, tableMeta) {
              const rowData = tableMeta.toObject(row);
              if (!plantsData.has(plantName)) {
                plantsData.set(plantName, {});
              }
              plantsData.get(plantName).irradiation = rowData._value || 0;
            },
            error(error) {
              console.error(`Error en query de irradiación para ${plantName}:`, error);
              resolve();
            },
            complete() {
              resolve();
            }
          });
        });
      } catch (error) {
        console.error(`Exception en query de irradiación para ${plantName}:`, error);
      }

      // ✅ RENTABILIDAD INDIVIDUAL - CON LOGGING MEJORADO
      try {
        console.log(`🔍 Ejecutando query de rentabilidad CORREGIDA para ${plantName}...`);

        let dataCount = 0;
        await new Promise((resolve, reject) => {
          queryApi.queryRows(createProfitabilityQueryForPlant(plantName), {
            next(row, tableMeta) {
              const rowData = tableMeta.toObject(row);
              dataCount++;
              console.log(`✅ DATOS RENTABILIDAD ${plantName} [${dataCount}]:`, {
                value: rowData._value,
                mean: rowData.mean,
                time: rowData._time,
                allFields: rowData
              });

              if (!plantsData.has(plantName)) {
                plantsData.set(plantName, {});
              }

              // El resultado de sum() viene en _value
              plantsData.get(plantName).profitability = rowData._value || rowData.mean || 0;
            },
            error(error) {
              console.error(`❌ Error en query de rentabilidad para ${plantName}:`, error);
              resolve();
            },
            complete() {
              const finalValue = plantsData.get(plantName)?.profitability || 0;
              console.log(`🏁 Query rentabilidad ${plantName} completada. Filas: ${dataCount}, Valor final: ${finalValue}`);
              resolve();
            }
          });
        });
      } catch (error) {
        console.error(`💥 Exception en query de rentabilidad para ${plantName}:`, error);
      }

      // Disposición eléctrica individual
      try {
        await new Promise((resolve, reject) => {
          queryApi.queryRows(createElecDispoQueryForPlant(plantName), {
            next(row, tableMeta) {
              const rowData = tableMeta.toObject(row);
              if (!plantsData.has(plantName)) {
                plantsData.set(plantName, {});
              }
              plantsData.get(plantName).elecDispo = rowData._value || 0;
            },
            error(error) {
              console.error(`Error en query de disposición eléctrica para ${plantName}:`, error);
              resolve();
            },
            complete() {
              resolve();
            }
          });
        });
      } catch (error) {
        console.error(`Exception en query de disposición eléctrica para ${plantName}:`, error);
      }

      // Disposición mecánica individual
      try {
        await new Promise((resolve, reject) => {
          queryApi.queryRows(createMecDispoQueryForPlant(plantName), {
            next(row, tableMeta) {
              const rowData = tableMeta.toObject(row);
              if (!plantsData.has(plantName)) {
                plantsData.set(plantName, {});
              }
              // Solo asignar valor si es RETAMAR, para LAMAJA dejarlo como null
              if (plantName === 'RETAMAR') {
                plantsData.get(plantName).mecDispo = rowData._value || 0;
              } else {
                plantsData.get(plantName).mecDispo = null; // LAMAJA no tiene datos
              }
            },
            error(error) {
              console.error(`Error en query de disposición mecánica para ${plantName}:`, error);
              // Para LAMAJA, establecer explícitamente como null
              if (plantName === 'LAMAJA') {
                if (!plantsData.has(plantName)) {
                  plantsData.set(plantName, {});
                }
                plantsData.get(plantName).mecDispo = null;
              }
              resolve();
            },
            complete() {
              resolve();
            }
          });
        });
      } catch (error) {
        console.error(`Exception en query de disposición mecánica para ${plantName}:`, error);
        // Para LAMAJA, establecer explícitamente como null
        if (plantName === 'LAMAJA') {
          if (!plantsData.has(plantName)) {
            plantsData.set(plantName, {});
          }
          plantsData.get(plantName).mecDispo = null;
        }
      }

      // ✅ PR (Performance Ratio) individual - CON LOGGING
      try {
        console.log(`🔍 Ejecutando query de PR para ${plantName}...`);
        let dataCount = 0;
        await new Promise((resolve, reject) => {
          queryApi.queryRows(createPRQueryForPlant(plantName), {
            next(row, tableMeta) {
              const rowData = tableMeta.toObject(row);
              dataCount++;
              console.log(`✅ DATOS PR ${plantName} [${dataCount}]:`, {
                PR: rowData.PR,
                EPV: rowData.EPV,
                H_PoA: rowData.H_PoA,
                time: rowData._time,
                allFields: rowData
              });
              if (!plantsData.has(plantName)) {
                plantsData.set(plantName, {});
              }
              plantsData.get(plantName).pr = rowData.PR || 0;
            },
            error(error) {
              console.error(`❌ Error en query de PR para ${plantName}:`, error);
              resolve();
            },
            complete() {
              const finalValue = plantsData.get(plantName)?.pr || 0;
              console.log(`🏁 Query PR ${plantName} completada. Filas: ${dataCount}, Valor final: ${finalValue}`);
              resolve();
            }
          });
        });
      } catch (error) {
        console.error(`💥 Exception en query de PR para ${plantName}:`, error);
      }
    }

    // CÁLCULO DE FALLBACKS
    if (totalPower === 0) {
      plantsData.forEach((data) => {
        totalPower += data.power || 0;
      });
    }

    if (totalEnergy === 0) {
      plantsData.forEach((data) => {
        totalEnergy += data.energy || 0;
      });
    }

    if (totalIrradiance === 0) {
      const lamajaIrradiance = plantsData.get('LAMAJA')?.irradiance || 0;
      const retamarIrradiance = plantsData.get('RETAMAR')?.irradiance || 0;
      totalIrradiance = (4400.0 * lamajaIrradiance + 3300.0 * retamarIrradiance) / 7700.0;
    }

    if (totalIrradiation === 0) {
      plantsData.forEach((data) => {
        totalIrradiation += data.irradiation || 0;
      });
    }

    // ✅ FALLBACK CORREGIDO PARA DISPOSICIÓN ELÉCTRICA
    if (totalElecDispo === 0) {
      const lamajaElecDispo = plantsData.get('LAMAJA')?.elecDispo || 0;
      const retamarElecDispo = plantsData.get('RETAMAR')?.elecDispo || 0;

      if (lamajaElecDispo > 0 || retamarElecDispo > 0) {
        totalElecDispo = (lamajaElecDispo * 4.4 + retamarElecDispo * 3.33) / 7.73;
      }
    }

    if (totalMecDispo === 0) {
      // Para disposición mecánica, solo usar RETAMAR (LAMAJA no tiene datos)
      const retamarMecDispo = plantsData.get('RETAMAR')?.mecDispo || 0;
      totalMecDispo = retamarMecDispo;
    }

    // ✅ FALLBACK CORREGIDO PARA PR - CON LOGGING
    if (totalPR === 0) {
      console.log('⚠️ PR total es 0, calculando desde plantas individuales...');
      // Para PR, usar fórmula ponderada si hay datos individuales
      const lamajaPR = plantsData.get('LAMAJA')?.pr || 0;
      const retamarPR = plantsData.get('RETAMAR')?.pr || 0;

      console.log(`PR individual LAMAJA: ${lamajaPR}%`);
      console.log(`PR individual RETAMAR: ${retamarPR}%`);

      if (lamajaPR > 0 || retamarPR > 0) {
        // Usar el promedio ponderado correcto con 7700.0
        totalPR = (lamajaPR * 4400.0 + retamarPR * 3300.0) / 7700.0;
        console.log(`🔧 PR total calculado (fallback): ${totalPR}%`);
      }
    }

    // ✅ FALLBACK PARA RENTABILIDAD - MEJORADO
    console.log('🔄 Verificando rentabilidad...');
    console.log('Total Profitability:', totalProfitability);

    // Mostrar rentabilidad por planta
    plantsData.forEach((data, plantName) => {
      console.log(`Rentabilidad ${plantName}:`, data.profitability || 0);
    });

    // Si la rentabilidad total es 0, calcular desde plantas individuales
    if (totalProfitability === 0) {
      console.log('⚠️ Rentabilidad total es 0, calculando desde plantas...');

      // Sumar rentabilidad de plantas individuales
      plantsData.forEach((data) => {
        totalProfitability += data.profitability || 0;
      });

      console.log('🔧 Rentabilidad total desde plantas:', totalProfitability);
    }

    console.log('✅ Rentabilidad final total:', totalProfitability);

    // LOGGING FINAL DE PR
    console.log('=== RESUMEN FINAL PR ===');
    console.log(`PR total final: ${totalPR}%`);
    console.log(`PR LAMAJA: ${plantsData.get('LAMAJA')?.pr || 0}%`);
    console.log(`PR RETAMAR: ${plantsData.get('RETAMAR')?.pr || 0}%`);

    // EJECUTAR QUERY DE DATOS GEOGRÁFICOS
    try {
      await new Promise((resolve, reject) => {
        queryApi.queryRows(geoDataQuery, {
          next(row, tableMeta) {
            const rowData = tableMeta.toObject(row);
            geoData.push({
              plant: rowData.Plant,
              AvEle: rowData.AvEle || 0,
              AvMec: rowData.AvMec || 0,
              Irrad: rowData.Irrad || 0,
              latitude: rowData.latitude,
              longitude: rowData.longitude
            });
          },
          error(error) {
            console.error('Error en query geo data:', error);
            resolve();
          },
          complete() {
            resolve();
          }
        });
      });
    } catch (error) {
      console.error('Exception en query geo data:', error);
    }

    // COMBINAR DATOS
    const combinedData = Array.from(plantsData.entries()).map(([plantName, plantData]) => {
      const geoInfo = geoData.find(g =>
        g.plant && plantName &&
        g.plant.toLowerCase() === plantName.toLowerCase()
      ) || {};

      return {
        name: plantName,
        powerMW: plantData.power || 0,
        energyMWh: plantData.energy || 0,
        irradiance: plantData.irradiance || geoInfo.Irrad || 0,
        irradiation: plantData.irradiation || 0,
        profitabilityMWh: plantData.profitability || 0,
        dispoElec: plantData.elecDispo || geoInfo.AvEle || 0,
        dispoMec: plantData.mecDispo !== null ? plantData.mecDispo : null, // Mantener null para LAMAJA
        pr: plantData.pr || 0,
        coordinates: [geoInfo.latitude || 0, geoInfo.longitude || 0],
        timestamp: plantData.timestamp
      };
    });

    return Response.json({
      success: true,
      totalPower: totalPower,
      totalEnergy: Math.round(totalEnergy * 100) / 100,
      totalIrradiance: Math.round(totalIrradiance * 100) / 100,
      totalIrradiation: Math.round(totalIrradiation * 100) / 100,
      totalElecDispo: Math.round(totalElecDispo * 100) / 100,
      totalMecDispo: Math.round(totalMecDispo * 100) / 100,
      totalPR: Math.round(totalPR * 100) / 100,
      totalProfitability: Math.round(totalProfitability * 100) / 100,
      plants: combinedData,
      metadata: {
        plantsDiscovered: availablePlants,
        dataSource: 'exact_grafana_replica'
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error obteniendo datos de plantas:', error);
    return Response.json(
      {
        success: false,
        error: 'Error al obtener datos de las plantas',
        totalPower: 0,
        totalEnergy: 0,
        totalIrradiance: 0,
        totalIrradiation: 0,
        totalElecDispo: 0,
        totalMecDispo: 0,
        totalPR: 0,
        totalProfitability: 0,
        plants: []
      },
      { status: 500 }
    );
  }
}