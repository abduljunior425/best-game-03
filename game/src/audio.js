// Sound for Emberhold: every effect is synthesised with Web Audio, so the
// game ships no sound files at all. The context is created on the first
// user gesture (browsers block audio before that) and every call is safe
// before it exists.

let context = null;
let muted = false;

export function isMuted() {
  return muted;
}

export function toggleMute() {
  muted = !muted;
  return muted;
}

/** Create (or reuse) the audio context. Call from a user gesture. */
export function ensureAudio() {
  if (!context) {
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      context = new AudioContext();
    } catch {
      context = null;
    }
  }
  if (context && context.state === 'suspended') context.resume();
  return context;
}

function tone(freq, endFreq, seconds, type, volume) {
  if (muted || !context || context.state !== 'running') return;
  try {
    const now = context.currentTime;
    const osc = context.createOscillator();
    const gain = context.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    if (endFreq !== freq) osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), now + seconds);
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + seconds);
    osc.connect(gain);
    gain.connect(context.destination);
    osc.start(now);
    osc.stop(now + seconds + 0.02);
  } catch {
    // Audio is decoration; never let it break the game.
  }
}

function chord(notes, seconds, type, volume) {
  notes.forEach((freq, i) => {
    setTimeout(() => tone(freq, freq, seconds, type, volume), i * 70);
  });
}

export const sfx = {
  shoot() {
    tone(720, 320, 0.07, 'square', 0.045);
  },
  frost() {
    tone(980, 540, 0.1, 'sine', 0.05);
  },
  cannon() {
    tone(190, 55, 0.16, 'triangle', 0.09);
  },
  kill() {
    tone(340, 90, 0.09, 'square', 0.05);
  },
  leak() {
    tone(130, 55, 0.3, 'sawtooth', 0.11);
  },
  build() {
    chord([523, 784], 0.12, 'triangle', 0.08);
  },
  upgrade() {
    chord([392, 523, 659], 0.12, 'triangle', 0.08);
  },
  sell() {
    tone(440, 660, 0.09, 'sine', 0.06);
  },
  denied() {
    tone(160, 110, 0.12, 'square', 0.07);
  },
  wave() {
    chord([220, 277, 330], 0.22, 'sawtooth', 0.06);
  },
  clear() {
    chord([523, 659, 784, 1046], 0.16, 'triangle', 0.08);
  },
  win() {
    chord([523, 659, 784, 1046, 1318], 0.22, 'triangle', 0.09);
  },
  lose() {
    chord([392, 330, 262, 196], 0.28, 'sawtooth', 0.07);
  },
  click() {
    tone(880, 880, 0.04, 'sine', 0.04);
  },
};
