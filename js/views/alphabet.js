/* Arabesco — Alphabet Academy (28 letras + harakat + sol/lua + quiz) */

import { getAlphabet } from '../data.js';
import { getState, toggleAlpha, save } from '../store.js';
import { speakArabic } from '../tts.js';
import { addXP, checkAchievements, touchStreak } from '../gamify.js';
import { esc, openModal, toast, shuffle, $, $$ } from '../ui.js';

const FORM_NAMES = ['Isolada', 'Inicial', 'Meio', 'Final'];

export async function renderAlphabet(section) {
  const alpha = await getAlphabet();
  const st = getState();
  const done = Object.keys(st.alphaDone).length;

  section.innerHTML = `
    <div class="arch">
      <div class="eyebrow">ACADEMIA DE LETRAS</div>
      <h2>Alfabeto Árabe — ${done}/28</h2>
      <div class="ar-display">الأَبْجَدِيَّة</div>
      <p class="mt-2" style="opacity:.85;font-size:14px">${esc(alpha.meta.intro)}</p>
      <div class="progress gold mt-3" style="max-width:320px"><div style="width:${(done / 28) * 100}%"></div></div>
    </div>

    <div class="section-title"><i class="fa-solid fa-font"></i> As 28 letras <span class="count">clique para explorar</span></div>
    <div class="alpha-grid">
      ${alpha.letters.map(l => `
        <button class="alpha-tile ${st.alphaDone[l.id] ? 'learned' : ''}" data-letter="${l.id}">
          <span class="glyph" lang="ar">${l.char}</span>
          <span class="nm">${l.name}</span>
          <span class="snd">"${l.sound}"</span>
        </button>`).join('')}
    </div>

    <div class="section-title"><i class="fa-solid fa-music"></i> Harakat — as vogais curtas</div>
    <div class="card">
      <p class="small muted mb-2">Os pequenos sinais acima e abaixo das letras. Textos comuns quase nunca os trazem — mas eles são a chave para ler de verdade.</p>
      ${alpha.harakat.map(h => `
        <div class="row spread wrap" style="padding:10px 0;border-bottom:1px dashed var(--line)">
          <div class="row" style="gap:14px">
            <span class="glyph ar-display" style="font-size:30px;color:var(--gold-strong)">${h.sign}</span>
            <div>
              <b>${h.name}</b> <span class="small muted ar-display">· ${esc(h.nameAr)}</span>
              <div class="small muted">${esc(h.desc)}</div>
            </div>
          </div>
          <button class="chip" data-haraka="${esc(h.sign)}"><i class="fa-solid fa-volume-high"></i> som "${h.sound}"</button>
        </div>`).join('')}
    </div>

    <div class="section-title"><i class="fa-solid fa-sun"></i> ${esc(alpha.sunMoonLesson.title)}</div>
    <div class="card">
      <p class="small muted">${esc(alpha.sunMoonLesson.intro)}</p>
      <div class="stat-grid mt-3">
        <div class="stat" style="--lvl:#C77E3E">
          <div class="row"><i class="fa-solid fa-sun" style="color:#C77E3E"></i><b>Letras Solares (14)</b></div>
          <div class="ar-text mt-2" style="font-size:19px">ت ث د ذ ر ز س ش ص ض ط ظ ل ن</div>
          <p class="small mt-2">${esc(alpha.sunMoonLesson.sun.desc)}</p>
          <div class="row mt-2" style="gap:8px;flex-wrap:wrap">
            <span class="chip ar-display" style="font-size:14px">${esc(alpha.sunMoonLesson.sun.ex1.ar)} → ${esc(alpha.sunMoonLesson.sun.ex1.read)}</span>
            <span class="chip ar-display" style="font-size:14px">${esc(alpha.sunMoonLesson.sun.ex2.ar)} → ${esc(alpha.sunMoonLesson.sun.ex2.read)}</span>
          </div>
        </div>
        <div class="stat">
          <div class="row"><i class="fa-regular fa-moon" style="color:var(--teal)"></i><b>Letras Lunares (14)</b></div>
          <div class="ar-text mt-2" style="font-size:19px">ا ب ج ح خ ع غ ف ق ك م ه و ي</div>
          <p class="small mt-2">${esc(alpha.sunMoonLesson.moon.desc)}</p>
          <div class="row mt-2" style="gap:8px;flex-wrap:wrap">
            <span class="chip ar-display" style="font-size:14px">${esc(alpha.sunMoonLesson.moon.ex1.ar)} → ${esc(alpha.sunMoonLesson.moon.ex1.read)}</span>
            <span class="chip ar-display" style="font-size:14px">${esc(alpha.sunMoonLesson.moon.ex2.ar)} → ${esc(alpha.sunMoonLesson.moon.ex2.read)}</span>
          </div>
        </div>
      </div>
    </div>

    <div class="section-title"><i class="fa-solid fa-bolt"></i> Quiz do alfabeto</div>
    <div class="card center" id="alpha-quiz-zone">
      <p class="muted small">10 perguntas: letras, sons, harakat e sol/lua. Cada acerto vale XP.</p>
      <button class="btn gold mt-2" id="alpha-quiz-start"><i class="fa-solid fa-play"></i> Começar o quiz</button>
    </div>
  `;

  $$('.alpha-tile', section).forEach(t => t.addEventListener('click', () => {
    openLetter(+t.dataset.letter, section);
  }));
  $$('[data-haraka]', section).forEach(b => b.addEventListener('click', () => {
    speakArabic('َ ِ ُ', getState().ttsRate);
    toast('Ouça: فتحة (a) · كسرة (i) · ضمة (u)', { icon: 'fa-music' });
  }));
  $('#alpha-quiz-start', section)?.addEventListener('click', () => startQuiz(section, alpha));
}

