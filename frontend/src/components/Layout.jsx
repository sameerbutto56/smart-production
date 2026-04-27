import React, { useState } from 'react';
import { Link, useNavigate, useLocation, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { 
  LayoutDashboard, 
  Package, 
  ClipboardList, 
  LogOut, 
  Activity,
  History,
  Menu,
  X,
  Monitor
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const Sidebar = ({ isOpen, toggle }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const navItems = [
    { name: 'Dashboard', path: '/', icon: LayoutDashboard, roles: ['ADMIN', 'MAIN_EMPLOYEE'] },
    { name: 'Inventory', path: '/inventory', icon: Package, roles: ['ADMIN'] },
    { name: 'My Tasks', path: '/tasks', icon: Activity, roles: ['ORDER_EMPLOYEE', 'CUTTING_EMPLOYEE', 'STITCHING_EMPLOYEE', 'QUALITY_CHECK_EMPLOYEE', 'PRESSING_EMPLOYEE', 'PACKAGING_EMPLOYEE'] },
    { name: 'Order Entry', path: '/order-entry', icon: ClipboardList, roles: ['ADMIN', 'ORDER_EMPLOYEE'] },
    { name: 'All Orders', path: '/orders', icon: Package, roles: ['ADMIN'] },
    { name: 'Command Center', path: '/progress', icon: Monitor, roles: ['ADMIN', 'MAIN_EMPLOYEE'] },
    { name: 'History', path: '/history', icon: History, roles: ['ADMIN', 'MAIN_EMPLOYEE'] },
  ];

  const filteredNavItems = navItems.filter(item => item.roles.includes(user?.role));

  return (
    <>
      {/* Mobile Overlay */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={toggle}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden"
          />
        )}
      </AnimatePresence>

      <div className={`
        fixed inset-y-0 left-0 z-50 w-72 bg-gray-900 border-r border-gray-800 flex flex-col transition-transform duration-300 transform
        ${isOpen ? 'translate-x-0' : '-translate-x-full'}
        lg:relative lg:translate-x-0
      `}>
        <div className="p-8 flex items-center justify-between">
          <h1 className="text-2xl font-black bg-gradient-to-r from-blue-400 to-emerald-400 bg-clip-text text-transparent italic">
            Enamels
          </h1>
          <button onClick={toggle} className="lg:hidden text-gray-400 hover:text-white">
            <X size={24} />
          </button>
        </div>
        
        <nav className="flex-1 px-4 space-y-2">
          {filteredNavItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              onClick={() => { if (window.innerWidth < 1024) toggle(); }}
              className={`flex items-center space-x-4 p-4 rounded-2xl transition-all duration-200 group ${
                location.pathname === item.path 
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/40' 
                  : 'text-gray-400 hover:bg-gray-800 hover:text-white'
              }`}
            >
              <item.icon size={22} className={location.pathname === item.path ? 'text-white' : 'group-hover:text-blue-400'} />
              <span className="font-bold text-sm tracking-wide">{item.name}</span>
            </Link>
          ))}
        </nav>

        <div className="p-6 border-t border-gray-800 bg-gray-950/30">
          <div className="flex items-center space-x-4 mb-6 px-2">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-blue-500 to-emerald-500 flex items-center justify-center font-black text-lg shadow-inner">
              {user?.name?.charAt(0)}
            </div>
            <div className="flex-1 overflow-hidden">
              <p className="text-sm font-black truncate">{user?.name}</p>
              <p className="text-[10px] text-gray-500 font-black uppercase tracking-widest">{user?.role?.replace('_', ' ')}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center space-x-4 w-full p-4 text-gray-400 hover:text-red-400 hover:bg-red-400/10 rounded-2xl transition-all font-bold text-sm"
          >
            <LogOut size={22} />
            <span>Logout</span>
          </button>
        </div>
      </div>
    </>
  );
};

const Layout = () => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  return (
    <div className="flex h-screen bg-gray-950 text-white overflow-hidden">
      <Sidebar isOpen={isSidebarOpen} toggle={() => setIsSidebarOpen(!isSidebarOpen)} />
      
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Mobile Top Bar */}
        <header className="lg:hidden h-16 border-b border-gray-800 bg-gray-900 flex items-center px-6 justify-between flex-shrink-0">
          <h1 className="text-xl font-black bg-gradient-to-r from-blue-400 to-emerald-400 bg-clip-text text-transparent italic">
            Enamels
          </h1>
          <button 
            onClick={() => setIsSidebarOpen(true)}
            className="p-2 text-gray-400 hover:text-white bg-gray-800 rounded-xl"
          >
            <Menu size={24} />
          </button>
        </header>

        <main className="flex-1 overflow-y-auto p-4 md:p-8 lg:p-10 custom-scrollbar">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default Layout;
