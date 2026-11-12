/* Arabesco — Flashcards 3D + SRS */

import { getDictionary } from '../data.js';
import { getState, save, rateWord, toggleFav, logToday } from '../store.js';
import { speakArabic } from '../tts.js';
import { addXP, bumpMission, touchStreak, checkAchievements } from '../gamify.js';
import { esc, levelChipsHTML, LEVEL_INFO, toast, $, $$ } from '../ui.js';

const state = {
  level: 'all',
  mode: 'all',       // all | new | due | fav | hard
  deck: [],
  idx: 0,
  flipped: false,
};

const MODES = [
  { v: 'all', label: 'Todas', icon: 'fa-layer-group' },
  { v: 'new', label: 'Novas', icon: 'fa-seedling' },
  { v: 'due', label: 'Revisão de hoje', icon: 'fa-clock-rotate-left' },
  { v: 'fav', label: 'Favoritas', icon: 'fa-star' },
  { v: 'hard', label: 'Difíceis', icon: 'fa-triangle-exclamation' },
];

function buildDeck(dict) {
  const st = getState();
  const now = Date.now();
  state.deck = dict.filter(e => {
    if (state.level !== 'all' && e.level !== state.level) return false;
    const w = st.learned[e.id];
    switch (state.mode) {
      case 'new': return !w;
      case 'due': return w && w.s !== 'mastered' && w.due <= now;
      case 'fav': return !!st.favs[e.id];
      case 'hard': return w && w.lapses > 0;
      default: return true;
    }
  });
  state.idx = 0;
  state.flipped = false;
}

function current() {
  return state.deck[state.idx];
}

function shortMeaning(m) {
  const cut = m.split('—')[0].split('؛')[0].trim();
  return cut.length > 64 ? cut.slice(0, 61) + '…' : cut;
}

export async function renderCards(section) {
  const dict = await getDictionary();
  state.dict = dict;
  if (state.deck.length === 0 && state.mode === 'all' && state.level === 'all' && !state._init) {
    buildDeck(dict);
    state._init = true;
  }

  section.innerHTML = `
    <div class="row spread wrap mb-2">
      <div>
        <h2 style="font-size:22px;font-weight:800">Cartões Inteligentes <span class="ar-display" style="font-size:18px;color:var(--gold-strong)">بِطَاقَات</span></h2>
        <p class="small muted">Vire com <b>Espaço</b>, navegue com <b>← →</b> ou nas <b>setas</b> abaixo do cartão, avalie com <b>1 · 2 · 3</b> · deslize no celular</p>
      </div>
      <div class="chip-row" id="deck-modes">
        ${MODES.map(m => `<button class="chip ${state.mode === m.v ? 'active' : ''}" data-mode="${m.v}"><i class="fa-solid ${m.icon}"></i> ${m.label}</button>`).join('')}
      </div>
    </div>

    <div class="chip-row mb-2" id="deck-levels">${levelChipsHTML(state.level)}</div>

    <div class="row spread small muted mb-2">
      <span id="deck-count">—</span>
      <div class="row" style="gap:8px">
        <button class="btn sm" id="deck-shuffle" title="Embaralhar pilha"><i class="fa-solid fa-shuffle"></i></button>
        <input class="input" id="deck-jump" type="number" min="1" placeholder="Nº do cartão" style="width:110px;padding:7px 10px;font-size:12.5px">
        <button class="btn sm" id="deck-jump-btn"><i class="fa-solid fa-location-crosshairs"></i></button>
      </div>
    </div>
    <div class="progress mb-2"><div id="deck-progress" style="width:0%"></div></div>

    <div class="flash-stage" id="flash-stage"></div>
  `;

  $$('#deck-levels .chip', section).forEach(c => c.addEventListener('click', () => {
    state.level = c.dataset.level;
    buildDeck(dict);
    drawCard(section);
    $$('#deck-levels .chip', section).forEach(x => x.classList.toggle('active', x === c));
  }));
  $$('#deck-modes .chip', section).forEach(c => c.addEventListener('click', () => {
    state.mode = c.dataset.mode;
    buildDeck(dict);
    drawCard(section);
    $$('#deck-modes .chip', section).forEach(x => x.classList.toggle('active', x === c));
  }));
  $('#deck-jump-btn', section)?.addEventListener('click', () => {
    const n = parseInt($('#deck-jump', section).value, 10);
    if (n >= 1 && n <= state.deck.length) { state.idx = n - 1; state.flipped = false; drawCard(section); }
  });
  $('#deck-shuffle', section)?.addEventListener('click', () => {
    if (state.deck.length < 2) return;
    for (let i = state.deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [state.deck[i], state.deck[j]] = [state.deck[j], state.deck[i]];
    }
    state.idx = 0; state.flipped = false;
    drawCard(section);
    toast('Baralho embaralhado', { icon: 'fa-shuffle' });
  });

  document.addEventListener('keydown', cardsKeyHandler);
  drawCard(section);
}

