import React, { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './context/AuthContext';
import { SearchProvider } from './context/SearchContext';
import { LanguageProvider } from './context/LanguageContext';
import { NotificationProvider } from './context/NotificationContext';
import { SystemPauseProvider } from './context/SystemPauseContext';
import { DelayProvider } from './context/DelayContext';
import { SystemControlProvider, useSystemControl } from './context/SystemControlContext';
import Layout from './components/Layout';
import ErrorBoundary from './components/ErrorBoundary';
import { ThemeProvider } from './context/ThemeContext';
import { ShieldAlert } from 'lucide-react';

// All pages lazy-loaded — each becomes its own chunk
const Login = lazy(() => import('./pages/Login'));
const MarketingDashboard = lazy(() => import('./pages/MarketingDashboard'));
const AdminDashboard = lazy(() => import('./pages/AdminDashboard'));
const MyTasks = lazy(() => import('./pages/MyTasks'));
const OrderEntry = lazy(() => import('./pages/OrderEntry'));
const InventoryManagement = lazy(() => import('./pages/InventoryManagement'));
const AllOrders = lazy(() => import('./pages/AllOrders'));
const History = lazy(() => import('./pages/History'));
const ProgressChart = lazy(() => import('./pages/ProgressChart'));
const DeliveryDashboard = lazy(() => import('./pages/DeliveryDashboard'));
const DeliverySheet = lazy(() => import('./pages/DeliverySheet'));
const WarehouseDashboard = lazy(() => import('./pages/WarehouseDashboard'));
const OutletStockRequest = lazy(() => import('./pages/OutletStockRequest'));
const EditRequestDashboard = lazy(() => import('./pages/EditRequestDashboard'));
const DeletedOrders = lazy(() => import('./pages/DeletedOrders'));
const ProductionDashboard = lazy(() => import('./pages/ProductionDashboard'));
const RefundManagement = lazy(() => import('./pages/RefundManagement'));
const OfficeSupply = lazy(() => import('./pages/OfficeSupply'));
const UnifiedAnalytics = lazy(() => import('./pages/UnifiedAnalytics'));
const ClientRegistration = lazy(() => import('./pages/ClientRegistration'));
const OutletPOS = lazy(() => import('./pages/OutletPOS'));
const OutletPOSInventory = lazy(() => import('./pages/OutletPOSInventory'));
const OutletTransfers = lazy(() => import('./pages/OutletTransfers'));
const OrderTrack = lazy(() => import('./pages/OrderTrack'));
const OutletOrderEntry = lazy(() => import('./pages/OutletOrderEntry'));
const OutletDashboard = lazy(() => import('./pages/OutletDashboard'));
const OutletJournalPage = lazy(() => import('./pages/OutletJournalPage'));
const BankDepositPage = lazy(() => import('./pages/BankDepositPage'));
const ChatPage = lazy(() => import('./pages/ChatPage'));
const NotesPage = lazy(() => import('./pages/NotesPage'));
const DispatchDashboard = lazy(() => import('./pages/DispatchDashboard'));
const DispatchPage = lazy(() => import('./pages/DispatchPage'));
const InDispatch = lazy(() => import('./pages/InDispatch'));
const GatePass = lazy(() => import('./pages/GatePass'));
const StoreDashboardPage = lazy(() => import('./pages/StoreDashboardPage'));
const AlterationRequest = lazy(() => import('./pages/AlterationRequest'));
const AlterationProduction = lazy(() => import('./pages/AlterationProduction'));
const EngravingRequest = lazy(() => import('./pages/EngravingRequest'));
const EngravingQueue = lazy(() => import('./pages/EngravingQueue'));
const VerificationPage = lazy(() => import('./pages/VerificationPage'));
const ReturnedFromVerification = lazy(() => import('./pages/ReturnedFromVerification'));
const ReturnExchangePage = lazy(() => import('./pages/ReturnExchangePage'));
const CustomerFeedbackForm = lazy(() => import('./pages/CustomerFeedbackForm'));
const NotificationHistory = lazy(() => import('./pages/NotificationHistory'));
const CEODashboard = lazy(() => import('./pages/CEODashboard'));
const WarehouseAudit = lazy(() => import('./components/WarehouseAudit'));
const AuditReview = lazy(() => import('./pages/AuditReview'));
const StoreReturns = lazy(() => import('./pages/StoreReturns'));
const FaisalReplacements = lazy(() => import('./pages/FaisalReplacements'));
const StoreReplacements = lazy(() => import('./pages/StoreReplacements'));
const OrderCancellations = lazy(() => import('./pages/OrderCancellations'));
const FaisalOrderCancellation = lazy(() => import('./pages/FaisalOrderCancellation'));
const SoftwareSettings = lazy(() => import('./pages/SoftwareSettings'));
const StoreOrderTracker = lazy(() => import('./pages/StoreOrderTracker'));
const StoreOrders = lazy(() => import('./pages/StoreOrders'));
const PostExDashboard = lazy(() => import('./pages/PostExDashboard'));
const DemandDeliveriesHistory = lazy(() => import('./pages/DemandDeliveriesHistory'));
const AsmPage = lazy(() => import('./pages/AsmPage'));
const VendorsPage = lazy(() => import('./pages/VendorsPage'));
const AsmAllowedStorePage = lazy(() => import('./pages/AsmAllowedStorePage'));
const ProductDataPage = lazy(() => import('./pages/ProductDataPage'));
const OutletOrderLookup = lazy(() => import('./pages/OutletOrderLookup'));
const OutletInvoiceQuotation = lazy(() => import('./pages/OutletInvoiceQuotation'));

const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <div>Loading...</div>;
  if (!user) return <Navigate to="/login" />;
  const role = String(user?.role || '').toUpperCase().trim();
  if (role === 'MARKETING' && location.pathname !== '/marketing') {
    return <Navigate to="/marketing" replace />;
  }
  return children;
};

