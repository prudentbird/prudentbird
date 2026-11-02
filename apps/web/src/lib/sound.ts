const STORAGE_KEY = "sound";
const PENTATONIC = [0, 2, 4, 7, 9];
const ROOT = 293.66;

export const pitch = (n: number) =>
  ROOT * 2 ** ((12 * Math.floor(n / 5) + PENTATONIC[((n % 5) + 5) % 5]!) / 12);

type Bus = {
  ctx: AudioContext;
  master: GainNode;
  duck: GainNode;
  dry: GainNode;
  wet: GainNode;
  noise: AudioBuffer;
};

let bus: Bus | null = null;
let enabled: boolean | null = null;
const listeners = new Set<() => void>();
const last = new Map<string, number>();

function readEnabled() {
  if (enabled === null) {
    try {
      enabled = localStorage.getItem(STORAGE_KEY) !== "off";
    } catch {
      enabled = true;
    }
  }
  return enabled;
}

export function isSoundEnabled() {
  return typeof window === "undefined" ? true : readEnabled();
}

export function subscribeSound(listener: () => void) {
  listeners.add(listener);
  return () => void listeners.delete(listener);
}

export function setSoundEnabled(next: boolean) {
  if (next === readEnabled()) return;
  if (!next) sounds.off();
  enabled = next;
  try {
    localStorage.setItem(STORAGE_KEY, next ? "on" : "off");
  } catch {}
  listeners.forEach((listener) => listener());
  if (next) {
    unlockSound();
    sounds.on();
  } else if (bus) {
    const b = bus;
    setTimeout(() => {
      if (!readEnabled()) void b.ctx.suspend();
    }, 400);
  }
}

function impulse(ctx: AudioContext, seconds: number, decay: number) {
  const length = Math.floor(ctx.sampleRate * seconds);
  const buffer = ctx.createBuffer(2, length, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const data = buffer.getChannelData(ch);
    for (let i = 0; i < length; i++)
      data[i] = (Math.random() * 2 - 1) * (1 - i / length) ** decay;
  }
  return buffer;
}

function createBus(): Bus | null {
  const AC =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!AC) return null;
  const ctx = new AC({ latencyHint: "interactive" });
  const compressor = ctx.createDynamicsCompressor();
  compressor.threshold.value = -20;
  compressor.knee.value = 12;
  compressor.ratio.value = 4;
  compressor.attack.value = 0.003;
  compressor.release.value = 0.2;
  compressor.connect(ctx.destination);

  const master = ctx.createGain();
  master.gain.value = 1.4;
  master.connect(compressor);
  const duck = ctx.createGain();
  duck.connect(master);

  const dry = ctx.createGain();
  dry.connect(duck);
  const reverb = ctx.createConvolver();
  reverb.buffer = impulse(ctx, 1.4, 3.2);
  const wet = ctx.createGain();
  wet.gain.value = 0.5;
  wet.connect(reverb).connect(duck);

  const noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const data = noise.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;

  return { ctx, master, duck, dry, wet, noise };
}

export function unlockSound() {
  if (typeof window === "undefined" || !readEnabled()) return;
  bus ??= createBus();
  if (bus && bus.ctx.state !== "running") void bus.ctx.resume();
}

function live() {
  if (!bus || !readEnabled() || document.hidden) return null;
  if (bus.ctx.state === "running") return bus;
  const activation = (
    navigator as Navigator & { userActivation?: { isActive: boolean } }
  ).userActivation;
  if (bus.ctx.state === "suspended" && (activation?.isActive ?? false)) {
    void bus.ctx.resume();
    return bus;
  }
  return null;
}

function gate(key: string, ms: number) {
  const now = performance.now();
  if (now - (last.get(key) ?? -Infinity) < ms) return false;
  last.set(key, now);
  return true;
}

const clamp = (n: number, min: number, max: number) =>
  Math.min(max, Math.max(min, n));

