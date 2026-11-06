// src/seller/SellerReceive.jsx
import { useEffect, useState, useCallback } from 'react';
import {
  fetchInboundShipments,
  fetchShipment,
  fetchShipmentUnits,
  confirmReceiptBatch,
} from './sellerAuth';
import SellerReceiveScanModal from './SellerReceiveScanModal';
import './SellerPortal.css';

const SellerReceive = ({ seller }) => {
  const [shipments, setShipments] = useState([]);
  const [selected, setSelected] = useState(null);
  const [units, setUnits] = useState([]);
  const [received, setReceived] = useState(new Set()); // unit ids confirmed this session
  const [regionLabel, setRegionLabel] = useState(
    seller?.currentLocation || 'Warehouse'
  );
  const [loading, setLoading] = useState(true);
  const [opening, setOpening] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState('');
  const [scanOpen, setScanOpen] = useState(false);
  const [lastMessage, setLastMessage] = useState('');
  const [done, setDone] = useState(false);
  const [doneCount, setDoneCount] = useState(0);

  // ---- Load inbound shipments ----
  const loadShipments = useCallback(async () => {
    try {
      const list = await fetchInboundShipments(seller.id);
      setShipments(list);
    } catch (err) {
      console.error(err);
      setError('Could not load shipments.');
    }
  }, [seller.id]);

  useEffect(() => {
    (async () => {
      await loadShipments();
      setLoading(false);
    })();
  }, [loadShipments]);

  // ---- Open a shipment ----
  const openShipment = async (shipmentId) => {
    setError('');
    setLastMessage('');
    setOpening(true);
    try {
      const ship = await fetchShipment(shipmentId);
      if (!ship) throw new Error('Shipment not found.');
      const unitList = await fetchShipmentUnits(ship);
      setSelected(ship);
      setUnits(unitList);
      setReceived(new Set());
    } catch (err) {
      console.error(err);
      setError('Could not open this shipment.');
    } finally {
      setOpening(false);
    }
  };

  // ---- Modal success handler ----
  const handleScanSuccess = (result) => {
    setScanOpen(false);
    const unitId = result?.unit?.id;
    if (!unitId) return;

    setReceived((prev) => {
      const next = new Set(prev);
      next.add(unitId);
      return next;
    });
    setLastMessage(result?.message || `Received ${unitId}.`);
  };

  const handleScanFailure = (message) => {
    setScanOpen(false);
    setLastMessage(message || 'Scan was not accepted.');
  };

  // ---- Confirm all received units ----
  const handleConfirm = async () => {
    if (!selected || received.size === 0) return;
    setError('');
    setConfirming(true);
    try {
      const result = await confirmReceiptBatch({
        sellerId: seller.id,
        regionLabel,
        unitIds: Array.from(received),
        shipmentId: selected.id,
      });

      if (!result.ok) {
        setError(result.error || 'Could not confirm receipt.');
        return;
      }

      setDoneCount(result.count);
      setDone(true);
    } catch (err) {
      console.error(err);
      setError('Could not confirm receipt.');
    } finally {
      setConfirming(false);
    }
  };

  // ---- Reset ----
  const closeShipment = () => {
    setSelected(null);
    setUnits([]);
    setReceived(new Set());
    setDone(false);
    setDoneCount(0);
    setError('');
    setLastMessage('');
    loadShipments();
  };

  // ============================================================
  // RENDER
  // ============================================================

  if (loading) {
    return <p className="seller-muted">Loading shipments…</p>;
  }

  // ---------- Shipment list view ----------
  if (!selected) {
    return (
      <div className="seller-receive">
        <h1>Shipments</h1>
        <p className="seller-muted">Incoming shipments waiting to be received.</p>

        {error && <div className="seller-error">{error}</div>}

        {shipments.length === 0 && (
          <div className="seller-empty">
            <p>No shipments awaiting receipt.</p>
          </div>
        )}

        <ul className="seller-shipment-list">
          {shipments.map((s) => (
            <li key={s.id} className="seller-shipment-item">
              <div className="seller-shipment-main">
                <strong>Batch {s.batchId?.slice(0, 8) || '—'}</strong>
                <span>
                  {s.quantity} units · To {s.destinationLabel || 'Unknown'}
                </span>
                {s.createdByName && (
                  <span className="seller-shipment-meta">
                    From {s.createdByName}
                  </span>
                )}
              </div>
              <button
                className="seller-btn seller-btn-small"
                onClick={() => openShipment(s.id)}
                disabled={opening}
              >
                {opening ? '…' : 'Open'}
              </button>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  // ---------- Done view ----------
  if (done) {
    return (
      <div className="seller-receive">
        <div className="seller-card seller-card-center">
          <div className="seller-check-big">✓</div>
          <h2>Receipt Confirmed</h2>
          <p>
            <strong>{doneCount}</strong> unit{doneCount === 1 ? '' : 's'} marked as received at{' '}
            <strong>{regionLabel}</strong>.
          </p>
          <p className="seller-muted">
            Batch {selected.batchId?.slice(0, 12) || '—'}
          </p>
          <button
            className="seller-btn seller-btn-primary"
            onClick={closeShipment}
          >
            Back to shipments
          </button>
        </div>
      </div>
    );
  }

  // ---------- Shipment detail view ----------
  const totalInShipment = units.length;
  const receivedCount = received.size;
  const progressPct =
    totalInShipment > 0
      ? Math.round((receivedCount / totalInShipment) * 100)
      : 0;

  return (
    <div className="seller-receive">
      <button className="seller-back" onClick={closeShipment}>
        ← Back
      </button>
      <h1>Receive Shipment</h1>
      <p className="seller-muted">
        Batch {selected.batchId?.slice(0, 12) || '—'} · To{' '}
        {selected.destinationLabel || 'Unknown'}
      </p>

      <label className="seller-field">
        <span>Receiving Location</span>
        <input
          value={regionLabel}
          onChange={(e) => setRegionLabel(e.target.value)}
          placeholder="e.g. Auchi Warehouse"
        />
      </label>

      <div className="seller-progress-box">
        <div className="seller-progress-head">
          <strong>
            Scanned {receivedCount} of {totalInShipment}
          </strong>
          <span>
            {receivedCount === 0
              ? 'Scan units to receive'
              : receivedCount === totalInShipment
              ? 'All units scanned'
              : 'Keep scanning or confirm now'}
          </span>
        </div>
        <div className="seller-progress-bar">
          <div
            className="seller-progress-fill"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>

      {error && <div className="seller-error">{error}</div>}
      {lastMessage && (
        <div className="seller-scan-feedback">{lastMessage}</div>
      )}

      <button
        className="seller-btn seller-btn-primary seller-btn-big"
        onClick={() => {
          setError('');
          setScanOpen(true);
        }}
      >
        📷 Scan a Unit
      </button>

      <button
        className="seller-btn seller-btn-outline"
        onClick={handleConfirm}
        disabled={receivedCount === 0 || confirming}
      >
        {confirming
          ? 'Confirming…'
          : `Confirm Receipt of ${receivedCount} Unit${
              receivedCount === 1 ? '' : 's'
            }`}
      </button>

      {totalInShipment === 0 && (
        <p className="seller-muted seller-mt">
          This shipment doesn't have any units linked yet. Please contact the
          sender.
        </p>
      )}

      {totalInShipment > 0 && (
        <ul className="seller-unit-list">
          {units.slice(0, 20).map((u) => {
            const isReceived = received.has(u.id);
            return (
              <li
                key={u.id}
                className={isReceived ? 'done' : ''}
              >
                <span className="seller-unit-ref">
                  {u.consumerReferenceCode || u.id}
                </span>
                <span
                  className={`seller-pill ${
                    isReceived ? 'seller-pill-green' : ''
                  }`}
                >
                  {isReceived ? 'Received' : 'Pending'}
                </span>
              </li>
            );
          })}
          {units.length > 20 && (
            <li className="seller-muted">
              …and {units.length - 20} more
            </li>
          )}
        </ul>
      )}

      {scanOpen && (
        <SellerReceiveScanModal
          sellerId={seller.id}
          shipmentId={selected.id}
          regionLabel={regionLabel}
          onClose={() => setScanOpen(false)}
          onSuccess={handleScanSuccess}
          onFailure={handleScanFailure}
        />
      )}
    </div>
  );
};

export default SellerReceive;