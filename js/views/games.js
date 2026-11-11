/* Arabesco — Jogos: Memória (كلمة ↔ significado) + Construtor de frases RTL */

import { getDictionary } from '../data.js';
import { getState, save, logToday } from '../store.js';
import { speakArabic } from '../tts.js';
import { addXP, touchStreak, bumpMission } from '../gamify.js';
import { esc, levelChipsHTML, shuffle, toast, $, $$ } from '../ui.js';

/* ════════════════ MEMORY ════════════════ */
const mem = { size: 6, level: 'all', cards: [], first: null, lock: false, moves: 0, matched: 0, t0: 0, timer: null };

function shortMeaning(m) {
  const c = (m || '').split('—')[0].split('؛')[0].trim();
  return c.length > 30 ? c.slice(0, 27) + '…' : c;
}

function pickPairs(dict, n) {
  const pool = dict.filter(e => (mem.level === 'all' || e.level === mem.level));
  const uniq = [];
  const seen = new Set();
  for (const e of shuffle(pool)) {
    const k = shortMeaning(e.meaning);
    if (seen.has(k)) continue;
    seen.add(k);
    uniq.push(e);
    if (uniq.length >= n) break;
  }
  return uniq.slice(0, n);
}

function startMemory(section, dict) {
  clearInterval(mem.timer);
  mem.first = null; mem.lock = false; mem.moves = 0; mem.matched = 0;
  const pairs = pickPairs(dict, mem.size);
  mem.cards = shuffle(pairs.flatMap(p => [
    { key: 'ar' + p.id, pair: p.id, face: p.word, cls: 'ar' },
    { key: 'pt' + p.id, pair: p.id, face: shortMeaning(p.meaning), cls: 'pt' },
  ]));
  mem.t0 = Date.now();
  mem.timer = setInterval(() => {
    const el = $('#mem-timer', section);
    if (el) el.textContent = Math.round((Date.now() - mem.t0) / 1000) + 's';
  }, 500);
  drawMemory(section);
}

function drawMemory(section) {
  const n = mem.cards.length;
  const cols = n <= 12 ? 3 : n <= 20 ? 4 : 5;
  const zone = $('#mem-zone', section);
  zone.innerHTML = `
    <div class="row spread wrap mb-2">
      <div class="row" style="gap:10px">
        <span class="badge gold" id="mem-timer">0s</span>
        <span class="badge pos">${mem.moves} jogadas</span>
        <span class="badge lvl">${mem.matched}/${mem.cards.length / 2} pares</span>
      </div>
      <button class="btn sm" id="mem-restart"><i class="fa-solid fa-rotate"></i> Reiniciar</button>
    </div>
    <div class="mem-grid" style="grid-template-columns:repeat(${cols},1fr);max-width:${cols * 130}px">
      ${mem.cards.map((c, i) => `
        <div class="mem-card" data-i="${i}">
          <div class="face back"><i class="fa-solid fa-star-and-crescent"></i></div>
          <div class="face front ${c.cls === 'ar' ? 'ar-text' : ''}" lang="${c.cls === 'ar' ? 'ar' : 'pt'}">${esc(c.face)}</div>
        </div>`).join('')}
    </div>`;
  $('#mem-restart', zone).addEventListener('click', () => startMemory(section, dict));
  $$('.mem-card', zone).forEach(cardEl => cardEl.addEventListener('click', () => flipCard(+cardEl.dataset.i, cardEl, section)));
}

function flipCard(i, cardEl, section) {
  if (mem.lock || cardEl.classList.contains('flipped') || cardEl.classList.contains('done')) return;
  cardEl.classList.add('flipped');
  const c = mem.cards[i];
  if (c.cls === 'ar') speakArabic(c.face, getState().ttsRate);
  if (!mem.first) { mem.first = { i, cardEl, c }; return; }
  mem.moves++;
  const a = mem.first;
  mem.first = null;
  if (a.c.pair === c.pair && a.i !== i) {
    a.cardEl.classList.add('done');
    cardEl.classList.add('done');
    mem.matched++;
    drawMemory(section);
    if (mem.matched === mem.cards.length / 2) return winMemory(section);
  } else {
    mem.lock = true;
    setTimeout(() => {
      a.cardEl.classList.add('shake'); cardEl.classList.add('shake');
      setTimeout(() => {
        a.cardEl.classList.remove('flipped', 'shake');
        cardEl.classList.remove('flipped', 'shake');
        mem.lock = false;
      }, 420);
    }, 550);
  }
  $$('.mem-card', section)[0]?.closest('.mem-grid').parentElement.querySelector('.badge.pos')?.replaceChildren(document.createTextNode(`${mem.moves} jogadas`));
}

