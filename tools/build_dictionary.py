# -*- coding: utf-8 -*-
"""
Arabesco — Data pipeline
Builds data/*.json from Dicionario_Arabe_para_Brasileiros_5000.xlsx
- dictionary.json : 5.000 entradas (word, translit, meaning PT-BR, example, level...)
- phrases.json    : from "Frases úteis" sheet
- verbs.json      : top verb bases extracted from the dictionary
Run:  python build_dictionary.py
"""
import json, re
from pathlib import Path
from collections import Counter
import openpyxl

ROOT = Path(__file__).resolve().parent.parent
XLSX = Path(__file__).resolve().parent / "Dicionario_Arabe_para_Brasileiros_5000.xlsx"

# ════════════════════════════════════════════════════════════════
#  ARABIC → LATIN TRANSLITERATION ENGINE (v2)
# ════════════════════════════════════════════════════════════════
VOWELS = {'\u064E': 'a', '\u0650': 'i', '\u064F': 'u'}          # fatha kasra damma
TANWIN = {'\u064B': 'an', '\u064C': 'un', '\u064D': 'in'}
STRIP = set(VOWELS) | set(TANWIN) | {'\u0651', '\u0652', '\u0640', '\u0670'}

# consonant map (hamza carriers vowel-less; long vowels marked)
C = {
    'ب': 'b', 'ت': 't', 'ث': 'th', 'ج': 'j', 'ح': 'ḥ', 'خ': 'kh',
    'د': 'd', 'ذ': 'dh', 'ر': 'r', 'ز': 'z', 'س': 's', 'ش': 'sh',
    'ص': 'ṣ', 'ض': 'ḍ', 'ط': 'ṭ', 'ظ': 'ẓ', 'ع': 'ʿ', 'غ': 'gh',
    'ف': 'f', 'ق': 'q', 'ك': 'k', 'ل': 'l', 'م': 'm', 'ن': 'n',
    'ه': 'h', 'ة': 'h', 'ء': 'ʾ', 'أ': 'ʾ', 'إ': 'ʾ', 'ؤ': 'ʾ', 'ئ': 'ʾ',
}
LONG = {'ا': 'ā', 'ى': 'ā', 'آ': 'ā', 'ٱ': 'ā'}
SEMI = {'و': 'w', 'ي': 'y'}
SUN = set('تثدذرزسشصضطظلن')

