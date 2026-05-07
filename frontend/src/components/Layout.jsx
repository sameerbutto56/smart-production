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
  X
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
    { name: 'Admin Portal', path: '/admin', icon: LayoutDashboard, roles: ['SUPER_ADMIN'] },
    { name: 'Control Center', path: '/dashboard', icon: LayoutDashboard, roles: ['FAISAL', 'SUPER_ADMIN', 'ORDER_ENTRY'] },
    { name: 'Order Entry', path: '/order-entry', icon: ClipboardList, roles: ['ORDER_ENTRY', 'FAISAL', 'SUPER_ADMIN'] },
    { name: 'Inventory', path: '/inventory', icon: Package, roles: ['SUPER_ADMIN'] },
    { name: 'My Tasks', path: '/tasks', icon: Activity, roles: ['STORE', 'CUTTING', 'STITCHING', 'QA', 'PRESSING_PACKING', 'LOGO_DESIGN', 'DISPATCH', 'OUT_FOR_DELIVERY'] },
    { name: 'All Orders', path: '/orders', icon: Package, roles: ['SUPER_ADMIN'] },
    { name: 'History', path: '/history', icon: History, roles: ['SUPER_ADMIN'] },
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
        fixed inset-y-0 left-0 z-50 w-64 bg-gray-900 border-r border-gray-800 flex flex-col transition-transform duration-300 transform
        ${isOpen ? 'translate-x-0' : '-translate-x-full'}
        lg:relative lg:translate-x-0
      `}>
        <div className="p-6 flex items-center justify-between">
          <h1 className="text-xl font-black bg-gradient-to-r from-blue-400 to-emerald-400 bg-clip-text text-transparent italic">
            Enamels
          </h1>
          <button onClick={toggle} className="lg:hidden text-gray-400 hover:text-white">
            <X size={24} />
          </button>
        </div>
        
        <nav className="flex-1 px-3 space-y-1 overflow-y-auto custom-scrollbar">
          {filteredNavItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              onClick={() => { if (window.innerWidth < 1024) toggle(); }}
              className={`flex items-center space-x-3 p-3 rounded-xl transition-all duration-200 group ${
                location.pathname === item.path 
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/40' 
                  : 'text-gray-400 hover:bg-gray-800 hover:text-white'
              }`}
            >
              <item.icon size={20} className={location.pathname === item.path ? 'text-white' : 'group-hover:text-blue-400'} />
              <span className="font-bold text-xs tracking-wide">{item.name}</span>
            </Link>
          ))}
        </nav>

        <div className="p-4 border-t border-gray-800 bg-gray-950/30">
          <div className="flex items-center space-x-3 mb-4 px-2">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-blue-500 to-emerald-500 flex items-center justify-center font-black text-sm shadow-inner">
              {user?.name?.charAt(0)}
            </div>
            <div className="flex-1 overflow-hidden">
              <p className="text-xs font-black truncate">{user?.name}</p>
              <p className="text-[9px] text-gray-500 font-black uppercase tracking-widest">{user?.role?.replace('_', ' ')}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center space-x-3 w-full p-3 text-gray-400 hover:text-red-400 hover:bg-red-400/10 rounded-xl transition-all font-bold text-xs"
          >
            <LogOut size={20} />
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
        <header className="lg:hidden h-14 border-b border-gray-800 bg-gray-900 flex items-center px-4 justify-between flex-shrink-0">
          <h1 className="text-lg font-black bg-gradient-to-r from-blue-400 to-emerald-400 bg-clip-text text-transparent italic">
            Enamels
          </h1>
          <button 
            onClick={() => setIsSidebarOpen(true)}
            className="p-2 text-gray-400 hover:text-white bg-gray-800 rounded-lg"
          >
            <Menu size={20} />
          </button>
        </header>

        <main className="flex-1 overflow-y-auto p-4 md:p-6 custom-scrollbar">
          <div className="mb-4">
            <button 
              onClick={() => window.history.length > 1 ? window.history.back() : window.location.href = '/'}
              className="flex items-center space-x-2 text-gray-400 hover:text-white transition-colors text-sm font-bold bg-gray-900/50 hover:bg-gray-800 px-4 py-2 rounded-xl border border-gray-800"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
              <span>Back</span>
            </button>
          </div>
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default Layout;
