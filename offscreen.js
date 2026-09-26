/**
 * Web Monitor - Offscreen Document
 * Provides reliable Web Audio synthesis and high-precision ticker for MV3.
 */

let activeTickerId = null;
let currentInterval = 10;

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'PLAY_BEEP') {
    playSynthesizedSound(message.soundType || 'chime', message.duration || 3, message.volume || 0.7);
    sendResponse({ success: true });
    return true;
  }

  if (message.type === 'START_TICKER') {
    startTicker(message.intervalSeconds || 10);
    sendResponse({ success: true });
    return true;
  }

  if (message.type === 'STOP_TICKER') {
    stopTicker();
    sendResponse({ success: true });
    return true;
  }

  return false;
});

function startTicker(intervalSeconds) {
  stopTicker();
  currentInterval = Math.max(3, intervalSeconds);
  activeTickerId = setInterval(() => {
    chrome.runtime.sendMessage({ type: 'HEARTBEAT_TICK' }).catch(() => {
      // background might be waking up
    });
  }, currentInterval * 1000);
}

function stopTicker() {
  if (activeTickerId !== null) {
    clearInterval(activeTickerId);
    activeTickerId = null;
  }
}

/**
 * Play synthesized sound using Web Audio API
 */
function playSynthesizedSound(type = 'chime', duration = 3, volume = 0.7) {
  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;

    const ctx = new AudioContextClass();
    const now = ctx.currentTime;
    const masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(Math.min(1.0, Math.max(0.05, volume)), now);
    masterGain.connect(ctx.destination);

    switch (type) {
      case 'radar': {
        const cycle = 1.0;
        const loops = Math.max(1, Math.ceil(duration / cycle));
        for (let i = 0; i < loops; i++) {
          const t = now + i * cycle;
          playRadarPulse(ctx, masterGain, t);
        }
        break;
      }

      case 'success': {
        const cycle = 0.8;
        const loops = Math.max(1, Math.ceil(duration / cycle));
        for (let i = 0; i < loops; i++) {
          const t = now + i * cycle;
          // Arpeggio: C5 (523Hz), E5 (659Hz), G5 (784Hz), C6 (1046Hz)
          playTone(ctx, masterGain, 523.25, 'sine', t, 0.12, 0.4);
          playTone(ctx, masterGain, 659.25, 'sine', t + 0.1, 0.12, 0.4);
          playTone(ctx, masterGain, 783.99, 'sine', t + 0.2, 0.12, 0.4);
          playTone(ctx, masterGain, 1046.50, 'sine', t + 0.3, 0.35, 0.5);
        }
        break;
      }

      case 'alert': {
        const cycle = 0.6;
        const loops = Math.max(1, Math.ceil(duration / cycle));
        for (let i = 0; i < loops; i++) {
          const t = now + i * cycle;
          playTone(ctx, masterGain, 880, 'triangle', t, 0.12, 0.5);
          playTone(ctx, masterGain, 1174.66, 'triangle', t + 0.16, 0.18, 0.5);
        }
        break;
      }

      case 'beep': {
        const cycle = 0.5;
        const loops = Math.max(1, Math.ceil(duration / cycle));
        for (let i = 0; i < loops; i++) {
          const t = now + i * cycle;
          playTone(ctx, masterGain, 800, 'sine', t, 0.2, 0.45);
        }
        break;
      }

      case 'chime':
      default: {
        const cycle = 1.6;
        const loops = Math.max(1, Math.ceil(duration / cycle));
        for (let i = 0; i < loops; i++) {
          const t = now + i * cycle;
          // Ding (784Hz) -> Dong (523Hz) with smooth decaying harmonics
          playTone(ctx, masterGain, 783.99, 'sine', t, 0.45, 0.5);
          playTone(ctx, masterGain, 1567.98, 'sine', t, 0.25, 0.15); // soft harmonic
          playTone(ctx, masterGain, 523.25, 'sine', t + 0.35, 0.9, 0.55);
          playTone(ctx, masterGain, 1046.50, 'sine', t + 0.35, 0.4, 0.15); // soft harmonic
        }
        break;
      }
    }
  } catch (err) {
    console.error('[Web Monitor Offscreen] Audio playback error:', err);
  }
}

function playTone(ctx, destination, freq, type, startTime, duration, vol = 0.5) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = type;
  osc.frequency.setValueAtTime(freq, startTime);

  gain.gain.setValueAtTime(0.001, startTime);
  gain.gain.exponentialRampToValueAtTime(vol, startTime + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

  osc.connect(gain);
  gain.connect(destination);

  osc.start(startTime);
  osc.stop(startTime + duration + 0.05);
}

function playRadarPulse(ctx, destination, startTime) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = 'sine';
  osc.frequency.setValueAtTime(1400, startTime);
  osc.frequency.exponentialRampToValueAtTime(800, startTime + 0.4);

  gain.gain.setValueAtTime(0.001, startTime);
  gain.gain.exponentialRampToValueAtTime(0.5, startTime + 0.03);
  gain.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.5);

  osc.connect(gain);
  gain.connect(destination);

  osc.start(startTime);
  osc.stop(startTime + 0.55);
}
