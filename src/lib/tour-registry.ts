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
  flashcards: {
    toolKey: "flashcards",
    title: { en: "How Flashcards & Study Space Work", ar: "كيف تعمل البطاقات ومساحة الدراسة" },
    steps: [
      {
        id: "shelf",
        targetSelector: '[data-tour="subject-shelf"]',
        fallbackSelector: ".min-w-0:has(input[type='search']), main, #root",
        title: {
          en: "Your Subject Shelf & Sub-Subjects",
          ar: "رف المواد والموضوعات الفرعية",
        },
        description: {
          en: "This is your main study library. All your cards live inside structured subjects and sub-subjects.",
          ar: "هذه مكتبتك الدراسية الرئيسية. تُنظم جميع بطاقاتك داخل مواد وموضوعات فرعية دقيقة.",
        },
        bullets: {
          en: [
            "Use the Search bar to instantly find any lecture or topic.",
            "Tick one or more sub-subjects to combine them into a custom revision set.",
            "Tap any topic to see how many cards are currently ready or due.",
          ],
          ar: [
            "استخدم شريط البحث للعثور الفوري على أي محاضرة أو موضوع.",
            "حدد مادة فرعية واحدة أو أكثر لدمجها معاً في جلسة مراجعة مشتركة.",
            "اضغط على أي موضوع لمعرفة عدد البطاقات الجاهزة أو المستحقة.",
          ],
        },
      },
      {
        id: "launch",
        targetSelector: '[data-tour="launch-panel"]',
        fallbackSelector: "aside:has(button), .lg\\:sticky, [class*='LaunchPanel']",
        title: {
          en: "Study Modes & SM-2 Smart Review",
          ar: "أنماط المذاكرة والمراجعة الذكية (SM-2)",
        },
        description: {
          en: "Launch your session with complete control over how your memory is tested.",
          ar: "ابدأ جلسة المراجعة باختيار النمط الأنسب لمرحلة استذكارك.",
        },
        bullets: {
          en: [
            "Study Mode: Open practice run through your cards without affecting your review intervals.",
            "Shuffle & Study: Randomizes card order to prevent order-bias memory.",
            "Smart Review: Powered by the SuperMemo SM-2 algorithm. It schedules each card's next repetition (10m, 1d, 6d, etc.) based on your recall accuracy.",
          ],
          ar: [
            "وضع الدراسة: تدريب حر عبر البطاقات دون التأثير على فترات المراجعة المجدولة.",
            "خلط ودراسة: ترتيب عشوائي للبطاقات لكسر حفظ الترتيب وترسيخ الفهم الحقيقي.",
            "المراجعة الذكية: مدعومة بخوارزمية SuperMemo SM-2 العالمية؛ تُحدد الموعد المثالي لكل بطاقة (10 دقائق، يوم، 6 أيام...) لمنع النسيان.",
          ],
        },
      },
      {
        id: "view-mode",
        targetSelector: '[data-tour="mode-switch"]',
        fallbackSelector: "header .grid, .rita-tile",
        title: {
          en: "Study View vs Edit & Adjust View",
          ar: "وضع المذاكرة مقابل وضع التعديل والإضافة",
        },
        description: {
          en: "Easily switch between focusing on learning and managing your card collection.",
          ar: "تنقل بمرونة بين التركيز على الحفظ وبين تنظيم وكتابة بطاقاتك.",
        },
        bullets: {
          en: [
            "Study view: A distraction-free environment dedicated to active recall.",
            "Edit and adjust view: Unlock tools to add new subjects, import decks, and write custom flashcards.",
          ],
          ar: [
            "وضع المذاكرة: بيئة هادئة خالية من المشتتات مخصصة للاسترجاع النشط.",
            "وضع التعديل والإضافة: يفتح أدوات إضافة المواد، واستيراد المجموعات، وكتابة بطاقات جديدة.",
          ],
        },
        actionPrompt: {
          label: {
            en: "Switch to Edit View to explore →",
            ar: "انتقل لوضع التعديل للاستكشاف ←",
          },
          actionId: "toggle-edit-mode",
        },
      },
      {
        id: "rail",
        targetSelector: '[data-tour="study-rail"]',
        fallbackSelector: "aside",
        title: {
          en: "Quick Actions Rail",
          ar: "شريط الإجراءات السريعة",
        },
        description: {
          en: "Use these handy buttons on the left to quickly add subjects, nest sub-topics, or manage your deck folders.",
          ar: "استخدم هذه الأزرار السريعة على الجانب لإضافة مواد جديدة، وتفريع موضوعات، وإدارة مجموعاتك بسهولة.",
        },
        bullets: {
          en: [
            "Add Subject: Create top-level courses (e.g., Cardiology, Pharmacology).",
            "Add Sub-Subject: Break down big courses into bite-sized lectures.",
          ],
          ar: [
            "إضافة مادة: أنشئ المواد الكبرى (مثل: أمراض القلب، علم الأدوية).",
            "إضافة مادة فرعية: قسّم المادة إلى محاضرات ووحدات دراسية مركزة.",
          ],
        },
      },
    ],
  },

  "question-bank": {
    toolKey: "question-bank",
    title: { en: "How Question Bank Works", ar: "كيف يعمل بنك الأسئلة" },
    steps: [
      {
        id: "qb-topics",
        targetSelector: '[data-tour="qb-topics"], .grid:has(button), main div:first-child',
        title: { en: "Select Subjects & Topics", ar: "تحديد المواد والموضوعات" },
        description: {
          en: "Pick the exact subjects and sub-topics you want to include in your question session.",
          ar: "اختر المواد والموضوعات الفرعية الدقيقة التي تريد اختبار نفسك فيها.",
        },
        bullets: {
          en: [
            "Tick individual chapters or test the whole course at once.",
            "Live counters show how many questions are available for your selection.",
          ],
          ar: [
            "حدد فصولاً معينة أو اختبر المنهج كاملاً دفعة واحدة.",
            "عدادات حية تُظهر عدد الأسئلة المتوفرة لكل اختيار.",
          ],
        },
      },
      {
        id: "qb-mode",
        targetSelector: '[data-tour="qb-modes"], div:has(button:contains("Study"))',
        fallbackSelector: "main",
        title: { en: "Study Mode vs Exam Mode", ar: "وضع الدراسة مقابل وضع الامتحان" },
        description: {
          en: "Choose how you want to be tested:",
          ar: "اختر أسلوب الاختبار المناسب لاحتياجك:",
        },
        bullets: {
          en: [
            "Study Mode: Instant feedback and full medical explanations right after every single answer.",
            "Exam Mode: Simulates real board exams with a live countdown timer and complete score breakdown at the end.",
          ],
          ar: [
            "وضع الدراسة: تصحيح فوري وشرح سريري مفصل فور اختيارك لكل إجابة.",
            "وضع الامتحان: يحاكي الاختبارات الحقيقية بمؤقت تنازلي وتقرير نهائي بالدرجات ونقاط الضعف.",
          ],
        },
      },
      {
        id: "qb-explanations",
        targetSelector: '[data-tour="qb-start"], button.magnetic-cta, button:has(svg)',
        title: { en: "Instant Explanations & Notes", ar: "الشروح السريرية وحفظ الملاحظات" },
        description: {
          en: "Every question comes with verified rationales explaining why the correct answer is right and why distractors are wrong.",
          ar: "كل سؤال مدعوم بتعليل سريري معتمد يوضح سبب صحة الإجابة وسبب خطأ الخيارات الأخرى.",
        },
      },
    ],
  },

  "memory-lab": {
    toolKey: "memory-lab",
    title: { en: "How Memory Lab Works", ar: "كيف يعمل مختبر الذاكرة" },
    steps: [
      {
        id: "ml-modes",
        targetSelector: '[data-tour="ml-modes"], .grid:has(button)',
        title: { en: "Choose Your Game Mode", ar: "اختر نمط اللعبة" },
        description: {
          en: "Reinforce hard-to-memorize pairs (drugs & indications, anatomy & nerves, terms & definitions).",
          ar: "ثبّت المعلومات المزدوجة المعقدة (أدوية واستطبابات، تشريح وأعصاب، مصطلحات وتعريفات).",
        },
        bullets: {
          en: [
            "Match: Connect two halves at your own pace.",
            "Speed Round: Race against the clock to build instant recall reflexes.",
            "Recall: Test your memory before the tiles flip.",
          ],
          ar: [
            "المطابقة: اربط بين نصفي المعلومة بتركيز وهدوء.",
            "جولة السرعة: نافس الوقت لتطوير سرعة الاسترجاع الذهني.",
            "الاسترجاع: اختبر تذكرك قبل ظهور الخيارات.",
          ],
        },
      },
      {
        id: "ml-tiles",
        targetSelector: '[data-tour="ml-board"], main',
        title: { en: "Tap Matching Tiles", ar: "اضغط على الأزواج المتطابقة" },
        description: {
          en: "Tap a tile from the first column and its matching pair. Correct matches glow green and boost your combo score.",
          ar: "اضغط على البطاقة وما يطابقها؛ الإجابة الصحيحة تضيء بالأخضر وتزيد نقاطك التراكمية.",
        },
      },
    ],
  },

  "pdf-summary": {
    toolKey: "pdf-summary",
    title: { en: "How PDF Summary Works", ar: "كيف يعمل ملخص الـ PDF" },
    steps: [
      {
        id: "pdf-upload",
        targetSelector: '[data-tour="pdf-dropzone"], div:has(input[type="file"]), main',
        title: { en: "Upload Lecture PDF or Notes", ar: "رفع ملف المحاضرة أو الملاحظات" },
        description: {
          en: "Drop any medical or academic lecture PDF directly into the studio.",
          ar: "اسحب أي ملف محاضرة PDF طبية أو دراسية مباشرة إلى لوحة المعالجة.",
        },
      },
      {
        id: "pdf-generate",
        targetSelector: '[data-tour="pdf-options"], button:has(svg)',
        title: { en: "High-Yield One-Page Sheets", ar: "توليد ورقة ملخص مركزة" },
        description: {
          en: "Rita extracts the key clinical pearls, mechanisms, and high-yield bullet points into a clean, printable sheet.",
          ar: "تستخرج ريتا أهم النقاط السريرية والآليات الحيوية في ورقة أنيقة وواضحة قابلة للطباعة والمراجعة السريعة.",
        },
      },
    ],
  },

  todo: {
    toolKey: "todo",
    title: { en: "How Study Planner & To-Do Works", ar: "كيف تعمل خطة المهام اليومية" },
    steps: [
      {
        id: "todo-list",
        targetSelector: '[data-tour="todo-tasks"], main',
        title: { en: "Daily Revision Checklist", ar: "قائمة المراجعة اليومية" },
        description: {
          en: "Organize your study goals for today. Tick cards as you complete your revision to maintain your study streak.",
          ar: "رتّب أهدافك الدراسية لليوم؛ علّم على المهام المنجزة للمحافظة على سلسلة أيام مراجعتك المتتالية.",
        },
      },
    ],
  },

  exams: {
    toolKey: "exams",
    title: { en: "How Exam Schedule Works", ar: "كيف يعمل جدول الامتحانات" },
    steps: [
      {
        id: "exams-calendar",
        targetSelector: '[data-tour="exams-view"], main',
        title: { en: "Countdown & Calendar", ar: "العد التنازلي والتقويم" },
        description: {
          en: "Track every upcoming exam with live day countdowns and targeted revision milestones.",
          ar: "تابع كل امتحان قادم مع عداد تنازلي للأيام وخطة مراجعة مخصصة لكل مادة.",
        },
      },
    ],
  },

  "all-in-one": {
    toolKey: "all-in-one",
    title: { en: "How All-in-One Studio Works", ar: "كيف تعمل ريتا الشاملة" },
    steps: [
      {
        id: "aio-pipeline",
        targetSelector: '[data-tour="aio-studio"], main',
        title: { en: "One Upload · Everything Generated", ar: "رفع واحد · يولد كل شيء" },
        description: {
          en: "Upload a single lecture to automatically generate a 1-page summary, spaced-repetition flashcards, and practice MCQs in one pass.",
          ar: "ارفع محاضرة واحدة لتوليد ملخص مركز، وبطاقات فلاش كارد مبرمجة، وأسئلة امتحانية دفعة واحدة.",
        },
      },
    ],
  },

  "lecture-lab": {
    toolKey: "lecture-lab",
    title: { en: "How Lecture Lab Works", ar: "كيف يعمل مختبر المحاضرات" },
    steps: [
      {
        id: "lecture-quiz",
        targetSelector: '[data-tour="lecture-main"], main',
        title: { en: "Interactive Lecture Checkpoints", ar: "نقاط فحص تفاعلية أثناء المحاضرة" },
        description: {
          en: "Transform recorded lectures or slides into active quizzes and timestamped concept notes.",
          ar: "حوّل المحاضرات والشرائح إلى اختبارات قصيرة وملاحظات ذكية متزامنة مع وقت الشرح.",
        },
      },
    ],
  },

  "shared-decks": {
    toolKey: "shared-decks",
    title: { en: "How Shared Flashcards Work", ar: "كيف تعمل البطاقات المشتركة" },
    steps: [
      {
        id: "shared-explore",
        targetSelector: '[data-tour="share-decks"], main',
        title: { en: "Community Decks", ar: "مجموعات الطلاب والمجتمع" },
        description: {
          en: "Browse verified decks shared by peers and educators, or publish your own decks to help others.",
          ar: "استعرض بطاقات مميزة أعدها زملاؤك وأطباؤك، أو انشر مجموعتك الخاصة لدعم الآخرين.",
        },
      },
    ],
  },

  spaces: {
    toolKey: "spaces",
    title: { en: "How Classrooms & Spaces Work", ar: "كيف تعمل الصفوف والمجموعات" },
    steps: [
      {
        id: "spaces-groups",
        targetSelector: '[data-tour="spaces-list"], main',
        title: { en: "Study Together", ar: "الدراسة الجماعية والتنظيم" },
        description: {
          en: "Collaborate with your batchmates, share folders of decks, and follow shared study announcements.",
          ar: "تواصل مع زملائك في الدفعة، وشارك مجلدات البطاقات، وتابع إعلانات المراجعة المشتركة.",
        },
      },
    ],
  },

  "german-lab": {
    toolKey: "german-lab",
    title: { en: "How German Lab Works", ar: "كيف يعمل مختبر الألمانية" },
    steps: [
      {
        id: "german-shelf",
        targetSelector: '[data-tour="german-tools"], main',
        title: { en: "der · die · das & Audio Coaching", ar: "أدوات التعريف der/die/das واللفظ" },
        description: {
          en: "A shared shelf of German vocabulary that powers article training, pronunciation, and sentence building.",
          ar: "رف موحد للمفردات يغذي ألعاب أدوات التعريف، وتدريب اللفظ الصوتي، وبناء الجمل الصحيحة.",
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
