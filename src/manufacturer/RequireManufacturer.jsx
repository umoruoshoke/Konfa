// src/manufacturer/RequireManufacturer.jsx
import { useEffect, useState } from 'react';
import { Navigate, useLocation, Outlet } from 'react-router-dom';
import {
  watchManufacturerAuth,
  getCurrentManufacturerProfile,
} from './manufacturerAuth';

const RequireManufacturer = () => {
  const [state, setState] = useState({
    loading: true,
    user: null,
    profile: null,
  });
  const location = useLocation();

  useEffect(() => {
    const unsub = watchManufacturerAuth(async (user) => {
      if (!user) {
        setState({ loading: false, user: null, profile: null });
        return;
      }
      try {
        const profile = await getCurrentManufacturerProfile();
        setState({ loading: false, user, profile });
      } catch (err) {
        console.error('Manufacturer profile load failed:', err);
        setState({ loading: false, user, profile: null });
      }
    });
    return () => unsub();
  }, []);

  if (state.loading) {
    return (
      <div className="mf-splash">
        <div className="mf-splash-spinner" />
        <p>Checking your session…</p>
      </div>
    );
  }

  if (!state.user) {
    return (
      <Navigate
        to="/manufacturer/login"
        replace
        state={{ from: location.pathname }}
      />
    );
  }

  if (!state.profile) {
    return (
      <div className="mf-splash">
        <p>
          Your account is not linked to a manufacturer profile. Please contact support.
        </p>
      </div>
    );
  }

  return <Outlet context={state.profile} />;
};

export default RequireManufacturer;