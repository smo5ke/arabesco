/* Arabesco — gamification: XP, streaks, daily missions, 30-day challenge, achievements */

import { getState, save, logToday } from './store.js';
import { toast, xpFloat, todayStr, fmtDateLong } from './ui.js';

/* ── XP ─────────────────────────────────────────────────── */
export function addXP(amount, x, y) {
  if (!amount) return;
  const st = getState();
  st.xp += amount;
  if (amount > 0) xpFloat(amount, x, y);
  save();
  updateMini();
}

/* ── Streak ─────────────────────────────────────────────── */
export function touchStreak() {
  const st = getState();
  const today = todayStr();
  if (st.lastActive === today) return;
  const y = new Date(); y.setDate(y.getDate() - 1);
  const yesterday = todayStr(y);
  if (st.lastActive === yesterday) st.streak += 1;
  else if (st.lastActive && st.lastActive !== today) st.streak = 1;
  else st.streak = Math.max(1, st.streak || 1);
  st.bestStreak = Math.max(st.bestStreak || 0, st.streak);
  st.lastActive = today;
  st.challengeDone[today] = true;
  save();
  updateMini();
}

/* ── Missions ───────────────────────────────────────────── */
export const MISSION_DEFS = [
  { key: 'newWords', icon: 'fa-plus', name: 'Palavras novas', goalFn: () => getState().dailyGoal },
  { key: 'cards', icon: 'fa-clone', name: 'Avaliar 10 cartões', goal: 10 },
  { key: 'quizzes', icon: 'fa-bolt', name: 'Completar 1 quiz', goal: 1 },
  { key: 'dialogues', icon: 'fa-comments', name: 'Treinar 1 diálogo', goal: 1 },
];

export function bumpMission(key, n = 1) {
  const st = getState();
  const today = todayStr();
  if (st.missions.date !== today) {
    st.missions = { date: today, newWords: 0, cards: 0, quizzes: 0, dialogues: 0 };
  }
  st.missions[key] = (st.missions[key] || 0) + n;
  save();
}

export function missionsDone(st = getState()) {
  const today = todayStr();
  if (st.missions.date !== today) return 0;
  return MISSION_DEFS.filter(m => {
    const goal = m.goalFn ? m.goalFn() : m.goal;
    return (st.missions[m.key] || 0) >= goal;
  }).length;
}

/* ── 30-day challenge ───────────────────────────────────── */
export function challengeDaysDone(st = getState()) {
  return Object.keys(st.challengeDone).filter(d =>
    st.challengeStart && d >= st.challengeStart).length;
}

export function startChallenge() {
  const st = getState();
  st.challengeStart = todayStr();
  st.challengeDone = {};
  st.challengeDone[todayStr()] = true;
  save();
}

export function challengeComplete(st = getState()) {
  return challengeDaysDone(st) >= 30;
}

/* ── Achievements ───────────────────────────────────────── */
export const ACHIEVEMENTS = [
  { id: 'first-word', icon: 'fa-seedling', name: 'Primeira semente', desc: 'Domine sua 1ª palavra árabe', xp: 50 },
  { id: 'ten-words', icon: 'fa-leaf', name: 'Colheita inicial', desc: 'Domine 10 palavras', xp: 100 },
  { id: 'fifty-words', icon: 'fa-tree', name: 'Pomar de palavras', desc: 'Domine 50 palavras', xp: 250 },
  { id: 'hundred-words', icon: 'fa-warehouse', name: 'Centurião', desc: 'Domine 100 palavras', xp: 500 },
  { id: 'alphabet', icon: 'fa-font', name: 'Mestre das letras', desc: 'Aprenda as 28 letras do alfabeto', xp: 150 },
  { id: 'perfect-quiz', icon: 'fa-bullseye', name: 'Mira perfeita', desc: 'Acerte 10/10 em um quiz', xp: 100 },
  { id: 'first-dialogue', icon: 'fa-comments', name: 'Primeira conversa', desc: 'Ouça um diálogo completo', xp: 80 },
  { id: 'streak-3', icon: 'fa-fire', name: 'Chama acesa', desc: '3 dias seguidos de estudo', xp: 100 },
  { id: 'streak-7', icon: 'fa-fire-flame-curved', name: 'Semana em chamas', desc: '7 dias seguidos de estudo', xp: 250 },
  { id: 'streak-30', icon: 'fa-crown', name: 'Mês de ouro', desc: '30 dias seguidos de estudo', xp: 1000 },
  { id: 'memory-win', icon: 'fa-puzzle-piece', name: 'Memória de falco', desc: 'Vença uma partida de memória', xp: 80 },
  { id: 'builder-5', icon: 'fa-pen-fancy', name: 'Arquiteto de frases', desc: 'Monte 5 frases no construtor', xp: 150 },
];

export function checkAchievements(counts, extra = {}) {
  const st = getState();
  const unlocked = [];
  const give = (id) => {
    if (st.achievements[id]) return;
    const a = ACHIEVEMENTS.find(x => x.id === id);
    if (!a) return;
    st.achievements[id] = Date.now();
    unlocked.push(a);
  };
  const m = counts?.mastered || 0;
  if (m >= 1) give('first-word');
  if (m >= 10) give('ten-words');
  if (m >= 50) give('fifty-words');
  if (m >= 100) give('hundred-words');
  if (extra.alphaDone === true) give('alphabet');
  if (extra.perfectQuiz) give('perfect-quiz');
  if ((st.stats.dialoguesPlayed || 0) >= 1) give('first-dialogue');
  if (st.streak >= 3) give('streak-3');
  if (st.streak >= 7) give('streak-7');
  if (st.streak >= 30) give('streak-30');
  if ((st.stats.gamesWon || 0) >= 1) give('memory-win');
  if ((st.bestScores.sentenceBuilder || 0) >= 5) give('builder-5');
  if (unlocked.length) {
    save();
    for (const a of unlocked) {
      st.xp += a.xp;
      toast(`Conquista: ${a.name} (+${a.xp} XP)`, { icon: a.icon, type: 'success' });
    }
    save();
    updateMini();
  }
  return unlocked;
}

/* ── Mini stats in sidebar ──────────────────────────────── */
export function updateMini() {
  const st = getState();
  const s = document.getElementById('mini-streak');
  const x = document.getElementById('mini-xp');
  if (s) s.textContent = st.streak || 0;
  if (x) x.textContent = st.xp || 0;
}

export function levelFromXP(xp) {
  const levels = [0, 100, 250, 500, 900, 1400, 2000, 2800, 3800, 5000];
  let i = 0;
  for (let k = 0; k < levels.length; k++) if (xp >= levels[k]) i = k;
  const next = levels[i + 1];
  return {
    level: i + 1,
    cur: levels[i],
    next,
    pct: next ? Math.min(100, Math.round(((xp - levels[i]) / (next - levels[i])) * 100)) : 100,
  };
}
