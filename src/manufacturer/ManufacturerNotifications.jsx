// src/manufacturer/ManufacturerNotifications.jsx
import { useEffect, useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import {
  fetchMyNotifications,
  markNotificationRead,
  markAllMyNotificationsRead,
} from './manufacturerAuth';
import './ManufacturerPortal.css';

const ManufacturerNotifications = () => {
  const { staff } = useOutletContext();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const list = await fetchMyNotifications(staff.id, 100);
      setNotifications(list);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [staff.id]);

  const handleMarkRead = async (n) => {
    if (n.read) return;
    await markNotificationRead(n.id);
    setNotifications((list) =>
      list.map((item) =>
        item.id === n.id ? { ...item, read: true } : item
      )
    );
  };

  const handleMarkAllRead = async () => {
    await markAllMyNotificationsRead(staff.id);
    setNotifications((list) => list.map((n) => ({ ...n, read: true })));
  };

  const unread = notifications.filter((n) => !n.read).length;

  if (loading) return <div className="mf-loading">Loading notifications…</div>;

  return (
    <div className="mf-page">
      <header className="mf-page-header">
        <div>
          <h1>Notifications</h1>
          <p>
            {unread > 0
              ? `You have ${unread} unread notification${unread > 1 ? 's' : ''}`
              : 'All caught up'}
          </p>
        </div>
        {unread > 0 && (
          <button className="mf-btn mf-btn-outline" onClick={handleMarkAllRead}>
            Mark all as read
          </button>
        )}
      </header>

      {notifications.length === 0 ? (
        <div className="mf-empty">
          <div className="mf-empty-icon">🔔</div>
          <p>No notifications yet.</p>
        </div>
      ) : (
        <ul className="mf-notif-list">
          {notifications.map((n) => (
            <li
              key={n.id}
              className={`mf-notif-item ${n.read ? 'read' : 'unread'}`}
              onClick={() => handleMarkRead(n)}
            >
              <div className="mf-notif-dot" />
              <div className="mf-notif-body">
                <strong>{n.subject}</strong>
                <p>{n.body}</p>
                <div className="mf-notif-meta">
                  <span>
                    {n.createdAt?.toDate?.()?.toLocaleString?.() || 'Just now'}
                  </span>
                  {n.batchId && (
                    <Link
                      to={`/manufacturer/batches/${n.batchId}`}
                      className="mf-notif-link"
                      onClick={(e) => e.stopPropagation()}
                    >
                      View batch →
                    </Link>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default ManufacturerNotifications;