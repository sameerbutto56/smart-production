import { useState, useEffect, useRef, useCallback } from 'react';
import socket from '../socket';

const playBeep = () => {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 880;
    osc.type = 'sine';
    gain.gain.value = 0.3;
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
    osc.start();
    osc.stop(ctx.currentTime + 0.3);
  } catch {
    // silent
  }
};

export default function useDemandNotification() {
  const [activeAlert, setActiveAlert] = useState(null);
  const intervalRef = useRef(null);

  const stopSound = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const startSound = useCallback(() => {
    if (intervalRef.current) return;
    playBeep();
    intervalRef.current = setInterval(playBeep, 7000);
  }, []);

  const acknowledge = useCallback(() => {
    stopSound();
    setActiveAlert(null);
  }, [stopSound]);

  useEffect(() => {
    const onNewDemand = (data) => {
      setActiveAlert({
        type: 'demand:new',
        ...data,
        message: `New Demand Request from ${data.outletName} (${data.itemCount} items)`
      });
      startSound();
    };

    const onDemandUpdated = (data) => {
      setActiveAlert({
        type: 'demand:updated',
        ...data,
        message: `Demand Request ${data.transferNumber} ${data.status}`
      });
      startSound();
    };

    const onDemandAccepted = (data) => {
      setActiveAlert({
        type: 'demand:accepted',
        ...data,
        message: `${data.outletName} accepted Demand Request ${data.transferNumber || ''}`
      });
      startSound();
    };

    socket.on('demand:new', onNewDemand);
    socket.on('demand:updated', onDemandUpdated);
    socket.on('demand:accepted', onDemandAccepted);

    return () => {
      socket.off('demand:new', onNewDemand);
      socket.off('demand:updated', onDemandUpdated);
      socket.off('demand:accepted', onDemandAccepted);
      stopSound();
    };
  }, [startSound, stopSound]);

  return { activeAlert, acknowledge };
}
