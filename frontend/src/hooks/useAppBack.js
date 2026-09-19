import { useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export const getRoleHomeRoute = (role) => {
  const r = String(role || '').toUpperCase().trim();
  if (r === 'SUPER_ADMIN' || r === 'ADMIN') return '/dashboard';
  if (r === 'FAISAL') return '/order-entry';
  if (r === 'ORDER_ENTRY') return '/dashboard';
  if (r === 'OUTLET') return '/outlet-dashboard';
  if (r === 'PRODUCTION') return '/tasks';
  if (r === 'DISPATCH') return '/dispatch-dashboard';
  if (r === 'DELIVERY_BOY') return '/delivery';
  if (r === 'STORE') return '/warehouse';
  if (r === 'INVENTORY_VIEW') return '/order-track';
  if (r === 'CEO') return '/ceo-dashboard';
  if (r === 'SOFTWARE_SETTINGS') return '/software-settings';
  if (r === 'ASM') return '/asm';
  return '/dashboard';
};

export const getParentRoute = (pathname, role) => {
  const path = (pathname || '').toLowerCase();

  // Detail / sub-routes mapped to logical parent screens
  if (path.startsWith('/order-cancellations') || path.startsWith('/product-data') || path.startsWith('/audit-review') || path.startsWith('/deleted-orders')) {
    return '/dashboard';
  }
  if (path.startsWith('/pos') || path.startsWith('/pos-inventory') || path.startsWith('/outlet-requests') || path.startsWith('/outlet-order-entry') || path.startsWith('/in-dispatch') || path.startsWith('/gate-pass') || path.startsWith('/journal') || path.startsWith('/bank-deposit') || path.startsWith('/clients') || path.startsWith('/alteration-request') || path.startsWith('/engraving-request')) {
    return '/outlet-dashboard';
  }
  if (path.startsWith('/delivery-sheet') || path.startsWith('/replacements') || path.startsWith('/returned-from-verification')) {
    return '/orders';
  }
  if (path.startsWith('/returns') || path.startsWith('/store-replacements') || path.startsWith('/store-orders') || path.startsWith('/store-order-tracker') || path.startsWith('/audit') || path.startsWith('/warehouse')) {
    return '/store-dashboard';
  }
  if (path === '/dispatch') {
    return '/dispatch-dashboard';
  }
  if (path === '/dispatch-dashboard') {
    return '/dashboard';
  }
  if (path.startsWith('/demand-history')) {
    return role === 'STORE' ? '/store-dashboard' : (role === 'OUTLET' ? '/outlet-dashboard' : '/dashboard');
  }

  return getRoleHomeRoute(role);
};

export function useAppBack() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();

  const goBack = useCallback(() => {
    const hasHistory = window.history.state && typeof window.history.state.idx === 'number' && window.history.state.idx > 0;

    if (hasHistory) {
      navigate(-1);
    } else {
      const fallback = getParentRoute(location.pathname, user?.role);
      navigate(fallback, { replace: true });
    }
  }, [navigate, location.pathname, user?.role]);

  return { goBack };
}

export default useAppBack;
