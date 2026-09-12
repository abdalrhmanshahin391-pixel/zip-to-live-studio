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
        targetSelector: '[data-tour="subject-shelf-header"], [data-tour="subject-shelf"] input[type="search"], [data-tour="subject-shelf"]',
        fallbackSelector: '[data-tour="subject-shelf"], main',
        title: {
          en: "Hierarchical Subject Shelf & Topic Selection",
          ar: "رف المواد الهيكلي وتحديد موضوعات المراجعة",
        },
        description: {
          en: "Your personal academic library is structured into primary courses and nested sub-subjects, designed to reinforce cognitive schema formation during medical and clinical study.",
          ar: "مكتبتك الأكاديمية مبنية بنظام شجري يضم المواد الرئيسية والموضوعات الفرعية، ومصممة لترسيخ الروابط المعرفية وتسهيل استرجاع المعلومات السريرية المعقدة.",
        },
        bullets: {
          en: [
            "Smart Search: Instantly locate specific disease entities, pharmacological mechanisms, or lecture titles.",
            "Multi-Topic Combinations: Tick multiple sub-subjects across different courses to generate integrated multi-disciplinary revision sets (e.g. Cardiology Pathology + Pharmacology).",
            "Real-Time Readiness Counters: Each card badge reflects exact deck readiness — distinguishing newly added cards from cards due for immediate spaced review.",
          ],
          ar: [
            "البحث الفوري الذكي: الوصول السريع لأي مرض، آلية دوائية، أو عنوان محاضرة عبر كامل مساحتك.",
            "دمج الموضوعات المتقاطعة: حدد عدة موضوعات فرعية من مواد مختلفة لتوليد جلسة مراجعة تكاملية تجمع بين الفهم السريري والدوائي.",
            "مؤشرات الجاهزية الحية: توضح الأرقام عدد البطاقات الجاهزة والمستحقة للمراجعة الآن وفق جدولك الزمني الفعلي.",
          ],
        },
      },
      {
        id: "launch",
        targetSelector: '[data-tour="launch-panel"] .grid:has(button), [data-tour="launch-panel"]',
        fallbackSelector: "aside:has(button), .lg\\:sticky",
        title: {
          en: "SuperMemo SM-2 Algorithm & Study Modes",
          ar: "خوارزمية SM-2 العالمية وأنماط جلسات المذاكرة",
        },
        description: {
          en: "RitaJet deploys the scientifically validated SuperMemo SM-2 spaced repetition algorithm to counteract the Ebbinghaus forgetting curve, ensuring you review facts precisely when memory traces begin to decay.",
          ar: "تعتمد ريتاجت خوارزمية التكرار المتباعد SuperMemo SM-2 المعتمدة علمياً لمقاومة منحنى النسيان، لضمان مراجعة المعلومة في اللحظة الذهبية قبل اندثارها من الذاكرة طويلة المدى.",
        },
        bullets: {
          en: [
            "Smart Review (SM-2 Powered): Dynamically calculates interval expansions (10 minutes → 1 day → 6 days → multiplied by Easiness Factor EF ≥ 1.3). Cards you rate 'Hard' or 'Again' return sooner; cards you master expand into months.",
            "Free Practice Study Mode: Review any card set as a self-paced dry run without affecting your spaced repetition schedule or stability metrics.",
            "Shuffle & Study: Eliminates serial position and order-bias effects, training your mind to recall clinical facts in random presentation.",
            "Retention Strength Indicator: Real-time progress bar shows memory stability and projected retention horizon for each card.",
          ],
          ar: [
            "المراجعة الذكية (بخوارزمية SM-2): تحسب فترات المباعدة تلقائياً (10 دقائق ← 1 يوم ← 6 أيام ← ضرب معامل السهولة EF). البطاقات الصعبة تعود سريعاً، بينما المتقنة تمتد لأشهر وسنوات.",
            "وضع الدراسة الحر: مراجعة مفتوحة وتدريب تجريبي دون التأثير على مواعيد مراجعتك المجدولة أو استقرار ذاكرتك.",
            "خلط البطاقات: يكسر حفظ الترتيب النمطي، ويدرب العقل على الاسترجاع الفوري للمعلومات في أي سياق سريري أو امتحاني.",
            "مؤشر قوة الذاكرة: يوضح بدقة نسبة استقرار كل معلومة في الذاكرة والمدة الزمنية المتوقعة لبقائها.",
          ],
        },
      },
      {
        id: "view-mode",
        targetSelector: '[data-tour="mode-switch"]',
        fallbackSelector: "header .grid, .rita-tile",
        title: {
          en: "Study View vs Edit & Adjust Workspace",
          ar: "وضع المذاكرة الهادئ مقابل بيئة التحرير والتنظيم",
        },
        description: {
          en: "Seamlessly separate focused active-recall testing from deck authoring and curriculum management.",
          ar: "فصل تام ومدروس بين مرحلة التركيز والاسترجاع الذهني، وبين مرحلة كتابة وتنظيم محتوى المنهج.",
        },
        bullets: {
          en: [
            "Study View: Minimalist, calm interface engineered to maximize focus and eliminate cognitive clutter during high-intensity revision.",
            "Edit & Adjust View: Unlocks comprehensive authoring tools to create parent subjects, nest sub-topics, import external Anki/CSV decks, and compose rich-text clinical cards.",
          ],
          ar: [
            "وضع المذاكرة: واجهة انسيابية هادئة خالية من أي مشتتات لضمان أعلى مستويات التركيز أثناء الحفظ النشط.",
            "وضع التعديل والإضافة: يفتح أدوات التحرير المتقدمة لإنشاء المواد، وتفريع المحاضرات، واستيراد ملفات Anki/CSV، وكتابة البطاقات الطبية.",
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
      {
        id: "rail",
        targetSelector: '[data-tour="study-rail"]',
        fallbackSelector: "aside",
        title: {
          en: "Fast Organization & Deck Actions",
          ar: "شريط العمليات السريعة وإدارة المناهج",
        },
        description: {
          en: "Quickly expand your deck taxonomy, reorganize chapters, or export study packages directly from the side rail.",
          ar: "أدوات تحكم فورية لإضافة وحدات دراسية جديدة، وإعادة ترتيب الفصول، وإدارة بطاقاتك باحترافية.",
        },
        bullets: {
          en: [
            "Add Subject: Establishes top-level system modules (e.g., Clinical Cardiology, Respiratory Pathology).",
            "Add Sub-Subject: Nests specific lectures, diagnostic blocks, or clinical clinical guidelines within subjects.",
            "Import & Batch Management: Quickly bring in study decks or bulk-move items across subjects.",
          ],
          ar: [
            "إضافة مادة: إنشاء الفروع الطبية الكبرى (مثل: أمراض القلب السريرية، علم الأدوية، التشريح).",
            "إضافة مادة فرعية: تقسيم المادة إلى محاضرات ووحدات دراسية مركزة يسهل مراجعتها.",
            "الاستيراد والإدارة الجماعية: سحب المجموعات الجاهزة وتنسيق بنية البطاقات بسهولة وسرعة.",
          ],
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
