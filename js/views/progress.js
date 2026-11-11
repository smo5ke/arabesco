/* Arabesco — Progresso: estatísticas, plano de fluência, desafio 30 dias, conquistas, ajustes */

import { getDictionary } from '../data.js';
import { getState, save, countsOf, levelCounts, pacePerDay, resetAll } from '../store.js';
import { isSupported } from '../tts.js';
import { startChallenge, challengeDaysDone, ACHIEVEMENTS, levelFromXP } from '../gamify.js';
import { esc, toast, fmtDateLong, LEVELS, LEVEL_INFO, $, $$ } from '../ui.js';

export async function renderProgress(section) {
  const dict = await getDictionary();
  const st = getState();
  const c = countsOf(dict);
  const lv = levelCounts(dict);
  const pace = pacePerDay();
  const xpL = levelFromXP(st.xp);
  const challengeOn = !!st.challengeStart;
  const daysDone = challengeDaysDone();

  /* forecast per level */
  const perDay = pace?.perDay || st.dailyGoal;
  let acc = 0;
  const roadmap = LEVELS.map(l => {
    const remain = lv[l].total - lv[l].mastered;
    const days = Math.ceil(remain / Math.max(0.2, perDay));
    const d = new Date(); d.setDate(d.getDate() + days + acc);
    acc += days;
    return { l, ...lv[l], remain, days, date: d };
  });

  const totalDays = Math.ceil(c.remaining / Math.max(0.2, perDay));
  const endDate = new Date(); endDate.setDate(endDate.getDate() + totalDays);

  section.innerHTML = `
    <div class="arch">
      <div class="eyebrow">SALA DOS MAPAS</div>
      <h2>Seu Progresso</h2>
      <div class="ar-display">تَقَدُّمُكَ</div>
      <p class="mt-2" style="opacity:.85;font-size:14px">Nível de jogador <b>${xpL.level}</b> · ${st.xp} XP ${xpL.next ? `· faltam ${xpL.next - st.xp} XP para o nível ${xpL.level + 1}` : '· nível máximo!'}</p>
      <div class="progress gold mt-3" style="max-width:340px"><div style="width:${xpL.pct}%"></div></div>
    </div>

    <div class="stat-grid mt-3">
      <div class="stat"><i class="fa-solid fa-check-double"></i><div class="num">${c.mastered}</div><div class="lbl">dominadas</div></div>
      <div class="stat"><i class="fa-solid fa-seedling"></i><div class="num">${c.learning}</div><div class="lbl">aprendendo</div></div>
      <div class="stat"><i class="fa-solid fa-fire"></i><div class="num">${st.streak || 0}</div><div class="lbl">dias seguidos (recorde ${st.bestStreak || 0})</div></div>
      <div class="stat"><i class="fa-solid fa-bolt"></i><div class="num">${st.xp}</div><div class="lbl">XP total</div></div>
      <div class="stat"><i class="fa-solid fa-bullseye"></i><div class="num">${st.stats.quizzesDone || 0}</div><div class="lbl">quizzes</div></div>
      <div class="stat"><i class="fa-solid fa-comments"></i><div class="num">${st.stats.dialoguesPlayed || 0}</div><div class="lbl">diálogos</div></div>
      <div class="stat"><i class="fa-solid fa-puzzle-piece"></i><div class="num">${st.stats.gamesWon || 0}</div><div class="lbl">jogos vencidos</div></div>
      <div class="stat"><i class="fa-solid fa-clone"></i><div class="num">${st.stats.cardsRated || 0}</div><div class="lbl">cartões avaliados</div></div>
    </div>

    <div class="section-title"><i class="fa-solid fa-wand-magic-sparkles"></i> Previsão de fluência</div>
    <div class="card">
      <div class="row wrap" style="gap:22px">
        <div>
          <div class="small muted">No seu ritmo de ${perDay.toFixed(1)} palavras/dia</div>
          <div style="font-size:26px;font-weight:800;color:var(--primary)" id="fc-date">${endDate.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' })}</div>
          <div class="small muted">${totalDays} dias restantes para as 5.000 palavras</div>
        </div>
        <div style="flex:1;min-width:240px">
          <div class="progress mt-2"><div style="width:${Math.round(((c.mastered + c.learning) / c.total) * 100)}%"></div></div>
          <div class="small muted mt-1">Cobertura atual: ${Math.round(((c.mastered + c.learning) / c.total) * 100)}% do dicionário — ${Math.round(((c.mastered + c.learning) / c.total) * 100)}% de entendimento aproximado em textos cotidianos.</div>
        </div>
      </div>
      <div class="mt-3">
        ${roadmap.map(r => `
          <div class="mt-2">
            <div class="row spread small">
              <span><span class="lvl-dot" data-lvl="${r.l}" style="display:inline-block;margin-right:6px"></span><b>${r.l}</b> · ${LEVEL_INFO[r.l].name} <span class="muted">(${r.remain} restantes)</span></span>
              <span class="muted">≈ ${r.date.toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' })}</span>
            </div>
            <div class="progress mt-1"><div style="width:${r.total ? Math.round(((r.mastered + r.learning) / r.total) * 100) : 0}%"></div></div>
          </div>`).join('')}
      </div>
    </div>

    <div class="section-title"><i class="fa-solid fa-calendar-days"></i> Desafio dos 30 dias</div>
    <div class="card">
      ${challengeOn ? `
        <div class="row spread wrap mb-2">
          <div><b>${daysDone}/30 dias completos</b> <span class="small muted">· começou em ${fmtDateLong(new Date(st.challengeStart).getTime())}</span></div>
          <button class="btn sm danger" id="ch-reset"><i class="fa-solid fa-rotate-left"></i> Reiniciar desafio</button>
        </div>
        <div class="ch-grid">
          ${Array.from({ length: 30 }, (_, i) => i + 1).map(d => {
            const done = d <= daysDone;
            const today = d === daysDone + 1;
            return `<div class="ch-day ${done ? 'done' : ''} ${today ? 'today' : ''}">${d}</div>`;
          }).join('')}
        </div>` : `
        <div class="center" style="padding:10px">
          <div style="font-size:40px">🗓️</div>
          <p class="muted small mt-1">Estude pelo menos 1 palavra por dia durante 30 dias. Cada dia doado à disciplina vale XP.</p>
          <button class="btn gold mt-2" id="ch-start"><i class="fa-solid fa-flag-checkered"></i> Aceitar o desafio</button>
        </div>`}
    </div>

    <div class="section-title"><i class="fa-solid fa-trophy"></i> Conquistas</div>
    <div class="stat-grid">
      ${ACHIEVEMENTS.map(a => {
        const on = !!st.achievements[a.id];
        return `
          <div class="stat" style="${on ? 'border-color:var(--gold)' : 'opacity:.55'}">
            <i class="fa-solid ${a.icon}" style="${on ? '' : 'filter:grayscale(1);opacity:.5'}"></i>
            <div class="num" style="font-size:15px">${esc(a.name)}</div>
            <div class="lbl">${esc(a.desc)} · +${a.xp} XP</div>
          </div>`;
      }).join('')}
    </div>

    <div class="section-title"><i class="fa-solid fa-gear"></i> Ajustes</div>
    <div class="card">
      <div class="row spread wrap" style="border-bottom:1px dashed var(--line);padding:10px 0">
        <div><b>Meta diária</b><div class="small muted">palavras novas por dia</div></div>
        <select class="select" id="set-goal" style="width:auto">
          ${[5, 10, 15, 20, 30].map(n => `<option value="${n}" ${st.dailyGoal === n ? 'selected' : ''}>${n} palavras</option>`).join('')}
        </select>
      </div>
      <div class="row spread wrap" style="border-bottom:1px dashed var(--line);padding:10px 0">
        <div><b>Transliteração</b><div class="small muted">mostrar a leitura em letras latinas</div></div>
        <input type="checkbox" id="set-translit" ${st.showTranslit !== false ? 'checked' : ''} style="width:20px;height:20px;accent-color:var(--primary)">
      </div>
      <div class="row spread wrap" style="border-bottom:1px dashed var(--line);padding:10px 0">
        <div><b>Velocidade da voz ${isSupported() ? '' : '<span class="badge gold">sem suporte neste navegador</span>'}</b><div class="small muted">0.6 lenta · 1.0 normal</div></div>
        <input type="range" id="set-rate" min="0.6" max="1.2" step="0.05" value="${st.ttsRate}" style="width:160px;accent-color:var(--primary)">
      </div>
      <div class="row spread wrap" style="padding:10px 0">
        <div><b>Zona de perigo</b><div class="small muted">apaga todo o progresso local</div></div>
        <button class="btn danger sm" id="set-reset"><i class="fa-solid fa-trash"></i> Zerar tudo</button>
      </div>
    </div>
  `;

  $('#ch-start', section)?.addEventListener('click', () => {
    startChallenge();
    toast('Desafio aceito! Dia 1 começa agora 🔥', { icon: 'fa-flag-checkered', type: 'success' });
    renderProgress(section);
  });
  $('#ch-reset', section)?.addEventListener('click', () => {
    st.challengeStart = null; st.challengeDone = {}; save();
    renderProgress(section);
  });
  $('#set-goal', section)?.addEventListener('change', ev => {
    st.dailyGoal = +ev.target.value; save();
    toast(`Meta atualizada: ${st.dailyGoal} palavras/dia`, { icon: 'fa-bullseye' });
  });
  $('#set-translit', section)?.addEventListener('change', ev => {
    st.showTranslit = ev.target.checked; save();
  });
  $('#set-rate', section)?.addEventListener('input', ev => {
    st.ttsRate = +ev.target.value; save();
  });
  $('#set-reset', section)?.addEventListener('click', () => {
    if (confirm('Isso apaga TODO o seu progresso (palavras, XP, sequência). Tem certeza?')) {
      resetAll();
      location.reload();
    }
  });
}
