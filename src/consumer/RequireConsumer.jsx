// src/consumer/RequireConsumer.jsx
import { useEffect, useState } from 'react';
import { Navigate, useLocation, Outlet } from 'react-router-dom';
import {
  watchConsumerAuth,
  getCurrentConsumerProfile,
} from './consumerAuth';

const RequireConsumer = () => {
  const [state, setState] = useState({
    loading: true,
    user: null,
    profile: null,
  });
  const location = useLocation();

  useEffect(() => {
    const unsub = watchConsumerAuth(async (user) => {
      if (!user) {
        setState({ loading: false, user: null, profile: null });
        return;
      }
      try {
        const profile = await getCurrentConsumerProfile();
        setState({ loading: false, user, profile });
      } catch (err) {
        console.error('Consumer profile load failed:', err);
        setState({ loading: false, user, profile: null });
      }
    });
    return () => unsub();
  }, []);

  if (state.loading) {
    return (
      <div className="consumer-splash">
        <div className="consumer-splash-spinner" />
        <p>Loading your account…</p>
      </div>
    );
  }

  if (!state.user) {
    return (
      <Navigate
        to="/consumer/login"
        replace
        state={{ from: location.pathname }}
      />
    );
  }

  if (!state.profile) {
    return (
      <div className="consumer-splash">
        <p>
          We couldn't find your profile. Please contact support at
          support@konfa.ng.
        </p>
      </div>
    );
  }

  return <Outlet context={{ user: state.user, consumer: state.profile }} />;
};


export default RequireConsumer;