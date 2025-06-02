export class GrafanaAlarmMapper {
  
  static getSeverityFromPriority(priority) {
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

  static getPlantFromAlert(alert) {
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

  static getAlarmType(alert) {
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

  static extractDeviceNumber(alertname) {
    // Extraer número de dispositivo (INV01, TRK15, etc.)
    const match = alertname.match(/(INV|TRK|CONT)(\d+)/i);
    return match ? `${match[1].toUpperCase()}${match[2].padStart(2, '0')}` : null;
  }

  static mapGrafanaAlertToStandard(alert) {
    const labels = alert.labels || {};
    const annotations = alert.annotations || {};
    
    const plant = this.getPlantFromAlert(alert);
    if (plant === 'UNKNOWN') {
      return null; // Filtrar alarmas que no pertenecen a nuestras plantas
    }
    
    const severity = this.getSeverityFromPriority(labels.Prioridad);
    const alarmType = this.getAlarmType(alert);
    const deviceNumber = this.extractDeviceNumber(labels.alertname || '');
    
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

  static createFallbackAlarms() {
    const now = new Date().toISOString();
    
    return [
      {
        id: 'FALLBACK_CONNECTION_ERROR',
        plant: 'SYSTEM',
        severity: 'warning',
        type: 'communication',
        message: 'No se pudo conectar con Grafana - Usando datos de ejemplo',
        timestamp: now,
        value: null,
        threshold: null,
        grafanaData: {
          ruleId: 'connection_fallback',
          fingerprint: 'fallback_001'
        }
      }
    ];
  }

  static groupAlarmsByPlant(alarms) {
    const plantAlarms = { LAMAJA: [], RETAMAR: [] };
    
    for (const alarm of alarms) {
      if (plantAlarms[alarm.plant]) {
        plantAlarms[alarm.plant].push(alarm);
      }
    }
    
    return plantAlarms;
  }

  static calculateAlarmSummary(alarms) {
    return {
      critical: alarms.filter(a => a.severity === 'critical').length,
      warning: alarms.filter(a => a.severity === 'warning').length,
      info: alarms.filter(a => a.severity === 'info').length,
      total: alarms.length
    };
  }
}

export default GrafanaAlarmMapper;