const OutletBlockedRoute = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return <div>Loading...</div>;
  const role = String(user?.role || '').toUpperCase().trim();
  if (role === 'OUTLET') return <Navigate to="/" replace />;
  return children;
};

const JoharTownGatePassRoute = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return <div>Loading...</div>;
  const role = String(user?.role || '').toUpperCase().trim();
  if (role === 'OUTLET') {
    const n = String(user?.name || '').toLowerCase();
    const isJohar = n.includes('johar') || user?.name?.includes('1');
    if (!isJohar) return <Navigate to="/" replace />;
  }
  return children;
};

const JoharTownOnlyRoute = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return <div>Loading...</div>;
  const role = String(user?.role || '').toUpperCase().trim();
  if (role === 'OUTLET') {
    const n = String(user?.name || '').toLowerCase();
    const isJohar = n.includes('johar') || user?.name?.includes('1');
    if (!isJohar) return <Navigate to="/" replace />;
  }
  return children;
};

const AdminBlockedRoute = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return <div>Loading...</div>;
  const role = String(user?.role || '').toUpperCase().trim();
  if (role === 'SUPER_ADMIN' || role === 'ADMIN') return <Navigate to="/" replace />;
  return children;
};

const OfficeSupplyRoute = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return <div>Loading...</div>;
  const role = String(user?.role || '').toUpperCase().trim();
  if (role === 'SUPER_ADMIN' || role === 'ADMIN') return <Navigate to="/" replace />;
  if (role === 'OUTLET') {
    const n = String(user?.name || '').toLowerCase();
    const isJohar = n.includes('johar') || user?.name?.includes('1');
    const isJail = n.includes('jail') || user?.name?.includes('2');
    if (!isJohar && !isJail) return <Navigate to="/" replace />;
  }
  return children;
};

const PermittedRoute = ({ feature, children }) => {
  const { hasPermission, loading } = useSystemControl();
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }
  // When a feature is disabled in Software Settings, completely remove access and redirect silently without showing an error or permission note
  if (feature && !hasPermission(feature)) {
    return <Navigate to="/" replace />;
  }
  return children;
};

const MyTasksRoute = ({ children }) => {
  const { user } = useAuth();
  const role = String(user?.role || '').toUpperCase().trim();
  const feature = role === 'OUTLET' ? 'OUTLET_TASKS' : 'STORE_TASKS';
  return <PermittedRoute feature={feature}>{children}</PermittedRoute>;
};

