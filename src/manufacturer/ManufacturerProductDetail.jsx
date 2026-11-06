// src/manufacturer/ManufacturerProductDetail.jsx
import { useEffect, useState } from 'react';
import { useParams, useNavigate, useOutletContext, Link } from 'react-router-dom';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  query,
  where,
} from 'firebase/firestore';
import { db } from '../firebase';
import './ManufacturerPortal.css';

const PRODUCT_TYPES = [
  { value: 'food',           label: 'Food & Beverage' },
  { value: 'beverage',       label: 'Beverage' },
  { value: 'electronics',    label: 'Electronics' },
  { value: 'cosmetics',      label: 'Cosmetics' },
  { value: 'pharmaceutical', label: 'Pharmaceutical' },
  { value: 'other',          label: 'Other' },
];

const ManufacturerProductDetail = () => {
  const { id } = useParams();
  const { manufacturer, staff } = useOutletContext();
  const navigate = useNavigate();

  const [product, setProduct] = useState(null);
  const [batches, setBatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');

  const [form, setForm] = useState({
    productName: '',
    productType: 'food',
    description: '',
    sku: '',
  });

  const canEdit = ['GENERATION_OFFICER', 'SUPERVISOR', 'ADMIN'].includes(
    staff.role
  );

  useEffect(() => {
    (async () => {
      try {
        const docSnap = await getDoc(doc(db, 'products', id));
        if (!docSnap.exists()) {
          setError('Product not found.');
          return;
        }
        const data = { id: docSnap.id, ...docSnap.data() };

        // Ownership guard — manufacturer can only see their own products
        if (data.manufacturerId !== manufacturer.id) {
          setError('You do not have access to this product.');
          return;
        }

        setProduct(data);
        setForm({
          productName: data.productName || '',
          productType: data.productType || 'food',
          description: data.description || '',
          sku: data.sku || '',
        });

        const batchSnap = await getDocs(
          query(collection(db, 'batches'), where('productId', '==', id))
        );
        setBatches(batchSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
      } catch (err) {
        console.error(err);
        setError('Could not load product.');
      } finally {
        setLoading(false);
      }
    })();
  }, [id, manufacturer.id]);

  const handleSave = async (e) => {
    e.preventDefault();
    if (!canEdit) return;
    setSaving(true);
    setError('');
    try {
      await updateDoc(doc(db, 'products', id), {
        productName: form.productName.trim(),
        productType: form.productType,
        description: form.description.trim() || null,
        sku: form.sku.trim() || null,
        updatedAt: new Date().toISOString(),
        updatedBy: staff.id,
        updatedByName: staff.fullName,
      });
      setProduct((p) => ({ ...p, ...form }));
    } catch (err) {
      console.error(err);
      setError('Could not save changes.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (batches.length > 0) {
      alert(
        `This product has ${batches.length} batch(es) linked to it. ` +
          `Delete or reassign those batches first.`
      );
      return;
    }
    if (!window.confirm(`Delete product "${product.productName}"?`)) return;

    setDeleting(true);
    try {
      await deleteDoc(doc(db, 'products', id));
      navigate('/manufacturer/products');
    } catch (err) {
      console.error(err);
      setError('Could not delete product.');
      setDeleting(false);
    }
  };

  if (loading) return <div className="mf-loading">Loading…</div>;
  if (!product)
    return (
      <div className="mf-page">
        <div className="mf-error-large">
          <h2>Access denied</h2>
          <p>{error || 'Product not found.'}</p>
          <Link to="/manufacturer/products" className="mf-btn mf-btn-primary">
            Back to products
          </Link>
        </div>
      </div>
    );

  return (
    <div className="mf-page">
      <Link to="/manufacturer/products" className="mf-back">
        ← All products
      </Link>

      <header className="mf-page-header">
        <div>
          <h1>{product.productName}</h1>
          <p>
            Product ID: <code>{product.id}</code>
            {batches.length > 0 && (
              <> · Used in {batches.length} batch(es)</>
            )}
          </p>
        </div>
        {canEdit && (
          <button
            className="mf-btn mf-btn-danger"
            onClick={handleDelete}
            disabled={deleting || batches.length > 0}
            title={
              batches.length > 0 ? 'Cannot delete: batches are linked' : ''
            }
          >
            {deleting ? 'Deleting…' : 'Delete Product'}
          </button>
        )}
      </header>

      {error && <div className="mf-error">{error}</div>}

      <form className="mf-form" onSubmit={handleSave}>
        <div className="mf-form-grid">
          <div className="mf-field mf-field-full">
            <label>Product name</label>
            <input
              type="text"
              value={form.productName}
              onChange={(e) =>
                setForm({ ...form, productName: e.target.value })
              }
              disabled={!canEdit}
              required
            />
          </div>

          <div className="mf-field">
            <label>Product type</label>
            <select
              value={form.productType}
              onChange={(e) =>
                setForm({ ...form, productType: e.target.value })
              }
              disabled={!canEdit}
            >
              {PRODUCT_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>

          <div className="mf-field">
            <label>SKU</label>
            <input
              type="text"
              value={form.sku}
              onChange={(e) => setForm({ ...form, sku: e.target.value })}
              disabled={!canEdit}
            />
          </div>

          <div className="mf-field mf-field-full">
            <label>Description</label>
            <textarea
              rows="3"
              value={form.description}
              onChange={(e) =>
                setForm({ ...form, description: e.target.value })
              }
              disabled={!canEdit}
            />
          </div>
        </div>

        {canEdit && (
          <button
            type="submit"
            className="mf-btn mf-btn-primary"
            disabled={saving}
          >
            {saving ? 'Saving…' : 'Save changes'}
          </button>
        )}
      </form>

      {batches.length > 0 && (
        <section className="mf-section">
          <h2>Batches using this product</h2>
          <ul className="mf-list">
            {batches.map((b) => (
              <li key={b.id} className="mf-list-item">
                <div>
                  <strong>{b.batchCode}</strong>
                  <span>
                    {b.quantity} units · {b.productionLocation} ·{' '}
                    {b.productionDate}
                  </span>
                </div>
                <div className="mf-list-item-right">
                  <span className={`mf-pill mf-pill-${b.status}`}>
                    {b.status}
                  </span>
                  <Link
                    to={`/manufacturer/batches/${b.id}`}
                    className="mf-btn mf-btn-small"
                  >
                    Open
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
};

export default ManufacturerProductDetail;