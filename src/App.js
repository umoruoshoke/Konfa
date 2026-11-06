// src/App.jsx
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useNavigate,
  useOutletContext,
} from 'react-router-dom';
import './App.css';

// ---------- Public pages ----------
import Home from './Pages/Home';
import VerifyPage from './Pages/VerifyPage';
import VerifyLookup from './Pages/VerifyLookup';
import PublicSellerProfile from './Pages/PublicSellerProfile';

// ---------- Brand Portal (public figures, no selling) ----------
import RequireBrand from './brand/RequireBrand';
import BrandSignup from './brand/BrandSignup';
import BrandLogin from './brand/BrandLogin';
import BrandVerificationHome from './brand/BrandVerificationHome';
import BrandPublicProfile from './brand/BrandPublicProfile';

// ---------- Seller Portal ----------
import RequireSeller from './seller/RequireSeller';
import SellerLayout from './seller/SellerLayout';
import SellerLogin from './seller/SellerLogin';
import SellerHome from './seller/SellerHome';
import SellerScan from './seller/SellerScan';
import SellerReceive from './seller/SellerReceive';
import SellerTransfer from './seller/SellerTransfer';
import SellerSignup from './seller/SellerSignup';
import SellerVerificationHome from './seller/verification/SellerVerificationHome';

// ---------- Admin Portal ----------
import RequireAdmin from './admin/RequireAdmin';
import AdminLayout from './admin/AdminLayout';
import AdminLogin from './admin/AdminLogin';
import AdminDashboard from './admin/AdminDashboard';
import AdminSellers from './admin/AdminSellers';
import AdminSellerDetail from './admin/AdminSellerDetail';
import AdminActiveSellers from './admin/AdminActiveSellers';
import AdminUsers from './admin/AdminUsers';
import AdminAuditLog from './admin/AdminAuditLog';

// Admin — Manufacturer management
import AdminManufacturerApplications from './admin/AdminManufacturerApplications';
import AdminManufacturerApplicationDetail from './admin/AdminManufacturerApplicationDetail';
import AdminManufacturers from './admin/AdminManufacturers';
import AdminManufacturerDetail from './admin/AdminManufacturerDetail';

// Admin — Scan Analytics + AI Predictions
import AdminScanAnalytics from './admin/AdminScanAnalytics';
import AdminScanPredictions from './admin/AdminScanPredictions';

// Admin — Seller Verifications workspace
import SellerVerificationsPage from './admin/SellerVerificationsPage';

// Admin — Verified Sellers Directory
import VerifiedSellersDirectory from './admin/VerifiedSellersDirectory';

// Admin — Brand Verifications workspace
import AdminBrandVerifications from './admin/AdminBrandVerifications';

// Admin — Verified Brands Directory
import AdminVerifiedBrands from './admin/AdminVerifiedBrands';

// ---------- Manufacturer Portal ----------
import ManufacturerLogin from './manufacturer/ManufacturerLogin';
import ManufacturerSignup from './manufacturer/ManufacturerSignup';
import RequireManufacturer from './manufacturer/RequireManufacturer';
import ManufacturerLayout from './manufacturer/ManufacturerLayout';
import ManufacturerHome from './manufacturer/ManufacturerHome';
import ManufacturerNotifications from './manufacturer/ManufacturerNotifications';
import ManufacturerBatches from './manufacturer/ManufacturerBatches';
import ManufacturerProducts from './manufacturer/ManufacturerProducts';
import ManufacturerProductDetail from './manufacturer/ManufacturerProductDetail';
import ManufacturerNewBatch from './manufacturer/ManufacturerNewBatch';
import ManufacturerBatchDetail from './manufacturer/ManufacturerBatchDetail';
import ManufacturerGenerateQr from './manufacturer/ManufacturerGenerateQr';
import ManufacturerActivation from './manufacturer/ManufacturerActivation';
import ManufacturerShipments from './manufacturer/ManufacturerShipments';
import ManufacturerReconciliation from './manufacturer/ManufacturerReconciliation';
import ManufacturerRecalls from './manufacturer/ManufacturerRecalls';
import ManufacturerStaff from './manufacturer/ManufacturerStaff';

