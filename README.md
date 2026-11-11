# Arabesco 🌙 — Aprenda Árabe | الأَرَبِسْكُو

**منصة تعليمية متكاملة لتعلّم اللغة العربية الفصحى للناطقين بالبرتغالية (البرازيل)**
Uma plataforma completa para brasileiros aprenderem árabe padrão (fushā) — com 5.000 palavras, flashcards inteligentes, academia de letras, verbos, diálogos e jogos.

<p>
  <b>Vanilla JS · PWA · 100% offline · sem build step</b>
</p>

---

## ✨ Funcionalidades | المميزات

| Módulo | الوصف بالعربية |
|---|---|
| **🏠 Início (Dashboard)** | لوحة القيادة: هدف يومي، سلسلة الأيام، مهام، وخطة الطلاقة |
| **🃏 Cartões Inteligentes** | بطاقات عكسية ثلاثية الأبعاد مع نظام التكرار المتباعد (خوارزمية SM-2 مثل Anki) لـ 5,000 كلمة |
| **🔤 Alfabeto (Academia)** | أكاديمية الحروف: 28 حرفاً بأشكاله الأربعة + الحركات + درس الشمسية والقمارية + اختبار — *ميزة لا يملكها أي منتج مشابه* |
| **⚡ Quiz Arena** | ثلاثة أنماط: قراءة، إصغاء (TTS)، وكتابة — مع مستويات A1→C2 |
| **📚 Dicionário** | قاموس كامل 5,000 مدخل مع بحث فوري، أمثلة مترجمة، ومفضلات |
| **🧮 Verbos** | أهم 20 فعلاً بصرف كامل (ماضٍ/مضارع/أمر) + مرجع 1,229 جذر |
| **💬 Frases & Diálogos** | 31 عبارة عملية + 6 حوارات موقفية بالصوت والترجمة سطراً بسطر |
| **🎮 Jogos** | لعبة الذاكرة + ترتيب الجمل بالترتيب العربي |
| **📈 Progresso** | إحصائيات، توقع تاريخ الوصول للطلاقة، 12 إنجازاً، وتحدٍّ لـ 30 يوماً |

**النطق الصوتي** يعمل عبر محرك TTS داخل المتصفح بصوت الفصحى `ar-SA` — لا حاجة لأي ملفات صوتية.

---

## 🚀 Como rodar localmente | التشغيل محلياً

1. Instale [Python](https://python.org) (ou use `py`).
2. Dê duplo clique em **`serve.bat`** — abre `http://localhost:8080` automaticamente.

> ⚠️ Não abra o `index.html` direto do disco (duplo clique): o navegador bloqueia o carregamento dos dados JSON.
> Use sempre o `serve.bat` (que agora também desativa cache — suas edições aparecem na hora).

طريقة سريعة بالعربية: شغّل ملف `serve.bat` ثم افتح `http://localhost:8080` — يفضّل عدم فتح `index.html` مباشرة من القرص.

---

## 🌐 Publicar no GitHub Pages | النشر على GitHub Pages

1. Crie um repositório novo no GitHub (ex.: `arabesco`), **público**.
2. Na pasta do projeto:

```bash
git init
git add .
git commit -m "Arabesco v1.0"
git branch -M main
git remote add origin https://github.com/SEU-USUARIO/arabesco.git
git push -u origin main
```

3. No GitHub: **Settings → Pages → Source: `main` / root** → Save.
4. Em ~1 minuto o site fica no ar em `https://SEU-USUARIO.github.io/arabesco/`.

- ✅ Funciona como PWA: o visitante pode "Instalar app" no celular e usar **offline** (service worker já incluído).
- 🔒 Dica: como o app é 100% estático, nenhum dado pessoal sai do dispositivo (tudo fica no `localStorage`).

---

## 📁 Estrutura do projeto | هيكل المشروع

```
Arabesco/
├── index.html              ← الهيكل الرئيسي (9 شاشات)
├── manifest.json           ← PWA manifest
├── sw.js                   ← Service worker (offline)
├── serve.bat               ← خادم محلي بنقرة واحدة
├── css/
│   └── design-system.css   ← نظام التصميم "Oasis Moderno" (زمردي + ذهبي)
├── js/
│   ├── app.js              ← الإقلاع + التوجيه + الوضع الليلي
│   ├── store.js            ← الحالة + خوارزمية SM-2 للتكرار المتباعد
│   ├── data.js             ← طبقة البيانات
│   ├── tts.js              ← النطق العربي (Web Speech API)
│   ├── gamify.js           ← XP، سلسلة الأيام، الإنجازات
│   ├── ui.js               ← أدوات واجهة مشتركة
│   └── views/              ← 9 وحدات للشاشات
├── data/                   ← JSON مولّد من الإكسل
│   ├── dictionary.json     ← 5,000 مدخل
│   ├── alphabet.json       ← 28 حرفاً + دروس
│   ├── verbs.json          ← 1,229 جذر
│   ├── verbs_top.json      ← 20 فعلاً مصروفاً بالكامل
│   ├── phrases.json        ← 31 عبارة
│   └── dialogues.json      ← 6 حوارات
├── icons/                  ← أيقونات PWA (192/512)
└── tools/
    ├── build_dictionary.py ← خط البيانات: Excel → JSON
    └── dev_server.py       ← خادم تطوير بدون كاش
```

---

## 🗂️ Fonte dos dados | مصدر البيانات

- **قاموس**: `Dicionario_Arabe_para_Brasileiros_5000.xlsx` (5,000 مدخل: كلمة عربية، نطق لاتيني، معنى برتغالي، مثال، مستوى).
- **النطق اللاتيني** أُعيد بناؤه بمحرك تصحيح (v2) في `tools/build_dictionary.py` — النطق **تقريبي (aproximado)** والنطق الحقيقي متاح بزر الصوت 🔊.
- **الحروف والحوارات والأفعال المصرَّفة**: مُعَدّة يدوياً بدقة.
- مستويات CEFR موزعة: A1=500 · A2=800 · B1=1.000 · B2=1.100 · C1=900 · C2=700.

---

## 🛠️ Tecnologia | التقنية

- Vanilla JavaScript (ES Modules) — **sem frameworks, sem build, sem dependências**.
- PWA instalável com `service worker` (cache-first para assets).
- Storage: `localStorage` (الوضع الليلي، الحالة، التقدم).
- أيقونات Font Awesome + خطوط **Amiri / Noto Naskh Arabic / Outfit**.

---

<div dir="rtl">

صُنع بحب للمتحدثين بالبرتغالية الذين يعشقون العربية 🌙✨
**تقدَّم بثبات: 10 كلمات يومياً = طلاقة في أقل من عامين.**

</div>
