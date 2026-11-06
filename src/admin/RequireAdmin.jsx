// src/admin/RequireAdmin.jsx
import { useEffect, useState } from 'react';
import { Navigate, useLocation, Outlet } from 'react-router-dom';
import { watchAdminAuth, getCurrentAdminProfile } from './adminAuth';

const RequireAdmin = () => {
  const [state, setState] = useState({ loading: true, user: null, admin: null });
  const location = useLocation();

  useEffect(() => {
    const unsub = watchAdminAuth(async (user) => {
      if (!user) {
        setState({ loading: false, user: null, admin: null });
        return;
      }
      try {
        const admin = await getCurrentAdminProfile();
        setState({ loading: false, user, admin });
      } catch (err) {
        console.error('Admin profile load failed:', err);
        setState({ loading: false, user, admin: null });
      }
    });
    return () => unsub();
  }, []);

  if (state.loading) {
    return (
      <div className="admin-splash">
        <div className="admin-splash-spinner" />
        <p>Checking your session…</p>
      </div>
    );
  }

  if (!state.user) {
    return (
      <Navigate
        to="/admin/login"
        replace
        state={{ from: location.pathname }}
      />
    );
  }

  if (!state.admin) {
    return (
      <div className="admin-splash">
        <p>This account is not an administrator.</p>
      </div>
    );
  }

  return <Outlet context={{ admin: state.admin }} />;
};

export default RequireAdmin;