LEX = {
    # function words
    'ال': 'al-', 'الـ': 'al-', 'في': 'fī', 'من': 'min', 'على': 'ʿalā', 'إلى': 'ilā',
    'عن': 'ʿan', 'مع': 'maʿa', 'هذا': 'hādhā', 'هذه': 'hādhihi', 'هذان': 'hādhāni',
    'ذلك': 'dhālika', 'تلك': 'tilka', 'الذي': 'alladhī', 'التي': 'allatī',
    'الذين': 'alladhīna', 'اللائي': 'allātī', 'هو': 'huwa', 'هي': 'hiya',
    'هم': 'hum', 'هن': 'hunna', 'أنا': 'anā', 'أنت': 'anta', 'أنتِ': 'anti',
    'أنتم': 'antum', 'أنتن': 'antunna', 'نحن': 'naḥnu', 'أن': 'anna', 'أنَّ': 'anna',
    'إن': 'inna', 'إنَّ': 'inna', 'لا': 'lā', 'ما': 'mā', 'لم': 'lam', 'لن': 'lan',
    'هل': 'hal', 'قد': 'qad', 'لقد': 'laqad', 'كان': 'kāna', 'كانت': 'kānat',
    'يكون': 'yakūnu', 'تكون': 'takūnu', 'سيكون': 'sayakūnu', 'ليس': 'laysa',
    'ليست': 'laysat', 'كل': 'kull', 'بعض': 'baʿḍ', 'أي': 'ayy', 'حتى': 'ḥattā',
    'لكن': 'lākin', 'لكنَّ': 'lākinna', 'أو': 'aw', 'إذا': 'idhā', 'عندما': 'ʿindamā',
    'ثم': 'thumma', 'أيضا': 'ayḍan', 'أيضاً': 'ayḍan', 'فقط': 'faqaṭ',
    'جدا': 'jiddan', 'جداً': 'jiddan', 'كما': 'kamā', 'بين': 'bayna',
    'حول': 'ḥawla', 'قبل': 'qabla', 'بعد': 'baʿda', 'خلال': 'khilāla',
    'عند': 'ʿinda', 'لدى': 'ladā', 'منذ': 'mundh', 'دون': 'dūna',
    'بدون': 'bidūni', 'ضمن': 'ḍimna', 'وراء': 'warāʾa', 'أمام': 'amāma',
    'تحت': 'taḥta', 'فوق': 'fawqa', 'هناك': 'hunāka', 'هنا': 'hunā',
    'كذلك': 'kadhālika', 'هؤلاء': 'hāʾulāʾ', 'أولئك': 'ulāʾika',
    'لدي': 'ladayya', 'لدينا': 'ladaynā', 'لديهم': 'ladayhim', 'لديها': 'ladayhā',
    'عندنا': 'ʿindanā', 'عنده': 'ʿindahu', 'عندها': 'ʿindahā', 'عندهم': 'ʿindahum',
    'لديك': 'ladayka', 'له': 'lahu', 'لها': 'lahā', 'لهم': 'lahum',
    'به': 'bihi', 'بها': 'bihā', 'منه': 'minhu', 'منها': 'minhā',
    'فيه': 'fīhi', 'فيها': 'fīhā', 'عليه': 'ʿalayhi', 'عليها': 'ʿalayhā',
    'كثير': 'kathīr', 'كثيرة': 'kathīra', 'الكثير': 'al-kathīr',
    'قليل': 'qalīl', 'شيء': 'shayʾ', 'شيئا': 'shayʾan', 'أيضا': 'ayḍan',
    'ولا': 'wa-lā', 'ولكن': 'wa-lākin', 'وهو': 'wa-huwa', 'وهي': 'wa-hiya',
    'وكل': 'wa-kull', 'وأيضا': 'wa-ayḍan', 'فهل': 'fa-hal', 'فما': 'fa-mā',
    'ومن': 'wa-man', 'وفي': 'wa-fī', 'ومن': 'wa-min', 'وعلى': 'wa-ʿalā',
    'إذن': 'idhan', 'لماذا': 'limādhā', 'كيف': 'kayfa', 'أين': 'ayna',
    'متى': 'matā', 'كم': 'kam', 'من': 'man', 'ماذا': 'mādhā',
    'نفس': 'nafs', 'غير': 'ghayr', 'سوف': 'sawfa', 'يجب': 'yajibu',
    'يمكن': 'yumkinu', 'يوجد': 'yūjadu', 'توجد': 'tūjadu',
    'استطاع': 'istaṭāʿa', 'يستطيع': 'yastaṭīʿu', 'تستطيع': 'tastaṭīʿu',
    'نستطيع': 'naṣtaṭīʿu', 'حسب': 'ḥasaba', 'مثل': 'mithla', 'بمثابة': 'bi-mathābati',
    'خصوصا': 'khuṣūṣan', 'خصوصاً': 'khuṣūṣan', 'طبعا': 'ṭabʿan',
    'طبعاً': 'ṭabʿan', 'أكيد': 'akīd', 'تماما': 'tamāman', 'تماماً': 'tamāman',
    # time / numbers
    'اليوم': 'al-yawm', 'غدا': 'ghadan', 'غداً': 'ghadan', 'أمس': 'amsi',
    'سنة': 'sana', 'سنوات': 'sanawāt', 'شهر': 'shahr', 'أشهر': 'ashhur',
    'أسبوع': 'usbūʿ', 'أسبوعا': 'usbūʿan', 'يوم': 'yawm', 'أيام': 'ayyām',
    'ساعة': 'sāʿa', 'ساعات': 'sāʿāt', 'دقيقة': 'daqīqa', 'وقت': 'waqt',
    'اثنان': 'ithnāni', 'ثلاثة': 'thalātha', 'أربعة': 'arbaʿa', 'خمسة': 'khamsa',
    'ستة': 'sitta', 'سبعة': 'sabʿa', 'ثمانية': 'thamāniya', 'تسعة': 'tisʿa',
    'عشرة': 'ʿashara', 'مئة': 'miʾa', 'مائة': 'miʾa', 'ألف': 'alf',
    'أولا': 'awwalan', 'أولاً': 'awwalan', 'أخيرا': 'akhīran', 'أخيراً': 'akhīran',
    'أحيانا': 'aḥyānan', 'أحياناً': 'aḥyānan', 'عشرين': 'ʿishrīna',
    # verbs (unvocalized common forms)
    'كتب': 'kataba', 'يكتب': 'yaktubu', 'قرأ': 'qaraʾa', 'يقرأ': 'yaqraʾu',
    'درس': 'darasa', 'يدرس': 'yadrusu', 'عمل': 'ʿamila', 'يعمل': 'yaʿmalu',
    'أكل': 'akala', 'يأكل': 'yaʾkulu', 'شرب': 'shariba', 'يشرب': 'yashrabu',
    'ذهب': 'dhahaba', 'يذهب': 'yadhhabu', 'جاء': 'jāʾa', 'يأتي': 'yaʾtī',
    'رأى': 'raʾā', 'يرى': 'yarā', 'قال': 'qāla', 'يقول': 'yaqūlu',
    'سمع': 'samiʿa', 'يسمع': 'yasmaʿu', 'عرف': 'ʿarafa', 'يعرف': 'yaʿrifu',
    'فهم': 'fahima', 'يفهم': 'yafhamu', 'أخذ': 'akhadha', 'يأخذ': 'yaʾkhudhu',
    'أعطى': 'aʿṭā', 'يعطي': 'yuʿṭī', 'أراد': 'arāda', 'يريد': 'yurīdu',
    'شعر': 'shaʿara', 'وجد': 'wajada', 'يجد': 'yajidu', 'دخل': 'dakhala',
    'يدخل': 'yadkhulu', 'خرج': 'kharaja', 'يخرج': 'yakhruju', 'عاد': 'ʿāda',
    'يعود': 'yaʿūdu', 'سأل': 'saʾala', 'يسأل': 'yasʾalu', 'أجاب': 'ajāba',
    'انتظر': 'intaẓara', 'ينتظر': 'yantaẓiru', 'بحث': 'baḥatha',
    'يبحث': 'yabḥathu', 'شرح': 'sharaḥa', 'يشرح': 'yashraḥu',
    'ساعد': 'sāʿada', 'يساعد': 'yusāʿidu', 'بدأ': 'badaʾa', 'يبدأ': 'yabdaʾu',
    'ينتهي': 'yantahī', 'انتهى': 'intahā', 'استمر': 'istamarra',
    'عاش': 'ʿāsha', 'يعيش': 'yaʿīshu', 'مات': 'māta', 'يموت': 'yamūtu',
    'بقي': 'baqiya', 'يبقى': 'yabqā', 'صار': 'ṣāra', 'أصبح': 'aṣbaḥa',
    'لعب': 'laʿiba', 'يلعب': 'yalʿabu', 'سافر': 'sāfara', 'يسافر': 'yusāfiru',
    'وصل': 'waṣala', 'يصل': 'yaṣilu', 'اشترى': 'ishtarā', 'يشتري': 'yashtarī',
    'باع': 'bāʿa', 'يبيع': 'yabīʿu', 'دفع': 'dafaʿa', 'يدفع': 'yadfaʿu',
    'فقد': 'faqada', 'وضع': 'waḍaʿa', 'يضع': 'yaḍaʿu', 'بنى': 'banā',
    'كسر': 'kasara', 'فتح': 'fataḥa', 'يفتح': 'yaftaḥu', 'غلق': 'ghalaqa',
    'طلب': 'ṭalaba', 'يطلب': 'yaṭlubu', 'نسي': 'nasiya', 'تذكر': 'tadhakkara',
    'حاول': 'ḥāwala', 'نجح': 'najaḥa', 'فشل': 'fashila', 'ظن': 'ẓanna',
    'اعتقد': 'iʿtaqada', 'يعتقد': 'yaʿtaqidu', 'أحب': 'aḥabba', 'يحب': 'yuḥibbu',
    'كره': 'kariha', 'احتاج': 'iḥtāja', 'يحتاج': 'yaḥtāju',
    'استخدم': 'istakhdama', 'يستخدم': 'yastakhdimu', 'أرسل': 'arsala',
    'يرسل': 'yursilu', 'استلم': 'istalama', 'تحرك': 'taḥarraka',
    'تحدث': 'taḥaddatha', 'يتحدث': 'yataḥaddathu', 'توقف': 'tawaqqafa',
    'تصور': 'taṣawwara', 'تخيل': 'takhayyala', 'تعلم': 'taʿallama',
    'يتعلم': 'yataʿallamu', 'علّم': 'ʿallama', 'يعلّم': 'yuʿallimu',
    'فعل': 'faʿala', 'يفعل': 'yafʿalu', 'فعله': 'faʿalahu', 'تفعل': 'tafʿalu',
    # nouns / adjectives (readings)
    'بيت': 'bayt', 'منزل': 'manzil', 'مدرسة': 'madrasa', 'جامعة': 'jāmiʿa',
    'كتاب': 'kitāb', 'قلم': 'qalam', 'ورقة': 'waraqa', 'مدينة': 'madīna',
    'قرية': 'qarya', 'بلد': 'balad', 'دولة': 'dawla', 'رجل': 'rajul',
    'امرأة': 'imraʾa', 'طالب': 'ṭālib', 'معلم': 'muʿallim', 'طبيب': 'ṭabīb',
    'مهندس': 'muhandis', 'صديق': 'ṣadīq', 'عائلة': 'ʿāʾila', 'أب': 'ab',
    'أم': 'umm', 'ولد': 'walad', 'بنت': 'bint', 'أخ': 'akh', 'أخت': 'ukht',
    'شخص': 'shakhṣ', 'ناس': 'nās', 'إنسان': 'insān', 'ملك': 'malik',
    'رئيس': 'raʾīs', 'علم': 'ʿilm', 'معرفة': 'maʿrifa', 'فكرة': 'fikra',
    'كلمة': 'kalima', 'كلمات': 'kalimāt', 'اسم': 'ism', 'جملة': 'jumla',
    'سؤال': 'suʾāl', 'جواب': 'jawāb', 'نص': 'naṣṣ', 'لغة': 'lugha',
    'عربية': 'ʿarabiyya', 'عربي': 'ʿarabī', 'برازيل': 'Brāzīl',
    'البرازيل': 'al-Brāzīl', 'برازيلي': 'Brāzīlī', 'برازيلية': 'Brāzīliyya',
    'تذكرة': 'tadhkira', 'جواز': 'jawāz', 'جواز سفر': 'jawāz safar',
    'مطار': 'maṭār', 'رحلة': 'riḥla', 'أموال': 'amwāl', 'مال': 'māl',
    'سعر': 'siʿr', 'ثمن': 'thaman', 'سوق': 'sūq', 'متجر': 'matjar',
    'طعام': 'ṭaʿām', 'شراب': 'sharāb', 'قهوة': 'qahwa', 'شاي': 'shāy',
    'ماء': 'māʾ', 'مياه': 'miyāh', 'خبز': 'khubz', 'لحم': 'laḥm',
    'دجاج': 'dajāj', 'سمك': 'samak', 'أرز': 'ruzz', 'فندق': 'funduq',
    'غرفة': 'ghurfa', 'سرير': 'sarīr', 'باب': 'bāb', 'نافذة': 'nāfidha',
    'سيارة': 'sayyāra', 'طائرة': 'ṭāʾira', 'قطار': 'qiṭār', 'حافلة': 'ḥāfila',
    'طريق': 'ṭarīq', 'شارع': 'shāriʿ', 'بحر': 'baḥr', 'نهر': 'nahr',
    'جبل': 'jabal', 'صحراء': 'ṣaḥrāʾ', 'شمس': 'shams', 'قمر': 'qamar',
    'نجمة': 'najma', 'هواء': 'hawāʾ', 'نار': 'nār', 'شجرة': 'shajara',
    'زهرة': 'zahra', 'حيوان': 'ḥayawān', 'طير': 'ṭayr', 'قلب': 'qalb',
    'رأس': 'raʾs', 'عين': 'ʿayn', 'فم': 'fam', 'يد': 'yad', 'جسم': 'jism',
    'وجه': 'wajh', 'صوت': 'ṣawt', 'لون': 'lawn', 'حجم': 'ḥajm', 'شكل': 'shakl',
    'كبير': 'kabīr', 'صغير': 'ṣaghīr', 'جيد': 'jayyid', 'سيء': 'sayyiʾ',
    'جميل': 'jamīl', 'طويل': 'ṭawīl', 'قصير': 'qaṣīr', 'جديد': 'jadīd',
    'قديم': 'qadīm', 'سهل': 'sahl', 'صعب': 'ṣaʿb', 'سعيد': 'saʿīd',
    'واحد': 'wāḥid', 'واحدة': 'wāḥida', 'واحدا': 'wāḥidan', 'أول': 'awwal',
    'أولا': 'awwalan', 'أولى': 'ūlā', 'مليون': 'milyūn', 'مليونير': 'milyūnīr',
    'مليار': 'milyār', 'ملايين': 'malāyīn', 'ثلاث': 'thalāth', 'أربع': 'arbaʿ',
    'خمس': 'khams', 'ست': 'sitt', 'سبع': 'sabʿ', 'ثمان': 'thamān',
    'تسع': 'tisʿ', 'عشر': 'ʿashr', 'عشرين': 'ʿishrīna', 'ثلاثين': 'thalāthīn',
    'كبيرة': 'kabīra', 'صغيرة': 'ṣaghīra', 'جديدة': 'jadīda', 'قديمة': 'qadīma',
    'جميلة': 'jamīla', 'مهمة': 'muhimma', 'جيدة': 'jayyida', 'ممكنة': 'mumkina',
    'مفتوحة': 'maftūḥa', 'مغلقة': 'maghlūqa', 'كبيرة': 'kabīra',
    'خطأ': 'khaṭaʾ', 'كامل': 'kāmil', 'غني': 'ghanī', 'فقير': 'faqīr',
    'مفتاح': 'miftāḥ', 'جدار': 'jidār', 'أرض': 'arḍ', 'مسجد': 'masjid',
    'حرب': 'ḥarb', 'سلام': 'salām', 'قانون': 'qānūn', 'حق': 'ḥaqq',
    'حكومة': 'ḥukūma', 'شعب': 'shaʿb', 'وطن': 'waṭan', 'تاريخ': 'tārīkh',
    'زمن': 'zaman', 'مستقبل': 'mustaqbal', 'حياة': 'ḥayāh', 'موت': 'mawt',
    'صحة': 'ṣiḥḥa', 'مرض': 'maraḍ', 'دواء': 'dawāʾ', 'مستشفى': 'mustashfā',
    'دراسة': 'dirāsa', 'امتحان': 'imtiḥān', 'درجة': 'daraja',
    'وظيفة': 'waẓīfa', 'شركة': 'sharika', 'مكتب': 'maktab', 'منتج': 'muntaj',
    'تجارة': 'tijāra', 'ربح': 'ribḥ', 'قيمة': 'qīma', 'اجتماع': 'ijtimāʿ',
    'قوة': 'qūwa', 'طاقة': 'ṭāqa', 'حركة': 'ḥaraka', 'سرعة': 'surʿa',
    'عدد': 'ʿadad', 'وزن': 'wazn', 'زيادة': 'ziyāda', 'تحسين': 'taḥsīn',
    'مشكلة': 'mushkila', 'فرصة': 'furṣa', 'خطر': 'khaṭar', 'أمان': 'amān',
    'حرية': 'ḥurriya', 'عدالة': 'ʿadāla', 'صبر': 'ṣabr', 'أمل': 'amal',
    'حلم': 'ḥulm', 'حقيقة': 'ḥaqīqa', 'سر': 'sirr', 'دليل': 'dalīl',
    'دين': 'dīn', 'صلاة': 'ṣalāt', 'عيد': 'ʿīd', 'موعد': 'mawʿid',
    'احتفال': 'iḥtifāl', 'ضيف': 'ḍayf', 'دعوة': 'daʿwa', 'زواج': 'zawāj',
    'ابن': 'ibn', 'جدة': 'jadda', 'جد': 'jadd', 'جار': 'jār',
    'قائد': 'qāʾid', 'موظف': 'muwaẓẓaf', 'مدير': 'mudīr', 'خطة': 'khuṭṭa',
    'برنامج': 'barnāmaj', 'مشروع': 'mashrūʿ', 'هدف': 'hadaf',
    'نتيجة': 'natīja', 'سبب': 'sabab', 'موقف': 'mawqif', 'حالة': 'ḥāla',
    'مستوى': 'mustawā', 'مرحلة': 'marḥala', 'خطوة': 'khuṭwa',
    'طريقة': 'ṭarīqa', 'صورة': 'ṣūra', 'قصة': 'qiṣṣa', 'شعر': 'shaʿr',
    'أدب': 'adab', 'فن': 'fann', 'موسيقى': 'mūsīqā', 'أغنية': 'ughniya',
    'فيلم': 'film', 'مسرح': 'masraḥ', 'عرض': 'ʿarḍ', 'لعبة': 'luʿba',
    'رياضة': 'riyāḍa', 'فريق': 'farīq', 'لاعب': 'lāʿib', 'تدريب': 'tadrīb',
    'نوم': 'nawm', 'إفطار': 'ifṭār', 'غداء': 'ghadāʾ', 'عشاء': 'ʿashāʾ',
    'وجبة': 'wajba', 'خبر': 'khabar', 'أخبار': 'akhbār', 'إعلان': 'iʿlān',
    'رسالة': 'risāla', 'بريد': 'barīd', 'هاتف': 'hātif', 'شاشة': 'shāsha',
    'إنترنت': 'internet', 'تطبيق': 'taṭbīq', 'موقع': 'mawqiʿ',
    'بيانات': 'bayānāt', 'ملف': 'malaff', 'توقيع': 'tawqīʿ',
    'كرسي': 'kursī', 'طاولة': 'ṭāwila', 'مرآة': 'mirʾāh', 'سجاد': 'sajjād',
    'مطبخ': 'maṭbakh', 'حمام': 'ḥammām', 'ملابس': 'malābis', 'قميص': 'qamīṣ',
    'حذاء': 'ḥidhāʾ', 'قبعة': 'qubʿa', 'نظارة': 'naẓẓāra', 'ساعة': 'sāʿa',
    'أحمر': 'aḥmar', 'أزرق': 'azraq', 'أخضر': 'akhḍar', 'أصفر': 'aṣfar',
    'أبيض': 'abyaḍ', 'أسود': 'aswad', 'دائرة': 'dāʾira', 'مربع': 'murabbaʿ',
    'خط': 'khaṭṭ', 'نقطة': 'nuqṭa', 'زاوية': 'zāwiya', 'وسط': 'wasṭ',
    'مفتاح': 'miftāḥ', 'ليلة': 'layla', 'صباح': 'ṣabāḥ', 'مساء': 'masāʾ',
    'نصف': 'niṣf', 'ربع': 'rubʿ', 'دقائق': 'daqāʾiq', 'ثانية': 'thāniya',
    'عام': 'ʿām', 'شهور': 'shuhūr', 'أسابيع': 'asābīʿ', 'عقود': 'ʿuqūd',
    'قرن': 'qarn', 'بداية': 'bidāya', 'نهاية': 'nihāya', 'وسط': 'wasṭ',
    'الشرق': 'ash-sharq', 'الغرب': 'al-gharb', 'الشمال': 'ash-shamāl',
    'الجنوب': 'al-janūb', 'الشرق الأوسط': 'ash-sharq al-awsaṭ',
    'مصر': 'Miṣr', 'المغرب': 'al-Maghrib', 'السعودية': 'as-Suʿūdiyya',
    'الإمارات': 'al-imārāt', 'الأردن': 'al-urdun', 'الجزائر': 'al-jazāʾir',
    'تونس': 'Tūnis', 'العراق': 'al-ʿirāq', 'سوريا': 'Sūriyā',
    'لبنان': 'Lubnān', 'ليبيا': 'Lībiyā', 'السودان': 'as-sūdān',
    'اليمن': 'al-yaman', 'الكويت': 'al-kuwayt', 'قطر': 'qaṭar',
    'عمان': 'ʿummān', 'فلسطين': 'Filasṭīn', 'الرياض': 'ar-riyāḍ',
    'القاهرة': 'al-qāhira', 'دبي': 'dubayy', 'بيروت': 'bayrūt',
    'دمشق': 'dimashq', 'بغداد': 'baghdād', 'مراكش': 'marrākush',
    'الرباط': 'ar-riyāḍ', 'طنجة': 'ṭanja', 'جدة': 'judda',
}


