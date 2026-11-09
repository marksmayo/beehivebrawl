// Comic presentation screens (DOM): cover-style title cast, VS splash with the tale of the
// tape, round name cards, poll/ballot HUD, order-paper pause, newspaper results, gallery.
import { ballotLabel, galleryItems, headline, isUnlocked, matchupEdges, orderPaper, parseUnlocks, pollPct, recordWin, taleOfTheTape, tickPoll } from './ui.js';
import { $, hex } from './util.js';

const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' })[c]);
const colour = d => hex(d.pcol === 0x222222 ? 0x444444 : d.pcol);

// ---- title: the cast on the comic cover (86)
function renderCover(roster, portraits) {
  $('#title .cast').innerHTML = roster.map((d, i) => `<img src="${portraits[d.id]}" alt="${esc(d.short)}" style="--i:${i};--c:${colour(d)}">`).join('');
}

// ---- VS splash with the tale of the tape (81); resolves after a beat or on any key/tap
function showVS(a, b, ms = 2800) {
  const edges = matchupEdges(a, b), side = (d, cls) => `
    <div class="vsSide ${cls}" style="--c:${colour(d)}">
      <img src="${portraitsRef[d.id]}" alt="">
      <div class="vsName">${esc(d.name)}</div>
      <div class="vsNick">“${esc(d.nick)}”</div>
      <table>${taleOfTheTape(d).map(r => `<tr><th>${r.label}</th><td>${'bar' in r
        ? `<span class="bar${edges[r.label] === d.id ? ' edge' : ''}"><i style="width:${Math.round(r.bar * 100)}%"></i></span>` : esc(r.value)}</td></tr>`).join('')}</table>
    </div>`;
  const el = $('#vs');
  el.innerHTML = `${side(a, 'l')}<div class="vsBurst">VS</div>${side(b, 'r')}`;
  el.classList.remove('on'); void el.offsetWidth; el.classList.add('on');
  return new Promise(res => {
    let done = false;
    const end = () => { if (done) return; done = true; el.classList.remove('on'); removeEventListener('keydown', end); el.removeEventListener('pointerdown', end); res(); };
    setTimeout(() => { addEventListener('keydown', end); el.addEventListener('pointerdown', end); }, 600);
    setTimeout(end, ms);
  });
}
let portraitsRef = {};
const setPortraits = p => { portraitsRef = p; };

// ---- round name cards (82)
function showNameCards(a, b) {
  $('#namecards').innerHTML = [a, b].map((d, i) => `<div class="ncard ${i ? 'r' : 'l'}" style="--c:${colour(d)}"><b>${esc(d.short)}</b><span>${esc(d.nick)} · ${esc(d.party)}</span></div>`).join('');
  requestAnimationFrame(() => document.querySelectorAll('#namecards .ncard').forEach(c => c.classList.add('on')));
}
const hideNameCards = () => document.querySelectorAll('#namecards .ncard').forEach(c => c.classList.remove('on'));

// ---- HUD: polling bars that tick down, and the ballot count (83, 84)
const shownPoll = [100, 100];
function updatePolls(fighters, timer, dt) {
  fighters.forEach((f, i) => {
    shownPoll[i] = f.hp >= 100 ? 100 : tickPoll(shownPoll[i], Math.max(0, f.hp), dt);
    const el = $(`#hp${i} .poll`); const txt = pollPct(shownPoll[i]); if (el.textContent !== txt) el.textContent = txt;
  });
  const bl = $('#ballot .bl'), lab = ballotLabel(timer);
  if (bl.textContent !== lab) { bl.textContent = lab; $('#ballot').classList.toggle('final', timer < 10); }
}
const resetPolls = () => { shownPoll[0] = shownPoll[1] = 100; };

// ---- pause as an order paper (89)
function fillOrderPaper(info) { $('#pause .op').innerHTML = orderPaper(info).map(t => `<li>${esc(t)}</li>`).join(''); }

// ---- results as a newspaper front page (85)
function fillNewspaper(w, l, stats) {
  const h = headline(w.def, l.def, stats);
  $('#result .masthead').textContent = h.masthead;
  $('#rHead').textContent = h.headline;
  $('#rSub').textContent = h.sub;
  $('#rDate').textContent = new Date().toLocaleDateString('en-NZ', { weekday:'long', day:'numeric', month:'long', year:'numeric' });
}

// ---- gallery and unlocks (88), stored per browser
const KEY = 'bb-unlocks';
const loadUnlocks = () => { try { return parseUnlocks(localStorage.getItem(KEY)); } catch { return parseUnlocks(null); } };
function saveWin(win) { const s = recordWin(loadUnlocks(), win); try { localStorage.setItem(KEY, JSON.stringify(s)); } catch {} return s; }
function renderGallery(roster, stages, art) {
  const s = loadUnlocks();
  $('#galleryGrid').innerHTML = galleryItems(roster, stages).map(it => {
    const on = isUnlocked(s, it.key), src = art(it.key);
    return `<div class="gi${on ? ' unlocked' : ''}" data-key="${it.key}">${on && src ? `<img src="${src}" alt="">` : '<div class="lock">?</div>'}
      <div class="gt">${esc(on ? it.title : 'LOCKED')}</div><div class="gh">${esc(on ? '' : it.hint)}</div></div>`;
  }).join('');
}

export { renderCover, showVS, setPortraits, showNameCards, hideNameCards, updatePolls, resetPolls, fillOrderPaper, fillNewspaper, loadUnlocks, saveWin, renderGallery };