function cardsKeyHandler(ev) {
  const sec = document.getElementById('view-cards');
  if (!sec || !sec.classList.contains('active')) return;
  const stage = $('#flash-stage', sec);
  if (!stage) return;
  if (ev.target.tagName === 'INPUT') return;
  if (ev.code === 'Space') { ev.preventDefault(); flip(sec); }
  else if (ev.key === 'ArrowRight') { nav(1, sec); }
  else if (ev.key === 'ArrowLeft') { nav(-1, sec); }
  else if (['1', '2', '3'].includes(ev.key)) { rate(+ev.key - 1, sec); }
}

function nav(dir, sec) {
  if (!state.deck.length) return;
  state.idx = Math.min(state.deck.length - 1, Math.max(0, state.idx + dir));
  state.flipped = false;
  drawCard(sec);
}

function flip(sec) {
  state.flipped = !state.flipped;
  $('#flash-card', sec)?.classList.toggle('flipped', state.flipped);
}

function rate(quality, sec) {
  const e = current();
  if (!e) return;
  const st = getState();
  const wasNew = !st.learned[e.id];
  const before = st.xp;
  rateWord(e.id, quality);
  if (wasNew && quality > 0) { addXP(5); logToday('words', 1); bumpMission('newWords'); }
  addXP(quality === 5 ? 3 : quality === 3 ? 2 : 0);
  logToday('cards', 1);
  st.stats.cardsRated = (st.stats.cardsRated || 0) + 1;
  save();
  bumpMission('cards');
  touchStreak();
  const counts = countsOf(state.dict || []);
  checkAchievements(counts);
  toast(quality === 0 ? 'Sem problema — o agendador vai trazer de volta amanhã' : 'Boa! +XP', { icon: quality === 0 ? 'fa-rotate' : 'fa-check', type: quality === 0 ? '' : 'success' });
  setTimeout(() => { nav(1, sec); }, 450);
}

