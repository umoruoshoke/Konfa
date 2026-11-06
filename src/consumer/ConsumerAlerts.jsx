// src/consumer/ConsumerAlerts.jsx
import { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { fetchConsumerAlerts, markAlertRead } from './consumerAuth';
import './ConsumerPortal.css';

const ConsumerAlerts = () => {
  const { consumer } = useOutletContext();
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const list = await fetchConsumerAlerts(consumer.id, 200);
      setAlerts(list);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [consumer.id]);

  const handleMarkRead = async (alert) => {
    if (alert.read) return;
    await markAlertRead(alert.id);
    setAlerts((list) =>
      list.map((a) => (a.id === alert.id ? { ...a, read: true } : a))
    );
  };

  const unreadCount = alerts.filter((a) => !a.read).length;

  return (
    <div className="cp-page">
      <header className="cp-page-header">
        <div>
          <h1>Alerts</h1>
          <p>
            {unreadCount > 0
              ? `You have ${unreadCount} unread alert${unreadCount === 1 ? '' : 's'}.`
              : 'You have no unread alerts.'}
          </p>
        </div>
      </header>

      {loading ? (
        <div className="cp-loading">Loading alerts…</div>
      ) : alerts.length === 0 ? (
        <div className="cp-empty">
          <p>No alerts yet.</p>
          <p className="cp-empty-hint">
            We'll notify you if a product you saved is flagged or if we detect
            suspicious activity.
          </p>
        </div>
      ) : (
        <ul className="cp-alerts-list">
          {alerts.map((alert) => (
            <li
              key={alert.id}
              className={`cp-alert-row ${alert.read ? 'read' : 'unread'}`}
              onClick={() => handleMarkRead(alert)}
            >
              <div className="cp-alert-row-icon">!</div>
              <div className="cp-alert-row-body">
                <div className="cp-alert-row-title">
                  <strong>{alert.title || 'Notification'}</strong>
                  {!alert.read && <span className="cp-unread-dot" />}
                </div>
                <p>{alert.message}</p>
                <small>{formatDateTime(alert.createdAt)}</small>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

function formatDateTime(ts) {
  if (!ts) return '';
  try {
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleString([], {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
}

export default ConsumerAlerts;