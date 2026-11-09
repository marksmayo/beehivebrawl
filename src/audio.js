import { game } from './game.js';

// Audio (WebAudio sfx + speech synthesis voices)

let ac = null, master = null, noiseBuf = null, muted = false, voicesOn = true;
function audioInit() {
  if (ac) { if (ac.state === 'suspended') ac.resume(); return; }
  ac = new (window.AudioContext || window.webkitAudioContext)();
  master = ac.createGain(); master.gain.value = .5; master.connect(ac.destination);
  noiseBuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
  const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
}
const silent = () => !ac || muted || game.demo;
function noise(dur, freq, vol, type = 'lowpass', to = null) {
  if (silent()) return;
  const t = ac.currentTime, s = ac.createBufferSource(); s.buffer = noiseBuf;
  const f = ac.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(freq, t); if (to) f.frequency.exponentialRampToValueAtTime(to, t + dur);
  const gn = ac.createGain(); gn.gain.setValueAtTime(vol, t); gn.gain.exponentialRampToValueAtTime(.001, t + dur);
  s.connect(f); f.connect(gn); gn.connect(master); s.start(t); s.stop(t + dur);
}
function tone(f1, f2, dur, type, vol) {
  if (silent()) return;
  const t = ac.currentTime, o = ac.createOscillator(); o.type = type;
  o.frequency.setValueAtTime(f1, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f2), t + dur);
  const gn = ac.createGain(); gn.gain.setValueAtTime(vol, t); gn.gain.exponentialRampToValueAtTime(.001, t + dur);
  o.connect(gn); gn.connect(master); o.start(t); o.stop(t + dur);
}
const sfx = {
  hit(h) { noise(h ? .18 : .1, h ? 900 : 1700, h ? .9 : .6); tone(h ? 140 : 220, 40, h ? .2 : .12, 'sine', .7); },
  block() { tone(1400, 900, .06, 'square', .12); noise(.06, 4000, .3, 'highpass'); },
  whoosh() { noise(.14, 500, .22, 'bandpass', 2600); },
  jump() { tone(260, 520, .12, 'sine', .15); },
  ko() { tone(110, 30, 1, 'sawtooth', .45); noise(.8, 300, .7); },
  thud() { tone(90, 30, .35, 'sine', .9); noise(.3, 500, .6); },
  super() { tone(180, 900, .45, 'sawtooth', .25); tone(240, 1200, .45, 'square', .1); },
  zap() { tone(900, 200, .25, 'square', .15); },
  select() { tone(620, 900, .07, 'square', .1); },
  confirm() { tone(500, 1000, .18, 'square', .14); tone(750, 1500, .18, 'triangle', .1); },
  bell() { tone(880, 860, .9, 'triangle', .3); tone(1320, 1300, .7, 'sine', .15); },
};
let voice = null;
function pickVoice() {
  const vs = speechSynthesis.getVoices();
  voice = vs.find(v => /en[-_]NZ/i.test(v.lang)) || vs.find(v => /en[-_]AU/i.test(v.lang)) || vs.find(v => /en[-_]GB/i.test(v.lang)) || vs.find(v => /^en/i.test(v.lang)) || null;
}
if ('speechSynthesis' in window) { pickVoice(); speechSynthesis.onvoiceschanged = pickVoice; }
function say(text, { pitch = 1, rate = 1.08, interrupt = true } = {}) {
  if (muted || !voicesOn || game.demo || !('speechSynthesis' in window)) return;
  const t = text.replace(/\*.*?\*/g, '').trim(); if (!t) return;
  if (interrupt) speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(t); if (voice) u.voice = voice;
  u.pitch = pitch; u.rate = rate; u.volume = .9; speechSynthesis.speak(u);
}

// =====================================================================

const setMuted = v => { muted = v; }, setVoicesOn = v => { voicesOn = v; };

// ---- arena ambience (70): looping beds of filtered noise plus occasional one-shots
const BEDS = { wind:['bandpass', 450, .7, .05, .18], drizzle:['highpass', 3200, .7, .03, 0], water:['lowpass', 520, .7, .045, .12], traffic:['lowpass', 260, .7, .03, .05],
  murmur:['bandpass', 700, 1.4, .03, .45], alpine:['bandpass', 1000, .4, .03, .08], cafe:['bandpass', 1600, .9, .012, .3] };
const SHOTS = {
  gulls:[4, 9, () => { tone(1800, 1100, .35, 'triangle', .03); setTimeout(() => tone(1700, 1000, .3, 'triangle', .025), 260); }],
  tram:[12, 20, () => { tone(1320, 1320, 1.2, 'sine', .04); setTimeout(() => tone(1320, 1320, 1, 'sine', .035), 380); }],
  sheep:[6, 12, () => tone(420, 300, .6, 'sawtooth', .025)],
  birdsong:[2, 5, () => { for (let i = 0; i < 3; i++) setTimeout(() => tone(2400 + i * 300, 3000, .08, 'sine', .02), i * 110); }],
  murmur:[6, 11, () => { tone(160, 120, .5, 'sawtooth', .02); setTimeout(() => tone(180, 140, .4, 'sawtooth', .02), 420); }], // "hear, hear!"
  cafe:[3, 7, () => tone(2600, 2500, .12, 'triangle', .02)],
  cicadas:[0, 0, null],
};
let ambience = [], ambNodes = [], ambT = {};
function setAmbience(list) { ambience = [...list]; stopBeds(); ambT = {}; }
function stopBeds() { for (const n of ambNodes) try { n.stop?.(); n.disconnect(); } catch {} ambNodes = []; }
function startBeds() {
  for (const k of ambience) {
    if (k === 'cicadas') { // buzzing: a high tone, amplitude-modulated
      const o = ac.createOscillator(), lfo = ac.createOscillator(), lg = ac.createGain(), g = ac.createGain();
      o.type = 'square'; o.frequency.value = 4400; lfo.frequency.value = 32; lg.gain.value = .006; g.gain.value = .006;
      lfo.connect(lg).connect(g.gain); o.connect(g).connect(master); o.start(); lfo.start(); ambNodes.push(o, lfo, g); continue;
    }
    const b = BEDS[k]; if (!b) continue;
    const s = ac.createBufferSource(); s.buffer = noiseBuf; s.loop = true;
    const f = ac.createBiquadFilter(); f.type = b[0]; f.frequency.value = b[1]; f.Q.value = b[2];
    const g = ac.createGain(); g.gain.value = b[3];
    if (b[4]) { const lfo = ac.createOscillator(), lg = ac.createGain(); lfo.frequency.value = b[4]; lg.gain.value = b[3] * .6; lfo.connect(lg).connect(g.gain); lfo.start(); ambNodes.push(lfo); }
    s.connect(f).connect(g).connect(master); s.start(); ambNodes.push(s, g);
  }
}
function ambienceTick(dt) {
  if (silent() || !ambience.length) { if (ambNodes.length) stopBeds(); return; }
  if (!ambNodes.length) startBeds();
  for (const k of ambience) { const sh = SHOTS[k]; if (!sh?.[2]) continue; ambT[k] = (ambT[k] ?? sh[0] * Math.random()) - dt; if (ambT[k] <= 0) { ambT[k] = sh[0] + Math.random() * (sh[1] - sh[0]); sh[2](); } }
}
const currentAmbience = () => ambience;

export { setAmbience, ambienceTick, currentAmbience, setMuted, setVoicesOn, ac, master, noiseBuf, muted, voicesOn, audioInit, silent, noise, tone, sfx, voice, pickVoice, say };
