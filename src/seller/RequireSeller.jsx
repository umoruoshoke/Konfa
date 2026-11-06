// src/seller/RequireSeller.jsx
import { useEffect, useState } from 'react';
import { Navigate, useLocation, Outlet } from 'react-router-dom';
import { watchSellerAuth, getCurrentSellerProfile } from './sellerAuth';

const RequireSeller = () => {
  const [state, setState] = useState({
    loading: true,
    user: null,
    seller: null,
  });
  const location = useLocation();

  useEffect(() => {
    const unsub = watchSellerAuth(async (user) => {
      if (!user) {
        setState({ loading: false, user: null, seller: null });
        return;
      }
      try {
        const seller = await getCurrentSellerProfile();
        setState({ loading: false, user, seller });
      } catch (err) {
        console.error('Failed to load seller profile:', err);
        setState({ loading: false, user, seller: null });
      }
    });
    return () => unsub();
  }, []);

  if (state.loading) {
    return (
      <div className="seller-splash">
        <div className="seller-splash-spinner" />
        <p>Checking your session…</p>
      </div>
    );
  }

  if (!state.user) {
    return (
      <Navigate
        to="/seller/login"
        replace
        state={{ from: location.pathname }}
      />
    );
  }

  if (!state.seller) {
    return (
      <div className="seller-splash">
        <p>
          Your account is not linked to a seller profile. Please contact support.
        </p>
      </div>
    );
  }

  // Hand the seller down to child routes via Outlet context
  return <Outlet context={{ seller: state.seller }} />;
};

export default RequireSeller;