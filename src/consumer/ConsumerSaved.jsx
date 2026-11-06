// src/consumer/ConsumerSaved.jsx
import { useEffect, useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import { fetchSavedProducts, unsaveProduct } from './consumerAuth';
import './ConsumerPortal.css';

const ConsumerSaved = () => {
  const { consumer } = useOutletContext();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const list = await fetchSavedProducts(consumer.id, 200);
      setItems(list);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [consumer.id]);

  const handleRemove = async (item) => {
    if (!window.confirm(`Remove "${item.productName || item.referenceCode}" from saved?`)) {
      return;
    }
    setActing(item.id);
    try {
      await unsaveProduct(consumer.id, item.id);
      await load();
    } finally {
      setActing(null);
    }
  };

  return (
    <div className="cp-page">
      <header className="cp-page-header">
        <div>
          <h1>Saved Products</h1>
          <p>Products you've bookmarked for quick reference.</p>
        </div>
      </header>

      {loading ? (
        <div className="cp-loading">Loading saved products…</div>
      ) : items.length === 0 ? (
        <div className="cp-empty">
          <p>You haven't saved any products yet.</p>
          <p className="cp-empty-hint">
            When you verify a product, tap "Save" to bookmark it here.
          </p>
        </div>
      ) : (
        <div className="cp-card-table">
          <table className="cp-table">
            <thead>
              <tr>
                <th>Product</th>
                <th>Reference</th>
                <th>Note</th>
                <th className="cp-th-right">Saved</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className="cp-tr">
                  <td>
                    <div className="cp-td-product">
                      <strong>{item.productName || '—'}</strong>
                      {item.batchCode && <small>{item.batchCode}</small>}
                    </div>
                  </td>
                  <td>
                    <code className="cp-code-small">
                      {item.referenceCode || '—'}
                    </code>
                  </td>
                  <td>{item.note || '—'}</td>
                  <td className="cp-td-date">
                    {formatDate(item.savedAt)}
                  </td>
                  <td className="cp-td-actions">
                    <button
                      type="button"
                      className="cp-btn cp-btn-sm cp-btn-danger"
                      onClick={() => handleRemove(item)}
                      disabled={acting === item.id}
                    >
                      {acting === item.id ? '…' : 'Remove'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="cp-page-footer-cta">
        <Link to="/verify" className="cp-btn cp-btn-primary">
          + Verify another product
        </Link>
      </div>
    </div>
  );
};

function formatDate(ts) {
  if (!ts) return '—';
  try {
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleDateString([], {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return '—';
  }
}

export default ConsumerSaved;