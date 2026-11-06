// src/manufacturer/ManufacturerShipments.jsx
import { useEffect, useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import {
  fetchManufacturerShipments,
  fetchManufacturerBatches,
  createShipment,
} from './manufacturerAuth';
import {
  collection,
  getDocs,
  query,
  where,
} from 'firebase/firestore';
import { db } from '../firebase';
import './ManufacturerPortal.css';

const ManufacturerShipments = () => {
  const { manufacturer, staff } = useOutletContext();
  const [shipments, setShipments] = useState([]);
  const [batches, setBatches] = useState([]);
  const [sellers, setSellers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);

  const [form, setForm] = useState({
    batchId: '',
    toSellerId: '',
    quantity: '',
    destinationLabel: '',
  });

  const load = async () => {
    const [ship, bat, selSnap] = await Promise.all([
      fetchManufacturerShipments(manufacturer.id),
      fetchManufacturerBatches(manufacturer.id),
      getDocs(
        query(collection(db, 'sellers'), where('status', '==', 'active'))
      ),
    ]);
    setShipments(ship);
    setBatches(bat);
    setSellers(selSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
  };

  useEffect(() => {
    (async () => {
      try {
        await load();
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [manufacturer.id]);

  const handleCreate = async (e) => {
    e.preventDefault();
    setCreating(true);
    try {
      await createShipment({
        manufacturerId: manufacturer.id,
        batchId: form.batchId,
        toSellerId: form.toSellerId,
        quantity: Number(form.quantity),
        destinationLabel: form.destinationLabel,
        staffId: staff.id,
        staffName: staff.fullName,
      });
      setShowCreate(false);
      setForm({
        batchId: '',
        toSellerId: '',
        quantity: '',
        destinationLabel: '',
      });
      await load();
    } finally {
      setCreating(false);
    }
  };

  if (loading) return <div className="mf-loading">Loading shipments…</div>;

  return (
    <div className="mf-page">
      <header className="mf-page-header">
        <div>
          <h1>Shipments</h1>
          <p>Create and track shipments to your distributors.</p>
        </div>
        <button
          className="mf-btn mf-btn-primary"
          onClick={() => setShowCreate((v) => !v)}
        >
          {showCreate ? 'Cancel' : '+ New Shipment'}
        </button>
      </header>

      {showCreate && (
        <form className="mf-form" onSubmit={handleCreate}>
          <div className="mf-form-grid">
            <div className="mf-field">
              <label>Batch *</label>
              <select
                value={form.batchId}
                onChange={(e) =>
                  setForm({ ...form, batchId: e.target.value })
                }
                required
              >
                <option value="">Select a batch…</option>
                {batches
                  .filter((b) => b.status === 'active')
                  .map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.batchCode} ({b.quantity} units)
                    </option>
                  ))}
              </select>
            </div>

            <div className="mf-field">
              <label>Recipient seller *</label>
              <select
                value={form.toSellerId}
                onChange={(e) =>
                  setForm({ ...form, toSellerId: e.target.value })
                }
                required
              >
                <option value="">Select a seller…</option>
                {sellers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.companyName}
                  </option>
                ))}
              </select>
            </div>

            <div className="mf-field">
              <label>Quantity *</label>
              <input
                type="number"
                min="1"
                value={form.quantity}
                onChange={(e) =>
                  setForm({ ...form, quantity: e.target.value })
                }
                placeholder="e.g. 200"
                required
              />
            </div>

            <div className="mf-field">
              <label>Destination *</label>
              <input
                type="text"
                value={form.destinationLabel}
                onChange={(e) =>
                  setForm({ ...form, destinationLabel: e.target.value })
                }
                placeholder="e.g. Abuja Warehouse"
                required
              />
            </div>
          </div>

          <button
            type="submit"
            className="mf-btn mf-btn-primary"
            disabled={creating}
          >
            {creating ? 'Creating…' : 'Dispatch Shipment'}
          </button>
        </form>
      )}

      {shipments.length === 0 ? (
        <div className="mf-empty">
          <p>No shipments yet.</p>
        </div>
      ) : (
        <div className="mf-table">
          <div className="mf-table-head">
            <span>Shipment</span>
            <span>To Seller</span>
            <span>Quantity</span>
            <span>Status</span>
            <span></span>
          </div>
          {shipments.map((s) => (
            <div key={s.id} className="mf-table-row">
              <span className="mf-cell-strong">
                {s.batchId?.slice(-8) || s.id.slice(-8)}
              </span>
              <span>{s.toSellerId}</span>
              <span>{s.quantity}</span>
              <span className={`mf-pill mf-pill-${s.status}`}>
                {s.status}
              </span>
              <Link
                to={`/manufacturer/shipments/${s.id}`}
                className="mf-btn mf-btn-small"
              >
                Open
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ManufacturerShipments;