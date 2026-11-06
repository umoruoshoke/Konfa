// src/brand/RequireBrand.jsx
import { useEffect, useState } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { watchBrandAuth, getCurrentBrandProfile } from './brandAuth';

const RequireBrand = () => {
  const navigate = useNavigate();
  const [brand, setBrand] = useState(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const unsubscribe = watchBrandAuth(async (user) => {
      if (cancelled) return;

      if (!user) {
        setBrand(null);
        setChecking(false);
        navigate('/brand/login', { replace: true });
        return;
      }

      const profile = await getCurrentBrandProfile();
      if (cancelled) return;

      if (!profile || profile.status !== 'active') {
        setBrand(null);
        setChecking(false);
        navigate('/brand/login', { replace: true });
        return;
      }

      setBrand(profile);
      setChecking(false);
    });

    return () => {
      cancelled = true;
      if (typeof unsubscribe === 'function') unsubscribe();
    };
  }, [navigate]);

  if (checking) {
    return (
      <div className="brand-splash">
        <div className="brand-splash-spinner" />
        <p>Loading…</p>
      </div>
    );
  }

  if (!brand) return null;

  return <Outlet context={{ brand }} />;
};

export default RequireBrand;