def clean(word: str) -> str:
    """Remove diacritics/tatweel for lexicon lookup."""
    return ''.join(c for c in word if c not in STRIP)


def tokens_of(word: str):
    """[(consonant_or_marker, vowel)] — consonants C/و/ي + vowels from harakat; shadda flag."""
    toks = []
    for ch in word:
        if ch in VOWELS:
            if toks:
                toks[-1][1] = VOWELS[ch]
        elif ch in TANWIN:
            if toks:
                toks[-1][1] = TANWIN[ch]
        elif ch == '\u0651':  # shadda → double previous consonant
            if toks:
                toks.append([toks[-1][0], toks[-1][1]])
                toks[-2][1] = ''
        elif ch == '\u0652':  # sukun
            if toks:
                toks[-1][1] = ''
        else:
            toks.append([ch, ''])
    return toks


def render_vocalized(toks):
    out = []
    for i, (ch, vow) in enumerate(toks):
        if ch in C:
            out.append(C[ch])
        elif ch in LONG:
            # initial bare alif reads 'a' (article / hamza alif)
            out.append('a' if (i == 0 and not vow) else LONG[ch])
        elif ch in SEMI:
            prev_c = any(t[0] in C for t in toks[:i][-1:]) if i else False
            out.append(('ū' if ch == 'و' else 'ī') if (prev_c and not vow) else SEMI[ch])
        if vow:
            out.append(vow)
    return ''.join(out)


