'use client';

import { useEffect, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const PowerChart = ({ height = "400px" }) => {
  const [chartData, setChartData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [stats, setStats] = useState({
    lamaja: { min: 0, mean: 0, max: 0, last: 0 },
    retamar: { min: 0, mean: 0, max: 0, last: 0 },
    total: { min: 0, mean: 0, max: 0, last: 0 }
  });

  const loadChartData = async () => {
    try {
      setLoading(true);
      
      // Cargar datos replicando exactamente la query de Grafana
      const [lamajaResponse, retamarResponse, totalResponse] = await Promise.all([
        fetch('/api/timeseries-data?metric=power&plant=LAMAJA&hours=24&aggregation=5m'),
        fetch('/api/timeseries-data?metric=power&plant=RETAMAR&hours=24&aggregation=5m'), 
        fetch('/api/timeseries-data?metric=power&plant=total&hours=24&aggregation=5m')
      ]);

      const [lamajaData, retamarData, totalData] = await Promise.all([
        lamajaResponse.json(),
        retamarResponse.json(),
        totalResponse.json()
      ]);

      if (!lamajaData.success || !retamarData.success || !totalData.success) {
        throw new Error('Error cargando datos de potencia');
      }

      // Crear un mapa por timestamp para sincronizar los datos
      const dataMap = new Map();
      
      // Agregar datos de cada planta (convertir MW a kW para coincidir con Grafana)
      totalData.data.forEach(point => {
        dataMap.set(point.timestamp, {
          time: new Date(point.time).toLocaleTimeString('es-ES', { 
            hour: '2-digit', 
            minute: '2-digit' 
          }),
          timestamp: point.timestamp,
          'Total': (point.value || 0) * 1000, // Convertir MW a kW
          'La Maja': 0,
          'Retamar': 0
        });
      });

      lamajaData.data.forEach(point => {
        if (dataMap.has(point.timestamp)) {
          dataMap.get(point.timestamp)['La Maja'] = (point.value || 0) * 1000; // Convertir MW a kW
        }
      });

      retamarData.data.forEach(point => {
        if (dataMap.has(point.timestamp)) {
          dataMap.get(point.timestamp)['Retamar'] = (point.value || 0) * 1000; // Convertir MW a kW
        }
      });

      // Convertir mapa a array y ordenar por timestamp
      const combinedData = Array.from(dataMap.values())
        .sort((a, b) => a.timestamp - b.timestamp);

      // Calcular estadísticas exactas como Grafana
       const calculateStats = (values) => {
        if (values.length === 0) return { min: 0, mean: 0, max: 0, last: 0 };
        
        const validValues = values.filter(v => v !== null && v !== undefined && !isNaN(v));
        if (validValues.length === 0) return { min: 0, mean: 0, max: 0, last: 0 };
        
        const min = Math.min(...validValues);
        const max = Math.max(...validValues);
        const mean = validValues.reduce((sum, val) => sum + val, 0) / validValues.length;
        
        // Para "Last", buscar el último valor válido (diferente de 0) del array
        let last = 0;
        for (let i = values.length - 1; i >= 0; i--) {
          if (values[i] !== null && values[i] !== undefined && !isNaN(values[i]) && values[i] !== 0) {
            last = values[i];
            break;
          }
        }
        
        // Si no encontramos ningún valor diferente de 0, usar el último valor del array
        if (last === 0 && values.length > 0) {
          last = values[values.length - 1] || 0;
        }
        
        return { min, mean, max, last };
      };

      const lamajaValues = combinedData.map(d => d['La Maja']);
      const retamarValues = combinedData.map(d => d['Retamar']);
      const totalValues = combinedData.map(d => d['Total']);

      setStats({
        lamaja: calculateStats(lamajaValues),
        retamar: calculateStats(retamarValues),
        total: calculateStats(totalValues)
      });

      setChartData(combinedData);
      setError(null);
    } catch (err) {
      setError('Error cargando datos de potencia');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadChartData();
    
    // Auto-refresh cada 5 minutos
    const interval = setInterval(loadChartData, 300000);
    return () => clearInterval(interval);
  }, []);

  const formatTooltip = (value, name) => {
    if (typeof value === 'number') {
      if (Math.abs(value) >= 1000) {
        return [`${(value / 1000).toFixed(2)} MW`, name];
      }
      return [`${value.toFixed(0)} kW`, name];
    }
    return [value, name];
  };

  const formatValue = (value) => {
    if (value === null || value === undefined || isNaN(value)) {
      return '--';
    }
    
    // Formato exacto como Grafana
    if (Math.abs(value) >= 1000) {
      return `${(value / 1000).toFixed(2)} MW`;
    }
    
    return `${Math.round(value)} kW`;
  };

  if (loading) {
    return (
      <div className="w-full bg-panel rounded-lg">
        <div className="bg-header-table border-b border-custom p-4">
          <h3 className="text-lg font-semibold text-primary">Potencias</h3>
        </div>
        <div className="flex items-center justify-center p-6" style={{ height }}>
          <div className="text-center">
            <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Cargando gráfica de potencias...
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
          <h3 className="text-lg font-semibold text-primary">Potencias</h3>
        </div>
        <div className="flex items-center justify-center p-6 text-red-500" style={{ height }}>
          <div className="text-center">
            <p className="mb-2">{error}</p>
            <button
              onClick={loadChartData}
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
      {/* Header minimalista */}
      <div className="bg-header-table border-b border-custom p-4">
        <div className="flex justify-between items-start">
          <div>
            <h3 className="text-lg font-semibold text-primary">Potencias</h3>
          </div>
          
          {/* Tabla compacta de estadísticas como Grafana */}
          <div className="ml-4">
            <table className="text-xs border-collapse">
              <thead>
                <tr>
                  <th className="text-left text-gray-500 font-normal px-1 pb-1">Name</th>
                  <th className="text-right text-blue-500 font-normal px-2 pb-1">Min</th>
                  <th className="text-right text-blue-500 font-normal px-2 pb-1">Mean</th>
                  <th className="text-right text-blue-500 font-normal px-2 pb-1">Max</th>
                  <th className="text-right text-blue-500 font-normal px-1 pb-1">Last</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="px-1 py-0.5">
                    <div className="flex items-center gap-1">
                      <div className="w-2 h-px bg-green-500"></div>
                      <span className="text-primary text-xs">La Maja</span>
                    </div>
                  </td>
                  <td className="text-right text-secondary px-2 py-0.5 text-xs">{formatValue(stats.lamaja.min)}</td>
                  <td className="text-right text-secondary px-2 py-0.5 text-xs">{formatValue(stats.lamaja.mean)}</td>
                  <td className="text-right text-secondary px-2 py-0.5 text-xs">{formatValue(stats.lamaja.max)}</td>
                  <td className="text-right text-primary px-1 py-0.5 text-xs font-medium">{formatValue(stats.lamaja.last)}</td>
                </tr>
                <tr>
                  <td className="px-1 py-0.5">
                    <div className="flex items-center gap-1">
                      <div className="w-2 h-px bg-yellow-500"></div>
                      <span className="text-primary text-xs">Retamar</span>
                    </div>
                  </td>
                  <td className="text-right text-secondary px-2 py-0.5 text-xs">{formatValue(stats.retamar.min)}</td>
                  <td className="text-right text-secondary px-2 py-0.5 text-xs">{formatValue(stats.retamar.mean)}</td>
                  <td className="text-right text-secondary px-2 py-0.5 text-xs">{formatValue(stats.retamar.max)}</td>
                  <td className="text-right text-primary px-1 py-0.5 text-xs font-medium">{formatValue(stats.retamar.last)}</td>
                </tr>
                <tr>
                  <td className="px-1 py-0.5">
                    <div className="flex items-center gap-1">
                      <div className="w-2 h-px bg-blue-500"></div>
                      <span className="text-primary text-xs">Total</span>
                    </div>
                  </td>
                  <td className="text-right text-secondary px-2 py-0.5 text-xs">{formatValue(stats.total.min)}</td>
                  <td className="text-right text-secondary px-2 py-0.5 text-xs">{formatValue(stats.total.mean)}</td>
                  <td className="text-right text-secondary px-2 py-0.5 text-xs">{formatValue(stats.total.max)}</td>
                  <td className="text-right text-primary px-1 py-0.5 text-xs font-medium">{formatValue(stats.total.last)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Gráfica */}
      <div className="p-4">
        <div style={{ width: '100%', height }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart 
              data={chartData} 
              margin={{ top: 10, right: 30, left: 20, bottom: 10 }}
            >
              <CartesianGrid 
                strokeDasharray="3 3" 
                stroke="var(--text-muted)"
              />
              <XAxis 
                dataKey="time" 
                stroke="var(--text-muted)"
                fontSize={12}
                interval="preserveStartEnd"
                tick={{ fill: 'var(--text-muted)' }}
                axisLine={{ stroke: 'var(--text-muted)' }}
                tickLine={{ stroke: 'var(--text-muted)' }}
              />
              <YAxis 
                stroke="var(--text-muted)"
                fontSize={12}
                tickFormatter={(value) => {
                  if (Math.abs(value) >= 1000) {
                    return `${(value / 1000).toFixed(0)} MW`;
                  }
                  return `${value.toFixed(0)} kW`;
                }}
                tick={{ fill: 'var(--text-muted)' }}
                axisLine={{ stroke: 'var(--text-muted)' }}
                tickLine={{ stroke: 'var(--text-muted)' }}
                domain={[0, 6000]} // Rango de 0 kW a 6 MW (6000 kW)
                ticks={[0, 1000, 2000, 3000, 4000, 5000, 6000]} // Marcas específicas
              />
              <Tooltip 
                formatter={formatTooltip}
                labelStyle={{ color: 'black' }}
                contentStyle={{ 
                  backgroundColor: 'white', 
                  border: '1px solid var(--border-color)',
                  borderRadius: '6px',
                  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                  color: 'var(--text-primary)'
                }}
                cursor={{ stroke: 'var(--border-color)', strokeWidth: 1, strokeDasharray: '3 3' }}
              />
              <Legend 
                wrapperStyle={{ paddingTop: '20px' }}
                iconType="line"
              />
              
              {/* Líneas de las series */}
              <Line 
                type="monotone" 
                dataKey="La Maja" 
                stroke="#10b981" 
                strokeWidth={2}
                dot={false}
                connectNulls={false}
                activeDot={{ r: 4, fill: '#10b981' }}
              />
              <Line 
                type="monotone" 
                dataKey="Retamar" 
                stroke="#fbbf24" 
                strokeWidth={2}
                dot={false}
                connectNulls={false}
                activeDot={{ r: 4, fill: '#fbbf24' }}
              />
              <Line 
                type="monotone" 
                dataKey="Total" 
                stroke="#3b82f6" 
                strokeWidth={3}
                dot={false}
                connectNulls={false}
                activeDot={{ r: 5, fill: '#3b82f6' }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};

export default PowerChart;