export function panAt(x?: number) {
  if (x === undefined || typeof window === "undefined") return 0;
  return clamp((x / window.innerWidth) * 2 - 1, -1, 1) * 0.55;
}

type Shape = {
  at?: number;
  attack?: number;
  gain: number;
  pan?: number;
  wet?: number;
};

function route(b: Bus, node: AudioNode, shape: Shape) {
  const panner = b.ctx.createStereoPanner();
  panner.pan.value = clamp(shape.pan ?? 0, -1, 1);
  node.connect(panner);
  panner.connect(b.dry);
  let send: GainNode | null = null;
  if (shape.wet) {
    send = b.ctx.createGain();
    send.gain.value = shape.wet;
    panner.connect(send);
    send.connect(b.wet);
  }
  return () => {
    panner.disconnect();
    send?.disconnect();
  };
}

function envelope(b: Bus, start: number, decay: number, shape: Shape) {
  const attack = shape.attack ?? 0.003;
  const g = b.ctx.createGain();
  g.gain.setValueAtTime(0, start);
  g.gain.linearRampToValueAtTime(shape.gain, start + attack);
  g.gain.exponentialRampToValueAtTime(1e-4, start + attack + decay);
  return { g, end: start + attack + decay + 0.03 };
}

function tone(
  b: Bus,
  shape: Shape & {
    freq: number;
    to?: number;
    decay: number;
    type?: OscillatorType;
  },
) {
  const start = b.ctx.currentTime + (shape.at ?? 0);
  const osc = b.ctx.createOscillator();
  osc.type = shape.type ?? "sine";
  osc.frequency.setValueAtTime(shape.freq, start);
  if (shape.to)
    osc.frequency.exponentialRampToValueAtTime(
      shape.to,
      start + (shape.attack ?? 0.003) + shape.decay * 0.7,
    );
  const { g, end } = envelope(b, start, shape.decay, shape);
  osc.connect(g);
  const release = route(b, g, shape);
  osc.onended = () => {
    g.disconnect();
    release();
  };
  osc.start(start);
  osc.stop(end);
}

function hiss(
  b: Bus,
  shape: Shape & {
    freq: number;
    to?: number;
    q?: number;
    dur: number;
    filter?: BiquadFilterType;
  },
) {
  const start = b.ctx.currentTime + (shape.at ?? 0);
  const src = b.ctx.createBufferSource();
  src.buffer = b.noise;
  src.loop = true;
  const filter = b.ctx.createBiquadFilter();
  filter.type = shape.filter ?? "bandpass";
  filter.Q.value = shape.q ?? 1;
  filter.frequency.setValueAtTime(shape.freq, start);
  if (shape.to)
    filter.frequency.exponentialRampToValueAtTime(shape.to, start + shape.dur);
  const { g, end } = envelope(b, start, shape.dur, shape);
  src.connect(filter).connect(g);
  const release = route(b, g, shape);
  src.onended = () => {
    filter.disconnect();
    g.disconnect();
    release();
  };
  src.start(start, Math.random() * 0.6);
  src.stop(end);
}

function mallet(
  b: Bus,
  freq: number,
  shape: Shape & { decay?: number } = { gain: 0.05 },
) {
  const decay = shape.decay ?? 0.45;
  tone(b, { ...shape, freq, decay, wet: shape.wet ?? 0.3 });
  tone(b, {
    ...shape,
    freq: freq * 3.99,
    decay: 0.05,
    gain: shape.gain * 0.22,
    wet: 0.05,
  });
  tone(b, {
    ...shape,
    freq: freq * 2.01,
    decay: decay * 0.35,
    gain: shape.gain * 0.18,
    wet: 0.1,
  });
}

