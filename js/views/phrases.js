/* Arabesco — Frases úteis + Diálogos situacionais */

import { getPhrases, getDialogues } from '../data.js';
import { getState, save } from '../store.js';
import { speakArabic, stopAll } from '../tts.js';
import { addXP, bumpMission, touchStreak, checkAchievements } from '../gamify.js';
import { esc, toast, $, $$ } from '../ui.js';

export async function renderPhrases(section) {
  const [phrases, dialogues] = await Promise.all([getPhrases(), getDialogues()]);
  const themes = [...new Set(phrases.map(p => p.theme))];
  let theme = themes[0];
  let openId = null;

  section.innerHTML = `
    <div class="arch">
      <div class="eyebrow">SALA DE CONVERSA</div>
      <h2>Frases &amp; Diálogos</h2>
      <div class="ar-display">مُحَادَثَات</div>
      <p class="mt-2" style="opacity:.85;font-size:14px">31 frases prontas para usar hoje + 6 diálogos completos em árabe padrão com tradução linha a linha.</p>
    </div>

    <div class="section-title"><i class="fa-solid fa-comment-dots"></i> Frases essenciais <span class="count">${phrases.length}</span></div>
    <div class="chip-row" id="ph-themes">
      ${themes.map(t => `<button class="chip ${t === theme ? 'active' : ''}" data-theme="${esc(t)}">${esc(t)}</button>`).join('')}
    </div>
    <div class="dict-list mt-2" id="ph-list"></div>

    <div class="section-title"><i class="fa-solid fa-theater-masks"></i> Diálogos reais <span class="count">${dialogues.length} cenários</span></div>
    <div class="stat-grid" id="dg-grid">
      ${dialogues.map(d => `
        <div class="stat" data-dg="${d.id}" style="cursor:pointer">
          <i class="fa-solid ${d.icon}"></i>
          <div class="num" style="font-size:17px">${esc(d.titlePt)}</div>
          <div class="lbl"><span class="ar-display">${esc(d.titleAr)}</span></div>
        </div>`).join('')}
    </div>
    <div id="dg-zone" class="mt-3"></div>
  `;

  const drawPhrases = () => {
    $('#ph-list', section).innerHTML = phrases.filter(p => p.theme === theme).map((p, i) => `
      <div class="dict-row" style="cursor:default">
        <span class="w-ar" lang="ar" style="font-size:19px;min-width:150px">${esc(p.arabic)}</span>
        <div class="w-info">
          <span class="translit small">${esc(p.translit)}</span>
          <div class="w-meaning" style="white-space:normal">${esc(p.meaning)}</div>
          ${p.note ? `<div class="small muted" style="font-size:11px">${esc(p.note)}</div>` : ''}
        </div>
        <button class="sound-btn" data-say="${esc(p.arabic)}"><i class="fa-solid fa-volume-high"></i></button>
      </div>`).join('');
    $$('#ph-list [data-say]', section).forEach(b => b.addEventListener('click', () => {
      speakArabic(b.dataset.say, getState().ttsRate);
    }));
  };

  $$('#ph-themes .chip', section).forEach(c => c.addEventListener('click', () => {
    theme = c.dataset.theme;
    $$('#ph-themes .chip', section).forEach(x => x.classList.toggle('active', x === c));
    drawPhrases();
  }));
  drawPhrases();

  const openDialogue = (id) => {
    const d = dialogues.find(x => x.id === id);
    openId = id;
    $('#dg-zone', section).innerHTML = `
      <div class="card">
        <div class="row spread wrap">
          <div>
            <div class="row" style="gap:10px">
              <i class="fa-solid ${d.icon}" style="color:var(--gold-strong);font-size:19px"></i>
              <b style="font-size:17px">${esc(d.titlePt)}</b>
              <span class="ar-display muted" style="font-size:17px">${esc(d.titleAr)}</span>
            </div>
            <p class="small muted mt-1">${esc(d.description)}</p>
          </div>
          <div class="row" style="gap:8px">
            <button class="btn sm primary" id="dg-play-all"><i class="fa-solid fa-play"></i> Reproduzir tudo</button>
            <button class="btn sm" id="dg-stop"><i class="fa-solid fa-stop"></i></button>
          </div>
        </div>
        <div class="mt-3" id="dg-lines">
          ${d.lines.map((l, i) => `
            <div class="dialog-line ${i % 2 ? 'right' : ''}">
              <div class="bubble">
                <div class="speaker">${esc(l.speaker)}</div>
                <div class="ar-text" lang="ar">${esc(l.ar)}</div>
                <span class="translit">${esc(l.translit)}</span>
                <div class="pt">${esc(l.pt)}</div>
              </div>
              <button class="sound-btn" data-line="${i}"><i class="fa-solid fa-volume-high"></i></button>
            </div>`).join('')}
        </div>
      </div>`;

    $$('#dg-lines [data-line]', section).forEach(b => b.addEventListener('click', () => {
      speakArabic(d.lines[+b.dataset.line].ar, getState().ttsRate);
    }));

    $('#dg-play-all', section)?.addEventListener('click', () => {
      stopAll();
      let i = 0;
      const playNext = () => {
        if (i >= d.lines.length) {
          const st = getState();
          st.stats.dialoguesPlayed = (st.stats.dialoguesPlayed || 0) + 1;
          save();
          addXP(10);
          bumpMission('dialogues');
          touchStreak();
          checkAchievements(null);
          toast('Diálogo completo! +10 XP', { icon: 'fa-comments', type: 'success' });
          return;
        }
        const line = d.lines[i++];
        speakArabic(line.ar, getState().ttsRate, { onEnd: () => setTimeout(playNext, 350) });
      };
      playNext();
    });
    $('#dg-stop', section)?.addEventListener('click', stopAll);
  };

  $$('#dg-grid .stat', section).forEach(s => s.addEventListener('click', () => {
    $$('#dg-grid .stat', section).forEach(x => {
      const on = x.dataset.dg === s.dataset.dg;
      x.style.borderColor = on ? 'var(--gold)' : '';
      x.style.boxShadow = on ? 'var(--gold-glow)' : '';
    });
    openDialogue(s.dataset.dg);
  }));

  if (openId) openDialogue(openId);
}
