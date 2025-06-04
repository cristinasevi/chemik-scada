'use client';

import { useState, useEffect } from 'react';
import { Search, Download, Filter, Calendar, Database, FileText, RefreshCw } from 'lucide-react';

const GestionDocumentosPage = () => {
  const [buckets, setBuckets] = useState([]);
  const [selectedBucket, setSelectedBucket] = useState('');
  const [measurements, setMeasurements] = useState([]);
  const [availablePrimaryFilters, setAvailablePrimaryFilters] = useState([]);
  const [aggregationFunctions, setAggregationFunctions] = useState([]);

  // Estados para filtros independientes
  const [selectedMeasurements, setSelectedMeasurements] = useState([]);
  const [availableFieldTypes, setAvailableFieldTypes] = useState([]);
  
  // Filtro primario
  const [primaryFilter, setPrimaryFilter] = useState({
    type: '',
    values: []
  });
  const [primaryFieldValues, setPrimaryFieldValues] = useState([]);
  
  // Filtro secundario
  const [secondaryFilter, setSecondaryFilter] = useState({
    type: '',
    values: []
  });
  const [secondaryFieldValues, setSecondaryFieldValues] = useState([]);
  
  // Tags adicionales
  const [availableTagKeys, setAvailableTagKeys] = useState([]);
  const [selectedTagKeys, setSelectedTagKeys] = useState([]);
  const [tagValues, setTagValues] = useState({});
  const [selectedTagValues, setSelectedTagValues] = useState({});

  const [loadingStates, setLoadingStates] = useState({
    buckets: false,
    measurements: false,
    fields: false,
    primaryValues: false,
    secondaryValues: false,
    primaryFilters: false
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
    loadAggregationFunctions();
  }, []);

  // Cargar measurements cuando cambia el bucket
  useEffect(() => {
    if (selectedBucket) {
      loadMeasurements(selectedBucket);
      loadPrimaryFilters(selectedBucket);
      resetFilters();
    } else {
      setMeasurements([]);
      setAvailablePrimaryFilters([]);
      resetFilters();
    }
  }, [selectedBucket]);

  const resetFilters = () => {
    setSelectedMeasurements([]);
    setPrimaryFilter({ type: '', values: [] });
    setSecondaryFilter({ type: '', values: [] });
    setPrimaryFieldValues([]);
    setSecondaryFieldValues([]);
    setAvailableFieldTypes([]);
    setSelectedTagKeys([]);
    setTagValues({});
    setSelectedTagValues({});
  };

  const loadPrimaryFilters = async (bucket) => {
    setLoadingStates(prev => ({ ...prev, primaryFilters: true }));
    try {
      console.log('🔍 Cargando filtros para bucket:', bucket);

      const exploreResponse = await fetch('/api/influxdb/explore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bucket })
      });

      if (exploreResponse.ok) {
        const exploreData = await exploreResponse.json();
        console.log('📊 Filtros encontrados:', exploreData.availableTags);

        if (exploreData.availableTags && exploreData.availableTags.length > 0) {
          const systemFields = exploreData.availableTags.filter(tag => tag.startsWith('_'));
          const customFields = exploreData.availableTags.filter(tag =>
            !tag.startsWith('_') && tag.trim() !== ''
          ).sort();

          const organizedFilters = [...systemFields, ...customFields];
          console.log('✅ Filtros organizados:', organizedFilters);
          setAvailablePrimaryFilters(organizedFilters);
        } else {
          setAvailablePrimaryFilters(['_measurement', '_field']);
        }
      } else {
        console.warn('⚠️ Error en explore, usando filtros básicos');
        setAvailablePrimaryFilters(['_measurement', '_field']);
      }

    } catch (error) {
      console.error('❌ Error cargando filtros:', error);
      setAvailablePrimaryFilters(['_measurement', '_field']);
    }
    setLoadingStates(prev => ({ ...prev, primaryFilters: false }));
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

  const loadAggregationFunctions = async () => {
    try {
      console.log('🔍 Cargando funciones de agregación desde InfluxDB...');

      const response = await fetch('/api/influxdb/aggregation-functions');

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      console.log('📊 Respuesta de la API:', data);

      if (data.functions && Array.isArray(data.functions) && data.functions.length > 0) {
        setAggregationFunctions(data.functions);
        console.log(`✅ ${data.functions.length} funciones cargadas desde InfluxDB:`, data.functions);
        console.log(`📡 Fuente: ${data.source}`);
      } else {
        console.warn('⚠️ No se pudieron obtener funciones de agregación de InfluxDB');
        setAggregationFunctions(['none']);
      }

    } catch (error) {
      console.error('❌ Error cargando funciones de agregación:', error);
      setAggregationFunctions(['none']);
    }
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
      const exploreResponse = await fetch('/api/influxdb/explore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bucket: selectedBucket })
      });

      let allAvailableFields = [];
      let customTags = [];

      if (exploreResponse.ok) {
        const exploreData = await exploreResponse.json();
        allAvailableFields = exploreData.availableTags || [];

        const systemFields = ['_measurement', '_field', '_time', '_value'];
        customTags = allAvailableFields.filter(field => !systemFields.includes(field));

        console.log('📊 Todos los campos disponibles:', allAvailableFields);
        console.log('🏷️ Tags personalizados:', customTags);
      } else {
        const tagKeysResponse = await fetch('/api/influxdb/tag-keys', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            bucket: selectedBucket,
            measurement: selectedMeasurements[0]
          })
        });

        if (tagKeysResponse.ok) {
          const tagKeysData = await tagKeysResponse.json();
          customTags = tagKeysData.tagKeys || [];
        }

        const systemFields = ['_measurement', '_field', '_time', '_value'];
        allAvailableFields = [...systemFields, ...customTags];
      }

      setAvailableFieldTypes(allAvailableFields);
      setAvailableTagKeys(customTags);

    } catch (error) {
      console.error('Error loading field types:', error);
      const systemFields = ['_measurement', '_field', '_time', '_value'];
      const fallbackTags = ['PVO_Plant', 'PVO_Zone', 'PVO_id', 'PVO_type'];
      setAvailableFieldTypes([...systemFields, ...fallbackTags]);
      setAvailableTagKeys(fallbackTags);
    }
    setLoadingStates(prev => ({ ...prev, fields: false }));
  };

  const loadFieldValuesDirectly = async (fieldType, filterType = 'primary') => {
    const loadingKey = filterType === 'primary' ? 'primaryValues' : 'secondaryValues';
    setLoadingStates(prev => ({ ...prev, [loadingKey]: true }));
    
    try {
      console.log(`🔍 Cargando valores para campo: ${fieldType} (${filterType})`);

      if (fieldType === '_measurement') {
        if (filterType === 'primary') {
          setPrimaryFieldValues(measurements);
        } else {
          setSecondaryFieldValues(measurements);
        }
        setLoadingStates(prev => ({ ...prev, [loadingKey]: false }));
        return;
      } else if (fieldType === '_time' || fieldType === '_value') {
        const continuousMessage = ['(valores continuos - usar filtro de tiempo)'];
        if (filterType === 'primary') {
          setPrimaryFieldValues(continuousMessage);
        } else {
          setSecondaryFieldValues(continuousMessage);
        }
        setLoadingStates(prev => ({ ...prev, [loadingKey]: false }));
        return;
      }

      let query;
      if (fieldType === '_field') {
        query = `
from(bucket: "${selectedBucket}")
  |> range(start: -24h)
  |> keep(columns: ["_field"])
  |> distinct(column: "_field")
  |> limit(n: 100)`;
      } else {
        query = `
from(bucket: "${selectedBucket}")
  |> range(start: -24h)
  |> filter(fn: (r) => exists r.${fieldType})
  |> keep(columns: ["${fieldType}"])
  |> distinct(column: "${fieldType}")
  |> limit(n: 100)`;
      }

      console.log('📝 Query para cargar valores:', query);

      const response = await fetch('/api/influxdb/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query })
      });

      if (response.ok) {
        const result = await response.json();
        console.log('📊 Resultado de query:', result);

        const lines = result.data.trim().split('\n');
        const values = [];

        if (lines.length > 1) {
          const headers = lines[0].split(',').map(h => h.replace(/"/g, '').trim());
          const valueIndex = fieldType === '_field' ? headers.indexOf('_value') : headers.indexOf(fieldType);

          if (valueIndex !== -1) {
            for (let i = 1; i < lines.length; i++) {
              if (!lines[i].trim()) continue;
              const row = lines[i].split(',');
              if (row[valueIndex]) {
                const value = row[valueIndex].replace(/"/g, '').trim();
                if (value && value !== '' && value !== 'null' && !values.includes(value)) {
                  values.push(value);
                }
              }
            }
          }
        }

        console.log('✅ Valores extraídos:', values);
        if (filterType === 'primary') {
          setPrimaryFieldValues(values.sort());
        } else {
          setSecondaryFieldValues(values.sort());
        }
      } else {
        console.error('❌ Error en query:', response.status);
        if (filterType === 'primary') {
          setPrimaryFieldValues([]);
        } else {
          setSecondaryFieldValues([]);
        }
      }
    } catch (error) {
      console.error('❌ Error cargando valores directamente:', error);
      if (filterType === 'primary') {
        setPrimaryFieldValues([]);
      } else {
        setSecondaryFieldValues([]);
      }
    }
    setLoadingStates(prev => ({ ...prev, [loadingKey]: false }));
  };

  const loadTagValues = async (tagKey) => {
    if (!tagKey || selectedMeasurements.length === 0) return;

    try {
      const tagValuesResponse = await fetch('/api/influxdb/tag-values', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bucket: selectedBucket,
          measurement: selectedMeasurements[0],
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

  const handleBucketChange = (bucketName) => {
    setSelectedBucket(bucketName);
  };

  const handleMeasurementChange = (measurement) => {
    const newSelected = selectedMeasurements.includes(measurement)
      ? selectedMeasurements.filter(m => m !== measurement)
      : [...selectedMeasurements, measurement];

    setSelectedMeasurements(newSelected);

    // Resetear solo los filtros de tags
    setSelectedTagKeys([]);
    setTagValues({});
    setSelectedTagValues({});

    if (newSelected.length > 0) {
      loadFieldTypes(newSelected);
    } else {
      setAvailableFieldTypes([]);
      setAvailableTagKeys([]);
    }
  };

  // Manejadores para filtro primario
  const handlePrimaryFilterTypeChange = (filterType) => {
    setPrimaryFilter({
      type: filterType,
      values: []
    });
    setPrimaryFieldValues([]);

    if (filterType === '_measurement') {
      setPrimaryFieldValues(measurements);
    } else if (filterType === '_time' || filterType === '_value') {
      setPrimaryFieldValues(['(valores continuos - usar filtro de tiempo)']);
    } else if (filterType && filterType !== '') {
      loadFieldValuesDirectly(filterType, 'primary');
    }
  };

  const handlePrimaryFilterValueChange = (value) => {
    const newValues = primaryFilter.values.includes(value)
      ? primaryFilter.values.filter(v => v !== value)
      : [...primaryFilter.values, value];

    setPrimaryFilter(prev => ({
      ...prev,
      values: newValues
    }));

    // Si el filtro primario es _measurement, actualizar selectedMeasurements
    if (primaryFilter.type === '_measurement') {
      setSelectedMeasurements(newValues);
      if (newValues.length > 0) {
        loadFieldTypes(newValues);
      }
    }
  };

  // Manejadores para filtro secundario
  const handleSecondaryFilterTypeChange = (filterType) => {
    setSecondaryFilter({
      type: filterType,
      values: []
    });
    setSecondaryFieldValues([]);

    if (filterType === '_measurement') {
      setSecondaryFieldValues(measurements);
    } else if (filterType === '_time' || filterType === '_value') {
      setSecondaryFieldValues(['(valores continuos - usar filtro de tiempo)']);
    } else if (filterType && filterType !== '' && filterType !== primaryFilter.type) {
      loadFieldValuesDirectly(filterType, 'secondary');
    }
  };

  const handleSecondaryFilterValueChange = (value) => {
    const newValues = secondaryFilter.values.includes(value)
      ? secondaryFilter.values.filter(v => v !== value)
      : [...secondaryFilter.values, value];

    setSecondaryFilter(prev => ({
      ...prev,
      values: newValues
    }));
  };

  const handleTagKeyChange = (tagKey) => {
    const newSelected = selectedTagKeys.includes(tagKey)
      ? selectedTagKeys.filter(k => k !== tagKey)
      : [...selectedTagKeys, tagKey];

    setSelectedTagKeys(newSelected);

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
    if (!selectedBucket) {
      return 'Error: Debe seleccionar un bucket primero';
    }

    let query = `from(bucket: "${selectedBucket}")\n`;

    if (timeRange.type === 'auto') {
      query += `  |> range(start: ${timeRange.from}, stop: ${timeRange.to})\n`;
    } else {
      query += `  |> range(start: ${timeRange.customFrom}, stop: ${timeRange.customTo})\n`;
    }

    // Aplicar filtro primario
    if (primaryFilter.type && primaryFilter.values.length > 0) {
      if (primaryFilter.type === '_measurement') {
        if (primaryFilter.values.length === 1) {
          query += `  |> filter(fn: (r) => r._measurement == "${primaryFilter.values[0]}")\n`;
        } else {
          const valuesList = primaryFilter.values.map(v => `"${v}"`).join(', ');
          query += `  |> filter(fn: (r) => contains(value: r._measurement, set: [${valuesList}]))\n`;
        }
      } else if (primaryFilter.type === '_field') {
        if (primaryFilter.values.length === 1) {
          query += `  |> filter(fn: (r) => r._field == "${primaryFilter.values[0]}")\n`;
        } else {
          const valuesList = primaryFilter.values.map(v => `"${v}"`).join(', ');
          query += `  |> filter(fn: (r) => contains(value: r._field, set: [${valuesList}]))\n`;
        }
      } else if (!primaryFilter.type.startsWith('_') || primaryFilter.type === '_value') {
        if (primaryFilter.values.length === 1) {
          query += `  |> filter(fn: (r) => r.${primaryFilter.type} == "${primaryFilter.values[0]}")\n`;
        } else {
          const valuesList = primaryFilter.values.map(v => `"${v}"`).join(', ');
          query += `  |> filter(fn: (r) => contains(value: r.${primaryFilter.type}, set: [${valuesList}]))\n`;
        }
      }
    }

    // Aplicar filtro secundario
    if (secondaryFilter.type && secondaryFilter.values.length > 0) {
      if (secondaryFilter.type === '_measurement') {
        if (secondaryFilter.values.length === 1) {
          query += `  |> filter(fn: (r) => r._measurement == "${secondaryFilter.values[0]}")\n`;
        } else {
          const valuesList = secondaryFilter.values.map(v => `"${v}"`).join(', ');
          query += `  |> filter(fn: (r) => contains(value: r._measurement, set: [${valuesList}]))\n`;
        }
      } else if (secondaryFilter.type === '_field') {
        if (secondaryFilter.values.length === 1) {
          query += `  |> filter(fn: (r) => r._field == "${secondaryFilter.values[0]}")\n`;
        } else {
          const valuesList = secondaryFilter.values.map(v => `"${v}"`).join(', ');
          query += `  |> filter(fn: (r) => contains(value: r._field, set: [${valuesList}]))\n`;
        }
      } else if (!secondaryFilter.type.startsWith('_') || secondaryFilter.type === '_value') {
        if (secondaryFilter.values.length === 1) {
          query += `  |> filter(fn: (r) => r.${secondaryFilter.type} == "${secondaryFilter.values[0]}")\n`;
        } else {
          const valuesList = secondaryFilter.values.map(v => `"${v}"`).join(', ');
          query += `  |> filter(fn: (r) => contains(value: r.${secondaryFilter.type}, set: [${valuesList}]))\n`;
        }
      }
    }

    // Aplicar filtros de tags adicionales
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
    if (!selectedBucket) {
      alert('Debe seleccionar un bucket primero');
      return;
    }

    // Verificar que al menos uno de los filtros tenga valores
    const hasPrimaryFilter = primaryFilter.type && primaryFilter.values.length > 0;
    const hasSecondaryFilter = secondaryFilter.type && secondaryFilter.values.length > 0;
    const hasTagFilters = Object.values(selectedTagValues).some(values => values.length > 0);

    if (!hasPrimaryFilter && !hasSecondaryFilter && !hasTagFilters) {
      alert('Debe configurar al menos un filtro');
      return;
    }

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
            className="flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            disabled={!queryResult || !queryResult.data}
          >
            <Download size={16} />
            CSV
          </button>
          <button
            onClick={() => exportData('json')}
            className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
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
          onChange={(e) => handleBucketChange(e.target.value)}
          className="w-full p-2 border border-custom rounded-md bg-panel text-primary"
          disabled={loadingStates.buckets}
        >
          <option value="">Seleccionar bucket...</option>
          {buckets.map(bucket => (
            <option key={bucket} value={bucket}>{bucket}</option>
          ))}
        </select>

        {!selectedBucket && (
          <p className="text-sm text-secondary mt-2">
            Selecciona un bucket para comenzar a filtrar los datos
          </p>
        )}
      </div>

      {/* Filters Section */}
      {selectedBucket && (
        <div className="bg-panel rounded-lg p-4">
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2 text-primary">
            <Filter size={16} />
            Filtros
          </h3>

          <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
            {/* Filtro Primario */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-primary">Filtro Primario</label>
                <span className="px-2 py-1 bg-header-table text-primary rounded text-xs">
                  {primaryFilter.values.length}
                </span>
              </div>

              <select
                value={primaryFilter.type}
                onChange={(e) => handlePrimaryFilterTypeChange(e.target.value)}
                className="w-full p-2 border border-custom rounded text-sm bg-panel text-primary mb-2"
                disabled={loadingStates.primaryFilters}
              >
                <option value="">Seleccionar tipo de filtro...</option>
                {loadingStates.primaryFilters ? (
                  <option disabled>Cargando filtros...</option>
                ) : (
                  availablePrimaryFilters.map(filter => (
                    <option key={filter} value={filter}>{filter}</option>
                  ))
                )}
              </select>

              <div className="max-h-40 overflow-y-auto border border-custom rounded p-2 space-y-1 bg-panel">
                {!primaryFilter.type ? (
                  <div className="text-center py-2 text-secondary text-sm">
                    Selecciona un tipo de filtro arriba
                  </div>
                ) : primaryFilter.type === '_measurement' ? (
                  loadingStates.measurements ? (
                    <div className="text-center py-2 text-secondary text-sm">
                      <RefreshCw className="w-4 h-4 animate-spin mx-auto mb-1" />
                      Cargando measurements...
                    </div>
                  ) : measurements.length === 0 ? (
                    <div className="text-center py-2 text-secondary text-sm">
                      No hay measurements disponibles en este bucket
                    </div>
                  ) : (
                    measurements.map(measurement => (
                      <label key={measurement} className="flex items-center space-x-2 text-sm cursor-pointer hover-bg rounded p-1">
                        <input
                          type="checkbox"
                          checked={primaryFilter.values.includes(measurement)}
                          onChange={() => handlePrimaryFilterValueChange(measurement)}
                          className="rounded"
                        />
                        <span className="truncate text-primary">{measurement}</span>
                      </label>
                    ))
                  )
                ) : primaryFilter.type && primaryFieldValues.length === 0 && loadingStates.primaryValues ? (
                  <div className="text-center py-2 text-secondary text-sm">
                    <RefreshCw className="w-4 h-4 animate-spin mx-auto mb-1" />
                    Cargando valores...
                  </div>
                ) : primaryFieldValues.length === 0 ? (
                  <div className="text-center py-2 text-secondary text-sm">
                    {primaryFilter.type === '_time' || primaryFilter.type === '_value' ?
                      'Filtro de valores continuos - usar rango de tiempo' :
                      'No hay valores disponibles para este filtro'
                    }
                  </div>
                ) : (
                  primaryFieldValues.map(value => (
                    <label key={value} className="flex items-center space-x-2 text-sm cursor-pointer hover-bg rounded p-1">
                      <input
                        type="checkbox"
                        checked={primaryFilter.values.includes(value)}
                        onChange={() => handlePrimaryFilterValueChange(value)}
                        className="rounded"
                      />
                      <span className="truncate text-primary">{value}</span>
                    </label>
                  ))
                )}
              </div>
            </div>

            {/* Filtro Secundario */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-primary">Filtro Secundario</label>
                <span className="px-2 py-1 bg-header-table text-primary rounded text-xs">
                  {secondaryFilter.values.length}
                </span>
              </div>

              <select
                value={secondaryFilter.type}
                onChange={(e) => handleSecondaryFilterTypeChange(e.target.value)}
                className="w-full p-2 border border-custom rounded text-sm bg-panel text-primary"
                disabled={availableFieldTypes.length === 0}
              >
                <option value="">Seleccionar tipo</option>
                {availableFieldTypes
                  .filter(fieldType => fieldType !== primaryFilter.type)
                  .map(fieldType => (
                    <option key={fieldType} value={fieldType}>{fieldType}</option>
                  ))
                }
              </select>

              <div className="max-h-32 overflow-y-auto border border-custom rounded p-2 space-y-1 bg-panel">
                {!secondaryFilter.type ? (
                  <div className="text-center py-2 text-secondary text-sm">
                    Selecciona un tipo de filtro secundario
                  </div>
                ) : secondaryFilter.type && secondaryFieldValues.length === 0 && loadingStates.secondaryValues ? (
                  <div className="text-center py-2 text-secondary text-sm">
                    <RefreshCw className="w-4 h-4 animate-spin mx-auto mb-1" />
                    Cargando valores...
                  </div>
                ) : secondaryFieldValues.length === 0 ? (
                  <div className="text-center py-2 text-secondary text-sm">
                    {secondaryFilter.type === '_time' || secondaryFilter.type === '_value' ?
                      'Filtro de valores continuos - usar rango de tiempo' :
                      'No hay valores disponibles'
                    }
                  </div>
                ) : (
                  secondaryFieldValues.map(value => (
                    <label key={value} className="flex items-center space-x-2 text-sm cursor-pointer hover-bg rounded p-1">
                      <input
                        type="checkbox"
                        checked={secondaryFilter.values.includes(value)}
                        onChange={() => handleSecondaryFilterValueChange(value)}
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
                <span className="px-2 py-1 bg-header-table text-primary rounded text-xs">
                  {selectedTagKeys.length}
                </span>
              </div>

              <div className="max-h-40 overflow-y-auto border border-custom rounded p-2 space-y-1 bg-panel">
                {availableTagKeys.length === 0 ? (
                  <div className="text-center py-2 text-secondary text-sm">
                    {selectedMeasurements.length === 0 ? 
                      'Selecciona measurements primero' : 
                      'No hay tag keys disponibles'
                    }
                  </div>
                ) : (
                  availableTagKeys
                    .filter(tagKey => tagKey !== primaryFilter.type && tagKey !== secondaryFilter.type)
                    .map(tagKey => (
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
                <span className="px-2 py-1 bg-header-table text-primary rounded text-xs">
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
      )}

      {/* Time Range */}
      {selectedBucket && (
        <div className="bg-panel rounded-lg p-4">
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2 text-primary">
            <Calendar size={16} />
            Rango de Tiempo
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <div className="flex gap-2 mb-2">
                <button
                  onClick={() => setTimeRange({ ...timeRange, type: 'custom' })}
                  className={`px-3 py-1 text-sm rounded ${timeRange.type === 'custom' ? 'bg-blue-500 text-white' : 'bg-header-table text-primary border border-custom'}`}
                >
                  CUSTOM
                </button>
                <button
                  onClick={() => setTimeRange({ ...timeRange, type: 'auto' })}
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
                    setTimeRange({ ...timeRange, from, to });
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
                    onChange={(e) => setTimeRange({ ...timeRange, customFrom: e.target.value })}
                    className="w-full p-2 border border-custom rounded text-sm bg-panel text-primary"
                  />
                  <input
                    type="datetime-local"
                    value={timeRange.customTo}
                    onChange={(e) => setTimeRange({ ...timeRange, customTo: e.target.value })}
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
                {aggregationFunctions.map(func => (
                  <option key={func} value={func}>
                    {func === 'none' ? 'Sin agregación' : func}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Execute Query */}
      {selectedBucket && (
        <div className="flex justify-center">
          <button
            onClick={executeQuery}
            disabled={isLoading}
            className="flex items-center gap-2 px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            {isLoading ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <FileText size={16} />
            )}
            {isLoading ? 'Ejecutando...' : 'Ejecutar consulta'}
          </button>
        </div>
      )}

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
                <div className="text-2xl font-bold text-orange-500">
                  {primaryFilter.values.length + secondaryFilter.values.length + Object.values(selectedTagValues).flat().length}
                </div>
                <div className="text-xs text-secondary">Filtros</div>
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

      {/* Mensaje de ayuda cuando no hay bucket seleccionado */}
      {!selectedBucket && (
        <div className="bg-panel rounded-lg p-8 text-center">
          <Database size={48} className="mx-auto text-secondary mb-4" />
          <h3 className="text-lg font-semibold text-primary mb-2">Selecciona un bucket para comenzar</h3>
          <p className="text-secondary">
            Elige un bucket de la lista desplegable de arriba para ver los measurements disponibles
            y comenzar a construir tu consulta.
          </p>
        </div>
      )}
    </div>
  );
};

export default GestionDocumentosPage;