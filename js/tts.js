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
export function openAudioHelp() {
  import('./ui.js').then(({ toast, openModal }) => {
    const content = openModal(`
      <div class="center">
        <div style="font-size:42px">🔊</div>
        <h3 style="margin:6px 0 4px">Sem som? Ative a voz árabe do aparelho</h3>
        <p class="small muted">O áudio usa a voz instalada no próprio celular. Basta ativar uma vez:</p>
      </div>

      <div class="card mt-2" style="padding:16px 18px">
        <div style="font-size:14px;font-weight:800;margin-bottom:6px"><i class="fa-brands fa-android" style="color:var(--gold-strong)"></i> Android (Samsung e outros)</div>
        <ol class="small" style="padding-left:18px;line-height:1.9;margin:0">
          <li>Abra <b>Configurações</b> do celular</li>
          <li>Busque <b>"Conversão de texto em fala"</b> (em Gerenciamento geral)</li>
          <li>Em <b>Motor</b>, escolha <b>Speech Services by Google</b></li>
          <li>Toque na <b>engrenagem ⚙︎</b> → <b>Instalar dados de voz</b> → baixe <b>Árabe</b> (use Wi-Fi)</li>
          <li>Feche e reabra o navegador por completo</li>
        </ol>
      </div>

      <div class="card mt-2" style="padding:16px 18px">
        <div style="font-size:14px;font-weight:800;margin-bottom:6px"><i class="fa-brands fa-apple" style="color:var(--gold-strong)"></i> iPhone / iPad</div>
        <ol class="small" style="padding-left:18px;line-height:1.9;margin:0">
          <li>A voz árabe <b>(Majed)</b> já vem instalada</li>
          <li>Desligue o <b>botão de silencioso</b> lateral</li>
          <li>Aumente o volume</li>
        </ol>
      </div>

      <button class="btn primary mt-3" id="audio-retest" style="width:100%"><i class="fa-solid fa-volume-high"></i> Testar de novo</button>
      <p class="small muted mt-1 center"><i class="fa-solid fa-lightbulb"></i> Se abriu pelo Instagram/WhatsApp, use o <b>Chrome</b> ou <b>Safari</b> direto</p>
    `);
    content.querySelector('#audio-retest')?.addEventListener('click', () => {
      speakArabic('مَرْحَبًا! هَذَا صَوْتُ الْعَرَبِيَّةِ');
      if (arabicVoice()) toast('Tudo certo! Áudio ativado 🎧', { icon: 'fa-check', type: 'success' });
      else toast('Ainda sem voz árabe — siga os passos acima', { icon: 'fa-volume-xmark', ms: 4500 });
    });
  });
}

function warnNoArabicVoice() {
  if (noVoiceWarned) return;
  noVoiceWarned = true;
  openAudioHelp();
  import('./ui.js').then(({ toast }) => {
    toast('Sem voz árabe no aparelho — siga o guia na tela', { icon: 'fa-volume-xmark', ms: 5000 });
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
