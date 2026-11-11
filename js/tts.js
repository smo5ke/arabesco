/* Arabesco — Text-to-Speech (3 camadas: clipe gravado → voz do aparelho → aviso) */

let voices = [];
let ready = false;
let noVoiceWarned = false;
let currentAudio = null;    // <audio> element playing a clip
const CLIP_CACHE = 'arabesco-audio';

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

/* ── Camada 1: clipe MP3 gravado no projeto (cache p/ offline) ── */
export async function playClip(url, { onStart, onEnd, rate } = {}) {
  stopAll();
  try {
    let blob = null;
    if (typeof caches !== 'undefined') {
      const cache = await caches.open(CLIP_CACHE);
      const hit = await cache.match(url);
      if (hit) blob = await hit.blob();
      else {
        const res = await fetch(url);
        if (!res.ok) return false;
        const keep = res.clone();               // clone BEFORE reading the body
        blob = await res.blob();
        if (blob.size < 512) return false;
        caches.open(CLIP_CACHE).then(c => c.put(url, keep));
      }
    } else {
      const res = await fetch(url);
      if (!res.ok) return false;
      blob = await res.blob();
      if (blob.size < 512) return false;
    }
    const a = new Audio(URL.createObjectURL(blob));
    currentAudio = a;
    if (rate && rate > 0 && rate !== 1) a.playbackRate = rate;
    if (onStart) a.addEventListener('playing', onStart, { once: true });
    if (onEnd) a.addEventListener('ended', onEnd, { once: true });
    await a.play();
    return true;
  } catch (e) {
    currentAudio = null;
    return false;
  }
}

function noVoiceNotice() {
  if (noVoiceWarned) return;
  noVoiceWarned = true;
  import('./ui.js').then(({ toast }) => {
    toast('Sem voz árabe no aparelho — abra "Ajuda de áudio" para ativar a voz offline', { icon: 'fa-volume-xmark', ms: 6000 });
  });
}

/* ── Ajuda: guia para ativar a voz do aparelho ── */
export function openAudioHelp() {
  import('./ui.js').then(({ toast, openModal }) => {
    const content = openModal(`
      <div class="center">
        <div style="font-size:42px">🔊</div>
        <h3 style="margin:6px 0 4px">Sem som? Ative a voz árabe do aparelho</h3>
        <p class="small muted">O app toca os áudios gravados do próprio site (funciona em qualquer aparelho). Para ouvir <b>offline</b> sem internet, ative a voz do celular:</p>
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
    content.querySelector('#audio-retest')?.addEventListener('click', async () => {
      const ok = await speakArabic('مَرْحَبًا');
      toast(
        ok ? 'Funcionou! 🎧' : 'Sem áudio — siga os passos acima',
        { icon: ok ? 'fa-check' : 'fa-volume-xmark', type: ok ? 'success' : '', ms: 4500 }
      );
    });
  });
}

/* ── Orquestrador: clipe → voz do aparelho → aviso ── */
export async function speakArabic(text, rate, cb) {
  const opts = { lang: 'ar', rate: rate ?? 0.85, ...(cb || {}) };
  if (!text) return false;

  /* 1) clipe gravado (qualidade constante, funciona em qualquer aparelho) */
  try {
    const { getClipIndex } = await import('./data.js');
    const url = (await getClipIndex())[(text || '').trim()];
    if (url) {
      const ok = await playClip(url, opts);
      if (ok) return true;
    }
  } catch (e) { /* segue para a voz do aparelho */ }

  /* 2) voz do aparelho (offline) */
  const v = arabicVoice();
  playDevice(text, opts, v);
  if (v) return true;

  /* 3) nada disponível → fala às cegas (alguns motores ainda tocam) + aviso */
  noVoiceNotice();
  return false;
}

/* device voice utterance (with the mobile cancel→speak race fix) */
function playDevice(text, { lang = 'ar', rate = 0.85, onStart, onEnd } = {}, v) {
  if (!isSupported()) return null;
  const synth = window.speechSynthesis;
  const isAr = lang.startsWith('ar');

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

export function speak(text, { lang = 'ar', rate = 0.85, onStart, onEnd } = {}) {
  if (lang.startsWith('ar')) return speakArabic(text, rate, { onStart, onEnd });
  return playDevice(text, { lang, rate, onStart, onEnd }, null);
}

export function stopAll() {
  window.speechSynthesis?.cancel();
  if (currentAudio) {
    currentAudio.pause();
    currentAudio.currentTime = 0;
    currentAudio = null;
  }
}

/* preload voices (Chrome populates the list asynchronously) */
if (isSupported()) {
  refresh();
  window.speechSynthesis.addEventListener?.('voiceschanged', refresh);
  /* some Android engines are late even for voiceschanged — retry a few times */
  [300, 800, 2000].forEach(ms => setTimeout(refresh, ms));
}