// ---------- Consumer (User) Portal ----------
import RequireConsumer from './consumer/RequireConsumer';
import ConsumerLayout from './consumer/ConsumerLayout';
import ConsumerLogin from './consumer/ConsumerLogin';
import ConsumerSignup from './consumer/ConsumerSignup';
import ConsumerHome from './consumer/ConsumerHome';
import ConsumerHistory from './consumer/ConsumerHistory';
import ConsumerSaved from './consumer/ConsumerSaved';
import ConsumerAlerts from './consumer/ConsumerAlerts';
import ConsumerProfile from './consumer/ConsumerProfile';

/* ============================================================
   PUBLIC PAGE WRAPPERS
   ============================================================ */

/**
 * HomePageWrapper
 * ───────────────
 * The Header calls onNavigate(path) with a real route path
 * (e.g. '/brand/signup', '/verify', '/'), so we pass it through
 * directly. Legacy keyword callers (Home/Verify) still work via
 * the map fallback.
 */
function HomePageWrapper() {
  const navigate = useNavigate();

  const handleNavigate = (target) => {
    // If the target already looks like a route path, use it directly.
    if (typeof target === 'string' && target.startsWith('/')) {
      navigate(target);
      return;
    }

    // Legacy keyword support (kept for any older callers).
    const map = {
      Home: '/',
      home: '/',
      Verify: '/verify',
      verify: '/verify',
    };
    navigate(map[target] || '/');
  };

  return <Home onNavigate={handleNavigate} />;
}

function VerifyPageWrapper() {
  const navigate = useNavigate();

  const handleNavigate = (target) => {
    if (typeof target === 'string' && target.startsWith('/')) {
      navigate(target);
      return;
    }
    const map = {
      Home: '/',
      home: '/',
      Verify: '/verify',
      verify: '/verify',
    };
    navigate(map[target] || '/');
  };

  return <VerifyPage onNavigate={handleNavigate} />;
}

/* ============================================================
   SELLER PAGE WRAPPERS
   ============================================================ */
function SellerLayoutWrapper() {
  const { seller } = useOutletContext();
  return <SellerLayout seller={seller} />;
}
function SellerHomeWrapper() {
  const { seller } = useOutletContext();
  return <SellerHome seller={seller} />;
}
function SellerScanWrapper() {
  const { seller } = useOutletContext();
  return <SellerScan seller={seller} />;
}
function SellerReceiveWrapper() {
  const { seller } = useOutletContext();
  return <SellerReceive seller={seller} />;
}
function SellerTransferWrapper() {
  const { seller } = useOutletContext();
  return <SellerTransfer seller={seller} />;
}

/* ============================================================
   ADMIN PAGE WRAPPERS
   ============================================================ */
function AdminLayoutWrapper() {
  const { admin } = useOutletContext();
  return <AdminLayout admin={admin} />;
}
function AdminDashboardWrapper() {
  const { admin } = useOutletContext();
  return <AdminDashboard admin={admin} />;
}
function AdminSellersWrapper() {
  const { admin } = useOutletContext();
  return <AdminSellers admin={admin} />;
}
function AdminSellerDetailWrapper() {
  const { admin } = useOutletContext();
  return <AdminSellerDetail admin={admin} />;
}
function AdminActiveSellersWrapper() {
  const { admin } = useOutletContext();
  return <AdminActiveSellers admin={admin} />;
}
function AdminUsersWrapper() {
  const { admin } = useOutletContext();
  return <AdminUsers admin={admin} />;
}
function AdminAuditLogWrapper() {
  const { admin } = useOutletContext();
  return <AdminAuditLog admin={admin} />;
}

