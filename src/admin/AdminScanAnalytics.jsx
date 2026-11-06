// src/admin/AdminScanAnalytics.jsx
import { useEffect, useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import {
  fetchAllScans,
  filterByRange,
  buildTimeSeries,
  buildTopCities,
  buildResultDistribution,
  buildImpossibilitySeries,
  buildSummaryStats,
  buildDeviceBreakdown,
  buildTimezoneBreakdown,
  buildHourlyRisk,
  buildWeekdayRisk,
  buildHighRiskUnits,
  buildGeoSpread,
  RANGE_OPTIONS,
  prettifyResult,
  formatDateTime,
  formatRelativeTime,
} from './scanAnalytics';
import { exportScansToCsv, exportScansToExcel } from './scanExport';
import './AdminScanAnalytics.css';

const PAGE_SIZE = 50;

const AdminScanAnalytics = () => {
  const { admin } = useOutletContext();

  const [allScans, setAllScans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [range, setRange] = useState('7d');
  const [resultFilter, setResultFilter] = useState('all');
  const [cityFilter, setCityFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  // Detail drawer state
  const [drawer, setDrawer] = useState(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError('');
      try {
        const scans = await fetchAllScans({ max: 5000 });
        setAllScans(scans);
      } catch (err) {
        console.error('Failed to load scan analytics:', err);
        setError(
          err.code === 'permission-denied'
            ? 'Permission denied. Check Firestore rules for scan_events.'
            : `Could not load scans: ${err.message}`
        );
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const rangeScans = useMemo(() => filterByRange(allScans, range), [allScans, range]);

  const filtered = useMemo(() => {
    let out = rangeScans;
    if (resultFilter !== 'all') out = out.filter((s) => s.result === resultFilter);
    if (cityFilter !== 'all') out = out.filter((s) => s.locationCity === cityFilter);
    if (search) {
      const q = search.toLowerCase();
      out = out.filter(
        (s) =>
          s.consumerReferenceCode?.toLowerCase().includes(q) ||
          s.unitId?.toLowerCase().includes(q) ||
          s.locationCity?.toLowerCase().includes(q) ||
          s.devicePlatform?.toLowerCase().includes(q)
      );
    }
    return out;
  }, [rangeScans, resultFilter, cityFilter, search]);

  const summary = useMemo(() => buildSummaryStats(filtered), [filtered]);
  const timeSeries = useMemo(() => buildTimeSeries(filtered, range), [filtered, range]);
  const topCities = useMemo(() => buildTopCities(filtered, 10), [filtered]);
  const distribution = useMemo(() => buildResultDistribution(filtered), [filtered]);
  const impossibleSeries = useMemo(() => buildImpossibilitySeries(filtered), [filtered]);
  const deviceBreakdown = useMemo(() => buildDeviceBreakdown(filtered), [filtered]);
  const timezoneBreakdown = useMemo(() => buildTimezoneBreakdown(filtered), [filtered]);
  const hourlyRisk = useMemo(() => buildHourlyRisk(filtered), [filtered]);
  const weekdayRisk = useMemo(() => buildWeekdayRisk(filtered), [filtered]);
  const highRiskUnits = useMemo(() => buildHighRiskUnits(filtered, 15), [filtered]);
  const geoSpread = useMemo(() => buildGeoSpread(filtered), [filtered]);

  const cityOptions = useMemo(() => {
    const set = new Set(rangeScans.map((s) => s.locationCity).filter(Boolean));
    return Array.from(set).sort();
  }, [rangeScans]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  useEffect(() => setPage(1), [range, resultFilter, cityFilter, search]);

  // ============================================================
  // DRAWER OPENERS
  // ============================================================
  const openSummaryDrawer = (title, key, value) => {
    let matched = [];
    if (key === 'total') matched = filtered;
    else if (key === 'authentic') matched = filtered.filter((s) => s.result === 'AUTHENTIC');
    else if (key === 'suspicious') matched = filtered.filter((s) => s.result === 'SUSPICIOUS');
    else if (key === 'duplicate') matched = filtered.filter((s) => s.result === 'DUPLICATE_CODE');
    else if (key === 'invalid') matched = filtered.filter((s) => s.result === 'INVALID');
    else if (key === 'impossible') matched = filtered.filter((s) => s.isPhysicallyImpossible);

    setDrawer({
      title,
      subtitle: `${value} scan${value === 1 ? '' : 's'}`,
      scans: matched.slice(0, 200),
      meta: [
        { label: 'Total in view', value: matched.length },
        { label: 'Showing', value: Math.min(matched.length, 200) },
      ],
    });
  };

  const openTimeBucketDrawer = (bucket) => {
    const matched = filtered.filter((s) => {
      const bStart = bucket.time;
      const bEnd = bStart + (timeSeries[1]?.time - timeSeries[0]?.time || 86400000);
      return s.timestampMs >= bStart && s.timestampMs < bEnd;
    });
    setDrawer({
      title: `Time window: ${bucket.label}`,
      subtitle: `${matched.length} scans`,
      scans: matched,
      meta: [
        { label: 'Total', value: bucket.total },
        { label: 'Authentic', value: bucket.authentic },
        { label: 'Suspicious', value: bucket.suspicious },
        { label: 'Duplicate Code', value: bucket.duplicate },   // 🆕
        { label: 'Invalid', value: bucket.invalid },
        { label: 'Impossible travel', value: bucket.impossible },
      ],
    });
  };

  const openCityDrawer = (city) => {
    const matched = filtered.filter((s) => s.locationCity === city.city);
    setDrawer({
      title: `${city.city}${city.state ? `, ${city.state}` : ''}`,
      subtitle: `${matched.length} scans`,
      scans: matched,
      meta: [
        { label: 'Total', value: city.total },
        { label: 'Authentic', value: city.authentic },
        { label: 'Suspicious', value: city.suspicious },
        { label: 'Duplicate Code', value: city.duplicate },   // 🆕
        { label: 'Invalid', value: city.invalid },
        { label: 'Impossible travel', value: city.impossible },
        { label: 'Risk rate', value: `${city.riskPct}%` },
      ],
    });
  };

  const openResultDrawer = (slice) => {
    const matched = filtered.filter((s) => s.result === slice.key);
    setDrawer({
      title: `Result: ${slice.name}`,
      subtitle: `${matched.length} scans`,
      scans: matched,
      meta: [
        { label: 'Count', value: slice.value },
        { label: 'Share', value: `${Math.round((slice.value / filtered.length) * 100)}%` },
      ],
    });
  };

  const openHourDrawer = (hour) => {
    const matched = filtered.filter(
      (s) => new Date(s.timestampMs).getHours() === hour.hour
    );
    setDrawer({
      title: `Hour: ${hour.label}`,
      subtitle: `${matched.length} scans`,
      scans: matched,
      meta: [
        { label: 'Total', value: hour.total },
        { label: 'Flagged', value: hour.flagged },
        { label: 'Risk rate', value: `${hour.riskPct}%` },
      ],
    });
  };

  const openWeekdayDrawer = (day) => {
    const matched = filtered.filter(
      (s) => new Date(s.timestampMs).getDay() === day.dayIndex
    );
    setDrawer({
      title: `Weekday: ${day.day}`,
      subtitle: `${matched.length} scans`,
      scans: matched,
      meta: [
        { label: 'Total', value: day.total },
        { label: 'Flagged', value: day.flagged },
        { label: 'Risk rate', value: `${day.riskPct}%` },
      ],
    });
  };

  const openDeviceDrawer = (device) => {
    const matched = filtered.filter(
      (s) => (s.devicePlatform || 'Unknown') === device.name
    );
    setDrawer({
      title: `Device: ${device.name}`,
      subtitle: `${matched.length} scans`,
      scans: matched,
      meta: [{ label: 'Count', value: device.value }],
    });
  };

  const handleExportCsv = () => {
    exportScansToCsv(filtered, `konfa_scans_${range}`);
  };

  const handleExportExcel = () => {
    exportScansToExcel(filtered, `konfa_scans_${range}`);
  };

  if (loading) {
    return (
      <div className="admin-page">
        <header className="admin-page-header">
          <div>
            <h1>Scan Analytics</h1>
            <p>Loading scan events…</p>
          </div>
        </header>
        <div className="admin-stat-grid">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="admin-skeleton-card" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="admin-page">
      <header className="admin-page-header admin-page-header-with-actions">
        <div>
          <h1>Scan Analytics</h1>
          <p>
            Click any card, bar, or slice for the full detail behind it.
          </p>
        </div>
        <div className="admin-header-actions">
          <button
            type="button"
            className="admin-btn admin-btn-refresh admin-btn-sm"
            onClick={handleExportCsv}
            disabled={!filtered.length}
          >
            ⤓ CSV
          </button>
          <button
            type="button"
            className="admin-btn admin-btn-primary admin-btn-sm"
            onClick={handleExportExcel}
            disabled={!filtered.length}
          >
            ⤓ Excel
          </button>
        </div>
      </header>

      {error && <div className="admin-error">{error}</div>}

      {/* Stat strip — clickable */}
      <div className="admin-stat-grid">
        <ClickableStat
          label="Total Scans"
          value={summary.total}
          accent="navy"
          onClick={() => openSummaryDrawer('All scans', 'total', summary.total)}
        />
        <ClickableStat
          label="Authentic"
          value={summary.authentic}
          accent="green"
          onClick={() => openSummaryDrawer('Authentic scans', 'authentic', summary.authentic)}
        />
        <ClickableStat
          label="Suspicious"
          value={summary.suspicious}
          accent="red"
          onClick={() => openSummaryDrawer('Suspicious scans', 'suspicious', summary.suspicious)}
        />
        {/* 🆕 Duplicate Code stat */}
        <ClickableStat
          label="Duplicate Code"
          value={summary.duplicate}
          accent={summary.duplicate > 0 ? 'red' : 'green'}
          onClick={() =>
            openSummaryDrawer('Duplicate code scans', 'duplicate', summary.duplicate)
          }
        />
        <ClickableStat
          label="Invalid"
          value={summary.invalid}
          accent="amber"
          onClick={() => openSummaryDrawer('Invalid scans', 'invalid', summary.invalid)}
        />
        <ClickableStat
          label="Impossible Travel"
          value={summary.impossible}
          accent={summary.impossible > 0 ? 'red' : 'green'}
          onClick={() => openSummaryDrawer('Impossible travel flags', 'impossible', summary.impossible)}
        />
      </div>

      {/* Toolbar */}
      <div className="admin-toolbar">
        <div className="admin-filter-tabs">
          {RANGE_OPTIONS.map((r) => (
            <button
              key={r.key}
              type="button"
              className={`admin-tab ${range === r.key ? 'active' : ''}`}
              onClick={() => setRange(r.key)}
            >
              {r.label}
            </button>
          ))}
        </div>

        <select
          className="admin-select"
          value={resultFilter}
          onChange={(e) => setResultFilter(e.target.value)}
        >
          <option value="all">All results</option>
          <option value="AUTHENTIC">Authentic</option>
          <option value="SUSPICIOUS">Suspicious</option>
          <option value="DUPLICATE_CODE">Duplicate Code</option>
          <option value="INVALID">Invalid</option>
          <option value="EXPECTED">Expected</option>
          <option value="NOT_YET_RELEASED">Not Released</option>
        </select>

        <select
          className="admin-select"
          value={cityFilter}
          onChange={(e) => setCityFilter(e.target.value)}
        >
          <option value="all">All cities</option>
          {cityOptions.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>

        <div className="admin-search">
          <span className="admin-search-icon" aria-hidden="true">🔍</span>
          <input
            type="text"
            className="admin-input-search"
            placeholder="Search by code, unit, city…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Charts row 1 */}
      <section className="admin-scan-card">
        <div className="admin-scan-card-header">
          <h2>Scans over time</h2>
          <p>Click any point for the full breakdown of that window</p>
        </div>
        <div className="admin-scan-chart">
          <ResponsiveContainer width="100%" height={300}>
            <LineChart
              data={timeSeries}
              onClick={(e) => {
                if (e && e.activePayload && e.activePayload[0]) {
                  openTimeBucketDrawer(e.activePayload[0].payload);
                }
              }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip
                contentStyle={{ fontSize: 12, borderRadius: 8 }}
                labelStyle={{ fontWeight: 700 }}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Line type="monotone" dataKey="total" name="Total" stroke="#0a1628" strokeWidth={2} dot={false} activeDot={{ r: 6 }} />
              <Line type="monotone" dataKey="suspicious" name="Suspicious" stroke="#dc2626" strokeWidth={2} dot={false} activeDot={{ r: 6 }} />
              {/* 🆕 Duplicate over time */}
              <Line type="monotone" dataKey="duplicate" name="Duplicate Code" stroke="#7f1d1d" strokeWidth={2} dot={false} activeDot={{ r: 6 }} />
              <Line type="monotone" dataKey="impossible" name="Impossible travel" stroke="#d97706" strokeWidth={2} dot={false} activeDot={{ r: 6 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </section>

      {/* Charts row 2 */}
      <div className="admin-scan-grid-2">
        <section className="admin-scan-card">
          <div className="admin-scan-card-header">
            <h2>Top cities by scan volume</h2>
            <p>Click any bar for the city detail</p>
          </div>
          <div className="admin-scan-chart">
            <ResponsiveContainer width="100%" height={300}>
              <BarChart
                data={topCities}
                layout="vertical"
                margin={{ left: 20, right: 20 }}
                onClick={(e) => {
                  if (e && e.activePayload && e.activePayload[0]) {
                    openCityDrawer(e.activePayload[0].payload);
                  }
                }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="city" tick={{ fontSize: 11 }} width={100} />
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="total" name="Total" fill="#0d9488" radius={[0, 4, 4, 0]} cursor="pointer" />
                <Bar dataKey="suspicious" name="Suspicious" fill="#dc2626" radius={[0, 4, 4, 0]} cursor="pointer" />
                <Bar dataKey="duplicate" name="Duplicate Code" fill="#7f1d1d" radius={[0, 4, 4, 0]} cursor="pointer" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="admin-scan-card">
          <div className="admin-scan-card-header">
            <h2>Result distribution</h2>
            <p>Click any slice for the scan list</p>
          </div>
          <div className="admin-scan-chart">
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={distribution}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={2}
                  label={(e) => `${e.name}: ${e.value}`}
                  labelLine={false}
                  cursor="pointer"
                  onClick={(data) => openResultDrawer(data.payload)}
                >
                  {distribution.map((entry) => (
                    <Cell key={entry.key} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </section>
      </div>

      {/* Hourly heatmap */}
      <section className="admin-scan-card">
        <div className="admin-scan-card-header">
          <h2>Risk by hour of day</h2>
          <p>Click any bar to see scans in that hour</p>
        </div>
        <div className="admin-scan-chart">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart
              data={hourlyRisk}
              onClick={(e) => {
                if (e && e.activePayload && e.activePayload[0]) {
                  openHourDrawer(e.activePayload[0].payload);
                }
              }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="label" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
              <Bar dataKey="total" name="Total" fill="#0d9488" radius={[4, 4, 0, 0]} cursor="pointer" />
              <Bar dataKey="flagged" name="Flagged" fill="#dc2626" radius={[4, 4, 0, 0]} cursor="pointer" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      {/* Weekday pattern */}
      <section className="admin-scan-card">
        <div className="admin-scan-card-header">
          <h2>Risk by weekday</h2>
          <p>Click any bar to see that day's scans</p>
        </div>
        <div className="admin-scan-chart">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart
              data={weekdayRisk}
              onClick={(e) => {
                if (e && e.activePayload && e.activePayload[0]) {
                  const day = e.activePayload[0].payload;
                  const dayIndex = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].indexOf(day.day);
                  openWeekdayDrawer({ ...day, dayIndex });
                }
              }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="day" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
              <Bar dataKey="total" name="Total" fill="#0d9488" radius={[4, 4, 0, 0]} cursor="pointer" />
              <Bar dataKey="flagged" name="Flagged" fill="#dc2626" radius={[4, 4, 0, 0]} cursor="pointer" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      {/* Impossibility over time */}
      <section className="admin-scan-card">
        <div className="admin-scan-card-header">
          <h2>Impossibility flags over time</h2>
          <p>Scans where the product was in two places at once</p>
        </div>
        <div className="admin-scan-chart">
          {impossibleSeries.length === 0 ? (
            <div className="admin-scan-empty">No impossible-travel events in this period.</div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={impossibleSeries}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                <Bar dataKey="count" name="Flagged" fill="#dc2626" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </section>

      {/* Two-column: device + timezone */}
      <div className="admin-scan-grid-2">
        <section className="admin-scan-card">
          <div className="admin-scan-card-header">
            <h2>Device breakdown</h2>
            <p>Click any bar for detail</p>
          </div>
          <div className="admin-scan-chart">
            {deviceBreakdown.length === 0 ? (
              <div className="admin-scan-empty">No device data.</div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart
                  data={deviceBreakdown}
                  layout="vertical"
                  onClick={(e) => {
                    if (e && e.activePayload && e.activePayload[0]) {
                      openDeviceDrawer(e.activePayload[0].payload);
                    }
                  }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis type="number" tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={90} />
                  <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                  <Bar dataKey="value" name="Scans" fill="#0d9488" radius={[0, 4, 4, 0]} cursor="pointer" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </section>

        <section className="admin-scan-card">
          <div className="admin-scan-card-header">
            <h2>Timezone breakdown</h2>
            <p>Which timezones these scans come from</p>
          </div>
          <div className="admin-scan-chart">
            {timezoneBreakdown.length === 0 ? (
              <div className="admin-scan-empty">No timezone data.</div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={timezoneBreakdown} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis type="number" tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={120} />
                  <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                  <Bar dataKey="value" name="Scans" fill="#7c3aed" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </section>
      </div>

      {/* High-risk units */}
      {highRiskUnits.length > 0 && (
        <section className="admin-card admin-scan-table-card">
          <div className="admin-card-header">
            <div>
              <h2>High-risk units</h2>
              <p>Units with duplicate, suspicious, or impossible-travel flags</p>
            </div>
          </div>
          <div className="admin-card-table">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Reference</th>
                  <th>Unit ID</th>
                  <th>Scans</th>
                  <th>Duplicate</th>
                  <th>Suspicious</th>
                  <th>Impossible</th>
                  <th>Cities</th>
                  <th>Last seen</th>
                </tr>
              </thead>
              <tbody>
                {highRiskUnits.map((u) => (
                  <tr key={u.unitId} className="admin-tr">
                    <td>
                      <code className="admin-code-small">{u.referenceCode || '—'}</code>
                    </td>
                    <td className="admin-subtext">{u.unitId}</td>
                    <td>{u.scans}</td>
                    <td>
                      {u.duplicate > 0 ? (
                        <span className="admin-pill admin-pill-rejected">{u.duplicate}</span>
                      ) : (
                        <span className="admin-subtext">0</span>
                      )}
                    </td>
                    <td>
                      {u.suspicious > 0 ? (
                        <span className="admin-pill admin-pill-pending">{u.suspicious}</span>
                      ) : (
                        <span className="admin-subtext">0</span>
                      )}
                    </td>
                    <td>
                      {u.impossible > 0 ? (
                        <span className="admin-pill admin-pill-rejected">{u.impossible}</span>
                      ) : (
                        <span className="admin-subtext">0</span>
                      )}
                    </td>
                    <td className="admin-subtext">
                      {u.cityCount > 0 ? u.cities.slice(0, 3).join(', ') : '—'}
                      {u.cityCount > 3 && ` +${u.cityCount - 3}`}
                    </td>
                    <td className="admin-td-date">
                      {formatRelativeTime(u.lastScanTs)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Data table */}
      <section className="admin-card admin-scan-table-card">
        <div className="admin-card-header">
          <div>
            <h2>All scan events</h2>
            <p>
              {filtered.length} scan{filtered.length === 1 ? '' : 's'} matching your filters
            </p>
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="admin-empty">
            <p>No scans match your filters.</p>
          </div>
        ) : (
          <>
            <div className="admin-card-table">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Time</th>
                    <th>Reference</th>
                    <th>Result</th>
                    <th>City</th>
                    <th>Risk</th>
                    <th>Flags</th>
                    <th>Device</th>
                  </tr>
                </thead>
                <tbody>
                  {pageRows.map((s) => (
                    <tr
                      key={s.id}
                      className="admin-tr admin-tr-clickable"
                      onClick={() => {
                        setDrawer({
                          title: `Scan ${s.consumerReferenceCode || s.unitId}`,
                          subtitle: formatDateTime(s.timestamp),
                          scans: [s],
                          meta: [
                            { label: 'Result', value: prettifyResult(s.result) },
                            { label: 'Risk score', value: s.riskScore },
                            { label: 'City', value: s.locationCity || '—' },
                            { label: 'State', value: s.locationState || '—' },
                            {
                              label: 'Coordinates',
                              value:
                                s.locationLat != null && s.locationLng != null
                                  ? `${s.locationLat.toFixed(4)}, ${s.locationLng.toFixed(4)}`
                                  : '—',
                            },
                            { label: 'Impossible travel', value: s.isPhysicallyImpossible ? 'YES' : 'No' },
                            { label: 'Reason', value: s.impossibilityReason || '—' },
                            { label: 'Previous city', value: s.previousScanCity || '—' },
                            { label: 'Distance', value: s.distanceFromPreviousKm != null ? `${s.distanceFromPreviousKm} km` : '—' },
                            { label: 'Minutes between', value: s.minutesSincePrevious ?? '—' },
                            { label: 'Required speed', value: s.requiredSpeedKmh != null ? `${s.requiredSpeedKmh} km/h` : '—' },
                            { label: 'Device', value: s.devicePlatform || '—' },
                            { label: 'Timezone', value: s.deviceTimezone || '—' },
                          ],
                        });
                      }}
                    >
                      <td className="admin-td-date">{formatDateTime(s.timestamp)}</td>
                      <td>
                        <code className="admin-code-small">{s.consumerReferenceCode || '—'}</code>
                      </td>
                      <td>
                        <span className={`admin-pill admin-pill-${(s.result || 'unknown').toLowerCase()}`}>
                          {prettifyResult(s.result)}
                        </span>
                      </td>
                      <td>
                        {s.locationCity || '—'}
                        {s.locationState && <span className="admin-subtext"> · {s.locationState}</span>}
                      </td>
                      <td>{s.riskScore}</td>
                      <td>
                        {s.isPhysicallyImpossible ? (
                          <span className="admin-pill admin-pill-rejected">Impossible</span>
                        ) : s.result === 'DUPLICATE_CODE' ? (
                          <span className="admin-pill admin-pill-rejected">Duplicate</span>
                        ) : (
                          <span className="admin-subtext">—</span>
                        )}
                      </td>
                      <td className="admin-subtext">{s.devicePlatform || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="admin-scan-pagination">
              <button
                className="admin-btn admin-btn-ghost admin-btn-sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                ← Prev
              </button>
              <span>Page {page} of {pageCount}</span>
              <button
                className="admin-btn admin-btn-ghost admin-btn-sm"
                onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
                disabled={page === pageCount}
              >
                Next →
              </button>
            </div>
          </>
        )}
      </section>

      {/* Detail drawer */}
      {drawer && <ScanDrawer drawer={drawer} onClose={() => setDrawer(null)} />}
    </div>
  );
};

// ============================================================
// SUB-COMPONENTS
// ============================================================
const ClickableStat = ({ label, value, accent, onClick }) => (
  <button
    type="button"
    className={`admin-stat-card admin-stat-${accent} admin-stat-clickable`}
    onClick={onClick}
  >
    <span className="admin-stat-label">{label}</span>
    <span className="admin-stat-value">{value ?? 0}</span>
    <span className="admin-stat-hint">Click for details →</span>
  </button>
);

const ScanDrawer = ({ drawer, onClose }) => (
  <div className="admin-drawer-overlay" onClick={onClose}>
    <aside
      className="admin-drawer"
      onClick={(e) => e.stopPropagation()}
      role="dialog"
      aria-modal="true"
    >
      <header className="admin-drawer-header">
        <div>
          <h2>{drawer.title}</h2>
          {drawer.subtitle && <p>{drawer.subtitle}</p>}
        </div>
        <button
          type="button"
          className="admin-drawer-close"
          onClick={onClose}
          aria-label="Close drawer"
        >
          ✕
        </button>
      </header>

      {drawer.meta && drawer.meta.length > 0 && (
        <section className="admin-drawer-meta">
          {drawer.meta.map((m, i) => (
            <div key={i} className="admin-drawer-meta-item">
              <span>{m.label}</span>
              <strong>{m.value}</strong>
            </div>
          ))}
        </section>
      )}

      {drawer.scans && drawer.scans.length > 0 && (
        <section className="admin-drawer-list">
          <h3>Scans ({drawer.scans.length})</h3>
          <ul>
            {drawer.scans.slice(0, 100).map((s) => (
              <li key={s.id} className="admin-drawer-scan">
                <div className="admin-drawer-scan-head">
                  <span className={`admin-pill admin-pill-${(s.result || 'unknown').toLowerCase()}`}>
                    {prettifyResult(s.result)}
                  </span>
                  <span className="admin-drawer-scan-time">
                    {formatDateTime(s.timestamp)}
                  </span>
                </div>
                <div className="admin-drawer-scan-code">
                  <code className="admin-code-small">{s.consumerReferenceCode || '—'}</code>
                  {s.locationCity && (
                    <span className="admin-subtext">
                      {' '}· {s.locationCity}{s.locationState ? `, ${s.locationState}` : ''}
                    </span>
                  )}
                </div>
                {s.isPhysicallyImpossible && (
                  <div className="admin-drawer-scan-flag">
                    ⚠ {s.impossibilityReason || 'Impossible travel detected'}
                  </div>
                )}
                {s.result === 'DUPLICATE_CODE' && !s.isPhysicallyImpossible && (
                  <div className="admin-drawer-scan-flag">
                    ⚠ This code has been duplicated — a case was opened.
                  </div>
                )}
              </li>
            ))}
            {drawer.scans.length > 100 && (
              <li className="admin-drawer-more">
                + {drawer.scans.length - 100} more (export for full list)
              </li>
            )}
          </ul>
        </section>
      )}
    </aside>
  </div>
);

export default AdminScanAnalytics;