export async function GET(request) {
  try {
    // Configuración de la API de Grafana
    const grafanaUrl = process.env.GRAFANA_URL || 'http://localhost:3000';
    const grafanaToken = process.env.GRAFANA_TOKEN;
    
    if (!grafanaToken) {     
      // Usar alarmas de ejemplo si no hay token
      const fallbackAlarms = createFallbackAlarms();
      const plantAlarms = groupAlarmsByPlant(fallbackAlarms);
      const summary = calculateAlarmSummary(fallbackAlarms);
      
      return Response.json({
        success: false,
        error: 'Token de Grafana no configurado - usando datos de ejemplo',
        totalAlarms: fallbackAlarms.length,
        alarms: fallbackAlarms,
        plantAlarms,
        summary,
        timestamp: new Date().toISOString(),
        source: 'fallback'
      });
    }

    const headers = {
      'Authorization': `Bearer ${grafanaToken}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    };

    // Obtener alertas activas del Alertmanager de Grafana
    const alertsResponse = await fetch(`${grafanaUrl}/api/alertmanager/grafana/api/v2/alerts`, {
      headers,
      timeout: 10000 // 10 segundos de timeout
    });

    if (!alertsResponse.ok) {
      // Fallback con datos de ejemplo
      return generateFallbackResponse('Error de conexión con Grafana');
    }

    const activeAlerts = await alertsResponse.json();

    // Procesar y mapear las alarmas
    const mappedAlarms = [];
    
    for (const alert of activeAlerts) {
      // Solo procesar alertas en estado 'firing'
      if (alert.status?.state === 'active' || alert.status?.state === 'firing') {
        const mappedAlarm = mapGrafanaAlertToStandard(alert);
        if (mappedAlarm) {
          mappedAlarms.push(mappedAlarm);
        }
      }
    }

    // Si no hay alertas reales, usar datos de demostración
    let finalAlarms = mappedAlarms;
    if (mappedAlarms.length === 0) {
      finalAlarms = generateDemoAlarms();
    }

    // Agrupar por planta y calcular estadísticas
    const plantAlarms = groupAlarmsByPlant(finalAlarms);
    const summary = calculateAlarmSummary(finalAlarms);

    return Response.json({
      success: true,
      totalAlarms: finalAlarms.length,
      alarms: finalAlarms,
      plantAlarms,
      summary,
      timestamp: new Date().toISOString(),
      source: 'grafana_api',
      alertsCount: activeAlerts.length
    });

  } catch (error) {
    return generateFallbackResponse(error.message);
  }
}

// Función para generar respuesta de fallback
function generateFallbackResponse(errorMessage) {
  const fallbackAlarms = [
    {
      id: 'FALLBACK_CONNECTION_ERROR',
      plant: 'LAMAJA',
      severity: 'warning',
      type: 'communication',
      message: `Error de conexión con Grafana: ${errorMessage}`,
      timestamp: new Date().toISOString(),
      value: null,
      threshold: null,
      grafanaData: {
        ruleId: 'connection_fallback',
        fingerprint: 'fallback_001'
      }
    }
  ];

  const plantAlarms = groupAlarmsByPlant(fallbackAlarms);
  const summary = calculateAlarmSummary(fallbackAlarms);

  return Response.json({
    success: false,
    error: errorMessage,
    totalAlarms: fallbackAlarms.length,
    alarms: fallbackAlarms,
    plantAlarms,
    summary,
    timestamp: new Date().toISOString(),
    source: 'fallback'
  }, { status: 500 });
}

// Función para generar alarmas de demostración
function generateDemoAlarms() {
  const now = new Date().toISOString();
  
  return [
    {
      id: 'DEMO_LAMAJA_SUBSTATION_01',
      plant: 'LAMAJA',
      severity: 'warning',
      type: 'substation',
      message: 'La Maja: Fallo subestación 01',
      description: 'Alguna alarma en la subestación.',
      timestamp: now,
      device: 'SUBESTACION_01',
      value: 1,
      threshold: 0,
      grafanaData: {
        ruleId: 'LAMAJA_SUBSTATION_01',
        fingerprint: 'demo_lamaja_sub_001',
        priority: 'Alta'
      }
    },
    {
      id: 'DEMO_RETAMAR_INV_03',
      plant: 'RETAMAR',
      severity: 'critical',
      type: 'inverter',
      message: 'Retamar Inv. 03: Alarma',
      description: 'Inversor 03 no disponible para producción.',
      timestamp: now,
      device: 'INV03',
      value: 1,
      threshold: 0,
      grafanaData: {
        ruleId: 'RETAMAR_INV_03',
        fingerprint: 'demo_retamar_inv_003',
        priority: 'Media'
      }
    },
    {
      id: 'DEMO_RETAMAR_TRK_15',
      plant: 'RETAMAR',
      severity: 'warning',
      type: 'tracker',
      message: 'Retamar Trk. 15: Alarma',
      description: 'Tracker 15 con alguna alarma activa.',
      timestamp: now,
      device: 'TRK15',
      value: 1,
      threshold: 0,
      grafanaData: {
        ruleId: 'RETAMAR_TRK_15',
        fingerprint: 'demo_retamar_trk_015',
        priority: 'Media'
      }
    },
    {
      id: 'DEMO_RETAMAR_UPS_CT01',
      plant: 'RETAMAR',
      severity: 'critical',
      type: 'power',
      message: 'Retamar: Fallo UPS CT01',
      description: 'UPS CT01 en modo batería o en alarma.',
      timestamp: now,
      device: 'UPS_CT01',
      value: 1,
      threshold: 0,
      grafanaData: {
        ruleId: 'RETAMAR_UPS_CT01',
        fingerprint: 'demo_retamar_ups_001',
        priority: 'Alta'
      }
    },
    {
      id: 'DEMO_RETAMAR_CPM_RELE',
      plant: 'RETAMAR',
      severity: 'critical',
      type: 'protection',
      message: 'Retamar: Fallo rele CPM',
      description: 'ReleCPM disparado o con alarmas activas.',
      timestamp: now,
      device: 'RELE_CPM',
      value: 1,
      threshold: 0,
      grafanaData: {
        ruleId: 'RETAMAR_CPM_RELE',
        fingerprint: 'demo_retamar_cpm_001',
        priority: 'Alta'
      }
    }
  ];
}

// Función para crear alarmas de fallback
function createFallbackAlarms() {
  const now = new Date().toISOString();
  
  return [
    {
      id: 'FALLBACK_TOKEN_ERROR',
      plant: 'LAMAJA',
      severity: 'warning',
      type: 'communication',
      message: 'Token de Grafana no configurado - Usando datos de ejemplo',
      timestamp: now,
      value: null,
      threshold: null,
      grafanaData: {
        ruleId: 'token_fallback',
        fingerprint: 'fallback_002'
      }
    }
  ];
}

// Función para mapear alertas de Grafana a nuestro formato
function mapGrafanaAlertToStandard(alert) {
  const labels = alert.labels || {};
  const annotations = alert.annotations || {};
  
  const plant = getPlantFromAlert(alert);
  if (plant === 'UNKNOWN') {
    return null; // Filtrar alarmas que no pertenecen a nuestras plantas
  }
  
  const severity = getSeverityFromPriority(labels.Prioridad);
  const alarmType = getAlarmType(alert);
  const deviceNumber = extractDeviceNumber(labels.alertname || '');
  
  return {
    id: `${plant}_${labels.alertname}_${alert.fingerprint}`,
    plant: plant,
    severity: severity,
    type: alarmType,
    message: annotations.summary || annotations.description || labels.alertname || 'Alarma activa',
    description: annotations.description || null,
    timestamp: alert.startsAt || new Date().toISOString(),
    device: deviceNumber,
    value: null, // Grafana no siempre proporciona el valor actual
    threshold: null,
    grafanaData: {
      ruleId: labels.alertname,
      fingerprint: alert.fingerprint,
      generatorURL: alert.generatorURL,
      priority: labels.Prioridad,
      folder: labels.folder
    }
  };
}

// Utilidades de mapeo
function getSeverityFromPriority(priority) {
  switch (priority?.toLowerCase()) {
    case 'alta':
      return 'critical';
    case 'media':
      return 'warning';
    case 'baja':
      return 'info';
    default:
      return 'warning';
  }
}

function getPlantFromAlert(alert) {
  const alertname = alert.labels?.alertname || '';
  const summary = alert.annotations?.summary || '';
  const description = alert.annotations?.description || '';
  const folder = alert.labels?.folder || '';
  
  const searchText = `${alertname} ${summary} ${description} ${folder}`.toLowerCase();
  
  if (searchText.includes('lamaja') || searchText.includes('la maja')) {
    return 'LAMAJA';
  } else if (searchText.includes('retamar')) {
    return 'RETAMAR';
  }
  
  return 'UNKNOWN';
}

function getAlarmType(alert) {
  const alertname = alert.labels?.alertname || '';
  const summary = alert.annotations?.summary || '';
  const searchText = `${alertname} ${summary}`.toLowerCase();
  
  // Mapeo basado en patrones del JSON de configuración
  if (searchText.includes('inv') && searchText.includes('alarma')) {
    return 'inverter';
  } else if (searchText.includes('trk') && searchText.includes('alarma')) {
    return 'tracker';
  } else if (searchText.includes('subestacion') || searchText.includes('subestación')) {
    return 'substation';
  } else if (searchText.includes('meteo')) {
    return 'weather';
  } else if (searchText.includes('comunicacion') || searchText.includes('comunicación') || searchText.includes('com.')) {
    return 'communication';
  } else if (searchText.includes('ups')) {
    return 'power';
  } else if (searchText.includes('rele') || searchText.includes('relé') || searchText.includes('cpm')) {
    return 'protection';
  } else if (searchText.includes('contador') || searchText.includes('cont')) {
    return 'measurement';
  }
  
  return 'general';
}

function extractDeviceNumber(alertname) {
  // Extraer número de dispositivo (INV01, TRK15, etc.)
  const match = alertname.match(/(INV|TRK|CONT)(\d+)/i);
  return match ? `${match[1].toUpperCase()}${match[2].padStart(2, '0')}` : null;
}

function groupAlarmsByPlant(alarms) {
  const plantAlarms = { LAMAJA: [], RETAMAR: [] };
  
  for (const alarm of alarms) {
    if (plantAlarms[alarm.plant]) {
      plantAlarms[alarm.plant].push(alarm);
    }
  }
  
  return plantAlarms;
}

function calculateAlarmSummary(alarms) {
  return {
    critical: alarms.filter(a => a.severity === 'critical').length,
    warning: alarms.filter(a => a.severity === 'warning').length,
    info: alarms.filter(a => a.severity === 'info').length,
    total: alarms.length
  };
}