/**
 * eridian.js - the "Eridian Audio-Visual Interface".
 *
 * Hovering (or touching / keyboard-focusing) an element makes the UI "speak":
 *   1. AUDIO  - a random 3-note chord, synthesised with the native Web Audio API.
 *   2. VISUAL - a ring of glowing spikes bursts out from the element on a canvas overlay.
 *
 * Browsers block sound until the user has interacted with the page, so the audio engine is
 * armed by the first click / key press anywhere (or by the AUDIO button in the nav).
 * The visuals work immediately, with or without sound.
 */

// ---------- Musical material ----------
// Just-intonation ratios give pure, consonant intervals with an alien, "not quite piano" feel.
const SCALE = [1, 9 / 8, 5 / 4, 4 / 3, 3 / 2, 5 / 3, 15 / 8, 2, 9 / 4, 5 / 2];
const ROOTS = [196.0, 220.0, 246.94, 261.63, 293.66, 329.63];   // G3 .. E4 in Hz
const COOLDOWN_MS = 260;      // minimum gap between chords so fast mouse sweeps don't pile up
const WAVE_MS = 1100;         // lifetime of one soundwave burst
const SPIKES = 72;            // spikes per burst

const pick = list => list[Math.floor(Math.random() * list.length)];

/** Random chord: one root, three distinct ratios from the scale, sorted low to high. Returns Hz values. */
export function randomChord() {
  const root = pick(ROOTS);
  const ratios = [...SCALE].sort(() => Math.random() - 0.5).slice(0, 3).sort((a, b) => a - b);
  return ratios.map(r => root * r);
}

// ---------- Audio engine ----------
let ctx = null;            // AudioContext, created lazily on the first user gesture
let master = null;         // master gain -> compressor -> speakers
let enabled = false;       // false = muted
let lastPlay = 0;

/** Create (or resume) the AudioContext. Must run inside a user gesture. */
function arm() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;                                   // very old browser: stay silent
    ctx = new AC();
    const compressor = ctx.createDynamicsCompressor();       // prevents clipping when chords overlap
    master = ctx.createGain();
    master.gain.value = 0.5;
    master.connect(compressor);
    compressor.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  enabled = true;
  return true;
}

/**
 * Play a chord as a soft synth-flute: each note is a sine (fundamental) plus a quiet triangle one
 * octave up, low-pass filtered, with a fast attack, a long decay and a slow vibrato shared by all notes.
 * Notes are staggered by 35 ms so the chord "blooms" instead of clicking in.
 */
function playChord(notes) {
  if (!ctx || !enabled || !master) return;
  const t0 = ctx.currentTime + 0.01;
  const dur = 1.15;

  const lfo = ctx.createOscillator();            // vibrato: 5.2 Hz wobble
  const lfoDepth = ctx.createGain();
  lfo.frequency.value = 5.2;
  lfoDepth.gain.value = 2.2;                     // +-2.2 Hz
  lfo.connect(lfoDepth);

  notes.forEach((freq, i) => {
    const start = t0 + i * 0.035;
    const envelope = ctx.createGain();           // amplitude envelope (exponential ramps cannot hit 0)
    envelope.gain.setValueAtTime(0.0001, start);
    envelope.gain.exponentialRampToValueAtTime(0.2, start + 0.05);
    envelope.gain.exponentialRampToValueAtTime(0.0001, start + dur);

    const lowpass = ctx.createBiquadFilter();    // softens the triangle's edge
    lowpass.type = 'lowpass';
    lowpass.frequency.value = 2400;

    [['sine', 1, 1], ['triangle', 2, 0.18]].forEach(([type, multiple, level]) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.value = freq * multiple;
      gain.gain.value = level;
      lfoDepth.connect(osc.frequency);           // LFO modulates pitch
      osc.connect(gain);
      gain.connect(lowpass);
      osc.start(start);
      osc.stop(start + dur + 0.05);
    });

    lowpass.connect(envelope);
    envelope.connect(master);
  });

  lfo.start(t0);
  lfo.stop(t0 + dur + 0.2);
}

// ---------- Soundwave visualiser ----------
let fx = null, fxCtx = null, raf = 0;
const waves = [];                                // active bursts

function sizeFx() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  fx.width = window.innerWidth * dpr;
  fx.height = window.innerHeight * dpr;
  fxCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

/** Spike height at angle theta. Built from the chord's own notes, so every chord has its own shape. */
function amplitude(theta, notes, age) {
  let sum = 0;
  notes.forEach((freq, k) => { sum += Math.abs(Math.sin(theta * (2 + k * 2) + freq * 0.013 + age * 9)); });
  return Math.pow(sum / notes.length, 1.4);
}