function AdminManufacturerApplicationsWrapper() {
  const { admin } = useOutletContext();
  return <AdminManufacturerApplications admin={admin} />;
}
function AdminManufacturerApplicationDetailWrapper() {
  const { admin } = useOutletContext();
  return <AdminManufacturerApplicationDetail admin={admin} />;
}
function AdminManufacturersWrapper() {
  const { admin } = useOutletContext();
  return <AdminManufacturers admin={admin} />;
}
function AdminManufacturerDetailWrapper() {
  const { admin } = useOutletContext();
  return <AdminManufacturerDetail admin={admin} />;
}

function AdminScanAnalyticsWrapper() {
  const { admin } = useOutletContext();
  return <AdminScanAnalytics admin={admin} />;
}
function AdminScanPredictionsWrapper() {
  const { admin } = useOutletContext();
  return <AdminScanPredictions admin={admin} />;
}

// Admin — Brand Verifications wrapper (passes admin for consistency)
function AdminBrandVerificationsWrapper() {
  const { admin } = useOutletContext();
  return <AdminBrandVerifications admin={admin} />;
}

// Admin — Verified Brands wrapper (passes admin for consistency)
function AdminVerifiedBrandsWrapper() {
  const { admin } = useOutletContext();
  return <AdminVerifiedBrands admin={admin} />;
}

/* ============================================================
   MANUFACTURER PAGE WRAPPERS
   ============================================================ */
function ManufacturerLayoutWrapper() {
  const { manufacturer, staff } = useOutletContext();
  return <ManufacturerLayout manufacturer={manufacturer} staff={staff} />;
}
function ManufacturerHomeWrapper() {
  const { manufacturer, staff } = useOutletContext();
  return <ManufacturerHome manufacturer={manufacturer} staff={staff} />;
}
function ManufacturerNotificationsWrapper() {
  const { manufacturer, staff } = useOutletContext();
  return <ManufacturerNotifications manufacturer={manufacturer} staff={staff} />;
}
function ManufacturerBatchesWrapper() {
  const { manufacturer, staff } = useOutletContext();
  return <ManufacturerBatches manufacturer={manufacturer} staff={staff} />;
}
function ManufacturerProductsWrapper() {
  const { manufacturer, staff } = useOutletContext();
  return <ManufacturerProducts manufacturer={manufacturer} staff={staff} />;
}
function ManufacturerProductDetailWrapper() {
  const { manufacturer, staff } = useOutletContext();
  return <ManufacturerProductDetail manufacturer={manufacturer} staff={staff} />;
}
function ManufacturerNewBatchWrapper() {
  const { manufacturer, staff } = useOutletContext();
  return <ManufacturerNewBatch manufacturer={manufacturer} staff={staff} />;
}
function ManufacturerBatchDetailWrapper() {
  const { manufacturer, staff } = useOutletContext();
  return <ManufacturerBatchDetail manufacturer={manufacturer} staff={staff} />;
}
function ManufacturerGenerateQrWrapper() {
  const { manufacturer, staff } = useOutletContext();
  return <ManufacturerGenerateQr manufacturer={manufacturer} staff={staff} />;
}
function ManufacturerActivationWrapper() {
  const { manufacturer, staff } = useOutletContext();
  return <ManufacturerActivation manufacturer={manufacturer} staff={staff} />;
}
function ManufacturerShipmentsWrapper() {
  const { manufacturer, staff } = useOutletContext();
  return <ManufacturerShipments manufacturer={manufacturer} staff={staff} />;
}
function ManufacturerReconciliationWrapper() {
  const { manufacturer, staff } = useOutletContext();
  return <ManufacturerReconciliation manufacturer={manufacturer} staff={staff} />;
}
function ManufacturerRecallsWrapper() {
  const { manufacturer, staff } = useOutletContext();
  return <ManufacturerRecalls manufacturer={manufacturer} staff={staff} />;
}
function ManufacturerStaffWrapper() {
  const { manufacturer, staff } = useOutletContext();
  return <ManufacturerStaff manufacturer={manufacturer} staff={staff} />;
}

/* ============================================================
   CONSUMER (USER) PAGE WRAPPERS
   ============================================================ */
