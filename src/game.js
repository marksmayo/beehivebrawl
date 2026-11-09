import { AI } from './ai.js';
import { STAGES, arenaArt, buildStage, stage } from './arenas.js';
import { isTouch } from './touchui.js';
import { INTROS } from './anim.js';
import { ReplayBuffer } from './camerafx.js';
import { impactFrame, koStamp } from './comicfx.js';
import { fillNewspaper, fillOrderPaper, hideNameCards, renderCover, renderGallery, resetPolls, saveWin, setPortraits, showVS } from './screens.js';
import { audioInit, muted, say, setMuted, setVoicesOn, sfx, voicesOn } from './audio.js';
import { banner, bubble, clearFloaters, floater, hideBanner, screenFlash } from './dom.js';
import { clearFx } from './effects.js';
import { Fighter } from './fighter.js';
import { camPos } from './loop.js';
import { portraits } from './portraits.js';
import { scene } from './renderer.js';
import { KO_SUBS, ROSTER } from './roster.js';
import { $, hex, pick, rand } from './util.js';

// Game flow

const game = {
  phase:'title', mode:'cpu', diff:1, p:[null, null], ai:null, aiA:null, aiB:null,
  sel:[0, 1], conf:[false, false], stageIdx:(Math.random() * 8) | 0, round:1, timer:60, phaseT:0, freezeT:0, timeScale:1, shakeT:0, demo:true,
  replay:new ReplayBuffer(2.2, 30), final:false, slowT:0, camRoll:0,
  wind:0, windT:5, windDir:0, cine:null, introStep:0, victoryShown:false, roundWinner:null, paused:false,
  hitstop(t) { this.freezeT = Math.max(this.freezeT, t); },
  // directional shake (along the hit) and a quick camera punch-in on impact (37, 92)
  shakeMag:0, shakeAge:9, shakeDir:0, zoom:0,
  shake(t, dir = 0) { if (t >= this.shakeMag * Math.exp(-this.shakeAge * 9)) { this.shakeMag = t; this.shakeAge = 0; this.shakeDir = dir || (Math.random() < .5 ? -1 : 1); } this.shakeT = Math.max(this.shakeT, t); },
  punchIn(z) { this.zoom = Math.max(this.zoom, z); },
  superFlash(f, mv) {
    this.cine = { f, t:.85, T:.85 }; impactFrame('super');
    const sp = $('#superPanel');
    sp.style.setProperty('--sc', hex(f.def.pcol === 0x222222 ? 0xffd23f : f.def.pcol));
    sp.querySelector('img').src = portraits[f.def.id];
    sp.querySelector('.sn').textContent = mv.name;
    sp.classList.toggle('right', f.side === 1);
    sp.classList.add('on'); $('#speedlines').classList.add('on');
    bubble(f, mv.call, { dur:1.8, shout:true });
    sfx.super(); say(mv.call, { pitch:f.def.pitch });
  },
  ko(loser, winner, dir) {
    this.phase = 'ko'; this.phaseT = 0; this.timeScale = .3; this.victoryShown = false; this.roundWinner = winner;
    loser.cleanupSpecial(); loser.state = 'ko'; loser.stateT = 0; loser.vy = 7; loser.vx = dir * 6; loser.atk = null; loser.sp = null;
    winner.wins++;
    this.final = winner.wins >= 2; this.slowT = 0; // the deciding KO gets slow-mo and a replay (93, 94)
    banner('K.O.!', '', 1600); koStamp(pick(KO_SUBS)); impactFrame('ko'); // (41, 52)
    sfx.ko(); screenFlash(); this.shake(.5);
    say('K.O.!', { pitch:.6, rate:.9 });
    bubble(loser, loser.def.hurt, { dur:2 });
  },
};

function setFighters(defA, defB) {
  game.p.forEach(f => f && f.dispose());
  const a = new Fighter(defA, 0), b = new Fighter(defB, 1);
  a.opp = b; b.opp = a; scene.add(a.root); scene.add(b.root);
  game.p = [a, b];
}

