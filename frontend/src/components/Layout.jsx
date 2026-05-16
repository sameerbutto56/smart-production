import React, { useState, useEffect } from 'react';
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
  Search,
  Truck
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import socket from '../socket';
import toast from 'react-hot-toast';
import { useSearch } from '../context/SearchContext';
import { useLanguage } from '../context/LanguageContext';

const Sidebar = ({ isOpen, isCollapsed, toggle, toggleCollapse }) => {
  const { user, logout } = useAuth();
  const { t, isUrdu } = useLanguage();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const navItems = [
    { name: 'Admin Portal', path: '/admin', icon: LayoutDashboard, roles: ['SUPER_ADMIN'] },
    { name: 'Control Center', path: '/dashboard', icon: LayoutDashboard, roles: ['FAISAL', 'SUPER_ADMIN', 'ORDER_ENTRY'] },
    { name: 'Order Entry', path: '/order-entry', icon: ClipboardList, roles: ['ORDER_ENTRY', 'FAISAL', 'SUPER_ADMIN', 'OUTLET'] },
    { name: 'Inventory', path: '/inventory', icon: Package, roles: ['SUPER_ADMIN'] },
    { name: 'My Tasks', path: '/tasks', icon: Activity, roles: ['STORE', 'CUTTING', 'STITCHING', 'QA', 'PRESSING_PACKING', 'LOGO_DESIGN', 'DISPATCH', 'OUT_FOR_DELIVERY'] },
    { name: 'All Orders', path: '/orders', icon: Package, roles: ['SUPER_ADMIN', 'FAISAL', 'ADMIN', 'OUTLET'] },
    { name: 'History (Admin)', path: '/history', icon: History, roles: ['SUPER_ADMIN', 'FAISAL', 'ADMIN'] },
    { name: 'Deliveries', path: '/delivery', icon: Truck, roles: ['DELIVERY_BOY', 'SUPER_ADMIN'] },
  ];
  
  const isBigScreen = user?.role === 'MAIN_EMPLOYEE';
  const userRole = String(user?.role || '').toUpperCase().trim();
  // Strict Role Filtering
  let filteredNavItems = navItems.filter(item => {
    // 1. Basic role check
    if (!item.roles.includes(userRole)) return false;
    
    // 2. Extra safety for Outlets - explicitly remove History
    if (userRole === 'OUTLET') {
      if (item.name === 'History') return false;
      return ['Order Entry', 'All Orders'].includes(item.name);
    }
    
    // 3. Explicit Restriction for Delivery Boy
    if (userRole === 'DELIVERY_BOY') {
      return item.name === 'Deliveries';
    }
    
    return true;
  });

  if (isBigScreen) return null;

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
        fixed inset-y-0 ${isUrdu ? 'right-0 border-l' : 'left-0 border-r'} z-50 bg-gray-900 border-gray-800 flex flex-col transition-all duration-300 transform
        ${isOpen ? 'translate-x-0' : (isUrdu ? 'translate-x-full' : '-translate-x-full')}
        lg:relative lg:translate-x-0 ${isCollapsed ? 'lg:w-20' : 'lg:w-64'}
      `}>
        <div className={`p-6 flex items-center justify-between ${isCollapsed ? 'lg:p-4 lg:justify-center' : ''}`}>
          {!isCollapsed && (
            <div className="flex flex-col">
              <h1 className="text-xl font-black bg-gradient-to-r from-blue-400 to-emerald-400 bg-clip-text text-transparent italic">
                Enamels
              </h1>
              <span className="text-[8px] font-black text-blue-500/50 tracking-[0.3em] uppercase">Build v1.0.5-OUTLET</span>
            </div>
          )}
          <button onClick={isCollapsed ? toggleCollapse : toggle} className={`${isCollapsed ? 'hidden lg:block' : 'lg:hidden'} text-gray-400 hover:text-white`}>
            {isCollapsed ? <Menu size={24} /> : <X size={24} />}
          </button>
          {!isCollapsed && (
            <button onClick={toggleCollapse} className="hidden lg:block text-gray-500 hover:text-white">
              <Menu size={20} />
            </button>
          )}
        </div>
        
        <nav className="flex-1 px-3 space-y-1 overflow-y-auto custom-scrollbar">
          {filteredNavItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              onClick={() => { if (window.innerWidth < 1024) toggle(); }}
              className={`flex items-center ${isCollapsed ? 'justify-center' : 'space-x-3'} p-3 rounded-xl transition-all duration-200 group ${
                location.pathname === item.path 
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/40' 
                  : 'text-gray-400 hover:bg-gray-800 hover:text-white'
              }`}
              title={isCollapsed ? t(item.name) : ""}
            >
              <item.icon size={20} className={location.pathname === item.path ? 'text-white' : 'group-hover:text-blue-400'} />
              {!isCollapsed && <span className="font-bold text-xs tracking-wide">{t(item.name)}</span>}
            </Link>
          ))}
        </nav>

        <div className={`p-4 border-t border-gray-800 bg-gray-950/30 ${isCollapsed ? 'flex justify-center' : ''}`}>
          {!isCollapsed ? (
            <>
              <div className="flex items-center space-x-3 mb-4 px-2">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-blue-500 to-emerald-500 flex items-center justify-center font-black text-sm shadow-inner">
                  {user?.name?.charAt(0)}
                </div>
                <div className="flex-1 overflow-hidden">
                  <p className="text-xs font-black truncate">
                    {user?.role === 'FAISAL' ? 'ONLINE ORDER' : 
                     user?.role === 'OUTLET' ? (
                       (user?.name?.includes('1') || user?.name?.toLowerCase().includes('johar')) ? 'JOHAR TOWN BRANCH' :
                       (user?.name?.includes('2') || user?.name?.toLowerCase().includes('jail')) ? 'JAIL ROAD BRANCH' :
                       (user?.name?.includes('3') || user?.name?.toLowerCase().includes('abbottabad')) ? 'ABBOTTABAD BRANCH' :
                       user?.name
                     ) : user?.name}
                  </p>
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
            </>
          ) : (
            <button
              onClick={handleLogout}
              className="p-3 text-gray-400 hover:text-red-400 hover:bg-red-400/10 rounded-xl transition-all"
              title="Logout"
            >
              <LogOut size={20} />
            </button>
          )}
        </div>
      </div>
    </>
  );
};

const Layout = () => {
  const navigate = useNavigate();
  const { t, LanguageToggle, isUrdu } = useLanguage();
  const location = useLocation();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const { user } = useAuth();

  useEffect(() => {
    if (user?.role) {
      document.title = `${user.role.replace(/_/g, ' ')} - ENAMELS PRODUCTION`;
    }
  }, [user]);

  const { searchTerm: contextSearch, setSearchTerm: setContextSearch } = useSearch();
  const [globalSearch, setLocalSearch] = useState('');

  const handleGlobalSearch = (e) => {
    e.preventDefault();
    if (!globalSearch.trim()) return;
    
    // Always update the context search to enable cross-page filtering
    setContextSearch(globalSearch);
    if (location.pathname !== '/dashboard' && location.pathname !== '/tasks' && location.pathname !== '/orders') {
        navigate('/orders');
    }
    setLocalSearch('');
  };

  useEffect(() => {
    const handleGlobalAlert = (data) => {
      // Play sound (wrapped in a check for user interaction)
      const playSound = () => {
        const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
        audio.play().catch(() => {
          console.log('Audio autoplay blocked by browser. Click anywhere on the page to enable sounds.');
        });
      };
      
      playSound();

      toast.success(`${data.title}: ${data.message}`, {
        duration: 8000,
        position: 'top-center',
        style: {
          background: '#030712',
          color: '#fff',
          border: '1px solid #10b981',
          padding: '16px',
          borderRadius: '24px',
          fontWeight: '900',
          textTransform: 'uppercase',
          boxShadow: '0 10px 40px rgba(0,0,0,0.5)'
        }
      });
    };

    socket.on('global-alert', handleGlobalAlert);
    socket.on('new-order', (order) => {
      if (!order) return;
      handleGlobalAlert({
        title: 'New Order Received',
        message: `Order #${order.orderNumber || (order.id ? order.id.substring(0, 8) : 'N/A')} is now in the system.`,
        type: 'NEW_ORDER'
      });
    });
    socket.on('stage-completion-requested', (data) => {
      if (!data?.stageName) return;
      handleGlobalAlert({
        title: 'Approval Required',
        message: `${data.stageName.replace('_', ' ')} stage completed. Waiting for approval.`,
        type: 'APPROVAL_REQUIRED'
      });
    });
    socket.on('status-update', (data) => {
      if (!data?.status) return;
      handleGlobalAlert({
        title: 'Status Updated',
        message: `Order #${data.orderNumber || 'N/A'} is now ${data.status.replace('_', ' ')}.`,
        type: 'STATUS_UPDATE'
      });
    });

    return () => {
      socket.off('global-alert', handleGlobalAlert);
      socket.off('new-order');
      socket.off('stage-completion-requested');
      socket.off('status-update');
    };
  }, []);

  return (
    <div className="flex h-screen bg-gray-950 text-white overflow-hidden">
      <Sidebar 
        isOpen={isSidebarOpen} 
        isCollapsed={isCollapsed}
        toggle={() => setIsSidebarOpen(!isSidebarOpen)} 
        toggleCollapse={() => setIsCollapsed(!isCollapsed)}
      />
      
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Universal Top Bar */}
        <header className="h-16 border-b border-gray-800 bg-gray-950/50 backdrop-blur-md flex items-center px-6 justify-between flex-shrink-0 relative z-20">
          <div className="flex items-center gap-4 flex-1">
            <button 
              onClick={() => setIsSidebarOpen(true)}
              className={`${isUrdu ? 'order-last' : ''} lg:hidden p-2 text-gray-400 hover:text-white bg-gray-800 rounded-lg`}
            >
              <Menu size={20} />
            </button>
            
            {/* Search Input */}
            {user?.role && user.role !== 'MAIN_EMPLOYEE' && (
              <form onSubmit={handleGlobalSearch} className="relative group w-full max-w-md hidden sm:block">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-blue-500 transition-colors" size={16} />
                <input
                  type="text"
                  placeholder="Quick Search: Enter Order Number or Customer..."
                  value={globalSearch}
                  onChange={(e) => {
                    setLocalSearch(e.target.value);
                    setContextSearch(e.target.value);
                  }}
                  className="w-full bg-gray-900/50 border border-gray-800 rounded-xl py-2.5 pl-12 pr-4 focus:outline-none focus:border-blue-500/50 transition-all text-[11px] font-black uppercase tracking-widest text-white shadow-inner"
                />
              </form>
            )}
          </div>

          <div className="flex items-center gap-4">
            
            <div className="hidden md:flex flex-col items-end text-right">
              <span className="text-[10px] font-black text-white uppercase tracking-widest">{user?.role?.replace('_', ' ')}</span>
              <span className="text-[8px] font-bold text-gray-500 uppercase tracking-tighter">Active Session</span>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 md:p-6 custom-scrollbar">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default Layout;
