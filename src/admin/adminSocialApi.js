// src/admin/adminSocialApi.js
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../firebase';

const generateLink = (platform, handle) => {
  if (!handle) return '#';
  const clean = handle.replace(/^@/, '');
  switch (platform) {
    case 'instagram': return `https://instagram.com/${clean}`;
    case 'tiktok': return `https://tiktok.com/@${clean}`;
    case 'youtube': return `https://youtube.com/@${clean}`;
    case 'x': return `https://x.com/${clean}`;
    case 'facebook': return `https://facebook.com/${clean}`;
    case 'whatsapp': return `https://wa.me/${clean.replace(/\D/g, '')}`;
    case 'website': return handle.startsWith('http') ? handle : `https://${handle}`;
    default: return '#';
  }
};

export async function fetchPendingSocialCodes() {
  const results = [];

  // 1. Fetch from Seller Verifications
  try {
    const sellerSnap = await getDocs(collection(db, 'seller_verifications'));
    sellerSnap.forEach((doc) => {
      const data = doc.data();
      const accounts = data.accounts || {};
      
      Object.values(accounts).forEach((platformData) => {
        if (!platformData) return;

        if (Array.isArray(platformData)) {
          platformData.forEach((acc) => {
            if (acc?.status === 'pending' && acc?.pendingCode) {
              results.push({
                id: doc.id,
                type: 'seller',
                platform: acc.platform,
                handle: acc.handle,
                code: acc.pendingCode,
                link: generateLink(acc.platform, acc.handle),
              });
            }
          });
        } else if (!platformData.platform && typeof platformData === 'object') {
          Object.values(platformData).forEach((acc) => {
            if (acc?.status === 'pending' && acc?.pendingCode) {
              results.push({
                id: doc.id,
                type: 'seller',
                platform: acc.platform,
                handle: acc.handle,
                code: acc.pendingCode,
                link: generateLink(acc.platform, acc.handle),
              });
            }
          });
        } 
        else if (platformData?.status === 'pending' && platformData?.pendingCode) {
          results.push({
            id: doc.id,
            type: 'seller',
            platform: platformData.platform,
            handle: platformData.handle,
            code: platformData.pendingCode,
            link: generateLink(platformData.platform, platformData.handle),
          });
        }
      });
    });
  } catch (err) {
    console.warn('Failed to fetch seller social codes:', err);
  }

  // 2. Fetch from Brand Verifications
  try {
    const brandSnap = await getDocs(collection(db, 'brand_verifications'));
    brandSnap.forEach((doc) => {
      const data = doc.data();
      const accounts = data.accounts || {};
      
      Object.values(accounts).forEach((platformData) => {
        if (!platformData) return;

        if (Array.isArray(platformData)) {
          platformData.forEach((acc) => {
            if (acc?.status === 'pending' && acc?.pendingCode) {
              results.push({
                id: doc.id,
                type: 'brand',
                platform: acc.platform,
                handle: acc.handle,
                code: acc.pendingCode,
                link: generateLink(acc.platform, acc.handle),
              });
            }
          });
        } else if (!platformData.platform && typeof platformData === 'object') {
          Object.values(platformData).forEach((acc) => {
            if (acc?.status === 'pending' && acc?.pendingCode) {
              results.push({
                id: doc.id,
                type: 'brand',
                platform: acc.platform,
                handle: acc.handle,
                code: acc.pendingCode,
                link: generateLink(acc.platform, acc.handle),
              });
            }
          });
        } else if (platformData?.status === 'pending' && platformData?.pendingCode) {
          results.push({
            id: doc.id,
            type: 'brand',
            platform: platformData.platform,
            handle: platformData.handle,
            code: platformData.pendingCode,
            link: generateLink(platformData.platform, platformData.handle),
          });
        }
      });
    });
  } catch (err) {
    console.warn('Failed to fetch brand social codes:', err);
  }

  return results;
}