function winMemory(section) {
  clearInterval(mem.timer);
  const secs = Math.round((Date.now() - mem.t0) / 1000);
  const st = getState();
  st.stats.gamesWon = (st.stats.gamesWon || 0) + 1;
  const best = st.bestScores.memory;
  if (!best || secs < best) st.bestScores.memory = secs;
  save();
  addXP(15);
  logToday('cards', mem.cards.length / 2);
  touchStreak();
  checkAchievements(null);
  toast(`Memória vencida em ${secs}s! +15 XP`, { icon: 'fa-puzzle-piece', type: 'success' });
  const zone = $('#mem-zone', section);
  zone.insertAdjacentHTML('afterbegin', `
    <div class="card center mb-2" style="border-color:var(--gold)">
      <b style="font-size:19px">🎉 مبروك! Vitória em ${secs}s</b>
      <p class="small muted mt-1">${mem.moves} jogadas ${best === secs ? '• novo recorde pessoal!' : `• recorde: ${st.bestScores.memory}s`}</p>
    </div>`);
}

/* ════════════════ SENTENCE BUILDER ════════════════ */
const sb = { target: null, placed: [], bank: [], solved: 0 };

function pickSentence(dict) {
  const pool = dict.filter(e => {
    const words = (e.example || '').split(/\s+/).filter(w => w.length > 0);
    return words.length >= 4 && words.length <= 7;
  });
  return pool[Math.floor(Math.random() * pool.length)];
}

function startBuilder(section, dict) {
  const e = pickSentence(dict);
  if (!e) { toast('Sem exemplos adequados', { icon: 'fa-triangle-exclamation' }); return; }
  sb.target = e;
  sb.bank = shuffle(e.example.replace(/[.،؟!]/g, '').split(/\s+/).filter(Boolean));
  sb.placed = [];
  drawBuilder(section);
}

function drawBuilder(section) {
  const zone = $('#sb-zone', section);
  zone.innerHTML = `
    <div class="row spread wrap mb-2">
      <div><b>Monte a frase</b> <span class="small muted">· toque nas palavras na ordem correta (da direita p/ esquerda)</span></div>
      <span class="badge gold">${sb.solved} resolvidas</span>
    </div>
    <div class="card">
      <div class="row center small muted" style="justify-content:space-between;flex-wrap:wrap">
        <span class="translit">${esc(sb.target.translit)}</span>
        <span class="badge lvl" data-lvl="${sb.target.level}">${sb.target.level}</span>
      </div>
      <p class="center mt-1" style="font-size:14.5px;color:var(--muted)">"${esc(sb.target.exampleTr)}"</p>
      <div class="sb-slots mt-2" id="sb-slots">
        ${sb.placed.length ? sb.placed.map((w, i) => `<button class="sb-word placed" data-slot="${i}">${esc(w)}</button>`).join('')
          : '<span class="small muted" style="align-self:center">toque nas palavras para montar…</span>'}
      </div>
      <div class="sb-bank mt-2" id="sb-bank">
        ${sb.bank.map((w, i) => `<button class="sb-word ${sb.placed.includes(w) ? 'ar-dim' : ''}" data-bank="${i}">${esc(w)}</button>`).join('')}
      </div>
      <div class="row mt-3 center" style="justify-content:center;gap:10px">
        <button class="btn sm" id="sb-undo"><i class="fa-solid fa-rotate-left"></i> Desfazer</button>
        <button class="btn sm primary" id="sb-check"><i class="fa-solid fa-check"></i> Verificar</button>
        <button class="btn sm" id="sb-say"><i class="fa-solid fa-volume-high"></i> Ouvir original</button>
      </div>
      <div id="sb-feedback" class="center mt-2"></div>
    </div>`;

  $$('#sb-bank .sb-word', zone).forEach(b => b.addEventListener('click', () => {
    const w = b.textContent;
    if (sb.placed.includes(w)) return;
    sb.placed.push(w);
    drawBuilder(section);
  }));
  $$('#sb-slots .sb-word', zone).forEach(b => b.addEventListener('click', () => {
    sb.placed.splice(+b.dataset.slot, 1);
    drawBuilder(section);
  }));
  $('#sb-undo', zone).addEventListener('click', () => { sb.placed.pop(); drawBuilder(section); });
  $('#sb-say', zone).addEventListener('click', () => speakArabic(sb.target.example, getState().ttsRate));
  $('#sb-check', zone).addEventListener('click', () => checkBuilder(section));
}

