/* Arabesco — Quiz Arena: leitura, audição e escrita */

import { getDictionary } from '../data.js';
import { getState, save, logToday } from '../store.js';
import { speakArabic } from '../tts.js';
import { addXP, bumpMission, touchStreak, checkAchievements } from '../gamify.js';
import { esc, levelChipsHTML, shuffle, toast, $, $$ } from '../ui.js';

const cfg = { level: 'all', mode: 'read' };

const MODES = [
  { v: 'read', label: 'Leitura', icon: 'fa-book', desc: 'A palavra árabe aparece — escolha o significado.' },
  { v: 'listen', label: 'Audição', icon: 'fa-headphones', desc: 'Escute e escolha o significado — treino de ouvido.' },
  { v: 'write', label: 'Escrita', icon: 'fa-pen-nib', desc: 'Significado em português — escolha a palavra árabe.' },
];

function norm(s) {
  return String(s || '').toLowerCase();
}

function buildQuestions(dict, n = 10) {
  const st = getState();
  const pool = dict.filter(e => cfg.level === 'all' || e.level === cfg.level);
  if (pool.length < 12) return [];
  const picked = shuffle(pool).slice(0, n);
  return picked.map(e => {
    const opts = shuffle(pool.filter(x => x.id !== e.id && norm(x.meaning) !== norm(e.meaning))).slice(0, 3);
    return { q: e, opts: shuffle([e, ...opts]) };
  });
}

export async function renderQuiz(section) {
  const dict = await getDictionary();
  const st = getState();
  section.innerHTML = `
    <div class="arch">
      <div class="eyebrow">SALA DE DESAFIOS</div>
      <h2>Quiz Arena</h2>
      <div class="ar-display">سَاحَةُ التَّحَدِّيَّات</div>
      <p class="mt-2" style="opacity:.85;font-size:14px">3 modos de treino, 10 perguntas por rodada, XP por acerto. Quizzes concluídos: <b>${st.stats.quizzesDone || 0}</b>.</p>
    </div>

    <div class="section-title"><i class="fa-solid fa-sliders"></i> Escolha o modo</div>
    <div class="stat-grid" id="quiz-modes">
      ${MODES.map(m => `
        <div class="stat" data-mode="${m.v}" style="cursor:pointer;${cfg.mode === m.v ? 'border-color:var(--gold);box-shadow:var(--gold-glow)' : ''}">
          <i class="fa-solid ${m.icon}"></i>
          <div class="num" style="font-size:19px">${m.label}</div>
          <div class="lbl">${m.desc}</div>
        </div>`).join('')}
    </div>

    <div class="chip-row mt-3" id="quiz-levels">${levelChipsHTML(cfg.level)}</div>

    <div class="card center mt-3" id="quiz-zone">
      <div style="font-size:42px">🎯</div>
      <p class="muted small mt-1">Sua pontuação mais recente fica registrada no Progresso.</p>
      <button class="btn gold lg mt-2" id="quiz-start"><i class="fa-solid fa-play"></i> Iniciar rodada</button>
    </div>
  `;

  $$('#quiz-modes .stat', section).forEach(s => s.addEventListener('click', () => {
    cfg.mode = s.dataset.mode;
    $$('#quiz-modes .stat', section).forEach(x => {
      const on = x.dataset.mode === cfg.mode;
      x.style.borderColor = on ? 'var(--gold)' : '';
      x.style.boxShadow = on ? 'var(--gold-glow)' : '';
    });
  }));
  $$('#quiz-levels .chip', section).forEach(c => c.addEventListener('click', () => {
    cfg.level = c.dataset.level;
    $$('#quiz-levels .chip', section).forEach(x => x.classList.toggle('active', x === c));
  }));
  $('#quiz-start', section)?.addEventListener('click', () => start(section, dict));
}

