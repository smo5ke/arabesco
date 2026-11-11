/* Arabesco — UI helpers: toasts, modals, XP, misc utilities */

export const LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

export const LEVEL_INFO = {
  A1: { name: 'Iniciante', share: 'Primeiros passos' },
  A2: { name: 'Básico', share: 'Dia a dia' },
  B1: { name: 'Intermediário', share: 'Conversas reais' },
  B2: { name: 'Intermediário+', share: 'Fluidez' },
  C1: { name: 'Avançado', share: 'Precisão' },
  C2: { name: 'Proficiência', share: 'Maestria' },
};

export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

export function $(sel, root = document) { return root.querySelector(sel); }
export function $$(sel, root = document) { return [...root.querySelectorAll(sel)]; }

export function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function todayStr(d = new Date()) {
  return d.toISOString().slice(0, 10);
}

export function fmtDate(ts) {
  if (!ts) return '—';
  return new Date(ts).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function fmtDateLong(ts) {
  if (!ts) return '—';
  return new Date(ts).toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' });
}

/* ── Toast ─────────────────────────────────────────────── */
export function toast(msg, { icon = 'fa-star', type = '', ms = 2600 } = {}) {
  const wrap = $('#toasts');
  if (!wrap) return;
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  t.innerHTML = `<i class="fa-solid ${icon}"></i><span>${esc(msg)}</span>`;
  wrap.appendChild(t);
  setTimeout(() => {
    t.style.transition = 'all .3s ease';
    t.style.opacity = '0';
    t.style.transform = 'translateY(8px)';
    setTimeout(() => t.remove(), 320);
  }, ms);
}

/* ── XP float ──────────────────────────────────────────── */
export function xpFloat(amount, x, y) {
  const f = document.createElement('div');
  f.className = 'xp-float';
  f.textContent = `+${amount} XP`;
  if (x == null) { x = window.innerWidth / 2; y = window.innerHeight * 0.62; }
  f.style.left = `${x}px`;
  f.style.top = `${y}px`;
  document.body.appendChild(f);
  setTimeout(() => f.remove(), 1050);
}

/* ── Modal ─────────────────────────────────────────────── */
export function openModal(html, { onClose } = {}) {
  closeModal();
  const root = $('#modal-root');
  const m = document.createElement('div');
  m.className = 'modal open';
  m.innerHTML = `
    <div class="scrim"></div>
    <div class="box">
      <button class="close-x"><i class="fa-solid fa-xmark"></i></button>
      <div class="content">${html}</div>
    </div>`;
  root.appendChild(m);
  m.querySelector('.scrim').addEventListener('click', () => closeModal(onClose));
  m.querySelector('.close-x').addEventListener('click', () => closeModal(onClose));
  return m.querySelector('.content');
}

export function closeModal(onClose) {
  $$('.modal.open').forEach(m => m.remove());
  if (typeof onClose === 'function') onClose();
}

/* ── Sound button factory ──────────────────────────────── */
export function soundBtnHTML(cls = '') {
  return `<button class="sound-btn ${cls}" data-speak aria-label="Ouvir"><i class="fa-solid fa-volume-high"></i></button>`;
}

/* ── Level chips row ───────────────────────────────────── */
export function levelChipsHTML(selected = 'all', extra = [{ val: 'all', label: 'Todos' }]) {
  const items = [...extra, ...LEVELS.map(l => ({ val: l, label: l }))];
  return items.map(i =>
    `<button class="chip ${selected === i.val ? 'active' : ''}" data-level="${i.val}">${i.label}</button>`
  ).join('');
}