function showScreen(id) {
  for (const s of ['title', 'select', 'pause', 'result', 'gallery']) $('#' + s).classList.toggle('hidden', s !== id);
  const hud = id === null || id === 'pause';
  $('#hud').classList.toggle('on', hud); $('#meters').classList.toggle('on', hud);
  $('#soundHint').classList.toggle('on', hud);
}

function toTitle() {
  game.phase = 'title'; game.demo = true; game.paused = false; game.cine = null; game.timeScale = 1;
  clearFx(); clearFloaters(); hideBanner();
  buildStage(pick(STAGES));
  const i = (Math.random() * ROSTER.length) | 0; let j = (Math.random() * ROSTER.length) | 0; if (j === i) j = (j + 1) % ROSTER.length;
  setFighters(ROSTER[i], ROSTER[j]);
  game.aiA = new AI(game.p[0], 1); game.aiB = new AI(game.p[1], 1);
  setPortraits(portraits); renderCover(ROSTER, portraits); hideNameCards();
  showScreen('title');
}

function toSelect(mode) {
  if (mode) game.mode = mode;
  game.phase = 'select'; game.demo = false; game.conf = [false, false]; game.cine = null; game.timeScale = 1;
  clearFx(); clearFloaters(); hideBanner();
  if (game.sel[0] === game.sel[1]) game.sel[1] = (game.sel[0] + 1) % ROSTER.length;
  buildStage(STAGES[game.stageIdx]);
  setFighters(ROSTER[game.sel[0]], ROSTER[game.sel[1]]);
  game.p[0].x = -2.2; game.p[1].x = 2.2;
  renderGrid(); showScreen('select'); updateVenue();
  $('#selHint').innerHTML = isTouch() ? 'Tap a candidate to pick · ◀ ▶ to change venue'
    : game.mode === 'cpu'
    ? 'Move <kbd>←</kbd><kbd>→</kbd><kbd>↑</kbd><kbd>↓</kbd> · Confirm <kbd>Enter</kbd>/<kbd>J</kbd> · Change venue <kbd>Tab</kbd> · Back <kbd>Esc</kbd> · or just click'
    : 'P1: <kbd>WASD</kbd> + <kbd>F</kbd> · P2: arrows + <kbd>Enter</kbd>/<kbd>Num1</kbd> · Venue <kbd>Tab</kbd> · Back <kbd>Esc</kbd>';
}

