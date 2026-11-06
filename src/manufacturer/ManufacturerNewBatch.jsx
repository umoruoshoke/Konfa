// src/manufacturer/ManufacturerNewBatch.jsx
import { useEffect, useState } from 'react';
import { useOutletContext, useNavigate, Link } from 'react-router-dom';
import {
  fetchManufacturerProducts,
  createBatchWithUnits,
} from './manufacturerAuth';
import './ManufacturerPortal.css';

const ManufacturerNewBatch = () => {
  const { manufacturer, staff } = useOutletContext();
  const navigate = useNavigate();

  const [products, setProducts] = useState([]);
  const [productId, setProductId] = useState('');
  const [quantity, setQuantity] = useState('');
  const [productionLocation, setProductionLocation] = useState('');
  const [productionDate, setProductionDate] = useState(
    new Date().toISOString().slice(0, 10)
  );

  const [productsLoading, setProductsLoading] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const list = await fetchManufacturerProducts(manufacturer.id);
        setProducts(list);
        if (list.length > 0) setProductId(list[0].id);
        setProductionLocation(
          manufacturer.physicalAddress || 'Main Production Facility'
        );
      } catch (err) {
        console.error('Could not load products:', err);
      } finally {
        setProductsLoading(false);
      }
    })();
  }, [manufacturer.id, manufacturer.physicalAddress]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const qty = Number(quantity);
    if (!productId) {
      setError('Please pick a product.');
      return;
    }
    if (!qty || qty < 1) {
      setError('Quantity must be at least 1.');
      return;
    }
    if (qty > 5000) {
      setError('Maximum 5000 units per batch.');
      return;
    }

    setLoading(true);
    try {
      const result = await createBatchWithUnits({
        manufacturerId: manufacturer.id,
        productId,
        quantity: qty,
        productionLocation,
        productionDate,
        staffId: staff.id,
        staffName: staff.fullName,
      });
      navigate(`/manufacturer/batches/${result.batchId}`);
    } catch (err) {
      console.error(err);
      setError('Could not create batch. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mf-page">
      <header className="mf-page-header">
        <div>
          <h1>Create a New Batch</h1>
          <p>
            The system will generate unique reference codes, QR tokens, and PINs
            for every unit.
          </p>
        </div>
      </header>

      {productsLoading ? (
        <div className="mf-loading">Loading products…</div>
      ) : (
        <form className="mf-form" onSubmit={handleSubmit}>
          <div className="mf-form-grid">
            {/* ---------------- PRODUCT DROPDOWN ---------------- */}
            <div className="mf-field mf-field-full">
              <label>Product *</label>

              {products.length === 0 ? (
                <div className="mf-empty-inline">
                  <div className="mf-empty-inline-icon">📦</div>
                  <div className="mf-empty-inline-body">
                    <strong>You don't have any products yet</strong>
                    <p>
                      Before you can create a batch, you need to add at least one
                      product to your catalog.
                    </p>
                    <Link
                      to="/manufacturer/products"
                      className="mf-btn mf-btn-primary mf-btn-small"
                    >
                      + Add your first product
                    </Link>
                  </div>
                </div>
              ) : (
                <>
                  <select
                    value={productId}
                    onChange={(e) => setProductId(e.target.value)}
                    required
                  >
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.productName}
                        {p.sku ? ` — ${p.sku}` : ''}
                      </option>
                    ))}
                  </select>
                  <p className="mf-field-hint">
                    Need a new product?{' '}
                    <Link to="/manufacturer/products" className="mf-link">
                      Add one here →
                    </Link>
                  </p>
                </>
              )}
            </div>

            {/* ---------------- QUANTITY ---------------- */}
            <div className="mf-field">
              <label>Quantity (units) *</label>
              <input
                type="number"
                min="1"
                max="5000"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder="e.g. 1000"
                required
                disabled={products.length === 0}
              />
            </div>

            {/* ---------------- PRODUCTION DATE ---------------- */}
            <div className="mf-field">
              <label>Production date *</label>
              <input
                type="date"
                value={productionDate}
                onChange={(e) => setProductionDate(e.target.value)}
                required
                disabled={products.length === 0}
              />
            </div>

            {/* ---------------- PRODUCTION LOCATION ---------------- */}
            <div className="mf-field mf-field-full">
              <label>Production location *</label>
              <input
                type="text"
                value={productionLocation}
                onChange={(e) => setProductionLocation(e.target.value)}
                placeholder="e.g. Lagos Factory A"
                required
                disabled={products.length === 0}
              />
            </div>
          </div>

          {products.length > 0 && (
            <div className="mf-hint-box">
              <strong>What happens next</strong>
              <p>
                The system will generate {quantity || '0'} unique units — each
                with its own consumer reference code, consumer QR token, seller
                QR token, and PIN hash. None will be active until a separate
                Activation Officer scans them.
              </p>
            </div>
          )}

          {error && <div className="mf-error">{error}</div>}

          <button
            type="submit"
            className="mf-btn mf-btn-primary"
            disabled={loading || products.length === 0}
          >
            {loading ? 'Generating units…' : 'Generate Batch'}
          </button>
        </form>
      )}
    </div>
  );
};

export default ManufacturerNewBatch;