def has_harakat(word: str) -> bool:
    return any(ch in VOWELS or ch in TANWIN for ch in word)


def vocalize(cons: str) -> str:
    """Insert 'a' into a consonant skeleton: never start with a cluster, never 3 consonants."""
    if not cons:
        return ''
    out = []
    run = 0
    for i, c in enumerate(cons):
        if c in 'āīū':
            out.append(c)
            run = 0
            continue
        if i == 0:
            out.append(c)
            nxt = cons[1] if len(cons) > 1 else ''
            if (nxt and nxt not in 'āīū') or len(cons) == 1:
                out.append('a')
            run = 1
            continue
        if run >= 2:
            out.append('a')
            run = 0
        out.append(c)
        run += 1
    return ''.join(out)


def skeleton(word: str) -> str:
    """Consonant skeleton; medial و/ي after a consonant become long ū/ī."""
    s = ''
    prev_c = False
    for ch in word:
        if ch in C:
            s += C[ch]
            prev_c = True
        elif ch in SEMI:
            s += ('ū' if ch == 'و' else 'ī') if prev_c else SEMI[ch]
            prev_c = False
        elif ch in LONG:
            s += LONG[ch]
            prev_c = False
    return s


PUNCT_MAP = {'،': ',', '؛': ';', '؟': '?'}


