// src/seller/SellerHome.jsx
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  fetchInboundShipments,
  fetchInboundTransfers,
  fetchRecentSellerActivity,
} from './sellerAuth';
import './SellerPortal.css';

const SellerHome = ({ seller }) => {
  const [inbound, setInbound] = useState([]);
  const [transfers, setTransfers] = useState([]);
  const [activity, setActivity] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!seller?.id) return;
    (async () => {
      try {
        const [ships, tfs, acts] = await Promise.all([
          fetchInboundShipments(seller.id),
          fetchInboundTransfers(seller.id),
          fetchRecentSellerActivity(seller.id, 5),
        ]);
        setInbound(ships);
        setTransfers(tfs);
        setActivity(acts);
      } catch (err) {
        console.error('Dashboard load error:', err);
      } finally {
        setLoading(false);
      }
    })();
  }, [seller?.id]);

  const pendingShipmentCount = inbound.length;
  const pendingTransferCount = transfers.length;

  return (
    <div className="seller-home">
      <div className="seller-welcome">
        <h1>Hello, {seller.companyName?.split(' ')[0] || 'Seller'} 👋</h1>
        <p>Here's what needs your attention today.</p>
      </div>

      {/* Two stat tiles */}
      <div className="seller-stat-grid">
        <div className="seller-stat">
          <span className="seller-stat-label">Awaiting receipt</span>
          <span className="seller-stat-value">{pendingShipmentCount}</span>
        </div>
        <div className="seller-stat">
          <span className="seller-stat-label">Incoming transfers</span>
          <span className="seller-stat-value">{pendingTransferCount}</span>
        </div>
      </div>

      {pendingShipmentCount > 0 && (
        <Link to="/seller/receive" className="seller-alert">
          <div className="seller-alert-icon">!</div>
          <div className="seller-alert-body">
            <strong>
              {pendingShipmentCount} shipment
              {pendingShipmentCount > 1 ? 's' : ''} awaiting receipt
            </strong>
            <span>Tap to receive and scan units</span>
          </div>
          <span className="seller-alert-arrow">›</span>
        </Link>
      )}

      <section className="seller-section">
        <h2>Quick actions</h2>
        <div className="seller-quick-actions">
          <Link
            to="/seller/scan"
            className="seller-action seller-action-primary"
          >
            <span className="seller-action-icon">📷</span>
            <span>Scan a Product</span>
          </Link>
          <Link to="/seller/transfer" className="seller-action">
            <span className="seller-action-icon">↗</span>
            <span>Create a Transfer</span>
          </Link>
        </div>
      </section>

      <section className="seller-section">
        <h2>Recent activity</h2>
        {loading && <p className="seller-muted">Loading…</p>}
        {!loading && activity.length === 0 && (
          <p className="seller-muted">No recent activity yet.</p>
        )}
        <ul className="seller-activity-list">
          {activity.map((ev) => (
            <li key={ev.id} className="seller-activity-item">
              <div>
                <strong>{prettify(ev.result)}</strong>
                <span>Unit {ev.unitId}</span>
              </div>
              <span className="seller-activity-time">
                {formatTime(ev.timestamp)}
              </span>
            </li>
          ))}
        </ul>
      </section>

      {pendingTransferCount > 0 && (
        <section className="seller-section">
          <h2>Incoming transfers</h2>
          <ul className="seller-activity-list">
            {transfers.map((t) => (
              <li key={t.id} className="seller-activity-item">
                <div>
                  <strong>{t.quantity} units</strong>
                  <span>
                    From {t.fromSellerId} → {t.destinationLabel}
                  </span>
                </div>
                <span className="seller-pill seller-pill-amber">
                  {t.status}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
};

const prettify = (result) => {
  const map = {
    AUTHENTIC: 'Authentic scan',
    INVALID: 'Invalid scan',
    SUSPICIOUS: 'Suspicious scan',
    EXPECTED: 'Expected scan',
  };
  return map[result] || result || 'Scan';
};

const formatTime = (iso) => {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    return d.toLocaleString([], {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
};

export default SellerHome;