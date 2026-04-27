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

const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return <div>Loading...</div>;
  if (!user) return <Navigate to="/login" />;
  return children;
};

const AuthRedirectHandler = () => {
  const { user } = useAuth();
  if (user?.role === 'ADMIN' || user?.role === 'MAIN_EMPLOYEE') {
    return <AdminDashboard />;
  }
  return <Navigate to="/tasks" />;
};

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/login" element={<Login />} />
          
          <Route path="/" element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }>
            <Route index element={
              <AuthRedirectHandler />
            } />
            <Route path="inventory" element={<InventoryManagement />} />
            <Route path="tasks" element={<MyTasks />} />
            <Route path="order-entry" element={<OrderEntry />} />
            <Route path="orders" element={<AllOrders />} />
            <Route path="history" element={<History />} />
            <Route path="progress" element={<ProgressChart />} />
          </Route>
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;