def translit_word(word: str) -> str:
    word = (word or '').strip()
    if not word:
        return ''
    if word in PUNCT_MAP:
        return PUNCT_MAP[word]
    key = clean(word)
    if key in LEX:
        return LEX[key]
    if has_harakat(word):
        return render_vocalized(tokens_of(word))
    # future سـ / سأـ
    if key.startswith('سأ') and len(key) > 3:
        return 'sa-' + translit_word('أ' + key[2:]).replace('ʾa', 'ʾa')
    if key.startswith('س') and len(key) > 3 and key[1] not in SUN:
        return 'sa-' + translit_word(key[1:])
    # definite article
    if key.startswith('ال') and len(key) > 2:
        stem = key[2:]
        body = LEX.get(stem)
        if body is None:
            body = vocalize(skeleton(stem))
        if stem and stem[0] in SUN:
            first = skeleton(stem)[0] if skeleton(stem) else 'a'
            return 'a' + first + '-' + body
        return 'al-' + body
    # single-letter prefixes و/ف always; ب/ل/ك only when the rest is a known word
    if len(key) > 2 and key[0] in 'وفبلك':
        stem = key[1:]
        if key[0] in 'وف':
            # conjunction attaches before consonant-initial words
            if stem[0] not in 'اوأيوآى':
                body = LEX.get(stem) or vocalize(skeleton(stem))
                return {'و': 'wa', 'ف': 'fa'}[key[0]] + '-' + body
        else:
            if stem in LEX:
                return {'ب': 'bi', 'ل': 'li', 'ك': 'ka'}[key[0]] + '-' + LEX[stem]
    # conjugated-verb aware (handled by caller via pos/form)
    return vocalize(skeleton(word))