function drawCard(sec) {
  const stage = $('#flash-stage', sec);
  const e = current();
  const st = getState();
  $('#deck-count', sec).textContent = `${state.deck.length} cartões na pilha`;
  $('#deck-progress', sec).style.width = `${state.deck.length ? ((state.idx + 1) / state.deck.length) * 100 : 0}%`;
  $('#deck-jump', sec).max = state.deck.length;

  if (!e) {
    stage.innerHTML = `
      <div class="card center mt-4" style="padding:40px">
        <div style="font-size:44px">🪴</div>
        <h3 class="mt-2">Nenhum cartão nesta pilha</h3>
        <p class="muted small mt-1">Troque o filtro de nível ou o modo acima.</p>
      </div>`;
    return;
  }

  const w = st.learned[e.id];
  const fav = !!st.favs[e.id];
  const showTr = st.showTranslit !== false;
  const wordSt = w
    ? (w.s === 'mastered'
        ? `<span class="badge" style="background:color-mix(in srgb,var(--success) 14%,transparent);color:var(--success)">✓ dominada · revisão em ${new Date(w.due).toLocaleDateString('pt-BR')}</span>`
        : `<span class="badge gold">aprendendo · ${w.revs} revisões · volta ${new Date(w.due).toLocaleDateString('pt-BR')}</span>`)
    : `<span class="badge lvl">nova palavra</span>`;

  stage.innerHTML = `
    <div class="flash-card ${state.flipped ? 'flipped' : ''}" id="flash-card">
      <div class="flash-face front">
        <div class="row spread" style="position:absolute;top:18px;left:20px;right:20px">
          <span class="badge lvl" data-lvl="${e.level}">${e.level}</span>
          <button class="star-btn ${fav ? 'on' : ''}" id="card-fav" title="Favoritar"><i class="fa-${fav ? 'solid' : 'regular'} fa-star"></i></button>
        </div>
        <div class="flash-word" lang="ar">${esc(e.word)}</div>
        ${showTr ? `<div class="translit mt-2" style="font-size:17px">${esc(e.translit)}</div>` : ''}
        <button class="sound-btn lg mt-2" id="card-speak"><i class="fa-solid fa-volume-high"></i></button>
        <div class="flash-hint"><span><kbd>Space</kbd> virar</span><span><kbd>1·2·3</kbd> avaliar</span></div>
      </div>
      <div class="flash-face back">
        <div style="position:absolute;top:18px;left:20px;right:20px;display:flex;gap:6px;align-items:center;flex-wrap:wrap;justify-content:center">
          ${wordSt}
          <span class="badge pos">${esc(e.pos)}</span>
        </div>
        <div style="margin-top:26px;text-align:center;max-width:100%">
          <div style="font-size:23px;font-weight:700">${esc(shortMeaning(e.meaning))}</div>
          <div class="small muted mt-1">${esc(e.meaning.length > 90 ? e.meaning.slice(0, 87) + '…' : e.meaning)}</div>
          <div class="example-box">
            <div class="ar-text">${esc(e.example)}</div>
            ${showTr ? `<span class="translit">${esc(e.exampleTranslit)}</span>` : ''}
            <div class="pt">${esc(e.exampleTr)}</div>
            <button class="sound-btn" id="card-speak-ex" title="Ouvir a frase de exemplo" style="margin-top:10px"><i class="fa-solid fa-comment-dots"></i></button>
          </div>
          <div class="row center mt-2 small muted" style="justify-content:center;gap:14px">
            <span><i class="fa-solid fa-sitemap"></i> base: <b class="ar-display" style="font-size:15px">${esc(e.base)}</b></span>
            <span><i class="fa-solid fa-shapes"></i> ${esc(e.form)}</span>
          </div>
        </div>
        <div class="rate-btns" style="width:100%">
          <button class="rate-btn forgot" data-rate="0"><span>1 · Esqueci</span><small>revê amanhã</small></button>
          <button class="rate-btn good" data-rate="3"><span>2 · Bom</span><small>espaçar</small></button>
          <button class="rate-btn easy" data-rate="5"><span>3 · Fácil</span><small>espaçar mais</small></button>
        </div>
      </div>
    </div>
    <div class="flash-navrow">
      <button class="btn sm" id="nav-prev" ${state.idx <= 0 ? 'disabled' : ''}><i class="fa-solid fa-arrow-left"></i> anterior</button>
      <span class="pos small muted">${(state.idx + 1).toLocaleString('pt-BR')} / ${state.deck.length.toLocaleString('pt-BR')}</span>
      <button class="btn sm" id="nav-next" ${state.idx >= state.deck.length - 1 ? 'disabled' : ''}>próxima <i class="fa-solid fa-arrow-right"></i></button>
    </div>`;

  const card = $('#flash-card', stage);
  card.addEventListener('click', ev => {
    if (ev.target.closest('button')) return;
    flip(sec);
  });
  /* arrows under the card */
  $('#nav-prev', stage)?.addEventListener('click', () => nav(-1, sec));
  $('#nav-next', stage)?.addEventListener('click', () => nav(1, sec));
  /* swipe navigation (mobile) */
  let tx = 0, ty = 0;
  card.addEventListener('touchstart', ev => {
    tx = ev.changedTouches[0].clientX; ty = ev.changedTouches[0].clientY;
  }, { passive: true });
  card.addEventListener('touchend', ev => {
    const dx = ev.changedTouches[0].clientX - tx;
    const dy = ev.changedTouches[0].clientY - ty;
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) nav(dx > 0 ? 1 : -1, sec);
  }, { passive: true });
  $('#card-speak', stage)?.addEventListener('click', () => {
    const b = $('#card-speak', stage);
    speakArabic(e.word, getState().ttsRate);
    b.classList.add('playing');
    setTimeout(() => b.classList.remove('playing'), 1300);
  });
  /* speaker on the example sentence (back face) */
  $('#card-speak-ex', stage)?.addEventListener('click', ev => {
    const b = ev.currentTarget;
    speakArabic(e.example, getState().ttsRate, { onEnd: () => b.classList.remove('playing') });
    b.classList.add('playing');
    setTimeout(() => b.classList.remove('playing'), 9000); // safety if onEnd misses
  });
  $('#card-fav', stage)?.addEventListener('click', () => {
    const on = toggleFav(e.id);
    $('#card-fav', stage).className = `star-btn ${on ? 'on' : ''}`;
    $('#card-fav', stage).innerHTML = `<i class="fa-${on ? 'solid' : 'regular'} fa-star"></i>`;
    toast(on ? 'Adicionada aos favoritos ⭐' : 'Removida dos favoritos', { icon: 'fa-star' });
  });
  $$('[data-rate]', stage).forEach(b => b.addEventListener('click', ev => {
    ev.stopPropagation();
    rate(+b.dataset.rate, sec);
  }));
}