function checkBuilder(section) {
  const correct = sb.target.example.replace(/[.،؟!]/g, '').split(/\s+/).filter(Boolean);
  const ok = sb.placed.length === correct.length && sb.placed.every((w, i) => w === correct[i]);
  const fb = $('#sb-feedback', section);
  if (ok) {
    sb.solved++;
    addXP(10);
    logToday('cards', 1);
    touchStreak();
    checkAchievements(null);
    speakArabic(sb.target.example, getState().ttsRate);
    fb.innerHTML = `<div class="card" style="border-color:var(--success);margin-top:10px"><b style="color:var(--success)">✓ ممتاز! Frase perfeita +10 XP</b></div>`;
    setTimeout(() => startBuilder(section, window._dictRef || sb.dict), 1400);
  } else {
    fb.innerHTML = `<div class="card" style="border-color:var(--danger);margin-top:10px"><b style="color:var(--danger)">Ainda não… a ordem no árabe começa da direita. Tente de novo!</b></div>`;
  }
}

/* ════════════════ VIEW ════════════════ */
export async function renderGames(section) {
  const dict = await getDictionary();
  window._dictRef = dict;
  sb.dict = dict;

  section.innerHTML = `
    <div class="arch">
      <div class="eyebrow">SALA DE JOGOS</div>
      <h2>Jogos Árabes</h2>
      <div class="ar-display">أَلْعَاب</div>
      <p class="mt-2" style="opacity:.85;font-size:14px">Treine sem parecer estudo: memória de pares e construção de frases na ordem árabe.</p>
    </div>

    <div class="section-title"><i class="fa-solid fa-puzzle-piece"></i> Memória — palavra ↔ significado</div>
    <div class="card" id="mem-zone"></div>
    <div class="chip-row mt-2" id="mem-levels">${levelChipsHTML(mem.level)}</div>
    <div class="chip-row mt-2" id="mem-sizes">
      ${[6, 10, 15].map(n => `<button class="chip ${mem.size === n ? 'active' : ''}" data-size="${n}">${n} pares</button>`).join('')}
    </div>

    <div class="section-title"><i class="fa-solid fa-pen-fancy"></i> Construtor de frases <span class="count">arraste na ordem RTL</span></div>
    <div id="sb-zone"></div>
    <div class="center mt-2"><button class="btn" id="sb-new"><i class="fa-solid fa-dice"></i> Outra frase</button></div>
  `;

  $$('#mem-levels .chip', section).forEach(c => c.addEventListener('click', () => {
    mem.level = c.dataset.level;
    $$('#mem-levels .chip', section).forEach(x => x.classList.toggle('active', x === c));
    startMemory(section, dict);
  }));
  $$('#mem-sizes .chip', section).forEach(c => c.addEventListener('click', () => {
    mem.size = +c.dataset.size;
    $$('#mem-sizes .chip', section).forEach(x => x.classList.toggle('active', x === c));
    startMemory(section, dict);
  }));
  $('#sb-new', section).addEventListener('click', () => startBuilder(section, dict));

  startMemory(section, dict);
  startBuilder(section, dict);
}
