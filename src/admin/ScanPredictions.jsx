// src/admin/ScanPredictions.jsx
import { useEffect, useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Cell,
} from 'recharts';
import {
  fetchScanEventsWindow,
  fetchAllUnits,
  fetchAllBatches,
} from './adminAuth';
import './AdminPortal.css';

const ScanPredictions = () => {
  const { admin } = useOutletContext();
  const [days, setDays] = useState(30);
  const [events, setEvents] = useState([]);
  const [units, setUnits] = useState([]);
  const [batches, setBatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedCluster, setSelectedCluster] = useState(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError('');
      try {
        const [ev, u, b] = await Promise.all([
          fetchScanEventsWindow(days),
          fetchAllUnits(),
          fetchAllBatches(),
        ]);
        setEvents(ev);
        setUnits(u);
        setBatches(b);
      } catch (err) {
        console.error(err);
        setError('Could not load prediction inputs.');
      } finally {
        setLoading(false);
      }
    })();
  }, [days]);

  // ---------------- Features: per-unit risk model ----------------
  const predictions = useMemo(() => {
    const byUnit = {};

    for (const e of events) {
      if (!e.unitId) continue;
      if (!byUnit[e.unitId]) {
        byUnit[e.unitId] = {
          unitId: e.unitId,
          deviceSet: new Set(),
          scanCount: 0,
          suspiciousCount: 0,
          invalidCount: 0,
          impossibleCount: 0,
          highRiskCount: 0,
          locations: new Set(),
          lastScan: null,
          firstScan: null,
          reasons: [],
        };
      }
      const u = byUnit[e.unitId];
      u.scanCount += 1;
      if (e.deviceUserAgent) u.deviceSet.add(e.deviceUserAgent);
      if (e.result === 'SUSPICIOUS') u.suspiciousCount += 1;
      if (e.result === 'INVALID') u.invalidCount += 1;
      if (e.isPhysicallyImpossible) u.impossibleCount += 1;
      if ((e.riskScore || 0) > 70) u.highRiskCount += 1;
      if (e.locationRegion) u.locations.add(e.locationRegion);

      if (!u.firstScan || e.timestamp < u.firstScan) u.firstScan = e.timestamp;
      if (!u.lastScan || e.timestamp > u.lastScan) u.lastScan = e.timestamp;
    }

    const scored = Object.values(byUnit).map((u) => {
      // ---- Feature weights (explainable, deterministic) ----
      let score = 0;
      const reasons = [];

      if (u.impossibleCount > 0) {
        score += 45 + Math.min(20, u.impossibleCount * 5);
        reasons.push(`${u.impossibleCount} physically impossible scan(s)`);
      }
      if (u.suspiciousCount >= 3) {
        score += 20;
        reasons.push(`${u.suspiciousCount} suspicious scans`);
      } else if (u.suspiciousCount > 0) {
        score += 10;
        reasons.push(`${u.suspiciousCount} suspicious scan(s)`);
      }
      if (u.invalidCount >= 3) {
        score += 15;
        reasons.push(`${u.invalidCount} invalid attempts`);
      }
      if (u.deviceSet.size >= 5) {
        score += 15;
        reasons.push(`${u.deviceSet.size} distinct devices`);
      } else if (u.deviceSet.size >= 3) {
        score += 8;
        reasons.push(`${u.deviceSet.size} distinct devices`);
      }
      if (u.locations.size >= 4) {
        score += 12;
        reasons.push(`${u.locations.size} distinct regions`);
      }
      if (u.scanCount >= 10) {
        score += 10;
        reasons.push(`${u.scanCount} total scans`);
      }

      return {
        ...u,
        deviceCount: u.deviceSet.size,
        locationCount: u.locations.size,
        riskScore: Math.min(100, score),
        reasons,
      };
    });

    // Sort desc by score
    scored.sort((a, b) => b.riskScore - a.riskScore);
    return scored.filter((s) => s.riskScore > 0);
  }, [events]);

  // ---------------- Clusters ----------------
  const clusters = useMemo(() => {
    const c = {
      critical: [], // risk >= 80
      high: [],     // 60–79
      medium: [],   // 40–59
      low: [],      // 1–39
    };
    for (const p of predictions) {
      if (p.riskScore >= 80) c.critical.push(p);
      else if (p.riskScore >= 60) c.high.push(p);
      else if (p.riskScore >= 40) c.medium.push(p);
      else c.low.push(p);
    }
    return c;
  }, [predictions]);

  // ---------------- Batch aggregation ----------------
  const riskyBatches = useMemo(() => {
    const byBatch = {};
    for (const p of predictions) {
      const unit = units.find((u) => u.id === p.unitId);
      const batchId = unit?.batchId;
      if (!batchId) continue;
      if (!byBatch[batchId]) {
        byBatch[batchId] = {
          batchId,
          riskyCount: 0,
          criticalCount: 0,
          avgRisk: 0,
          unitCount: 0,
        };
      }
      const b = byBatch[batchId];
      b.unitCount += 1;
      b.avgRisk += p.riskScore;
      if (p.riskScore >= 80) b.criticalCount += 1;
      b.riskyCount += 1;
    }
    return Object.values(byBatch)
      .map((b) => ({
        ...b,
        avgRisk: Math.round(b.avgRisk / Math.max(1, b.unitCount)),
      }))
      .sort((a, b) => b.criticalCount - a.criticalCount || b.avgRisk - a.avgRisk)
      .slice(0, 10);
  }, [predictions, units]);

  // ---------------- Chart data ----------------
  const clusterChartData = useMemo(
    () => [
      { name: 'Critical', value: clusters.critical.length, fill: '#dc2626' },
      { name: 'High', value: clusters.high.length, fill: '#d97706' },
      { name: 'Medium', value: clusters.medium.length, fill: '#0d9488' },
      { name: 'Low', value: clusters.low.length, fill: '#64748b' },
    ],
    [clusters]
  );

  return (
    <div className="admin-analytics-page">
      <header className="admin-page-head">
        <div>
          <h1>AI Predictions</h1>
          <p>
            Risk-scored units, clusters, and recommended actions.
            Click any cluster or unit to inspect why it was flagged.
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

      {loading && <p className="admin-muted">Loading predictions…</p>}
      {error && <div className="admin-error-box">{error}</div>}

      {!loading && !error && (
        <>
          {/* ---------------- CLUSTER SUMMARY ---------------- */}
          <div className="admin-cluster-grid">
            <ClusterCard
              tone="red"
              label="Critical"
              count={clusters.critical.length}
              onClick={() => setSelectedCluster('critical')}
              hint="Score 80+ · immediate action recommended"
            />
            <ClusterCard
              tone="amber"
              label="High risk"
              count={clusters.high.length}
              onClick={() => setSelectedCluster('high')}
              hint="Score 60–79 · review soon"
            />
            <ClusterCard
              tone="teal"
              label="Medium"
              count={clusters.medium.length}
              onClick={() => setSelectedCluster('medium')}
              hint="Score 40–59 · monitor"
            />
            <ClusterCard
              tone="slate"
              label="Low"
              count={clusters.low.length}
              onClick={() => setSelectedCluster('low')}
              hint="Score 1–39 · informational"
            />
          </div>

          {/* ---------------- CLUSTER CHART ---------------- */}
          <section className="admin-chart-card">
            <div className="admin-chart-head">
              <h2>Risk distribution</h2>
              <span className="admin-chart-hint">
                Units grouped by risk tier
              </span>
            </div>
            <div style={{ width: '100%', height: 220 }}>
              <ResponsiveContainer>
                <BarChart data={clusterChartData}>
                  <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar
                    dataKey="value"
                    onClick={(d) => setSelectedCluster(d.name.toLowerCase())}
                  >
                    {clusterChartData.map((row) => (
                      <Cell key={row.name} fill={row.fill} cursor="pointer" />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>

          {/* ---------------- BATCH HEATMAP ---------------- */}
          <section className="admin-chart-card">
            <div className="admin-chart-head">
              <h2>Batches with clustered risk</h2>
              <span className="admin-chart-hint">
                If one batch has many risky units, the whole run may be compromised
              </span>
            </div>

            {riskyBatches.length === 0 && (
              <p className="admin-muted">No risky batches detected.</p>
            )}

            {riskyBatches.length > 0 && (
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Batch</th>
                    <th>Risky units</th>
                    <th>Critical</th>
                    <th>Avg risk</th>
                  </tr>
                </thead>
                <tbody>
                  {riskyBatches.map((b) => (
                    <tr key={b.batchId}>
                      <td><strong>{b.batchId}</strong></td>
                      <td>{b.riskyCount}</td>
                      <td>
                        <span className="admin-pill admin-pill-red">
                          {b.criticalCount}
                        </span>
                      </td>
                      <td>{b.avgRisk}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>

          {/* ---------------- CLUSTER DRILLDOWN ---------------- */}
          {selectedCluster && (
            <section className="admin-chart-card">
              <div className="admin-chart-head">
                <h2>
                  {selectedCluster.charAt(0).toUpperCase() + selectedCluster.slice(1)} risk units ({clusters[selectedCluster]?.length || 0})
                </h2>
                <button
                  className="admin-btn admin-btn-ghost"
                  onClick={() => setSelectedCluster(null)}
                >
                  Close
                </button>
              </div>

              {clusters[selectedCluster]?.length === 0 && (
                <p className="admin-muted">No units in this tier.</p>
              )}

              {clusters[selectedCluster]?.length > 0 && (
                <ul className="admin-prediction-list">
                  {clusters[selectedCluster].map((p) => (
                    <li key={p.unitId} className="admin-prediction-item">
                      <div className="admin-prediction-head">
                        <strong>Unit {p.unitId}</strong>
                        <span
                          className={`admin-pill admin-pill-${
                            p.riskScore >= 80
                              ? 'red'
                              : p.riskScore >= 60
                              ? 'amber'
                              : p.riskScore >= 40
                              ? 'teal'
                              : 'navy'
                          }`}
                        >
                          Risk {p.riskScore}
                        </span>
                      </div>
                      <div className="admin-prediction-stats">
                        <Stat label="Scans" value={p.scanCount} />
                        <Stat label="Devices" value={p.deviceCount} />
                        <Stat label="Regions" value={p.locationCount} />
                        <Stat label="Suspicious" value={p.suspiciousCount} />
                        <Stat label="Invalid" value={p.invalidCount} />
                        <Stat label="Impossible" value={p.impossibleCount} />
                      </div>
                      {p.reasons.length > 0 && (
                        <ul className="admin-prediction-reasons">
                          {p.reasons.map((r, i) => (
                            <li key={i}>{r}</li>
                          ))}
                        </ul>
                      )}
                      <div className="admin-prediction-actions">
                        <button
                          className="admin-btn admin-btn-ghost"
                          onClick={() =>
                            (window.location.href = `/admin/scan-analytics?unit=${p.unitId}`)
                          }
                        >
                          View all scans
                        </button>
                        <button
                          className="admin-btn admin-btn-danger"
                          onClick={() =>
                            (window.location.href = `/admin/audit?unit=${p.unitId}`)
                          }
                        >
                          Mark for review
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}

          {/* ---------------- TOP 10 LIST ---------------- */}
          <section className="admin-chart-card">
            <div className="admin-chart-head">
              <h2>Top 10 highest-risk units</h2>
              <span className="admin-chart-hint">
                Highest priority for manual review
              </span>
            </div>

            {predictions.length === 0 && (
              <p className="admin-muted">No risky units in this window.</p>
            )}

            {predictions.length > 0 && (
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Unit</th>
                    <th>Risk</th>
                    <th>Scans</th>
                    <th>Devices</th>
                    <th>Regions</th>
                    <th>Primary reason</th>
                  </tr>
                </thead>
                <tbody>
                  {predictions.slice(0, 10).map((p) => (
                    <tr key={p.unitId} className="admin-table-row-clickable">
                      <td><strong>{p.unitId}</strong></td>
                      <td>
                        <span
                          className={`admin-pill admin-pill-${
                            p.riskScore >= 80 ? 'red' : p.riskScore >= 60 ? 'amber' : 'teal'
                          }`}
                        >
                          {p.riskScore}
                        </span>
                      </td>
                      <td>{p.scanCount}</td>
                      <td>{p.deviceCount}</td>
                      <td>{p.locationCount}</td>
                      <td className="admin-table-clip">
                        {p.reasons[0] || '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        </>
      )}
    </div>
  );
};

export default ScanPredictions;

// ============================================================
// SMALL COMPONENTS
// ============================================================

const ClusterCard = ({ tone, label, count, hint, onClick }) => (
  <button
    className={`admin-cluster-card admin-cluster-${tone}`}
    onClick={onClick}
  >
    <span className="admin-cluster-label">{label}</span>
    <span className="admin-cluster-count">{count}</span>
    <span className="admin-cluster-hint">{hint}</span>
  </button>
);

const Stat = ({ label, value }) => (
  <div className="admin-pred-stat">
    <span>{label}</span>
    <strong>{value}</strong>
  </div>
);