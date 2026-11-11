/* Arabesco — app shell: boot, router, theme, onboarding */

import { getState, save } from './store.js';
import { isSupported, speakArabic, stopAll, openAudioHelp } from './tts.js';
import { touchStreak, updateMini, missionsDone, checkAchievements, addXP } from './gamify.js';
import { toast, esc, openModal, closeModal, $, $$ } from './ui.js';

/* views (lazy one-time render caching handled in showView) */
import { renderDashboard } from './views/dash.js';
import { renderCards } from './views/cards.js';
import { renderAlphabet } from './views/alphabet.js';
import { renderQuiz } from './views/quiz.js';
import { renderDict } from './views/dict.js';
import { renderVerbs } from './views/verbs.js';
import { renderPhrases } from './views/phrases.js';
import { renderGames } from './views/games.js';
import { renderProgress } from './views/progress.js';

const VIEWS = {
  dashboard: { fn: renderDashboard, always: true },
  cards: { fn: renderCards },
  alphabet: { fn: renderAlphabet },
  quiz: { fn: renderQuiz },
  dict: { fn: renderDict },
  verbs: { fn: renderVerbs },
  phrases: { fn: renderPhrases },
  games: { fn: renderGames },
  progress: { fn: renderProgress, always: true },
};

const rendered = {};

export function showView(name) {
  stopAll();
  const conf = VIEWS[name];
  if (!conf) return;
  $$('.view').forEach(v => v.classList.remove('active'));
  const sec = document.getElementById('view-' + name);
  if (!sec) return;
  sec.classList.add('active');
  if (conf.always || !rendered[name]) {
    conf.fn(sec).catch?.(e => {
      sec.innerHTML = `<div class="card center mt-4"><p class="muted"><i class="fa-solid fa-triangle-exclamation"></i> Erro ao carregar: ${esc(e.message)}</p><p class="small muted mt-2">Se abriu o arquivo direto do disco, rode <b>serve.bat</b> ou <code>python -m http.server</code>.</p></div>`;
    });
    rendered[name] = true;
  }
  $$('.nav-item, .bn-item').forEach(b => {
    b.classList.toggle('active', b.dataset.view === name);
  });
  window.scrollTo({ top: 0 });
}

/* ── Theme ─────────────────────────────────────────────── */
export function setTheme(t) {
  document.documentElement.dataset.theme = t;
  localStorage.setItem('arabesco_theme', t);
  const st = getState();
  st._theme = t;
  save();
  $$('.theme-btn').forEach(b => {
    const i = b.querySelector('i');
    const l = b.querySelector('span');
    if (i) i.className = t === 'dark' ? 'fa-solid fa-sun' : 'fa-solid fa-moon';
    if (l) l.textContent = t === 'dark' ? 'Modo claro' : 'Modo noturno';
  });
  const mm = $('#theme-lbl-m');
  if (mm) mm.textContent = t === 'dark' ? 'Modo claro' : 'Modo noturno';
}

function toggleTheme() {
  const cur = document.documentElement.dataset.theme;
  setTheme(cur === 'dark' ? 'light' : 'dark');
}

