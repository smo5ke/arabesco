# -*- coding: utf-8 -*-
"""Arabesco — gera todos os áudios do app com edge-tts (voz neural árabe, grátis).

Gera MP3s em audio/ para: 5.000 palavras + 5.000 exemplos + 31 frases + linhas de
diálogos + 20 verbos (e conjugações) + 28 letras (+ exemplo). Idempotente:
arquivos já válidos são pulados — pode interromper e retomar.

Uso:  pip install edge-tts
      python tools/build_audio.py            (voz Zariyah, rate -10%)
      python tools/build_audio.py --voice ar-SA-HamedNeural
"""
import asyncio
import json
import sys
import zlib
from pathlib import Path

try:
    import edge_tts
except ImportError:
    print("Falta edge-tts:  pip install edge-tts")
    sys.exit(1)

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"
VOICE = "ar-SA-ZariyahNeural"
RATE = "-10%"
CONCURRENCY = 8
MIN_SIZE = 1024  # MP3 menor que isso = corrompido → refaz


def load(name):
    return json.loads((DATA / name).read_text(encoding="utf-8"))


def clip_hash(text):
    """Deterministic hash so JS can compute the same filename (zlib.crc32)."""
    return str(zlib.crc32(text.encode("utf-8")) & 0xFFFFFFFF)


def build_tasks():
    """Return list of (relative_path, text)."""
    tasks = []

    # 5.000 palavras + exemplos
    for e in load("dictionary.json"):
        wid = e["id"]
        if (e.get("word") or "").strip():
            tasks.append((f"audio/w/{wid}.mp3", e["word"].strip()))
        if (e.get("example") or "").strip():
            tasks.append((f"audio/e/{wid}.mp3", e["example"].strip()))

    # 31 frases (índice do array)
    for i, p in enumerate(load("phrases.json")):
        if (p.get("arabic") or "").strip():
            tasks.append((f"audio/p/{i}.mp3", p["arabic"].strip()))

    # linhas dos diálogos
    for d in load("dialogues.json")["dialogues"]:
        for i, line in enumerate(d["lines"]):
            if (line.get("ar") or "").strip():
                tasks.append((f"audio/d/{d['id']}-{i}.mp3", line["ar"].strip()))

    # 20 verbos: base + todas as formas conjugadas (tense → person → [ar, translit])
    def walk_forms(node):
        if isinstance(node, (list, tuple)) and node and isinstance(node[0], str):
            yield node
        elif isinstance(node, dict):
            for v in node.values():
                yield from walk_forms(v)

    verbs = load("verbs_top.json")["verbs"]
    for v in verbs:
        if (v.get("base") or "").strip():
            tasks.append((f"audio/v/{v['id']}.mp3", v["base"].strip()))
        for form in walk_forms(v.get("conjugation") or {}):
            key = (form[0] or "").strip()
            if key:
                tasks.append((f"audio/v/{v['id']}-{clip_hash(key)}.mp3", key))

    # 28 letras: nome + exemplo
    for l in load("alphabet.json")["letters"]:
        if (l.get("nameAr") or "").strip():
            tasks.append((f"audio/a/{l['id']}.mp3", l["nameAr"].strip()))
        ex = l.get("example") or {}
        if (ex.get("word") or "").strip():
            tasks.append((f"audio/x/{l['id']}.mp3", ex["word"].strip()))

    # dedup por caminho
    seen, uniq = set(), []
    for path, text in tasks:
        if path not in seen:
            seen.add(path)
            uniq.append((path, text))
    return uniq


async def gen_one(sem, path, text, voice, out_root):
    async with sem:
        dest = out_root / path
        if dest.exists() and dest.stat().st_size >= MIN_SIZE:
            return ("skip", path)
        dest.parent.mkdir(parents=True, exist_ok=True)
        for attempt in (1, 2, 3):
            try:
                tmp = dest.with_suffix(".part")
                com = edge_tts.Communicate(text, voice, rate=RATE)
                await com.save(str(tmp))
                if tmp.exists() and tmp.stat().st_size >= MIN_SIZE:
                    tmp.replace(dest)
                    return ("ok", path)
                tmp.unlink(missing_ok=True)
            except Exception as e:
                if attempt == 3:
                    return ("fail", f"{path} :: {e}")
                await asyncio.sleep(1.5 * attempt)
        return ("fail", path)


async def main():
    voice = sys.argv[sys.argv.index("--voice") + 1] if "--voice" in sys.argv else VOICE
    tasks = build_tasks()
    # clean leftovers from interrupted runs
    for p in (ROOT / "audio").rglob("*.part"):
        p.unlink(missing_ok=True)
    print(f"{len(tasks)} clipes | voz {voice} | rate {RATE} | concorrência {CONCURRENCY}", flush=True)
    sem = asyncio.Semaphore(CONCURRENCY)
    counts = {"ok": 0, "skip": 0, "fail": 0}
    fails = []

    async def run(t):
        r = await gen_one(sem, t[0], t[1], voice, ROOT)
        counts[r[0]] += 1
        if r[0] == "fail":
            fails.append(r[1])
        if (counts["ok"] + counts["skip"]) % 500 == 0:
            print(f"  … {counts['ok'] + counts['skip']}/{len(tasks)}", flush=True)

    await asyncio.gather(*(run(t) for t in tasks))
    print(f"pronto: {counts['ok']} gerados, {counts['skip']} já existiam, {counts['fail']} falhas", flush=True)
    if fails:
        (ROOT / "audio" / "_fails.txt").write_text("\n".join(fails), encoding="utf-8")
        print("falhas listadas em audio/_fails.txt")
    else:
        f = ROOT / "audio" / "_fails.txt"
        if f.exists():
            f.unlink()


if __name__ == "__main__":
    asyncio.run(main())
