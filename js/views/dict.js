/* Arabesco — Dictionary (5.000 palavras) */

import { getDictionary } from '../data.js';
import { getState, save, toggleFav, markMastered, unmark, logToday } from '../store.js';
import { speakArabic } from '../tts.js';
import { addXP, bumpMission, touchStreak } from '../gamify.js';
import { esc, openModal, toast, LEVELS, LEVEL_INFO, $, $$ } from '../ui.js';

const f = { q: '', level: 'all', status: 'all', pos: 'all' };
const BATCH = 80;
let shown = 0;
let list = [];
let dict = [];

const STATUSES = [
  { v: 'all', label: 'Todas' },
  { v: 'new', label: 'Novas' },
  { v: 'learning', label: 'Aprendendo' },
  { v: 'mastered', label: 'Dominadas ✓' },
  { v: 'fav', label: 'Favoritas ⭐' },
  { v: 'hard', label: 'Difíceis ⚠️' },
];

const POSITIONS = ['all', 'Substantivo', 'Verbo conjugado', 'Adjetivo', 'Masdar (nome de ação)', 'Construção verbal', 'Advérbio', 'Pronome', 'Número', 'Expressão'];

export async function renderDict(section) {
  dict = await getDictionary();
  section.innerHTML = `
    <div class="arch">
      <div class="eyebrow">BIBLIOTECA COMPLETA</div>
      <h2>Dicionário Árabe-Português</h2>
      <div class="ar-display">القَامُوس</div>
      <p class="mt-2" style="opacity:.85;font-size:14px">5.000 entradas do árabe padrão com exemplos traduzidos. Busque por palavra, significado ou transliteração.</p>
    </div>

    <div class="row wrap mt-3" style="gap:10px">
      <div class="search-wrap flex-1" style="min-width:230px">
        <i class="fa-solid fa-magnifying-glass"></i>
        <input class="input" id="dict-q" placeholder="Buscar: كتاب · kitāb · livro…" autocomplete="off">
      </div>
      <select class="select" id="dict-pos" style="width:auto;min-width:170px">
        ${POSITIONS.map(p => `<option value="${p}" ${f.pos === p ? 'selected' : ''}>${p === 'all' ? 'Todas as classes' : p}</option>`).join('')}
      </select>
      <button class="btn" id="dict-anki" title="Exportar palavras estudadas para o Anki (.txt)"><i class="fa-solid fa-file-export"></i> Anki</button>
    </div>

    <div class="chip-row mt-2" id="dict-levels">
      ${['all', ...LEVELS].map(l => `<button class="chip ${f.level === l ? 'active' : ''}" data-level="${l}">${l === 'all' ? 'Todos os níveis' : l}</button>`).join('')}
    </div>
    <div class="chip-row mt-2" id="dict-status">
      ${STATUSES.map(s => `<button class="chip ${f.status === s.v ? 'active' : ''}" data-status="${s.v}">${s.label}</button>`).join('')}
    </div>

    <div class="row spread small muted mt-3 mb-2">
      <span id="dict-count">—</span>
      <span>tocar em uma linha abre os detalhes</span>
    </div>
    <div class="dict-list" id="dict-list"></div>
    <div class="center mt-3">
      <button class="btn" id="dict-more" style="display:none"><i class="fa-solid fa-chevron-down"></i> Carregar mais</button>
    </div>
  `;

  $('#dict-q', section).addEventListener('input', ev => {
    f.q = ev.target.value.trim();
    shown = 0;
    refresh(section);
  });
  $('#dict-pos', section).addEventListener('change', ev => { f.pos = ev.target.value; shown = 0; refresh(section); });
  $$('#dict-levels .chip', section).forEach(c => c.addEventListener('click', () => {
    f.level = c.dataset.level; shown = 0;
    $$('#dict-levels .chip', section).forEach(x => x.classList.toggle('active', x === c));
    refresh(section);
  }));
  $$('#dict-status .chip', section).forEach(c => c.addEventListener('click', () => {
    f.status = c.dataset.status; shown = 0;
    $$('#dict-status .chip', section).forEach(x => x.classList.toggle('active', x === c));
    refresh(section);
  }));
  $('#dict-more', section).addEventListener('click', () => { shown += BATCH; draw(section); });
  $('#dict-anki', section).addEventListener('click', exportAnki);

  refresh(section);
}

