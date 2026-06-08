import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './context/AuthContext';
import { SearchProvider } from './context/SearchContext';
import { LanguageProvider } from './context/LanguageContext';
import Layout from './components/Layout';
import Login from './pages/Login';
import AdminDashboard from './pages/AdminDashboard';
import MyTasks from './pages/MyTasks';
import OrderEntry from './pages/OrderEntry';
import InventoryManagement from './pages/InventoryManagement';
import AllOrders from './pages/AllOrders';
import History from './pages/History';
import ProgressChart from './pages/ProgressChart';
import DeliveryDashboard from './pages/DeliveryDashboard';
import DeliverySheet from './pages/DeliverySheet';
import WarehouseDashboard from './pages/WarehouseDashboard';
import OutletStockRequest from './pages/OutletStockRequest';
import EditRequestDashboard from './pages/EditRequestDashboard';
import DeletedOrders from './pages/DeletedOrders';
import { ThemeProvider } from './context/ThemeContext';

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
                    <ProgressChart />
                  </ProtectedRoute>
                } />
                
                <Route path="/" element={
                  <ProtectedRoute>
                    <Layout />
                  </ProtectedRoute>
                }>
                  <Route index element={
                    <AuthRedirectHandler />
                  } />
                  <Route path="dashboard" element={<AdminDashboard />} />
                  <Route path="inventory" element={<InventoryManagement />} />
                  <Route path="tasks" element={<MyTasks />} />
                  <Route path="order-entry" element={<OrderEntry />} />
                  <Route path="orders" element={<AllOrders />} />
                  <Route path="history" element={<History />} />
                  <Route path="delivery" element={<DeliveryDashboard />} />
                  <Route path="delivery-sheet" element={<DeliverySheet />} />
                  <Route path="warehouse" element={<WarehouseDashboard />} />
                  <Route path="outlet-requests" element={<OutletStockRequest />} />
                  <Route path="edit-requests" element={<EditRequestDashboard />} />
                  <Route path="deleted-orders" element={<DeletedOrders />} />
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
