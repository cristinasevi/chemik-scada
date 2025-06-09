export async function GET(request) {
  try {
    // Configuración de la API de Grafana
    const grafanaUrl = process.env.GRAFANA_URL || 'http://localhost:3000';
    const grafanaToken = process.env.GRAFANA_TOKEN;
    
    if (!grafanaToken) {     
      return Response.json({
        success: false,
        error: 'Token de Grafana no configurado',
        totalAlarms: 0,
        alarms: [],
        plantAlarms: { LAMAJA: [], RETAMAR: [] },
        summary: { critical: 0, warning: 0, info: 0, total: 0 },
        timestamp: new Date().toISOString(),
        source: 'no_token'
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

    // Agrupar por planta y calcular estadísticas
    const plantAlarms = groupAlarmsByPlant(mappedAlarms);
    const summary = calculateAlarmSummary(mappedAlarms);

    return Response.json({
      success: true,
      totalAlarms: mappedAlarms.length,
      alarms: mappedAlarms,
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
  return Response.json({
    success: false,
    error: errorMessage,
    totalAlarms: 0,
    alarms: [],
    plantAlarms: { LAMAJA: [], RETAMAR: [] },
    summary: { critical: 0, warning: 0, info: 0, total: 0 },
    timestamp: new Date().toISOString(),
    source: 'error'
  }, { status: 500 });
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