function renderGrid() {
  const grid = $('#grid'); grid.innerHTML = '';
  ROSTER.forEach((d, i) => {
    const c = document.createElement('div'); c.className = 'card';
    c.style.setProperty('--c', hex(d.pcol));
    c.innerHTML = `<img src="${portraits[d.id]}" alt=""><div class="stripe"></div><div class="cn">${d.short}</div><div class="cp">${d.party}</div><span class="mk m1">P1</span><span class="mk m2">${game.mode === 'cpu' ? 'CPU' : 'P2'}</span>`;
    c.onclick = () => { const p = game.conf[0] ? 1 : 0; if (p === 1 && game.mode === 'cpu') return; game.sel[p] = i; updateGrid(); selConfirm(p); };
    grid.appendChild(c);
  });
  updateGrid();
}
function infoHTML(d, side) {
  const st = (k, v) => `<span class="stat">${k}<i style="width:${Math.round(v * 34)}px"></i></span>`;
  return `<div class="ik" style="color:${hex(d.pcol === 0x222222 ? 0x111111 : d.pcol)}">${d.party} · “${d.nick}”</div>
    <div class="in">${d.name}</div>
    <div class="ib">${d.bio}</div>
    <div class="quote">${d.quips[0]}</div>
    <div class="mv"><b>A:</b> ${d.moves.a.name} &nbsp; <b>B:</b> ${d.moves.b.name}<br><b>SUPER:</b> ${d.moves.s.name}</div>
    <div>${st('SPD', d.stats.speed)}${st('PWR', d.stats.power)}${st('DEF', d.stats.defense)}</div>`;
}
function updateGrid() {
  [...$('#grid').children].forEach((c, i) => {
    const show2 = game.mode !== 'cpu' || game.conf[0];
    c.classList.toggle('s1', game.sel[0] === i); c.classList.toggle('s2', show2 && game.sel[1] === i);
    c.classList.toggle('c1', game.conf[0] && game.sel[0] === i); c.classList.toggle('c2', game.conf[1] && game.sel[1] === i);
  });
  $('#info0').innerHTML = infoHTML(ROSTER[game.sel[0]]); $('#info0').classList.toggle('conf', game.conf[0]);
  const show2 = game.mode !== 'cpu' || game.conf[0];
  $('#info1').innerHTML = show2 ? infoHTML(ROSTER[game.sel[1]]) : '<div class="in">CPU</div><div class="ib">Waiting to see who you pick, then choosing the most annoying opponent available.</div>';
  $('#info1').classList.toggle('conf', game.conf[1]);
  for (let i = 0; i < 2; i++) {
    const want = ROSTER[game.sel[i]];
    if (game.p[i] && game.p[i].def !== want) {
      const old = game.p[i]; old.dispose();
      const f = new Fighter(want, i); f.x = i ? 2.2 : -2.2; scene.add(f.root); game.p[i] = f;
      f.opp = game.p[1 - i]; game.p[1 - i].opp = f;
      f.squash = .3;
    }
  }
}
function updateVenue() { const s = STAGES[game.stageIdx]; $('#vName').textContent = s.name; $('#vDesc').textContent = s.desc; }
function cycleVenue(d) {
  game.stageIdx = (game.stageIdx + d + STAGES.length) % STAGES.length; updateVenue(); sfx.select();
  buildStage(STAGES[game.stageIdx]);
}
$('#vPrev').onclick = () => cycleVenue(-1); $('#vNext').onclick = () => cycleVenue(1);
function selNav(p, dx, dy) {
  if (game.phase !== 'select' || game.conf[p]) return;
  if (p === 1 && game.mode === 'cpu') return;
  const n = ROSTER.length; let i = game.sel[p];
  if (dx) i = (i + dx + n) % n;
  if (dy) i = (i + dy * 4 + n) % n;
  game.sel[p] = i; sfx.select(); updateGrid();
}
function selConfirm(p) {
  if (game.phase !== 'select' || game.conf[p]) return;
  game.conf[p] = true; sfx.confirm();
  const d = ROSTER[game.sel[p]], f = game.p[p];
  f.state = 'victory'; f.stateT = 0;
  bubble(f, pick(d.intro), { dur:1.8 }); say(d.name, { pitch:.75 });
  if (game.mode === 'cpu' && p === 0) {
    let j; do j = (Math.random() * ROSTER.length) | 0; while (j === game.sel[0]);
    game.sel[1] = j; game.conf[1] = true; updateGrid();
    const g = game.p[1]; g.state = 'victory'; bubble(g, pick(ROSTER[j].intro), { dur:1.8 });
  }
  updateGrid();
  // both picked: the VS splash with the tale of the tape (81), then fight
  if (game.conf[0] && game.conf[1]) setTimeout(() => {
    if (game.phase !== 'select' || !game.conf[0] || !game.conf[1]) return;
    game.phase = 'vs'; showVS(ROSTER[game.sel[0]], ROSTER[game.sel[1]]).then(startMatch);
  }, 900);
}
function selBack() {
  if (game.conf[1] && game.mode !== 'cpu') { game.conf[1] = false; game.p[1].state = 'idle'; }
  else if (game.conf[0]) { game.conf = [false, false]; game.p.forEach(f => (f.state = 'idle')); }
  else { toTitle(); return; }
  updateGrid();
}