def translit_conjugated(word: str, pos: str, form: str) -> str:
    key = clean(word)
    if key in LEX or has_harakat(word):
        return translit_word(word)
    if pos != 'Verbo conjugado':
        return translit_word(word)
    # past forms: stem + ending
    if 'Passado' in form or 'Passado' in str(form):
        stem, ending = key, ''
        for suf, lat in (('وا', 'ū'), ('وا', 'ū'), ('تم', 'tum'), ('تن', 'tunna'),
                         ('نا', 'nā'), ('تا', 'tā'), ('ت', 'tu')):
            if key.endswith(suf) and len(key) - len(suf) >= 2:
                stem, ending = key[:-len(suf)], lat
                break
        return vocalize(skeleton(stem)) + ending
    # present: prefix + stem
    if 'Presente' in str(form):
        p = key[0]
        if p in 'أتن' and len(key) >= 3:
            prefix = {'أ': 'ʾa', 'ت': 'ta', 'ن': 'na'}[p]
            return prefix + vocalize(skeleton(key[1:]))
        if p == 'ي' and len(key) >= 3:
            return 'ya' + vocalize(skeleton(key[1:]))
    return translit_word(word)


SENT_SPLIT = re.compile(r'(\s+|[،؛,.!؟?():«»"\u060C])')


