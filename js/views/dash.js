/* Arabesco — Dashboard (Início) */

import { getDictionary } from '../data.js';
import { getState, countsOf, levelCounts, pacePerDay } from '../store.js';
import { showView } from '../app.js';
import { touchStreak, addXP, missionsDone, MISSION_DEFS, checkAchievements, levelFromXP } from '../gamify.js';
import { esc, fmtDateLong, LEVELS, LEVEL_INFO, $, $$ } from '../ui.js';

const AR_GREETINGS = {
  morning: 'صَبَاحُ الْخَيْرِ',
  afternoon: 'طَابَ مَسَاؤُكَ',
  evening: 'مَسَاءُ الْخَيْرِ',
};

function greeting() {
  const h = new Date().getHours();
  if (h >= 5 && h < 12) return { pt: 'Bom dia', ar: AR_GREETINGS.morning };
  if (h >= 12 && h < 18) return { pt: 'Boa tarde', ar: AR_GREETINGS.afternoon };
  return { pt: 'Boa noite', ar: AR_GREETINGS.evening };
}

function streakRing(pct) {
  const r = 54, c = 2 * Math.PI * r;
  const off = c * (1 - Math.min(1, pct));
  return `
    <div class="streak-ring">
      <svg viewBox="0 0 130 130">
        <circle cx="65" cy="65" r="${r}" fill="none" stroke="var(--bg-3)" stroke-width="9"/>
        <circle cx="65" cy="65" r="${r}" fill="none" stroke="url(#gradFire)" stroke-width="9"
          stroke-linecap="round" stroke-dasharray="${c}" stroke-dashoffset="${off}"/>
        <defs><linearGradient id="gradFire" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="var(--gold)"/><stop offset="100%" stop-color="var(--primary)"/>
        </linearGradient></defs>
      </svg>
      <div class="val"><div><b>${Math.round(pct * 100)}%</b><small>da meta diária</small></div></div>
    </div>`;
}