function applyFilter() {
  const st = getState();
  const q = f.q.toLowerCase();
  list = dict.filter(e => {
    if (f.level !== 'all' && e.level !== f.level) return false;
    if (f.pos !== 'all' && e.pos !== f.pos) return false;
    const w = st.learned[e.id];
    switch (f.status) {
      case 'new': if (w) return false; break;
      case 'learning': if (!w || w.s === 'mastered') return false; break;
      case 'mastered': if (w?.s !== 'mastered') return false; break;
      case 'fav': if (!st.favs[e.id]) return false; break;
      case 'hard': if (!w || !w.lapses) return false; break;
    }
    if (q) {
      const hit = e.word.includes(f.q)
        || (e.translit || '').toLowerCase().includes(q)
        || (e.meaning || '').toLowerCase().includes(q)
        || (e.example || '').includes(f.q)
        || (e.exampleTr || '').toLowerCase().includes(q)
        || (e.base || '').includes(f.q);
      if (!hit) return false;
    }
    return true;
  });
}

function refresh(section) {
  applyFilter();
  shown = BATCH;
  draw(section);
}

function draw(section) {
  const st = getState();
  const host = $('#dict-list', section);
  $('#dict-count', section).textContent = `${list.length} palavras encontradas`;
  const slice = list.slice(0, shown);

  host.innerHTML = slice.map(e => {
    const w = st.learned[e.id];
    const fav = !!st.favs[e.id];
    const mshort = esc(shortMeaning(e.meaning));
    return `
      <div class="dict-row ${w?.s === 'mastered' ? 'mastered' : ''} ${fav ? 'fav' : ''}" data-id="${e.id}">
        <span class="w-ar" lang="ar">${esc(e.word)}</span>
        <div class="w-info">
          <div class="row" style="gap:8px">
            <span class="translit small">${esc(e.translit)}</span>
            <span class="badge lvl" data-lvl="${e.level}">${e.level}</span>
          </div>
          <div class="w-meaning">${mshort}</div>
        </div>
        <div class="w-actions">
          <button class="star-btn ${fav ? 'on' : ''}" data-act="fav" title="Favoritar"><i class="fa-${fav ? 'solid' : 'regular'} fa-star"></i></button>
          <button class="check-btn ${w?.s === 'mastered' ? 'on' : ''}" data-act="master" title="Dominada"><i class="fa-solid fa-check"></i></button>
        </div>
      </div>`;
  }).join('');

  $('#dict-more', section).style.display = shown < list.length ? '' : 'none';

  $$('.dict-row', host).forEach(row => {
    const id = +row.dataset.id;
    row.addEventListener('click', ev => {
      const act = ev.target.closest('[data-act]')?.dataset.act;
      if (act === 'fav') {
        const on = toggleFav(id);
        ev.target.closest('.dict-row').classList.toggle('fav', on);
        const btn = ev.target.closest('.star-btn');
        btn.classList.toggle('on', on);
        btn.innerHTML = `<i class="fa-${on ? 'solid' : 'regular'} fa-star"></i>`;
        return;
      }
      if (act === 'master') {
        const w = getState().learned[id];
        if (w?.s === 'mastered') {
          unmark(id);
          row.classList.remove('mastered');
          ev.target.closest('.check-btn').classList.remove('on');
          toast('Removida das dominadas', { icon: 'fa-rotate-left' });
        } else {
          markMastered(id);
          row.classList.add('mastered');
          ev.target.closest('.check-btn').classList.add('on');
          addXP(5);
          logToday('words', 1);
          bumpMission('newWords');
          touchStreak();
          toast('Palavra dominada! +5 XP ✓', { icon: 'fa-check', type: 'success' });
        }
        return;
      }
      openDetail(id);
    });
  });
}