function spawnWave(el, notes) {
  const r = el.getBoundingClientRect();
  waves.push({ x: r.left + r.width / 2, y: r.top + r.height / 2, rx: r.width / 2, ry: r.height / 2, t0: performance.now(), notes });
  if (!raf) raf = requestAnimationFrame(drawWaves);
}

function drawWaves(now) {
  const W = window.innerWidth, H = window.innerHeight;
  fxCtx.clearRect(0, 0, W, H);
  fxCtx.lineCap = 'round';

  for (let i = waves.length - 1; i >= 0; i--) {
    const w = waves[i];
    const age = (now - w.t0) / WAVE_MS;                       // 0 -> 1
    if (age >= 1) { waves.splice(i, 1); continue; }
    const env = Math.pow(1 - age, 1.6) * Math.min(1, age / 0.06);   // quick swell, slow fade

    // expanding shock ring that follows the element's outline
    fxCtx.strokeStyle = `rgba(0, 240, 255, ${0.5 * env})`;
    fxCtx.lineWidth = 1.5;
    fxCtx.beginPath();
    fxCtx.ellipse(w.x, w.y, w.rx + age * 70, w.ry + age * 70, 0, 0, Math.PI * 2);
    fxCtx.stroke();

    // spikes: start on the element's outline, point outward along its normal
    fxCtx.lineWidth = 2;
    for (let s = 0; s < SPIKES; s++) {
      const theta = (s / SPIKES) * Math.PI * 2;
      const c = Math.cos(theta), sn = Math.sin(theta);
      const nx = c / w.rx, ny = sn / w.ry, nl = Math.hypot(nx, ny);
      const len = (6 + 44 * amplitude(theta, w.notes, age)) * env;
      const sx = w.x + w.rx * c, sy = w.y + w.ry * sn;
      fxCtx.strokeStyle = s % 2 ? `rgba(255, 170, 0, ${env})` : `rgba(0, 240, 255, ${env})`;
      fxCtx.beginPath();
      fxCtx.moveTo(sx, sy);
      fxCtx.lineTo(sx + (nx / nl) * len, sy + (ny / nl) * len);
      fxCtx.stroke();
    }
  }

  if (waves.length) raf = requestAnimationFrame(drawWaves);
  else { raf = 0; fxCtx.clearRect(0, 0, W, H); }
}

// ---------- Public setup ----------
/**
 * @param {Object}      opts
 * @param {Element[]}   opts.targets   elements that "speak" when hovered, touched or focused
 * @param {Element}     opts.audioBtn  nav button that shows / toggles the audio state
 * @param {HTMLCanvasElement} opts.fxCanvas full-screen overlay canvas for the soundwaves
 */
export function initEridian({ targets, audioBtn, fxCanvas }) {
  fx = fxCanvas;
  fxCtx = fx.getContext('2d');
  sizeFx();
  window.addEventListener('resize', sizeFx);

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function speak(el) {
    const now = performance.now();
    if (now - lastPlay < COOLDOWN_MS) return;
    lastPlay = now;
    const notes = randomChord();
    playChord(notes);
    if (!reduceMotion) spawnWave(el, notes);
  }

  targets.forEach(el => {
    // mouse: hover. Touch and pen have no hover, so they trigger on press instead.
    el.addEventListener('pointerenter', e => { if (e.pointerType === 'mouse') speak(el); });
    el.addEventListener('pointerdown', e => { if (e.pointerType !== 'mouse') speak(el); });
    // keyboard users: speak when focus arrives via Tab
    el.addEventListener('focus', () => { if (el.matches(':focus-visible')) speak(el); });
  });

  // Audio button label reflects the state
  const refresh = () => {
    audioBtn.textContent = !ctx ? 'AUDIO: TAP TO ENABLE' : enabled ? 'AUDIO: ON' : 'AUDIO: MUTED';
    audioBtn.setAttribute('aria-pressed', String(enabled));
  };

  // First interaction anywhere arms the audio (the AUDIO button handles itself in its click handler)
  const unlock = e => {
    if (ctx || (e.target.closest && e.target.closest('#audioBtn'))) return;
    arm();
    refresh();
  };
  window.addEventListener('pointerdown', unlock, true);
  window.addEventListener('keydown', unlock, true);

  audioBtn.addEventListener('click', () => {
    if (!ctx) arm();
    else { enabled = !enabled; if (enabled && ctx.state === 'suspended') ctx.resume().catch(() => {}); }
    refresh();
    if (enabled) playChord(randomChord());       // short confirmation chord
  });

  refresh();
}
