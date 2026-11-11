/* Arabesco — persistent state + SM-2 spaced repetition engine */

const PREFIX = 'arabesco_';

const DEFAULTS = {
  onboarded: false,
  dailyGoal: 10,
  motivation: 'culture',
  ttsRate: 0.85,
  showTranslit: true,
  xp: 0,
  streak: 0,
  bestStreak: 0,
  lastActive: null,
  challengeStart: null,
  challengeDone: {},
  learned: {},          // id → { s, ease, ivl, due, revs, lapses, last }
  favs: {},             // id → true
  alphaDone: {},        // letterId → true
  missions: { date: null, newWords: 0, cards: 0, quizzes: 0, dialogues: 0 },
  achievements: {},     // id → timestamp
  stats: { quizzesDone: 0, dialoguesPlayed: 0, gamesWon: 0, cardsRated: 0, perfectQuizzes: 0 },
  bestScores: {},       // game → score
  hist: {},             // dateStr → { words, cards }  (daily log)
};

let state = null;

function load() {
  try {
    const raw = JSON.parse(localStorage.getItem(PREFIX + 'state') || '{}');
    state = { ...structuredClone(DEFAULTS), ...raw };
    state.missions = { ...DEFAULTS.missions, ...(raw.missions || {}) };
    state.stats = { ...DEFAULTS.stats, ...(raw.stats || {}) };
  } catch {
    state = structuredClone(DEFAULTS);
  }
  return state;
}

export function getState() {
  if (!state) load();
  return state;
}

export function save() {
  localStorage.setItem(PREFIX + 'state', JSON.stringify(state));
}

export function resetAll() {
  localStorage.removeItem(PREFIX + 'state');
  load();
  save();
}

/* ── SRS (SM-2 adapted) ─────────────────────────────────── */
// quality: 0 = esqueci, 3 = bom, 5 = fácil
export function schedule(wordState, quality) {
  let { ease = 2.5, ivl = 0, revs = 0, lapses = 0 } = wordState || {};
  const now = Date.now();
  if (quality === 0) {
    lapses += 1;
    ease = Math.max(1.3, ease - 0.2);
    ivl = 1;
  } else {
    if (revs === 0) ivl = quality === 5 ? 3 : 1;
    else if (revs === 1) ivl = 6;
    else ivl = Math.max(1, Math.round(ivl * ease * (quality === 5 ? 1.3 : 1)));
    ease = Math.min(2.9, ease + (quality === 5 ? 0.1 : 0.015));
  }
  revs += 1;
  const s = (quality !== 0 && ivl >= 21) ? 'mastered' : 'learning';
  return { s, ease, ivl, due: now + ivl * 86400000, revs, lapses, last: now };
}

export function rateWord(id, quality) {
  const st = getState();
  const cur = st.learned[id] || {};
  st.learned[id] = schedule(cur, quality);
  save();
  return st.learned[id];
}

export function markMastered(id) {
  const st = getState();
  st.learned[id] = {
    s: 'mastered', ease: 2.5, ivl: 30,
    due: Date.now() + 30 * 86400000, revs: Math.max(1, st.learned[id]?.revs || 0),
    lapses: st.learned[id]?.lapses || 0, last: Date.now(),
  };
  save();
}

export function unmark(id) {
  const st = getState();
  delete st.learned[id];
  save();
}

export function toggleFav(id) {
  const st = getState();
  if (st.favs[id]) delete st.favs[id];
  else st.favs[id] = true;
  save();
  return !!st.favs[id];
}

export function toggleAlpha(letterId) {
  const st = getState();
  if (st.alphaDone[letterId]) delete st.alphaDone[letterId];
  else st.alphaDone[letterId] = true;
  save();
  return !!st.alphaDone[letterId];
}

/* ── Counters ───────────────────────────────────────────── */
export function countsOf(dict) {
  const st = getState();
  let mastered = 0, learning = 0, due = 0;
  const now = Date.now();
  for (const e of dict) {
    const w = st.learned[e.id];
    if (!w) continue;
    if (w.s === 'mastered') mastered++;
    else {
      learning++;
      if (w.due <= now) due++;
    }
  }
  for (const id in st.learned) {
    const w = st.learned[id];
    if (w && w.s !== 'mastered' && w.due <= now) {
      // count even if word not in dict (defensive)
    }
  }
  return { mastered, learning, due, total: dict.length, remaining: dict.length - mastered - learning };
}

export function levelCounts(dict) {
  const st = getState();
  const by = {};
  for (const e of dict) {
    by[e.level] = by[e.level] || { total: 0, mastered: 0, learning: 0 };
    by[e.level].total++;
    const w = st.learned[e.id];
    if (w?.s === 'mastered') by[e.level].mastered++;
    else if (w) by[e.level].learning++;
  }
  return by;
}

/* ── Daily log (for pace / forecast) ────────────────────── */
export function logToday(field, n = 1) {
  const st = getState();
  const d = new Date().toISOString().slice(0, 10);
  st.hist[d] = st.hist[d] || { words: 0, cards: 0 };
  st.hist[d][field] = (st.hist[d][field] || 0) + n;
  save();
}

export function pacePerDay(st = getState()) {
  const days = Object.keys(st.hist)
    .filter(d => (st.hist[d].words || 0) > 0)
    .sort();
  if (!days.length) return null;
  const totalWords = days.reduce((s, d) => s + (st.hist[d].words || 0), 0);
  const span = Math.max(1, daysBetween(days[0], days[days.length - 1]) + 1);
  return { perDay: totalWords / span, activeDays: days.length, totalWords };
}

function daysBetween(a, b) {
  return Math.round((new Date(b) - new Date(a)) / 86400000);
}
