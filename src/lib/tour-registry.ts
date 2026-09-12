export type Bi = { en: string; ar: string };
export type BiList = { en: string[]; ar: string[] };

export type TourStep = {
  id: string;
  targetSelector: string;
  fallbackSelector?: string;
  title: Bi;
  description: Bi;
  bullets?: BiList;
  actionPrompt?: {
    label: Bi;
    actionId: string;
  };
};

export type PageTourDef = {
  toolKey: string;
  title: Bi;
  steps: TourStep[];
};

export const TOURS: Record<string, PageTourDef> = {
  /* =========================================================================
     1. FLASHCARDS & STUDY SPACE (/study)
     ========================================================================= */
  flashcards: {
    toolKey: "flashcards",
    title: { en: "Mastering Your Flashcards & Study Space", ar: "الدليل الشامل لاستخدام البطاقات ومساحة الدراسة" },
    steps: [
      {
        id: "shelf",
        targetSelector: '[data-tour="subject-shelf"]',
        fallbackSelector: '[data-tour="subject-shelf-header"], main',
        title: {
          en: "Hierarchical Subject Shelf & Smart Topic Picker",
          ar: "رف المواد الهيكلي، البحث الفوري وتحديد الموضوعات",
        },
        description: {
          en: "This is your primary academic repository. Every course is organized into high-level subjects with nested lectures, designed to build clear cognitive maps for medical studies.",
          ar: "هذا هو المستودع الأكاديمي الرئيسي لبطاقاتك؛ تنظم فيه المواد الكبرى ومحاضراتها الفرعية لبناء روابط معرفية راسخة للمواد الطبية.",
        },
        bullets: {
          en: [
            "1. Instant Smart Search: Type any lecture topic, disease name, or drug in the search bar ('Search subjects and sub-subjects...') to filter your entire board instantly.",
            "2. '+ New' Subject Button: Fast header button to create a brand-new top-level course or clinical rotation module.",
            "3. Expandable Subject Card ('Sample subject — Cardiology'): Click anywhere on the course card to expand or collapse its list of nested sub-subjects and chapters.",
            "4. Topic & Card Counters ('0 of 2 sub-subjects selected · 10 cards'): Displays live counts of selected topics and total cards stored inside this subject.",
            "5. '+ sub-subject' Shortcut: Directly nest a new chapter or lecture block into this subject without leaving your place.",
            "6. Multi-Topic Checkboxes: Tick one or multiple sub-subjects across different courses to generate integrated interdisciplinary study sessions (e.g. Cardiology Pathology + Pharmacology).",
          ],
          ar: [
            "١. شريط البحث الذكي الفوري: ابحث عن أي اسم مرض، دواء، أو عنوان محاضرة ('Search subjects and sub-subjects...') لتصفية كامل محتواك فوراً.",
            "٢. زر إضافة مادة (+ New): زر برتقالي علوي لإنشاء مقرر دراسي جديد أو مادة إكلينيكية مباشرة بضغطة واحدة.",
            "٣. بطاقة المادة الرئيسية ('Cardiology'): اضغط على البطاقة لفتح أو طي قائمة المحاضرات والفصول الفرعية التابعة لها.",
            "٤. عداد الاختيار والبطاقات الحية ('0 of 2 selected · 10 cards'): يوضح عدد المحاضرات المحددة للمذاكرة الآن وإجمالي البطاقات داخل المادة.",
            "٥. زر (+ sub-subject): لإضافة محاضرة جديدة أو فصل دراسي فرعي داخل المادة مباشرة دون خطوات معقدة.",
            "٦. مربعات التحديد للدمج المتعدد: حدد عدة محاضرات من مواد مختلفة (مثل باثولوجي القلب + فارماكولوجي) لتكوين جلسة دراسة تكاملية شاملة.",
          ],
        },
      },
      {
        id: "rail",
        targetSelector: '[data-tour="study-rail"]',
        fallbackSelector: "aside",
        title: {
          en: "Left Rail: Rapid Curriculum & Deck Actions",
          ar: "شريط الأدوات الجانبي: إدارة وهيكلة المواد بسرعة",
        },
        description: {
          en: "The vertical side rail provides fast, single-click shortcuts to build, organize, and manage your study modules.",
          ar: "يوفر الشريط الجانبي أدوات تحكم فورية وسريعة لبناء مقرراتك، وتنظيم فصولك، وتعديل بطاقاتك بضغطة واحدة.",
        },
        bullets: {
          en: [
            "1. Add Subject (New - Apricot): Establishes new major courses and disciplines (e.g. Cardiology, Pharmacology, Pathology).",
            "2. Add Sub-Subject (Nest - Sky): Nests specific chapters, lectures, or diagnostic units inside the currently selected subject.",
            "3. Remove (Delete - Clay): Safely deletes a selected chapter or subject with confirmation dialog to prevent accidental loss.",
            "4. Edit (Rename - Lilac): Instantly renames subjects or sub-topics to keep your syllabus titles clean and structured.",
            "5. Authoring Mode Tools: Switching to Edit View also unlocks 'Add flashcards', 'View flashcards', and the 'Make cards from material' AI generator.",
          ],
          ar: [
            "١. إضافة مادة (Add subject - برتقالي): إنشاء المقررات الدراسية والفروع الطبية الكبرى (مثل التشريح، الباطنة، الأطفال).",
            "٢. إضافة مادة فرعية (Add sub-subject - سماوي): تفريع المحاضرات والفصول الدراسية داخل المادة المختارة.",
            "٣. حذف (Remove - أحمر طيني): لحذف المحاضرة أو المادة المحددة بأمان مع نافذة تأكيد لمنع الحذف بالخطأ.",
            "٤. تعديل الاسم (Edit - بنفسجي): لإعادة تسمية المواد أو المحاضرات لتنظيم فهرس المنهج وتحديثه بدقة.",
            "٥. أدوات وضع التحرير: عند التبديل لوضع التعديل، يفتح هذا الشريط أيضاً أدوات كتابة البطاقات، والمعرض، واستخراج البطاقات بالذكاء الاصطناعي.",
          ],
        },
      },
      {
        id: "start-session",
        targetSelector: '[data-tour="start-session"]',
        fallbackSelector: '[data-tour="launch-panel"], aside:has(button)',
        title: {
          en: "Start a Session: Modes, Scope & SM-2 Review",
          ar: "بدء الجلسة: أنماط المذاكرة، التصفية وخوارزمية SM-2",
        },
        description: {
          en: "This launchpad prepares your study deck and lets you choose how to practice — from zero-stakes casual practice to scientific SM-2 spaced repetition.",
          ar: "لوحة انطلاق جلسة المذاكرة؛ تجهز حزمة البطاقات المختارة وتتيح لك الاختيار بين التدريب الحر أو المراجعة التكرارية المتباعدة بنظام SM-2.",
        },
        bullets: {
          en: [
            "1. Readiness Counter ('10 cards ready'): Shows the aggregate count of flashcards ready to review from your ticked subjects (or entire board).",
            "2. Scope & Status Breakdown: Displays source scope ('From: your whole board'), cards due right now by schedule ('Due now: 7'), and marked cards ('Flagged: 0').",
            "3. 'All ticked' vs 'Flagged' Tabs: Switch between studying every card in your selection or isolating only cards you flagged for difficulty.",
            "4. 'Study mode': Free practice run that lets you flip through cards at your own pace without altering your spaced repetition intervals.",
            "5. 'Shuffle and study': Randomizes card order to prevent serial position memory bias and simulate realistic clinical exam recall.",
            "6. 'Smart review' (SuperMemo SM-2): Scientifically optimized spaced repetition session; calculates interval expansions based on your rating (Again, Hard, Good, Easy).",
          ],
          ar: [
            "١. إجمالي الجاهزية ('10 cards ready'): مجموع البطاقات الجاهزة للمذاكرة وفق ما قمت بتحديده (أو كامل اللوحة إذا لم تحدد شيئاً).",
            "٢. تفاصيل الحزمة المصدرية: يوضح مصدر البطاقات ('From')، والمستحق للمراجعة اليوم ('Due now: 7')، والبطاقات المميزة بنجمة ('Flagged: 0').",
            "٣. تبويب 'All ticked' مقابل 'Flagged': للتبديل الفوري بين دراسة كل البطاقات المحددة، أو التركيز حصراً على البطاقات الصعبة المعلمة براية.",
            "٤. زر وضع الدراسة (Study mode): مراجعة تجريبية حرة ومفتوحة لتصفح البطاقات دون التأثير على مواعيد خوارزمية التكرار المتباعد.",
            "٥. خلط البطاقات (Shuffle and study): يبعثر ترتيب البطاقات لكسر الحفظ النمطي وتدريب العقل على الاستدعاء المفاجئ للمعلومة.",
            "٦. المراجعة الذكية (Smart review بخوارزمية SM-2): النظام العلمي للتكرار المتباعد؛ يقدم لك البطاقات في موعد نسيانها ويبرمج موعدها القادم بناءً على تقييمك (Again, Hard, Good, Easy).",
          ],
        },
      },
      {
        id: "daily-schedule",
        targetSelector: '[data-tour="daily-schedule"]',
        fallbackSelector: '[data-tour="launch-panel"] > div:last-child, main div:last-child',
        title: {
          en: "Today's Schedule, Daily Goal & 30-Day Forecast",
          ar: "جدول اليوم، الهدف اليومي والتنبؤ لـ 30 يوماً القادمة",
        },
        description: {
          en: "Your morning repetition cockpit. Keeps you consistent, highlights what is due today, tracks daily quotas, and forecasts upcoming exam workload.",
          ar: "لوحة التحكم اليومية للتكرار المتباعد؛ تحافظ على استمراريتك، وتحدد البطاقات المستحقة اليوم، وتتنبأ بحجم المراجعات للأيام القادمة.",
        },
        bullets: {
          en: [
            "1. Cards Due Today ('7 cards due right now · 2 new mixed in'): Highlights cards that have reached their optimal forgetting curve threshold, mixing in new unstudied cards.",
            "2. 'Review everything due' Button: Primary master action to launch an immediate SM-2 session for all due cards across your library.",
            "3. Daily Goal Tracker ('DAILY GOAL 8/20'): Progress bar showing completed cards against your target quota, indicating remaining cards needed.",
            "4. Weekly Consistency Dots: 7-day indicators tracking your daily completion streak to build compounding study habits.",
            "5. Next 30 Days Forecast Chart: Predictive histogram showing upcoming review volume ('Busiest day ahead: 5 cards') so you can plan ahead.",
            "6. Retention Tuner ('How tight should the schedule be?'): Customize target memory retention between Relaxed (85%), Balanced (90%), or Exam-tight (95%).",
            "7. 'See my progress' Link: Jump directly to `/study/progress` for deep analytics on hard cards, leeches, and average ease factors.",
          ],
          ar: [
            "١. المستحق للمراجعة اليوم ('7 cards due · 2 new'): يوضح البطاقات المطلوب مراجعتها فوراً لمنع تلاشي المعلومات مع دمج بطاقات جديدة تدريجياً.",
            "٢. زر مراجعة كل المستحق (Review everything due): الزر الأخضر الرئيسي لبدء جلسة مراجعة تكرارية شاملة لكل ما استحق موعده بضغطة واحدة.",
            "٣. شريط الهدف اليومي (Daily Goal 8/20): مقياس بصري يوضح ما أنجزته من هدفك اليومي (مثلاً 20 بطاقة) وعدد البطاقات المتبقية لإتمامه.",
            "٤. نقاط أيام الأسبوع (Streak Dots): متابعة الاستمرارية اليومية عبر إضاءة الأيام التي حققت فيها هدفك الدراسي.",
            "٥. رسم التنبؤ لـ 30 يوماً (Next 30 Days): أعمدة بيانية توضح ضغط المراجعات المتوقع خلال الشهر القادم ('Busiest day ahead') لتنظيم وقتك قبل الامتحانات.",
            "٦. ضبط دقة التكرار المتباعد: اختيار نسبة تثبيت الحفظ المستهدفة بين مرن (85%)، متوازن (90%)، أو مشدد للاختبارات (95%).",
            "٧. رابط تقدمي الدراسي (See my progress): ينقلك لصفحة التحليلات المتقدمة لمتابعة البطاقات المستعصية ومعدل السهولة.",
          ],
        },
      },
      {
        id: "view-mode",
        targetSelector: '[data-tour="mode-switch"]',
        fallbackSelector: "header .grid, .rita-tile",
        title: {
          en: "Top Mode Switcher: Study View vs Edit & Adjust",
          ar: "مفتاح التبديل العلوي: وضع المذاكرة مقابل وضع التحرير والتنظيم",
        },
        description: {
          en: "Seamlessly separate focused active-recall testing from deck authoring and curriculum management.",
          ar: "فصل تام ومدروس بين مرحلة التركيز والاسترجاع الذهني، وبين مرحلة كتابة وتنظيم محتوى المنهج.",
        },
        bullets: {
          en: [
            "1. RitaJet Brand: Quick return to the home workspace and tools overview.",
            "2. Study View ('Go through your cards'): Minimalist, calm interface engineered to maximize focus and eliminate cognitive clutter during high-intensity revision.",
            "3. Edit & Adjust View ('Build and rearrange your subjects'): Unlocks comprehensive authoring tools to create parent subjects, nest sub-topics, import external Anki/CSV decks, and compose rich-text clinical cards.",
          ],
          ar: [
            "١. شعار RitaJet: للعودة السريعة للواجهة الرئيسية وقائمة الأدوات.",
            "٢. وضع المذاكرة (Study view - الأخضر): واجهة انسيابية هادئة خالية من أي مشتتات لضمان أعلى مستويات التركيز أثناء الحفظ النشط.",
            "٣. وضع التعديل والإضافة (Edit and adjust): يفتح أدوات التحرير المتقدمة لإنشاء المواد، وتفريع المحاضرات، واستيراد ملفات Anki/CSV، وكتابة البطاقات الطبية.",
          ],
        },
        actionPrompt: {
          label: {
            en: "Switch to Edit View to explore authoring tools →",
            ar: "انتقل لوضع التعديل لاستكشاف أدوات الإضافة ←",
          },
          actionId: "toggle-edit-mode",
        },
      },
    ],
  },

  /* =========================================================================
     2. SPACES & CLASSROOMS (/spaces) - In-Depth Collaborative Study
     ========================================================================= */
  spaces: {
    toolKey: "spaces",
    title: { en: "Collaborative Classrooms & University Spaces", ar: "الدليل الشامل للغرف الدراسية والمجموعات المشتركة" },
    steps: [
      {
        id: "spaces-cohorts",
        targetSelector: '[data-tour="spaces-list"], main div:first-child, main',
        title: {
          en: "Academic Batches & University Study Rooms",
          ar: "الصفوف الجامعية ومجموعات الدفعة الأكاديمية",
        },
        description: {
          en: "Spaces are collaborative learning hubs built for medical batches, clinical rotations, and university cohorts. Instead of studying in isolation, your entire class synchronizes on a unified, high-yield syllabus.",
          ar: "المساحات (Spaces) هي غرف دراسية تشاركية مخصصة لطلاب الدفعة الواحدة، ومجموعات التدريب السريري، والفرق الجامعية. تتيح للطلاب التعاون والتكاتف الأكاديمي لتوحيد المنهج والارتقاء بنسب النجاح والتميز.",
        },
        bullets: {
          en: [
            "Cohort Hubs: Organize dedicated rooms by university batch (e.g. Class of 2027), hospital rotations (Internal Medicine, Surgery, Pediatrics), or exam groups.",
            "Join Codes & Permission Roles: Access spaces with private invitation codes. Space owners manage member permissions, ensure quality control, and moderate shared materials.",
            "Member Rosters & Study Presence: See which classmates are actively revising, study schedules, and celebrate group study streaks together.",
          ],
          ar: [
            "غرف الدفعات والمستشفيات: تنظيم الغرف حسب السنة الدراسية (مثل: دفعة الطب 2027) أو حسب التدريب السريري (الباطنة، الجراحة، الأطفال).",
            "رموز الانضمام والصلاحيات: الانضمام برمز دعوة خاص ومحمي؛ ويتحكم مسؤولو الغرفة في مراجعة البطاقات المضافة واعتماد جودتها.",
            "قوائم الأعضاء والتفاعل: معرفة الزملاء المتواجدين وجداول دراستهم وتشجيع المجموعات على الاستمرار في سلاسل المذاكرة اليومية.",
          ],
        },
      },
      {
        id: "spaces-folders",
        targetSelector: '[data-tour="spaces-folders"], main div:nth-child(2), main',
        title: {
          en: "Curated Deck Folders & Syllabus Synchronization",
          ar: "مجلدات البطاقات المعتمدة وتوحيد محتوى المنهج",
        },
        description: {
          en: "Class representatives and high-achieving peer editors organize decks into structured course folders, ensuring every student studies from one reliable, thoroughly peer-reviewed source of truth.",
          ar: "يقوم ممثلو الدفعة والطلاب المتفوقون بتنظيم البطاقات داخل مجلدات دراسية معتمدة ومفهرسة، مما يمنح الجميع مصدراً موحداً ومدققاً علمياً للمذاكرة قبل الامتحانات.",
        },
        bullets: {
          en: [
            "Structured Folder Trees: Decks are neatly organized by block, course, and exam (e.g., Midterm Block → Pathology → Valvular Disease).",
            "Peer Review & Version Updates: When a deck is refined with updated clinical guidelines, professors' notes, or errata fixes, the whole space gets the update.",
            "One-Click Forking to Personal Shelf: Save any room deck directly into your private flashcards to review using your personal SM-2 algorithm schedule.",
          ],
          ar: [
            "فهرسة شجرية دقيقة: تنظيم المجموعات حسب البلوكات والمقررات والامتحانات (مثلاً: بلوك النصفي ← الباطنة ← اعتلال الصمامات).",
            "التدقيق والتحديث الفوري: عند تصحيح أي معلومة أو إضافة ملاحظة أستاذ المادة، يُحدث المجلد لدى جميع طلاب الصف في نفس اللحظة.",
            "الحفظ في مساحتك الخاصة: يمكنك بضغطة زر نسخ أي مجموعة لبطاقاتك الشخصية ومراجعتها بخوارزمية SM-2 الخاصة بك.",
          ],
        },
      },
      {
        id: "spaces-bulletin",
        targetSelector: '[data-tour="spaces-announcements"], main div:last-child, main',
        title: {
          en: "Group Announcements & Coordinated Study Sprints",
          ar: "لوحة الإعلانات وتنسيق خطط المراجعة الجماعية",
        },
        description: {
          en: "Coordinate revision milestones, post exam countdowns, share critical faculty notices, and launch synchronized study challenges across the class.",
          ar: "تنسيق مواعيد المراجعة، ونشر تنبيهات دكاترة المواد، ومشاركة العد التنازلي للاختبارات لتوحيد جهود الدفعة ورفع الجاهزية والهمم.",
        },
        bullets: {
          en: [
            "Faculty & Exam Alerts: Pin important updates regarding syllabus coverage, exam formats, and key high-yield topics emphasized in lectures.",
            "Collaborative Study Sprints: Align with classmates on completing 50 cards or 20 questions a day before midterm dates.",
            "Shared Discussion & Clarifications: Clarify ambiguous concepts, difficult board questions, and clinical differentials together.",
          ],
          ar: [
            "تنبيهات الأساتذة والامتحانات: تثبيت التوجيهات الهامة حول المواضيع الأكثر تركيزاً في الامتحانات وتحديد النقاط المحورية.",
            "تحديات المراجعة المشتركة: الاتفاق مع الزملاء على إنجاز عدد محدد من البطاقات والأسئلة يومياً لضمان إنهاء المنهج في وقته.",
            "النقاش وتوضيح المسائل الصعبة: طرح الأسئلة المعقدة ومناقشة التعليلات السريرية الدقيقة مع المتفوقين في الدفعة.",
          ],
        },
      },
    ],
  },

  /* =========================================================================
     3. SHARED FLASHCARDS (/share) - Community Deck Marketplace
     ========================================================================= */
  "shared-decks": {
    toolKey: "shared-decks",
    title: { en: "Community Decks & Open Knowledge Sharing", ar: "الدليل الشامل للبطاقات المشتركة ومكتبة المجتمع" },
    steps: [
      {
        id: "share-marketplace",
        targetSelector: '[data-tour="share-decks"], main input[type="search"], main',
        title: {
          en: "The Community Deck Library & Quality Standards",
          ar: "مكتبة البطاقات المفتوحة ومعايير جودة المحتوى",
        },
        description: {
          en: "Explore a curated public repository of high-yield flashcard decks crafted by top medical students, residents, and university educators across multiple curricula.",
          ar: "استكشف أضخم مكتبة مفتوحة للبطاقات الطبية المركزة التي أعدها أوائل الطلاب والأطباء المتميزون من مختلف الجامعات والأنظمة التعليمية.",
        },
        bullets: {
          en: [
            "Curriculum & Exam Filtering: Filter decks by target examination (USMLE Step 1, Step 2 CK, IFOM, PLAB, National Board Exams) or academic disciplines.",
            "Peer Reviews & Rating Algorithm: Decks display verified student ratings, user reviews, total cards, and community save counts so you immediately spot top-tier resources.",
            "Verified Contributor Badges: Top authors and medical educators receive verified badges ensuring high clinical accuracy and trustworthy references.",
          ],
          ar: [
            "تصنيف حسب الامتحانات: تصفية المجموعات بحسب الاختبار المستهدف (USMLE، IFOM، البورد العربي، الامتحانات الوزارية الجامعية).",
            "التقييمات وثقة المجتمع: تعرض كل مجموعة تقييمات الطلاب الحقيقية، عدد البطاقات، وعدد مرات الحفظ لضمان اختيار أقوى المواد.",
            "شارات المساهمين المعتمدين: يحصل المتميزون وصانعو المحتوى الموثوق على شارات اعتماد تؤكد الدقة العلمية والمراجع المعتمدة.",
          ],
        },
      },
      {
        id: "share-forking",
        targetSelector: '[data-tour="share-card"], main div:has(button:contains("Save")), main',
        title: {
          en: "One-Click Forking: Your Independent Personal Copy",
          ar: "النسخ المستقل: ملكية كاملة لبطاقاتك داخل مساحتك",
        },
        description: {
          en: "Saving a community deck does not just bookmark it — it creates a full, independent personal fork inside your own study library.",
          ar: "حفظ أي مجموعة مشتركة لا يكتفي بوضع إشارة مرجعية، بل يمنحك نسخة كاملة ومستقلة تماماً داخل مساحتك الدراسية الخاصة.",
        },
        bullets: {
          en: [
            "Independent Customization: Add your own mnemonics, modify definitions, attach clinical images, or remove cards without affecting the author's original deck.",
            "Personalized SM-2 Scheduling: Your spaced repetition interval history and difficulty ratings are strictly private and tailored to your individual memory performance.",
            "Zero Dependency: You retain permanent offline and cloud access to your forked decks even if the original publisher updates or archives their deck.",
          ],
          ar: [
            "تعديل وتخصيص بلا حدود: يمكنك إضافة صورك التوضيحية، وتعديل الملاحظات، وحذف أو إضافة بطاقات بحرية كاملة دون التأثير على الأصل.",
            "جدولة SM-2 خاصة بك وحدك: مواعيد المراجعة وسجل الاستذكار مرتبطة تماماً بمستوى حفظك الشخصي وسرعة استرجاعك للمعلومة.",
            "استقلالية دائمة: تظل المجموعات المنسوخة في حسابك دائماً حتى لو قام الناشر الأصلي بتعديلها أو أرشفتها.",
          ],
        },
      },
      {
        id: "share-publishing",
        targetSelector: '[data-tour="share-publish"], main button, main',
        title: {
          en: "Publishing Your Decks & Privacy Granularity",
          ar: "نشر مجموعاتك ومستويات الخصوصية المتدرجة",
        },
        description: {
          en: "Contribute to peer education by publishing your own distilled revision decks with complete control over visibility and audience.",
          ar: "شارك علمك وادعم زملاءك بنشر ملخصاتك وبطاقاتك المركزة مع تحكم مطلق في خصوصية المشاركة والجمهور المستهدف.",
        },
        bullets: {
          en: [
            "Public Community Sharing: Make your deck discoverable across RitaJet to earn contributor standing and help thousands of international students.",
            "Classroom-Only Restriction: Restrict sensitive decks exclusively to members of your specific study room or university cohort.",
            "Instant Unshare & Version Management: Update card contents or revoke public access at any time with a single click.",
          ],
          ar: [
            "النشر العام للمجتمع: إتاحة مجموعتك لجميع طلاب ريتاجت للحصول على تقييمات الطلاب ودعم آلاف الدارسين حول العالم.",
            "المشاركة المحصورة بالصف: قصر الوصول إلى البطاقات على طلاب دفعتك أو غرفتك الدراسية المغلقة فقط.",
            "إلغاء المشاركة والتحكم: يمكنك تعديل محتوى البطاقات أو إلغاء نشر المجموعة في أي ثانية بضغطة زر واحدة.",
          ],
        },
      },
    ],
  },

  /* =========================================================================
     4. QUESTION BANK (/courses/question-bank)
     ========================================================================= */
  "question-bank": {
    toolKey: "question-bank",
    title: { en: "Mastering the Clinical Question Bank", ar: "الدليل الاحترافي لبنك الأسئلة السريرية" },
    steps: [
      {
        id: "qb-topics",
        targetSelector: '[data-tour="qb-topics"], .grid:has(button), main div:first-child',
        title: {
          en: "Clinical Vignettes & Multi-Discipline Targeting",
          ar: "الحالات السريرية وتحديد الفروع والموضوعات",
        },
        description: {
          en: "Select high-yield sub-specialties or composite organ systems. Every question is structured as a realistic patient case vignette with vital signs, physical examination findings, and lab values.",
          ar: "حدد الفروع السريرية الدقيقة أو الأجهزة الحيوية المركبة؛ كل سؤال مصمم كحالة مريض واقعية تضم القصة المرضية، العلامات الحيوية، الفحص السريري، والنتائج المخبرية.",
        },
        bullets: {
          en: [
            "Flexible Question Pool: Select from All Questions, Incorrect Attempts (targeted weakness remediation), or Flagged questions.",
            "Sub-Subject Granularity: Focus strictly on high-yield targets like Rheumatic Heart Disease, Arrhythmias, or Antimicrobial Therapy.",
          ],
          ar: [
            "بنك أسئلة متدرج: اختر بين دراسة جميع الأسئلة، أو التركيز على إجاباتك الخاطئة السابقة لتصحيح نقاط الضعف، أو مراجعة الأسئلة المميزة بعلامة (Flagged).",
            "دقة التخصيص: ركّز على عناوين محددة كالحمى الروماتيزمية، اضطرابات النظم، أو مضادات الميكروبات.",
          ],
        },
      },
      {
        id: "qb-mode",
        targetSelector: '[data-tour="qb-modes"], div:has(button:contains("Study"))',
        fallbackSelector: "main",
        title: {
          en: "Tutor Study Mode vs Timed Exam Simulation",
          ar: "وضع الدراسة التعليمي مقابل محاكاة الاختبار التنازلي",
        },
        description: {
          en: "Toggle between learning mode and authentic exam conditioning depending on your revision timeline.",
          ar: "اختر بين وضع الاستيعاب المعرفي التدريجي، وبين وضع الضغط الزمني لتدريب النفس على ظروف الاختبار الحقيقية.",
        },
        bullets: {
          en: [
            "Study Mode (Tutor): Ideal for initial revision. Provides immediate verdict, reveals correct mechanisms, and unrolls pedagogical rationale panels.",
            "Exam Mode: Real-time countdown timer, locked answers, and hidden explanations to test endurance and pace management.",
          ],
          ar: [
            "وضع الدراسة (المعلّم الفوري): مثالي لمرحلة الحفظ والاستيعاب؛ يقدم تصحيحاً فورياً وشرحاً متكاملاً بعد كل خيار.",
            "وضع الامتحان: مؤقت تنازلي حقيقي، وحجب للإجابات والشروحات حتى إنهاء الاختبار لتدريبك على إدارة وقت الامتحان الرسمي.",
          ],
        },
      },
      {
        id: "qb-explanations",
        targetSelector: '[data-tour="qb-start"], button.magnetic-cta, button:has(svg)',
        title: {
          en: "Deep Clinical Rationales & Distractor Analysis",
          ar: "التعليلات الطبية المفصلة وتحليل الخيارات الخاطئة",
        },
        description: {
          en: "RitaJet explanations don't just state the right choice — they dissect the diagnostic reasoning, Jones criteria, clinical algorithms, and explain exactly why each distractor is clinically invalid.",
          ar: "شروحات ريتاجت لا تكتفي بذكر الجواب الصحيح، بل تحلل المسار التشخيصي كاملاً، وتوضح معايير التشخيص المعتمدة، وتعلل سبب استبعاد كل خيار خاطئ بدقة متناهية.",
        },
      },
    ],
  },

  /* =========================================================================
     5. MEMORY LAB (/study/match)
     ========================================================================= */
  "memory-lab": {
    toolKey: "memory-lab",
    title: { en: "Memory Lab & Dual-Coding Retention", ar: "مختبر الذاكرة والربط المعرفي المزدوج" },
    steps: [
      {
        id: "ml-modes",
        targetSelector: '[data-tour="ml-modes"], .grid:has(button)',
        title: {
          en: "Neuro-Associative Modes: Match, Speed, & Recall",
          ar: "أنماط الربط العصبي: المطابقة، السرعة، والاسترجاع",
        },
        description: {
          en: "Engineered to convert volatile, hard-to-memorize pairs (drugs & indications, microbial strains & virulence factors, enzymes & cofactors) into instant reflex associations.",
          ar: "مصمم خصيصاً لتثبيت الثنائيات الطبية سريعة النسيان (أدوية واستطبابات، بكتيريا وعوامل ضراوة، إنزيمات ومعاملات حيوية) وتحويلها إلى استجابات فورية وتلقائية.",
        },
        bullets: {
          en: [
            "Match Round: Build initial associative links without time pressure.",
            "Speed Round: High-intensity countdown forcing rapid subconscious pattern recognition.",
            "Recall Mode: Tiles reveal after mental recall, strengthening synaptic retrieval pathways.",
          ],
          ar: [
            "نمط المطابقة: تكوين الروابط الذهنية الأولى بهدوء وتركيز.",
            "جولة السرعة: منافسة الوقت لتدريب الدماغ على تمييز الأنماط السريرية واستدعاء الدواء فور رؤية المرض.",
            "نمط الاسترجاع: إخفاء البطاقة المقابلة حتى تذكرها ذهنياً لتقوية مسارات الذاكرة العميقة.",
          ],
        },
      },
    ],
  },

  /* =========================================================================
     6. PDF SUMMARY (/study/pdf)
     ========================================================================= */
  "pdf-summary": {
    toolKey: "pdf-summary",
    title: { en: "High-Yield One-Page PDF Synthesis", ar: "التلخيص المركز للأوراق والمحاضرات الطبية" },
    steps: [
      {
        id: "pdf-synthesis",
        targetSelector: '[data-tour="pdf-dropzone"], main',
        title: {
          en: "Clinical Distillation & High-Yield Pearls",
          ar: "التقطير السريري واستخلاص الدرر الامتحانية",
        },
        description: {
          en: "Upload dense medical lecture PDFs (50-100 slides) and watch Rita AI synthesize them into an elegant, high-yield single sheet highlighting diagnostic triads, pathognomonic signs, and key clinical pearls.",
          ar: "ارفع عروض المحاضرات الطبية الكثيفة (50 إلى 100 شريحة)، ودع ريتا تستخلص منها زبدة المنهج في ورقة واحدة منظمة تبرز الثلاثيات التشخيصية، والعلامات الفارقة، والنقاط الامتحانية الحاسمة.",
        },
      },
    ],
  },

  /* =========================================================================
     7. TO-DO LIST (/study/todo)
     ========================================================================= */
  todo: {
    toolKey: "todo",
    title: { en: "Systematic Study Planning & Streaks", ar: "مخطط المذاكرة المنظم وسلاسل الالتزام" },
    steps: [
      {
        id: "todo-planner",
        targetSelector: '[data-tour="todo-tasks"], main',
        title: {
          en: "Goal Setting & Revision Habit Tracking",
          ar: "تحديد الأهداف ومتابعة عادة المراجعة اليومية",
        },
        description: {
          en: "Prioritize daily chapters, track your review quota, and protect your revision streak to maintain consistent compounding study momentum.",
          ar: "رتّب مهام يومك حسب الأولوية القصوى، وتابع إنجاز حصتك اليومية، وحافظ على سلسلة أيامك المتتالية لترسيخ عادات التفوق الدراسي.",
        },
      },
    ],
  },

  /* =========================================================================
     8. EXAMS (/study/exams)
     ========================================================================= */
  exams: {
    toolKey: "exams",
    title: { en: "Exam Countdown & Revision Milestones", ar: "جدول الامتحانات والعد التنازلي التكتيكي" },
    steps: [
      {
        id: "exams-countdown",
        targetSelector: '[data-tour="exams-view"], main',
        title: {
          en: "Visual Milestone Tracking & Pacing",
          ar: "التخطيط الزمني التكتيكي قبل أيام الاختبار",
        },
        description: {
          en: "Plot major finals and midterms on a clean month matrix with live day-by-day countdowns to ensure balanced, zero-cramming syllabus coverage.",
          ar: "ضع امتحاناتك النهائية والنصفي على مصفوفة شهرية واضحة مع عداد تنازلي يومي لمنع تراكم المنهج وضمان إنهائه قبل الامتحانات بوقت كافٍ.",
        },
      },
    ],
  },

  /* =========================================================================
     9. ALL-IN-ONE (/study/all-in-one)
     ========================================================================= */
  "all-in-one": {
    toolKey: "all-in-one",
    title: { en: "All-in-One Multi-Pass AI Studio", ar: "استوديو ريتا الشامل متعدد المعالجة" },
    steps: [
      {
        id: "aio-studio",
        targetSelector: '[data-tour="aio-studio"], main',
        title: {
          en: "One Upload · Complete Academic Package",
          ar: "رفع واحد · حزمة أكاديمية متكاملة بضغطة واحدة",
        },
        description: {
          en: "Transform raw lecture files in a single pass into a structured 1-page summary, 25+ SM-2 spaced repetition cards, and verified practice MCQs with clinical explanations.",
          ar: "حوّل ملف المحاضرة في ثوانٍ معدودة إلى ورقة ملخص مركزة، وأكثر من 25 بطاقة فلاش كارد مبرمجة، وبنك أسئلة امتحانية مصحوبة بالشرح السريري.",
        },
      },
    ],
  },

  /* =========================================================================
     10. LECTURE LAB (/study/lectures)
     ========================================================================= */
  "lecture-lab": {
    toolKey: "lecture-lab",
    title: { en: "Synchronized Lecture Checkpoints", ar: "مختبر المحاضرات والاختبارات المتزامنة" },
    steps: [
      {
        id: "lecture-interactive",
        targetSelector: '[data-tour="lecture-main"], main',
        title: {
          en: "Active Retrieval During Lecture Playback",
          ar: "الاسترجاع النشط المتزامن مع وقت الشرح",
        },
        description: {
          en: "Generate checkpoint quizzes anchored to exact timestamps in lecture audio or slides to transform passive listening into active cognitive retention.",
          ar: "توليد أسئلة ونقاط فحص مرتبطة بالدقيقة والثانية من وقت شرح المحاضرة، لتحويل الاستماع السلبي إلى تركيز واستيعاب تفاعلي مستمر.",
        },
      },
    ],
  },

  /* =========================================================================
     11. GERMAN LAB (/german)
     ========================================================================= */
  "german-lab": {
    toolKey: "german-lab",
    title: { en: "German Medical & Vocabulary Mastery", ar: "مختبر الألمانية والمصطلحات التخصصية" },
    steps: [
      {
        id: "german-taxonomy",
        targetSelector: '[data-tour="german-tools"], main',
        title: {
          en: "One Shared Shelf: der · die · das & Syntax",
          ar: "رف الكلمات الموحد: أدوات التعريف der/die/das وبناء الجمل",
        },
        description: {
          en: "Store a German word once to power article practice, audio pronunciation coaching, and grammatical sentence building without repetitive data entry.",
          ar: "احفظ الكلمة الألمانية لمرة واحدة لتغذي تلقائياً ألعاب أدوات التعريف der/die/das، وتدريب مخارج الحروف، وتركيب الجمل النحوية بدقة واحترافية.",
        },
      },
    ],
  },
};

export function getTourForTool(toolKey?: string): PageTourDef {
  if (toolKey && TOURS[toolKey]) {
    return TOURS[toolKey]!;
  }
  return TOURS.flashcards!;
}
