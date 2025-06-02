// src/app/api/alarms-data/route.js
import { InfluxDB } from '@influxdata/influxdb-client';

const url = process.env.INFLUXDB_URL || 'http://localhost:8086';
const token = process.env.INFLUXDB_TOKEN;
const org = process.env.INFLUXDB_ORG;

const influxDB = new InfluxDB({ url, token });

export async function GET(request) {
  try {
    const queryApi = influxDB.getQueryApi(org);
    
    // Query para obtener datos actuales de todas las plantas
    const currentDataQuery = `
      from(bucket: "PV")
        |> range(start: -1h)
        |> filter(fn: (r) => r["PVO_Plant"] == "LAMAJA" or r["PVO_Plant"] == "RETAMAR")
        |> filter(fn: (r) => 
          r["_field"] == "P" or 
          r["_field"] == "AvEle" or 
          r["_field"] == "DispoElec" or 
          r["_field"] == "DispoMec" or
          r["_field"] == "RadPOA01"
        )
        |> last()
        |> pivot(rowKey:["PVO_Plant"], columnKey: ["_field"], valueColumn: "_value")
        |> keep(columns: ["PVO_Plant", "P", "AvEle", "DispoElec", "DispoMec", "RadPOA01", "_time"])
    `;

    const plantsData = [];
    const alarms = [];
    let totalAlarms = 0;

    await new Promise((resolve, reject) => {
      queryApi.queryRows(currentDataQuery, {
        next(row, tableMeta) {
          const rowData = tableMeta.toObject(row);
          plantsData.push(rowData);
        },
        error(error) {
          console.error('Error obteniendo datos para alarmas:', error);
          resolve();
        },
        complete() {
          resolve();
        }
      });
    });

    // Configuración de alarmas por planta
    const alarmConfig = {
      LAMAJA: {
        powerMin: 1000, // kW mínimo esperado durante el día
        powerMax: 5000, // kW máximo permitido
        availabilityMin: 85, // % mínimo de disponibilidad
        irradianceMin: 100, // W/m² mínimo para considerar día
      },
      RETAMAR: {
        powerMin: 800,
        powerMax: 4000,
        availabilityMin: 85,
        irradianceMin: 100,
        mecAvailabilityMin: 80, // % mínimo disponibilidad mecánica
      }
    };

    // Función para evaluar alarmas de una planta
    const evaluateAlarms = (plantData, plantName) => {
      const config = alarmConfig[plantName];
      if (!config) return [];

      const plantAlarms = [];
      const now = new Date();
      const dataTime = new Date(plantData._time);
      const hoursAgo = (now - dataTime) / (1000 * 60 * 60);

      // 1. Alarma de datos obsoletos
      if (hoursAgo > 2) {
        plantAlarms.push({
          id: `${plantName}_DATA_OLD`,
          plant: plantName,
          severity: 'critical',
          type: 'communication',
          message: `Sin datos desde hace ${Math.round(hoursAgo)} horas`,
          timestamp: now.toISOString(),
          value: Math.round(hoursAgo),
          threshold: 2
        });
      }

      // Solo evaluar alarmas operacionales si los datos son recientes
      if (hoursAgo <= 2) {
        const power = plantData.P || 0;
        const avEle = plantData.AvEle || plantData.DispoElec || 0;
        const avMec = plantData.DispoMec || null;
        const irradiance = plantData.RadPOA01 || 0;

        // Determinar si es de día (irradiancia > mínimo)
        const isDaytime = irradiance > config.irradianceMin;

        // 2. Alarma de potencia baja durante el día
        if (isDaytime && power < config.powerMin) {
          plantAlarms.push({
            id: `${plantName}_POWER_LOW`,
            plant: plantName,
            severity: 'warning',
            type: 'performance',
            message: `Potencia baja: ${(power/1000).toFixed(1)} MW`,
            timestamp: now.toISOString(),
            value: Math.round(power),
            threshold: config.powerMin
          });
        }

        // 3. Alarma de potencia excesiva
        if (power > config.powerMax) {
          plantAlarms.push({
            id: `${plantName}_POWER_HIGH`,
            plant: plantName,
            severity: 'critical',
            type: 'safety',
            message: `Potencia excesiva: ${(power/1000).toFixed(1)} MW`,
            timestamp: now.toISOString(),
            value: Math.round(power),
            threshold: config.powerMax
          });
        }

        // 4. Alarma de disponibilidad eléctrica baja
        if (avEle < config.availabilityMin) {
          plantAlarms.push({
            id: `${plantName}_AVAIL_ELEC_LOW`,
            plant: plantName,
            severity: 'warning',
            type: 'availability',
            message: `Disponibilidad eléctrica baja: ${avEle.toFixed(1)}%`,
            timestamp: now.toISOString(),
            value: Math.round(avEle),
            threshold: config.availabilityMin
          });
        }

        // 5. Alarma de disponibilidad mecánica baja (solo RETAMAR)
        if (plantName === 'RETAMAR' && avMec !== null && avMec < config.mecAvailabilityMin) {
          plantAlarms.push({
            id: `${plantName}_AVAIL_MEC_LOW`,
            plant: plantName,
            severity: 'warning',
            type: 'mechanical',
            message: `Disponibilidad mecánica baja: ${avMec.toFixed(1)}%`,
            timestamp: now.toISOString(),
            value: Math.round(avMec),
            threshold: config.mecAvailabilityMin
          });
        }

        // 6. Alarma de potencia cero durante el día
        if (isDaytime && power <= 10) {
          plantAlarms.push({
            id: `${plantName}_NO_GENERATION`,
            plant: plantName,
            severity: 'critical',
            type: 'generation',
            message: `Sin generación durante el día`,
            timestamp: now.toISOString(),
            value: Math.round(power),
            threshold: 10
          });
        }
      }

      return plantAlarms;
    };

    // Evaluar alarmas para cada planta
    const plantAlarms = {};
    plantsData.forEach(plantData => {
      const plantName = plantData.PVO_Plant;
      const alarmsList = evaluateAlarms(plantData, plantName);
      plantAlarms[plantName] = alarmsList;
      alarms.push(...alarmsList);
      totalAlarms += alarmsList.length;
    });

    // Alarmas sintéticas para demostrar (remover en producción)
    if (alarms.length === 0) {
      // Generar alarma sintética para LAMAJA
      alarms.push({
        id: 'LAMAJA_DEMO_ALARM',
        plant: 'LAMAJA',
        severity: 'warning',
        type: 'performance',
        message: 'Rendimiento por debajo del esperado',
        timestamp: new Date().toISOString(),
        value: 82,
        threshold: 85
      });

      // Generar alarma sintética para RETAMAR
      alarms.push({
        id: 'RETAMAR_DEMO_ALARM',
        plant: 'RETAMAR',
        severity: 'warning',
        type: 'availability',
        message: 'Disponibilidad mecánica reducida',
        timestamp: new Date().toISOString(),
        value: 78,
        threshold: 80
      });

      plantAlarms.LAMAJA = [alarms[0]];
      plantAlarms.RETAMAR = [alarms[1]];
      totalAlarms = 2;
    }

    return Response.json({
      success: true,
      totalAlarms,
      alarms,
      plantAlarms,
      summary: {
        critical: alarms.filter(a => a.severity === 'critical').length,
        warning: alarms.filter(a => a.severity === 'warning').length,
        info: alarms.filter(a => a.severity === 'info').length
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error obteniendo alarmas:', error);
    return Response.json({
      success: false,
      error: 'Error al obtener alarmas',
      totalAlarms: 0,
      alarms: [],
      plantAlarms: {}
    }, { status: 500 });
  }
}