function openLetter(id, section) {
  const alpha = section._alpha || null;
  void alpha;
  getAlphabet().then(a => {
    const letters = a.letters;
    const i = letters.findIndex(l => l.id === id);
    const l = letters[i];
    const st = getState();
    const learned = !!st.alphaDone[l.id];
    const content = openModal(`
      <div class="center">
        <div class="ar-display" style="font-size:84px;line-height:1.2;color:var(--primary)">${l.char}</div>
        <h3 class="mt-1">${l.name} <span class="ar-display muted" style="font-size:20px">· ${esc(l.nameAr)}</span></h3>
        <div class="chip-row center mt-1" style="justify-content:center">
          <span class="chip">som "${l.sound}"</span>
          <span class="chip ${l.sunMoon === 'sun' ? 'active' : ''}">${l.sunMoon === 'sun' ? '☀️ solar' : '🌙 lunar'}</span>
          <span class="chip">${l.connects ? 'se liga →' : 'não se liga →'}</span>
        </div>
        <p class="muted small mt-2" style="max-width:420px;margin:8px auto">${esc(l.desc)}</p>
        <div class="form-row mt-3">
          ${l.forms.map((f, k) => `
            <div class="form-cell">
              <div class="glyph" lang="ar">${f === '' ? '—' : f}</div>
              <div class="pos">${FORM_NAMES[k]}</div>
            </div>`).join('')}
        </div>
        <div class="example-box mt-3" style="max-width:340px;margin-left:auto;margin-right:auto">
          <div class="ar-text" style="font-size:24px">${esc(l.example.word)}</div>
          <span class="translit">${esc(l.example.translit)}</span>
          <div class="pt">${esc(l.example.meaning)}</div>
        </div>
        <div class="row mt-3 center" style="justify-content:center;gap:10px;flex-wrap:wrap">
          <button class="sound-btn" id="lt-speak"><i class="fa-solid fa-volume-high"></i></button>
          <button class="sound-btn" id="lt-speak-word"><i class="fa-solid fa-comment-dots"></i></button>
          <button class="btn ${learned ? 'ghost' : 'primary'}" id="lt-done">
            <i class="fa-solid ${learned ? 'fa-rotate-left' : 'fa-check'}"></i> ${learned ? 'Desmarcar' : 'Aprendi esta letra'}
          </button>
        </div>
        <div class="row mt-3" style="justify-content:space-between">
          <button class="btn sm" id="lt-prev"><i class="fa-solid fa-arrow-right"></i> anterior</button>
          <span class="small muted">${l.id} / 28</span>
          <button class="btn sm" id="lt-next">próxima <i class="fa-solid fa-arrow-left"></i></button>
        </div>
      </div>
    `);

    $('#lt-speak', content).addEventListener('click', () => speakArabic(l.char, getState().ttsRate));
    $('#lt-speak-word', content).addEventListener('click', () => speakArabic(l.example.word, getState().ttsRate));
    $('#lt-prev', content).addEventListener('click', () => openLetter(letters[(i - 1 + 28) % 28].id, section));
    $('#lt-next', content).addEventListener('click', () => openLetter(letters[(i + 1) % 28].id, section));
    $('#lt-done', content).addEventListener('click', () => {
      const now = toggleAlpha(l.id);
      if (now) { addXP(10); touchStreak(); }
      const st2 = getState();
      if (Object.keys(st2.alphaDone).length === 28) checkAchievements(null, { alphaDone: true });
      const tile = $(`.alpha-tile[data-letter="${l.id}"]`, section);
      tile?.classList.toggle('learned', now);
      toast(now ? `Letra ${l.name} aprendida! (+10 XP)` : 'Desmarcada', { icon: 'fa-font', type: now ? 'success' : '' });
      const dt = st2.alphaDone;
      void dt;
    });
  });
}

