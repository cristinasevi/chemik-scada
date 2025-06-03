'use client';

import { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend, ResponsiveContainer } from 'recharts';

const MonthlyProductionChart = ({ height = "400px" }) => {
  const [chartData, setChartData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [stats, setStats] = useState({
    lamaja: { mean: 0, lastNotNull: 0 },
    retamar: { mean: 0, lastNotNull: 0 }
  });

  const loadMonthlyData = async () => {
    try {
      setLoading(true);
      
      // Obtener el primer y último día del mes actual
      const now = new Date();
      const currentDay = now.getDate();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      const totalDaysInMonth = endOfMonth.getDate();
      
      // Formatear fechas para la API
      const startDate = startOfMonth.toISOString();
      const endDate = endOfMonth.toISOString();
      
      // Cargar datos de ambas plantas
      const [lamajaResponse, retamarResponse] = await Promise.all([
        fetch(`/api/monthly-production-data?plant=LAMAJA&start=${startDate}&end=${endDate}`),
        fetch(`/api/monthly-production-data?plant=RETAMAR&start=${startDate}&end=${endDate}`)
      ]);

      const [lamajaData, retamarData] = await Promise.all([
        lamajaResponse.json(),
        retamarResponse.json()
      ]);

      if (!lamajaData.success || !retamarData.success) {
        throw new Error('Error cargando datos de producción mensual');
      }

      // Crear estructura de datos - SOLO hasta el día actual
      const daysToShow = currentDay;
      const dataMap = new Map();
      
      // Inicializar solo los días que queremos mostrar
      for (let day = 1; day <= daysToShow; day++) {
        const dayString = day.toString().padStart(2, '0');
        dataMap.set(day, {
          day: dayString,
          dayLabel: `${dayString}`,
          'La Maja': 0,
          'Retamar': 0,
          timestamp: new Date(now.getFullYear(), now.getMonth(), day).getTime(),
          isCurrentDay: day === currentDay,
          isFutureDay: day > currentDay
        });
      }

      // Procesar datos de La Maja
      lamajaData.data.forEach(point => {
        const pointDate = new Date(point.time);
        const day = pointDate.getDate();
        if (dataMap.has(day)) {
          dataMap.get(day)['La Maja'] = (point.value || 0) / 1000; // Convertir kWh a MWh
        }
      });

      // Procesar datos de Retamar  
      retamarData.data.forEach(point => {
        const pointDate = new Date(point.time);
        const day = pointDate.getDate();
        if (dataMap.has(day)) {
          dataMap.get(day)['Retamar'] = (point.value || 0) / 1000; // Convertir kWh a MWh
        }
      });

      // Convertir a array y ordenar por día
      const combinedData = Array.from(dataMap.values())
        .sort((a, b) => a.timestamp - b.timestamp);

      // Calcular estadísticas
      const calculateStats = (plantKey) => {
        const values = combinedData.map(d => d[plantKey]).filter(v => v > 0);
        if (values.length === 0) return { mean: 0, lastNotNull: 0 };
        
        const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
        const lastNotNull = values[values.length - 1] || 0;
        
        return { mean, lastNotNull };
      };

      setStats({
        lamaja: calculateStats('La Maja'),
        retamar: calculateStats('Retamar')
      });

      setChartData(combinedData);
      setError(null);
    } catch (err) {
      console.error('Error cargando datos mensuales:', err);
      setError('Error cargando datos de producción mensual');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMonthlyData();
    
    // Auto-refresh cada hora (datos diarios no cambian tan frecuentemente)
    const interval = setInterval(loadMonthlyData, 3600000);
    return () => clearInterval(interval);
  }, []);

  // Función para renderizar labels en las barras
  const renderCustomBarLabel = (props) => {
    const { x, y, width, height, value } = props;
    
    // Solo mostrar label si el valor es mayor que 0.1 MWh y la barra tiene altura suficiente
    if (value < 0.1 || height < 30) return null;
    
    return (
      <text 
        x={x + width / 2} 
        y={y + height / 2} 
        fill="white" 
        textAnchor="middle" 
        dominantBaseline="middle"
        fontSize="12"
        fontWeight="600"
      >
        {value.toFixed(2)} MWh
      </text>
    );
  };

  const formatValue = (value) => {
    if (value === null || value === undefined || isNaN(value)) {
      return '--';
    }
    return `${value.toFixed(2)} MWh`;
  };

  const getCurrentMonthName = () => {
    const months = [
      'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
      'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
    ];
    return months[new Date().getMonth()];
  };

  if (loading) {
    return (
      <div className="w-full bg-panel rounded-lg">
        <div className="bg-header-table border-b border-custom p-4">
          <h3 className="text-lg font-semibold text-primary">Producción mes actual</h3>
        </div>
        <div className="flex items-center justify-center p-6" style={{ height }}>
          <div className="text-center">
            <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Cargando datos de producción mensual...
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full bg-panel rounded-lg">
        <div className="bg-header-table border-b border-custom p-4">
          <h3 className="text-lg font-semibold text-primary">Producción mes actual</h3>
        </div>
        <div className="flex items-center justify-center p-6 text-red-500" style={{ height }}>
          <div className="text-center">
            <p className="mb-2">{error}</p>
            <button
              onClick={loadMonthlyData}
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 cursor-pointer"
            >
              Reintentar
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full bg-panel rounded-lg overflow-hidden shadow-sm">
      {/* Header con estadísticas como Grafana */}
      <div className="bg-header-table border-b border-custom p-4">
        <div className="flex justify-between items-start">
          <div>
            <h3 className="text-lg font-semibold text-primary">Producción mes actual</h3>
            <p className="text-sm text-secondary">{getCurrentMonthName()} {new Date().getFullYear()}</p>
          </div>
          
          {/* Tabla de estadísticas como Grafana */}
          <div className="ml-4">
            <table className="text-xs border-collapse">
              <thead>
                <tr>
                  <th className="text-left text-gray-500 font-normal px-1 pb-1">Name</th>
                  <th className="text-right text-blue-500 font-normal px-2 pb-1">Mean</th>
                  <th className="text-right text-blue-500 font-normal px-1 pb-1">Last*</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="px-1 py-0.5">
                    <div className="flex items-center gap-1">
                      <div className="w-2 h-2 bg-green-500 rounded-sm"></div>
                      <span className="text-primary text-xs">La Maja</span>
                    </div>
                  </td>
                  <td className="text-right text-secondary px-2 py-0.5 text-xs">
                    {formatValue(stats.lamaja.mean)}
                  </td>
                  <td className="text-right text-primary px-1 py-0.5 text-xs font-medium">
                    {formatValue(stats.lamaja.lastNotNull)}
                  </td>
                </tr>
                <tr>
                  <td className="px-1 py-0.5">
                    <div className="flex items-center gap-1">
                      <div className="w-2 h-2 bg-yellow-500 rounded-sm"></div>
                      <span className="text-primary text-xs">Retamar</span>
                    </div>
                  </td>
                  <td className="text-right text-secondary px-2 py-0.5 text-xs">
                    {formatValue(stats.retamar.mean)}
                  </td>
                  <td className="text-right text-primary px-1 py-0.5 text-xs font-medium">
                    {formatValue(stats.retamar.lastNotNull)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Gráfica de barras */}
      <div className="p-4">
        <div style={{ width: '100%', height }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart 
              data={chartData} 
              margin={{ top: 10, right: 30, left: 80, bottom: 10 }}
              barCategoryGap={chartData.length <= 5 ? "20%" : chartData.length <= 10 ? "15%" : "10%"}
            >
              <CartesianGrid 
                strokeDasharray="3 3" 
                stroke="var(--text-muted)"
              />
              <XAxis 
                dataKey="dayLabel" 
                stroke="var(--text-muted)"
                fontSize={12}
                tick={{ fill: 'var(--text-muted)' }}
                axisLine={{ stroke: 'var(--text-muted)' }}
                tickLine={{ stroke: 'var(--text-muted)' }}
                interval={0}
                height={60}
              />
              <YAxis 
                stroke="var(--text-muted)"
                fontSize={12}
                tickFormatter={(value) => {
                  if (value >= 1) {
                    return `${Math.round(value)} MWh`;
                  } else if (value > 0) {
                    return `${Math.round(value * 1000)} kWh`;
                  }
                  return '0 kWh';
                }}
                tick={{ fill: 'var(--text-muted)' }}
                axisLine={{ stroke: 'var(--text-muted)' }}
                tickLine={{ stroke: 'var(--text-muted)' }}
                domain={[0, (dataMax) => {
                  // Redondear hacia arriba al siguiente múltiplo de 5
                  return Math.ceil(dataMax / 5) * 5;
                }]}
                ticks={(() => {
                  // Calcular el máximo valor de los datos
                  const maxValue = Math.max(...chartData.flatMap(d => [d['La Maja'] || 0, d['Retamar'] || 0]));
                  const roundedMax = Math.ceil(maxValue / 5) * 5;
                  const ticks = [];
                  for (let i = 0; i <= roundedMax; i += 5) {
                    ticks.push(i);
                  }
                  return ticks;
                })()}
                width={70}
              />
              <Legend 
                wrapperStyle={{ paddingTop: '20px' }}
                iconType="rect"
              />
              
              {/* Barras para cada planta con valores encima */}
              <Bar 
                dataKey="La Maja" 
                fill="#10b981" 
                name="La Maja"
                radius={[1, 1, 0, 0]}
                label={renderCustomBarLabel}
              />
              <Bar 
                dataKey="Retamar" 
                fill="#fbbf24" 
                name="Retamar"
                radius={[1, 1, 0, 0]}
                label={renderCustomBarLabel}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};

export default MonthlyProductionChart;