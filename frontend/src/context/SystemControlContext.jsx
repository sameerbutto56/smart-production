import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import api from '../services/api';
import { useAuth } from './AuthContext';
import socket from '../socket';
import { FEATURES } from '../utils/featureRegistry';

const SystemControlContext = createContext(null);

export const SystemControlProvider = ({ children }) => {
  const { user } = useAuth();
  const [permissions, setPermissions] = useState({});
  const [loading, setLoading] = useState(true);

  const fetchPermissions = useCallback(async () => {
    if (!user) {
      setPermissions({});
      setLoading(false);
      return;
    }

    try {
      const res = await api.get('/api/system-control/my-permissions');
      if (res.data?.permissions) {
        setPermissions(res.data.permissions);
      }
    } catch (err) {
      // Fallback to default definition if offline or error
      const userRole = String(user?.role || '').toUpperCase().trim();
      const fallback = {};
      FEATURES.forEach(f => {
        fallback[f.id] = userRole === 'SUPER_ADMIN' ? true : (f.defaultProfiles || []).includes(userRole);
      });
      setPermissions(fallback);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchPermissions();
  }, [fetchPermissions]);

  // Real-time socket synchronization when Software Settings changes permissions
  useEffect(() => {
    if (!socket) return;
    const handleUpdate = (data) => {
      const userRole = String(user?.role || '').toUpperCase().trim();
      if (
        !data ||
        data.profile === userRole ||
        (data.profile === 'ADMIN' && userRole === 'SUPER_ADMIN') ||
        (data.profile === 'SUPER_ADMIN' && userRole === 'ADMIN')
      ) {
        fetchPermissions();
      }
    };

    socket.on('system-control:updated', handleUpdate);
    return () => {
      socket.off('system-control:updated', handleUpdate);
    };
  }, [socket, user, fetchPermissions]);

  const hasPermission = useCallback((featureId) => {
    if (!featureId) return true;
    if (!user) return false;
    const userRole = String(user?.role || '').toUpperCase().trim();

    // 1. Strict check: If loaded permission explicitly says false, it is strictly disabled!
    if (permissions[featureId] === false) {
      return false;
    }

    // 2. If loaded permission explicitly says true, it is enabled
    if (permissions[featureId] === true) {
      return true;
    }

    // 3. Fallback to default definition if permission key not yet loaded
    const def = FEATURES.find(f => f.id === featureId);
    if (!def) return false;

    if (userRole === 'SUPER_ADMIN' || userRole === 'ADMIN') {
      return (def.defaultProfiles || []).includes('SUPER_ADMIN') ||
             (def.defaultProfiles || []).includes('ADMIN') ||
             userRole === 'SUPER_ADMIN';
    }

    return (def.defaultProfiles || []).includes(userRole);
  }, [permissions, user]);

  const value = useMemo(() => ({
    permissions,
    hasPermission,
    loading,
    refreshPermissions: fetchPermissions,
  }), [permissions, hasPermission, loading, fetchPermissions]);

  return (
    <SystemControlContext.Provider value={value}>
      {children}
    </SystemControlContext.Provider>
  );
};

export const useSystemControl = () => {
  const ctx = useContext(SystemControlContext);
  if (!ctx) {
    return {
      permissions: {},
      hasPermission: () => true,
      loading: false,
      refreshPermissions: () => {},
    };
  }
  return ctx;
};

/**
 * FeatureGate: Conditionally renders children only if feature is enabled in System Control.
 */
export const FeatureGate = ({ feature, fallback = null, children }) => {
  const { hasPermission } = useSystemControl();
  if (!hasPermission(feature)) {
    return fallback;
  }
  return children;
};
