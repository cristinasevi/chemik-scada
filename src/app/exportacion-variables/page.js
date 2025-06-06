'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Search, Download, Filter, Calendar, Database, FileText, RefreshCw, Play, Copy, Eye, ChevronDown, ChevronRight, X, Plus, ArrowLeft, ArrowRight } from 'lucide-react';

const ExportacionVariablesPage = () => {
  const [selectedBucket, setSelectedBucket] = useState('PV');
  const [measurements, setMeasurements] = useState([]);
  const [fields, setFields] = useState([]);
  const [availableTagKeys, setAvailableTagKeys] = useState([]);
  const [filters, setFilters] = useState([{
    id: Date.now(),
    key: '',
    selectedValues: [],
    availableValues: [],
    loading: false,
    timeStart: '',
    timeEnd: '',
    valueMin: '',
    valueMax: ''
  }]);
  const [aggregationFunctions, setAggregationFunctions] = useState([]);
  const [reloadQueue, setReloadQueue] = useState(new Set());
  const [hasChanges, setHasChanges] = useState(false);

  // Cache para evitar llamadas repetidas
  const [bucketCache, setBucketCache] = useState(new Map());

  const [loadingStates, setLoadingStates] = useState({
    bucketData: false,
    executing: false
  });

  const [timeRange, setTimeRange] = useState({
    start: '',
    stop: 'now()',
    selectedDates: [],
    startDate: '',
    endDate: '',
    startTime: '',
    endTime: ''
  });

  const [windowPeriod, setWindowPeriod] = useState('auto');
  const [aggregateFunction, setAggregateFunction] = useState('mean');
  const [queryResult, setQueryResult] = useState(null);
  const [rawQuery, setRawQuery] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [customQuery, setCustomQuery] = useState('');
  const [useCustomQuery, setUseCustomQuery] = useState(false);
  const [windowPeriods, setWindowPeriods] = useState([]);
  const [showCalendar, setShowCalendar] = useState(false);

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  };

  // Load initial data
  useEffect(() => {
    loadAggregationFunctions();
    loadWindowPeriods();
    // Cargar PV automáticamente sin timeRanges
    setTimeout(() => {
      loadBucketData();
    }, 100);
  }, []);

  // Update raw query when selections change
  useEffect(() => {
    if (!useCustomQuery) {
      buildFluxQuery();
      // Marcar que hay cambios pendientes si ya había un resultado previo
      if (queryResult) {
        setHasChanges(true);
      }
    }
  }, [selectedBucket, filters, timeRange, windowPeriod, aggregateFunction, useCustomQuery]);

  const resetSelections = () => {
    setFilters([]);
    setQueryResult(null);
  };

  const handleDateSelection = (date) => {
    const { selectedDates } = timeRange;

    if (selectedDates.length === 0) {
      // Primera fecha seleccionada
      const startTime = timeRange.startTime || '00:00';
      const endTime = timeRange.endTime || '23:59';
      const startIso = `${date}T${startTime}:00Z`;
      const endIso = `${date}T${endTime}:59Z`;

      setTimeRange({
        ...timeRange,
        selectedDates: [date],
        startDate: date,
        endDate: date,
        start: `time(v: "${startIso}")`,
        stop: `time(v: "${endIso}")`,
        startTime: startTime,
        endTime: endTime
      });
    } else if (selectedDates.length === 1) {
      const firstDate = selectedDates[0];
      const [startDate, endDate] = date < firstDate ? [date, firstDate] : [firstDate, date];

      const startTime = timeRange.startTime || '00:00';
      const endTime = timeRange.endTime || '23:59';
      const startIso = `${startDate}T${startTime}:00Z`;
      const endIso = `${endDate}T${endTime}:59Z`;

      setTimeRange({
        ...timeRange,
        selectedDates: [startDate, endDate],
        startDate,
        endDate,
        start: `time(v: "${startIso}")`,
        stop: `time(v: "${endIso}")`,
        startTime: startTime,
        endTime: endTime
      });
    } else {
      // Reset y seleccionar nueva fecha
      const startTime = '00:00';
      const endTime = '23:59';
      const startIso = `${date}T${startTime}:00Z`;
      const endIso = `${date}T${endTime}:59Z`;

      setTimeRange({
        ...timeRange,
        selectedDates: [date],
        startDate: date,
        endDate: date,
        start: `time(v: "${startIso}")`,
        stop: `time(v: "${endIso}")`,
        startTime: startTime,
        endTime: endTime
      });
    }
  };

  // Función para construir filtros aplicados para consultas dependientes
  const buildAppliedFilters = useCallback((excludeFilterId = null) => {
    const appliedFilters = [];

    filters.forEach(filter => {
      // Excluir el filtro actual y filtros vacíos
      if (filter.id === excludeFilterId || !filter.key || filter.selectedValues.length === 0) {
        return;
      }

      // Solo procesar filtros con valores seleccionados
      if (filter.key !== '_time' && filter.key !== '_value') {
        appliedFilters.push({
          key: filter.key,
          values: filter.selectedValues
        });
      }
    });

    return appliedFilters;
  }, [filters]);

  const loadAggregationFunctions = async () => {
    try {
      const aggregationFunctions = [
        'mean',
        'median',
        'max',
        'min',
        'sum',
        'derivative',
        'nonnegative derivative',
        'distinct',
        'count',
        'increase',
        'skew',
        'spread',
        'stddev',
        'first',
        'last',
        'unique',
        'sort',
      ];

      setAggregationFunctions(aggregationFunctions);
    } catch (error) {
      console.error('Error loading aggregation functions:', error);
      setAggregationFunctions(['mean', 'sum', 'count']);
    }
  };

  const loadWindowPeriods = async () => {
    try {
      const windowPeriods = [
        { label: '5s', value: '5s' },
        { label: '10s', value: '10s' },
        { label: '15s', value: '15s' },
        { label: '1m', value: '1m' },
        { label: '5m', value: '5m' },
        { label: '15m', value: '15m' },
        { label: '1h', value: '1h' },
        { label: '6h', value: '6h' },
        { label: '12h', value: '12h' },
        { label: '24h', value: '24h' },
        { label: '2d', value: '2d' },
        { label: '7d', value: '7d' },
        { label: '30d', value: '30d' }
      ];

      setWindowPeriods(windowPeriods);
    } catch (error) {
      console.error('Error loading window periods:', error);
      setWindowPeriods([{ label: '10s', value: '10s' }]);
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

  const reloadFilterValues = useCallback(async (filterId) => {
    const currentFilters = filters; // Usar snapshot actual
    const filter = currentFilters.find(f => f.id === filterId);

    if (!filter || !filter.key || ['_time', '_value'].includes(filter.key)) {
      return;
    }

    // Evitar recargas duplicadas
    if (filter.loading) {
      return;
    }

    // Marcar como cargando
    setFilters(prevFilters =>
      prevFilters.map(f =>
        f.id === filterId ? { ...f, loading: true } : f
      )
    );

    try {
      let availableValues = [];

      // OBTENER FILTROS ANTERIORES APLICADOS usando snapshot actual
      const currentFilterIndex = currentFilters.findIndex(f => f.id === filterId);
      const previousFilters = currentFilters.slice(0, currentFilterIndex)
        .filter(filter => filter.key && filter.selectedValues.length > 0 &&
          filter.key !== '_time' && filter.key !== '_value');

      if (previousFilters.length === 0) {
        if (filter.key === '_measurement') {
          availableValues = measurements;
        } else if (filter.key === '_field') {
          // APLICAR FILTRO POR TYPE AQUÍ TAMBIÉN
          availableValues = await getFilteredFieldsByType();
        } else {
          const response = await fetch('/api/influxdb/universal-values', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              bucket: selectedBucket,
              fieldName: filter.key,
              timeRange: '-24h',
              maxValues: 500
            })
          });

          const data = await response.json();
          if (data.success) {
            availableValues = data.values || [];
          }
        }
      } else {
        // Construir query optimizada
        let baseQuery = `from(bucket: "${selectedBucket}")
        |> range(start: -24h)`;

        previousFilters.forEach(prevFilter => {
          if (prevFilter.selectedValues.length === 1) {
            const fieldRef = prevFilter.key.startsWith('_') || /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(prevFilter.key)
              ? `r.${prevFilter.key}`
              : `r["${prevFilter.key}"]`;
            baseQuery += `\n  |> filter(fn: (r) => ${fieldRef} == "${prevFilter.selectedValues[0]}")`;
          } else if (prevFilter.selectedValues.length > 1) {
            const values = prevFilter.selectedValues.map(v => `"${v}"`).join(', ');
            const fieldRef = prevFilter.key.startsWith('_') || /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(prevFilter.key)
              ? `r.${prevFilter.key}`
              : `r["${prevFilter.key}"]`;
            baseQuery += `\n  |> filter(fn: (r) => contains(value: ${fieldRef}, set: [${values}]))`;
          }
        });

        // Si el filtro actual es '_field', agregar filtro por type
        if (filter.key === '_field') {
          baseQuery += `\n  |> filter(fn: (r) => r.type == "holding_register")`;
        }

        const distinctQuery = `${baseQuery}
          |> sample(n: 10000)
          |> keep(columns: ["${filter.key}"])
          |> distinct(column: "${filter.key}")
          |> limit(n: 200)
          |> sort(columns: ["${filter.key}"])
          |> yield(name: "distinct_values")`;

        const response = await fetch('/api/influxdb/query', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            query: distinctQuery,
            format: 'csv'
          })
        });

        const data = await response.json();

        if (data.data && typeof data.rows === 'number') {
          const lines = data.data.split('\n').filter(line => line.trim());
          if (lines.length > 1) {
            const headers = lines[0].split(',').map(h => h.replace(/"/g, '').trim());
            const keyIndex = headers.indexOf(filter.key);

            if (keyIndex !== -1) {
              const uniqueValues = new Set();
              lines.slice(1).forEach(line => {
                const cells = line.split(',').map(cell => cell.replace(/"/g, '').trim());
                if (cells[keyIndex] && cells[keyIndex] !== '') {
                  uniqueValues.add(cells[keyIndex]);
                }
              });
              availableValues = Array.from(uniqueValues).sort();
            }
          }
        } else {
          // Fallback optimizado
          if (filter.key === '_field') {
            availableValues = await getFilteredFieldsByType(previousFilters);
          } else {
            const fallbackResponse = await fetch('/api/influxdb/universal-values', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                bucket: selectedBucket,
                fieldName: filter.key,
                timeRange: '-24h',
                maxValues: 500,
                appliedFilters: previousFilters.map(pf => ({
                  key: pf.key,
                  values: pf.selectedValues
                }))
              })
            });

            const fallbackData = await fallbackResponse.json();
            if (fallbackData.success) {
              availableValues = fallbackData.values || [];
            }
          }
        }
      }

      // Actualizar solo si el filtro aún existe y no se ha modificado
      setFilters(prevFilters =>
        prevFilters.map(f =>
          f.id === filterId
            ? {
              ...f,
              availableValues,
              loading: false,
              selectedValues: f.selectedValues.filter(val => availableValues.includes(val))
            }
            : f
        )
      );

    } catch (error) {
      console.error('Error reloading filter values:', error);
      setFilters(prevFilters =>
        prevFilters.map(f =>
          f.id === filterId ? { ...f, availableValues: [], loading: false } : f
        )
      );
    }
  }, [selectedBucket, measurements, fields, filters]);

  const removeFilter = useCallback((filterId) => {
    setFilters(prev => {
      const filterToRemove = prev.find(f => f.id === filterId);
      const removedIndex = prev.findIndex(f => f.id === filterId);
      const newFilters = prev.filter(filter => filter.id !== filterId);

      // Solo recargar filtros posteriores si el filtro eliminado tenía valores que podrían afectar
      if (filterToRemove?.selectedValues?.length > 0 && !['_time', '_value'].includes(filterToRemove.key)) {
        setTimeout(() => {
          // Recargar solo los valores disponibles de filtros posteriores, manteniendo selecciones
          newFilters.slice(removedIndex).forEach((filter, index) => {
            if (filter.key && !['_time', '_value'].includes(filter.key)) {
              setTimeout(() => {
                reloadFilterValues(filter.id);
              }, index * 50);
            }
          });
        }, 100);
      }

      return newFilters;
    });
  }, [reloadFilterValues]);

  const updateFilterKey = useCallback(async (filterId, key) => {
    setFilters(prevFilters =>
      prevFilters.map(filter =>
        filter.id === filterId
          ? {
            ...filter,
            key,
            selectedValues: [],
            availableValues: [],
            loading: !['_time', '_value'].includes(key),
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

        // OBTENER FILTROS ANTERIORES APLICADOS
        const currentFilterIndex = filters.findIndex(f => f.id === filterId);
        const previousFilters = filters.slice(0, currentFilterIndex)
          .filter(filter => filter.key && filter.selectedValues.length > 0 &&
            filter.key !== '_time' && filter.key !== '_value');

        // Si no hay filtros anteriores, usar datos base
        if (previousFilters.length === 0) {
          if (key === '_measurement') {
            availableValues = measurements;
          } else if (key === '_field') {
            // AQUÍ ES DONDE FILTRAMOS POR TYPE
            availableValues = await getFilteredFieldsByType();
          } else {
            // Para otros campos sin filtros previos, usar la API universal
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
            }
          }
        } else {
          // Si hay filtros anteriores, construir query optimizada
          let baseQuery = `from(bucket: "${selectedBucket}")
          |> range(start: -24h)`;

          // Aplicar SOLO los filtros anteriores
          previousFilters.forEach(prevFilter => {
            if (prevFilter.selectedValues.length === 1) {
              const fieldRef = prevFilter.key.startsWith('_') || /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(prevFilter.key)
                ? `r.${prevFilter.key}`
                : `r["${prevFilter.key}"]`;
              baseQuery += `\n  |> filter(fn: (r) => ${fieldRef} == "${prevFilter.selectedValues[0]}")`;
            } else if (prevFilter.selectedValues.length > 1) {
              const values = prevFilter.selectedValues.map(v => `"${v}"`).join(', ');
              const fieldRef = prevFilter.key.startsWith('_') || /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(prevFilter.key)
                ? `r.${prevFilter.key}`
                : `r["${prevFilter.key}"]`;
              baseQuery += `\n  |> filter(fn: (r) => contains(value: ${fieldRef}, set: [${values}]))`;
            }
          });

          // Si el filtro actual es '_field', necesitamos filtrar por type también
          if (key === '_field') {
            // Agregar filtro para excluir type "calculado" y mostrar solo "holding_register"
            baseQuery += `\n  |> filter(fn: (r) => r.type == "holding_register")`;
          }

          // Obtener valores únicos del campo actual
          const fieldRef = key.startsWith('_') || /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(key)
            ? `r.${key}`
            : `r["${key}"]`;

          const distinctQuery = `${baseQuery}
          |> keep(columns: ["${key}"])
          |> distinct(column: "${key}")
          |> limit(n: 500)
          |> sort(columns: ["${key}"])
          |> yield(name: "distinct_values")`;

          // Ejecutar la query a través de tu API
          const response = await fetch('/api/influxdb/query', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              query: distinctQuery,
              format: 'csv'
            })
          });

          const data = await response.json();

          if (data.data && typeof data.rows === 'number') {
            // Parsear el CSV resultado
            const lines = data.data.split('\n').filter(line => line.trim());

            if (lines.length > 1) {
              const headers = lines[0].split(',').map(h => h.replace(/"/g, '').trim());
              const keyIndex = headers.indexOf(key);

              if (keyIndex !== -1) {
                const uniqueValues = new Set();
                lines.slice(1).forEach(line => {
                  const cells = line.split(',').map(cell => cell.replace(/"/g, '').trim());
                  if (cells[keyIndex] && cells[keyIndex] !== '') {
                    uniqueValues.add(cells[keyIndex]);
                  }
                });
                availableValues = Array.from(uniqueValues).sort();
              }
            }
          } else {
            console.error('Query failed or returned no data. Response:', data);

            // Fallback: usar API universal con filtros aplicados
            if (key === '_field') {
              // Para _field, usar función especial que filtra por type
              availableValues = await getFilteredFieldsByType(previousFilters);
            } else {
              const fallbackResponse = await fetch('/api/influxdb/universal-values', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  bucket: selectedBucket,
                  fieldName: key,
                  timeRange: '-24h',
                  maxValues: 500,
                  appliedFilters: previousFilters.map(pf => ({
                    key: pf.key,
                    values: pf.selectedValues
                  }))
                })
              });

              const fallbackData = await fallbackResponse.json();
              if (fallbackData.success) {
                availableValues = fallbackData.values || [];
              }
            }
          }
        }

        // Actualizar el filtro con los valores obtenidos
        setFilters(prevFilters =>
          prevFilters.map(filter =>
            filter.id === filterId
              ? { ...filter, availableValues, loading: false }
              : filter
          )
        );

      } catch (error) {
        console.error('Error loading dependent filter values:', error);
        setFilters(prevFilters =>
          prevFilters.map(filter =>
            filter.id === filterId
              ? { ...filter, availableValues: [], loading: false }
              : filter
          )
        );
      }
    }
  }, [selectedBucket, measurements, fields, filters]);

  const getFilteredFieldsByType = async (appliedFilters = []) => {
    try {
      // Construir query base
      let baseQuery = `from(bucket: "${selectedBucket}")
      |> range(start: -24h)`;

      // Aplicar filtros previos si existen
      appliedFilters.forEach(filter => {
        if (filter.selectedValues.length === 1) {
          const fieldRef = filter.key.startsWith('_') || /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(filter.key)
            ? `r.${filter.key}`
            : `r["${filter.key}"]`;
          baseQuery += `\n  |> filter(fn: (r) => ${fieldRef} == "${filter.selectedValues[0]}")`;
        } else if (filter.selectedValues.length > 1) {
          const values = filter.selectedValues.map(v => `"${v}"`).join(', ');
          const fieldRef = filter.key.startsWith('_') || /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(filter.key)
            ? `r.${filter.key}`
            : `r["${filter.key}"]`;
          baseQuery += `\n  |> filter(fn: (r) => contains(value: ${fieldRef}, set: [${values}]))`;
        }
      });

      // Agregar filtro para type = "holding_register"
      baseQuery += `\n  |> filter(fn: (r) => r.type == "holding_register")`;

      // Obtener valores únicos de _field
      const distinctQuery = `${baseQuery}
      |> keep(columns: ["_field"])
      |> distinct(column: "_field")
      |> limit(n: 500)
      |> sort(columns: ["_field"])
      |> yield(name: "distinct_values")`;

      const response = await fetch('/api/influxdb/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: distinctQuery,
          format: 'csv'
        })
      });

      const data = await response.json();

      if (data.data && typeof data.rows === 'number') {
        const lines = data.data.split('\n').filter(line => line.trim());

        if (lines.length > 1) {
          const headers = lines[0].split(',').map(h => h.replace(/"/g, '').trim());
          const fieldIndex = headers.indexOf('_field');

          if (fieldIndex !== -1) {
            const uniqueValues = new Set();
            lines.slice(1).forEach(line => {
              const cells = line.split(',').map(cell => cell.replace(/"/g, '').trim());
              if (cells[fieldIndex] && cells[fieldIndex] !== '') {
                uniqueValues.add(cells[fieldIndex]);
              }
            });
            return Array.from(uniqueValues).sort();
          }
        }
      }

      // Si la query falla, fallback a una llamada API específica
      const fallbackResponse = await fetch('/api/influxdb/filtered-fields', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bucket: selectedBucket,
          typeFilter: 'holding_register',
          appliedFilters: appliedFilters,
          timeRange: '-24h',
          maxValues: 500
        })
      });

      const fallbackData = await fallbackResponse.json();
      if (fallbackData.success) {
        return fallbackData.fields || [];
      }

      return [];
    } catch (error) {
      console.error('Error getting filtered fields by type:', error);
      return [];
    }
  };

  const updateFilterValues = useCallback((filterId, values) => {
    setFilters(prevFilters =>
      prevFilters.map(filter =>
        filter.id === filterId
          ? { ...filter, selectedValues: values }
          : filter
      )
    );

    // Usar la misma lógica de debounce para consistency
    const currentFilterIndex = filters.findIndex(f => f.id === filterId);
    const dependentFilterIds = filters
      .slice(currentFilterIndex + 1)
      .filter(f => f.key && !['_time', '_value'].includes(f.key))
      .map(f => f.id);

    setReloadQueue(prev => {
      const newQueue = new Set([...prev, ...dependentFilterIds]);
      return newQueue;
    });
  }, [filters]);

  const handleFilterValueChange = useCallback((filterId, value, isChecked) => {
    // Actualizar inmediatamente el estado visual
    setFilters(prevFilters =>
      prevFilters.map(filter => {
        if (filter.id === filterId) {
          const newValues = isChecked
            ? [...filter.selectedValues, value]
            : filter.selectedValues.filter(v => v !== value);

          return { ...filter, selectedValues: newValues };
        }
        return filter;
      })
    );

    // Usar debounce para las recargas de filtros dependientes
    const currentFilterIndex = filters.findIndex(f => f.id === filterId);
    const dependentFilterIds = filters
      .slice(currentFilterIndex + 1)
      .filter(f => f.key && !['_time', '_value'].includes(f.key))
      .map(f => f.id);

    // Añadir filtros dependientes a la cola de recarga
    setReloadQueue(prev => {
      const newQueue = new Set([...prev, ...dependentFilterIds]);
      return newQueue;
    });
  }, [filters]);

  useEffect(() => {
    if (reloadQueue.size === 0) return;

    const timeoutId = setTimeout(() => {
      // Procesar todos los filtros en la cola
      const filtersToReload = Array.from(reloadQueue);

      filtersToReload.forEach((filterId, index) => {
        setTimeout(() => {
          reloadFilterValues(filterId);
        }, index * 100); // Pequeño delay entre filtros para evitar sobrecarga
      });

      // Limpiar la cola
      setReloadQueue(new Set());
    }, 150); // Debounce de 150ms

    return () => clearTimeout(timeoutId);
  }, [reloadQueue, reloadFilterValues]);

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

    const startTime = timeRange.start || '-1h';
    const stopTime = timeRange.stop || 'now()';

    const formattedStop = stopTime === 'now' ? 'now()' : stopTime;

    query += `  |> range(start: ${startTime}, stop: ${formattedStop})\n`;

    // Solo incluir variables de type "holding_register"
    query += `  |> filter(fn: (r) => r.type == "holding_register")\n`;

    // Add filters
    filters.forEach(filter => {
      if (!filter.key) return;

      const key = filter.key;

      if (key === '_time') {
        if (filter.timeStart || filter.timeEnd) {
          const start = filter.timeStart ? `time(v: "${new Date(filter.timeStart).toISOString()}")` : startTime;
          const stop = filter.timeEnd ? `time(v: "${new Date(filter.timeEnd).toISOString()}")` : formattedStop;

          // Solo agregar filtro de tiempo adicional si es diferente del rango principal
          if (filter.timeStart || filter.timeEnd) {
            query += `  |> filter(fn: (r) => r._time >= ${start}`;
            if (filter.timeEnd) {
              query += ` and r._time <= ${stop}`;
            }
            query += `)\n`;
          }
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
      } else {
        if (filter.selectedValues.length > 0) {
          if (filter.selectedValues.length === 1) {
            const fieldRef = key.startsWith('_') || /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(key)
              ? `r.${key}`
              : `r["${key}"]`;
            query += `  |> filter(fn: (r) => ${fieldRef} == "${filter.selectedValues[0]}")\n`;
          } else {
            const values = filter.selectedValues.map(v => `"${v}"`).join(', ');
            const fieldRef = key.startsWith('_') || /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(key)
              ? `r.${key}`
              : `r["${key}"]`;
            query += `  |> filter(fn: (r) => contains(value: ${fieldRef}, set: [${values}]))\n`;
          }
        }
      }
    });

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
    setQueryResult(null);

    try {
      const response = await fetch('/api/influxdb/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: queryToExecute,
          timestamp: Date.now()
        })
      });

      const data = await response.json();

      if (response.ok) {
        setQueryResult({
          query: queryToExecute,
          rows: data.rows,
          executionTime: data.executionTime || '0ms',
          data: data.data,
          success: true,
          queryId: Date.now()
        });
        // Resetear el estado de cambios cuando la consulta es exitosa
        setHasChanges(false);
      } else {
        setQueryResult({
          query: queryToExecute,
          rows: 0,
          executionTime: '0ms',
          data: '',
          error: data.details || data.error || 'Unknown error',
          success: false,
          queryId: Date.now()
        });
        // También resetear cambios en caso de error
        setHasChanges(false);
      }
    } catch (error) {
      console.error('Error executing query:', error);
      setQueryResult({
        query: queryToExecute,
        rows: 0,
        executionTime: '0ms',
        data: '',
        error: error.message,
        success: false,
        queryId: Date.now()
      });
      setHasChanges(false);
    }
    setLoadingStates(prev => ({ ...prev, executing: false }));
  };


  const exportData = (format) => {
    const now = new Date();
    const dateStr = now.toISOString().split('T')[0];

    // Construir nombre del archivo con bucket y filtros
    let fileName = selectedBucket || 'PV';

    // Agregar filtros seleccionados al nombre
    const activeFilters = filters.filter(filter => filter.key && filter.selectedValues.length > 0);

    if (activeFilters.length > 0) {
      const filterNames = activeFilters.map(filter => {
        // Si solo hay un valor, usar solo ese valor (sin etiqueta)
        if (filter.selectedValues.length === 1) {
          return filter.selectedValues[0];
        } else {
          // Si hay múltiples valores, usar el nombre del filtro y cantidad
          const friendlyNames = {
            'PVO_Plant': 'Planta',
            'PVO_Zone': 'Zona',
            'PVO_type': 'Tipo',
            'PVO_id': 'ID',
            '_field': 'Variable'
          };
          const filterName = friendlyNames[filter.key] || filter.key;
          return `${filterName}_${filter.selectedValues.length}valores`;
        }
      });

      fileName += '_' + filterNames.join('_');
    }

    // Agregar fecha
    fileName += `_${dateStr}`;

    // Limpiar caracteres especiales del nombre del archivo
    fileName = fileName.replace(/[^a-zA-Z0-9_-]/g, '_');

    if (!queryResult || !queryResult.data) {
      alert('No data to export. Run a query first.');
      return;
    }

    if (format === 'csv') {
      // Estructura optimizada: tiempo + INV1_Pca + INV1_PF + INV2_Pca + INV2_PF + etc.
      const lines = queryResult.data.split('\n').filter(line => line.trim());
      if (lines.length > 1) {
        const headers = lines[0].split(',').map(h => h.replace(/"/g, '').trim());

        // Encontrar índices de las columnas necesarias
        const fieldIndex = headers.indexOf('_field');
        const timeIndex = headers.indexOf('_time');
        const valueIndex = headers.indexOf('_value');
        const idIndex = headers.indexOf('PVO_id');

        // Verificar que existan las columnas
        if (fieldIndex === -1 || timeIndex === -1 || valueIndex === -1) {
          alert('Las columnas requeridas (_field, _time, _value) no están disponibles en los datos.');
          return;
        }

        // Recopilar datos organizados
        const dataPoints = [];
        const uniqueIds = new Set();
        const uniqueFields = new Set();

        lines.slice(1).forEach(line => {
          const cells = line.split(',').map(cell => cell.replace(/"/g, '').trim());
          if (cells.length > Math.max(fieldIndex, timeIndex, valueIndex, idIndex !== -1 ? idIndex : 0)) {
            // AÑADIR ESTAS LÍNEAS:
            const plantIndex = headers.indexOf('PVO_Plant');
            const zoneIndex = headers.indexOf('PVO_Zone');
            const typeIndex = headers.indexOf('PVO_type');

            const plant = plantIndex !== -1 ? cells[plantIndex] : '';
            const zone = zoneIndex !== -1 ? cells[zoneIndex] : '';
            const id = idIndex !== -1 ? cells[idIndex] : '';

            // Crear el ID completo: Planta_Zona_ID
            const fullId = [plant, zone, id].filter(part => part !== '').join('_') || 'N/A';

            const field = cells[fieldIndex] || '';
            const time = cells[timeIndex] || '';
            // Convertir punto decimal a coma
            const value = (cells[valueIndex] || '').replace('.', ',');

            dataPoints.push({ id: fullId, field, time, value });
            uniqueIds.add(fullId);
            uniqueFields.add(field);
          }
        });

        // Convertir a arrays ordenados
        const sortedIds = Array.from(uniqueIds).sort();
        const sortedFields = Array.from(uniqueFields).sort();

        // Crear cabeceras dinámicas: tiempo + combinaciones ID_Variable
        const csvHeaders = ['tiempo'];
        sortedIds.forEach(id => {
          sortedFields.forEach(field => {
            csvHeaders.push(`${id}_${field}`);
          });
        });

        // Agrupar datos por tiempo
        const timeGroups = new Map();
        dataPoints.forEach(({ id, field, time, value }) => {
          if (!timeGroups.has(time)) {
            timeGroups.set(time, new Map());
          }
          const timeGroup = timeGroups.get(time);
          const key = `${id}_${field}`;
          timeGroup.set(key, value);
        });

        // Construir CSV - CAMBIOS AQUÍ: usar ; como separador y sin comillas
        let csvContent = csvHeaders.join(';') + '\n';

        // Ordenar tiempos y crear filas
        const sortedTimes = Array.from(timeGroups.keys()).sort();
        sortedTimes.forEach(time => {
          const row = [time]; // Empezar con el tiempo

          sortedIds.forEach(id => {
            sortedFields.forEach(field => {
              const key = `${id}_${field}`;
              const timeGroup = timeGroups.get(time);
              const value = timeGroup.has(key) ? timeGroup.get(key) : '';
              row.push(value);
            });
          });

          csvContent += row.join(';') + '\n';
        });

        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${fileName}.csv`;
        a.click();
        URL.revokeObjectURL(url);
      }
    } else if (format === 'json') {
      // Para JSON también filtrar las mismas columnas
      const lines = queryResult.data.split('\n').filter(line => line.trim());
      if (lines.length > 1) {
        const headers = lines[0].split(',').map(h => h.replace(/"/g, '').trim());

        const fieldIndex = headers.indexOf('_field');
        const timeIndex = headers.indexOf('_time');
        const valueIndex = headers.indexOf('_value');

        if (fieldIndex === -1 || timeIndex === -1 || valueIndex === -1) {
          alert('Las columnas requeridas (_field, _time, _value) no están disponibles en los datos.');
          return;
        }

        const jsonData = lines.slice(1).map(line => {
          const cells = line.split(',').map(cell => cell.replace(/"/g, '').trim());
          if (cells.length > Math.max(fieldIndex, timeIndex, valueIndex)) {
            return {
              _field: cells[fieldIndex] || '',
              _time: cells[timeIndex] || '',
              _value: cells[valueIndex] || ''
            };
          }
          return null;
        }).filter(item => item !== null);

        const blob = new Blob([JSON.stringify(jsonData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${fileName}.json`;
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
    // Mapeo de campos técnicos a nombres amigables
    const allowedFields = [
      { value: 'PVO_Plant', label: 'Planta' },
      { value: 'PVO_Zone', label: 'Zona' },
      { value: 'PVO_type', label: 'Tipo' },
      { value: 'PVO_id', label: 'ID' },
      { value: '_field', label: 'Variable' }
    ];

    // Obtener las claves de filtros ya utilizadas
    const usedFilterKeys = filters.map(filter => filter.key).filter(key => key !== '');

    // Filtrar opciones que no estén ya en uso
    const availableOptions = allowedFields.filter(field =>
      !usedFilterKeys.includes(field.value)
    );

    return {
      allOptions: availableOptions,
      totalAvailable: availableOptions.length
    };
  }, [filters]);

  // Agregar esta función después de los otros useCallback
  const getAvailableOptionsForFilter = useCallback((currentFilterId) => {
    const allowedFields = [
      { value: 'PVO_Plant', label: 'Planta' },
      { value: 'PVO_Zone', label: 'Zona' },
      { value: 'PVO_type', label: 'Tipo' },
      { value: 'PVO_id', label: 'ID' },
      { value: '_field', label: 'Variable' }
    ];

    // Obtener las claves de filtros ya utilizadas (excluyendo el filtro actual)
    const usedFilterKeys = filters
      .filter(filter => filter.id !== currentFilterId && filter.key !== '')
      .map(filter => filter.key);

    // Filtrar opciones que no estén ya en uso
    return allowedFields.filter(field =>
      !usedFilterKeys.includes(field.value)
    );
  }, [filters]);

  const CustomCalendar = ({ onDateSelect, selectedDates }) => {
    const [currentMonth, setCurrentMonth] = useState(new Date());

    const getDaysInMonth = (date) => {
      const year = date.getFullYear();
      const month = date.getMonth();
      const firstDay = new Date(year, month, 1);
      const lastDay = new Date(year, month + 1, 0);
      const daysInMonth = lastDay.getDate();
      const startingDayOfWeek = firstDay.getDay();

      const days = [];

      // Días del mes anterior para completar la primera semana
      for (let i = startingDayOfWeek - 1; i >= 0; i--) {
        const prevDate = new Date(year, month, -i);
        days.push({ date: prevDate, isCurrentMonth: false });
      }

      // Días del mes actual
      for (let day = 1; day <= daysInMonth; day++) {
        const date = new Date(year, month, day);
        days.push({ date, isCurrentMonth: true });
      }

      return days;
    };

    const formatDateString = (date) => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };

    const isDateSelected = (date) => {
      const dateStr = formatDateString(date);
      return selectedDates.includes(dateStr);
    };

    const isDateInRange = (date) => {
      if (selectedDates.length !== 2) return false;
      const dateStr = formatDateString(date);
      const [start, end] = selectedDates.sort();
      return dateStr > start && dateStr < end;
    };

    // Función para verificar si una fecha es futura
    const isFutureDate = (date) => {
      const today = new Date();
      today.setHours(0, 0, 0, 0); // Resetear horas para comparar solo fechas
      return date > today;
    };

    const days = getDaysInMonth(currentMonth);
    const monthNames = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
      "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

    return (
      <div className="border border-custom rounded-lg p-3 bg-panel">
        {/* Header del calendario */}
        <div className="flex items-center justify-between mb-3">
          <button
            onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1))}
            className="p-1 hover-badge-gray rounded cursor-pointer"
          >
            <ArrowLeft size={16} />
          </button>
          <h4 className="font-medium text-primary">
            {monthNames[currentMonth.getMonth()]} {currentMonth.getFullYear()}
          </h4>
          <button
            onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1))}
            className="p-1 hover-badge-gray rounded cursor-pointer"
          >
            <ArrowRight size={16} />
          </button>
        </div>

        {/* Días de la semana */}
        <div className="grid grid-cols-7 gap-1 mb-2">
          {['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'].map(day => (
            <div key={day} className="text-center text-xs font-medium text-secondary p-2">
              {day}
            </div>
          ))}
        </div>

        {/* Días del calendario */}
        <div className="grid grid-cols-7 gap-1">
          {days.map(({ date, isCurrentMonth }, index) => {
            const dateStr = formatDateString(date);
            const isSelected = isDateSelected(date);
            const isInRange = isDateInRange(date);
            const isFuture = isFutureDate(date);
            const isDisabled = !isCurrentMonth || isFuture;

            return (
              <button
                key={index}
                onClick={() => !isDisabled && onDateSelect(dateStr)}
                disabled={isDisabled}
                className={`
                  p-2 text-sm rounded
                  ${isDisabled ? 'text-gray-400 cursor-default opacity-50' : 'text-primary hover-badge-blue cursor-pointer'}
                  ${isSelected ? 'bg-blue-500 !text-white font-bold' : ''}
                  ${isInRange ? 'badge-selected' : ''}
                `}
              >
                {date.getDate()}
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Query Builder */}
        <div className="lg:col-span-2 space-y-6">
          {/* Bucket Selection */}
          <div className="bg-panel rounded-lg p-4 py-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold flex items-center gap-2 text-primary">
                <Database size={16} />
                Bucket
              </h3>
              <div className="px-3 py-2 border border-custom rounded-lg bg-panel text-primary font-medium">
                PV
              </div>
            </div>
          </div>

          {/* Filters */}
          {selectedBucket && (
            <div className="bg-panel rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold flex items-center gap-2 text-primary">
                  <Filter size={16} />
                  Filtros
                </h3>
                <button
                  onClick={addFilter}
                  className="flex items-center gap-2 px-4 py-2 text-sm bg-blue-500 text-white rounded-lg hover:bg-blue-600 cursor-pointer"
                  disabled={loadingStates.bucketData}
                >
                  <Plus size={16} />
                  Añadir filtro
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
                        className="flex-1 p-2 rounded-lg bg-header-table text-primary text-sm"
                        disabled={loadingStates.bucketData}
                      >
                        <option value="">
                          {!selectedBucket
                            ? "Selecciona un bucket primero..."
                            : getAvailableOptionsForFilter(filter.id).length === 0
                              ? `Todos los filtros están en uso`
                              : `Seleccionar filtro...`
                          }
                        </option>

                        {/* Solo mostrar opciones si hay un bucket seleccionado y filtros disponibles */}
                        {selectedBucket && getAvailableOptionsForFilter(filter.id).map(option => (
                          <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                      </select>

                      {/* Remove Filter Button */}
                      <button
                        onClick={() => removeFilter(filter.id)}
                        className="p-2 text-red-500 hover-badge-red rounded cursor-pointer"
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
                                Cargando valores...
                              </div>
                            ) : filter.availableValues.length === 0 ? (
                              <div className="text-center py-2 text-secondary text-sm">
                                No se encontraron valores
                              </div>
                            ) : (
                              filter.availableValues.map(value => (
                                <label key={value} className="flex items-center space-x-2 text-sm cursor-pointer hover-bg rounded p-1">
                                  <input
                                    type="checkbox"
                                    checked={filter.selectedValues.includes(value)}
                                    onChange={(e) => handleFilterValueChange(filter.id, value, e.target.checked)}
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
                  <div>Ningún filtro añadido</div>
                  <div className="text-xs mt-1">Clica en "Añadir filtro" para filtrar tus datos</div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Query Panel */}
        <div className="space-y-6">
          {/* Time Range */}
          <div className="bg-panel rounded-lg p-4">
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2 text-primary">
              <Calendar size={16} />
              Rango de fechas y horas
            </h3>

            <div className="space-y-3">
              <button
                onClick={() => setShowCalendar(!showCalendar)}
                className="w-full p-2 border border-custom rounded-lg bg-panel text-primary text-sm text-left flex items-center justify-between"
              >
                <span>
                  {(() => {
                    if (timeRange.selectedDates.length === 0) {
                      return "Seleccionar fecha...";
                    }

                    if (timeRange.selectedDates.length === 1) {
                      return `Fecha seleccionada: ${formatDate(timeRange.selectedDates[0])}`;
                    }

                    // Para rango de fechas (2 fechas)
                    const sortedDates = timeRange.selectedDates.sort();
                    return `Rango seleccionado: ${formatDate(sortedDates[0])} hasta ${formatDate(sortedDates[1])}`;
                  })()}
                </span>
                <Calendar size={16} />
              </button>

              {showCalendar && (
                <CustomCalendar
                  onDateSelect={handleDateSelection}
                  selectedDates={timeRange.selectedDates}
                />
              )}

              {/* Selección de horas */}
              {timeRange.selectedDates.length > 0 && (
                <div className="space-y-3 border-t border-custom pt-3">
                  <h4 className="text-sm font-medium text-primary">Horarios</h4>

                  {timeRange.selectedDates.length === 1 ? (
                    // Para una sola fecha
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-xs font-medium mb-1 text-secondary">
                          Hora inicio
                        </label>
                        <input
                          type="time"
                          value={timeRange.startTime || '00:00'}
                          onChange={(e) => {
                            const time = e.target.value || '00:00';
                            const date = timeRange.selectedDates[0];
                            const startIso = `${date}T${time}:00Z`;
                            setTimeRange(prev => ({
                              ...prev,
                              startTime: time,
                              start: `time(v: "${startIso}")`
                            }));
                          }}
                          className="w-full p-2 border border-custom rounded bg-panel text-primary text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium mb-1 text-secondary">
                          Hora fin
                        </label>
                        <input
                          type="time"
                          value={timeRange.endTime || '23:59'}
                          onChange={(e) => {
                            const time = e.target.value || '23:59';
                            const date = timeRange.selectedDates[0];
                            const endIso = `${date}T${time}:59Z`;
                            setTimeRange(prev => ({
                              ...prev,
                              endTime: time,
                              stop: `time(v: "${endIso}")`
                            }));
                          }}
                          className="w-full p-2 border border-custom rounded bg-panel text-primary text-sm"
                        />
                      </div>
                    </div>
                  ) : (
                    // Para rango de fechas
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-xs font-medium mb-1 text-secondary">
                          Hora inicio ({(() => {
                            const date = new Date(timeRange.selectedDates.sort()[0]);
                            const day = date.getDate().toString().padStart(2, '0');
                            const month = (date.getMonth() + 1).toString().padStart(2, '0');
                            const year = date.getFullYear();
                            return `${day}/${month}/${year}`;
                          })()})
                        </label>
                        <input
                          type="time"
                          value={timeRange.startTime || '00:00'}
                          onChange={(e) => {
                            const time = e.target.value || '00:00';
                            const startDate = timeRange.selectedDates.sort()[0];
                            const startIso = `${startDate}T${time}:00Z`;
                            setTimeRange(prev => ({
                              ...prev,
                              startTime: time,
                              start: `time(v: "${startIso}")`
                            }));
                          }}
                          className="w-full p-2 border border-custom rounded bg-panel text-primary text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium mb-1 text-secondary">
                          Hora fin ({(() => {
                            const date = new Date(timeRange.selectedDates.sort()[1]);
                            const day = date.getDate().toString().padStart(2, '0');
                            const month = (date.getMonth() + 1).toString().padStart(2, '0');
                            const year = date.getFullYear();
                            return `${day}/${month}/${year}`;
                          })()})
                        </label>
                        <input
                          type="time"
                          value={timeRange.endTime || '23:59'}
                          onChange={(e) => {
                            const time = e.target.value || '23:59';
                            const endDate = timeRange.selectedDates.sort()[1];
                            const endIso = `${endDate}T${time}:59Z`;
                            setTimeRange(prev => ({
                              ...prev,
                              endTime: time,
                              stop: `time(v: "${endIso}")`
                            }));
                          }}
                          className="w-full p-2 border border-custom rounded bg-panel text-primary text-sm"
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}

              {timeRange.selectedDates.length > 0 && (
                <button
                  onClick={() => {
                    setTimeRange({
                      start: '',
                      stop: 'now()',
                      selectedDates: [],
                      startDate: '',
                      endDate: '',
                      startTime: '',
                      endTime: ''
                    });
                  }}
                  className="text-xs text-muted hover:underline cursor-pointer"
                >
                  Limpiar selección
                </button>
              )}
            </div>
          </div>

          {/* Aggregation */}
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

          {/* Execute & Export Buttons */}
          <div className="space-y-3">
            <button
              onClick={executeQuery}
              disabled={loadingStates.executing || (!useCustomQuery && !selectedBucket)}
              className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {loadingStates.executing && (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              )}
              {loadingStates.executing ? 'Cargando...' : 'Aceptar'}
            </button>

            <div className="flex gap-3">
              <button
                onClick={() => exportData('csv')}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg transition-all ${!queryResult?.success || hasChanges
                  ? 'bg-gray-400 text-gray-200 cursor-not-allowed opacity-50'
                  : 'bg-green-500 text-white hover:bg-green-600 cursor-pointer'
                  }`}
                disabled={!queryResult?.success || hasChanges}
              >
                <Download size={16} />
                CSV
              </button>
              <button
                onClick={() => exportData('json')}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg transition-all ${!queryResult?.success || hasChanges
                  ? 'bg-gray-400 text-gray-200 cursor-not-allowed opacity-50'
                  : 'bg-gray-500 text-white hover:bg-gray-600 cursor-pointer'
                  }`}
                disabled={!queryResult?.success || hasChanges}
              >
                <Download size={16} />
                JSON
              </button>
            </div>
          </div>
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
                    <th className="text-left p-3 font-semibold text-primary text-sm border-r border-custom">
                      _field
                    </th>
                    <th className="text-left p-3 font-semibold text-primary text-sm border-r border-custom">
                      _time
                    </th>
                    <th className="text-left p-3 font-semibold text-primary text-sm">
                      _value
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    const lines = queryResult.data.split('\n').filter(line => line.trim());
                    if (lines.length <= 1) return null;

                    // Obtener los headers y encontrar los índices de las columnas que queremos
                    const headers = lines[0].split(',').map(h => h.replace(/"/g, '').trim());
                    const fieldIndex = headers.indexOf('_field');
                    const timeIndex = headers.indexOf('_time');
                    const valueIndex = headers.indexOf('_value');

                    // Verificar que existan las columnas requeridas
                    if (fieldIndex === -1 || timeIndex === -1 || valueIndex === -1) {
                      return (
                        <tr>
                          <td colSpan="3" className="p-3 text-center text-secondary text-sm">
                            Las columnas requeridas (_field, _time, _value) no están disponibles en los datos.
                          </td>
                        </tr>
                      );
                    }

                    // Procesar las filas de datos (máximo 100 para la vista)
                    return lines.slice(1, 101).map((row, rowIndex) => {
                      if (!row.trim()) return null;

                      const cells = row.split(',').map(cell => cell.replace(/"/g, '').trim());

                      // Verificar que la fila tenga suficientes columnas
                      if (cells.length <= Math.max(fieldIndex, timeIndex, valueIndex)) {
                        return null;
                      }

                      return (
                        <tr key={rowIndex} className="border-b border-custom hover-bg">
                          <td className="p-3 text-sm text-primary border-r border-custom">
                            <div className="max-w-xs truncate" title={cells[fieldIndex] || ''}>
                              {cells[fieldIndex] || ''}
                            </div>
                          </td>
                          <td className="p-3 text-sm text-primary border-r border-custom">
                            <div className="max-w-xs truncate" title={cells[timeIndex] || ''}>
                              {cells[timeIndex] || ''}
                            </div>
                          </td>
                          <td className="p-3 text-sm text-primary">
                            <div className="max-w-xs truncate" title={cells[valueIndex] || ''}>
                              {cells[valueIndex] || ''}
                            </div>
                          </td>
                        </tr>
                      );
                    }).filter(row => row !== null);
                  })()}
                </tbody>
              </table>
            </div>

            {queryResult.data.split('\n').length > 101 && (
              <div className="bg-header-table border-t border-custom p-3 text-center text-sm text-secondary">
                Showing first 100 rows of {queryResult.rows} total rows. Export to see all data.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ExportacionVariablesPage;