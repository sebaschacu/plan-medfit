// Avisos del temporizador de descanso. Los dos son opcionales por diseño: si el
// navegador no los soporta, la app sigue funcionando sin ruido ni vibración.

export const playBeep = () => {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.connect(g); g.connect(ctx.destination);
    o.frequency.value = 880; o.type = 'sine';
    g.gain.setValueAtTime(0.3, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
    o.start(); o.stop(ctx.currentTime + 0.4);
  } catch { /* sin AudioContext: el pitido es opcional */ }
};

export const vibrate = (p) => { try { navigator.vibrate?.(p); } catch { /* sin motor de vibración */ } };
