import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Layout from './components/Layout';
import Login from './pages/Login';
import AdminDashboard from './pages/AdminDashboard';
import MyTasks from './pages/MyTasks';
import OrderEntry from './pages/OrderEntry';
import InventoryManagement from './pages/InventoryManagement';
import AllOrders from './pages/AllOrders';
import History from './pages/History';
import ProgressChart from './pages/ProgressChart';
import SuperAdminDashboard from './pages/SuperAdminDashboard';
import { Toaster } from 'react-hot-toast';

const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return <div>Loading...</div>;
  if (!user) return <Navigate to="/login" />;
  return children;
};

const AuthRedirectHandler = () => {
  const { user } = useAuth();
  if (user?.role === 'SUPER_ADMIN') {
    return <Navigate to="/admin" replace={true} />;
  }
  if (user?.role === 'FAISAL' || user?.role === 'ORDER_ENTRY') {
    return <Navigate to="/dashboard" replace={true} />;
  }
  return <Navigate to="/tasks" replace={true} />;
};

function App() {
  return (
    <AuthProvider>
      <Toaster position="top-right" reverseOrder={false} />
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
            <Route path="admin" element={<SuperAdminDashboard />} />
            <Route path="inventory" element={<InventoryManagement />} />
            <Route path="tasks" element={<MyTasks />} />
            <Route path="order-entry" element={<OrderEntry />} />
            <Route path="orders" element={<AllOrders />} />
            <Route path="history" element={<History />} />
          </Route>
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;