export const sounds = {
  hover(x?: number) {
    const b = live();
    if (!b || !gate("hover", 40)) return;
    const w = typeof window === "undefined" ? 1 : window.innerWidth;
    const n = 6 + Math.round(clamp((x ?? w / 2) / w, 0, 1) * 8);
    const pan = panAt(x);
    tone(b, { freq: pitch(n), decay: 0.09, gain: 0.034, pan, wet: 0.4 });
    hiss(b, { freq: 4500, q: 1.5, dur: 0.005, gain: 0.03, pan });
  },

  tap(x?: number) {
    const b = live();
    if (!b || !gate("tap", 30)) return;
    const pan = panAt(x);
    hiss(b, { freq: 3600, q: 0.9, dur: 0.012, gain: 0.12, pan });
    tone(b, {
      freq: 1500,
      to: 650,
      type: "triangle",
      decay: 0.035,
      gain: 0.07,
      pan,
      wet: 0.08,
    });
  },

  drop(x?: number, y?: number) {
    const b = live();
    if (!b || !gate("drop", 60)) return;
    const h = typeof window === "undefined" ? 1 : window.innerHeight;
    const n = 4 + Math.round((1 - clamp((y ?? h / 2) / h, 0, 1)) * 7);
    const f = pitch(n);
    const pan = panAt(x);
    tone(b, { freq: f, to: f * 1.5, decay: 0.09, gain: 0.035, pan, wet: 0.45 });
    tone(b, {
      freq: f * 2,
      to: f * 3,
      decay: 0.03,
      gain: 0.012,
      pan,
      wet: 0.2,
    });
  },

  send(x?: number) {
    const b = live();
    if (!b || !gate("send", 300)) return;
    const pan = panAt(x);
    hiss(b, {
      freq: 500,
      to: 5000,
      q: 0.7,
      dur: 0.32,
      attack: 0.12,
      gain: 0.05,
      pan,
      wet: 0.3,
    });
    mallet(b, pitch(12), { at: 0.2, gain: 0.03, pan });
  },

  copy(x?: number) {
    const b = live();
    if (!b) return;
    const pan = panAt(x);
    mallet(b, pitch(8), { gain: 0.05, pan, decay: 0.3 });
    mallet(b, pitch(10), { at: 0.075, gain: 0.05, pan, decay: 0.6 });
  },

  fail(x?: number) {
    const b = live();
    if (!b) return;
    const pan = panAt(x);
    for (const at of [0, 0.1])
      tone(b, {
        at,
        freq: 233,
        to: 196,
        type: "square",
        decay: 0.08,
        gain: 0.035,
        pan,
      });
  },

  theme(mode: string, x?: number) {
    const b = live();
    if (!b) return;
    const pan = panAt(x);
    const notes =
      mode === "light" ? [7, 10, 12] : mode === "dark" ? [10, 7, 3] : [5, 9];
    const soft = mode === "dark";
    notes.forEach((n, i) =>
      mallet(b, pitch(n), {
        at: i * 0.065,
        gain: soft ? 0.04 : 0.045,
        decay: soft ? 0.7 : 0.4,
        pan,
        wet: soft ? 0.5 : 0.3,
      }),
    );
  },

  on() {
    const b = live();
    if (!b) return;
    [5, 8, 10].forEach((n, i) =>
      mallet(b, pitch(n), { at: i * 0.06, gain: 0.045, decay: 0.4 }),
    );
  },

  off() {
    const b = live();
    if (!b) return;
    tone(b, { freq: pitch(7), to: pitch(2), decay: 0.12, gain: 0.04 });
  },

  coin(x?: number) {
    const b = live();
    if (!b || !gate("coin", 200)) return;
    const pan = panAt(x);
    tone(b, {
      freq: 987.77,
      type: "square",
      attack: 0.001,
      decay: 0.06,
      gain: 0.022,
      pan,
    });
    tone(b, {
      at: 0.065,
      freq: 1318.51,
      type: "square",
      attack: 0.001,
      decay: 0.32,
      gain: 0.022,
      pan,
      wet: 0.1,
    });
  },
};

export type SoundName = keyof typeof sounds;
