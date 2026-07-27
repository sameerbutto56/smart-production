import React, { useState, useEffect } from 'react';
import api from '../services/api';
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
  Truck,
  Building2,
  Warehouse,
  PauseCircle,
  FileEdit,
  Trash2,
  BarChart3,
  TrendingUp,
  Factory,
  RotateCcw,
  UserPlus,
  ShoppingCart,
  ShoppingBag,
  ArrowRightLeft,
  ArrowLeft,
  FileText,
  MessageCircle,
  StickyNote,
  BellRing,
  UserCheck,
  Lock,
  Eye,
  EyeOff,
  Scissors,
  MessageSquare,
  Shield,
  Landmark,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import socket from '../socket';
import useDemandNotification from '../hooks/useDemandNotification';
import toast from 'react-hot-toast';
import { useSearch } from '../context/SearchContext';
import { useLanguage } from '../context/LanguageContext';
import { useTheme } from '../context/ThemeContext';
import { Palette } from 'lucide-react';

const Sidebar = React.memo(({ isOpen, isCollapsed, toggle, toggleCollapse }) => {
  const { user, logout } = useAuth();
  const { t, isUrdu } = useLanguage();
  const { themeId, currentTheme, changeTheme, THEMES } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const [showThemePicker, setShowThemePicker] = useState(false);
  const [chatUnread, setChatUnread] = useState(() => parseInt(sessionStorage.getItem('chatUnread') || '0'));

  useEffect(() => {
    if (location.pathname === '/chat') {
      setChatUnread(0);
      sessionStorage.setItem('chatUnread', '0');
    }
  }, [location.pathname]);

  useEffect(() => {
    const handler = () => {
      if (location.pathname !== '/chat') {
        setChatUnread(prev => {
          const next = prev + 1;
          sessionStorage.setItem('chatUnread', String(next));
          return next;
        });
      }
    };
    socket.on('chat:new-message', handler);
    return () => socket.off('chat:new-message', handler);
  }, [location.pathname]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const navItems = [
    { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard, roles: ['SUPER_ADMIN', 'ADMIN', 'ORDER_ENTRY'] },
    { name: 'Outlet Dashboard', path: '/outlet-dashboard', icon: LayoutDashboard, roles: ['OUTLET'] },
    { name: 'Dashboard', path: '/dispatch-dashboard', icon: LayoutDashboard, roles: ['DISPATCH'] },
    { name: 'My Tasks', path: '/dispatch', icon: Truck, roles: ['DISPATCH'] },
    { name: 'Branches', path: '/pos-inventory', icon: Building2, roles: ['SUPER_ADMIN', 'ADMIN'] },
    { name: 'Orders', path: '/orders', icon: ClipboardList, roles: ['SUPER_ADMIN', 'ADMIN', 'FAISAL', 'OUTLET'] },
    { name: 'Transfers', path: '/transfers', icon: ArrowRightLeft, roles: ['SUPER_ADMIN', 'ADMIN', 'OUTLET'] },
    { name: 'Analytics', path: '/analytics', icon: BarChart3, roles: ['SUPER_ADMIN', 'ADMIN'] },

    // Operational roles links (hidden from Admin to keep it simplified)
    { name: 'Order Entry', path: '/order-entry', icon: ClipboardList, roles: ['ORDER_ENTRY', 'FAISAL'] },
    { name: 'Edit Request', path: '/edit-requests', icon: FileEdit, roles: ['OUTLET'] },
    { name: 'My Tasks', path: '/tasks', icon: Activity, roles: ['STORE', 'PRODUCTION', 'PRODUCTION_IN', 'PRODUCTION_OUT', 'LOGO_DESIGN', 'OUT_FOR_DELIVERY', 'OUTLET'] },
    { name: 'Dashboard', path: '/store-dashboard', icon: LayoutDashboard, roles: ['STORE'] },
    { name: 'Warehouse', path: '/warehouse', icon: Warehouse, roles: ['STORE'] },
    { name: 'Warehouse POS', path: '/warehouse-pos', icon: ShoppingCart, roles: ['SUPER_ADMIN', 'ADMIN', 'STORE'] },
    { name: 'POS Inventory', path: '/pos-inventory', icon: Package, roles: ['STORE', 'OUTLET', 'FAISAL', 'INVENTORY_VIEW'] },
    { name: 'Outlet Requests', path: '/outlet-requests', icon: Building2, roles: ['OUTLET'] },
    { name: 'Outlet Order Entry', path: '/outlet-order-entry', icon: ShoppingBag, roles: ['OUTLET'] },
    { name: 'Delivery Sheet', path: '/delivery-sheet', icon: ClipboardList, roles: ['FAISAL'] },

    { name: 'Order Track', path: '/order-track', icon: Search, roles: ['INVENTORY_VIEW', 'FAISAL', 'OUTLET', 'ADMIN', 'SUPER_ADMIN'] },
    { name: 'Deliveries', path: '/delivery', icon: Truck, roles: ['DELIVERY_BOY'] },
    { name: 'Deleted Orders', path: '/deleted-orders', icon: Trash2, roles: ['SUPER_ADMIN', 'ADMIN'] },
    { name: 'Production', path: '/production', icon: Factory, roles: ['PRODUCTION'] },
    { name: 'Alteration In', path: '/alteration-production', icon: Scissors, roles: ['PRODUCTION_IN'] },
    { name: 'Alteration Out', path: '/alteration-production', icon: Scissors, roles: ['PRODUCTION_OUT'] },
    { name: 'Outlet Engraving', path: '/engraving-queue', icon: Scissors, roles: ['LOGO_DESIGN'] },
    { name: 'Refund Management', path: '/refund-management', icon: RotateCcw, roles: ['DELIVERY_BOY'] },
    { name: 'Client Registration', path: '/clients', icon: UserPlus, roles: ['OUTLET'] },
    { name: 'POS', path: '/pos', icon: ShoppingCart, roles: ['OUTLET'] },
    { name: 'Alteration', path: '/alteration-request', icon: Scissors, roles: ['OUTLET', 'INVENTORY_VIEW'] },
    { name: 'Engraving', path: '/engraving-request', icon: Scissors, roles: ['OUTLET', 'INVENTORY_VIEW'] },
    { name: 'Verification', path: '/verification', icon: Shield, roles: ['INVENTORY_VIEW'] },
    { name: 'Return & Exchange', path: '/return-exchange', icon: RotateCcw, roles: ['INVENTORY_VIEW'] },
    { name: 'General Entries', path: '/journal', icon: FileText, roles: ['OUTLET'] },
    { name: 'Bank Deposit', path: '/bank-deposit', icon: Landmark, roles: ['OUTLET'] },
    { name: 'Chat', path: '/chat', icon: MessageCircle, roles: ['SUPER_ADMIN', 'ADMIN', 'FAISAL', 'ORDER_ENTRY', 'OUTLET', 'STORE', 'PRODUCTION', 'LOGO_DESIGN', 'DISPATCH', 'OUT_FOR_DELIVERY', 'DELIVERY_BOY'] },
    { name: 'Notes', path: '/notes', icon: StickyNote, roles: ['SUPER_ADMIN', 'ADMIN', 'FAISAL', 'ORDER_ENTRY', 'OUTLET', 'STORE', 'STORE_EMPLOYEE', 'PRODUCTION', 'PRODUCTION_IN', 'PRODUCTION_OUT', 'LOGO_DESIGN', 'LOGO_DESIGN_EMPLOYEE', 'LOGO_DESIGNER', 'DISPATCH', 'MAIN_EMPLOYEE', 'DELIVERY_BOY', 'OUT_FOR_DELIVERY'] }
  ];
  
  const isBigScreen = user?.role === 'MAIN_EMPLOYEE';
  const userRole = String(user?.role || '').toUpperCase().trim();

  // Strict Role Filtering
  let filteredNavItems = navItems.filter(item => {
    // 1. Basic role check
    if (!item.roles.includes(userRole)) return false;
    
    // 2. Extra safety for Outlets
    if (userRole === 'OUTLET') {
      return ['Outlet Dashboard', 'Orders', 'Transfers', 'Outlet Requests', 'Client Registration', 'POS', 'POS Inventory', 'Outlet Order Entry', 'Alteration', 'Engraving', 'General Entries', 'Bank Deposit', 'Chat', 'Notes', 'My Tasks', 'Order Track'].includes(item.name);
    }
    
    // 3. Explicit Restriction for Delivery Boy
    if (userRole === 'DELIVERY_BOY') {
      return item.name === 'Deliveries' || item.name === 'Chat' || item.name === 'Notes';
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
        fixed inset-y-0 ${isUrdu ? 'right-0 border-l' : 'left-0 border-r'} z-50 flex flex-col transition-all duration-300 transform
        ${isOpen ? 'translate-x-0' : (isUrdu ? 'translate-x-full' : '-translate-x-full')}
        lg:relative lg:translate-x-0 ${isCollapsed ? 'lg:w-20' : 'lg:w-64'}
      `} style={{ background: 'var(--card-bg-solid)', borderColor: 'var(--glass-border)' }}>
        <div className={`p-6 flex items-center justify-between ${isCollapsed ? 'lg:p-4 lg:justify-center' : ''}`}>
          {!isCollapsed && (
            <div className="flex flex-col">
              <h1 className="text-xl font-black bg-gradient-to-r from-blue-400 to-emerald-400 bg-clip-text text-transparent italic">
                Enamels
              </h1>
              <span className="text-xs font-black text-emerald-500/50 tracking-[0.3em] uppercase">Production</span>
            </div>
          )}
          <button onClick={isCollapsed ? toggleCollapse : toggle} className={`${isCollapsed ? 'hidden lg:block' : 'lg:hidden'} text-gray-400 hover:text-white`}>
            {isCollapsed ? <Menu size={20} /> : <X size={20} />}
          </button>
          {!isCollapsed && (
            <button onClick={toggleCollapse} className="hidden lg:block text-gray-500 hover:text-white">
              <Menu size={16} />
            </button>
          )}
        </div>
        
        <nav className="flex-1 px-3 space-y-1 overflow-y-auto custom-scrollbar">
          {filteredNavItems.map((item) => {
            return (
            <Link
              key={item.path + (item.state?.adminTab || '')}
              to={item.state ? { pathname: item.path, state: item.state } : item.path}
              onClick={() => { if (window.innerWidth < 1024) toggle(); }}
              className={`flex items-center ${isCollapsed ? 'justify-center' : 'space-x-3'} p-3 rounded-xl transition-all duration-200 group ${
                (item.state?.adminTab
                  ? location.pathname === item.path && location.state?.adminTab === item.state.adminTab
                  : location.pathname === item.path && !location.state?.adminTab && !location.search)
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/40' 
                  : 'text-gray-400 hover:bg-gray-800 hover:text-white'
              }`}
              title={isCollapsed ? t(item.name) : ""}
            >
              <item.icon size={16} className={location.pathname === item.path ? 'text-white' : 'group-hover:text-blue-400'} />
              {!isCollapsed && (
                <span className="font-bold text-xs tracking-wide flex-1">{t(item.name)}</span>
              )}
              {!isCollapsed && item.name === 'Chat' && chatUnread > 0 && (
                <span className="bg-red-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full min-w-[18px] text-center leading-tight shadow-lg shadow-red-500/30">
                  {chatUnread > 99 ? '99+' : chatUnread}
                </span>
              )}
            </Link>
            );
          })}
        </nav>

        <div className={`p-4 border-t ${isCollapsed ? 'flex justify-center' : ''}`} style={{ borderColor: 'var(--glass-border)', background: 'var(--nav-bg)' }}>
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
                  <p className="text-xs md:text-sm text-gray-500 font-black uppercase tracking-widest">{user?.role?.replace('_', ' ')}</p>
                </div>
              </div>
              {/* Personal Theme Picker */}
              <div className="relative mb-3">
                <button
                  onClick={() => setShowThemePicker(!showThemePicker)}
                  className="flex items-center space-x-3 w-full p-3 text-gray-400 hover:text-white hover:bg-gray-800 rounded-xl transition-all font-bold text-xs"
                >
                  <Palette size={18} style={{ color: currentTheme.colors.primary }} />
                  <span className="flex-1 text-left">{currentTheme.name}</span>
                  <span className="text-xs opacity-50">▼</span>
                </button>
                {showThemePicker && (
                  <div className="absolute bottom-full left-0 right-0 mb-2 bg-gray-900 border border-gray-800 rounded-xl overflow-hidden shadow-2xl z-50 max-h-48 overflow-y-auto">
                    {Object.entries(THEMES).map(([id, theme]) => (
                      <button
                        key={id}
                        onClick={() => { changeTheme(id); setShowThemePicker(false); }}
                        className={`flex items-center space-x-3 w-full px-4 py-2.5 text-xs transition-all ${
                          themeId === id ? 'text-white bg-blue-600/20' : 'text-gray-400 hover:text-white hover:bg-gray-800'
                        }`}
                      >
                        <span>{theme.icon}</span>
                        <span className="font-bold">{theme.name}</span>
                        {themeId === id && <span className="ml-auto text-xs text-blue-400">✓</span>}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <button
                onClick={handleLogout}
                className="flex items-center space-x-3 w-full p-3 text-gray-400 hover:text-red-400 hover:bg-red-400/10 rounded-xl transition-all font-bold text-xs"
              >
                <LogOut size={16} />
                <span>Logout</span>
              </button>
            </>
          ) : (
            <button
              onClick={handleLogout}
              className="p-3 text-gray-400 hover:text-red-400 hover:bg-red-400/10 rounded-xl transition-all"
              title="Logout"
            >
              <LogOut size={16} />
            </button>
          )}
        </div>
      </div>
    </>
  );
});

const FAISAL_EMPLOYEES = {
  Faisal: { password: 'F170', label: 'Faisal' },
  Khawar: { password: 'K170', label: 'Khawar' }
};

const Layout = () => {
  const navigate = useNavigate();
  const { t, LanguageToggle, isUrdu } = useLanguage();
  const location = useLocation();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const { user } = useAuth();
  const [systemPaused, setSystemPaused] = useState(false);

  // Faisal employee login
  const [faisalEmployee, setFaisalEmployee] = useState(() => localStorage.getItem('faisalEmployee') || '');
  const [faisalPwd, setFaisalPwd] = useState('');
  const [faisalShowPwd, setFaisalShowPwd] = useState(false);
  const [faisalLoggedIn, setFaisalLoggedIn] = useState(() => !!localStorage.getItem('faisalEmployee'));
  const [faisalLoginLoading, setFaisalLoginLoading] = useState(false);

  const handleFaisalLogin = () => {
    const emp = FAISAL_EMPLOYEES[faisalEmployee];
    if (!emp) { toast.error('Please select an employee'); return; }
    if (faisalPwd !== emp.password) { toast.error('Invalid password'); return; }
    setFaisalLoginLoading(true);
    setTimeout(() => {
      setFaisalLoggedIn(true);
      setFaisalPwd('');
      localStorage.setItem('faisalEmployee', faisalEmployee);
      toast.success(`Logged in as ${emp.label}`);
      setFaisalLoginLoading(false);
    }, 400);
  };

  const handleFaisalLogout = () => {
    setFaisalLoggedIn(false);
    setFaisalEmployee('');
    setFaisalPwd('');
    localStorage.removeItem('faisalEmployee');
  };

  useEffect(() => {
    if (user?.role) {
      document.title = `${user.role.replace(/_/g, ' ')} - ENAMELS PRODUCTION`;
    }
  }, [user]);

  useEffect(() => {
    const checkPause = async () => {
      try {
        const res = await api.get('/api/admin/pause-status');
        setSystemPaused(res.data.paused);
      } catch { /* ignore */ }
    };
    checkPause();
    const interval = setInterval(checkPause, 30000);
    return () => clearInterval(interval);
  }, []);

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
      if (!data?.urgent) return;
      toast.success(`${data.title}: ${data.message}`, {
        duration: 8000,
        position: 'top-center',
        style: {
          background: '#030712',
          color: '#fff',
          border: '2px solid #ef4444',
          padding: '16px',
          borderRadius: '24px',
          fontWeight: '900',
          textTransform: 'uppercase',
          boxShadow: '0 10px 40px rgba(239,68,68,0.3)'
        }
      });
    };

    socket.on('global-alert', (data) => {
      if (data?.urgent) handleGlobalAlert(data);
    });
    socket.on('new-order', (order) => {
      if (!order?.urgent) return;
      handleGlobalAlert({
        title: 'New Urgent Order',
        message: `Order #${order.orderNumber || (order.id ? order.id.substring(0, 8) : 'N/A')} is now in the system.`,
        type: 'NEW_ORDER',
        urgent: true
      });
    });
    socket.on('stage-completion-requested', (data) => {
      if (!data?.stage) return;
      const isUrgent = data.urgent || data.stage?.order?.urgent;
      if (!isUrgent) return;
      const stageName = data.stage.stageName || '';
      handleGlobalAlert({
        title: 'Urgent Approval Required',
        message: `${stageName.replace('_', ' ')} stage completed. Waiting for approval.`,
        type: 'APPROVAL_REQUIRED',
        urgent: true
      });
    });
    socket.on('status-update', (data) => {
      if (!data?.status || !data?.urgent) return;
      handleGlobalAlert({
        title: 'Urgent Status Update',
        message: `Order #${data.orderNumber || 'N/A'} is now ${data.status.replace('_', ' ')}.`,
        type: 'STATUS_UPDATE',
        urgent: true
      });
    });

    return () => {
      socket.off('global-alert');
      socket.off('new-order');
      socket.off('stage-completion-requested');
      socket.off('status-update');
    };
  }, []);

  const { activeAlert, acknowledge } = useDemandNotification();

  if (user?.role === 'FAISAL' && !faisalLoggedIn) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'var(--background)', color: 'var(--text-primary)' }}>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md"
        >
          <div className="rounded-2xl p-8" style={{ background: 'var(--card-bg-solid)', border: '1px solid var(--glass-border)' }}>
            <div className="text-center mb-8">
              <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-blue-500/10 flex items-center justify-center">
                <UserCheck className="text-blue-400" size={32} />
              </div>
              <h1 className="text-3xl font-black text-white uppercase tracking-tight">Faisal Profile</h1>
              <p className="text-gray-500 text-xs font-bold uppercase tracking-widest mt-2">Employee Login</p>
            </div>
            <div className="space-y-5">
              <div>
                <label className="text-xs font-black text-gray-400 uppercase tracking-widest mb-2 block">Select Employee</label>
                <select
                  value={faisalEmployee}
                  onChange={(e) => { setFaisalEmployee(e.target.value); setFaisalPwd(''); }}
                  className="w-full bg-gray-900 border border-gray-800 rounded-xl py-3 px-4 text-white focus:border-blue-500 outline-none font-black appearance-none"
                >
                  <option value="">— Select Employee —</option>
                  {Object.entries(FAISAL_EMPLOYEES).map(([key, emp]) => (
                    <option key={key} value={key}>{emp.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-black text-gray-400 uppercase tracking-widest mb-2 block">Password</label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
                  <input
                    type={faisalShowPwd ? 'text' : 'password'}
                    value={faisalPwd}
                    onChange={(e) => setFaisalPwd(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleFaisalLogin(); }}
                    className="w-full bg-gray-900 border border-gray-800 rounded-xl py-3 pl-12 pr-12 text-white focus:border-blue-500 outline-none font-black"
                    placeholder="Enter password..."
                  />
                  <button
                    type="button"
                    onClick={() => setFaisalShowPwd(!faisalShowPwd)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white transition-colors"
                  >
                    {faisalShowPwd ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>
              <button
                onClick={handleFaisalLogin}
                disabled={faisalLoginLoading || !faisalEmployee || !faisalPwd}
                className="w-full py-3 rounded-xl font-black text-sm uppercase tracking-widest transition-all bg-blue-600 hover:bg-blue-500 text-white disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {faisalLoginLoading ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white"></div>
                ) : (
                  <LogOut className="rotate-180" size={16} />
                )}
                Login as {faisalEmployee || 'Employee'}
              </button>
            </div>
            <div className="mt-6 pt-6 border-t border-gray-800">
              <p className="text-xs font-bold text-gray-500 text-center">Secure Faisal profile access</p>
            </div>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: 'var(--background)', color: 'var(--text-primary)' }}>
      <Sidebar 
        isOpen={isSidebarOpen} 
        isCollapsed={isCollapsed}
        toggle={() => setIsSidebarOpen(!isSidebarOpen)} 
        toggleCollapse={() => setIsCollapsed(!isCollapsed)}
      />
      
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Universal Top Bar */}
        <header className="h-16 border-b flex items-center px-6 justify-between flex-shrink-0 relative z-20" style={{ borderColor: 'var(--glass-border)', background: 'var(--nav-bg)' }}>
          <div className="flex items-center gap-4 flex-1">
            <button 
              onClick={() => navigate(-1)}
              className="p-2 text-gray-400 hover:text-white bg-gray-800 rounded-lg"
              title="Back"
            >
              <ArrowLeft size={16} />
            </button>
            <button 
              onClick={() => setIsSidebarOpen(true)}
              className={`${isUrdu ? 'order-last' : ''} lg:hidden p-2 text-gray-400 hover:text-white bg-gray-800 rounded-lg`}
            >
              <Menu size={16} />
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
                  className="w-full bg-gray-900/50 border border-gray-800 rounded-xl py-2.5 pl-12 pr-4 focus:outline-none focus:border-blue-500/50 transition-all text-xs md:text-sm font-black uppercase tracking-widest text-white shadow-inner"
                />
              </form>
            )}
          </div>

          <div className="flex items-center gap-3">
            {user?.role === 'FAISAL' && (
              <button
                onClick={handleFaisalLogout}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest bg-red-600/20 text-red-400 hover:bg-red-600/30 transition-all"
                title="Switch Employee"
              >
                <UserCheck size={14} />
                {faisalEmployee}
                <LogOut size={14} />
              </button>
            )}
            <LanguageToggle />
            <div className="hidden md:flex flex-col items-end text-right">
              <span className="text-xs md:text-sm font-black text-white uppercase tracking-widest">{user?.role?.replace('_', ' ')}</span>
              <span className="text-xs font-bold text-gray-500 uppercase tracking-tighter">Active Session</span>
            </div>
          </div>
        </header>

        {systemPaused && (
          <div className="bg-red-600/20 border-b-2 border-red-500/30 px-6 py-3 flex items-center justify-center gap-3 flex-shrink-0">
            <PauseCircle className="text-red-400 animate-pulse" size={16} />
            <span className="text-red-300 font-black text-xs uppercase tracking-widest">System Paused — All production operations are suspended for holidays</span>
          </div>
        )}

        {activeAlert && (
          <div className="bg-amber-500/15 border-b-2 border-amber-400/40 px-4 md:px-6 py-2.5 flex items-center justify-between gap-4 flex-shrink-0">
            <div className="flex items-center gap-3 min-w-0">
              <BellRing className="text-amber-400 animate-bounce shrink-0" size={18} />
              <span className="text-amber-300 font-bold text-xs md:text-sm uppercase tracking-wider truncate">{activeAlert.message}</span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {activeAlert.type === 'demand:new' && (
                <Link
                  to="/warehouse"
                  onClick={acknowledge}
                  className="bg-amber-500 hover:bg-amber-400 text-black px-4 py-1.5 rounded-lg text-xs font-black uppercase tracking-widest transition-all"
                >
                  Receive
                </Link>
              )}
              {activeAlert.type === 'demand:accepted' && (
                <Link
                  to="/warehouse"
                  onClick={acknowledge}
                  className="bg-amber-500 hover:bg-amber-400 text-black px-4 py-1.5 rounded-lg text-xs font-black uppercase tracking-widest transition-all"
                >
                  View
                </Link>
              )}
              {activeAlert.type === 'demand:updated' && (
                <Link
                  to="/outlet-requests"
                  onClick={acknowledge}
                  className="bg-amber-500 hover:bg-amber-400 text-black px-4 py-1.5 rounded-lg text-xs font-black uppercase tracking-widest transition-all"
                >
                  View
                </Link>
              )}
              <button
                onClick={acknowledge}
                className="bg-gray-700 hover:bg-gray-600 text-white px-4 py-1.5 rounded-lg text-xs font-black uppercase tracking-widest transition-all"
              >
                OK
              </button>
            </div>
          </div>
        )}

        <main className="flex-1 overflow-y-auto overflow-x-auto p-4 md:p-6 custom-scrollbar">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default Layout;
