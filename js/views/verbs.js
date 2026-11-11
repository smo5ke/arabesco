/* Arabesco — Verbs: 20 essenciais com conjugação completa + busca nas 1.229 bases */

import { getTopVerbs, getVerbs } from '../data.js';
import { getState } from '../store.js';
import { speakArabic } from '../tts.js';
import { addXP, touchStreak } from '../gamify.js';
import { esc, openModal, toast, $, $$ } from '../ui.js';

const TENSES = { past: 'Passado (الماضي)', present: 'Presente (المضارع)' };
const PERSONS = ['ele', 'ela', 'eu', 'nós', 'você', 'eles'];

export async function renderVerbs(section) {
  const [top, all] = await Promise.all([getTopVerbs(), getVerbs()]);

  section.innerHTML = `
    <div class="arch">
      <div class="eyebrow">CÂMARA DOS VERBOS</div>
      <h2>Os 20 Verbos Essenciais</h2>
      <div class="ar-display">الأَفْعَال</div>
      <p class="mt-2" style="opacity:.85;font-size:14px">${esc(top.meta.intro)}</p>
    </div>

    <div class="section-title"><i class="fa-solid fa-star"></i> Essenciais</div>
    <div id="top-verbs" class="dict-list"></div>

    <div class="section-title"><i class="fa-solid fa-magnifying-glass"></i> Todos os verbos do dicionário <span class="count">${all.length} raízes</span></div>
    <div class="search-wrap">
      <i class="fa-solid fa-magnifying-glass"></i>
      <input class="input" id="verb-q" placeholder="Buscar verbo: درس · darasa · estudar…">
    </div>
    <div class="dict-list mt-2" id="all-verbs"></div>
    <div class="center mt-2"><button class="btn" id="verb-more" style="display:none"><i class="fa-solid fa-chevron-down"></i> Carregar mais</button></div>
  `;

  const topHost = $('#top-verbs', section);
  topHost.innerHTML = top.verbs.map(v => verbCardHTML(v, true)).join('');
  $$('.verb-card', topHost).forEach(card => {
    card.querySelector('.verb-head').addEventListener('click', () => card.classList.toggle('open'));
  });

  let shown = 60;
  const allHost = $('#all-verbs', section);
  const moreBtn = $('#verb-more', section);

  function drawAll() {
    const q = $('#verb-q', section).value.trim().toLowerCase();
    const filtered = all.filter(v =>
      !q || v.base.includes(q) || (v.translit || '').toLowerCase().includes(q) ||
      (v.meaning || '').toLowerCase().includes(q));
    allHost.innerHTML = filtered.slice(0, shown).map(v => `
      <div class="dict-row" data-base="${esc(v.base)}">
        <span class="w-ar" lang="ar">${esc(v.base)}</span>
        <div class="w-info">
          <span class="translit small">${esc(v.translit)}</span>
          <div class="w-meaning">${esc(short(v.meaning))}</div>
        </div>
        <span class="badge gold">${v.count} formas</span>
      </div>`).join('') || '<p class="muted small center">Nenhum verbo encontrado.</p>';
    moreBtn.style.display = shown < filtered.length ? '' : 'none';
    $$('.dict-row', allHost).forEach(row => {
      row.addEventListener('click', () => {
        const v = all.find(x => x.base === row.dataset.base);
        if (v) openVerbForms(v);
      });
    });
    void q;
  }

  $('#verb-q', section).addEventListener('input', () => { shown = 60; drawAll(); });
  moreBtn.addEventListener('click', () => { shown += 60; drawAll(); });
  drawAll();

  $$('.sound-btn[data-ar]', section).forEach(b => b.addEventListener('click', ev => {
    ev.stopPropagation();
    speakArabic(b.dataset.ar, getState().ttsRate);
  }));
  $$('.verb-form', section).forEach(c => c.addEventListener('click', () => {
    speakArabic(c.dataset.ar, getState().ttsRate);
  }));
}