export async function renderDashboard(section) {
  const [dict] = await Promise.all([getDictionary()]);
  const st = getState();
  const g = greeting();

  /* touch streak + achievements on dashboard visit (active day) */
  if (st.onboarded) {
    touchStreak();
    const counts = countsOf(dict);
    checkAchievements(counts);
  }

  const counts = countsOf(dict);
  const lv = levelCounts(dict);
  const pace = pacePerDay();
  const pctDaily = Math.min(1, (st.hist?.[new Date().toISOString().slice(0, 10)]?.words || 0) / st.dailyGoal);
  const missionDone = missionsDone();
  const xpL = levelFromXP(st.xp);
  const coveredPct = Math.round(((counts.mastered + counts.learning) / counts.total) * 100);

  /* forecast */
  let forecast = '—';
  if (pace && pace.perDay > 0) {
    const days = Math.ceil(counts.remaining / pace.perDay);
    const d = new Date(); d.setDate(d.getDate() + days);
    forecast = `${days} dias • ${d.toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' })}`;
  } else if (counts.remaining > 0) {
    const days = Math.ceil(counts.remaining / st.dailyGoal);
    forecast = `~${days} dias na meta de ${st.dailyGoal}/dia`;
  }

  const currentLevel = LEVELS.find(l => lv[l] && lv[l].mastered + lv[l].learning < lv[l].total) || 'A1';

  section.innerHTML = `
    <div class="hero-grid">
      <div class="hero-arch">
        <div class="arch">
          <div class="eyebrow">ARABESCO • ESCOLA DE ÁRABE</div>
          <h2>${g.pt}, estudante!</h2>
          <div class="ar-display">${g.ar}</div>
          <p class="mt-2" style="opacity:.85;font-size:14px">
            Você está no nível <b>${currentLevel}</b> — ${LEVEL_INFO[currentLevel].share}.
            ${counts.due > 0 ? `<b>${counts.due} palavras</b> estão esperando revisão hoje.` : 'Nenhuma revisão pendente. Hora de aprender palavras novas!'}
          </p>
          <div class="row wrap mt-3">
            <button class="btn gold" id="dash-study"><i class="fa-solid fa-clone"></i> Estudar agora</button>
            <button class="btn ghost" id="dash-quiz" style="color:#F6EFDC;border-color:rgba(239,232,214,.3)"><i class="fa-solid fa-bolt"></i> Quiz rápido</button>
            <button class="btn ghost" id="dash-alpha" style="color:#F6EFDC;border-color:rgba(239,232,214,.3)"><i class="fa-solid fa-font"></i> Alfabeto</button>
          </div>
          <div class="row wrap mt-3" style="gap:16px">
            <div><div style="font-size:22px;font-weight:800;color:#EAD9A0">${counts.mastered}</div><div style="font-size:11px;opacity:.75">dominadas</div></div>
            <div><div style="font-size:22px;font-weight:800;color:#EAD9A0">${counts.learning}</div><div style="font-size:11px;opacity:.75">aprendendo</div></div>
            <div><div style="font-size:22px;font-weight:800;color:#EAD9A0">${st.xp}</div><div style="font-size:11px;opacity:.75">XP total</div></div>
            <div><div style="font-size:22px;font-weight:800;color:#EAD9A0">${coveredPct}%</div><div style="font-size:11px;opacity:.75">do dicionário</div></div>
          </div>
        </div>

        <div class="card">
          <div class="row spread">
            <b><i class="fa-solid fa-bullseye" style="color:var(--gold-strong)"></i> Missões de hoje</b>
            <span class="small muted">${missionDone}/${MISSION_DEFS.length} concluídas</span>
          </div>
          <div class="mt-2">
            ${MISSION_DEFS.map(m => {
              const goal = m.goalFn ? m.goalFn() : m.goal;
              const cur = st.missions?.date === new Date().toISOString().slice(0, 10) ? (st.missions[m.key] || 0) : 0;
              const done = cur >= goal;
              return `
                <div class="mission ${done ? 'done' : ''}">
                  <div class="m-ic"><i class="fa-solid ${done ? 'fa-check' : m.icon}"></i></div>
                  <div class="flex-1">
                    <b>${m.name}</b>
                    <small>${Math.min(cur, goal)} / ${goal}</small>
                  </div>
                  <span class="m-xp">${done ? '✓ feito' : 'pendente'}</span>
                </div>`;
            }).join('')}
          </div>
        </div>

        <div class="quick-actions">
          <button class="quick-action" data-go="dict"><i class="fa-solid fa-book-open"></i><b>Dicionário</b><small>5.000 palavras</small></button>
          <button class="quick-action" data-go="verbs"><i class="fa-solid fa-table-cells"></i><b>Verbos</b><small>20 essenciais + 1.229 bases</small></button>
          <button class="quick-action" data-go="phrases"><i class="fa-solid fa-comments"></i><b>Diálogos</b><small>6 situações reais</small></button>
          <button class="quick-action" data-go="games"><i class="fa-solid fa-gamepad"></i><b>Jogos</b><small>Memória + frases</small></button>
        </div>
      </div>

      <div class="hero-side">
        <div class="card center">
          <div class="row spread mb-2" style="padding:0 6px">
            <b><i class="fa-solid fa-fire" style="color:var(--gold-strong)"></i> Sequência</b>
            <span class="badge gold">${st.streak || 0} dias 🔥</span>
          </div>
          ${streakRing(pctDaily)}
          <div class="mt-2 small muted">Meta: ${st.dailyGoal} palavras novas por dia</div>
          <div class="progress gold mt-2"><div style="width:${pctDaily * 100}%"></div></div>
        </div>

        <div class="card">
          <b><i class="fa-solid fa-wand-magic-sparkles" style="color:var(--gold-strong)"></i> Previsão de fluência</b>
          <div class="mt-2" style="font-size:15px;line-height:1.5">
            ${pace
              ? `No seu ritmo atual você domina as <b>5.000 palavras</b> em <b>${forecast}</b>.`
              : `Estude ${st.dailyGoal} palavras/dia e o dicionário completo fica pronto em <b>~${forecast}</b>.`}
          </div>
          <button class="btn sm mt-2" id="dash-forecast" style="width:100%">Ver plano completo →</button>
        </div>

        <div class="card">
          <b><i class="fa-solid fa-road" style="color:var(--gold-strong)"></i> Sua jornada A1 → C2</b>
          <div class="mt-2">
            ${LEVELS.map(l => {
              const c = lv[l] || { total: 0, mastered: 0, learning: 0 };
              const pct = c.total ? Math.round(((c.mastered + c.learning) / c.total) * 100) : 0;
              return `
                <div class="mt-2">
                  <div class="row spread small">
                    <span><span class="lvl-dot" data-lvl="${l}" style="display:inline-block;margin-right:6px"></span><b>${l}</b> · ${LEVEL_INFO[l].name}</span>
                    <span class="muted">${c.mastered}/${c.total}</span>
                  </div>
                  <div class="progress mt-1"><div style="width:${pct}%"></div></div>
                </div>`;
            }).join('')}
          </div>
        </div>
      </div>
    </div>`;

  $('#dash-study', section)?.addEventListener('click', () => showView('cards'));
  $('#dash-quiz', section)?.addEventListener('click', () => showView('quiz'));
  $('#dash-alpha', section)?.addEventListener('click', () => showView('alphabet'));
  $('#dash-forecast', section)?.addEventListener('click', () => showView('progress'));
  $$('[data-go]', section).forEach(b => b.addEventListener('click', () => showView(b.dataset.go)));
}
