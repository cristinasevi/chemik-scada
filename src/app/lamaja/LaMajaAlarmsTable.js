'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle, Clock, CheckCircle, XCircle, Eye } from 'lucide-react';

const LaMajaAlarmsTable = () => {
    const [alarms, setAlarms] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const loadAlarmsData = async () => {
        try {
            setLoading(true);
            setError(null);
            
            const response = await fetch('/api/alarms-data');
            const result = await response.json();

            if (result.alarms && Array.isArray(result.alarms) && result.alarms.length > 0) {
                // Filtrar solo alarmas de La Maja
                const lamajAlarms = result.alarms.filter(alarm => 
                    alarm.plant === 'LA MAJA' || 
                    alarm.plant === 'LAMAJA' ||
                    !alarm.plant
                );

                const mappedAlarms = lamajAlarms.map((alarm, index) => ({
                    id: alarm.id || `alarm_${index}`,
                    equipment: extractEquipmentName(alarm),
                    alarmType: alarm.message || alarm.type || 'Alarma general',
                    startDate: alarm.timestamp,
                    endDate: null,
                    acknowledgeDate: null,
                    status: 'active',
                    manufacturer: getManufacturerFromDevice(extractEquipmentName(alarm)),
                    severity: alarm.severity || 'warning'
                }));

                setAlarms(mappedAlarms);
            } else {
                setAlarms([]);
                if (!result.success) {
                    setError(`Error de Grafana: ${result.error || 'Sin detalles'}`);
                } else {
                    setError('No se encontraron alarmas en La Maja');
                }
            }
        } catch (error) {
            setError(`Error de conexión: ${error.message}`);
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

    // Badge de estado
    const getStatusBadge = (status) => {
        const statusConfig = {
            active: {
                label: 'Activa',
                color: 'badge-red text-red-700 dark:text-red-400',
                icon: XCircle
            },
            acknowledged: {
                label: 'Reconocida',
                color: 'badge-yellow text-yellow-700 dark:text-yellow-400',
                icon: Eye
            },
            resolved: {
                label: 'Resuelta',
                color: 'badge-green text-green-700 dark:text-green-400',
                icon: CheckCircle
            }
        };

        const config = statusConfig[status] || statusConfig.active;
        const Icon = config.icon;

        return (
            <div className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${config.color}`}>
                <Icon size={12} />
                {config.label}
            </div>
        );
    };

    // Badge de severidad
    const getSeverityBadge = (severity) => {
        const severityConfig = {
            critical: {
                label: 'Crítica',
                color: 'bg-red-500 text-white'
            },
            warning: {
                label: 'Advertencia',
                color: 'bg-yellow-500 text-white'
            },
            info: {
                label: 'Información',
                color: 'bg-blue-500 text-white'
            }
        };

        const config = severityConfig[severity] || severityConfig.info;

        return (
            <span className={`px-2 py-1 text-xs font-medium rounded-full ${config.color}`}>
                {config.label}
            </span>
        );
    };

    if (loading) {
        return (
            <div className="w-full p-6 bg-panel rounded-lg">
                <div className="flex items-center justify-center h-32 space-x-3">
                    <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                    <span className="text-secondary">Cargando alarmas de La Maja...</span>
                </div>
            </div>
        );
    }

    return (
        <div className="p-6 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <h1 className="text-2xl font-semibold text-primary">Alarmas - La Maja</h1>
                {error && (
                    <p className="text-red-500 text-sm mt-1">{error}</p>
                )}
            </div>

            <div className="bg-panel rounded-lg overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="bg-header-table border-b border-custom">
                                <th className="text-left p-4 font-semibold text-primary text-sm">Equipo</th>
                                <th className="text-left p-4 font-semibold text-primary text-sm">Tipo de Alarma</th>
                                <th className="text-left p-4 font-semibold text-primary text-sm">Fecha Comienzo</th>
                                <th className="text-left p-4 font-semibold text-primary text-sm">Fecha Finalización</th>
                                <th className="text-left p-4 font-semibold text-primary text-sm">Fecha Reconocimiento</th>
                                <th className="text-center p-4 font-semibold text-primary text-sm">Estado</th>
                                <th className="text-left p-4 font-semibold text-primary text-sm">Fabricante</th>
                            </tr>
                        </thead>
                        <tbody>
                            {alarms.map((alarm) => (
                                <tr key={alarm.id} className="border-b border-custom hover-bg">
                                    <td className="p-4">
                                        <div className="flex items-center gap-2">
                                            <div className="flex flex-col">
                                                <span className="font-medium text-primary">{alarm.equipment}</span>
                                                <span className="text-xs text-secondary">La Maja</span>
                                            </div>
                                            {getSeverityBadge(alarm.severity)}
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

                                    <td className="p-4">
                                        <div className="flex items-center gap-2 text-sm">
                                            <Clock size={14} className="text-secondary" />
                                            <span className="text-primary">{formatDate(alarm.endDate)}</span>
                                        </div>
                                    </td>

                                    <td className="p-4">
                                        <div className="flex items-center gap-2 text-sm">
                                            <Clock size={14} className="text-secondary" />
                                            <span className="text-primary">{formatDate(alarm.acknowledgeDate)}</span>
                                        </div>
                                    </td>

                                    <td className="p-4 text-center">
                                        {getStatusBadge(alarm.status)}
                                    </td>

                                    <td className="p-4">
                                        <span className="text-primary font-medium">{alarm.manufacturer}</span>
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
                            No hay alarmas activas en La Maja
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default LaMajaAlarmsTable;