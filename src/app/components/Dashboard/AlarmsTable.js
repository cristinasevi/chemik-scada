'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle, Clock } from 'lucide-react';

const AlarmsTable = () => {
    const [alarms, setAlarms] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Cargar alarmas reales desde la API de Grafana
    const loadAlarmsData = async () => {
        try {
            setLoading(true);
            setError(null);
            
            const response = await fetch('/api/alarms-data');
            const result = await response.json();

            if (result.alarms && Array.isArray(result.alarms) && result.alarms.length > 0) {
                const mappedAlarms = result.alarms.map((alarm, index) => ({
                    id: alarm.id || `alarm_${index}`,
                    equipment: extractEquipmentName(alarm),
                    alarmType: alarm.message || alarm.type || 'Alarma general',
                    startDate: alarm.timestamp,
                    manufacturer: getManufacturerFromDevice(extractEquipmentName(alarm)),
                    plant: alarm.plant || 'UNKNOWN',
                    severity: alarm.severity || 'warning'
                }));

                setAlarms(mappedAlarms);
            } else {
                setAlarms([]);
                if (!result.success) {
                    setError(`Error de Grafana: ${result.error || 'Sin detalles'}`);
                } else {
                    setError('No se encontraron alarmas en el sistema');
                }
            }
        } catch (error) {
            setError(`Error de conexión con Grafana: ${error.message}`);
            setAlarms([]);
        } finally {
            setLoading(false);
        }
    };

    const extractEquipmentName = (alarm) => {
        if (alarm.device) return alarm.device;
        if (alarm.grafanaData?.ruleId) return alarm.grafanaData.ruleId;
        
        const message = alarm.message || '';
        const patterns = [
            /\b(INV\d{2})\b/i,
            /\b(TRK\d{2})\b/i,
            /\b(SUBESTACION[_\s]?\d*)\b/i,
            /\b(UPS[_\s]?\w+)\b/i,
            /\b(METEO[_\s]?\d*)\b/i,
            /\b(CONTADOR\d{2})\b/i,
            /\b(ESTADO)\b/i
        ];

        for (const pattern of patterns) {
            const match = message.match(pattern);
            if (match) {
                return match[1].toUpperCase();
            }
        }

        return 'DESCONOCIDO';
    };

    const getManufacturerFromDevice = (device) => {
        if (!device || device === 'DESCONOCIDO') return 'Desconocido';
        
        const deviceUpper = device.toUpperCase();
        
        if (deviceUpper.includes('INV')) return 'SMA';
        if (deviceUpper.includes('TRK')) return 'PVH';
        if (deviceUpper.includes('SUBESTACION') || deviceUpper.includes('ESTADO')) return 'Schneider';
        if (deviceUpper.includes('UPS')) return 'APC';
        if (deviceUpper.includes('METEO')) return 'Vaisala';
        if (deviceUpper.includes('CONTADOR')) return 'Schneider';
        
        return 'Desconocido';
    };

    useEffect(() => {
        loadAlarmsData();
        
        // Auto-refresh cada 30 segundos
        const interval = setInterval(loadAlarmsData, 30000);
        return () => clearInterval(interval);
    }, []);

    // Formatear fecha
    const formatDate = (dateString) => {
        if (!dateString) return '-';
        const date = new Date(dateString);
        return date.toLocaleString('es-ES', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    // Función para obtener el estilo de fondo de fila según severidad
    const getRowBackgroundClass = (severity) => {
        switch (severity) {
            case 'critical':
                return 'badge-red';
            case 'warning':
                return 'badge-yellow';
            case 'info':
                return 'row-info';
            default:
                return;
        }
    };

    if (loading) {
        return (
            <div className="w-full p-6 bg-panel rounded-lg">
                <div className="flex items-center justify-center h-32 space-x-3">
                    <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                    <span className="text-secondary">Cargando alarmas...</span>
                </div>
            </div>
        );
    }

    return (
        <div className="p-6 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-semibold text-primary">Alarmas de Dispositivos</h1>
                    {error && (
                        <p className="text-red-500 text-sm mt-1">{error}</p>
                    )}
                </div>
            </div>

            <div className="bg-panel rounded-lg overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="bg-header-table border-b border-custom">
                                <th className="text-left p-4 font-semibold text-primary text-sm">Equipo</th>
                                <th className="text-left p-4 font-semibold text-primary text-sm">Tipo de Alarma</th>
                                <th className="text-left p-4 font-semibold text-primary text-sm">Fecha Comienzo</th>
                            </tr>
                        </thead>
                        <tbody>
                            {alarms.map((alarm) => (
                                <tr key={alarm.id} className={`border-b border-custom ${getRowBackgroundClass(alarm.severity)}`}>
                                    <td className="p-4">
                                        <div className="flex items-center gap-2">
                                            <div className="flex flex-col">
                                                <span className="font-medium text-primary">{alarm.equipment}</span>
                                                <span className="text-xs text-secondary">{alarm.plant}</span>
                                            </div>
                                        </div>
                                    </td>

                                    <td className="p-4">
                                        <span className="text-primary">{alarm.alarmType}</span>
                                    </td>

                                    <td className="p-4">
                                        <div className="flex items-center gap-2 text-sm">
                                            <Clock size={14} className="text-secondary" />
                                            <span className="text-primary">{formatDate(alarm.startDate)}</span>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {alarms.length === 0 && !loading && (
                    <div className="text-center py-8">
                        <AlertTriangle size={48} className="mx-auto text-secondary mb-2" />
                        <p className="text-secondary">
                            No hay alarmas activas en el sistema
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default AlarmsTable;