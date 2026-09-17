// SOP category headings are strictly patterned — "SOP 4: Temperature
// Monitoring — 3. Cooling Procedures" — so they're composed from their
// parts rather than written out 127 times per language.
//
// The "SOP N:" identifier is deliberately left untranslated in every
// language: it's a document reference back to the client's own SOP
// manual, like an invoice number, and staff need to be able to match a
// checkpoint on their phone to the numbered procedure on paper.

const AR_DIGITS = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
const toArabicDigits = (n) => String(n).split('').map((d) => AR_DIGITS[Number(d)] ?? d).join('');

const PROCEDURES = [
  {
    en: 'SOP 1: Opening', ar: 'الافتتاح', fr: 'Ouverture',
    phases: [
      { en: 'Arrival & Security Check', ar: 'الوصول والفحص الأمني', fr: 'Arrivée et contrôle de sécurité' },
      { en: 'Kitchen Equipment Startup', ar: 'تشغيل معدات المطبخ', fr: 'Mise en route des équipements' },
      { en: 'Food Safety Checks', ar: 'فحوصات سلامة الغذاء', fr: 'Contrôles de sécurité alimentaire' },
      { en: 'Station Prep & Mise en Place', ar: 'تجهيز المحطات والميز أون بلاس', fr: 'Préparation des postes et mise en place' },
      { en: 'Dining Room Setup', ar: 'تجهيز صالة الطعام', fr: 'Mise en place de la salle' },
      { en: 'Pre-Service Meeting', ar: 'اجتماع ما قبل الخدمة', fr: 'Briefing avant service' },
      { en: 'Final Checklist', ar: 'قائمة الفحص النهائية', fr: 'Check-list finale' },
      { en: 'Open for Service', ar: 'الفتح للخدمة', fr: 'Ouverture au service' },
    ],
  },
  {
    en: 'SOP 2: Closing', ar: 'الإغلاق', fr: 'Fermeture',
    phases: [
      { en: 'Kitchen Breakdown & Cleaning', ar: 'تفكيك المطبخ وتنظيفه', fr: 'Démontage et nettoyage de la cuisine' },
      { en: 'Dining Room Closing', ar: 'إغلاق صالة الطعام', fr: 'Fermeture de la salle' },
      { en: 'Equipment Shutdown', ar: 'إيقاف تشغيل المعدات', fr: 'Arrêt des équipements' },
      { en: 'Cash Handling & POS Closing', ar: 'التعامل النقدي وإغلاق نقاط البيع', fr: 'Gestion des espèces et clôture de caisse' },
      { en: 'Food Storage Final Check', ar: 'الفحص النهائي لتخزين الأغذية', fr: 'Contrôle final du stockage' },
      { en: 'Prep for Next Day', ar: 'التحضير لليوم التالي', fr: 'Préparation du lendemain' },
      { en: 'Security & Final Walkthrough', ar: 'الأمن والجولة الأخيرة', fr: 'Sécurité et ronde finale' },
    ],
  },
  {
    en: 'SOP 3: Receiving & Storage', ar: 'الاستلام والتخزين', fr: 'Réception et stockage',
    phases: [
      { en: 'Delivery Acceptance', ar: 'قبول التسليم', fr: 'Acceptation de la livraison' },
      { en: 'Product Inspection', ar: 'فحص المنتجات', fr: 'Inspection des produits' },
      { en: 'Immediate Storage', ar: 'التخزين الفوري', fr: 'Stockage immédiat' },
      { en: 'Storage by Type', ar: 'التخزين حسب النوع', fr: 'Stockage par catégorie' },
      { en: 'Labeling & Dating', ar: 'الوسم والتأريخ', fr: 'Étiquetage et datage' },
      { en: 'FIFO Rotation', ar: 'دوران الوارد أولًا صادر أولًا', fr: 'Rotation PEPS' },
      { en: 'Documentation', ar: 'التوثيق', fr: 'Documentation' },
    ],
  },
  {
    en: 'SOP 4: Temperature Monitoring', ar: 'مراقبة درجات الحرارة', fr: 'Contrôle des températures',
    phases: [
      { en: 'Equipment Calibration', ar: 'معايرة المعدات', fr: 'Étalonnage des équipements' },
      { en: 'Temperature Checking During Cooking', ar: 'قياس الحرارة أثناء الطهي', fr: 'Contrôle des températures en cuisson' },
      { en: 'Cooling Procedures', ar: 'إجراءات التبريد', fr: 'Procédures de refroidissement' },
      { en: 'Reheating for Hot Holding', ar: 'إعادة التسخين للحفظ الساخن', fr: 'Remise en température pour maintien au chaud' },
      { en: 'Hot Holding Monitoring', ar: 'مراقبة الحفظ الساخن', fr: 'Surveillance du maintien au chaud' },
      { en: 'Cold Holding Monitoring', ar: 'مراقبة الحفظ البارد', fr: 'Surveillance du maintien au froid' },
      { en: 'Time as Public Health Control', ar: 'الزمن كوسيلة لضبط الصحة العامة', fr: 'Le temps comme moyen de maîtrise sanitaire' },
    ],
  },
  {
    en: 'SOP 5: Handwashing & Hygiene', ar: 'غسل اليدين والنظافة الشخصية', fr: 'Lavage des mains et hygiène',
    phases: [
      { en: 'Handwashing', ar: 'غسل اليدين', fr: 'Lavage des mains' },
      { en: 'Personal Hygiene Standards', ar: 'معايير النظافة الشخصية', fr: "Normes d'hygiène personnelle" },
      { en: 'Illness Policy', ar: 'سياسة المرض', fr: 'Politique en cas de maladie' },
      { en: 'Glove Use', ar: 'استخدام القفازات', fr: 'Port des gants' },
    ],
  },
  {
    en: 'SOP 6: Greeting & Seating', ar: 'الاستقبال والإجلاس', fr: 'Accueil et placement',
    phases: [
      { en: 'Greeting', ar: 'الترحيب', fr: 'Accueil' },
      { en: 'Party Assessment', ar: 'تقييم المجموعة', fr: 'Évaluation du groupe' },
      { en: 'Wait Management', ar: 'إدارة الانتظار', fr: "Gestion de l'attente" },
      { en: 'Table Selection', ar: 'اختيار الطاولة', fr: 'Choix de la table' },
      { en: 'Seating', ar: 'الإجلاس', fr: 'Placement' },
      { en: 'Server Notification', ar: 'إبلاغ عامل الخدمة', fr: 'Information du serveur' },
      { en: 'Server Greeting', ar: 'ترحيب عامل الخدمة', fr: 'Accueil par le serveur' },
    ],
  },
  {
    en: 'SOP 7: Order Taking & POS', ar: 'أخذ الطلبات ونقاط البيع', fr: 'Prise de commande et caisse',
    phases: [
      { en: 'Return with Beverages', ar: 'العودة بالمشروبات', fr: 'Retour avec les boissons' },
      { en: 'Taking Orders', ar: 'أخذ الطلبات', fr: 'Prise des commandes' },
      { en: 'Key Questions', ar: 'الأسئلة الأساسية', fr: 'Questions clés' },
      { en: 'Allergy Alerts', ar: 'تنبيهات الحساسية', fr: 'Alertes allergies' },
      { en: 'Upselling', ar: 'البيع الإضافي', fr: 'Vente additionnelle' },
      { en: 'Repeat Order Back', ar: 'إعادة الطلب للتأكيد', fr: 'Répétition de la commande' },
      { en: 'POS Entry', ar: 'إدخال الطلب في نقطة البيع', fr: 'Saisie en caisse' },
    ],
  },
  {
    en: 'SOP 8: Food Running & Service', ar: 'تقديم الطعام والخدمة', fr: 'Envoi des plats et service',
    phases: [
      { en: 'When Food is Ready', ar: 'عند جاهزية الطعام', fr: 'Quand le plat est prêt' },
      { en: 'Tray Loading', ar: 'تحميل الصينية', fr: 'Chargement du plateau' },
      { en: 'Table Approach', ar: 'الاقتراب من الطاولة', fr: 'Approche de la table' },
      { en: 'Food Delivery', ar: 'تقديم الطعام', fr: 'Service du plat' },
      { en: 'Final Check', ar: 'الفحص النهائي', fr: 'Vérification finale' },
      { en: 'Two-Minute Check-Back', ar: 'المتابعة بعد دقيقتين', fr: 'Retour à table après deux minutes' },
    ],
  },
  {
    en: 'SOP 9: Complaint Handling', ar: 'التعامل مع الشكاوى', fr: 'Traitement des réclamations',
    phases: [
      { en: 'Listen Actively', ar: 'الإنصات الفعّال', fr: 'Écoute active' },
      { en: 'Empathize & Apologize', ar: 'التعاطف والاعتذار', fr: 'Empathie et excuses' },
      { en: 'Ask Clarifying Questions', ar: 'طرح أسئلة توضيحية', fr: 'Questions de clarification' },
      { en: 'Take Immediate Action', ar: 'اتخاذ إجراء فوري', fr: 'Action immédiate' },
      { en: 'Involve Manager', ar: 'إشراك المدير', fr: 'Intervention du responsable' },
      { en: 'Follow Up', ar: 'المتابعة', fr: 'Suivi' },
      { en: 'Documentation', ar: 'التوثيق', fr: 'Documentation' },
      { en: 'Compensation Guidelines', ar: 'إرشادات التعويض', fr: 'Règles de geste commercial' },
    ],
  },
  {
    en: 'SOP 10: Cash Handling', ar: 'التعامل النقدي', fr: 'Gestion des espèces',
    phases: [
      { en: 'Starting Cash Drawer', ar: 'فتح درج النقد', fr: 'Fonds de caisse initial' },
      { en: 'Processing Cash Payments', ar: 'معالجة المدفوعات النقدية', fr: 'Encaissement des espèces' },
      { en: 'Processing Credit Cards', ar: 'معالجة البطاقات الائتمانية', fr: 'Paiements par carte' },
      { en: 'Handling Large Bills', ar: 'التعامل مع الأوراق النقدية الكبيرة', fr: 'Gestion des grosses coupures' },
      { en: 'Till Drops', ar: 'إيداعات الخزنة', fr: 'Prélèvements de caisse' },
      { en: 'Closing Cash Drawer', ar: 'إغلاق درج النقد', fr: 'Clôture de la caisse' },
      { en: 'Cash Handling Security', ar: 'أمن التعامل النقدي', fr: 'Sécurité des espèces' },
    ],
  },
  {
    en: 'SOP 11: Health Inspection Readiness', ar: 'الجاهزية لتفتيش الصحة', fr: 'Préparation au contrôle sanitaire',
    phases: [
      { en: 'Temperature Monitoring', ar: 'مراقبة درجات الحرارة', fr: 'Contrôle des températures' },
      { en: 'Food Storage', ar: 'تخزين الأغذية', fr: 'Stockage des denrées' },
      { en: 'Personal Hygiene', ar: 'النظافة الشخصية', fr: 'Hygiène personnelle' },
      { en: 'Cleaning & Sanitation', ar: 'التنظيف والتطهير', fr: 'Nettoyage et désinfection' },
      { en: 'Equipment Maintenance', ar: 'صيانة المعدات', fr: 'Entretien des équipements' },
      { en: 'Facility Conditions', ar: 'حالة المنشأة', fr: 'État des locaux' },
      { en: 'Documentation', ar: 'التوثيق', fr: 'Documentation' },
      { en: 'When Inspector Arrives', ar: 'عند وصول المفتش', fr: "À l'arrivée de l'inspecteur" },
    ],
  },
  {
    en: 'SOP 12: Recipe Standardization', ar: 'توحيد الوصفات', fr: 'Standardisation des recettes',
    phases: [
      { en: 'Recipe Adherence', ar: 'الالتزام بالوصفة', fr: 'Respect de la recette' },
      { en: 'Portion Control', ar: 'ضبط الحصص', fr: 'Maîtrise des portions' },
      { en: 'Presentation Check', ar: 'فحص التقديم', fr: 'Contrôle du dressage' },
      { en: 'Recipe Rollout Training', ar: 'التدريب على إطلاق الوصفات', fr: 'Formation au lancement des recettes' },
      { en: 'Spot Checks', ar: 'الفحوصات العشوائية', fr: 'Contrôles ponctuels' },
    ],
  },
  {
    en: 'SOP 13: Cleaning & Sanitizing', ar: 'التنظيف والتطهير', fr: 'Nettoyage et désinfection',
    phases: [
      { en: 'During-Service Sanitizing', ar: 'التطهير أثناء الخدمة', fr: 'Désinfection pendant le service' },
      { en: 'Daily Equipment Cleaning', ar: 'التنظيف اليومي للمعدات', fr: 'Nettoyage quotidien des équipements' },
      { en: 'Daily Floors & Drains', ar: 'الأرضيات والمصارف يوميًا', fr: 'Sols et siphons quotidiens' },
      { en: 'Weekly Deep Clean', ar: 'التنظيف العميق الأسبوعي', fr: 'Nettoyage approfondi hebdomadaire' },
      { en: 'Monthly Deep Clean', ar: 'التنظيف العميق الشهري', fr: 'Nettoyage approfondi mensuel' },
      { en: 'Sign-Off', ar: 'الاعتماد', fr: 'Validation' },
    ],
  },
  {
    en: 'SOP 14: Inventory & Ordering', ar: 'المخزون والطلبات', fr: 'Stocks et commandes',
    phases: [
      { en: 'Par Levels', ar: 'الحدود الدنيا للمخزون', fr: 'Niveaux de stock cibles' },
      { en: 'Scheduled Counts', ar: 'الجرد المجدول', fr: 'Inventaires planifiés' },
      { en: 'FIFO Rotation', ar: 'دوران الوارد أولًا صادر أولًا', fr: 'Rotation PEPS' },
      { en: 'Ordering Discipline', ar: 'انضباط الطلبات', fr: 'Discipline de commande' },
      { en: 'Delivery Reconciliation', ar: 'مطابقة التسليم', fr: 'Rapprochement des livraisons' },
      { en: 'Par Level Review', ar: 'مراجعة الحدود الدنيا', fr: 'Révision des niveaux cibles' },
    ],
  },
  {
    en: 'SOP 15: Waste & Cost Control', ar: 'ضبط الهدر والتكلفة', fr: 'Maîtrise des pertes et des coûts',
    phases: [
      { en: 'Waste Logging', ar: 'تسجيل الهدر', fr: 'Enregistrement des pertes' },
      { en: 'Pattern Review', ar: 'مراجعة الأنماط', fr: 'Analyse des tendances' },
      { en: 'Prep Calibration', ar: 'ضبط كميات التحضير', fr: 'Ajustement des quantités préparées' },
      { en: 'Repurposing', ar: 'إعادة الاستخدام', fr: 'Revalorisation' },
      { en: 'Menu Review', ar: 'مراجعة القائمة', fr: 'Revue de la carte' },
    ],
  },
  {
    en: 'SOP 16: Alcohol Service', ar: 'تقديم الكحول', fr: "Service d'alcool",
    phases: [
      { en: 'Carding', ar: 'التحقق من العمر', fr: "Contrôle de l'âge" },
      { en: 'ID Verification', ar: 'التحقق من الهوية', fr: "Vérification de la pièce d'identité" },
      { en: 'Suspicious ID', ar: 'الهوية المشبوهة', fr: 'Pièce suspecte' },
      { en: 'Intoxication Monitoring', ar: 'مراقبة حالات السكر', fr: "Surveillance de l'ébriété" },
      { en: 'Refusing Service', ar: 'رفض التقديم', fr: 'Refus de servir' },
      { en: 'Server Certification', ar: 'شهادة عامل الخدمة', fr: 'Certification du personnel' },
    ],
  },
  {
    en: 'SOP 17: Allergen Awareness', ar: 'الوعي بمسببات الحساسية', fr: 'Vigilance allergènes',
    phases: [
      { en: 'Staff Training', ar: 'تدريب الموظفين', fr: 'Formation du personnel' },
      { en: 'Guest Communication', ar: 'التواصل مع الضيوف', fr: 'Communication avec le client' },
      { en: 'Cross-Contact Prevention', ar: 'منع التلامس المتبادل', fr: 'Prévention du contact croisé' },
      { en: 'Order Communication', ar: 'إبلاغ الطلب', fr: 'Transmission de la commande' },
      { en: 'Emergency Response', ar: 'الاستجابة للطوارئ', fr: "Réaction d'urgence" },
    ],
  },
  {
    en: 'SOP 18: Emergency Procedures', ar: 'إجراءات الطوارئ', fr: "Procédures d'urgence",
    phases: [
      { en: 'Fire Response', ar: 'الاستجابة للحريق', fr: 'Réaction incendie' },
      { en: 'Choking Response', ar: 'الاستجابة للاختناق', fr: 'Réaction en cas d’étouffement' },
      { en: 'Injury & First Aid', ar: 'الإصابات والإسعافات الأولية', fr: 'Blessures et premiers secours' },
      { en: 'Equipment Readiness', ar: 'جاهزية المعدات', fr: 'Disponibilité du matériel' },
      { en: 'Staff Readiness', ar: 'جاهزية الموظفين', fr: 'Préparation du personnel' },
      { en: 'Drills', ar: 'التدريبات', fr: 'Exercices' },
    ],
  },
  {
    en: 'SOP 19: Onboarding & Training', ar: 'التعيين والتدريب', fr: 'Intégration et formation',
    phases: [
      { en: 'Pre-Boarding', ar: 'ما قبل الالتحاق', fr: 'Avant la prise de poste' },
      { en: 'Day-One Orientation', ar: 'توجيه اليوم الأول', fr: 'Accueil du premier jour' },
      { en: 'Compliance Paperwork', ar: 'المستندات النظامية', fr: 'Documents réglementaires' },
      { en: 'Role Training', ar: 'التدريب على الدور', fr: 'Formation au poste' },
      { en: 'Mentor Assignment', ar: 'تعيين مرشد', fr: "Attribution d'un tuteur" },
      { en: 'Milestone Check-Ins', ar: 'مراجعات المراحل', fr: 'Points d’étape' },
    ],
  },
  {
    en: 'SOP 20: Manager Shift Duties', ar: 'مهام المدير في الوردية', fr: 'Missions du manager en service',
    phases: [
      { en: 'Opening', ar: 'الافتتاح', fr: 'Ouverture' },
      { en: 'Shift Briefing', ar: 'إحاطة الوردية', fr: 'Briefing de service' },
      { en: 'Mid-Shift Oversight', ar: 'الإشراف في منتصف الوردية', fr: 'Supervision en cours de service' },
      { en: 'Closing', ar: 'الإغلاق', fr: 'Fermeture' },
      { en: 'Logbook', ar: 'سجل المدير', fr: 'Cahier de liaison' },
    ],
  },
];

// Categories that don't follow the "SOP N: X — M. Y" shape.
const STANDALONE = [
  {
    en: 'Health Code Compliance — Critical Violation Checkpoints',
    ar: 'الالتزام بلائحة الصحة — بنود المخالفات الحرجة',
    fr: 'Conformité au code sanitaire — points de non-conformité critiques',
  },
];

export function sopCategoryTranslations() {
  const ar = {};
  const fr = {};

  for (const proc of PROCEDURES) {
    const [, number, englishTitle] = proc.en.match(/^(SOP \d+): (.+)$/);
    proc.phases.forEach((phase, idx) => {
      const n = idx + 1;
      const en = `${number}: ${englishTitle} — ${n}. ${phase.en}`;
      ar[en] = `${number}: ${proc.ar} — ${toArabicDigits(n)}. ${phase.ar}`;
      fr[en] = `${number} : ${proc.fr} — ${n}. ${phase.fr}`;
    });
  }

  for (const s of STANDALONE) {
    ar[s.en] = s.ar;
    fr[s.en] = s.fr;
  }

  return { ar, fr };
}
