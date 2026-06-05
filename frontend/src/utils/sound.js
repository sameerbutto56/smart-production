export const playAlertSound = (priority = 'URGENT') => {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    if (priority === 'SUPER_URGENT') {
      osc.frequency.value = 880;
      osc.type = 'square';
      gain.gain.value = 0.3;
      osc.start();
      osc.stop(ctx.currentTime + 0.5);
      // Second beep
      setTimeout(() => {
        const ctx2 = new (window.AudioContext || window.webkitAudioContext)();
        const osc2 = ctx2.createOscillator();
        const gain2 = ctx2.createGain();
        osc2.connect(gain2);
        gain2.connect(ctx2.destination);
        osc2.frequency.value = 1100;
        osc2.type = 'square';
        gain2.gain.value = 0.4;
        osc2.start();
        osc2.stop(ctx2.currentTime + 0.3);
      }, 600);
    } else {
      osc.frequency.value = 660;
      osc.type = 'sine';
      gain.gain.value = 0.2;
      osc.start();
      osc.stop(ctx.currentTime + 0.3);
    }
  } catch (e) {
    console.warn('Audio not available:', e);
  }
};
