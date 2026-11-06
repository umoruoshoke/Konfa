// src/admin/AdminScanPredictions.jsx
import { useEffect, useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  LineChart,
  Line,
  Cell,
} from 'recharts';
import {
  fetchAllScans,
  filterByRange,
  RANGE_OPTIONS,
  buildTopCities,
  buildSummaryStats,
} from './scanAnalytics';
import {
  predictHotspots,
  buildSummaryText,
  buildRecommendations,
} from './scanPredictions';
import { exportComplianceReport } from './scanExport';
import './AdminScanAnalytics.css';

const AdminScanPredictions = () => {
  const { admin } = useOutletContext();

  const [scans, setScans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [range, setRange] = useState('30d');

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const list = await fetchAllScans({ max: 5000 });
        setScans(list);
      } catch (err) {
        console.error(err);
        setError('Could not load scan data.');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const rangeScans = useMemo(() => filterByRange(scans, range), [scans, range]);

  const prediction = useMemo(
    () => (rangeScans.length ? predictHotspots(rangeScans) : null),
    [rangeScans]
  );

  const summaryText = useMemo(
    () => (prediction ? buildSummaryText(prediction) : ''),
    [prediction]
  );

  const recommendations = useMemo(
    () => (prediction ? buildRecommendations(prediction) : []),
    [prediction]
  );

  const cityChartData = useMemo(() => {
    if (!prediction) return [];
    return prediction.cityPredictions.slice(0, 8).map((c) => ({
      city: c.city,
      risk: c.riskScore,
      baseline: Math.round(c.baseline * 7 * 10) / 10,
      predicted: c.totalPredicted,
      today: c.todayCount,
      zScore: c.zScore,
    }));
  }, [prediction]);

  const hourlyChartData = useMemo(() => {
    if (!prediction) return [];
    return prediction.hourlyHeatmap.map((h) => ({
      hour: h.label,
      suspicious: h.suspicious,
      risk: h.riskPct,
    }));
  }, [prediction]);

  const handleExportCompliance = () => {
    if (!prediction) return;
    const rangeLabel =
      RANGE_OPTIONS.find((r) => r.key === range)?.label || range;
    exportComplianceReport({
      scans: rangeScans,
      prediction,
      summary: buildSummaryStats(rangeScans),
      cityBreakdown: buildTopCities(rangeScans, 50),
      rangeLabel,
    });
  };

  if (loading) {
    return (
      <div className="admin-page">
        <header className="admin-page-header">
          <div>
            <h1>AI Predictions</h1>
            <p>Loading predictive model…</p>
          </div>
        </header>
        <div className="admin-stat-grid">
          {[1, 2, 3, 4].map((i) => (
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
          <h1>AI Predictions</h1>
          <p>
            Statistical forecast of counterfeit hotspots for the next 7 days.
            Every number is derivable from your scan history.
          </p>
        </div>
        <div className="admin-header-actions">
          <button
            type="button"
            className="admin-btn admin-btn-primary"
            onClick={handleExportCompliance}
            disabled={!prediction}
          >
            ⤓ Compliance Report
          </button>
        </div>
      </header>

      {error && <div className="admin-error">{error}</div>}

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
        {prediction && (
          <div className="admin-scan-confidence">
            Model confidence:{' '}
            <strong
              className={
                prediction.confidence >= 0.7
                  ? 'admin-scan-conf-high'
                  : prediction.confidence >= 0.5
                  ? 'admin-scan-conf-mid'
                  : 'admin-scan-conf-low'
              }
            >
              {Math.round(prediction.confidence * 100)}%
            </strong>
          </div>
        )}
      </div>

      {!prediction || prediction.cityPredictions.length === 0 ? (
        <div className="admin-empty">
          <div className="admin-empty-icon">📊</div>
          <p>
            Not enough scan data yet to make predictions. Once you have a few
            scans across several days and multiple cities, the model will
            produce a forecast here.
          </p>
        </div>
      ) : (
        <>
          {/* Global prediction stats */}
          <div className="admin-stat-grid">
            <StatCard
              label="Predicted suspicious (7d)"
              value={prediction.global.predictedSuspicious}
              accent="amber"
            />
            <StatCard
              label="Baseline (7d)"
              value={prediction.global.baselineSuspicious}
              accent="navy"
            />
            <StatCard
              label="Lift"
              value={`${prediction.global.liftPct >= 0 ? '+' : ''}${prediction.global.liftPct}%`}
              accent={prediction.global.liftPct >= 0 ? 'red' : 'green'}
            />
            <StatCard
              label="Cities analysed"
              value={prediction.cityPredictions.length}
              accent="teal"
            />
          </div>

          {/* Confidence breakdown */}
          <section className="admin-scan-card">
            <div className="admin-scan-card-header">
              <h2>Confidence breakdown</h2>
              <p>Why the model is {Math.round(prediction.confidence * 100)}% confident</p>
            </div>
            <div className="admin-scan-confidence-grid">
              <ConfidenceBar
                label="Sample size"
                value={prediction.confidenceBreakdown.sampleSize}
                description={`${prediction.dataSummary.totalScansInWindow} scans`}
              />
              <ConfidenceBar
                label="Data span"
                value={prediction.confidenceBreakdown.dataSpan}
                description={`${prediction.dataSummary.daysWithData} days with data`}
              />
              <ConfidenceBar
                label="Trend strength"
                value={prediction.confidenceBreakdown.trendStrength}
                description="R² of top cities"
              />
              <ConfidenceBar
                label="Recency"
                value={prediction.confidenceBreakdown.recency}
                description={`${prediction.dataSummary.recentScans} scans in last 7d`}
              />
              <ConfidenceBar
                label="City diversity"
                value={prediction.confidenceBreakdown.cityDiversity}
                description={`${prediction.dataSummary.citiesAnalysed} cities`}
              />
            </div>
          </section>

          {/* Recommendations */}
          {recommendations.length > 0 && (
            <section className="admin-scan-card">
              <div className="admin-scan-card-header">
                <h2>Recommendations for regulators</h2>
                <p>Derived from the current forecast</p>
              </div>
              <div className="admin-scan-recs">
                {recommendations.map((r, i) => (
                  <div key={i} className={`admin-scan-rec admin-scan-rec-${r.level}`}>
                    <div className="admin-scan-rec-icon">
                      {r.level === 'critical' ? '!' : r.level === 'warning' ? '⚠' : 'i'}
                    </div>
                    <div className="admin-scan-rec-body">
                      <strong>{r.title}</strong>
                      <p>{r.body}</p>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Summary text */}
          <section className="admin-scan-card">
            <div className="admin-scan-card-header">
              <h2>Prediction summary</h2>
              <p>Human-readable interpretation of the model output</p>
            </div>
            <pre className="admin-scan-summary">{summaryText}</pre>
          </section>

          {/* Risk by city chart */}
          <section className="admin-scan-card">
            <div className="admin-scan-card-header">
              <h2>Risk score by city</h2>
              <p>0 = safe, 100 = critical hotspot (next 7 days)</p>
            </div>
            <div className="admin-scan-chart">
              <ResponsiveContainer width="100%" height={320}>
                <BarChart data={cityChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="city" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} domain={[0, 100]} />
                  <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                  <Bar dataKey="risk" name="Risk score">
                    {cityChartData.map((entry, i) => (
                      <Cell
                        key={i}
                        fill={
                          entry.risk >= 70
                            ? '#dc2626'
                            : entry.risk >= 40
                            ? '#d97706'
                            : '#16a34a'
                        }
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>

          {/* Hourly risk */}
          <section className="admin-scan-card">
            <div className="admin-scan-card-header">
              <h2>Hourly risk windows</h2>
              <p>Which hours of the day carry the highest counterfeit risk</p>
            </div>
            <div className="admin-scan-chart">
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={hourlyChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="hour" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="suspicious" name="Suspicious" fill="#dc2626" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="risk" name="Risk %" fill="#d97706" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>

          {/* Baseline vs predicted */}
          <section className="admin-scan-card">
            <div className="admin-scan-card-header">
              <h2>Baseline vs predicted (7-day totals)</h2>
              <p>How much each city is expected to change</p>
            </div>
            <div className="admin-scan-chart">
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={cityChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="city" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Line type="monotone" dataKey="baseline" name="Baseline (7d)" stroke="#64748b" strokeWidth={2} dot />
                  <Line type="monotone" dataKey="predicted" name="Predicted (7d)" stroke="#dc2626" strokeWidth={2} dot />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </section>

          {/* Detailed table */}
          <section className="admin-card admin-scan-table-card">
            <div className="admin-card-header">
              <div>
                <h2>City-by-city forecast</h2>
                <p>Sorted by risk score, highest first</p>
              </div>
            </div>
            <div className="admin-card-table">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>City</th>
                    <th>State</th>
                    <th>Risk</th>
                    <th>Verdict</th>
                    <th>Today</th>
                    <th>Baseline/day</th>
                    <th>Predicted (7d)</th>
                    <th>Change</th>
                    <th>Z-score</th>
                  </tr>
                </thead>
                <tbody>
                  {prediction.cityPredictions.map((c) => (
                    <tr key={c.city} className="admin-tr">
                      <td className="admin-cell-strong">{c.city}</td>
                      <td>{c.state || '—'}</td>
                      <td>
                        <span
                          className={`admin-pill ${
                            c.riskScore >= 70
                              ? 'admin-pill-rejected'
                              : c.riskScore >= 40
                              ? 'admin-pill-pending'
                              : 'admin-pill-approved'
                          }`}
                        >
                          {c.riskScore}/100
                        </span>
                      </td>
                      <td>{c.verdict}</td>
                      <td>{c.todayCount}</td>
                      <td>{Math.round(c.baseline * 10) / 10}</td>
                      <td>{c.totalPredicted}</td>
                      <td className={c.pctChange > 0 ? 'admin-cell-warn' : ''}>
                        {c.pctChange >= 0 ? '+' : ''}
                        {c.pctChange}%
                      </td>
                      <td>{c.zScore}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* Methodology */}
          <section className="admin-scan-card admin-scan-method">
            <div className="admin-scan-card-header">
              <h2>Model methodology</h2>
              <p>For regulators who need to understand the forecast</p>
            </div>
            <div className="admin-scan-method-body">
              <h3>Signals used</h3>
              <ul>
                <li>
                  <strong>Linear trend</strong> — 21 days of per-city suspicious
                  counts, fit to a straight line, extrapolated 7 days forward.
                </li>
                <li>
                  <strong>Weekday seasonality</strong> — which days of the week
                  produce more suspicious scans.
                </li>
                <li>
                  <strong>Hourly windows</strong> — 2-hour blocks ranked by
                  flagged-scan rate.
                </li>
                <li>
                  <strong>Z-score anomaly</strong> — how far today's count
                  deviates from the city's own recent baseline. A z-score above
                  2 is unusual; above 3 is critical.
                </li>
              </ul>

              <h3>Confidence</h3>
              <p>
                Not derived from R² alone (which is near zero for sparse data).
                We combine five signals — sample size, data span, trend
                strength, recency, and city diversity — into a single score
                between 20% and 95%.
              </p>

              <h3>Risk score</h3>
              <p>
                0–100, weighted: 60% on the predicted trend vs baseline, 40% on
                the current z-score.
              </p>

              <h3>Limitations</h3>
              <ul>
                <li>The model reacts to history. It cannot predict a brand-new counterfeiting operation in a city that has never seen one.</li>
                <li>Requires at least a few scans per city per day to be reliable.</li>
                <li>Weekly patterns (Fri/Sat) are captured, but holiday effects are not.</li>
              </ul>
            </div>
          </section>
        </>
      )}
    </div>
  );
};

const StatCard = ({ label, value, accent }) => (
  <div className={`admin-stat-card admin-stat-${accent}`}>
    <span className="admin-stat-label">{label}</span>
    <span className="admin-stat-value">{value ?? 0}</span>
  </div>
);

const ConfidenceBar = ({ label, value, description }) => (
  <div className="admin-confidence-bar">
    <div className="admin-confidence-bar-head">
      <span>{label}</span>
      <strong>{value}%</strong>
    </div>
    <div className="admin-confidence-bar-track">
      <div
        className="admin-confidence-bar-fill"
        style={{
          width: `${value}%`,
          background:
            value >= 70 ? '#16a34a' : value >= 40 ? '#d97706' : '#dc2626',
        }}
      />
    </div>
    {description && <span className="admin-confidence-bar-desc">{description}</span>}
  </div>
);

export default AdminScanPredictions;