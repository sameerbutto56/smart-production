import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import api from '../services/api';
import socket from '../socket';
import { DEFAULT_DELAY_CONFIG, getDelayInfo, getAllowedHours, computeStageDeadline, getEffectiveStage } from '../utils/delayUtils';
import { useSystemPause } from './SystemPauseContext';

const DelayContext = createContext(null);

export const useDelay = () => {
  const ctx = useContext(DelayContext);
  if (!ctx) {
    // Return safe fallback if used outside provider
    return {
      delayConfig: DEFAULT_DELAY_CONFIG,
      loading: false,
      refreshDelayConfig: async () => {},
      getOrderDelay: (order) => getDelayInfo(order, DEFAULT_DELAY_CONFIG),
      isOrderDelayed: (order) => Boolean(order?.delayInfo?.isDelayed || getDelayInfo(order, DEFAULT_DELAY_CONFIG)?.isDelayed),
      getAllowedHours: (stage) => getAllowedHours(stage, DEFAULT_DELAY_CONFIG),
      computeStageDeadline: (stage, startMs) => computeStageDeadline(stage, startMs, DEFAULT_DELAY_CONFIG),
    };
  }
  return ctx;
};

export const DelayProvider = ({ children }) => {
  const [delayConfig, setDelayConfig] = useState(DEFAULT_DELAY_CONFIG);
  const [loading, setLoading] = useState(true);

  // System pause periods to pause delay timers if pause is active
  let pausePeriods = null;
  let profileKey = null;
  try {
    const pauseCtx = useSystemPause();
    pausePeriods = pauseCtx?.periods || null;
    profileKey = pauseCtx?.myProfile || null;
  } catch (e) {
    // DelayProvider might be mounted alongside or above SystemPauseProvider
  }

  const refreshDelayConfig = useCallback(async () => {
    try {
      const res = await api.get('/api/software-settings/delay-config');
      const cfg = res.data?.config || (res.data && typeof res.data === 'object' && !Array.isArray(res.data) ? res.data : null);
      if (cfg) {
        setDelayConfig((prev) => ({ ...prev, ...cfg }));
      }
    } catch (e) {
      // Non-critical, keep fallback default
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshDelayConfig();

    const onDelayUpdated = (data) => {
      if (data?.config) {
        setDelayConfig((prev) => ({ ...prev, ...data.config }));
      } else {
        refreshDelayConfig();
      }
    };

    const onConnect = () => {
      refreshDelayConfig();
    };

    socket.on('delay-config-updated', onDelayUpdated);
    socket.on('connect', onConnect);
    window.addEventListener('focus', refreshDelayConfig);

    return () => {
      socket.off('delay-config-updated', onDelayUpdated);
      socket.off('connect', onConnect);
      window.removeEventListener('focus', refreshDelayConfig);
    };
  }, [refreshDelayConfig]);

  const getOrderDelay = useCallback(
    (order) => {
      if (!order) return null;
      // If backend attached delayInfo and its config is already current, we can use it,
      // but evaluating getDelayInfo with current delayConfig guarantees real-time updates!
      const clientCalculated = getDelayInfo(order, delayConfig, pausePeriods, profileKey);
      if (clientCalculated) return clientCalculated;
      if (order?.delayInfo?.isDelayed) return order.delayInfo;
      return null;
    },
    [delayConfig, pausePeriods, profileKey]
  );

  const isOrderDelayed = useCallback(
    (order) => {
      if (!order) return false;
      const d = getOrderDelay(order);
      return Boolean(d && d.isDelayed);
    },
    [getOrderDelay]
  );

  const contextValue = {
    delayConfig,
    loading,
    refreshDelayConfig,
    getOrderDelay,
    isOrderDelayed,
    getAllowedHours: (stage) => getAllowedHours(stage, delayConfig),
    computeStageDeadline: (stage, startMs) => computeStageDeadline(stage, startMs, delayConfig),
    getEffectiveStage,
  };

  return <DelayContext.Provider value={contextValue}>{children}</DelayContext.Provider>;
};

export default DelayContext;
