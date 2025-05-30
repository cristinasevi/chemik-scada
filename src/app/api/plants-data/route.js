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

    // 2. POTENCIA TOTAL - Replica exacta de tu query de Grafana
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

    // 3. ENERGÍA TOTAL - Replica exacta de tu query de Grafana
    const totalEnergyQuery = `
      from(bucket: "PV")
        |> range(start: -24h)
        |> filter(fn: (r) => ${availablePlants.map(plant => `r["PVO_Plant"] == "${plant}"`).join(' or ')})
        |> filter(fn: (r) => r["type"] == "calculado")
        |> filter(fn: (r) => r["_field"] == "EPV")
        |> last()
        |> keep(columns: ["_time","PVO_Plant", "_value"])
        |> pivot(rowKey:["_time"], columnKey: ["PVO_Plant"], valueColumn: "_value")
        |> map(fn: (r) => ({
            r with
            suma: ${availablePlants.map(plant => `r.${plant}`).join(' + ')}
        }))
        |> keep(columns: ["_time","suma"])
    `;

    // 4. POTENCIA INDIVIDUAL - Para cada planta
    const createPowerQueryForPlant = (plantName) => `
      from(bucket: "PV")
        |> range(start: -24h)
        |> filter(fn: (r) => r["PVO_Plant"] == "${plantName}")
        |> filter(fn: (r) => r["PVO_id"] == "66KV" or r["PVO_id"] == "CONTADOR01")
        |> filter(fn: (r) => r["_field"] == "P")
        |> aggregateWindow(every: 20m, fn: mean, createEmpty: false)
        |> last()
    `;

    // 5. ENERGÍA INDIVIDUAL - Para cada planta
    const createEnergyQueryForPlant = (plantName) => `
      from(bucket: "PV")
        |> range(start: -24h)
        |> filter(fn: (r) => r["PVO_Plant"] == "${plantName}")
        |> filter(fn: (r) => r["type"] == "calculado")
        |> filter(fn: (r) => r["_field"] == "EPV")
        |> last()
    `;

    // 6. IRRADIANCIA TOTAL - Replica exacta de tu query de Grafana
    const totalIrradianceQuery = `
      from(bucket: "PV")
        |> range(start: -24h)
        |> filter(fn: (r) => ${availablePlants.map(plant => `r["PVO_Plant"] == "${plant}"`).join(' or ')})
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

    // 7. IRRADIANCIA INDIVIDUAL - Para cada planta
    const createIrradianceQueryForPlant = (plantName) => `
      from(bucket: "PV")
        |> range(start: -24h)
        |> filter(fn: (r) => r["PVO_Plant"] == "${plantName}")
        |> filter(fn: (r) => r["PVO_type"] == "METEO")
        |> filter(fn: (r) => r["_field"] == "RadPOA01")
        |> aggregateWindow(every: 20m, fn: mean, createEmpty: false)
        |> last()
    `;

    // 8. RENTABILIDAD TOTAL - Replica exacta de tu query de Grafana
    const totalProfitabilityQuery = `
      from(bucket: "PV")
        |> range(start: -24h)
        |> filter(fn: (r) => ${availablePlants.map(plant => `r["PVO_Plant"] == "${plant}"`).join(' or ')})
        |> filter(fn: (r) => r["type"] == "calculado")
        |> filter(fn: (r) => r["_field"] == "EPV")
        |> aggregateWindow(every: 1h, fn: sum, createEmpty: false)
        |> last()
        |> keep(columns: ["_time","PVO_Plant", "_value"])
        |> pivot(rowKey:["_time"], columnKey: ["PVO_Plant"], valueColumn: "_value")
        |> map(fn: (r) => ({
            r with
            suma: (r.LAMAJA + r.RETAMAR) / 1000.0
        }))
        |> keep(columns: ["_time","suma"])
        |> filter(fn: (r) => r.suma >= 0.0)
    `;

    // 9. RENTABILIDAD INDIVIDUAL - Para cada planta
    const createProfitabilityQueryForPlant = (plantName) => `
      from(bucket: "PV")
        |> range(start: -24h)
        |> filter(fn: (r) => r["PVO_Plant"] == "${plantName}")
        |> filter(fn: (r) => r["type"] == "calculado")
        |> filter(fn: (r) => r["_field"] == "EPV")
        |> aggregateWindow(every: 1h, fn: sum, createEmpty: false)
        |> last()
        |> map(fn: (r) => ({ r with _value: r._value / 1000.0 }))
        |> filter(fn: (r) => r._value >= 0.0)
    `;

    // 10. Query para datos geográficos
    const geoDataQuery = `
      from(bucket: "GeoMap")
        |> range(start: -24h)
        |> filter(fn: (r) => r["_measurement"] == "modbus")
        |> last()
        |> pivot(rowKey:["_time"], columnKey: ["_field"], valueColumn: "_value")
        |> keep(columns: ["AvEle","AvMec","Irrad","latitude","longitude","Plant"])
    `;

    let totalPower = 0;
    let totalEnergy = 0;
    let totalIrradiance = 0;
    let totalProfitability = 0;
    let plantsData = new Map();
    let geoData = [];

    // Ejecutar query de potencia total
    try {
      await new Promise((resolve, reject) => {
        queryApi.queryRows(totalPowerQuery, {
          next(row, tableMeta) {
            const rowData = tableMeta.toObject(row);
            totalPower = (rowData.suma || 0) / 1000; // Convertir a MW
          },
          error(error) {
            console.error('Error en query de potencia total:', error);
            resolve(); // Continuar sin bloquear
          },
          complete() {
            resolve();
          }
        });
      });
    } catch (error) {
      console.error('Exception en query de potencia total:', error);
    }

    // Ejecutar query de energía total
    try {
      await new Promise((resolve, reject) => {
        queryApi.queryRows(totalEnergyQuery, {
          next(row, tableMeta) {
            const rowData = tableMeta.toObject(row);
            totalEnergy = (rowData.suma || 0) / 1000; // Convertir a MWh
          },
          error(error) {
            console.error('Error en query de energía total:', error);
            resolve(); // Continuar sin bloquear
          },
          complete() {
            resolve();
          }
        });
      });
    } catch (error) {
      console.error('Exception en query de energía total:', error);
    }

    // Ejecutar query de irradiancia total
    try {
      await new Promise((resolve, reject) => {
        queryApi.queryRows(totalIrradianceQuery, {
          next(row, tableMeta) {
            const rowData = tableMeta.toObject(row);
            totalIrradiance = rowData.suma || 0; // Ya está en las unidades correctas
          },
          error(error) {
            console.error('Error en query de irradiancia total:', error);
            resolve(); // Continuar sin bloquear
          },
          complete() {
            resolve();
          }
        });
      });
    } catch (error) {
      console.error('Exception en query de irradiancia total:', error);
    }

    // Ejecutar query de rentabilidad total
    try {
      await new Promise((resolve, reject) => {
        queryApi.queryRows(totalProfitabilityQuery, {
          next(row, tableMeta) {
            const rowData = tableMeta.toObject(row);
            totalProfitability = rowData.suma || 0; // Ya está en MWh
          },
          error(error) {
            console.error('Error en query de rentabilidad total:', error);
            resolve(); // Continuar sin bloquear
          },
          complete() {
            resolve();
          }
        });
      });
    } catch (error) {
      console.error('Exception en query de rentabilidad total:', error);
    }

    // Ejecutar queries individuales para cada planta
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
              plantsData.get(plantName).power = (rowData._value || 0) / 1000; // Convertir kW a MW (mantener negativos)
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
              plantsData.get(plantName).energy = (rowData._value || 0) / 1000; // Convertir kWh a MWh
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
              plantsData.get(plantName).irradiance = rowData._value || 0; // W/m²
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

      // Rentabilidad individual
      try {
        await new Promise((resolve, reject) => {
          queryApi.queryRows(createProfitabilityQueryForPlant(plantName), {
            next(row, tableMeta) {
              const rowData = tableMeta.toObject(row);
              if (!plantsData.has(plantName)) {
                plantsData.set(plantName, {});
              }
              plantsData.get(plantName).profitability = (rowData._value || 0) / 1000; // Convertir kWh a MWh
            },
            error(error) {
              console.error(`Error en query de rentabilidad para ${plantName}:`, error);
              resolve();
            },
            complete() {
              resolve();
            }
          });
        });
      } catch (error) {
        console.error(`Exception en query de rentabilidad para ${plantName}:`, error);
      }
    }

    // Si las queries totales fallaron, calcular desde datos individuales
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
      // Para irradiancia, usar la fórmula ponderada como en Grafana
      const lamajaIrradiance = plantsData.get('LAMAJA')?.irradiance || 0;
      const retamarIrradiance = plantsData.get('RETAMAR')?.irradiance || 0;
      totalIrradiance = (4400.0 * lamajaIrradiance + 3300.0 * retamarIrradiance) / 7700.0;
    }

    if (totalProfitability === 0) {
      // Para rentabilidad, sumar los valores individuales
      plantsData.forEach((data) => {
        totalProfitability += data.profitability || 0;
      });
    }

    // Ejecutar query de datos geográficos
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
          reject(error);
        },
        complete() {
          resolve();
        }
      });
    });

    // Combinar todos los datos
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
        profitabilityMWh: plantData.profitability || 0,
        dispoElec: geoInfo.AvEle || 0,
        dispoMec: geoInfo.AvMec || 0,
        coordinates: [geoInfo.latitude || 0, geoInfo.longitude || 0],
        timestamp: plantData.timestamp
      };
    });

    return Response.json({
      success: true,
      totalPower: Math.round(totalPower * 100) / 100,
      totalEnergy: Math.round(totalEnergy * 100) / 100,
      totalIrradiance: Math.round(totalIrradiance * 100) / 100,
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
        totalProfitability: 0,
        plants: []
      },
      { status: 500 }
    );
  }
}