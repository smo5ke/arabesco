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