function verbCardHTML(v, essential) {
  return `
    <div class="card verb-card" style="padding:0;overflow:hidden">
      <div class="verb-head row spread" style="padding:16px 20px;cursor:pointer">
        <div class="row" style="gap:14px">
          <span class="ar-display" style="font-size:26px;color:var(--primary)" lang="ar">${esc(v.base)}</span>
          <div>
            <b>${esc(v.translit)}</b> <span class="muted small">· ${esc(v.meaning)}</span>
            <div class="mt-1"><span class="badge ${v.type?.includes('irregular') ? 'gold' : 'pos'}">${esc(v.type || 'regular')}</span></div>
          </div>
        </div>
        <div class="row" style="gap:8px">
          <button class="sound-btn" data-ar="${esc(v.base)}"><i class="fa-solid fa-volume-high"></i></button>
          <i class="fa-solid fa-chevron-down muted"></i>
        </div>
      </div>
      <div class="verb-body" style="display:none;padding:0 20px 20px">
        ${Object.entries(TENSES).map(([key, label]) => `
          <div class="mt-2">
            <b class="small">${label}</b>
            <div class="stat-grid mt-1">
              ${PERSONS.map(p => {
                const cell = v.conjugation?.[key]?.[p];
                if (!cell) return '';
                return `
                  <div class="form-cell verb-form" data-ar="${esc(cell[0])}" style="cursor:pointer">
                    <div class="glyph" lang="ar" style="font-size:23px">${esc(cell[0])}</div>
                    <div class="translit small" style="font-size:11px">${esc(cell[1])}</div>
                    <div class="pos">${p}</div>
                  </div>`;
              }).join('')}
            </div>
          </div>`).join('')}
        <div class="row wrap mt-3" style="gap:10px">
          ${v.conjugation?.imperative ? `
            <div class="form-cell verb-form" data-ar="${esc(v.conjugation.imperative[0])}">
              <div class="glyph" lang="ar" style="font-size:23px">${esc(v.conjugation.imperative[0])}</div>
              <div class="translit small" style="font-size:11px">${esc(v.conjugation.imperative[1])}</div>
              <div class="pos">${esc(v.conjugation.imperative[2])}</div>
            </div>` : ''}
          ${v.conjugation?.masdar ? `
            <div class="form-cell verb-form" data-ar="${esc(v.conjugation.masdar[0])}">
              <div class="glyph" lang="ar" style="font-size:23px">${esc(v.conjugation.masdar[0])}</div>
              <div class="translit small" style="font-size:11px">${esc(v.conjugation.masdar[1])}</div>
              <div class="pos">${esc(v.conjugation.masdar[2])}</div>
            </div>` : ''}
        </div>
        ${v.example ? `
          <div class="example-box mt-3">
            <div class="ar-text">${esc(v.example.ar)}</div>
            <span class="translit">${esc(v.example.translit)}</span>
            <div class="pt">${esc(v.example.pt)}</div>
          </div>` : ''}
        ${essential ? '' : ''}
      </div>
    </div>`;
}

function openVerbForms(v) {
  const content = openModal(`
    <div class="center">
      <div class="ar-display" style="font-size:50px;color:var(--primary)" lang="ar">${esc(v.base)}</div>
      <div class="translit">${esc(v.translit)}</div>
      <p class="muted small mt-1">${esc(short(v.meaning))}</p>
      <span class="badge gold mt-1">${v.count} formas no dicionário</span>
    </div>
    <div class="dict-list mt-3" style="max-height:50vh;overflow:auto">
      ${v.forms.map(f => `
        <div class="dict-row" style="cursor:pointer" data-ar="${esc(f.word)}">
          <span class="w-ar" lang="ar">${esc(f.word)}</span>
          <div class="w-info">
            <span class="translit small">${esc(f.translit)}</span>
            <div class="w-meaning">${esc(short(f.meaning))}</div>
          </div>
          <span class="badge pos">${esc(f.form)}</span>
        </div>`).join('')}
    </div>
    <p class="small muted center mt-2"><i class="fa-solid fa-volume-high"></i> toque em qualquer forma para ouvir</p>
  `);
  $$('.dict-row', content).forEach(r => r.addEventListener('click', () => speakArabic(r.dataset.ar, getState().ttsRate)));
}

function short(m) {
  const c = (m || '').split('—')[0].split('؛')[0].trim();
  return c.length > 52 ? c.slice(0, 49) + '…' : c;
}