function startMatch() {
  game.demo = false; clearFloaters();
  buildStage(STAGES[game.stageIdx]);
  setFighters(ROSTER[game.sel[0]], ROSTER[game.sel[1]]);
  if (game.mode === 'cpu') game.ai = new AI(game.p[1], game.diff);
  game.round = 1;
  for (let i = 0; i < 2; i++) {
    const d = game.p[i].def, el = $('#hp' + i);
    el.querySelector('.pname').textContent = d.short;
    el.querySelector('.pparty').textContent = d.party;
    el.querySelector('.pparty').style.background = hex(d.pcol);
    el.querySelector('.pimg').src = portraits[d.id];
    el.querySelector('.tag').textContent = i === 1 && game.mode === 'cpu' ? 'CPU' : 'P' + (i + 1);
  }
  $('#venue').textContent = stage.name;
  startRound();
}
function startRound() {
  const [a, b] = game.p;
  clearFx(); clearFloaters();
  a.resetRound(-3); b.resetRound(3); resetPolls(); game.replay.clear(); game.final = false;
  for (const f of [a, b]) enterStage(f); // per-character round intros (33)
  game.phase = 'intro'; game.phaseT = 0; game.introStep = 0; game.timer = 60; game.timeScale = 1; game.wind = 0; game.windT = rand(4, 8);
  showScreen(null);
}
function enterStage(f) {
  const it = INTROS[f.def.id], side = f.x < 0 ? -1 : 1;
  Object.assign(f, { state:'intro', stateT:0, introX:f.x });
  if (it?.entry === 'drop') { f.y = 7; f.vy = 0; }
  else f.x += side * (it?.entry === 'slide' ? 5 : 3.5);
}
function timeUp() {
  const [a, b] = game.p;
  game.phase = 'ko'; game.phaseT = 0; game.victoryShown = false;
  let w = null; if (Math.abs(a.hp - b.hp) > .01) w = a.hp > b.hp ? a : b;
  game.roundWinner = w;
  if (w) { w.wins++; banner('TIME!', `${w.def.short} wins on the count`, 2400); const l = w === a ? b : a; l.state = 'lose'; l.stateT = 0; }
  else { a.wins++; b.wins++; banner('TIME!', 'HUNG PARLIAMENT', 2400); }
  sfx.bell(); say('Time!', { pitch:.6 });
}
function nextRoundOrResult() {
  const [a, b] = game.p;
  if (a.wins >= 2 || b.wins >= 2) showResult();
  else { game.round++; startRound(); }
}
function showResult() {
  const [a, b] = game.p;
  game.phase = 'result';
  const w = a.wins === b.wins ? null : a.wins > b.wins ? a : b, l = w === a ? b : a;
  const rImg = $('#rImg');
  if (w) {
    fillNewspaper(w, l, { roundsWon:w.wins, roundsLost:l.wins, hpLeft:w.hp });
    $('#rQuote').textContent = `“${w.def.win}” — ${w.def.ending}`;
    rImg.src = portraits[w.def.id]; rImg.style.display = ''; rImg.style.setProperty('--c', hex(w.def.pcol));
    w.state = 'victory'; l.state = l.state === 'ko' ? 'ko' : 'lose';
    if (game.mode === '2p' || w === a) saveWin({ fighter:w.def.id, arena:stage.id }); // unlocks gallery art
  } else {
    $('#result .masthead').textContent = 'THE DAILY BEEHIVE';
    $('#rHead').textContent = 'HUNG PARLIAMENT';
    $('#rSub').textContent = 'Nobody governs. Coalition talks expected to take six weeks.';
    $('#rQuote').textContent = '';
    rImg.style.display = 'none';
  }
  showScreen('result'); $('#hud').classList.remove('on'); $('#meters').classList.remove('on');
}
function openGallery() {
  renderGallery(ROSTER, STAGES, key => { const [k, id] = key.split(':'); return k === 'fighter' ? portraits[id] : arenaArt[id]; });
  game.phase = 'gallery'; showScreen('gallery');
}
function rematch() { if (game.phase === 'result') startMatch(); }
function togglePause() {
  if (game.phase === 'paused') { game.phase = game.prevPhase; showScreen(null); }
  else if (['fight', 'intro', 'ko'].includes(game.phase)) {
    fillOrderPaper({ round:game.round, timer:game.timer, a:game.p[0].def, b:game.p[1].def, venue:stage.name });
    game.prevPhase = game.phase; game.phase = 'paused'; showScreen('pause'); window.speechSynthesis?.cancel(); }
}