const AuthRedirectHandler = () => {
  const { user } = useAuth();
  const { hasPermission } = useSystemControl();
  if (!user) return <Navigate to="/login" replace={true} />;
  
  const role = String(user.role || '').toUpperCase().trim();
  
  if (role === 'SUPER_ADMIN' || role === 'ADMIN') {
    if (hasPermission('DASHBOARD_VIEW')) return <Navigate to="/dashboard" replace={true} />;
    if (hasPermission('ORDER_VIEW')) return <Navigate to="/orders" replace={true} />;
    if (hasPermission('PRODUCT_DATA_VIEW')) return <Navigate to="/product-data" replace={true} />;
    return <Navigate to="/software-settings" replace={true} />;
  }
  if (role === 'FAISAL') {
    if (hasPermission('ORDER_ENTRY')) return <Navigate to="/order-entry" replace={true} />;
    if (hasPermission('ORDER_VIEW')) return <Navigate to="/orders" replace={true} />;
    if (hasPermission('STORE_REPLACEMENTS')) return <Navigate to="/replacements" replace={true} />;
    if (hasPermission('ORDER_CANCEL')) return <Navigate to="/order-cancellation" replace={true} />;
    if (hasPermission('DISPATCH_TASKS')) return <Navigate to="/delivery-sheet" replace={true} />;
    return <Navigate to="/notes" replace={true} />;
  }
  if (role === 'ORDER_ENTRY') {
    if (hasPermission('ORDER_ENTRY')) return <Navigate to="/order-entry" replace={true} />;
    if (hasPermission('DASHBOARD_VIEW')) return <Navigate to="/dashboard" replace={true} />;
    if (hasPermission('ORDER_VIEW')) return <Navigate to="/orders" replace={true} />;
    return <Navigate to="/notes" replace={true} />;
  }
  if (role === 'OUTLET') {
    if (hasPermission('OUTLET_DASHBOARD')) return <Navigate to="/outlet-dashboard" replace={true} />;
    if (hasPermission('OUTLET_POS')) return <Navigate to="/pos" replace={true} />;
    if (hasPermission('OUTLET_ORDER_VIEW')) return <Navigate to="/outlet-orders" replace={true} />;
    if (hasPermission('OUTLET_ORDER_ENTRY')) return <Navigate to="/outlet-order-entry" replace={true} />;
    if (hasPermission('OUTLET_TASKS')) return <Navigate to="/tasks" replace={true} />;
    if (hasPermission('BANK_DEPOSIT')) return <Navigate to="/bank-deposit" replace={true} />;
    if (hasPermission('GENERAL_ENTRIES')) return <Navigate to="/journal" replace={true} />;
    if (hasPermission('OUTLET_TRANSFERS')) return <Navigate to="/transfers" replace={true} />;
    if (hasPermission('ORDER_TRACK')) return <Navigate to="/order-track" replace={true} />;
    if (hasPermission('OUTLET_STOCK_REQUEST')) return <Navigate to="/outlet-requests" replace={true} />;
    return <Navigate to="/chat" replace={true} />;
  }
  if (role === 'PRODUCTION') {
    if (hasPermission('PRODUCTION_DASHBOARD')) return <Navigate to="/production" replace={true} />;
    if (hasPermission('STORE_TASKS')) return <Navigate to="/tasks" replace={true} />;
    if (hasPermission('ALTERATION_PRODUCTION')) return <Navigate to="/alteration-production" replace={true} />;
    return <Navigate to="/chat" replace={true} />;
  }
  if (role === 'DISPATCH') {
    if (hasPermission('DISPATCH_DASHBOARD')) return <Navigate to="/dispatch-dashboard" replace={true} />;
    if (hasPermission('DISPATCH_TASKS')) return <Navigate to="/dispatch" replace={true} />;
    return <Navigate to="/chat" replace={true} />;
  }
  if (role === 'DELIVERY_BOY') {
    if (hasPermission('DELIVERY_DASHBOARD')) return <Navigate to="/delivery" replace={true} />;
    if (hasPermission('REFUND_MANAGEMENT')) return <Navigate to="/refund-management" replace={true} />;
    return <Navigate to="/chat" replace={true} />;
  }
  if (role === 'STORE') {
    if (hasPermission('STORE_DASHBOARD')) return <Navigate to="/store-dashboard" replace={true} />;
    if (hasPermission('WAREHOUSE_VIEW')) return <Navigate to="/warehouse" replace={true} />;
    if (hasPermission('STORE_TASKS')) return <Navigate to="/tasks" replace={true} />;
    if (hasPermission('STORE_INVENTORY_AUDIT')) return <Navigate to="/audit" replace={true} />;
    if (hasPermission('STORE_RETURNS')) return <Navigate to="/returns" replace={true} />;
    if (hasPermission('STORE_REPLACEMENTS')) return <Navigate to="/store-replacements" replace={true} />;
    if (hasPermission('ORDER_VIEW')) return <Navigate to="/store-orders" replace={true} />;
    return <Navigate to="/chat" replace={true} />;
  }
  if (role === 'INVENTORY_VIEW') {
    if (hasPermission('ORDER_TRACK')) return <Navigate to="/order-track" replace={true} />;
    if (hasPermission('STORE_INVENTORY_AUDIT')) return <Navigate to="/verification" replace={true} />;
    if (hasPermission('STORE_RETURNS')) return <Navigate to="/return-exchange" replace={true} />;
    return <Navigate to="/chat" replace={true} />;
  }
  if (role === 'CEO') {
    if (hasPermission('CEO_DASHBOARD_VIEW')) return <Navigate to="/ceo-dashboard" replace={true} />;
    if (hasPermission('PRODUCT_DATA_VIEW')) return <Navigate to="/product-data" replace={true} />;
    if (hasPermission('ORDER_VIEW')) return <Navigate to="/orders" replace={true} />;
    return <Navigate to="/chat" replace={true} />;
  }
  if (role === 'SOFTWARE_SETTINGS') return <Navigate to="/software-settings" replace={true} />;
  if (role === 'ASM') {
    if (hasPermission('ASM_DASHBOARD')) return <Navigate to="/asm" replace={true} />;
    return <Navigate to="/chat" replace={true} />;
  }
  if (role === 'MARKETING') {
    if (hasPermission('MARKETING_DASHBOARD')) return <Navigate to="/marketing" replace={true} />;
    return <Navigate to="/chat" replace={true} />;
  }
  
  return <Navigate to="/chat" replace={true} />;
};

