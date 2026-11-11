/* Arabesco — Text-to-Speech (Arabic standard voice) */

let voices = [];
let ready = false;

function refresh() {
  voices = window.speechSynthesis?.getVoices?.() || [];
  ready = true;
}

export function isSupported() {
  return typeof window.speechSynthesis !== 'undefined';
}

export function arabicVoice() {
  if (!ready) refresh();
  if (!voices.length) refresh();
  return (
    voices.find(v => /^ar-SA/i.test(v.lang)) ||
    voices.find(v => /^ar/i.test(v.lang)) ||
    null
  );
}

export function speak(text, { lang = 'ar', rate = 0.85, onStart, onEnd } = {}) {
  if (!isSupported() || !text) return;
  const synth = window.speechSynthesis;
  synth.cancel();
  const u = new SpeechSynthesisUtterance(text);
  const v = lang.startsWith('ar') ? arabicVoice() : null;
  if (v) u.voice = v;
  u.lang = v?.lang || (lang === 'ar' ? 'ar-SA' : lang);
  u.rate = rate;
  u.pitch = 1;
  if (onStart) u.addEventListener('start', onStart);
  if (onEnd) u.addEventListener('end', onEnd);
  synth.speak(u);
  return u;
}

export function speakArabic(text, rate, cb) {
  return speak(text, { lang: 'ar', rate: rate ?? 0.85, ...cb });
}

export function stopAll() {
  window.speechSynthesis?.cancel();
}

/* preload voices (Chrome quirk) */
if (isSupported()) {
  refresh();
  window.speechSynthesis.addEventListener?.('voiceschanged', refresh);
}