function menuKey(code) {
  if (code === 'KeyM') { setMuted(!muted); if (muted) window.speechSynthesis?.cancel(); floater(muted ? 'SOUND OFF' : 'SOUND ON', camPos.x, 4.5, { size:22 }); return; }
  if (code === 'KeyV') { setVoicesOn(!voicesOn); if (!voicesOn) window.speechSynthesis?.cancel(); floater(voicesOn ? 'VOICES ON' : 'VOICES OFF', camPos.x, 4.5, { size:22 }); return; }
  switch (game.phase) {
    case 'gallery':
      if (code === 'Escape' || code === 'Backspace' || code === 'Enter') { game.phase = 'title'; showScreen('title'); }
      break;
    case 'title':
      if (code === 'Enter' || code === 'Space') toSelect('cpu');
      if (code === 'Digit2') toSelect('2p');
      break;
    case 'select': {
      const cpu = game.mode === 'cpu';
      const nav = { KeyA:[0, -1, 0], KeyD:[0, 1, 0], KeyW:[0, 0, -1], KeyS:[0, 0, 1], ArrowLeft:[cpu ? 0 : 1, -1, 0], ArrowRight:[cpu ? 0 : 1, 1, 0], ArrowUp:[cpu ? 0 : 1, 0, -1], ArrowDown:[cpu ? 0 : 1, 0, 1] };
      if (nav[code]) selNav(...nav[code]);
      if (['KeyF', 'KeyJ', 'Space'].includes(code) || (cpu && code === 'Enter')) selConfirm(0);
      if (!cpu && ['Enter', 'Numpad1', 'Comma', 'NumpadEnter'].includes(code)) selConfirm(1);
      if (code === 'Tab') cycleVenue(1);
      if (code === 'Escape' || code === 'Backspace') selBack();
      break; }
    case 'fight': case 'intro': case 'ko': case 'paused':
      if (code === 'Escape' || code === 'KeyP') togglePause();
      break;
    case 'result':
      if (code === 'Enter') rematch();
      if (code === 'Escape') toSelect();
      break;
  }
}
document.querySelectorAll('[data-mode]').forEach(b => (b.onclick = () => { audioInit(); toSelect(b.dataset.mode); }));
document.querySelectorAll('[data-d]').forEach(b => (b.onclick = () => {
  game.diff = +b.dataset.d; document.querySelectorAll('[data-d]').forEach(x => x.classList.toggle('on', x === b));
}));
$('#bResume').onclick = togglePause;
$('#bQuit').onclick = () => { window.speechSynthesis?.cancel(); toTitle(); };
$('#bRematch').onclick = rematch;
$('#bChars').onclick = () => toSelect();
$('#bMenu').onclick = toTitle;
$('#bGallery').onclick = openGallery;
$('#bGalBack').onclick = () => { game.phase = 'title'; showScreen('title'); };

// =====================================================================

export { game, setFighters, showScreen, toTitle, toSelect, renderGrid, infoHTML, updateGrid, updateVenue, cycleVenue, selNav, selConfirm, selBack, startMatch, startRound, timeUp, nextRoundOrResult, showResult, rematch, togglePause, menuKey };
