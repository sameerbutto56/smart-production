import { useMemo, useState } from 'react';
import { resolvePktRange } from '../utils/pktRange';

// Standard preset options for dashboard/card date filters.
// `custom` exposes dateFrom/dateTo inputs; omit it to hide the custom UI.
export const DATE_RANGE_PRESETS = [
  { key: 'today', label: 'Today' },
  { key: 'yesterday', label: 'Yesterday' },
  { key: 'week', label: 'Weekly' },
  { key: 'month', label: 'Monthly' },
  { key: 'year', label: 'Year' },
  { key: 'all', label: 'All' },
  { key: 'custom', label: 'Custom' },
];

/**
 * Standard PKT-aware date-range filter state + derived range.
 *
 * Defaults to Today (per the QA spec: dashboards must never default to All).
 *
 * @param {object} [opts]
 * @param {string} [opts.initialRange='today'] — today|yesterday|week|month|year|all|custom
 * @param {Date|number|string} [opts.dataStart] — earliest record ts (All label/bounds)
 * @param {Date|number|string} [opts.dataEnd]   — latest record ts (All label/bounds)
 * @param {Array} [opts.presets] — subset of DATE_RANGE_PRESETS to expose
 * @returns {{
 *   range, setRange, dateFrom, setDateFrom, dateTo, setDateTo,
 *   start, end, inclusive UTC Date boundaries
 *   startISO, endISO, ISO strings for backend params
 *   label, spec display string, e.g. "Today — 31 August 2026"
 *   queryParams, range and optional dateFrom/dateTo for api.get params
 *   presets,
 * }}
 */
export default function useDateRange({
  initialRange = 'today',
  dataStart,
  dataEnd,
  presets = DATE_RANGE_PRESETS,
} = {}) {
  const [range, setRange] = useState(initialRange);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const resolved = useMemo(
    () => resolvePktRange({ range, dateFrom, dateTo, dataStart, dataEnd }),
    [range, dateFrom, dateTo, dataStart, dataEnd],
  );

  const queryParams = useMemo(() => {
    if (range === 'custom') {
      const p = { range: 'custom' };
      if (dateFrom) p.dateFrom = dateFrom;
      if (dateTo) p.dateTo = dateTo;
      return p;
    }
    return { range };
  }, [range, dateFrom, dateTo]);

  return {
    range,
    setRange,
    dateFrom,
    setDateFrom,
    dateTo,
    setDateTo,
    start: resolved.start,
    end: resolved.end,
    startISO: resolved.startISO,
    endISO: resolved.endISO,
    label: resolved.label,
    queryParams,
    presets,
  };
}