function ConsumerLayoutWrapper() {
  const { consumer } = useOutletContext();
  return <ConsumerLayout consumer={consumer} />;
}
function ConsumerHomeWrapper() {
  const { consumer } = useOutletContext();
  return <ConsumerHome consumer={consumer} />;
}
function ConsumerHistoryWrapper() {
  const { consumer } = useOutletContext();
  return <ConsumerHistory consumer={consumer} />;
}
function ConsumerSavedWrapper() {
  const { consumer } = useOutletContext();
  return <ConsumerSaved consumer={consumer} />;
}
function ConsumerAlertsWrapper() {
  const { consumer } = useOutletContext();
  return <ConsumerAlerts consumer={consumer} />;
}
function ConsumerProfileWrapper() {
  const { consumer } = useOutletContext();
  return <ConsumerProfile consumer={consumer} />;
}

/* ============================================================
   APP ROOT
   ============================================================ */
function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* ================================================
           PUBLIC
           ================================================ */}
        <Route path="/" element={<HomePageWrapper />} />
        <Route path="/verify" element={<VerifyPageWrapper />} />
        <Route path="/verify-lookup" element={<VerifyLookup />} />
        <Route path="/s/:slug" element={<PublicSellerProfile />} />
        <Route path="/b/:slug" element={<BrandPublicProfile />} />

        {/* ================================================
           BRAND — public (signup / login)
           ================================================ */}
        <Route path="/brand/signup" element={<BrandSignup />} />
        <Route path="/brand/login" element={<BrandLogin />} />

        {/* ================================================
           BRAND — protected verification workspace
           ================================================ */}
        <Route path="/brand" element={<RequireBrand />}>
          <Route index element={<Navigate to="/brand/verification" replace />} />
          <Route path="verification" element={<BrandVerificationHome />} />
        </Route>

        {/* ================================================
           SELLER — auth entry points (no guard)
           ================================================ */}
        <Route path="/seller/login" element={<SellerLogin />} />
        <Route path="/seller/signup" element={<SellerSignup />} />

        {/* ================================================
           SELLER — protected portal
           ================================================ */}
        <Route path="/seller" element={<RequireSeller />}>
          <Route element={<SellerLayoutWrapper />}>
            <Route index element={<Navigate to="/seller/home" replace />} />
            <Route path="home" element={<SellerHomeWrapper />} />
            <Route path="scan" element={<SellerScanWrapper />} />
            <Route path="receive" element={<SellerReceiveWrapper />} />
            <Route path="transfer" element={<SellerTransferWrapper />} />
            <Route path="verification" element={<SellerVerificationHome />} />
          </Route>
        </Route>

        {/* ================================================
           ADMIN — auth entry point (no guard)
           ================================================ */}
        <Route path="/admin/login" element={<AdminLogin />} />

        {/* ================================================
           ADMIN — protected console
           ================================================ */}
        <Route path="/admin" element={<RequireAdmin />}>
          <Route element={<AdminLayoutWrapper />}>
            <Route index element={<Navigate to="/admin/dashboard" replace />} />
            <Route path="dashboard" element={<AdminDashboardWrapper />} />

            {/* ---- Seller management ---- */}
            <Route path="sellers" element={<AdminSellersWrapper />} />
            <Route path="sellers/:id" element={<AdminSellerDetailWrapper />} />
            <Route path="active" element={<AdminActiveSellersWrapper />} />

            {/* ---- Legacy alias so older dashboard links keep working ---- */}
            <Route
              path="approvals"
              element={<Navigate to="/admin/sellers" replace />}
            />
            <Route
              path="approvals/:id"
              element={<AdminSellerDetailWrapper />}
            />

            {/* ---- Manufacturer management ---- */}
            <Route
              path="manufacturer-applications"
              element={<AdminManufacturerApplicationsWrapper />}
            />
            <Route
              path="manufacturer-applications/:id"
              element={<AdminManufacturerApplicationDetailWrapper />}
            />
            <Route
              path="manufacturers"
              element={<AdminManufacturersWrapper />}
            />
            <Route
              path="manufacturers/:id"
              element={<AdminManufacturerDetailWrapper />}
            />

            {/* ---- Admin utilities ---- */}
            <Route path="users" element={<AdminUsersWrapper />} />
            <Route path="audit" element={<AdminAuditLogWrapper />} />

            {/* ---- Scan Analytics + AI Predictions ---- */}
            <Route
              path="scan-analytics"
              element={<AdminScanAnalyticsWrapper />}
            />
            <Route
              path="scan-predictions"
              element={<AdminScanPredictionsWrapper />}
            />

            {/* ---- Seller verifications workspace ---- */}
            <Route
              path="seller-verifications"
              element={<SellerVerificationsPage />}
            />

            {/* ---- Verified sellers directory ---- */}
            <Route
              path="verified-sellers"
              element={<VerifiedSellersDirectory />}
            />

            {/* ---- Brand verifications workspace ---- */}
            <Route
              path="brand-verifications"
              element={<AdminBrandVerificationsWrapper />}
            />
            <Route
              path="brand-verifications/:brandUid"
              element={<AdminBrandVerificationsWrapper />}
            />

            {/* ---- Verified brands directory ---- */}
            <Route
              path="verified-brands"
              element={<AdminVerifiedBrandsWrapper />}
            />
          </Route>
        </Route>

        {/* ================================================
           MANUFACTURER — auth entry points (no guard)
           ================================================ */}
        <Route path="/manufacturer/login" element={<ManufacturerLogin />} />
        <Route path="/manufacturer/signup" element={<ManufacturerSignup />} />

        {/* ================================================
           MANUFACTURER — protected portal
           ================================================ */}
        <Route path="/manufacturer" element={<RequireManufacturer />}>
          <Route element={<ManufacturerLayoutWrapper />}>
            <Route index element={<Navigate to="/manufacturer/home" replace />} />
            <Route path="home" element={<ManufacturerHomeWrapper />} />
            <Route path="notifications" element={<ManufacturerNotificationsWrapper />} />
            <Route path="batches" element={<ManufacturerBatchesWrapper />} />
            <Route path="products" element={<ManufacturerProductsWrapper />} />
            <Route path="products/:id" element={<ManufacturerProductDetailWrapper />} />
            <Route path="new-batch" element={<ManufacturerNewBatchWrapper />} />
            <Route path="batches/:id" element={<ManufacturerBatchDetailWrapper />} />
            <Route path="batches/:id/generate-qr" element={<ManufacturerGenerateQrWrapper />} />
            <Route path="activation" element={<ManufacturerActivationWrapper />} />
            <Route path="shipments" element={<ManufacturerShipmentsWrapper />} />
            <Route path="reconciliation" element={<ManufacturerReconciliationWrapper />} />
            <Route path="recalls" element={<ManufacturerRecallsWrapper />} />
            <Route path="staff" element={<ManufacturerStaffWrapper />} />
          </Route>
        </Route>

        {/* ================================================
           CONSUMER (USER) — auth entry points (no guard)
           ================================================ */}
        <Route path="/consumer/login" element={<ConsumerLogin />} />
        <Route path="/consumer/signup" element={<ConsumerSignup />} />

        {/* ================================================
           CONSUMER (USER) — protected portal
           ================================================ */}
        <Route path="/consumer" element={<RequireConsumer />}>
          <Route element={<ConsumerLayoutWrapper />}>
            <Route index element={<Navigate to="/consumer/home" replace />} />
            <Route path="home" element={<ConsumerHomeWrapper />} />
            <Route path="history" element={<ConsumerHistoryWrapper />} />
            <Route path="saved" element={<ConsumerSavedWrapper />} />
            <Route path="alerts" element={<ConsumerAlertsWrapper />} />
            <Route path="profile" element={<ConsumerProfileWrapper />} />
          </Route>
        </Route>

        {/* ================================================
           FALLBACK — keep this last
           ================================================ */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;