/* Arabesco — data layer (fetch JSON assets with cache) */

const cache = {};

async function getJSON(path) {
  if (cache[path]) return cache[path];
  const res = await fetch(path);
  if (!res.ok) throw new Error(`Falha ao carregar ${path} (${res.status})`);
  cache[path] = await res.json();
  return cache[path];
}

export const getDictionary = () => getJSON('data/dictionary.json');
export const getPhrases = () => getJSON('data/phrases.json');
export const getDialogues = async () => (await getJSON('data/dialogues.json')).dialogues ?? [];
export const getAlphabet = () => getJSON('data/alphabet.json');
export const getTopVerbs = () => getJSON('data/verbs_top.json');
export const getVerbs = () => getJSON('data/verbs.json');

/* ── فهرس الصوت: نص عربي → مسار الملف المسجّل ─────────────────────
   نفس خوارزمية crc32 في tools/build_audio.py لتسمية تصريفات الأفعال */
function crc32(str) {
  if (!crc32.table) {
    crc32.table = new Uint32Array(256);
    for (let i = 0; i < 256; i++) {
      let c = i;
      for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
      crc32.table[i] = c >>> 0;
    }
  }
  const t = crc32.table;
  const bytes = new TextEncoder().encode(str);
  let crc = -1;
  for (let i = 0; i < bytes.length; i++) crc = (crc >>> 8) ^ t[(crc ^ bytes[i]) & 0xFF];
  return ((crc ^ (-1)) >>> 0).toString();
}

/* conjugation shape: tense → person → [arabic, translit] (walk recursively) */
function* walkForms(node) {
  if (Array.isArray(node) && node.length && typeof node[0] === 'string') yield node;
  else if (node && typeof node === 'object') for (const v of Object.values(node)) yield* walkForms(v);
}

let clipIndexPromise = null;

export function getClipIndex() {
  if (!clipIndexPromise) {
    clipIndexPromise = (async () => {
      const idx = {};
      const add = (text, url) => {
        text = (text || '').trim();
        if (text && !idx[text]) idx[text] = url;
      };
      (await getDictionary()).forEach(e => {
        add(e.word, `audio/w/${e.id}.mp3`);
        add(e.example, `audio/e/${e.id}.mp3`);
      });
      (await getPhrases()).forEach((p, i) => add(p.arabic, `audio/p/${i}.mp3`));
      (await getDialogues()).forEach(d => d.lines.forEach((l, i) => add(l.ar, `audio/d/${d.id}-${i}.mp3`)));
      (await getTopVerbs()).verbs.forEach(v => {
        add(v.base, `audio/v/${v.id}.mp3`);
        for (const f of walkForms(v.conjugation || {})) {
          const key = (f[0] || '').trim();
          if (key && /[\u0600-\u06FF]/.test(key)) add(key, `audio/v/${v.id}-${crc32(key)}.mp3`);
        }
      });
      (await getAlphabet()).letters.forEach(l => {
        add(l.nameAr, `audio/a/${l.id}.mp3`);
        add((l.example || {}).word, `audio/x/${l.id}.mp3`);
      });
      return idx;
    })();
  }
  return clipIndexPromise;
}
