// src/manufacturer/ManufacturerProducts.jsx
import { useEffect, useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import {
  collection,
  getDocs,
  query,
  where,
  addDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../firebase';
import './ManufacturerPortal.css';

// ============================================================
// CONSTANTS
// ============================================================
const PRODUCT_TYPES = [
  { value: 'food',           label: 'Food & Beverage' },
  { value: 'beverage',       label: 'Beverage' },
  { value: 'electronics',    label: 'Electronics' },
  { value: 'cosmetics',      label: 'Cosmetics' },
  { value: 'pharmaceutical', label: 'Pharmaceutical' },
  { value: 'other',          label: 'Other' },
];

// Every role that should see the "New Product" button.
// OWNER and ADMIN have full write access. GENERATION_OFFICER
// and SUPERVISOR can also create products.
const EDIT_ROLES = ['OWNER', 'ADMIN', 'GENERATION_OFFICER', 'SUPERVISOR'];

// ============================================================
// HELPERS
// ============================================================
// Firestore rejects `undefined` field values with
// "invalid-argument: Unsupported field value: undefined".
// This strips any undefined values before writing, and converts
// undefined → null where a field is optional.
function stripUndefined(obj) {
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) out[k] = v;
  }
  return out;
}

// Turn empty strings into null so we don't store empty strings
// for optional fields.
function normalizeString(v) {
  if (v === undefined || v === null) return null;
  const s = String(v).trim();
  return s.length ? s : null;
}

