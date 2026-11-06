// src/admin/AdminLogin.jsx
import { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { loginAdmin } from './adminAuth';
import './AdminPortal.css';

const AdminLogin = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const location = useLocation();

  const redirectTo = location.state?.from || '/admin/dashboard';

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await loginAdmin(email, password);
      navigate(redirectTo, { replace: true });
    } catch (err) {
      console.error('Admin login failed:', err);
      const map = {
        'auth/invalid-credential': 'Incorrect email or password.',
        'auth/user-not-found': 'No account found with that email.',
        'auth/too-many-requests': 'Too many attempts. Please wait a moment.',
        'admin/not-admin': 'This account does not have admin access.',
        'admin/inactive': 'This admin account is disabled.',
      };
      setError(map[err.code] || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="admin-login-page">
      <div className="admin-login-card">
        <div className="admin-login-badge">
          <span className="admin-login-dot" />
          Restricted Access
        </div>

        <h1 className="admin-login-title">Admin Console</h1>
        <p className="admin-login-subtitle">
          Sign in with your administrator credentials.
        </p>

        <form onSubmit={handleSubmit} className="admin-login-form">
          <label className="admin-field">
            <span>Email</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@konfa.example"
              autoComplete="username"
              required
              disabled={loading}
            />
          </label>

          <label className="admin-field">
            <span>Password</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••••"
              autoComplete="current-password"
              required
              disabled={loading}
            />
          </label>

          {error && <div className="admin-error">{error}</div>}

          <button
            type="submit"
            className="admin-btn admin-btn-primary"
            disabled={loading}
          >
            {loading ? 'Signing in…' : 'Sign in to Admin Console'}
          </button>
        </form>

        <Link to="/" className="admin-back-home">← Return to Konfa home</Link>
      </div>
    </div>
  );
};

export default AdminLogin;