def translit_sentence(s: str) -> str:
    if not s:
        return ''
    out = []
    for tok in SENT_SPLIT.split(s):
        if not tok:
            continue
        if tok.isspace():
            out.append(' ')
        elif tok in PUNCT_MAP or tok in ',.!?():«»"\'':
            out.append(PUNCT_MAP.get(tok, tok))
        else:
            out.append(translit_word(tok))
    return ''.join(out)


# ════════════════════════════════════════════════════════════════
#  BUILD
# ════════════════════════════════════════════════════════════════
def main():
    wb = openpyxl.load_workbook(XLSX, read_only=True)

    # ---------- dictionary ----------
    ws = wb['القاموس الكامل']
    entries = []
    for r in ws.iter_rows(min_row=5, max_row=5004, values_only=True):
        if not r or r[2] in (None, ''):
            continue
        num, level, word, meaning, example, example_tr, pos, base, form, review = (list(r) + [None] * 10)[:10]
        word = str(word).strip()
        entries.append({
            'id': num,
            'word': word,
            'translit': translit_conjugated(word, str(pos or ''), str(form or '')),
            'pos': str(pos or '').strip(),
            'meaning': str(meaning or '').strip(),
            'example': str(example or '').strip(),
            'exampleTr': str(example_tr or '').strip(),
            'exampleTranslit': translit_sentence(str(example or '')),
            'level': level,
            'base': str(base or word).strip(),
            'form': str(form or '').strip(),
        })
    print(f'dictionary entries: {len(entries)}')
    print(f"no translit: {sum(1 for e in entries if not e['translit'])}")
    (ROOT / 'data' / 'dictionary.json').write_text(
        json.dumps(entries, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')

    # ---------- phrases ----------
    ph = wb['Frases úteis']
    phrases = []
    for r in ph.iter_rows(min_row=5, values_only=True):
        if not r or not r[1]:
            continue
        theme, arabic, pron, meaning, note = (list(r) + [None] * 5)[:5]
        if not arabic:
            continue
        phrases.append({
            'theme': str(theme or '').strip(),
            'arabic': str(arabic).strip(),
            'translit': str(pron or translit_sentence(str(arabic))).strip(),
            'meaning': str(meaning or '').strip(),
            'note': str(note or '').strip(),
        })
    print(f'phrases: {len(phrases)}')
    (ROOT / 'data' / 'phrases.json').write_text(
        json.dumps(phrases, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')

    # ---------- verbs (base forms) ----------
    seen = {}
    for e in entries:
        b = e['base']
        if not b or len(clean(b)) < 3 or clean(b) in ('ال', 'لا', 'أن'):
            continue
        if b not in seen:
            first = next((x for x in entries if x['base'] == b and x['pos'] == 'Verbo conjugado'), e)
            seen[b] = {
                'base': b, 'translit': translit_word(b),
                'meaning': first['meaning'].split('—')[0].split('؛')[0].strip(),
                'count': 0, 'forms': [],
            }
        seen[b]['count'] += 1
        seen[b]['forms'].append({'word': e['word'], 'translit': e['translit'],
                                 'meaning': e['meaning'], 'form': e['form']})
    verbs = sorted(seen.values(), key=lambda v: -v['count'])
    print(f'verb bases: {len(verbs)}')
    (ROOT / 'data' / 'verbs.json').write_text(
        json.dumps(verbs, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')

    # ---------- preview ----------
    for e in entries[:8]:
        print(f"{e['word']} → {e['translit']}  |  {e['example']} → {e['exampleTranslit']}")
    mid = entries[1295:1300]
    for e in mid:
        print(f"{e['word']} → {e['translit']}  |  {e['form']}")


if __name__ == '__main__':
    main()