const ManufacturerProducts = () => {
  const { manufacturer, staff } = useOutletContext();

  // ---- Defensive identity extraction ----
  // Even if the outlet context is malformed, the component renders.
  const manufacturerId = manufacturer?.id || null;
  const staffId = staff?.id || staff?.firebaseUid || null;
  const staffName =
    staff?.fullName || staff?.name || staff?.email || 'Staff';
  const role = staff?.role || 'VIEWER';

  // ✅ OWNER and ADMIN can edit — the previous list omitted OWNER
  // which is why the "+ New Product" button never appeared for you.
  const canEdit = EDIT_ROLES.includes(role);

  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [form, setForm] = useState({
    productName: '',
    productType: 'food',
    description: '',
    sku: '',
  });

  // ---- Load products ----
  const load = async () => {
    if (!manufacturerId) {
      console.warn('ManufacturerProducts: no manufacturerId available');
      setProducts([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError('');
    try {
      const snap = await getDocs(
        query(
          collection(db, 'products'),
          where('manufacturerId', '==', manufacturerId)
        )
      );
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      list.sort((a, b) =>
        (a.productName || '').localeCompare(b.productName || '')
      );
      setProducts(list);
    } catch (err) {
      console.error('Load products failed:', err);
      setError(
        err.code === 'permission-denied'
          ? 'Permission denied. Check your Firestore rules.'
          : `Could not load products: ${err.message}`
      );
      setProducts([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [manufacturerId]);

  // ---- Create product ----
  const handleCreate = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    // Validation
    if (!manufacturerId) {
      setError(
        'Your account is missing a manufacturer ID. Please sign out and back in, or contact support.'
      );
      return;
    }
    if (form.productName.trim().length < 2) {
      setError('Product name must be at least 2 characters.');
      return;
    }

    setCreating(true);
    try {
      // Build the doc, stripping undefined values so Firestore accepts it
      const productDoc = stripUndefined({
        manufacturerId,
        productName: form.productName.trim(),
        productType: form.productType || 'other',
        description: normalizeString(form.description),
        sku: normalizeString(form.sku),
        status: 'active',
        createdAt: serverTimestamp(),
        createdBy: staffId,
        createdByName: staffName,
        updatedAt: serverTimestamp(),
      });

      const ref = await addDoc(collection(db, 'products'), productDoc);

      setSuccess(`✅ "${form.productName.trim()}" created successfully.`);
      setShowCreate(false);
      setForm({
        productName: '',
        productType: 'food',
        description: '',
        sku: '',
      });

      // Reload the list
      await load();

      // Auto-hide the success banner after 5s
      setTimeout(() => setSuccess(''), 5000);

      return ref.id;
    } catch (err) {
      console.error('Create product failed:', err);

      // Surface the EXACT Firestore error so we know what's wrong
      const code = err?.code || '';
      const message = err?.message || 'Unknown error';

      if (code === 'permission-denied') {
        setError(
          'Permission denied. Your Firestore rules are blocking this write. Check the "products" collection rules.'
        );
      } else if (code === 'invalid-argument') {
        setError(
          `Invalid data: ${message}. This usually means a field was undefined.`
        );
      } else {
        setError(`Could not create product: ${message}`);
      }
    } finally {
      setCreating(false);
    }
  };

  // ---- Loading state ----
  if (loading) {
    return (
      <div className="mf-page">
        <header className="mf-page-header">
          <div>
            <h1>Products</h1>
            <p>Loading your products…</p>
          </div>
        </header>
        <div className="mf-loading">Loading products…</div>
      </div>
    );
  }

  // ---- Render ----
  return (
    <div className="mf-page">
      <header className="mf-page-header mf-page-header-with-actions">
        <div>
          <h1>Products</h1>
          <p>
            Products you produce. Create a product before generating batches
            for it.
          </p>
        </div>
        {canEdit && (
          <div className="mf-header-actions">
            <button
              type="button"
              className="mf-btn mf-btn-primary"
              onClick={() => {
                setShowCreate((v) => !v);
                setError('');
                setSuccess('');
              }}
            >
              {showCreate ? 'Cancel' : '+ New Product'}
            </button>
          </div>
        )}
      </header>

      {/* Success banner */}
      {success && (
        <div className="mf-success" role="status">
          {success}
        </div>
      )}

      {/* Error banner */}
      {error && <div className="mf-error">{error}</div>}

      {/* Create form */}
      {showCreate && canEdit && (
        <form className="mf-form" onSubmit={handleCreate}>
          <div className="mf-form-grid">
            <div className="mf-field mf-field-full">
              <label>Product name *</label>
              <input
                type="text"
                value={form.productName}
                onChange={(e) =>
                  setForm({ ...form, productName: e.target.value })
                }
                placeholder="e.g. XYZ Bread — Whole Wheat"
                required
              />
            </div>

            <div className="mf-field">
              <label>Product type *</label>
              <select
                value={form.productType}
                onChange={(e) =>
                  setForm({ ...form, productType: e.target.value })
                }
              >
                {PRODUCT_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="mf-field">
              <label>SKU (optional)</label>
              <input
                type="text"
                value={form.sku}
                onChange={(e) => setForm({ ...form, sku: e.target.value })}
                placeholder="e.g. XYZ-BRD-WW-500"
              />
            </div>

            <div className="mf-field mf-field-full">
              <label>Description (optional)</label>
              <textarea
                rows="3"
                value={form.description}
                onChange={(e) =>
                  setForm({ ...form, description: e.target.value })
                }
                placeholder="A short description of the product…"
              />
            </div>
          </div>

          <button
            type="submit"
            className="mf-btn mf-btn-primary"
            disabled={creating}
          >
            {creating ? 'Creating…' : 'Create Product'}
          </button>
        </form>
      )}

      {/* Empty state */}
      {products.length === 0 ? (
        <div className="mf-empty">
          <p>
            No products yet.{' '}
            {canEdit && (
              <button
                type="button"
                className="mf-link"
                onClick={() => setShowCreate(true)}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: 0,
                  font: 'inherit',
                  color: 'inherit',
                }}
              >
                Create your first one →
              </button>
            )}
          </p>
        </div>
      ) : (
        <div className="mf-table">
          <div className="mf-table-head mf-table-products">
            <span>Product</span>
            <span>Type</span>
            <span>SKU</span>
            <span></span>
          </div>
          {products.map((p) => (
            <div key={p.id} className="mf-table-row mf-table-products">
              <span className="mf-cell-strong">
                {p.productName}
                {p.description && (
                  <>
                    <br />
                    <small
                      style={{
                        color: '#94a3b8',
                        fontSize: 11,
                        fontWeight: 400,
                      }}
                    >
                      {p.description.slice(0, 60)}
                      {p.description.length > 60 ? '…' : ''}
                    </small>
                  </>
                )}
              </span>
              <span>
                <span className="mf-pill mf-pill-role">
                  {p.productType || 'other'}
                </span>
              </span>
              <span className="mf-cell-mono">{p.sku || '—'}</span>
              <span>
                {canEdit && (
                  <Link
                    to={`/manufacturer/products/${p.id}`}
                    className="mf-btn mf-btn-small"
                  >
                    Edit
                  </Link>
                )}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ManufacturerProducts;