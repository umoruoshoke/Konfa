// src/seller/verification/SellerVerificationAccounts.jsx
import React from 'react';
import {
  SUPPORTED_PLATFORMS,
  platformMeta,
} from './sellerVerificationApi';
import './SellerVerificationAccounts.css';

// ============================================================
// 🔑 UPDATED HELPER: Flattens arrays, nested objects, and old single objects
// ============================================================
export const getNormalizedAccountsForPlatform = (rawAccounts, platformKey) => {
  const platformData = rawAccounts[platformKey];
  if (!platformData) return {};
  
  // New Array format (accounts.instagram = [{ handle: 'a' }, { handle: 'b' }])
  if (Array.isArray(platformData)) {
    const map = {};
    platformData.forEach((acc, idx) => {
      if (acc && acc.handle) {
        map[acc.handle.toLowerCase()] = acc;
      } else {
        map[`idx-${idx}`] = acc;
      }
    });
    return map;
  }

  // Old single flat object (accounts.instagram = { handle: 'a' })
  if (platformData.platform || platformData.handle) {
    const id = (platformData.handle || platformData.platform).toLowerCase();
    return { [id]: platformData };
  }
  
  // Old nested map (accounts.instagram = { "handle1": {...}, "handle2": {...} })
  return platformData;
};

// ============================================================
// Main component
// ============================================================
const SellerVerificationAccounts = ({
  verification,
  onReload,
  onStartVerify,
}) => {
  const rawAccounts = verification?.accounts || {};

  return (
    <section className="sva-section">
      <header className="sva-header">
        <h3>Your social accounts</h3>
        <p>
          Add each account you want customers to see as officially verified.
          You can add multiple accounts per platform (e.g., backup Instagram).
        </p>
      </header>

      <div className="sva-grid">
        {SUPPORTED_PLATFORMS.map((p) => {
          // 🔑 Get all accounts for this platform
          const accountsMap = getNormalizedAccountsForPlatform(rawAccounts, p.key);
          const list = Object.values(accountsMap);
          
          // 🔑 Count how many are verified vs pending
          const verifiedCount = list.filter((a) => a.status === 'verified').length;
          const pendingCount = list.filter((a) => a.status === 'pending').length;
          
          let statusClass = 'unverified';
          if (verifiedCount > 0) statusClass = 'verified';
          else if (pendingCount > 0) statusClass = 'pending';

          return (
            <div
              key={p.key}
              className={`sva-card sva-card-${statusClass}`}
              onClick={() => onStartVerify(p.key)}
              role="button"
              tabIndex={0}
            >
              <div
                className="sva-card-accent"
                style={{ background: p.color }}
              />
              <div className="sva-card-body">
                <div className="sva-card-head">
                  <span className="sva-platform">{p.label}</span>
                  
                  {/* 🔑 Render the badges for Verified / Pending counts */}
                  <div style={{ display: 'flex', gap: 6 }}>
                    {verifiedCount > 0 && (
                      <span className="sva-status sva-status-verified">
                        <span className="sva-status-dot" />
                        {verifiedCount} Verified
                      </span>
                    )}
                    {pendingCount > 0 && (
                      <span className="sva-status sva-status-pending">
                        <span className="sva-status-dot" />
                        {pendingCount} Pending
                      </span>
                    )}
                  </div>
                </div>

                <div className="sva-handle" style={{ fontWeight: 600 }}>
                  {list.length === 0
                    ? 'No accounts linked'
                    : list.length === 1
                    ? (p.key === 'website' ? list[0].handle : `@${list[0].handle.replace(/^@/, '')}`)
                    : `${list.length} accounts linked`}
                </div>

                <div className="sva-card-actions" style={{ marginTop: 12 }}>
                  <button className="sva-btn sva-btn-primary" type="button">
                    {list.length > 0 ? 'Manage accounts →' : 'Link account →'}
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
};

export default SellerVerificationAccounts;