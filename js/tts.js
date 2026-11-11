/* Arabesco — Text-to-Speech (Arabic standard voice) */

let voices = [];
let ready = false;
let noVoiceWarned = false;

function refresh() {
  voices = window.speechSynthesis?.getVoices?.() || [];
  ready = true;
}

export function isSupported() {
  return typeof window.speechSynthesis !== 'undefined';
}

/* Best available Arabic voice: ar-SA first, then any Arabic. */
export function arabicVoice() {
  if (!ready || !voices.length) refresh();
  return (
    voices.find(v => /^ar[-_]SA/i.test(v.lang)) ||
    voices.find(v => /^ar[-_]EG/i.test(v.lang)) ||
    voices.find(v => /^ar/i.test(v.lang)) ||
    null
  );
}

/* Explain silence when the device has no Arabic TTS voice installed. */
function warnNoArabicVoice() {
  if (noVoiceWarned) return;
  noVoiceWarned = true;
  import('./ui.js').then(({ toast }) => {
    toast(
      'Aparelho sem voz árabe — no Android, instale/ative o "Google Serviços de fala" e baixe o idioma Árabe; no iPhone verifique o botão de silencioso',
      { icon: 'fa-volume-xmark', ms: 8000 }
    );
  });
}

export function speak(text, { lang = 'ar', rate = 0.85, onStart, onEnd } = {}) {
  if (!isSupported() || !text) return null;
  const synth = window.speechSynthesis;
  const isAr = lang.startsWith('ar');
  const v = isAr ? arabicVoice() : null;
  if (isAr && !v) warnNoArabicVoice();

  const u = new SpeechSynthesisUtterance(text);
  if (v) u.voice = v;
  u.lang = v?.lang || (isAr ? 'ar-SA' : lang);
  u.rate = rate;
  u.pitch = 1;
  u.addEventListener('error', ev => {
    // our own cancel() triggers 'interrupted'/'canceled' — those are fine
    if (ev.error && ev.error !== 'interrupted' && ev.error !== 'canceled') {
      console.warn('[tts] erro no áudio:', ev.error);
    }
  });
  if (onStart) u.addEventListener('start', onStart);
  if (onEnd) u.addEventListener('end', onEnd);

  /* Chrome/Safari mobile bug: calling cancel() and speak() back-to-back in the
     same gesture can swallow the utterance entirely. Cancel only when needed,
     then speak after a tiny gap so the engine has released the queue. */
  if (synth.speaking || synth.pending) {
    synth.cancel();
    setTimeout(() => synth.speak(u), 50);
  } else {
    synth.speak(u);
  }
  return u;
}

export function speakArabic(text, rate, cb) {
  return speak(text, { lang: 'ar', rate: rate ?? 0.85, ...cb });
}

export function stopAll() {
  window.speechSynthesis?.cancel();
}

/* preload voices (Chrome populates the list asynchronously) */
if (isSupported()) {
  refresh();
  window.speechSynthesis.addEventListener?.('voiceschanged', refresh);
  /* some Android engines are late even for voiceschanged — retry a few times */
  [300, 800, 2000].forEach(ms => setTimeout(refresh, ms));
}