/* ── Alphabet quiz ─────────────────────────────────────── */
function startQuiz(section, alpha) {
  const qs = shuffle(alpha.quizBank).slice(0, 10);
  let i = 0, score = 0;

  const zone = $('#alpha-quiz-zone', section);
  const drawQ = () => {
    if (i >= qs.length) {
      const st = getState();
      save();
      if (score === 10) { st.stats.perfectQuizzes = (st.stats.perfectQuizzes || 0) + 1; save(); }
      addXP(score * 3);
      touchStreak();
      zone.innerHTML = `
        <div class="result-score" style="--p:${score * 10}">
          <div class="inner"><b>${score}/10</b><br><span class="small muted">acertos</span></div>
        </div>
        <p class="muted small">${score === 10 ? 'Alfabeto dominado! 🎉' : 'Continue treinando — o quiz é infinito.'}</p>
        <button class="btn gold mt-2" id="alpha-quiz-again"><i class="fa-solid fa-rotate"></i> Jogar de novo</button>`;
      $('#alpha-quiz-again', zone).addEventListener('click', () => startQuiz(section, alpha));
      return;
    }
    const q = qs[i];
    zone.innerHTML = `
      <div class="quiz-meter"><span>${i + 1}/10</span><span>acertos: ${score}</span></div>
      <div class="quiz-q">${esc(q.q)}</div>
      <div class="quiz-opts">
        ${q.opts.map((o, k) => `<button class="quiz-opt" data-k="${k}"><span class="key">${'ABCD'[k]}</span><span>${esc(o)}</span></button>`).join('')}
      </div>`;
    $$('.quiz-opt', zone).forEach(b => b.addEventListener('click', () => {
      const ok = +b.dataset.k === q.answer;
      $$('.quiz-opt', zone).forEach(x => { x.disabled = true; if (+x.dataset.k === q.answer) x.classList.add('correct'); });
      if (ok) { score++; addXP(3); } else b.classList.add('wrong');
      setTimeout(() => { i++; drawQ(); }, 750);
    }));
  };
  drawQ();
}
