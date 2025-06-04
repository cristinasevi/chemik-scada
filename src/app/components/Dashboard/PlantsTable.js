'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { LineChart, Line, ResponsiveContainer, AreaChart, Area } from 'recharts';

const PlantsTable = () => {
  const [plantsData, setPlantsData] = useState([]);
  const [totalPower, setTotalPower] = useState(0);
  const [totalEnergy, setTotalEnergy] = useState(0);
  const [totalIrradiance, setTotalIrradiance] = useState(0);
  const [totalIrradiation, setTotalIrradiation] = useState(0);
  const [totalElecDispo, setTotalElecDispo] = useState(0);
  const [totalProfitability, setTotalProfitability] = useState(0);
  const [totalMecDispo, setTotalMecDispo] = useState(0);
  const [timeSeriesData, setTimeSeriesData] = useState({});
  const [loading, setLoading] = useState(true);
  const [totalPR, setTotalPR] = useState(0);
  const [error, setError] = useState(null);
  const [alarmsData, setAlarmsData] = useState({ totalAlarms: 0, plantAlarms: {} });

  const loadTimeSeriesData = async (metric, plant) => {
    try {
      const response = await fetch(`/api/timeseries-data?metric=${metric}&plant=${plant}&hours=24`);
      const result = await response.json();

      if (result.success) {
        return result.data;
      }
      return [];
    } catch (error) {
      console.error(`Error loading ${metric} data for ${plant}:`, error);
      return [];
    }
  };

  const loadAlarmsData = async () => {
    try {
      const response = await fetch('/api/alarms-data');
      const result = await response.json();

      if (result.success) {
        return result;
      }
      return { totalAlarms: 0, plantAlarms: {} };
    } catch (error) {
      console.error('Error loading alarms:', error);
      return { totalAlarms: 0, plantAlarms: {} };
    }
  };

  const loadPlantsData = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/plants-data');
      const result = await response.json();

      if (result.success) {
        setPlantsData(result.plants || []);
        setTotalPower(result.totalPower || 0);
        setTotalEnergy(result.totalEnergy || 0);
        setTotalIrradiance(result.totalIrradiance || 0);
        setTotalIrradiation(result.totalIrradiation || 0);
        setTotalElecDispo(result.totalElecDispo || 0);
        setTotalMecDispo(result.totalMecDispo || 0);
        setTotalPR(result.totalPR || 0);
        setTotalProfitability(result.totalProfitability || 0);
        setError(null);

        // Cargar datos de series temporales
        const timeSeriesPromises = [];

        // Datos totales
        timeSeriesPromises.push(
          loadTimeSeriesData('power', 'total').then(data => ['total', 'power', data]),
          loadTimeSeriesData('energy', 'total').then(data => ['total', 'energy', data]),
          loadTimeSeriesData('irradiance', 'total').then(data => ['total', 'irradiance', data]),
          loadTimeSeriesData('irradiation', 'total').then(data => ['total', 'irradiation', data])
        );

        // Datos por planta
        for (const plant of result.plants || []) {
          timeSeriesPromises.push(
            loadTimeSeriesData('power', plant.name).then(data => [plant.name, 'power', data]),
            loadTimeSeriesData('energy', plant.name).then(data => [plant.name, 'energy', data]),
            loadTimeSeriesData('irradiance', plant.name).then(data => [plant.name, 'irradiance', data]),
            loadTimeSeriesData('irradiation', plant.name).then(data => [plant.name, 'irradiation', data])
          );
        }

        const timeSeriesResults = await Promise.all(timeSeriesPromises);
        const newTimeSeriesData = {};

        timeSeriesResults.forEach(([plant, metric, data]) => {
          if (!newTimeSeriesData[plant]) {
            newTimeSeriesData[plant] = {};
          }
          newTimeSeriesData[plant][metric] = data;
        });

        setTimeSeriesData(newTimeSeriesData);

        // Cargar datos de alarmas
        const alarms = await loadAlarmsData();
        setAlarmsData(alarms);

      } else {
        setError(result.error || 'Error al cargar datos');
      }
    } catch (err) {
      console.error('Error cargando datos de plantas:', err);
      setError('Error de conexión');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPlantsData();

    // Auto-refresh cada 5 minutos para las gráficas
    const interval = setInterval(loadPlantsData, 300000);
    return () => clearInterval(interval);
  }, []);

  // Calcular totales con datos reales
  const calculateTotals = () => {
    if (plantsData.length === 0) return {
      totalPowerMW: totalPower,
      totalEnergyMWh: totalEnergy,
      avgIrradiance: totalIrradiance,
      avgIrradiation: totalIrradiation,
      avgElecDispo: totalElecDispo,
      avgMecDispo: totalMecDispo,
      avgDispoElec: 0,
      avgDispoMec: 0,
      totalAlarms: alarmsData.totalAlarms || 0
    };

    const totals = plantsData.reduce((acc, plant) => {
      acc.totalDispoElec += plant.dispoElec || 0;
      acc.totalDispoMec += plant.dispoMec || 0;
      return acc;
    }, {
      totalDispoElec: 0,
      totalDispoMec: 0
    });

    return {
      totalPowerMW: totalPower,
      totalEnergyMWh: totalEnergy,
      avgIrradiance: totalIrradiance,
      avgIrradiation: totalIrradiation,
      avgElecDispo: totalElecDispo,
      avgMecDispo: totalMecDispo,
      avgDispoElec: totals.totalDispoElec / plantsData.length,
      avgDispoMec: totals.totalDispoMec / plantsData.length,
      totalAlarms: alarmsData.totalAlarms || 0
    };
  };

  const totals = calculateTotals();

  // Componente para mini-gráfica en celda
  const MiniChart = ({ data = [], type = 'line', color = '#3b82f6' }) => {
    if (!data || data.length === 0) {
      return (
        <div className="w-24 h-12 bg-gray-100 dark:bg-gray-800 rounded flex items-center justify-center">
          <span className="text-xs text-gray-400">Sin datos</span>
        </div>
      );
    }

    return (
      <div className="w-24 h-12">
        <ResponsiveContainer width="100%" height="100%">
          {type === 'area' ? (
            <AreaChart data={data}>
              <defs>
                <linearGradient id={`gradient-${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={color} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={color} stopOpacity={0} />
                </linearGradient>
              </defs>
              <Area
                type="monotone"
                dataKey="value"
                stroke={color}
                strokeWidth={1.5}
                fill={`url(#gradient-${color.replace('#', '')})`}
                dot={false}
              />
            </AreaChart>
          ) : (
            <LineChart data={data}>
              <Line
                type="monotone"
                dataKey="value"
                stroke={color}
                strokeWidth={1.5}
                dot={false}
              />
            </LineChart>
          )}
        </ResponsiveContainer>
      </div>
    );
  };

  // Función para formatear números con mayor precisión para potencia
  const formatNumber = (value, decimals = 2, metric = null) => {
    if (value === null || value === undefined || isNaN(value)) {
      return '--';
    }

    // Para potencia, mantener 2 decimales para coincidir con Grafana
    if (metric === 'power') {
      decimals = 2; // Mostrar 2 decimales para potencia
    }

    const formatted = Number(value).toFixed(decimals);
    return formatted === '-0.00' || formatted === '-0.0' ? '0.00' : formatted;
  };

  // Componente para celda con gráfica y valor - formato inteligente mejorado
  const DataCellWithChart = ({ value, unit, chartData, chartColor = '#3b82f6', chartType = 'line', metric = null }) => {
    // Para valores de potencia pequeños (< 1 MW), mostrar en kW con más precisión
    let displayValue = value;
    let displayUnit = unit;
    let displayDecimals = 2;

    if (unit === 'MW' && Math.abs(value) < 1) {
      displayValue = value * 1000;
      displayUnit = 'kW';
      displayDecimals = 1; // Para kW usar 1 decimal
    } else if (metric === 'power') {
      displayDecimals = 2; // Para MW de potencia usar 2 decimales
    }

    return (
      <div className="text-center p-2">
        <div className="text-base font-semibold mb-2">
          {formatNumber(displayValue, displayDecimals, metric)}
        </div>
        <div className="text-xs text-secondary opacity-75 mb-2">{displayUnit}</div>
        <div className="flex justify-center">
          <MiniChart data={chartData} color={chartColor} type={chartType} />
        </div>
      </div>
    );
  };

  // Componente para medidores circulares
  const CircularGauge = ({ value, label }) => {
    if (value === null || value === undefined) {
      return (
        <div className="flex flex-col items-center">
          <div className="relative w-16 h-16">
            <div className="w-16 h-16 rounded-full border-2 badge-gray flex items-center justify-center">
              <span className="text-xs text-gray-400">--</span>
            </div>
          </div>
          <span className="text-xs text-secondary mt-1 text-center">{label}</span>
        </div>
      );
    }

    const percentage = Math.min(Math.max(value, 0), 100);
    const radius = 40;
    const circumference = 2 * Math.PI * radius;
    const strokeDashoffset = circumference - (percentage / 100) * circumference;

    let dynamicColor;
    if (percentage >= 90) {
      dynamicColor = '#10b981'; // verde
    } else if (percentage >= 50) {
      dynamicColor = '#f59e0b'; // amarillo
    } else {
      dynamicColor = '#ef4444'; // rojo
    }

    return (
      <div className="flex flex-col items-center">
        <div className="relative w-16 h-16">
          <svg className="w-16 h-16 transform -rotate-90" viewBox="0 0 100 100">
            <circle
              cx="50"
              cy="50"
              r={radius}
              stroke="#e5e7eb"
              strokeWidth="6"
              fill="transparent"
            />
            <circle
              cx="50"
              cy="50"
              r={radius}
              stroke={dynamicColor}
              strokeWidth="6"
              fill="transparent"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              className="transition-all duration-500 ease-in-out"
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-xs font-bold text-primary">
              {percentage % 1 === 0 ? percentage.toFixed(0) : percentage.toFixed(1)}%
            </span>
          </div>
        </div>
        <span className="text-xs text-secondary mt-1 text-center">{label}</span>
      </div>
    );
  };

  // Componente para la celda de rentabilidad
  const ProfitabilityCell = ({ value }) => {
    // Formatear rentabilidad con 2 decimales mínimo
    const formatProfitability = (val) => {
      if (val === null || val === undefined || isNaN(val)) return '0.00';

      // Si el valor es muy pequeño, mostrar al menos 2 decimales
      if (Math.abs(val) < 1) {
        return val.toFixed(2);
      }

      // Si es >= 1, mostrar sin decimales
      return Math.round(val).toString();
    };

    return (
      <div className="text-center p-2">
        <div className="inline-flex items-center justify-center px-3 py-1 bg-header-table rounded-lg">
          <span className="text-sm font-semibold">
            {formatProfitability(value)}€
          </span>
        </div>
      </div>
    );
  };

  // Componente para celdas de alarmas
  const AlarmCell = ({ alarmCount, isTotal = false }) => (
    <div className="text-center">
      <div className={`inline-flex items-center justify-center w-8 h-8 rounded-full ${alarmCount > 0
        ? 'badge-red text-red-600 dark:text-red-400'
        : 'bg-header-table'
        }`}>
        <span className="text-sm font-bold">{alarmCount}</span>
      </div>
      <div className="text-xs text-secondary mt-1">
        {alarmCount === 0 ? 'Sin alertas' :
          alarmCount === 1 ? 'Alerta' : `Alertas`}
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="w-full p-6 bg-panel rounded-lg">
        <div className="flex items-center justify-center h-32 space-x-3">
          <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          <span className="text-secondary">Cargando datos y gráficas...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full p-6 bg-panel rounded-lg">
        <div className="flex items-center justify-center h-32 text-red-500">
          <AlertTriangle size={24} className="mr-2" />
          <span>Error: {error}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full space-y-4">
      {/* Tabla con gráficas integradas */}
      <div className="bg-panel rounded-lg overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-header-table border-b border-custom">
                <th className="text-left p-4 font-semibold text-primary text-sm">Plantas</th>
                <th className="text-center p-4 font-semibold text-primary text-sm">Potencia</th>
                <th className="text-center p-4 font-semibold text-primary text-sm">Energía</th>
                <th className="text-center p-4 font-semibold text-primary text-sm">Irradiancia</th>
                <th className="text-center p-4 font-semibold text-primary text-sm">Irradiación</th>
                <th className="text-center p-4 font-semibold text-primary text-sm">Rentabilidad</th>
                <th className="text-center p-4 font-semibold text-primary text-sm">Disp. Eléc.</th>
                <th className="text-center p-4 font-semibold text-primary text-sm">Disp. Mec.</th>
                <th className="text-center p-4 font-semibold text-primary text-sm">PR</th>
                <th className="text-center p-4 font-semibold text-primary text-sm">Alarmas</th>
              </tr>
            </thead>
            <tbody>
              {/* Fila Total con gráficas reales */}
              <tr className="border-b border-custom">
                <td className="p-4">
                  <div className="font-semibold text-lg text-primary">Total</div>
                </td>
                <td className="p-4">
                  <DataCellWithChart
                    value={totals.totalPowerMW}
                    unit="MW"
                    chartData={timeSeriesData.total?.power || []}
                    chartColor="#3b82f6"
                    chartType="area"
                    metric="power"
                  />
                </td>
                <td className="p-4">
                  <DataCellWithChart
                    value={totals.totalEnergyMWh}
                    unit="MWh"
                    chartData={timeSeriesData.total?.energy || []}
                    chartColor="#10b981"
                    chartType="area"
                  />
                </td>
                <td className="p-4">
                  <DataCellWithChart
                    value={totals.avgIrradiance}
                    unit="W/m²"
                    chartData={timeSeriesData.total?.irradiance || []}
                    chartColor="#f59e0b"
                    chartType="line"
                  />
                </td>
                <td className="p-4">
                  <DataCellWithChart
                    value={totals.avgIrradiation}
                    unit="kWh/m²"
                    chartData={timeSeriesData.total?.irradiation || []}
                    chartColor="#f59e0b"
                    chartType="line"
                  />
                </td>
                <td className="p-4">
                  <ProfitabilityCell value={totalProfitability} />
                </td>
                <td className="p-4">
                  <CircularGauge
                    value={totals.avgElecDispo}
                  />
                </td>
                <td className="p-4">
                  <CircularGauge
                    value={totals.avgMecDispo}
                  />
                </td>
                <td className="p-4">
                  <CircularGauge
                    value={totalPR}
                  />
                </td>
                <td className="p-4">
                  <AlarmCell alarmCount={totals.totalAlarms} isTotal={true} />
                </td>
              </tr>

              {/* Filas de plantas individuales con gráficas reales */}
              {plantsData.map((plant, index) => (
                <tr key={plant.name} className="border-b border-custom">
                  <td className="p-4">
                    <div className="font-semibold text-primary">
                      {plant.name}
                    </div>
                  </td>
                  <td className="p-4">
                    <DataCellWithChart
                      value={plant.powerMW}
                      unit="MW"
                      chartData={timeSeriesData[plant.name]?.power || []}
                      chartColor="#3b82f6"
                      chartType="area"
                      metric="power"
                    />
                  </td>
                  <td className="p-4">
                    <DataCellWithChart
                      value={plant.energyMWh}
                      unit="MWh"
                      chartData={timeSeriesData[plant.name]?.energy || []}
                      chartColor="#10b981"
                      chartType="area"
                    />
                  </td>
                  <td className="p-4">
                    <DataCellWithChart
                      value={plant.irradiance}
                      unit="W/m²"
                      chartData={timeSeriesData[plant.name]?.irradiance || []}
                      chartColor="#f59e0b"
                      chartType="line"
                    />
                  </td>
                  <td className="p-4">
                    <DataCellWithChart
                      value={plant.irradiation || 0}
                      unit="kWh/m²"
                      chartData={timeSeriesData[plant.name]?.irradiation || []}
                      chartColor="#f59e0b"
                      chartType="line"
                    />
                  </td>
                  <td className="p-4">
                    <ProfitabilityCell value={plant.profitabilityMWh || 0} />
                  </td>
                  <td className="p-4">
                    <CircularGauge
                      value={plant.dispoElec}
                    />
                  </td>
                  <td className="p-4">
                    <CircularGauge
                      value={plant.dispoMec}
                    />
                  </td>
                  <td className="p-4">
                    <CircularGauge
                      value={plant.pr}
                    />
                  </td>
                  <td className="p-4">
                    <AlarmCell
                      alarmCount={alarmsData.plantAlarms?.[plant.name]?.length || 0}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default PlantsTable;