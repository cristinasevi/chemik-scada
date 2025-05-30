'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { LineChart, Line, ResponsiveContainer, AreaChart, Area } from 'recharts';

const PlantsTable = () => {
  const [plantsData, setPlantsData] = useState([]);
  const [totalPower, setTotalPower] = useState(0);
  const [totalEnergy, setTotalEnergy] = useState(0);
  const [totalIrradiance, setTotalIrradiance] = useState(0);
  const [totalProfitability, setTotalProfitability] = useState(0);
  const [timeSeriesData, setTimeSeriesData] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Función para cargar datos de serie temporal
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
        setTotalProfitability(result.totalProfitability || 0);
        setError(null);

        // Cargar datos de series temporales
        const timeSeriesPromises = [];
        
        // Datos totales
        timeSeriesPromises.push(
          loadTimeSeriesData('power', 'total').then(data => ['total', 'power', data]),
          loadTimeSeriesData('energy', 'total').then(data => ['total', 'energy', data]),
          loadTimeSeriesData('irradiance', 'total').then(data => ['total', 'irradiance', data])
        );
        
        // Datos por planta
        for (const plant of result.plants || []) {
          timeSeriesPromises.push(
            loadTimeSeriesData('power', plant.name).then(data => [plant.name, 'power', data]),
            loadTimeSeriesData('energy', plant.name).then(data => [plant.name, 'energy', data]),
            loadTimeSeriesData('irradiance', plant.name).then(data => [plant.name, 'irradiance', data])
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
      avgDispoElec: 0,
      avgDispoMec: 0,
      totalAlarms: 0
    };

    const totals = plantsData.reduce((acc, plant) => {
      acc.totalDispoElec += plant.dispoElec || 0;
      acc.totalDispoMec += plant.dispoMec || 0;
      acc.totalAlarms += 0;
      return acc;
    }, {
      totalDispoElec: 0,
      totalDispoMec: 0,
      totalAlarms: 0
    });

    return {
      totalPowerMW: totalPower,
      totalEnergyMWh: totalEnergy,
      avgIrradiance: totalIrradiance,
      avgDispoElec: totals.totalDispoElec / plantsData.length,
      avgDispoMec: totals.totalDispoMec / plantsData.length,
      totalAlarms: totals.totalAlarms
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
                  <stop offset="5%" stopColor={color} stopOpacity={0.3}/>
                  <stop offset="95%" stopColor={color} stopOpacity={0}/>
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

  // Función para formatear números correctamente
  const formatNumber = (value, decimals = 2) => {
    if (value === null || value === undefined || isNaN(value)) {
      return '--';
    }
    
    const formatted = Number(value).toFixed(decimals);
    return formatted === '-0.00' || formatted === '-0.0' ? '0.00' : formatted;
  };

  // Componente para celda con gráfica y valor - formato inteligente
  const DataCellWithChart = ({ value, unit, chartData, chartColor = '#3b82f6', chartType = 'line' }) => {
    // Para valores de potencia pequeños (< 1 MW), mostrar en kW
    let displayValue = value;
    let displayUnit = unit;
    
    if (unit === 'MW' && Math.abs(value) < 1) {
      displayValue = value * 1000;
      displayUnit = 'kW';
    }
    
    return (
      <div className="text-center p-2">
        <div className="text-base font-semibold mb-2">
          {formatNumber(displayValue, displayUnit === 'kW' ? 1 : 2)}
        </div>
        <div className="text-xs text-secondary opacity-75 mb-2">{displayUnit}</div>
        <div className="flex justify-center">
          <MiniChart data={chartData} color={chartColor} type={chartType} />
        </div>
      </div>
    );
  };

  // Componente para medidores circulares
  const CircularGauge = ({ value, label, color = 'green' }) => {
    const percentage = Math.min(Math.max(value, 0), 100);
    const circumference = 2 * Math.PI * 40;
    const strokeDashoffset = circumference - (percentage / 100) * circumference;

    const colors = {
      green: '#10b981',
      yellow: '#f59e0b',
      red: '#ef4444',
      blue: '#3b82f6'
    };

    return (
      <div className="flex flex-col items-center">
        <div className="relative w-16 h-16">
          <svg className="w-16 h-16 transform -rotate-90" viewBox="0 0 100 100">
            <circle
              cx="50"
              cy="50"
              r="40"
              stroke="#f3f4f6"
              strokeWidth="6"
              fill="transparent"
            />
            <circle
              cx="50"
              cy="50"
              r="40"
              stroke={colors[color]}
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
              {percentage.toFixed(0)}%
            </span>
          </div>
        </div>
        <span className="text-xs text-secondary mt-1 text-center">{label}</span>
      </div>
    );
  };

  // Componente para la celda de rentabilidad
  const ProfitabilityCell = ({ value }) => (
    <div className="text-center p-2">
      <div className="inline-flex items-center justify-center px-3 py-1 bg-header-table rounded-lg">
        <span className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">
          {Math.round(value)}€
        </span>
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="w-full p-6 bg-panel rounded-lg">
        <div className="flex items-center justify-center h-32">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
          <span className="ml-2 text-secondary">Cargando datos y gráficas...</span>
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
                  <div className="font-bold text-lg text-primary">Total</div>
                </td>
                <td className="p-4">
                  <DataCellWithChart 
                    value={totals.totalPowerMW}
                    unit="MW"
                    chartData={timeSeriesData.total?.power || []}
                    chartColor="#3b82f6"
                    chartType="area"
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
                    value={totals.avgIrradiance / 100}
                    unit="kWh/m²"
                    chartData={timeSeriesData.total?.irradiance?.map(d => ({...d, value: d.value / 100})) || []}
                    chartColor="#f59e0b"
                    chartType="line"
                  />
                </td>
                <td className="p-4">
                  <ProfitabilityCell value={totalProfitability * 30} />
                </td>
                <td className="p-4">
                  <CircularGauge 
                    value={totals.avgDispoElec} 
                    color="green"
                  />
                </td>
                <td className="p-4">
                  <CircularGauge 
                    value={totals.avgDispoMec} 
                    color="green"
                  />
                </td>
                <td className="p-4">
                  <CircularGauge 
                    value={75} 
                    color="yellow"
                  />
                </td>
                <td className="p-4">
                  <div className="text-center">
                    <div className="inline-flex items-center justify-center w-8 h-8 bg-header-table rounded-full">
                      <span className="text-sm font-bold text-green-600 dark:text-green-400">{totals.totalAlarms}</span>
                    </div>
                    <div className="text-xs text-secondary mt-1">Alertas</div>
                  </div>
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
                      value={plant.irradiance / 100}
                      unit="kWh/m²"
                      chartData={timeSeriesData[plant.name]?.irradiance?.map(d => ({...d, value: d.value / 100})) || []}
                      chartColor="#f59e0b"
                      chartType="line"
                    />
                  </td>
                  <td className="p-4">
                    <ProfitabilityCell value={(plant.profitabilityMWh || 0) * 30} />
                  </td>
                  <td className="p-4">
                    <CircularGauge 
                      value={plant.dispoElec} 
                      color="green"
                    />
                  </td>
                  <td className="p-4">
                    <CircularGauge 
                      value={plant.dispoMec} 
                      color={plant.dispoMec >= 90 ? "green" : plant.dispoMec >= 70 ? "yellow" : "red"}
                    />
                  </td>
                  <td className="p-4">
                    <CircularGauge 
                      value={plant.dispoElec * 0.8} 
                      color="yellow"
                    />
                  </td>
                  <td className="p-4">
                    <div className="text-center">
                      <div className="inline-flex items-center justify-center w-8 h-8 bg-header-table rounded-full">
                        <span className="text-sm font-bold text-green-600 dark:text-green-400">0</span>
                      </div>
                      <div className="text-xs text-secondary mt-1">Sin alertas</div>
                    </div>
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