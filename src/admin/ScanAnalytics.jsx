// src/admin/ScanAnalytics.jsx
import { useEffect, useMemo, useState } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';
import {
  fetchScanEventsWindow,
  fetchAllUnits,
  fetchAllBatches,
  fetchConsumerReportsWindow,
} from './adminAuth';
import './AdminPortal.css';

const COLORS = {
  teal: '#0d9488',
  amber: '#d97706',
  red: '#dc2626',
  green: '#16a34a',
  slate: '#64748b',
  navy: '#0a1628',
  purple: '#7c3aed',
  darkRed: '#7f1d1d',   // 🆕 for DUPLICATE_CODE
};

const RESULT_COLORS = {
  AUTHENTIC: COLORS.green,
  SUSPICIOUS: COLORS.amber,
  INVALID: COLORS.red,
  EXPECTED: COLORS.slate,
  NOT_YET_RELEASED: COLORS.purple,
  DUPLICATE_CODE: COLORS.darkRed,   // 🆕
};

const ScanAnalytics = () => {
  const [days, setDays] = useState(30);
  const [events, setEvents] = useState([]);
  const [units, setUnits] = useState([]);
  const [batches, setBatches] = useState([]);
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [drilldown, setDrilldown] = useState(null); // { type, value }

  // ---------------- Load ----------------
  useEffect(() => {
    (async () => {
      setLoading(true);
      setError('');
      try {
        const [ev, u, b, r] = await Promise.all([
          fetchScanEventsWindow(days),
          fetchAllUnits(),
          fetchAllBatches(),
          fetchConsumerReportsWindow(days),
        ]);
        setEvents(ev);
        setUnits(u);
        setBatches(b);
        setReports(r);
      } catch (err) {
        console.error(err);
        setError('Could not load analytics data.');
      } finally {
        setLoading(false);
      }
    })();
  }, [days]);

  // ---------------- Derived: KPIs ----------------
  const kpis = useMemo(() => {
    const total = events.length;
    const authentic = events.filter((e) => e.result === 'AUTHENTIC').length;
    const suspicious = events.filter((e) => e.result === 'SUSPICIOUS').length;
    const duplicate = events.filter((e) => e.result === 'DUPLICATE_CODE').length;   // 🆕
    const invalid = events.filter((e) => e.result === 'INVALID').length;
    const impossibleTravel = events.filter((e) => e.isPhysicallyImpossible).length;
    const uniqueDevices = new Set(events.map((e) => e.deviceUserAgent).filter(Boolean)).size;
    const uniqueUnits = new Set(events.map((e) => e.unitId).filter(Boolean)).size;

    const authRate = total ? Math.round((authentic / total) * 100) : 0;
    const suspiciousRate = total ? Math.round((suspicious / total) * 100) : 0;
    // 🆕 duplicate rate (its own metric — confirmed counterfeiting)
    const duplicateRate = total ? Math.round((duplicate / total) * 100) : 0;

    return {
      total,
      authentic,
      suspicious,
      duplicate,        // 🆕
      invalid,
      impossibleTravel,
      uniqueDevices,
      uniqueUnits,
      authRate,
      suspiciousRate,
      duplicateRate,    // 🆕
      totalReports: reports.length,
    };
  }, [events, reports]);

  // ---------------- Derived: Time series ----------------
  const timeSeries = useMemo(() => {
    const buckets = {};
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
      const key = d.toISOString().slice(0, 10);
      buckets[key] = {
        date: key,
        label: d.toLocaleDateString([], { month: 'short', day: 'numeric' }),
        AUTHENTIC: 0,
        SUSPICIOUS: 0,
        DUPLICATE_CODE: 0,   // 🆕
        INVALID: 0,
        EXPECTED: 0,
        NOT_YET_RELEASED: 0,
        total: 0,
      };
    }
    for (const e of events) {
      if (!e.timestamp) continue;
      const key = e.timestamp.slice(0, 10);
      if (!buckets[key]) continue;
      buckets[key].total += 1;
      buckets[key][e.result] = (buckets[key][e.result] || 0) + 1;
    }
    return Object.values(buckets);
  }, [events, days]);

  // ---------------- Derived: Result mix ----------------
  const resultMix = useMemo(() => {
    const counts = {};
    for (const e of events) {
      counts[e.result] = (counts[e.result] || 0) + 1;
    }
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [events]);

  // ---------------- Derived: Geography ----------------
  const geography = useMemo(() => {
    const counts = {};
    for (const e of events) {
      const key = e.locationState || e.locationCity || 'Unknown';
      counts[key] = (counts[key] || 0) + 1;
    }
    return Object.entries(counts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 12);
  }, [events]);

  // ---------------- Derived: Top risky units ----------------
  const riskyUnits = useMemo(() => {
    const byUnit = {};
    for (const e of events) {
      if (!e.unitId) continue;
      if (!byUnit[e.unitId]) {
        byUnit[e.unitId] = {
          unitId: e.unitId,
          suspicious: 0,
          duplicate: 0,   // 🆕
          invalid: 0,
          impossible: 0,
          total: 0,
          maxRisk: 0,
        };
      }
      byUnit[e.unitId].total += 1;
      if (e.result === 'SUSPICIOUS') byUnit[e.unitId].suspicious += 1;
      if (e.result === 'DUPLICATE_CODE') byUnit[e.unitId].duplicate += 1;   // 🆕
      if (e.result === 'INVALID') byUnit[e.unitId].invalid += 1;
      if (e.isPhysicallyImpossible) byUnit[e.unitId].impossible += 1;
      if ((e.riskScore || 0) > byUnit[e.unitId].maxRisk) {
        byUnit[e.unitId].maxRisk = e.riskScore || 0;
      }
    }
    return Object.values(byUnit)
      .filter(
        (u) => u.suspicious + u.invalid + u.impossible + u.duplicate > 0   // 🆕
      )
      .sort(
        (a, b) =>
          // 🆕 duplicates weighted most heavily, then impossible, then suspicious
          b.duplicate * 1000 + b.impossible * 100 + b.suspicious * 10 -
          (a.duplicate * 1000 + a.impossible * 100 + a.suspicious * 10)
      )
      .slice(0, 15);
  }, [events]);

  // ---------------- Derived: Top sellers (masked) ----------------
  const topSellers = useMemo(() => {
    const counts = {};
    for (const e of events) {
      if (!e.scanningSellerId) continue;
      counts[e.scanningSellerId] = (counts[e.scanningSellerId] || 0) + 1;
    }
    return Object.entries(counts)
      .map(([id, value]) => ({ id, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);
  }, [events]);

  // ---------------- Derived: Suspicious feed ----------------
  const suspiciousFeed = useMemo(() => {
    return events
      .filter(
        (e) =>
          e.result === 'SUSPICIOUS' ||
          e.result === 'DUPLICATE_CODE' ||   // 🆕
          e.result === 'INVALID' ||
          e.isPhysicallyImpossible
      )
      .sort((a, b) => (b.timestamp || '').localeCompare(a.timestamp || ''))
      .slice(0, 25);
  }, [events]);

  // ---------------- Drilldown events ----------------
  const drilldownEvents = useMemo(() => {
    if (!drilldown) return [];
    const { type, value } = drilldown;
    if (type === 'result') {
      return events.filter((e) => e.result === value);
    }
    if (type === 'day') {
      return events.filter((e) => e.timestamp?.startsWith(value));
    }
    if (type === 'state') {
      return events.filter(
        (e) => (e.locationState || e.locationCity || 'Unknown') === value
      );
    }
    if (type === 'unit') {
      return events.filter((e) => e.unitId === value);
    }
    return [];
  }, [drilldown, events]);

  // ============================================================
  // RENDER
  // ============================================================

  return (
    <div className="admin-analytics-page">
      <header className="admin-page-head">
        <div>
          <h1>Scan Analytics</h1>
          <p>
            Real-time and historical view of every scan across the Konfa network.
            Click any chart element to drill down.
          </p>
        </div>
        <div className="admin-range-picker">
          {[7, 14, 30, 90].map((d) => (
            <button
              key={d}
              className={`admin-range-btn ${days === d ? 'active' : ''}`}
              onClick={() => setDays(d)}
            >
              {d}d
            </button>
          ))}
        </div>
      </header>

      {loading && <p className="admin-muted">Loading analytics…</p>}
      {error && <div className="admin-error-box">{error}</div>}

      {!loading && !error && (
        <>
          {/* ---------------- KPI GRID ---------------- */}
          <div className="admin-kpi-grid">
            <KpiTile
              label="Total scans"
              value={kpis.total}
              sub={`${kpis.uniqueUnits} unique units`}
              tone="navy"
            />
            <KpiTile
              label="Authentic rate"
              value={`${kpis.authRate}%`}
              sub={`${kpis.authentic} authentic`}
              tone="green"
            />
            <KpiTile
              label="Suspicious rate"
              value={`${kpis.suspiciousRate}%`}
              sub={`${kpis.suspicious} flagged`}
              tone="amber"
            />
            {/* 🆕 Duplicate Code KPI — its own distinct, more severe category */}
            <KpiTile
              label="Duplicate code"
              value={kpis.duplicate}
              sub={`${kpis.duplicateRate}% · confirmed copies`}
              tone="red"
            />
            <KpiTile
              label="Impossible travel"
              value={kpis.impossibleTravel}
              sub="physical-location conflicts"
              tone="red"
            />
            <KpiTile
              label="Consumer reports"
              value={kpis.totalReports}
              sub={`in last ${days} days`}
              tone="purple"
            />
            <KpiTile
              label="Unique devices"
              value={kpis.uniqueDevices}
              sub="distinct scanners"
              tone="teal"
            />
          </div>

          {/* ---------------- TIME SERIES ---------------- */}
          <section className="admin-chart-card">
            <div className="admin-chart-head">
              <h2>Scan volume over time</h2>
              <span className="admin-chart-hint">
                Click a day to drill down
              </span>
            </div>
            <div style={{ width: '100%', height: 280 }}>
              <ResponsiveContainer>
                <LineChart
                  data={timeSeries}
                  onClick={(state) => {
                    const p = state?.activePayload?.[0]?.payload;
                    if (p) setDrilldown({ type: 'day', value: p.date });
                  }}
                >
                  <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Line
                    type="monotone"
                    dataKey="AUTHENTIC"
                    stroke={COLORS.green}
                    strokeWidth={2}
                    dot={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="SUSPICIOUS"
                    stroke={COLORS.amber}
                    strokeWidth={2}
                    dot={false}
                  />
                  {/* 🆕 Duplicate Code line — darkest red */}
                  <Line
                    type="monotone"
                    dataKey="DUPLICATE_CODE"
                    stroke={COLORS.darkRed}
                    strokeWidth={2}
                    dot={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="INVALID"
                    stroke={COLORS.red}
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </section>

          {/* ---------------- RESULT MIX + GEOGRAPHY ---------------- */}
          <div className="admin-two-col">
            <section className="admin-chart-card">
              <div className="admin-chart-head">
                <h2>Result mix</h2>
                <span className="admin-chart-hint">Click a slice</span>
              </div>
              <div style={{ width: '100%', height: 240 }}>
                <ResponsiveContainer>
                  <PieChart>
                    <Pie
                      data={resultMix}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={50}
                      outerRadius={80}
                      onClick={(d) =>
                        setDrilldown({ type: 'result', value: d.name })
                      }
                    >
                      {resultMix.map((entry) => (
                        <Cell
                          key={entry.name}
                          fill={RESULT_COLORS[entry.name] || COLORS.slate}
                          cursor="pointer"
                        />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </section>

            <section className="admin-chart-card">
              <div className="admin-chart-head">
                <h2>Top regions</h2>
                <span className="admin-chart-hint">Click a bar</span>
              </div>
              <div style={{ width: '100%', height: 240 }}>
                <ResponsiveContainer>
                  <BarChart data={geography} layout="vertical">
                    <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" />
                    <XAxis type="number" tick={{ fontSize: 11 }} />
                    <YAxis
                      type="category"
                      dataKey="name"
                      tick={{ fontSize: 11 }}
                      width={100}
                    />
                    <Tooltip />
                    <Bar
                      dataKey="value"
                      fill={COLORS.teal}
                      cursor="pointer"
                      onClick={(d) =>
                        setDrilldown({ type: 'state', value: d.name })
                      }
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </section>
          </div>

          {/* ---------------- RISKY UNITS ---------------- */}
          <section className="admin-chart-card">
            <div className="admin-chart-head">
              <h2>Highest-risk units</h2>
              <span className="admin-chart-hint">
                Click a row to see every scan of that unit
              </span>
            </div>

            {riskyUnits.length === 0 && (
              <p className="admin-muted">No flagged units in this window.</p>
            )}

            {riskyUnits.length > 0 && (
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Unit</th>
                    <th>Scans</th>
                    <th>Duplicate</th>
                    <th>Suspicious</th>
                    <th>Invalid</th>
                    <th>Impossible travel</th>
                    <th>Max risk score</th>
                  </tr>
                </thead>
                <tbody>
                  {riskyUnits.map((u) => (
                    <tr
                      key={u.unitId}
                      onClick={() =>
                        setDrilldown({ type: 'unit', value: u.unitId })
                      }
                      className="admin-table-row-clickable"
                    >
                      <td><strong>{u.unitId}</strong></td>
                      <td>{u.total}</td>
                      {/* 🆕 Duplicate column — shown first after Scans */}
                      <td>
                        {u.duplicate > 0 ? (
                          <span className="admin-pill admin-pill-red">
                            {u.duplicate}
                          </span>
                        ) : (
                          <span className="admin-muted">0</span>
                        )}
                      </td>
                      <td>
                        <span className="admin-pill admin-pill-amber">
                          {u.suspicious}
                        </span>
                      </td>
                      <td>
                        <span className="admin-pill admin-pill-red">
                          {u.invalid}
                        </span>
                      </td>
                      <td>
                        <span className="admin-pill admin-pill-purple">
                          {u.impossible}
                        </span>
                      </td>
                      <td>
                        <span className="admin-pill admin-pill-navy">
                          {u.maxRisk}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>

          {/* ---------------- SUSPICIOUS FEED ---------------- */}
          <section className="admin-chart-card">
            <div className="admin-chart-head">
              <h2>Live suspicious feed</h2>
              <span className="admin-chart-hint">
                The 25 most recent flagged scans
              </span>
            </div>

            {suspiciousFeed.length === 0 && (
              <p className="admin-muted">No flagged scans in this window.</p>
            )}

            {suspiciousFeed.length > 0 && (
              <ul className="admin-feed">
                {suspiciousFeed.map((e) => (
                  <li
                    key={e.id}
                    className="admin-feed-item"
                    onClick={() =>
                      e.unitId &&
                      setDrilldown({ type: 'unit', value: e.unitId })
                    }
                  >
                    <span
                      className={`admin-feed-dot admin-feed-dot-${
                        e.result === 'DUPLICATE_CODE'   // 🆕 duplicates get dark red
                          ? 'red'
                          : e.result === 'SUSPICIOUS'
                          ? 'amber'
                          : e.result === 'INVALID'
                          ? 'red'
                          : 'purple'
                      }`}
                    />
                    <div className="admin-feed-body">
                      <strong>
                        {e.result === 'DUPLICATE_CODE'   // 🆕
                          ? 'Duplicate code detected'
                          : e.result === 'SUSPICIOUS'
                          ? 'Suspicious scan'
                          : e.result === 'INVALID'
                          ? 'Invalid attempt'
                          : 'Physical impossibility'}
                      </strong>
                      <span>
                        Unit {e.unitId} · {e.locationRegion || 'Unknown'} ·{' '}
                        {formatTime(e.timestamp)}
                      </span>
                    </div>
                    {e.riskScore != null && (
                      <span className="admin-pill admin-pill-navy">
                        risk {e.riskScore}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* ---------------- DRILLDOWN ---------------- */}
          {drilldown && (
            <section className="admin-chart-card admin-drilldown">
              <div className="admin-chart-head">
                <h2>
                  Drilldown · {labelForDrilldown(drilldown)} ({drilldownEvents.length})
                </h2>
                <button
                  className="admin-btn admin-btn-ghost"
                  onClick={() => setDrilldown(null)}
                >
                  Close
                </button>
              </div>

              {drilldownEvents.length === 0 && (
                <p className="admin-muted">No events found.</p>
              )}

              {drilldownEvents.length > 0 && (
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Time</th>
                      <th>Unit</th>
                      <th>Result</th>
                      <th>Region</th>
                      <th>Risk</th>
                      <th>Device</th>
                    </tr>
                  </thead>
                  <tbody>
                    {drilldownEvents.slice(0, 100).map((e) => (
                      <tr key={e.id}>
                        <td>{formatTime(e.timestamp)}</td>
                        <td>{e.unitId || '—'}</td>
                        <td>
                          <span
                            className={`admin-pill admin-pill-${resultTone(e.result)}`}
                          >
                            {prettifyResultLabel(e.result)}
                          </span>
                        </td>
                        <td>{e.locationRegion || '—'}</td>
                        <td>{e.riskScore ?? '—'}</td>
                        <td className="admin-table-clip">
                          {e.devicePlatform || '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </section>
          )}
        </>
      )}
    </div>
  );
};

export default ScanAnalytics;

// ============================================================
// SMALL COMPONENTS
// ============================================================

const KpiTile = ({ label, value, sub, tone }) => (
  <div className={`admin-kpi admin-kpi-${tone}`}>
    <span className="admin-kpi-label">{label}</span>
    <span className="admin-kpi-value">{value}</span>
    <span className="admin-kpi-sub">{sub}</span>
  </div>
);

// ============================================================
// HELPERS
// ============================================================

function labelForDrilldown(d) {
  if (d.type === 'result') return `Result = ${prettifyResultLabel(d.value)}`;
  if (d.type === 'day') return `Day = ${d.value}`;
  if (d.type === 'state') return `Region = ${d.value}`;
  if (d.type === 'unit') return `Unit = ${d.value}`;
  return 'Filter';
}

function resultTone(result) {
  if (result === 'AUTHENTIC') return 'green';
  if (result === 'SUSPICIOUS') return 'amber';
  if (result === 'DUPLICATE_CODE') return 'red';   // 🆕
  if (result === 'INVALID') return 'red';
  if (result === 'NOT_YET_RELEASED') return 'purple';
  return 'navy';
}

// 🆕 Human-readable label for the raw result value
function prettifyResultLabel(result) {
  if (!result) return '—';
  if (result === 'DUPLICATE_CODE') return 'Duplicate Code';
  if (result === 'NOT_YET_RELEASED') return 'Not Released';
  if (result === 'AUTHENTIC') return 'Authentic';
  if (result === 'SUSPICIOUS') return 'Suspicious';
  if (result === 'INVALID') return 'Invalid';
  if (result === 'EXPECTED') return 'Expected';
  return result;
}

function formatTime(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString([], {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}