function App() {
  return (
    <AuthProvider>
      <SystemControlProvider>
        <ThemeProvider>
          <LanguageProvider>
          <SearchProvider>
            <NotificationProvider>
            <SystemPauseProvider>
            <DelayProvider>
            <Toaster position="top-right" toastOptions={{ className: 'glass text-white font-black', style: { background: '#111827', border: '1px solid #1f2937' } }} />
            <Router>
              <ErrorBoundary>
              <Routes>
                <Route path="/login" element={
                  <Suspense fallback={<div className="flex items-center justify-center h-screen"><div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div></div>}>
                    <Login />
                  </Suspense>
                } />
                
                <Route path="/feedback" element={
                  <Suspense fallback={<div className="flex items-center justify-center h-screen"><div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div></div>}>
                    <CustomerFeedbackForm />
                  </Suspense>
                } />
                
                <Route path="/progress" element={
                  <ProtectedRoute>
                    <Suspense fallback={<div className="flex items-center justify-center h-screen"><div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div></div>}>
                      <ProgressChart />
                    </Suspense>
                  </ProtectedRoute>
                } />
                
                <Route path="/" element={
                  <ProtectedRoute>
                    <Suspense fallback={<div className="flex items-center justify-center h-screen"><div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div></div>}>
                      <Layout />
                    </Suspense>
                  </ProtectedRoute>
                }>
                  <Route index element={
                    <AuthRedirectHandler />
                  } />
                  <Route path="dashboard" element={<PermittedRoute feature="DASHBOARD_VIEW"><AdminDashboard /></PermittedRoute>} />
                  <Route path="product-data" element={<PermittedRoute feature="PRODUCT_DATA_VIEW"><ProductDataPage /></PermittedRoute>} />
                  <Route path="inventory" element={<PermittedRoute feature="WAREHOUSE_VIEW"><InventoryManagement /></PermittedRoute>} />
                  <Route path="tasks" element={<MyTasksRoute><MyTasks /></MyTasksRoute>} />
                  <Route path="order-entry" element={<PermittedRoute feature="ORDER_ENTRY"><OrderEntry /></PermittedRoute>} />
                  <Route path="outlet-order-entry" element={<PermittedRoute feature="OUTLET_ORDER_ENTRY"><OutletOrderEntry /></PermittedRoute>} />
                  <Route path="order-edit" element={<PermittedRoute feature="ORDER_EDIT"><Navigate to="/order-entry?edit=1" replace /></PermittedRoute>} />
                  <Route path="orders" element={<PermittedRoute feature="ORDER_VIEW"><AllOrders /></PermittedRoute>} />
                  <Route path="history" element={<PermittedRoute feature="ORDER_VIEW"><History /></PermittedRoute>} />
                  <Route path="delivery" element={<PermittedRoute feature="DELIVERY_DASHBOARD"><DeliveryDashboard /></PermittedRoute>} />
                  <Route path="delivery-sheet" element={<PermittedRoute feature="DISPATCH_TASKS"><DeliverySheet /></PermittedRoute>} />
                  <Route path="warehouse" element={<PermittedRoute feature="WAREHOUSE_VIEW"><WarehouseDashboard /></PermittedRoute>} />
                  <Route path="outlet-requests" element={<PermittedRoute feature="OUTLET_STOCK_REQUEST"><OutletStockRequest /></PermittedRoute>} />
                  <Route path="outlet-dashboard" element={<PermittedRoute feature="OUTLET_DASHBOARD"><OutletDashboard /></PermittedRoute>} />
                  <Route path="edit-requests" element={<PermittedRoute feature="ORDER_EDIT"><OutletBlockedRoute><EditRequestDashboard /></OutletBlockedRoute></PermittedRoute>} />
                  <Route path="deleted-orders" element={<PermittedRoute feature="ORDER_DELETE"><DeletedOrders /></PermittedRoute>} />
                  <Route path="analytics" element={<PermittedRoute feature="ANALYTICS_VIEW"><UnifiedAnalytics /></PermittedRoute>} />
                  <Route path="production" element={<PermittedRoute feature="PRODUCTION_DASHBOARD"><ProductionDashboard /></PermittedRoute>} />
                  <Route path="refund-management" element={<PermittedRoute feature="REFUND_MANAGEMENT"><RefundManagement /></PermittedRoute>} />
                  <Route path="clients" element={<PermittedRoute feature="OUTLET_ORDER_ENTRY"><ClientRegistration /></PermittedRoute>} />
                  <Route path="pos" element={<PermittedRoute feature="OUTLET_POS"><OutletPOS /></PermittedRoute>} />
                  <Route path="pos-inventory" element={<PermittedRoute feature="WAREHOUSE_VIEW"><OutletPOSInventory /></PermittedRoute>} />
                  <Route path="outlet-orders" element={<PermittedRoute feature="OUTLET_ORDER_VIEW"><OutletOrderLookup /></PermittedRoute>} />
                  <Route path="outlet-invoice-quotation" element={<PermittedRoute feature="OUTLET_INVOICE_QUOTATION"><JoharTownOnlyRoute><OutletInvoiceQuotation /></JoharTownOnlyRoute></PermittedRoute>} />
                  <Route path="transfers" element={<PermittedRoute feature="OUTLET_TRANSFERS"><OutletTransfers /></PermittedRoute>} />
                  <Route path="order-track" element={<PermittedRoute feature="ORDER_TRACK"><OrderTrack /></PermittedRoute>} />
                  <Route path="journal" element={<PermittedRoute feature="GENERAL_ENTRIES"><OutletJournalPage /></PermittedRoute>} />
                  <Route path="bank-deposit" element={<PermittedRoute feature="BANK_DEPOSIT"><BankDepositPage /></PermittedRoute>} />
                  <Route path="chat" element={<ChatPage />} />
                  <Route path="notes" element={<NotesPage />} />
                  <Route path="dispatch" element={<PermittedRoute feature="DISPATCH_TASKS"><DispatchPage /></PermittedRoute>} />
                  <Route path="dispatch-dashboard" element={<PermittedRoute feature="DISPATCH_DASHBOARD"><DispatchDashboard /></PermittedRoute>} />
                  <Route path="in-dispatch" element={<PermittedRoute feature="OUTLET_IN_DISPATCH"><InDispatch /></PermittedRoute>} />
                  <Route path="gate-pass" element={<PermittedRoute feature="OUTLET_GATE_PASS"><JoharTownGatePassRoute><GatePass /></JoharTownGatePassRoute></PermittedRoute>} />
                  <Route path="store-dashboard" element={<PermittedRoute feature="STORE_DASHBOARD"><StoreDashboardPage /></PermittedRoute>} />
                  <Route path="alteration-request" element={<PermittedRoute feature="ALTERATION_PRODUCTION"><AlterationRequest /></PermittedRoute>} />
                  <Route path="alteration-production" element={<PermittedRoute feature="ALTERATION_PRODUCTION"><AlterationProduction /></PermittedRoute>} />
                  <Route path="engraving-request" element={<PermittedRoute feature="ENGRAVING_QUEUE"><EngravingRequest /></PermittedRoute>} />
                  <Route path="engraving-queue" element={<PermittedRoute feature="ENGRAVING_QUEUE"><EngravingQueue /></PermittedRoute>} />
                  <Route path="verification" element={<PermittedRoute feature="STORE_INVENTORY_AUDIT"><VerificationPage /></PermittedRoute>} />
                  <Route path="returned-from-verification" element={<PermittedRoute feature="STORE_RETURNS"><ReturnedFromVerification /></PermittedRoute>} />
                  <Route path="return-exchange" element={<PermittedRoute feature="STORE_RETURNS"><ReturnExchangePage /></PermittedRoute>} />
                  <Route path="notifications" element={<NotificationHistory />} />
                  <Route path="ceo-dashboard" element={<PermittedRoute feature="CEO_DASHBOARD_VIEW"><CEODashboard /></PermittedRoute>} />
                  <Route path="audit" element={<PermittedRoute feature="STORE_INVENTORY_AUDIT"><WarehouseAudit /></PermittedRoute>} />
                  <Route path="audit-review" element={<PermittedRoute feature="STORE_INVENTORY_AUDIT"><AuditReview /></PermittedRoute>} />
                  <Route path="returns" element={<PermittedRoute feature="STORE_RETURNS"><StoreReturns /></PermittedRoute>} />
                  <Route path="replacements" element={<PermittedRoute feature="STORE_REPLACEMENTS"><FaisalReplacements /></PermittedRoute>} />
                  <Route path="store-replacements" element={<PermittedRoute feature="STORE_REPLACEMENTS"><StoreReplacements /></PermittedRoute>} />
                  <Route path="store-order-tracker" element={<PermittedRoute feature="ORDER_TRACK"><StoreOrderTracker /></PermittedRoute>} />
                  <Route path="store-orders" element={<PermittedRoute feature="ORDER_VIEW"><StoreOrders /></PermittedRoute>} />
                  <Route path="order-cancellations" element={<PermittedRoute feature="ORDER_CANCEL"><OrderCancellations /></PermittedRoute>} />
                  <Route path="order-cancellation" element={<PermittedRoute feature="ORDER_CANCEL"><FaisalOrderCancellation /></PermittedRoute>} />
                  <Route path="software-settings" element={<SoftwareSettings />} />
                  <Route path="postex-dashboard" element={<PermittedRoute feature="POSTEX_DASHBOARD"><AdminBlockedRoute><PostExDashboard /></AdminBlockedRoute></PermittedRoute>} />
                  <Route path="demand-history" element={<DemandDeliveriesHistory />} />
                  <Route path="asm" element={<PermittedRoute feature="ASM_DASHBOARD"><AsmPage /></PermittedRoute>} />
                  <Route path="asm-allowed" element={<PermittedRoute feature="STORE_ASM_ALLOCATION"><AdminBlockedRoute><AsmAllowedStorePage /></AdminBlockedRoute></PermittedRoute>} />
                  <Route path="vendors-admin" element={<PermittedRoute feature="ASM_VENDORS_ADMIN"><AdminBlockedRoute><VendorsPage /></AdminBlockedRoute></PermittedRoute>} />
                  <Route path="office-supply" element={<OfficeSupplyRoute><OfficeSupply /></OfficeSupplyRoute>} />
                  <Route path="marketing" element={<PermittedRoute feature="MARKETING_DASHBOARD"><MarketingDashboard /></PermittedRoute>} />
                </Route>
              </Routes>
              </ErrorBoundary>
            </Router>
            </DelayProvider>
            </SystemPauseProvider>
            </NotificationProvider>
          </SearchProvider>
        </LanguageProvider>
      </ThemeProvider>
      </SystemControlProvider>
    </AuthProvider>
  );
}

export default App;
