import React, { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './context/AuthContext';
import { SearchProvider } from './context/SearchContext';
import { LanguageProvider } from './context/LanguageContext';
import Layout from './components/Layout';
import Login from './pages/Login';
import AdminDashboard from './pages/AdminDashboard';
import MyTasks from './pages/MyTasks';
import { ThemeProvider } from './context/ThemeContext';

// Lazy-loaded route components — split into separate chunks
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
const UnifiedAnalytics = lazy(() => import('./pages/UnifiedAnalytics'));
const DispatchDashboard = lazy(() => import('./pages/DispatchDashboard'));

const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return <div>Loading...</div>;
  if (!user) return <Navigate to="/login" />;
  return children;
};

const AuthRedirectHandler = () => {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace={true} />;
  
  const role = String(user.role || '').toUpperCase().trim();
  
  if (role === 'SUPER_ADMIN' || role === 'ADMIN') return <Navigate to="/dashboard" replace={true} />;
  if (role === 'FAISAL' || role === 'ORDER_ENTRY') return <Navigate to="/dashboard" replace={true} />;
  if (role === 'OUTLET') return <Navigate to="/outlet-requests" replace={true} />;
  if (role === 'PRODUCTION') return <Navigate to="/tasks" replace={true} />;
  if (role === 'DELIVERY_BOY') return <Navigate to="/delivery" replace={true} />;
  if (role === 'STORE') return <Navigate to="/warehouse" replace={true} />;
  
  return <Navigate to="/tasks" replace={true} />;
};

function App() {
  return (
    <AuthProvider>
      <ThemeProvider>
        <LanguageProvider>
          <SearchProvider>
            <Toaster position="top-right" toastOptions={{ className: 'glass text-white font-black', style: { background: '#111827', border: '1px solid #1f2937' } }} />
            <Router>
              <Routes>
                <Route path="/login" element={<Login />} />
                
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
                  <Route path="dashboard" element={<AdminDashboard />} />
                  <Route path="inventory" element={<InventoryManagement />} />
                  <Route path="tasks" element={<MyTasks />} />
                  <Route path="order-entry" element={<OrderEntry />} />
                  <Route path="order-edit" element={<Navigate to="/order-entry?edit=1" replace />} />
                  <Route path="orders" element={<AllOrders />} />
                  <Route path="history" element={<History />} />
                  <Route path="delivery" element={<DeliveryDashboard />} />
                  <Route path="delivery-sheet" element={<DeliverySheet />} />
                  <Route path="dispatch" element={<DispatchDashboard />} />
                  <Route path="warehouse" element={<WarehouseDashboard />} />
                  <Route path="outlet-requests" element={<OutletStockRequest />} />
                  <Route path="edit-requests" element={<EditRequestDashboard />} />
                  <Route path="deleted-orders" element={<DeletedOrders />} />
                  <Route path="analytics" element={<UnifiedAnalytics />} />
                  <Route path="production" element={<ProductionDashboard />} />
                  <Route path="refund-management" element={<RefundManagement />} />
                </Route>
              </Routes>
            </Router>
          </SearchProvider>
        </LanguageProvider>
      </ThemeProvider>
    </AuthProvider>
  );
}

export default App;
