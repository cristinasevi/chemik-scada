'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Search, Download, Filter, Calendar, Database, FileText, RefreshCw, Play, Copy, Eye, ChevronDown, ChevronRight, X, Plus } from 'lucide-react';

const GestionDocumentosPage = () => {
  const [buckets, setBuckets] = useState([]);
  const [selectedBucket, setSelectedBucket] = useState('');
  const [measurements, setMeasurements] = useState([]);
  const [fields, setFields] = useState([]);
  const [availableTagKeys, setAvailableTagKeys] = useState([]);
  const [filters, setFilters] = useState([]);
  const [aggregationFunctions, setAggregationFunctions] = useState([]);

  // Cache para evitar llamadas repetidas
  const [bucketCache, setBucketCache] = useState(new Map());

  const [loadingStates, setLoadingStates] = useState({
    buckets: false,
    bucketData: false, // Cambio: un solo estado para toda la carga del bucket
    executing: false
  });

  const [timeRange, setTimeRange] = useState({
    start: '-1h',
    stop: 'now'
  });

  const [windowPeriod, setWindowPeriod] = useState('auto');
  const [aggregateFunction, setAggregateFunction] = useState('mean');
  const [queryResult, setQueryResult] = useState(null);
  const [rawQuery, setRawQuery] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [customQuery, setCustomQuery] = useState('');
  const [useCustomQuery, setUseCustomQuery] = useState(false);

  // Time range presets
  const timeRangePresets = [
    { label: 'Past 5m', value: '-5m' },
    { label: 'Past 15m', value: '-15m' },
    { label: 'Past 1h', value: '-1h' },
    { label: 'Past 6h', value: '-6h' },
    { label: 'Past 24h', value: '-24h' },
    { label: 'Past 7d', value: '-7d' },
    { label: 'Past 30d', value: '-30d' }
  ];

  // Window period options
  const windowPeriods = [
    { label: 'auto', value: 'auto' },
    { label: '1s', value: '1s' },
    { label: '10s', value: '10s' },
    { label: '1m', value: '1m' },
    { label: '5m', value: '5m' },
    { label: '15m', value: '15m' },
    { label: '1h', value: '1h' },
    { label: '1d', value: '1d' }
  ];

  // Load initial data
  useEffect(() => {
    loadBuckets();
    loadAggregationFunctions();
  }, []);

  // Cargar datos del bucket solo cuando cambie y no esté en cache
  useEffect(() => {
    if (selectedBucket) {
      loadBucketData();
      resetSelections();
    }
  }, [selectedBucket]);

  // Update raw query when selections change
  useEffect(() => {
    if (!useCustomQuery) {
      buildFluxQuery();
    }
  }, [selectedBucket, filters, timeRange, windowPeriod, aggregateFunction, useCustomQuery]);

  const resetSelections = () => {
    setFilters([]);
    setQueryResult(null);
  };

  const loadBuckets = async () => {
    setLoadingStates(prev => ({ ...prev, buckets: true }));
    try {
      const response = await fetch('/api/influxdb/buckets');
      const data = await response.json();
      setBuckets(data.buckets || []);
    } catch (error) {
      console.error('Error loading buckets:', error);
      setBuckets([]);
    }
    setLoadingStates(prev => ({ ...prev, buckets: false }));
  };

  const loadAggregationFunctions = async () => {
    try {
      const response = await fetch('/api/influxdb/aggregation-functions');
      const data = await response.json();
      setAggregationFunctions(data.functions || []);
    } catch (error) {
      console.error('Error loading aggregation functions:', error);
      setAggregationFunctions(['none']);
    }
  };

  const loadBucketData = async () => {
    // Verificar cache primero - cache separado por bucket
    if (bucketCache.has(selectedBucket)) {
      const cachedData = bucketCache.get(selectedBucket);
      setMeasurements(cachedData.measurements);
      setFields(cachedData.fields);
      setAvailableTagKeys(cachedData.availableTagKeys);
      return;
    }

    setLoadingStates(prev => ({ ...prev, bucketData: true }));

    try {
      // Usar la API rápida para obtener filtros específicos de este bucket
      const fastResponse = await fetch('/api/influxdb/fast-filters', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bucket: selectedBucket })
      });

      const fastData = await fastResponse.json();

      if (fastData.success && fastData.filters) {
        const { filters } = fastData;

        // Procesar datos específicos de este bucket
        const bucketSpecificData = {
          measurements: filters.measurements || [],
          fields: filters.fieldNames || [],
          availableTagKeys: [
            ...filters.systemFields,
            ...filters.tagFields
          ] || []
        };

        // Cache específico por bucket
        setBucketCache(prev => new Map(prev).set(selectedBucket, bucketSpecificData));

        // Actualizar estado con datos específicos del bucket
        setMeasurements(bucketSpecificData.measurements);
        setFields(bucketSpecificData.fields);
        setAvailableTagKeys(bucketSpecificData.availableTagKeys);

      } else {
        throw new Error(fastData.error || 'No se pudieron cargar filtros del bucket');
      }

    } catch (error) {
      // Si falla, limpiar todo - específico del bucket
      setMeasurements([]);
      setFields([]);
      setAvailableTagKeys([]);
    }

    setLoadingStates(prev => ({ ...prev, bucketData: false }));
  };

  const addFilter = useCallback(() => {
    const newFilter = {
      id: Date.now(),
      key: '',
      selectedValues: [],
      availableValues: [],
      loading: false,
      timeStart: '',
      timeEnd: '',
      valueMin: '',
      valueMax: ''
    };
    setFilters(prev => [...prev, newFilter]);
  }, []);

  const removeFilter = useCallback((filterId) => {
    setFilters(prev => prev.filter(filter => filter.id !== filterId));
  }, []);

  const updateFilterKey = useCallback(async (filterId, key) => {
    setFilters(prevFilters =>
      prevFilters.map(filter =>
        filter.id === filterId
          ? {
            ...filter,
            key,
            selectedValues: [],
            availableValues: [],
            loading: !['_time', '_value'].includes(key), // Solo loading si necesita cargar valores
            timeStart: '',
            timeEnd: '',
            valueMin: '',
            valueMax: ''
          }
          : filter
      )
    );

    if (key && !['_time', '_value'].includes(key)) {
      try {
        let availableValues = [];

        // Usar datos ya cargados si están disponibles
        if (key === '_measurement') {
          availableValues = measurements;
        } else if (key === '_field') {
          availableValues = fields;
        } else {
          const response = await fetch('/api/influxdb/universal-values', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              bucket: selectedBucket,
              fieldName: key,
              timeRange: '-24h',
              maxValues: 500
            })
          });

          const data = await response.json();

          if (data.success) {
            availableValues = data.values || [];
          } else {
            availableValues = [];

            // Fallback: intentar con la API de tag-values si falla la universal
            try {
              const fallbackResponse = await fetch('/api/influxdb/tag-values', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  bucket: selectedBucket,
                  tagKey: key
                })
              });

              const fallbackData = await fallbackResponse.json();
              if (fallbackData.success) {
                availableValues = fallbackData.values || [];
              }
            } catch (fallbackError) {
            }
          }
        }

        setFilters(prevFilters =>
          prevFilters.map(filter =>
            filter.id === filterId
              ? { ...filter, availableValues, loading: false }
              : filter
          )
        );
      } catch (error) {
        setFilters(prevFilters =>
          prevFilters.map(filter =>
            filter.id === filterId
              ? { ...filter, availableValues: [], loading: false }
              : filter
          )
        );
      }
    }
  }, [selectedBucket, measurements, fields]);

  const updateFilterValues = useCallback((filterId, values) => {
    setFilters(prevFilters =>
      prevFilters.map(filter =>
        filter.id === filterId
          ? { ...filter, selectedValues: values }
          : filter
      )
    );
  }, []);

  const updateFilterTime = useCallback((filterId, type, value) => {
    setFilters(prevFilters =>
      prevFilters.map(filter =>
        filter.id === filterId
          ? { ...filter, [type === 'start' ? 'timeStart' : 'timeEnd']: value }
          : filter
      )
    );
  }, []);

  const updateFilterValue = useCallback((filterId, type, value) => {
    setFilters(prevFilters =>
      prevFilters.map(filter =>
        filter.id === filterId
          ? { ...filter, [type === 'min' ? 'valueMin' : 'valueMax']: value }
          : filter
      )
    );
  }, []);

  const buildFluxQuery = useCallback(() => {
    if (!selectedBucket) {
      setRawQuery('// Select a bucket to start building your query');
      return;
    }

    let query = `from(bucket: "${selectedBucket}")\n`;
    query += `  |> range(start: ${timeRange.start}, stop: ${timeRange.stop})\n`;

    // Add filters
    filters.forEach(filter => {
      if (!filter.key) return;

      const key = filter.key;

      if (key === '_time') {
        if (filter.timeStart || filter.timeEnd) {
          const start = filter.timeStart ? new Date(filter.timeStart).toISOString() : timeRange.start;
          const stop = filter.timeEnd ? new Date(filter.timeEnd).toISOString() : timeRange.stop;
          query += `  |> range(start: ${start}, stop: ${stop})\n`;
        }
      } else if (key === '_value') {
        if (filter.valueMin !== '' || filter.valueMax !== '') {
          const conditions = [];
          if (filter.valueMin !== '') conditions.push(`r._value >= ${filter.valueMin}`);
          if (filter.valueMax !== '') conditions.push(`r._value <= ${filter.valueMax}`);
          if (conditions.length > 0) {
            query += `  |> filter(fn: (r) => ${conditions.join(' and ')})\n`;
          }
        }
      } else { // equals operator for all other fields
        if (filter.selectedValues.length > 0) {
          if (filter.selectedValues.length === 1) {
            query += `  |> filter(fn: (r) => r.${key} == "${filter.selectedValues[0]}")\n`;
          } else {
            const values = filter.selectedValues.map(v => `"${v}"`).join(', ');
            query += `  |> filter(fn: (r) => contains(value: r.${key}, set: [${values}]))\n`;
          }
        }
      }
    });

    // Add aggregation if specified
    if (windowPeriod !== 'auto' && aggregateFunction !== 'none') {
      query += `  |> aggregateWindow(every: ${windowPeriod}, fn: ${aggregateFunction}, createEmpty: false)\n`;
    }

    query += `  |> yield(name: "result")`;
    setRawQuery(query);
  }, [selectedBucket, filters, timeRange, windowPeriod, aggregateFunction]);

  const executeQuery = async () => {
    const queryToExecute = useCustomQuery ? customQuery : rawQuery;

    if (!queryToExecute || queryToExecute.includes('// Select a bucket')) {
      alert('Please build a valid query first');
      return;
    }

    setLoadingStates(prev => ({ ...prev, executing: true }));
    try {
      const response = await fetch('/api/influxdb/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: queryToExecute })
      });

      const data = await response.json();

      if (response.ok) {
        setQueryResult({
          query: queryToExecute,
          rows: data.rows,
          executionTime: data.executionTime || '0ms',
          data: data.data,
          success: true
        });
      } else {
        setQueryResult({
          query: queryToExecute,
          rows: 0,
          executionTime: '0ms',
          data: '',
          error: data.details || data.error || 'Unknown error',
          success: false
        });
      }
    } catch (error) {
      console.error('Error executing query:', error);
      setQueryResult({
        query: queryToExecute,
        rows: 0,
        executionTime: '0ms',
        data: '',
        error: error.message,
        success: false
      });
    }
    setLoadingStates(prev => ({ ...prev, executing: false }));
  };

  const exportData = (format) => {
    if (!queryResult || !queryResult.data) {
      alert('No data to export. Run a query first.');
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
      // Convert CSV to JSON for better structure
      const lines = queryResult.data.split('\n').filter(line => line.trim());
      if (lines.length > 1) {
        const headers = lines[0].split(',').map(h => h.replace(/"/g, '').trim());
        const jsonData = lines.slice(1).map(line => {
          const values = line.split(',').map(v => v.replace(/"/g, '').trim());
          const obj = {};
          headers.forEach((header, index) => {
            obj[header] = values[index] || '';
          });
          return obj;
        });

        const blob = new Blob([JSON.stringify(jsonData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `influxdb-export-${Date.now()}.json`;
        a.click();
        URL.revokeObjectURL(url);
      }
    }
  };

  const copyQuery = async () => {
    const queryToCopy = useCustomQuery ? customQuery : rawQuery;
    try {
      await navigator.clipboard.writeText(queryToCopy);
      // Mostrar feedback temporal
      const button = document.activeElement;
      const originalHTML = button.innerHTML;

      button.innerHTML = '<svg width="12" height="12" fill="currentColor" viewBox="0 0 20 20" style="display: inline;"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"></path></svg> <span style="font-size: 12px; display: inline;">Copied</span>';

      setTimeout(() => {
        button.innerHTML = originalHTML;
      }, 2000);
    } catch (err) {
      console.error('Error copying to clipboard:', err);
    }
  };

  // Memoizar opciones disponibles para filtros
  const filterOptions = useMemo(() => {
    // Filtrar campos que no queremos mostrar
    const excludedFields = new Set([
      '_start',
      '_stop',
      'table',
      '_result',
      '_table'
    ]);

    // TODOS los tags filtrados
    const filteredTagKeys = availableTagKeys.filter(tag => !excludedFields.has(tag));

    const allOptions = filteredTagKeys.map(tag => ({
      label: tag.startsWith('_') ? `${tag}` : tag,
      value: tag
    }));

    return {
      allOptions,
      totalAvailable: filteredTagKeys.length
    };
  }, [availableTagKeys, selectedBucket]);

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-semibold text-primary">Gestión de Documentos</h1>
        </div>

        <div className="flex gap-3">
          <button
            onClick={() => exportData('csv')}
            className="flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            disabled={!queryResult?.success}
          >
            <Download size={16} />
            CSV
          </button>
          <button
            onClick={() => exportData('json')}
            className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            disabled={!queryResult?.success}
          >
            <Download size={16} />
            JSON
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Query Builder */}
        <div className="lg:col-span-2 space-y-6">
          {/* Bucket Selection */}
          <div className="bg-panel rounded-lg p-4">
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2 text-primary">
              <Database size={16} />
              1. Select Bucket
              {loadingStates.bucketData && (
                <RefreshCw className="w-4 h-4 animate-spin text-blue-500" />
              )}
            </h3>
            <select
              value={selectedBucket}
              onChange={(e) => setSelectedBucket(e.target.value)}
              className="w-full p-3 border border-custom rounded-lg bg-panel text-primary"
              disabled={loadingStates.buckets || loadingStates.bucketData}
            >
              <option value="">Choose a bucket...</option>
              {buckets.map(bucket => (
                <option key={bucket} value={bucket}>{bucket}</option>
              ))}
            </select>
          </div>

          {/* Filters */}
          {selectedBucket && (
            <div className="bg-panel rounded-lg p-4">
              <h3 className="text-sm font-semibold mb-3 flex items-center gap-2 text-primary">
                <Filter size={16} />
                2. Filter Data
              </h3>

              <div className="space-y-4">
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-primary">Filters</label>
                  <button
                    onClick={addFilter}
                    className="flex items-center gap-1 px-3 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600 cursor-pointer"
                    disabled={loadingStates.bucketData}
                  >
                    <Plus size={12} />
                    Add Filter
                  </button>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                  {filters.map(filter => (
                    <div key={filter.id} className="border border-custom rounded-lg p-3">
                      <div className="flex items-center gap-2 mb-3">
                        {/* Filter Key Selection */}
                        <select
                          value={filter.key}
                          onChange={(e) => updateFilterKey(filter.id, e.target.value)}
                          className="flex-1 p-2 border border-custom rounded bg-panel text-primary text-sm"
                          disabled={loadingStates.bucketData}
                        >
                          <option value="">
                            {!selectedBucket
                              ? "Selecciona un bucket primero..."
                              : filterOptions.totalAvailable === 0
                                ? `Sin filtros disponibles en "${selectedBucket}"`
                                : `Seleccionar filtro...`
                            }
                          </option>

                          {/* Solo mostrar opciones si hay un bucket seleccionado y filtros disponibles */}
                          {selectedBucket && filterOptions.totalAvailable > 0 && (
                            filterOptions.allOptions.map(option => (
                              <option key={option.value} value={option.value}>{option.label}</option>
                            ))
                          )}
                        </select>

                        {/* Remove Filter Button */}
                        <button
                          onClick={() => removeFilter(filter.id)}
                          className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded cursor-pointer"
                          title="Remove filter"
                        >
                          <X size={16} />
                        </button>
                      </div>

                      {/* Filter Values */}
                      {filter.key && (
                        <div>
                          {filter.key === '_time' ? (
                            <div className="grid grid-cols-1 gap-2">
                              <input
                                type="datetime-local"
                                value={filter.timeStart || ''}
                                onChange={(e) => updateFilterTime(filter.id, 'start', e.target.value)}
                                className="w-full p-2 border border-custom rounded bg-panel text-primary text-sm"
                                placeholder="Start time"
                              />
                              <input
                                type="datetime-local"
                                value={filter.timeEnd || ''}
                                onChange={(e) => updateFilterTime(filter.id, 'end', e.target.value)}
                                className="w-full p-2 border border-custom rounded bg-panel text-primary text-sm"
                                placeholder="End time"
                              />
                            </div>
                          ) : filter.key === '_value' ? (
                            <div className="grid grid-cols-2 gap-2">
                              <input
                                type="number"
                                value={filter.valueMin || ''}
                                onChange={(e) => updateFilterValue(filter.id, 'min', e.target.value)}
                                className="w-full p-2 border border-custom rounded bg-panel text-primary text-sm"
                                placeholder="Min value"
                              />
                              <input
                                type="number"
                                value={filter.valueMax || ''}
                                onChange={(e) => updateFilterValue(filter.id, 'max', e.target.value)}
                                className="w-full p-2 border border-custom rounded bg-panel text-primary text-sm"
                                placeholder="Max value"
                              />
                            </div>
                          ) : (
                            <div className="max-h-40 overflow-y-auto space-y-1 border border-custom rounded p-2 bg-header-table">
                              {filter.loading ? (
                                <div className="text-center py-2 text-secondary text-sm">
                                  <RefreshCw className="w-4 h-4 animate-spin mx-auto mb-1" />
                                  Loading values...
                                </div>
                              ) : filter.availableValues.length === 0 ? (
                                <div className="text-center py-2 text-secondary text-sm">
                                  No values found
                                </div>
                              ) : (
                                filter.availableValues.map(value => (
                                  <label key={value} className="flex items-center space-x-2 text-sm cursor-pointer hover-bg rounded p-1">
                                    <input
                                      type="checkbox"
                                      checked={filter.selectedValues.includes(value)}
                                      onChange={(e) => {
                                        const newValues = e.target.checked
                                          ? [...filter.selectedValues, value]
                                          : filter.selectedValues.filter(v => v !== value);
                                        updateFilterValues(filter.id, newValues);
                                      }}
                                      className="rounded"
                                    />
                                    <span className="truncate text-primary">{value}</span>
                                  </label>
                                ))
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {filters.length === 0 && (
                  <div className="text-center py-8 text-secondary text-sm border border-custom rounded-lg bg-header-table">
                    <Filter size={24} className="mx-auto mb-2 opacity-50" />
                    <div>No filters added</div>
                    <div className="text-xs mt-1">Click "Add Filter" to start filtering your data</div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Query Panel - Resto del código igual */}
        <div className="space-y-6">
          {/* Time Range */}
          {selectedBucket && (
            <div className="bg-panel rounded-lg p-4">
              <h3 className="text-sm font-semibold mb-3 flex items-center gap-2 text-primary">
                <Calendar size={16} />
                Time Range
              </h3>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium mb-2 text-primary">Start</label>
                  <select
                    value={timeRange.start}
                    onChange={(e) => setTimeRange({ ...timeRange, start: e.target.value })}
                    className="w-full p-2 border border-custom rounded-lg bg-panel text-primary text-sm"
                  >
                    {timeRangePresets.map(preset => (
                      <option key={preset.value} value={preset.value}>{preset.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2 text-primary">Stop</label>
                  <input
                    type="text"
                    value={timeRange.stop}
                    onChange={(e) => setTimeRange({ ...timeRange, stop: e.target.value })}
                    className="w-full p-2 border border-custom rounded-lg bg-panel text-primary text-sm"
                    placeholder="now"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Aggregation - AÑADIR ESTO */}
          {selectedBucket && (
            <div className="bg-panel rounded-lg p-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium mb-2 text-primary">Window Period</label>
                  <select
                    value={windowPeriod}
                    onChange={(e) => setWindowPeriod(e.target.value)}
                    className="w-full p-2 border border-custom rounded-lg bg-panel text-primary text-sm"
                  >
                    {windowPeriods.map(period => (
                      <option key={period.value} value={period.value}>{period.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2 text-primary">Aggregate</label>
                  <select
                    value={aggregateFunction}
                    onChange={(e) => setAggregateFunction(e.target.value)}
                    className="w-full p-2 border border-custom rounded-lg bg-panel text-primary text-sm"
                  >
                    {aggregationFunctions.map(func => (
                      <option key={func} value={func}>{func}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* Query Display */}
          <div className="bg-panel rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-primary">Query</h3>
              <div className="flex gap-2">
                <button
                  onClick={() => setUseCustomQuery(!useCustomQuery)}
                  className={`px-3 py-1 text-xs rounded cursor-pointer ${useCustomQuery
                    ? 'bg-blue-500 text-white'
                    : 'bg-header-table text-primary border border-custom'
                    }`}
                >
                  Custom
                </button>
                <button
                  onClick={copyQuery}
                  className="p-1 text-secondary hover:text-primary cursor-pointer"
                  title="Copy query"
                >
                  <Copy size={16} />
                </button>
              </div>
            </div>

            {useCustomQuery ? (
              <textarea
                value={customQuery}
                onChange={(e) => setCustomQuery(e.target.value)}
                className="w-full h-48 p-3 border border-custom rounded-lg bg-header-table text-primary font-mono text-sm resize-none"
                placeholder="Enter your custom Flux query here..."
              />
            ) : (
              <div className="bg-header-table border border-custom rounded-lg p-3 h-48 overflow-auto">
                <pre className="text-primary font-mono text-sm whitespace-pre-wrap">{rawQuery}</pre>
              </div>
            )}
          </div>

          {/* Execute Button */}
          <button
            onClick={executeQuery}
            disabled={loadingStates.executing || (!useCustomQuery && !selectedBucket)}
            className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            {loadingStates.executing ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <Play size={16} />
            )}
            {loadingStates.executing ? 'Running Query...' : 'Run Query'}
          </button>

          {/* Results Summary */}
          {queryResult && (
            <div className="bg-panel rounded-lg p-4">
              <h3 className="text-sm font-semibold mb-3 text-primary">Results</h3>

              {queryResult.success ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-4 text-center">
                    <div>
                      <div className="text-lg font-bold text-blue-500">{queryResult.rows}</div>
                      <div className="text-xs text-secondary">Rows</div>
                    </div>
                    <div>
                      <div className="text-lg font-bold text-green-500">{queryResult.executionTime}</div>
                      <div className="text-xs text-secondary">Time</div>
                    </div>
                  </div>

                  {queryResult.data && (
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-primary">Preview</span>
                        <button
                          onClick={() => setShowAdvanced(!showAdvanced)}
                          className="flex items-center gap-1 text-xs text-secondary hover:text-primary cursor-pointer"
                        >
                          {showAdvanced ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                          {showAdvanced ? 'Hide' : 'Show'} Data
                        </button>
                      </div>

                      {showAdvanced && (
                        <div className="bg-header-table border border-custom rounded-lg p-3 max-h-40 overflow-auto">
                          <pre className="text-primary font-mono text-xs whitespace-pre-wrap">
                            {queryResult.data.split('\n').slice(0, 10).join('\n')}
                            {queryResult.data.split('\n').length > 10 && '\n... (more data available)'}
                          </pre>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <div className="badge-red border border-red rounded-lg p-3">
                  <div className="text-red-error-primary font-medium text-sm mb-1">Query Error</div>
                  <div className="text-red-error-secondary text-xs">{queryResult.error}</div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Full Results View */}
      {queryResult?.success && queryResult.data && (
        <div className="bg-panel rounded-lg p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-primary">Query Results</h3>
            <div className="flex items-center gap-4 text-sm text-secondary">
              <span>{queryResult.rows} rows</span>
              <span>{queryResult.executionTime}</span>
              <span>{selectedBucket}</span>
            </div>
          </div>

          {/* Results Table */}
          <div className="border border-custom rounded-lg overflow-hidden">
            <div className="max-h-96 overflow-auto">
              <table className="w-full">
                <thead className="bg-header-table border-b border-custom sticky top-0">
                  <tr>
                    {queryResult.data.split('\n')[0]?.split(',').map((header, index) => (
                      <th key={index} className="text-left p-3 font-semibold text-primary text-sm border-r border-custom last:border-r-0">
                        {header.replace(/"/g, '').trim()}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {queryResult.data.split('\n').slice(1, 101).map((row, rowIndex) => {
                    if (!row.trim()) return null;
                    return (
                      <tr key={rowIndex} className="border-b border-custom hover-bg">
                        {row.split(',').map((cell, cellIndex) => (
                          <td key={cellIndex} className="p-3 text-sm text-primary border-r border-custom last:border-r-0">
                            <div className="max-w-xs truncate" title={cell.replace(/"/g, '').trim()}>
                              {cell.replace(/"/g, '').trim()}
                            </div>
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {queryResult.data.split('\n').length > 101 && (
              <div className="bg-header-table border-t border-custom p-3 text-center text-sm text-secondary">
                Showing first 100 rows of {queryResult.rows} total rows. Export to see all data.
              </div>
            )}
          </div>

          {/* Query Details */}
          <div className="mt-4 bg-header-table border border-custom rounded-lg p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-primary">Executed Query</span>
              <button
                onClick={copyQuery}
                className="flex items-center gap-1 text-xs text-secondary hover:text-primary cursor-pointer"
              >
                <Copy size={12} />
                Copy
              </button>
            </div>
            <pre className="text-primary font-mono text-xs whitespace-pre-wrap overflow-x-auto">
              {queryResult.query}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
};

export default GestionDocumentosPage;