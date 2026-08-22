import React, { useState, useEffect, useRef, useCallback } from 'react';
import api from '../services/api';
import { Link, useNavigate, useLocation, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useSystemPause } from '../context/SystemPauseContext';
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
  Bell,
  BellRing,
  UserCheck,
  Lock,
  Eye,
  EyeOff,
  Scissors,
  MessageSquare,
  Shield,
  Landmark,
  Route as RouteIcon,
  ClipboardCheck,
  PackageX,
  Settings,
  SearchCheck,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { formatDateOnly } from '../utils/dateTime';
import socket from '../socket';
import useDemandNotification from '../hooks/useDemandNotification';
import { getTimerState, fmtWorkingDuration } from '../utils/workingHours';
import toast from 'react-hot-toast';
import SystemPauseControl from './SystemPauseControl';
import ProfileEmployeeGate from './ProfileEmployeeGate';
import { useLanguage } from '../context/LanguageContext';
import { useTheme } from '../context/ThemeContext';
import { useNotifications } from '../context/NotificationContext';
import { Palette } from 'lucide-react';

const Sidebar = React.memo(({ isOpen, isCollapsed, toggle, toggleCollapse }) => {
  const { user, logout } = useAuth();
  const { t, isUrdu } = useLanguage();
  const { themeId, currentTheme, changeTheme, THEMES } = useTheme();
  const { unreadCounts, markModuleRead } = useNotifications();
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
    { name: 'Executive Dashboard', path: '/ceo-dashboard', icon: LayoutDashboard, roles: ['CEO'] },
    { name: 'Software Settings', path: '/software-settings', icon: Settings, roles: ['SOFTWARE_SETTINGS'] },
    { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard, roles: ['SUPER_ADMIN', 'ADMIN', 'ORDER_ENTRY'] },
    { name: 'Outlet Dashboard', path: '/outlet-dashboard', icon: LayoutDashboard, roles: ['OUTLET'] },
    { name: 'Dashboard', path: '/dispatch-dashboard', icon: LayoutDashboard, roles: ['DISPATCH'] },
    { name: 'My Tasks', path: '/dispatch', icon: Truck, roles: ['DISPATCH'] },
    { name: 'Branches', path: '/pos-inventory', icon: Building2, roles: ['SUPER_ADMIN', 'ADMIN'] },
    { name: 'Orders', path: '/orders', icon: ClipboardList, roles: ['SUPER_ADMIN', 'ADMIN', 'CEO', 'FAISAL'] },
    { name: 'Transfers', path: '/transfers', icon: ArrowRightLeft, roles: ['OUTLET', 'STORE'] },

    // Operational roles links (hidden from Admin to keep it simplified)
    { name: 'Order Entry', path: '/order-entry', icon: ClipboardList, roles: ['ORDER_ENTRY', 'FAISAL'] },
    { name: 'Order Cancellation', path: '/order-cancellation', icon: PackageX, roles: ['FAISAL'] },
    { name: 'Edit Request', path: '/edit-requests', icon: FileEdit, roles: ['OUTLET', 'SUPER_ADMIN', 'ADMIN'] },
    { name: 'My Tasks', path: '/tasks', icon: Activity, roles: ['STORE', 'PRODUCTION', 'PRODUCTION_IN', 'PRODUCTION_OUT', 'LOGO_DESIGN', 'OUT_FOR_DELIVERY', 'OUTLET'] },
    { name: 'Dashboard', path: '/store-dashboard', icon: LayoutDashboard, roles: ['STORE'] },
    { name: 'Warehouse', path: '/warehouse', icon: Warehouse, roles: ['STORE'] },
    { name: 'Inventory Audit', path: '/audit', icon: ClipboardCheck, roles: ['STORE', 'STORE_EMPLOYEE'] },
    { name: 'Returns', path: '/returns', icon: RotateCcw, roles: ['STORE'] },
    { name: 'Replacements', path: '/store-replacements', icon: ArrowRightLeft, roles: ['STORE'] },
    { name: 'Order Tracker', path: '/store-order-tracker', icon: SearchCheck, roles: ['STORE'] },
    { name: 'Orders', path: '/store-orders', icon: ClipboardList, roles: ['STORE'] },
    { name: 'Audit Review', path: '/audit-review', icon: ClipboardCheck, roles: ['SUPER_ADMIN', 'ADMIN'] },
    { name: 'Cancellation Requests', path: '/order-cancellations', icon: PackageX, roles: ['SUPER_ADMIN', 'ADMIN'] },
    { name: 'POS Inventory', path: '/pos-inventory', icon: Package, roles: ['SUPER_ADMIN', 'ADMIN', 'STORE', 'OUTLET', 'FAISAL', 'INVENTORY_VIEW'] },
    { name: 'Outlet Requests', path: '/outlet-requests', icon: Building2, roles: ['OUTLET'] },
    { name: 'Outlet Order Entry', path: '/outlet-order-entry', icon: ShoppingBag, roles: ['OUTLET'] },
    { name: 'In Dispatch', path: '/in-dispatch', icon: RouteIcon, roles: ['OUTLET'] },
    { name: 'Gate Pass', path: '/gate-pass', icon: ClipboardList, roles: ['OUTLET'] },
    { name: 'Delivery Sheet', path: '/delivery-sheet', icon: ClipboardList, roles: ['FAISAL'] },
    { name: 'Replacements', path: '/replacements', icon: ArrowRightLeft, roles: ['FAISAL'] },

    { name: 'Order Track', path: '/order-track', icon: Search, roles: ['INVENTORY_VIEW', 'FAISAL', 'OUTLET', 'ADMIN', 'SUPER_ADMIN', 'CEO'] },
    { name: 'Deliveries', path: '/delivery', icon: Truck, roles: ['DELIVERY_BOY'] },
    { name: 'Deleted Orders', path: '/deleted-orders', icon: Trash2, roles: ['SUPER_ADMIN', 'ADMIN'] },
    { name: 'Production', path: '/production', icon: Factory, roles: ['PRODUCTION'] },
    { name: 'Alteration In', path: '/alteration-production', icon: Scissors, roles: ['PRODUCTION_IN'] },
    { name: 'Alteration Out', path: '/alteration-production', icon: Scissors, roles: ['PRODUCTION_OUT'] },
    { name: 'Outlet Engraving', path: '/engraving-queue', icon: Scissors, roles: ['LOGO_DESIGN'] },
    { name: 'Refund Management', path: '/refund-management', icon: RotateCcw, roles: ['DELIVERY_BOY'] },
    { name: 'Client Registration', path: '/clients', icon: UserPlus, roles: ['OUTLET'] },
    { name: 'POS', path: '/pos', icon: ShoppingCart, roles: ['OUTLET'] },
    { name: 'Alteration', path: '/alteration-request', icon: Scissors, roles: ['OUTLET'] },
    { name: 'Engraving', path: '/engraving-request', icon: Scissors, roles: ['OUTLET'] },
    { name: 'Verification', path: '/verification', icon: Shield, roles: ['INVENTORY_VIEW'] },
    { name: 'Return from Verification', path: '/returned-from-verification', icon: ArrowLeft, roles: ['FAISAL'] },
    { name: 'Return & Exchange', path: '/return-exchange', icon: RotateCcw, roles: ['INVENTORY_VIEW'] },
    { name: 'General Entries', path: '/journal', icon: FileText, roles: ['OUTLET'] },
    { name: 'Bank Deposit', path: '/bank-deposit', icon: Landmark, roles: ['OUTLET'] },
    { name: 'Chat', path: '/chat', icon: MessageCircle, roles: ['SUPER_ADMIN', 'ADMIN', 'FAISAL', 'ORDER_ENTRY', 'OUTLET', 'STORE', 'PRODUCTION', 'LOGO_DESIGN', 'DISPATCH', 'OUT_FOR_DELIVERY', 'DELIVERY_BOY', 'CEO'] },
    { name: 'Notifications', path: '/notifications', icon: Bell, roles: ['SUPER_ADMIN', 'ADMIN', 'FAISAL', 'ORDER_ENTRY', 'OUTLET', 'STORE', 'PRODUCTION', 'LOGO_DESIGN', 'DISPATCH', 'DELIVERY_BOY', 'OUT_FOR_DELIVERY', 'INVENTORY_VIEW', 'CEO'] },
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
      // In Dispatch is a dedicated JOHAR TOWN outlet module only
      if (item.name === 'In Dispatch') {
        const n = String(user?.name || '').toLowerCase();
        return n.includes('johar') || user?.name?.includes('1');
      }
      // Gate Pass — not for Jail Road
      if (item.name === 'Gate Pass') {
        const n = String(user?.name || '').toLowerCase();
        const isJailRoad = n.includes('2') || n.includes('jail');
        return !isJailRoad;
      }
      return ['Outlet Dashboard', 'Transfers', 'Outlet Requests', 'Client Registration', 'POS', 'POS Inventory', 'Outlet Order Entry', 'Alteration', 'Engraving', 'General Entries', 'Bank Deposit', 'Chat', 'Notes', 'My Tasks', 'Order Track', 'Edit Request', 'Notifications', 'In Dispatch', 'Gate Pass'].includes(item.name);
    }
    
    // 3. Explicit Restriction for Delivery Boy
    if (userRole === 'DELIVERY_BOY') {
      return item.name === 'Deliveries' || item.name === 'Chat' || item.name === 'Notes' || item.name === 'Notifications';
    }

    return true;
  });

  useEffect(() => {
    const paths = Object.keys(unreadCounts).filter(Boolean).sort((a, b) => b.length - a.length);
    const match = paths.find(p => location.pathname.startsWith(p));
    if (match && (unreadCounts[match] || 0) > 0) markModuleRead(match);
  }, [location.pathname]);

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
            const itemPath = item.path;
            const notifCount = unreadCounts[itemPath] || 0;
            const chatCount = item.name === 'Chat' ? chatUnread : 0;
            const badgeCount = notifCount + chatCount;
            const hasBadge = badgeCount > 0;
            const isActive = item.state?.adminTab
              ? location.pathname === item.path && location.state?.adminTab === item.state.adminTab
              : location.pathname === item.path && !location.state?.adminTab && !location.search;
            return (
            <Link
              key={item.path + (item.state?.adminTab || '')}
              to={item.state ? { pathname: item.path, state: item.state } : item.path}
              onClick={() => { if (window.innerWidth < 1024) toggle(); if (notifCount > 0) markModuleRead(itemPath); if (item.name === 'Chat') { setChatUnread(0); sessionStorage.setItem('chatUnread', '0'); } }}
              className={`flex items-center ${isCollapsed ? 'justify-center' : 'space-x-3'} p-3 rounded-xl transition-all duration-200 group ${
                isActive
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/40' 
                  : hasBadge
                    ? 'text-gray-400 bg-red-900/10 hover:bg-red-900/20 hover:text-white'
                    : 'text-gray-400 hover:bg-gray-800 hover:text-white'
              }`}
              title={isCollapsed ? t(item.name) : ""}
            >
              <item.icon size={16} className={isActive ? 'text-white' : 'group-hover:text-blue-400'} />
              {!isCollapsed && (
                <span className="font-bold text-xs tracking-wide flex-1">{t(item.name)}</span>
              )}
              {hasBadge && (
                <span className={`${isCollapsed ? 'absolute -top-1 -right-1' : ''} ${hasBadge && notifCount > 0 ? 'animate-nav-blink' : ''} bg-red-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full min-w-[18px] text-center leading-tight shadow-lg shadow-red-500/30`}>
                  {badgeCount > 99 ? '99+' : badgeCount}
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

const Layout = () => {
  const navigate = useNavigate();
  const { t, LanguageToggle, isUrdu } = useLanguage();
  const location = useLocation();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const { user } = useAuth();
  const { paused: systemPaused, affected: pauseAffected, info: pauseInfo } = useSystemPause();
  const { activeAlert, acknowledge } = useDemandNotification();

  // Working-hours timer state — polls backend every 60s for synchronized banners.
  const [timerState, setTimerState] = useState({ status: 'running', message: '' });

  useEffect(() => {
    const fetchTimer = async () => {
      try {
        const res = await api.get('/api/system/timer-state');
        setTimerState(res.data || { status: 'running', message: '' });
      } catch {
        // Fail-open: if timer-state fails, compute locally as fallback.
        setTimerState(getTimerState(Date.now()));
      }
    };
    fetchTimer();
    const iv = setInterval(fetchTimer, 60000);
    return () => clearInterval(iv);
  }, []);

  // Faisal employee login
  const [faisalEmployee, setFaisalEmployee] = useState(() => localStorage.getItem('faisalEmployee') || '');
  const [faisalPwd, setFaisalPwd] = useState('');
  const [faisalShowPwd, setFaisalShowPwd] = useState(false);
  // Persist Faisal employee login across page refreshes via sessionStorage.
  // Only manual logout or explicit session expiry should end the session.
  const [faisalLoggedIn, setFaisalLoggedIn] = useState(() => sessionStorage.getItem('faisalLoggedIn') === '1');
  const [faisalLoginLoading, setFaisalLoginLoading] = useState(false);
  const [faisalEmployees, setFaisalEmployees] = useState([]);

  useEffect(() => {
    let mounted = true;
    api.get('/api/outlet-orders/employees?profile=FAISAL_PROFILE')
      .then(res => {
        if (!mounted) return;
        const list = res.data?.employees || [];
        setFaisalEmployees(list);
        // If the remembered employee is no longer active/available, forget them.
        if (faisalEmployee && !list.some(e => e.name === faisalEmployee)) {
          setFaisalEmployee('');
          localStorage.removeItem('faisalEmployee');
        }
      })
      .catch(() => { if (mounted) setFaisalEmployees([]); });
    return () => { mounted = false; };
  }, []);

  const handleFaisalLogin = async () => {
    if (!faisalEmployee) { toast.error('Please select an employee'); return; }
    if (!faisalPwd) { toast.error('Enter your password'); return; }
    setFaisalLoginLoading(true);
    try {
      const res = await api.post('/api/software-settings/verify-employee', { name: faisalEmployee, password: faisalPwd, profile: 'FAISAL_PROFILE' });
      if (res.data?.ok) {
        setFaisalLoggedIn(true);
        sessionStorage.setItem('faisalLoggedIn', '1');
        setFaisalPwd('');
        localStorage.setItem('faisalEmployee', faisalEmployee);
        toast.success(`Logged in as ${faisalEmployee}`);
      } else {
        toast.error(res.data?.message || 'Login failed');
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Login failed');
    } finally {
      setFaisalLoginLoading(false);
    }
  };

  const handleFaisalLogout = () => {
    setFaisalLoggedIn(false);
    sessionStorage.removeItem('faisalLoggedIn');
    setFaisalEmployee('');
    setFaisalPwd('');
    localStorage.removeItem('faisalEmployee');
  };

  // Employee gates for profiles without a dedicated page-level login
  // (Store / Production / Inventory View). Dynamic, never hardcoded — the
  // employee lists come from Employee Management assignment data.
  const GATED_PROFILES = [
    { role: 'STORE', profile: 'STORE', label: 'Store', icon: Warehouse },
    { role: 'PRODUCTION', profile: 'PRODUCTION', label: 'Production', icon: Factory },
    { role: 'INVENTORY_VIEW', profile: 'INVENTORY_VIEW', label: 'Inventory View', icon: SearchCheck },
  ];
  const [profileGates, setProfileGates] = useState({
    STORE: { loggedIn: false, employee: '' },
    PRODUCTION: { loggedIn: false, employee: '' },
    INVENTORY_VIEW: { loggedIn: false, employee: '' },
  });
  const [gateLogoutSignal, setGateLogoutSignal] = useState(0);

  const handleGateStateChange = useCallback((s) => {
    if (!s?.role) return;
    setProfileGates(prev => ({
      ...prev,
      [s.role]: { loggedIn: !!s.loggedIn, employee: s.employee || '' },
    }));
  }, []);

  const handleGateLogout = (key) => {
    setGateLogoutSignal(v => v + 1);
    setProfileGates(prev => ({ ...prev, [key]: { loggedIn: false, employee: '' } }));
  };

  const activeGate = GATED_PROFILES.find(g => user?.role === g.role && profileGates[g.role]?.loggedIn);


  useEffect(() => {
    if (user?.role) {
      document.title = `${user.role.replace(/_/g, ' ')} - ENAMELS PRODUCTION`;
    }
  }, [user]);

  const { unreadCounts, markModuleRead, setBellNotifCallback } = useNotifications();
  const [bellOpen, setBellOpen] = useState(false);
  const [bellNotifs, setBellNotifs] = useState([]);
  const bellRef = useRef(null);

  const totalUnread = Object.values(unreadCounts).reduce((a, b) => a + b, 0);

  const fetchBellNotifs = useCallback(async () => {
    try {
      const res = await api.get('/api/notifications?limit=10&unread=true');
      setBellNotifs(res.data.notifications || []);
    } catch (e) { /* silent */ }
  }, []);

  // Register callback for real-time bell notification updates from socket
  useEffect(() => {
    setBellNotifCallback((data) => {
      setBellNotifs(prev => {
        if (prev.some(n => n.id === data.id)) return prev;
        return [data, ...prev].slice(0, 10);
      });
    });
  }, [setBellNotifCallback]);

  useEffect(() => {
    if (!bellOpen) return;
    fetchBellNotifs();
  }, [bellOpen, fetchBellNotifs]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (bellRef.current && !bellRef.current.contains(e.target)) {
        setBellOpen(false);
      }
    };
    if (bellOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [bellOpen]);


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
                  {faisalEmployees.map(emp => (
                    <option key={emp.id} value={emp.name}>{emp.name}</option>
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
    <ProfileEmployeeGate role="STORE" profile="STORE" label="Store" icon={Warehouse} onStateChange={handleGateStateChange} logoutSignal={gateLogoutSignal}>
      <ProfileEmployeeGate role="PRODUCTION" profile="PRODUCTION" label="Production" icon={Factory} onStateChange={handleGateStateChange} logoutSignal={gateLogoutSignal}>
        <ProfileEmployeeGate role="INVENTORY_VIEW" profile="INVENTORY_VIEW" label="Inventory View" icon={SearchCheck} onStateChange={handleGateStateChange} logoutSignal={gateLogoutSignal}>
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
            
          </div>

          <div className="flex items-center gap-3">
            <SystemPauseControl />
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
            {activeGate && (
              <button
                onClick={() => handleGateLogout(activeGate.role)}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest bg-red-600/20 text-red-400 hover:bg-red-600/30 transition-all"
                title="Switch Employee"
              >
                <UserCheck size={14} />
                {activeGate.label}: {profileGates[activeGate.role]?.employee}
                <LogOut size={14} />
              </button>
            )}
            <div className="relative" ref={bellRef}>
              <button
                onClick={() => setBellOpen(o => !o)}
                className="relative p-2.5 text-gray-400 hover:text-white bg-gray-800/50 hover:bg-gray-700/50 rounded-xl transition-all"
                title="Notifications"
              >
                <Bell size={18} />
                {totalUnread > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full min-w-[18px] text-center leading-tight shadow-lg shadow-red-500/30 animate-nav-blink">
                    {totalUnread > 99 ? '99+' : totalUnread}
                  </span>
                )}
              </button>
              {bellOpen && (
                <div className="absolute right-0 top-full mt-2 w-80 md:w-96 max-h-[70vh] overflow-y-auto rounded-2xl border shadow-2xl z-50" style={{ background: 'var(--nav-bg)', borderColor: 'var(--glass-border)' }}>
                  <div className="sticky top-0 flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: 'var(--glass-border)', background: 'var(--nav-bg)' }}>
                    <span className="text-xs font-black text-white uppercase tracking-widest">Notifications</span>
                    <div className="flex items-center gap-2">
                      {totalUnread > 0 && (
                        <button
                          onClick={() => { markModuleRead(''); setBellNotifs([]); }}
                          className="text-[10px] font-bold text-blue-400 hover:text-blue-300 uppercase tracking-widest"
                        >
                          Mark All Read
                        </button>
                      )}
                      <button
                        onClick={() => { navigate('/notifications'); setBellOpen(false); }}
                        className="text-[10px] font-bold text-gray-400 hover:text-white uppercase tracking-widest"
                      >
                        View All
                      </button>
                    </div>
                  </div>
                  {bellNotifs.length === 0 ? (
                    <div className="text-center py-10 text-gray-500 font-bold text-xs">No unread notifications</div>
                  ) : (
                    (() => {
                      const grouped = {};
                      bellNotifs.forEach(n => {
                        const key = n.moduleName || 'Other';
                        if (!grouped[key]) grouped[key] = [];
                        grouped[key].push(n);
                      });
                      return Object.entries(grouped).map(([module, notifs]) => (
                        <div key={module}>
                          <div className="px-4 py-2 text-[10px] font-black text-gray-500 uppercase tracking-widest bg-gray-900/50 border-b" style={{ borderColor: 'var(--glass-border)' }}>
                            {module}
                          </div>
                          {notifs.map(n => (
                            <button
                              key={n.id}
                              onClick={() => {
                                setBellOpen(false);
                                markModuleRead(n.path);
                                if (n.path) navigate(n.path);
                              }}
                              className="w-full text-left px-4 py-3 border-b hover:bg-gray-800/50 transition-colors last:border-b-0" style={{ borderColor: 'var(--glass-border)' }}
                            >
                              <div className="flex items-start gap-3">
                                <span className="w-2 h-2 rounded-full bg-blue-400 mt-1.5 shrink-0" />
                                <div className="min-w-0 flex-1">
                                  <div className="text-xs font-black text-white uppercase tracking-wider truncate">{n.title}</div>
                                  <div className="text-[11px] text-gray-400 font-medium mt-0.5 line-clamp-2">{n.message}</div>
                                  <div className="flex items-center gap-2 mt-1.5 text-[10px] text-gray-500 font-bold">
                                    <span>{formatDateOnly(n.createdAt)}</span>
                                    {n.employeeName && <><span>·</span><span>{n.employeeName}</span></>}
                                  </div>
                                </div>
                              </div>
                            </button>
                          ))}
                        </div>
                      ));
                    })()
                  )}
                </div>
              )}
            </div>
            <LanguageToggle />
            <div className="hidden md:flex flex-col items-end text-right">
              <span className="text-xs md:text-sm font-black text-white uppercase tracking-widest">{user?.role?.replace('_', ' ')}</span>
              <span className="text-xs font-bold text-gray-500 uppercase tracking-tighter">Active Session</span>
            </div>
          </div>
        </header>

        {pauseAffected ? (
          <div className="bg-red-600/20 border-b-2 border-red-500/40 px-6 py-3 flex items-center justify-center gap-3 flex-shrink-0">
            <PauseCircle className="text-red-400 animate-pulse" size={16} />
            <span className="text-red-300 font-black text-xs uppercase tracking-widest">🔴 SYSTEM PAUSED — All functions are temporarily stopped for your profile by Admin.</span>
            {pauseInfo?.pausedBy && (
              <span className="text-red-400/80 text-[10px] font-bold uppercase tracking-wider">
                · {pauseInfo.pausedBy} · {new Date(pauseInfo.pausedAt).toLocaleString()}
              </span>
            )}
          </div>
        ) : systemPaused ? (
          <div className="bg-indigo-600/10 border-b border-indigo-500/20 px-6 py-1.5 flex items-center justify-center gap-2 flex-shrink-0">
            <span className="w-2 h-2 rounded-full bg-indigo-400" />
            <span className="text-indigo-300/90 font-black text-[10px] uppercase tracking-widest">⚙️ SYSTEM PAUSED FOR OTHER PROFILES — your profile continues running normally.</span>
          </div>
        ) : (
          <div className="bg-emerald-600/10 border-b border-emerald-500/20 px-6 py-1.5 flex items-center justify-center gap-2 flex-shrink-0">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            <span className="text-emerald-400/90 font-black text-[10px] uppercase tracking-widest">🟢 SYSTEM ACTIVE — All functions have been resumed.</span>
          </div>
        )}

        {!systemPaused && timerState.status === 'warning' && (
          <div className="bg-amber-500/20 border-b border-amber-400/40 px-6 py-1.5 flex items-center justify-center gap-2 flex-shrink-0 animate-pulse">
            <span className="text-amber-400 font-black text-[10px] uppercase tracking-widest">⚠ WORKING HOURS ENDING SOON — timers will pause at 7:00 PM</span>
          </div>
        )}
        {!systemPaused && (timerState.status === 'stopped_evening' || timerState.status === 'stopped_morning') && (
          <div className="bg-red-500/15 border-b border-red-400/30 px-6 py-1.5 flex items-center justify-center gap-2 flex-shrink-0">
            <span className="text-red-400/90 font-black text-[10px] uppercase tracking-widest">⏸ WORKING HOURS PAUSED — timers resume at {timerState.status === 'stopped_evening' ? '9:00 AM tomorrow' : '9:00 AM'}</span>
          </div>
        )}
        {!systemPaused && timerState.status === 'stopped_sunday' && (
          <div className="bg-blue-500/15 border-b border-blue-400/30 px-6 py-1.5 flex items-center justify-center gap-2 flex-shrink-0">
            <span className="text-blue-400/90 font-black text-[10px] uppercase tracking-widest">📅 SUNDAY — No working hours today. Timers resume Monday 9:00 AM.</span>
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
        </ProfileEmployeeGate>
      </ProfileEmployeeGate>
    </ProfileEmployeeGate>
  );
};

export default Layout;