async function start(section, dict) {
  const qs = buildQuestions(dict, 10);
  if (!qs.length) { toast('Nível sem palavras suficientes para o quiz', { icon: 'fa-triangle-exclamation' }); return; }
  let i = 0, score = 0, wrongList = [];
  const zone = $('#quiz-zone', section);

  const draw = () => {
    if (i >= qs.length) return finish(zone, score, wrongList, section);
    const { q, opts } = qs[i];
    const st = getState();
    zone.innerHTML = `
      <div class="quiz-meter"><span>${i + 1}/10</span><span>acertos: ${score}</span></div>
      ${cfg.mode === 'read' ? `
        <div class="quiz-word ar-display" lang="ar">${esc(q.word)}</div>
        <div class="translit center">${esc(q.translit)}</div>` : ''}
      ${cfg.mode === 'write' ? `
        <div class="quiz-q" style="font-size:17px">${esc(short(q.meaning))}</div>
        <div class="row center mt-1" style="justify-content:center;gap:8px">
          <span class="badge lvl" data-lvl="${q.level}">${q.level}</span><span class="badge pos">${esc(q.pos)}</span>
        </div>` : ''}
      ${cfg.mode === 'listen' ? `
        <button class="sound-btn lg" id="quiz-audio" style="margin:6px auto"><i class="fa-solid fa-volume-high"></i></button>
        <p class="small muted center mt-1">ouça e escolha o significado</p>` : ''}
      <div class="quiz-opts">
        ${opts.map((o, k) => `
          <button class="quiz-opt" data-k="${k}">
            ${cfg.mode === 'write'
              ? `<span class="ar-text" style="font-size:19px">${esc(o.word)}</span><span class="translit small">${esc(o.translit)}</span>`
              : `<span class="key">${'ABCD'[k]}</span><span class="flex-1">${esc(short(o.meaning))}</span>`}
          </button>`).join('')}
      </div>`;

    if (cfg.mode === 'listen') {
      speakArabic(q.word, st.ttsRate);
      $('#quiz-audio', zone)?.addEventListener('click', () => speakArabic(q.word, getState().ttsRate));
    }

    $$('.quiz-opt', zone).forEach(b => b.addEventListener('click', () => {
      const chosen = opts[+b.dataset.k];
      const ok = chosen.id === q.id;
      $$('.quiz-opt', zone).forEach(x => {
        x.disabled = true;
        if (opts[+x.dataset.k].id === q.id) x.classList.add('correct');
      });
      if (ok) { score++; addXP(3); } else {
        b.classList.add('wrong');
        wrongList.push(q);
      }
      if (cfg.mode !== 'read') $$('.quiz-opt', zone).forEach(x => {
        const o = opts[+x.dataset.k];
        if (o.id === q.id && cfg.mode === 'write') void 0;
      });
      setTimeout(() => { i++; draw(); }, ok ? 600 : 1100);
    }));
  };
  draw();
}

function finish(zone, score, wrongList, section) {
  const st = getState();
  st.stats.quizzesDone = (st.stats.quizzesDone || 0) + 1;
  if (score === 10) st.stats.perfectQuizzes = (st.stats.perfectQuizzes || 0) + 1;
  save();
  addXP(score >= 8 ? 10 : 0);
  logToday('cards', 10);
  bumpMission('quizzes');
  touchStreak();
  getDictionary().then(d => checkAchievements({ mastered: countMastered(d) }, { perfectQuiz: score === 10 }));
  zone.innerHTML = `
    <div class="result-score" style="--p:${score * 10}">
      <div class="inner"><b>${score}/10</b><br><span class="small muted">acertos</span></div>
    </div>
    <h3 class="mt-2">${score >= 9 ? 'ماشاء الله! 🌟 Impressionante!' : score >= 7 ? 'Muito bem! Continue assim.' : 'Cada erro é um professor. Tente de novo!'}</h3>
    ${score >= 8 ? '<p class="small muted mt-1">Bônus de +10 XP pela grande rodada.</p>' : ''}
    ${wrongList.length ? `
      <div class="mt-3">
        <b class="small">Palavras para revisar:</b>
        <div class="dict-list mt-2" style="text-align:left">
          ${wrongList.map(w => `
            <div class="dict-row" style="cursor:default">
              <span class="w-ar">${esc(w.word)}</span>
              <div class="w-info"><span class="translit small">${esc(w.translit)}</span><div class="w-meaning">${esc(short(w.meaning))}</div></div>
              <button class="sound-btn" data-w="${esc(w.word)}"><i class="fa-solid fa-volume-high"></i></button>
            </div>`).join('')}
        </div>
      </div>` : ''}
    <div class="row mt-3" style="justify-content:center;gap:10px">
      <button class="btn gold" id="quiz-again"><i class="fa-solid fa-rotate"></i> Nova rodada</button>
      <button class="btn" id="quiz-cards"><i class="fa-solid fa-clone"></i> Ir para os cartões</button>
    </div>`;

  $$('[data-w]', zone).forEach(b => b.addEventListener('click', () => speakArabic(b.dataset.w, getState().ttsRate)));
  $('#quiz-again', zone).addEventListener('click', () => renderQuiz(section));
  $('#quiz-cards', zone).addEventListener('click', () => {
    import('../app.js').then(m => m.showView('cards'));
  });
}

function countMastered(dict) {
  const st = getState();
  return dict.reduce((n, e) => n + (st.learned[e.id]?.s === 'mastered' ? 1 : 0), 0);
}

function short(m) {
  const c = m.split('—')[0].split('؛')[0].trim();
  return c.length > 58 ? c.slice(0, 55) + '…' : c;
}