function openDetail(id) {
  const e = dict.find(x => x.id === id);
  const st = getState();
  const w = st.learned[e.id];
  const content = openModal(`
    <div class="center">
      <div class="ar-display" style="font-size:56px;line-height:1.5;color:var(--primary)" lang="ar">${esc(e.word)}</div>
      <div class="translit" style="font-size:17px">${esc(e.translit)}</div>
      <div class="chip-row center mt-1" style="justify-content:center;flex-wrap:wrap">
        <span class="badge lvl" data-lvl="${e.level}">${e.level} · ${LEVEL_INFO[e.level].name}</span>
        <span class="badge pos">${esc(e.pos)}</span>
        <span class="badge gold">#${e.id}</span>
      </div>
      <p class="mt-2" style="font-size:15.5px">${esc(e.meaning)}</p>
      <div class="example-box mt-2">
        <div class="ar-text" style="font-size:21px">${esc(e.example)}</div>
        <span class="translit">${esc(e.exampleTranslit)}</span>
        <div class="pt">${esc(e.exampleTr)}</div>
      </div>
      <div class="row mt-2 small muted" style="justify-content:center;gap:16px">
        <span>base: <b class="ar-display">${esc(e.base)}</b></span>
        <span>forma: <b>${esc(e.form)}</b></span>
      </div>
      <div class="row mt-3" style="justify-content:center;gap:10px;flex-wrap:wrap">
        <button class="sound-btn" id="d-speak"><i class="fa-solid fa-volume-high"></i></button>
        <button class="sound-btn" id="d-speak-ex"><i class="fa-solid fa-comment-dots"></i></button>
        <button class="btn ${st.favs[e.id] ? 'ghost' : ''}" id="d-fav"><i class="fa-${st.favs[e.id] ? 'solid' : 'regular'} fa-star"></i> ${st.favs[e.id] ? 'Favorita ⭐' : 'Favoritar'}</button>
        <button class="btn primary" id="d-master"><i class="fa-solid fa-check"></i> ${w?.s === 'mastered' ? 'Remover das dominadas' : 'Marcar dominada +5XP'}</button>
      </div>
      ${w ? `<p class="small muted mt-2">${w.revs} revisões · facilidade ${Math.round(w.ease * 100) / 100} · próxima revisão ${new Date(w.due).toLocaleDateString('pt-BR')}</p>` : ''}
    </div>
  `);

  $('#d-speak', content).addEventListener('click', () => speakArabic(e.word, getState().ttsRate));
  $('#d-speak-ex', content).addEventListener('click', () => speakArabic(e.example, getState().ttsRate));
  $('#d-fav', content).addEventListener('click', () => {
    const on = toggleFav(e.id);
    $('#d-fav', content).innerHTML = `<i class="fa-${on ? 'solid' : 'regular'} fa-star"></i> ${on ? 'Favorita ⭐' : 'Favoritar'}`;
  });
  $('#d-master', content).addEventListener('click', () => {
    const w2 = getState().learned[e.id];
    if (w2?.s === 'mastered') { unmark(e.id); toast('Removida das dominadas', { icon: 'fa-rotate-left' }); }
    else { markMastered(e.id); addXP(5); logToday('words', 1); bumpMission('newWords'); touchStreak(); toast('Dominada! +5 XP ✓', { icon: 'fa-check', type: 'success' }); }
    save();
  });
}

function shortMeaning(m) {
  const c = (m || '').split('—')[0].split('؛')[0].trim();
  return c.length > 56 ? c.slice(0, 53) + '…' : c;
}

/* ── Anki export ───────────────────────────────────────── */
function exportAnki() {
  const st = getState();
  const rows = dict.filter(e => st.learned[e.id] || st.favs[e.id]).map(e => {
    const parts = [
      e.word, e.translit, e.meaning.replace(/\t/g, ' '),
      e.example, e.exampleTr, e.level, e.pos,
    ];
    return parts.join('\t');
  });
  if (!rows.length) { toast('Nenhuma palavra estudada ainda para exportar', { icon: 'fa-info-circle' }); return; }
  const blob = new Blob(['#separator:tab\n#html:false\n' + rows.join('\n')], { type: 'text/plain;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `arabesco-anki-${new Date().toISOString().slice(0, 10)}.txt`;
  a.click();
  URL.revokeObjectURL(a.href);
  toast(`${rows.length} palavras exportadas para o Anki`, { icon: 'fa-file-export', type: 'success' });
}
