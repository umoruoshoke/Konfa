// src/seller/SellerScan.jsx
import { useState } from 'react';
import { findUnitBySellerBarcode, logHandoffScan } from './sellerAuth';
import './SellerPortal.css';

const SellerScan = ({ seller }) => {
  const [token, setToken] = useState('');
  const [regionLabel, setRegionLabel] = useState(
    seller?.currentLocation || 'Warehouse'
  );
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  const handleScan = async (e) => {
    e.preventDefault();
    setError('');
    setResult(null);
    setLoading(true);
    try {
      const unit = await findUnitBySellerBarcode(token.trim());
      if (!unit) {
        setError('No product matches this barcode.');
        return;
      }
      await logHandoffScan(unit.id, seller.id, regionLabel);
      setResult(unit);
    } catch (err) {
      console.error(err);
      setError('Scan failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setToken('');
    setResult(null);
    setError('');
  };

  return (
    <div className="seller-scan">
      <h1>Scan a Product</h1>
      <p className="seller-muted">
        Enter the seller barcode printed on the package.
      </p>

      {!result && (
        <form className="seller-scan-form" onSubmit={handleScan}>
          <label className="seller-field">
            <span>Seller Barcode Token</span>
            <input
              type="text"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="Paste or type the code…"
              autoFocus
              required
            />
          </label>

          <label className="seller-field">
            <span>Current Location</span>
            <input
              type="text"
              value={regionLabel}
              onChange={(e) => setRegionLabel(e.target.value)}
              placeholder="e.g. Abuja Warehouse"
            />
          </label>

          {error && <div className="seller-error">{error}</div>}

          <button
            type="submit"
            className="seller-btn seller-btn-primary"
            disabled={loading}
          >
            {loading ? 'Scanning…' : 'Log Handoff Scan'}
          </button>
        </form>
      )}

      {result && (
        <div className="seller-scan-result">
          <div className="seller-banner seller-banner-green">✓ Authentic</div>

          <div className="seller-card">
            <h3>Unit {result.id}</h3>
            <p>Batch: {result.batchId}</p>
            <p>Location: {regionLabel}</p>
            <p>Confidence: HIGH</p>
          </div>

          <button className="seller-btn seller-btn-outline" onClick={reset}>
            Scan another
          </button>
        </div>
      )}
    </div>
  );
};

export default SellerScan;