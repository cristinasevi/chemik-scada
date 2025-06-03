'use client';

import { useState, useEffect } from 'react';
import { Search, Download, Filter, Calendar, Database, FileText, RefreshCw } from 'lucide-react';

const GestionDocumentosPage = () => {
  const [buckets, setBuckets] = useState([]);
  const [selectedBucket, setSelectedBucket] = useState('PV');
  const [measurements, setMeasurements] = useState([]);
  
  // Estados para el sistema de filtros en cascada
  const [selectedMeasurements, setSelectedMeasurements] = useState([]);
  const [availableFieldTypes, setAvailableFieldTypes] = useState([]);
  const [selectedFieldType, setSelectedFieldType] = useState('');
  const [fieldValues, setFieldValues] = useState([]);
  const [selectedFieldValues, setSelectedFieldValues] = useState([]);
  const [availableTagKeys, setAvailableTagKeys] = useState([]);
  const [selectedTagKeys, setSelectedTagKeys] = useState([]);
  const [tagValues, setTagValues] = useState({});
  const [selectedTagValues, setSelectedTagValues] = useState({});

  const [loadingStates, setLoadingStates] = useState({
    buckets: false,
    measurements: false,
    fields: false,
    values: false
  });

  const [timeRange, setTimeRange] = useState({
    type: 'auto',
    from: 'now-1h',
    to: 'now',
    customFrom: '',
    customTo: ''
  });

  const [aggregateFunction, setAggregateFunction] = useState('mean');
  const [isLoading, setIsLoading] = useState(false);
  const [queryResult, setQueryResult] = useState(null);

  // Cargar buckets al iniciar
  useEffect(() => {
    loadBuckets();
  }, []);

  // Cargar measurements cuando cambia el bucket
  useEffect(() => {
    if (selectedBucket) {
      loadMeasurements(selectedBucket);
      resetFilters();
    }
  }, [selectedBucket]);

  const resetFilters = () => {
    setSelectedMeasurements([]);
    setAvailableFieldTypes([]);
    setSelectedFieldType('');
    setFieldValues([]);
    setSelectedFieldValues([]);
    setAvailableTagKeys([]);
    setSelectedTagKeys([]);
    setTagValues({});
    setSelectedTagValues({});
  };

  const loadBuckets = async () => {
    setLoadingStates(prev => ({ ...prev, buckets: true }));
    try {
      const response = await fetch('/api/influxdb/buckets');
      const data = await response.json();
      setBuckets(data.buckets || []);
    } catch (error) {
      console.error('Error loading buckets:', error);
      setBuckets(['DC', 'GeoMap', 'Omie', 'PV', '_monitoring', '_tasks']);
    }
    setLoadingStates(prev => ({ ...prev, buckets: false }));
  };

  const loadMeasurements = async (bucket) => {
    setLoadingStates(prev => ({ ...prev, measurements: true }));
    try {
      const response = await fetch('/api/influxdb/measurements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bucket })
      });
      const data = await response.json();
      setMeasurements(data.measurements || []);
    } catch (error) {
      console.error('Error loading measurements:', error);
      setMeasurements([]);
    }
    setLoadingStates(prev => ({ ...prev, measurements: false }));
  };

  const loadFieldTypes = async (selectedMeasurements) => {
    if (selectedMeasurements.length === 0) {
      setAvailableFieldTypes([]);
      setAvailableTagKeys([]);
      return;
    }

    setLoadingStates(prev => ({ ...prev, fields: true }));
    try {
      // Cargar tag keys usando la API específica para el primer measurement seleccionado
      const tagKeysResponse = await fetch('/api/influxdb/tag-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          bucket: selectedBucket, 
          measurement: selectedMeasurements[0] // Usar el primer measurement como referencia
        })
      });

      let customTags = [];
      if (tagKeysResponse.ok) {
        const tagKeysData = await tagKeysResponse.json();
        customTags = tagKeysData.tagKeys || [];
      }

      // Definir campos del sistema disponibles
      const systemFields = ['_measurement', '_field', '_time', '_value'];
      const allFields = [...systemFields, ...customTags];
      
      setAvailableFieldTypes(allFields);
      setAvailableTagKeys(customTags);
    } catch (error) {
      console.error('Error loading field types:', error);
      // Fallback con campos comunes
      const systemFields = ['_measurement', '_field', '_time', '_value'];
      const fallbackTags = ['PVO_Plant', 'PVO_Zone', 'PVO_id', 'PVO_type'];
      setAvailableFieldTypes([...systemFields, ...fallbackTags]);
      setAvailableTagKeys(fallbackTags);
    }
    setLoadingStates(prev => ({ ...prev, fields: false }));
  };

  const loadFieldValues = async (fieldType) => {
    if (!fieldType || selectedMeasurements.length === 0) return;

    setLoadingStates(prev => ({ ...prev, values: true }));
    try {
      if (fieldType === '_measurement') {
        setFieldValues(selectedMeasurements);
        setLoadingStates(prev => ({ ...prev, values: false }));
        return;
      } else if (fieldType === '_time' || fieldType === '_value') {
        setFieldValues(['(valores continuos)']);
        setLoadingStates(prev => ({ ...prev, values: false }));
        return;
      } else if (fieldType === '_field') {
        // Para _field, usar query directa para obtener todos los fields disponibles
        const measurementFilters = selectedMeasurements
          .map(m => `r._measurement == "${m}"`)
          .join(' or ');

        const query = `
from(bucket: "${selectedBucket}")
  |> range(start: -24h)
  |> filter(fn: (r) => ${measurementFilters})
  |> keep(columns: ["_field"])
  |> distinct(column: "_field")
  |> limit(n: 100)`;

        const response = await fetch('/api/influxdb/query', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query })
        });

        if (response.ok) {
          const result = await response.json();
          const lines = result.data.trim().split('\n');
          const values = [];

          if (lines.length > 1) {
            const headers = lines[0].split(',').map(h => h.replace(/"/g, '').trim());
            const valueIndex = headers.indexOf('_value');

            if (valueIndex !== -1) {
              for (let i = 1; i < lines.length; i++) {
                if (!lines[i].trim()) continue;
                const row = lines[i].split(',');
                if (row[valueIndex]) {
                  const value = row[valueIndex].replace(/"/g, '').trim();
                  if (value && !values.includes(value)) {
                    values.push(value);
                  }
                }
              }
            }
          }
          setFieldValues(values.sort());
        }
      } else {
        // Para tags personalizados, usar la API específica de tag-values
        const tagValuesResponse = await fetch('/api/influxdb/tag-values', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            bucket: selectedBucket, 
            measurement: selectedMeasurements[0], // Usar el primer measurement
            tagKey: fieldType 
          })
        });

        if (tagValuesResponse.ok) {
          const tagValuesData = await tagValuesResponse.json();
          setFieldValues(tagValuesData.values || []);
        } else {
          setFieldValues([]);
        }
      }
    } catch (error) {
      console.error('Error loading field values:', error);
      setFieldValues([]);
    }
    setLoadingStates(prev => ({ ...prev, values: false }));
  };

  const loadTagValues = async (tagKey) => {
    if (!tagKey || selectedMeasurements.length === 0) return;

    try {
      // Usar la API específica para tag-values
      const tagValuesResponse = await fetch('/api/influxdb/tag-values', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          bucket: selectedBucket, 
          measurement: selectedMeasurements[0], // Usar el primer measurement seleccionado
          tagKey: tagKey 
        })
      });

      if (tagValuesResponse.ok) {
        const tagValuesData = await tagValuesResponse.json();
        setTagValues(prev => ({
          ...prev,
          [tagKey]: tagValuesData.values || []
        }));
      } else {
        console.error('Error loading tag values for', tagKey);
        setTagValues(prev => ({
          ...prev,
          [tagKey]: []
        }));
      }
    } catch (error) {
      console.error('Error loading tag values:', error);
      setTagValues(prev => ({
        ...prev,
        [tagKey]: []
      }));
    }
  };

  const handleMeasurementChange = (measurement) => {
    const newSelected = selectedMeasurements.includes(measurement)
      ? selectedMeasurements.filter(m => m !== measurement)
      : [...selectedMeasurements, measurement];

    setSelectedMeasurements(newSelected);
    
    // Reset todos los filtros dependientes
    setSelectedFieldType('');
    setFieldValues([]);
    setSelectedFieldValues([]);
    setSelectedTagKeys([]);
    setTagValues({});
    setSelectedTagValues({});

    if (newSelected.length > 0) {
      // Cargar field types y tag keys para los measurements seleccionados
      loadFieldTypes(newSelected);
    } else {
      setAvailableFieldTypes([]);
      setAvailableTagKeys([]);
    }
  };

  const handleFieldTypeChange = (fieldType) => {
    setSelectedFieldType(fieldType);
    setFieldValues([]);
    setSelectedFieldValues([]);
    
    if (fieldType) {
      loadFieldValues(fieldType);
    }
  };

  const handleFieldValueChange = (value) => {
    const newSelected = selectedFieldValues.includes(value)
      ? selectedFieldValues.filter(v => v !== value)
      : [...selectedFieldValues, value];
    
    setSelectedFieldValues(newSelected);
  };

  const handleTagKeyChange = (tagKey) => {
    const newSelected = selectedTagKeys.includes(tagKey)
      ? selectedTagKeys.filter(k => k !== tagKey)
      : [...selectedTagKeys, tagKey];

    setSelectedTagKeys(newSelected);

    // Solo cargar valores si es una nueva selección
    if (!selectedTagKeys.includes(tagKey)) {
      loadTagValues(tagKey);
    }
  };

  const handleTagValueChange = (tagKey, value) => {
    const currentValues = selectedTagValues[tagKey] || [];
    const newValues = currentValues.includes(value)
      ? currentValues.filter(v => v !== value)
      : [...currentValues, value];

    setSelectedTagValues(prev => ({
      ...prev,
      [tagKey]: newValues
    }));
  };

  const buildFluxQuery = () => {
    let query = `from(bucket: "${selectedBucket}")\n`;
    
    if (timeRange.type === 'auto') {
      query += `  |> range(start: ${timeRange.from}, stop: ${timeRange.to})\n`;
    } else {
      query += `  |> range(start: ${timeRange.customFrom}, stop: ${timeRange.customTo})\n`;
    }

    if (selectedMeasurements.length > 0) {
      if (selectedMeasurements.length === 1) {
        query += `  |> filter(fn: (r) => r._measurement == "${selectedMeasurements[0]}")\n`;
      } else {
        const measurementsList = selectedMeasurements.map(m => `"${m}"`).join(', ');
        query += `  |> filter(fn: (r) => contains(value: r._measurement, set: [${measurementsList}]))\n`;
      }
    }

    if (selectedFieldType && selectedFieldValues.length > 0) {
      if (selectedFieldType === '_field') {
        if (selectedFieldValues.length === 1) {
          query += `  |> filter(fn: (r) => r._field == "${selectedFieldValues[0]}")\n`;
        } else {
          const valuesList = selectedFieldValues.map(v => `"${v}"`).join(', ');
          query += `  |> filter(fn: (r) => contains(value: r._field, set: [${valuesList}]))\n`;
        }
      } else if (!selectedFieldType.startsWith('_') && selectedFieldType !== '_measurement') {
        if (selectedFieldValues.length === 1) {
          query += `  |> filter(fn: (r) => r.${selectedFieldType} == "${selectedFieldValues[0]}")\n`;
        } else {
          const valuesList = selectedFieldValues.map(v => `"${v}"`).join(', ');
          query += `  |> filter(fn: (r) => contains(value: r.${selectedFieldType}, set: [${valuesList}]))\n`;
        }
      }
    }

    Object.entries(selectedTagValues).forEach(([tagKey, values]) => {
      if (values.length > 0) {
        if (values.length === 1) {
          query += `  |> filter(fn: (r) => r.${tagKey} == "${values[0]}")\n`;
        } else {
          const valuesList = values.map(v => `"${v}"`).join(', ');
          query += `  |> filter(fn: (r) => contains(value: r.${tagKey}, set: [${valuesList}]))\n`;
        }
      }
    });

    if (aggregateFunction !== 'none') {
      query += `  |> aggregateWindow(every: 1m, fn: ${aggregateFunction}, createEmpty: false)\n`;
    }

    query += `  |> yield(name: "result")`;
    return query;
  };

  const executeQuery = async () => {
    setIsLoading(true);
    try {
      const query = buildFluxQuery();
      
      const response = await fetch('/api/influxdb/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query })
      });
      
      const data = await response.json();
      
      if (response.ok) {
        setQueryResult({
          query: data.query,
          rows: data.rows,
          executionTime: data.executionTime || '150ms',
          data: data.data
        });
      } else {
        console.error('Query error:', data.error);
        setQueryResult({
          query: query,
          rows: 0,
          executionTime: '0ms',
          data: '',
          error: data.error
        });
      }
    } catch (error) {
      console.error('Error executing query:', error);
      setQueryResult({
        query: buildFluxQuery(),
        rows: 0,
        executionTime: '0ms',
        data: '',
        error: error.message
      });
    }
    setIsLoading(false);
  };

  const exportData = (format) => {
    if (!queryResult || !queryResult.data) {
      alert('No hay datos para exportar. Ejecuta una consulta primero.');
      return;
    }

    if (format === 'csv') {
      const blob = new Blob([queryResult.data], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `influxdb-export-${Date.now()}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } else if (format === 'json') {
      const jsonData = JSON.stringify(queryResult, null, 2);
      const blob = new Blob([jsonData], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `influxdb-export-${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-semibold text-primary">Gestión de Documentos</h1>
          <p className="text-sm text-secondary">Consulta y exportación de datos desde InfluxDB</p>
        </div>
        
        <div className="flex gap-3">
          <button
            onClick={() => exportData('csv')}
            className="flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={!queryResult || !queryResult.data}
          >
            <Download size={16} />
            CSV
          </button>
          <button
            onClick={() => exportData('json')}
            className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={!queryResult || !queryResult.data}
          >
            <Download size={16} />
            JSON
          </button>
        </div>
      </div>

      {/* FROM Section */}
      <div className="bg-panel rounded-lg p-4">
        <h3 className="text-sm font-semibold mb-3 flex items-center gap-2 text-primary">
          <Database size={16} />
          FROM
        </h3>
        
        <select 
          value={selectedBucket}
          onChange={(e) => setSelectedBucket(e.target.value)}
          className="w-full p-2 border border-custom rounded-md bg-panel text-primary"
          disabled={loadingStates.buckets}
        >
          {buckets.map(bucket => (
            <option key={bucket} value={bucket}>{bucket}</option>
          ))}
        </select>
      </div>

      {/* Filters Section */}
      <div className="bg-panel rounded-lg p-4">
        <h3 className="text-sm font-semibold mb-3 flex items-center gap-2 text-primary">
          <Filter size={16} />
          Filtros
        </h3>
        
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
          {/* Measurements */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-primary">_measurement</label>
              <span className="px-2 py-1 bg-blue-500 text-white rounded text-xs">
                {selectedMeasurements.length}
              </span>
            </div>
            
            <div className="max-h-40 overflow-y-auto border border-custom rounded p-2 space-y-1 bg-panel">
              {loadingStates.measurements ? (
                <div className="text-center py-2 text-secondary text-sm">
                  <RefreshCw className="w-4 h-4 animate-spin mx-auto mb-1" />
                  Cargando measurements...
                </div>
              ) : measurements.length === 0 ? (
                <div className="text-center py-2 text-secondary text-sm">
                  No hay measurements disponibles
                </div>
              ) : (
                measurements.map(measurement => (
                  <label key={measurement} className="flex items-center space-x-2 text-sm cursor-pointer hover-bg rounded p-1">
                    <input
                      type="checkbox"
                      checked={selectedMeasurements.includes(measurement)}
                      onChange={() => handleMeasurementChange(measurement)}
                      className="rounded"
                    />
                    <span className="truncate text-primary">{measurement}</span>
                  </label>
                ))
              )}
            </div>
          </div>

          {/* Field Type */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-primary">Field Type</label>
              <span className="px-2 py-1 bg-blue-500 text-white rounded text-xs">
                {selectedFieldValues.length}
              </span>
            </div>
            
            <select
              value={selectedFieldType}
              onChange={(e) => handleFieldTypeChange(e.target.value)}
              className="w-full p-2 border border-custom rounded text-sm bg-panel text-primary"
              disabled={availableFieldTypes.length === 0}
            >
              <option value="">Seleccionar tipo</option>
              {availableFieldTypes.map(fieldType => (
                <option key={fieldType} value={fieldType}>{fieldType}</option>
              ))}
            </select>
            
            <div className="max-h-32 overflow-y-auto border border-custom rounded p-2 space-y-1 bg-panel">
              {selectedFieldType && fieldValues.length === 0 && loadingStates.values ? (
                <div className="text-center py-2 text-secondary text-sm">
                  <RefreshCw className="w-4 h-4 animate-spin mx-auto mb-1" />
                  Cargando valores...
                </div>
              ) : fieldValues.length === 0 ? (
                <div className="text-center py-2 text-secondary text-sm">
                  {selectedFieldType ? 'No hay valores disponibles' : 'Selecciona un field type'}
                </div>
              ) : (
                fieldValues.map(value => (
                  <label key={value} className="flex items-center space-x-2 text-sm cursor-pointer hover-bg rounded p-1">
                    <input
                      type="checkbox"
                      checked={selectedFieldValues.includes(value)}
                      onChange={() => handleFieldValueChange(value)}
                      className="rounded"
                    />
                    <span className="truncate text-primary">{value}</span>
                  </label>
                ))
              )}
            </div>
          </div>

          {/* Tag Keys */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-primary">Tag Keys</label>
              <span className="px-2 py-1 bg-blue-500 text-white rounded text-xs">
                {selectedTagKeys.length}
              </span>
            </div>
            
            <div className="max-h-40 overflow-y-auto border border-custom rounded p-2 space-y-1 bg-panel">
              {availableTagKeys.length === 0 ? (
                <div className="text-center py-2 text-secondary text-sm">
                  Selecciona measurements primero
                </div>
              ) : (
                availableTagKeys.map(tagKey => (
                  <label key={tagKey} className="flex items-center space-x-2 text-sm cursor-pointer hover-bg rounded p-1">
                    <input
                      type="checkbox"
                      checked={selectedTagKeys.includes(tagKey)}
                      onChange={() => handleTagKeyChange(tagKey)}
                      className="rounded"
                    />
                    <span className="truncate text-primary">{tagKey}</span>
                  </label>
                ))
              )}
            </div>
          </div>

          {/* Tag Values */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-primary">Tag Values</label>
              <span className="px-2 py-1 bg-blue-500 text-white rounded text-xs">
                {Object.values(selectedTagValues).flat().length}
              </span>
            </div>
            
            <div className="max-h-40 overflow-y-auto border border-custom rounded p-2 space-y-2 bg-panel">
              {selectedTagKeys.length === 0 ? (
                <div className="text-center py-2 text-secondary text-sm">
                  Selecciona tag keys primero
                </div>
              ) : (
                selectedTagKeys.map(tagKey => (
                  <div key={tagKey} className="space-y-1">
                    <div className="text-xs font-semibold text-secondary border-b border-custom pb-1">
                      {tagKey}
                    </div>
                    {tagValues[tagKey] ? (
                      tagValues[tagKey].map(value => (
                        <label key={`${tagKey}-${value}`} className="flex items-center space-x-2 text-sm cursor-pointer hover-bg rounded p-1">
                          <input
                            type="checkbox"
                            checked={(selectedTagValues[tagKey] || []).includes(value)}
                            onChange={() => handleTagValueChange(tagKey, value)}
                            className="rounded"
                          />
                          <span className="truncate text-primary">{value}</span>
                        </label>
                      ))
                    ) : (
                      <div className="text-xs text-secondary flex items-center gap-1">
                        <RefreshCw className="w-3 h-3 animate-spin" />
                        Cargando...
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Time Range */}
      <div className="bg-panel rounded-lg p-4">
        <h3 className="text-sm font-semibold mb-3 flex items-center gap-2 text-primary">
          <Calendar size={16} />
          Rango de Tiempo
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <div className="flex gap-2 mb-2">
              <button
                onClick={() => setTimeRange({...timeRange, type: 'custom'})}
                className={`px-3 py-1 text-sm rounded ${timeRange.type === 'custom' ? 'bg-blue-500 text-white' : 'bg-header-table text-primary border border-custom'}`}
              >
                CUSTOM
              </button>
              <button
                onClick={() => setTimeRange({...timeRange, type: 'auto'})}
                className={`px-3 py-1 text-sm rounded ${timeRange.type === 'auto' ? 'bg-blue-500 text-white' : 'bg-header-table text-primary border border-custom'}`}
              >
                AUTO
              </button>
            </div>
            
            {timeRange.type === 'auto' ? (
              <select
                value={`${timeRange.from}-${timeRange.to}`}
                onChange={(e) => {
                  const [from, to] = e.target.value.split('-');
                  setTimeRange({...timeRange, from, to});
                }}
                className="w-full p-2 border border-custom rounded text-sm bg-panel text-primary"
              >
                <option value="now-5m-now">Last 5 minutes</option>
                <option value="now-1h-now">Last 1 hour</option>
                <option value="now-6h-now">Last 6 hours</option>
                <option value="now-24h-now">Last 24 hours</option>
                <option value="now-7d-now">Last 7 days</option>
              </select>
            ) : (
              <div className="space-y-2">
                <input
                  type="datetime-local"
                  value={timeRange.customFrom}
                  onChange={(e) => setTimeRange({...timeRange, customFrom: e.target.value})}
                  className="w-full p-2 border border-custom rounded text-sm bg-panel text-primary"
                />
                <input
                  type="datetime-local"
                  value={timeRange.customTo}
                  onChange={(e) => setTimeRange({...timeRange, customTo: e.target.value})}
                  className="w-full p-2 border border-custom rounded text-sm bg-panel text-primary"
                />
              </div>
            )}
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-2 text-primary">Función de Agregación</label>
            <select
              value={aggregateFunction}
              onChange={(e) => setAggregateFunction(e.target.value)}
              className="w-full p-2 border border-custom rounded text-sm bg-panel text-primary"
            >
              <option value="none">Sin agregación</option>
              <option value="mean">mean</option>
              <option value="median">median</option>
              <option value="last">last</option>
              <option value="max">max</option>
              <option value="min">min</option>
              <option value="sum">sum</option>
            </select>
          </div>
        </div>
      </div>

      {/* Execute Query */}
      <div className="flex justify-center">
        <button
          onClick={executeQuery}
          disabled={isLoading || selectedMeasurements.length === 0}
          className="flex items-center gap-2 px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? (
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <FileText size={16} />
          )}
          {isLoading ? 'Ejecutando...' : 'Ejecutar consulta'}
        </button>
      </div>

      {/* Results */}
      {queryResult && (
        <div className="bg-panel rounded-lg p-4">
          <h3 className="text-sm font-semibold mb-3 text-primary">Resultado</h3>
          
          {queryResult.error ? (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-4">
              <h4 className="text-red-800 dark:text-red-200 font-medium mb-2">Error en la consulta</h4>
              <p className="text-red-600 dark:text-red-300 text-sm">{queryResult.error}</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-500">{queryResult.rows}</div>
                <div className="text-xs text-secondary">Filas</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-500">{queryResult.executionTime}</div>
                <div className="text-xs text-secondary">Tiempo</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-purple-500">{selectedBucket}</div>
                <div className="text-xs text-secondary">Bucket</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-orange-500">{selectedMeasurements.length}</div>
                <div className="text-xs text-secondary">Measurements</div>
              </div>
            </div>
          )}
          
          <div className="bg-header-table border border-custom p-3 rounded text-sm font-mono overflow-x-auto">
            <pre className="text-primary whitespace-pre-wrap">{queryResult.query}</pre>
          </div>

          {queryResult.data && queryResult.rows > 0 && (
            <div className="mt-4">
              <h4 className="text-sm font-medium mb-2 text-primary">Vista previa de datos (primeras 10 líneas)</h4>
              <div className="bg-header-table border border-custom p-3 rounded text-xs font-mono overflow-x-auto max-h-60 overflow-y-auto">
                <pre className="text-primary whitespace-pre-wrap">
                  {queryResult.data.split('\n').slice(0, 11).join('\n')}
                  {queryResult.data.split('\n').length > 11 && '\n... (más datos disponibles en la exportación)'}
                </pre>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default GestionDocumentosPage;