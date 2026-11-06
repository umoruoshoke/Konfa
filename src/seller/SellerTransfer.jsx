// src/seller/SellerTransfer.jsx
import { useEffect, useState } from 'react';
import {
  createTransfer,
  findSellerByEmail,
  fetchHeldUnits,
} from './sellerAuth';
import './SellerPortal.css';

const SellerTransfer = ({ seller }) => {
  const [recipientEmail, setRecipientEmail] = useState('');
  const [quantity, setQuantity] = useState('');
  const [destination, setDestination] = useState('');
  const [held, setHeld] = useState([]);
  const [loading, setLoading] = useState(false);
  const [unitsLoading, setUnitsLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const list = await fetchHeldUnits(seller.id);
        setHeld(list);
      } catch (err) {
        console.error(err);
      } finally {
        setUnitsLoading(false);
      }
    })();
  }, [seller.id]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess(null);
    setLoading(true);
    try {
      const recipient = await findSellerByEmail(
        recipientEmail.trim().toLowerCase()
      );
      if (!recipient) {
        setError('No seller found with that email.');
        return;
      }
      if (recipient.id === seller.id) {
        setError("You can't transfer to yourself.");
        return;
      }
      const qty = Number(quantity);
      if (!qty || qty <= 0) {
        setError('Please enter a valid quantity.');
        return;
      }
      if (qty > held.length) {
        setError(`You only have ${held.length} units available.`);
        return;
      }

      const picked = held.slice(0, qty);
      const unitIdRange =
        picked.length > 0
          ? `${picked[0].id}-${picked[picked.length - 1].id}`
          : null;

      const transferId = await createTransfer({
        fromSellerId: seller.id,
        toSellerId: recipient.id,
        quantity: qty,
        destinationLabel: destination || recipient.companyName || 'Unknown',
        unitIdRange,
      });

      setSuccess({ transferId, recipient: recipient.companyName, qty });
      setRecipientEmail('');
      setQuantity('');
      setDestination('');
    } catch (err) {
      console.error(err);
      setError('Failed to create transfer.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="seller-transfer">
      <h1>New Transfer</h1>
      <p className="seller-muted">
        Send stock to another seller. You have <strong>{held.length}</strong> units
        available.
      </p>

      {!success && (
        <form className="seller-form" onSubmit={handleSubmit}>
          <label className="seller-field">
            <span>Sell to (email)</span>
            <input
              type="email"
              value={recipientEmail}
              onChange={(e) => setRecipientEmail(e.target.value)}
              placeholder="retailerX@example.com"
              required
            />
          </label>

          <label className="seller-field">
            <span>Quantity</span>
            <input
              type="number"
              min="1"
              max={held.length}
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder="e.g. 50"
              required
            />
          </label>

          <label className="seller-field">
            <span>Destination</span>
            <input
              type="text"
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
              placeholder="e.g. Kano"
            />
          </label>

          {quantity && Number(quantity) > 0 && held.length > 0 && (
            <div className="seller-hint-box">
              <strong>{quantity} units selected automatically</strong>
              <span>
                from currently held stock
                {held.length >= Number(quantity) &&
                  ` (${held[0].id}–${held[Number(quantity) - 1]?.id})`}
              </span>
            </div>
          )}

          {error && <div className="seller-error">{error}</div>}

          <button
            type="submit"
            className="seller-btn seller-btn-primary"
            disabled={loading}
          >
            {loading ? 'Creating…' : 'Declare Transfer'}
          </button>
        </form>
      )}

      {success && (
        <div className="seller-card seller-card-center">
          <div className="seller-check-big">✓</div>
          <h2>TRANSFER RECORDED</h2>
          <p>
            {success.qty} units → <strong>{success.recipient}</strong>
          </p>
          <div className="seller-note">
            <strong>Location confidence: LOW</strong>
            <p>
              This transfer is declared only — confidence will rise to Medium or
              High once {success.recipient} confirms receipt.
            </p>
          </div>
          <button
            className="seller-btn seller-btn-outline"
            onClick={() => setSuccess(null)}
          >
            Create another transfer
          </button>
        </div>
      )}

      {unitsLoading && !success && (
        <p className="seller-muted">Loading your stock…</p>
      )}
    </div>
  );
};

export default SellerTransfer;