/* ── Onboarding ────────────────────────────────────────── */
function runOnboarding() {
  let step = 0;
  let goal = 10;
  let motivation = 'culture';
  const goals = [
    { n: 5, label: 'Leve', ar: 'كَلِمَات' },
    { n: 10, label: 'Saudável', ar: 'يَوْمِيَّة' },
    { n: 20, label: 'Intensa', ar: 'طَاقَة' },
  ];
  const motivations = [
    { k: 'culture', icon: 'fa-mosque', t: 'Cultura árabe' },
    { k: 'travel', icon: 'fa-plane', t: 'Viajar' },
    { k: 'work', icon: 'fa-briefcase', t: 'Trabalho' },
    { k: 'brain', icon: 'fa-brain', t: 'Exercitar a mente' },
  ];

  const body = openModal('<div id="onb-body"></div>', { onClose: () => {} });
  body.parentElement.querySelector('.close-x')?.remove(); // no skipping without finishing? keep it — actually allow skip
  const scr = body.parentElement.parentElement.querySelector('.scrim');
  if (scr) scr.style.pointerEvents = 'none';

  const draw = () => {
    if (step === 0) {
      body.innerHTML = `
        <div class="onb-step">
          <div class="big-ar">أَرَبِسْكُو</div>
          <h2 style="margin-top:8px">Bem-vindo ao Arabesco</h2>
          <p class="muted mt-1">A plataforma que ensina <b>árabe padrão</b> para brasileiros — com 5.000 palavras, alfabeto interativo e repetição inteligente.</p>
          <p class="small muted mt-2 ar-display">مَرْحَباً بِكُمْ فِي رِحْلَةِ تَعَلُّمِ اللُّغَةِ الْعَرَبِيَّةِ</p>
          <div class="onb-opts mt-3">
            <button class="btn primary lg" id="onb-next">Começar <i class="fa-solid fa-arrow-right"></i></button>
          </div>
        </div>`;
    } else if (step === 1) {
      body.innerHTML = `
        <div class="onb-step">
          <div class="big-ar" style="font-size:40px">هَدَفُكَ الْيَوْمِيّ</div>
          <h2 class="mt-1">Qual sua meta diária?</h2>
          <p class="muted small mt-1">Você pode mudar depois em Progresso → Ajustes.</p>
          <div class="onb-opts">
            ${goals.map(g => `
              <div class="onb-opt ${goal === g.n ? 'sel' : ''}" data-goal="${g.n}">
                <div class="b">${g.n} <span style="font-size:13px">palavras</span></div>
                <small>${g.label} / dia</small>
              </div>`).join('')}
          </div>
          <button class="btn primary lg mt-3" id="onb-next" ${goal ? '' : 'disabled'}>Continuar <i class="fa-solid fa-arrow-right"></i></button>
        </div>`;
    } else {
      body.innerHTML = `
        <div class="onb-step">
          <div class="big-ar" style="font-size:40px">لِمَاذَا تَتَعَلَّمُ؟</div>
          <h2 class="mt-1">Por que você quer aprender árabe?</h2>
          <div class="onb-opts">
            ${motivations.map(m => `
              <div class="onb-opt ${motivation === m.k ? 'sel' : ''}" data-motiv="${m.k}">
                <i class="fa-solid ${m.icon}" style="font-size:22px;color:var(--gold-strong)"></i>
                <div class="b" style="font-size:14px;margin-top:8px">${m.t}</div>
              </div>`).join('')}
          </div>
          <button class="btn gold lg mt-3" id="onb-done">Começar a estudar <i class="fa-solid fa-star-and-crescent"></i></button>
        </div>`;
    }

    const next = $('#onb-next', body);
    if (next) next.addEventListener('click', () => { step++; draw(); });
    $$('.onb-opt[data-goal]', body).forEach(o => o.addEventListener('click', () => {
      goal = +o.dataset.goal; draw();
    }));
    $$('.onb-opt[data-motiv]', body).forEach(o => o.addEventListener('click', () => {
      motivation = o.dataset.motiv; draw();
    }));
    const done = $('#onb-done', body);
    if (done) done.addEventListener('click', () => {
      const st = getState();
      st.onboarded = true;
      st.dailyGoal = goal;
      st.motivation = motivation;
      save();
      touchStreak();
      closeModal();
      showView('dashboard');
      toast('Meticulously preparado. Bem-vindo!', { icon: 'fa-star-and-crescent', type: 'success' });
    });
  };
  draw();
}

/* ── Boot ──────────────────────────────────────────────── */
async function boot() {
  setTheme(document.documentElement.dataset.theme || 'light');
  updateMini();

  /* nav bindings */
  $$('.nav-item, .bn-item').forEach(b => {
    if (b.dataset.view) b.addEventListener('click', () => {
      showView(b.dataset.view);
      closeDrawer();
    });
  });
  $('#theme-toggle')?.addEventListener('click', toggleTheme);
  $('#theme-toggle-mobile')?.addEventListener('click', toggleTheme);
  $('#audio-help-btn')?.addEventListener('click', () => openAudioHelp());
  $('#audio-help-btn-m')?.addEventListener('click', () => { openAudioHelp(); window.closeDrawer?.(); });

  /* drawer */
  const drawer = $('#drawer');
  const openDrawer = () => drawer.classList.add('open');
  window.closeDrawer = closeDrawer;
  $('#more-btn')?.addEventListener('click', openDrawer);
  $('#drawer-scrim')?.addEventListener('click', closeDrawer);
  $('#drawer-close')?.addEventListener('click', closeDrawer);

  /* TTS support check */
  if (!isSupported()) {
    toast('Seu navegador não suporta pronúncia — use Chrome ou Edge', { icon: 'fa-triangle-exclamation' });
  }

  /* streak day rollover + streak touch only on study activity (touchStreak called by views) */
  const st = getState();
  if (!st.onboarded) runOnboarding();
  else showView('dashboard');

  /* PWA */
  if ('serviceWorker' in navigator) {
    try { navigator.serviceWorker.register('sw.js'); } catch { /* ignore */ }
  }
}

function closeDrawer() {
  $('#drawer')?.classList.remove('open');
}

boot();
