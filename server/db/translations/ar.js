// Arabic translations of library content, keyed by the exact English
// source string from checklist_items (text, description or category).
//
// The English rows stay the source of truth — SOP 1-11 and the QC audit
// content were transcribed from the client's own documents, so these are
// an additional view of that wording, never a replacement. Anything not
// listed here renders in English rather than blank.
//
// Every entry loads as source='machine'. Flip a row to 'reviewed' in the
// database once a native speaker has checked it and the loader will stop
// overwriting it.
import { sopCategoryTranslations } from './sopCategories.js';

export default {
  ...sopCategoryTranslations().ar,

  // --- QC audit system categories -----------------------------------
  // The A/B/C and W1/M1/Q1 letters are kept as-is: they're the client's
  // own section references in the QC Audit System document.
  'Daily QC — A. Exterior & First Impressions': 'الجودة اليومية — A. المظهر الخارجي والانطباع الأول',
  'Daily QC — B. Food Safety & Temperature Control': 'الجودة اليومية — B. سلامة الغذاء وضبط الحرارة',
  'Daily QC — C. Kitchen Hygiene & Organization': 'الجودة اليومية — C. نظافة المطبخ وتنظيمه',
  'Daily QC — D. Bar & Beverage Station': 'الجودة اليومية — D. محطة البار والمشروبات',
  'Daily QC — E. Dining Area & Guest Experience': 'الجودة اليومية — E. صالة الطعام وتجربة الضيف',
  'Daily QC — F. Staff Readiness & Service Quality': 'الجودة اليومية — F. جاهزية الفريق وجودة الخدمة',
  'Daily QC — G. Safety, Security & Compliance': 'الجودة اليومية — G. السلامة والأمن والالتزام',
  'Daily QC — H. Consumer Behavior & Insights': 'الجودة اليومية — H. سلوك المستهلك والرؤى',
  'Daily QC — K. Food Quality, Taste & Consistency': 'الجودة اليومية — K. جودة الطعام والمذاق والثبات',
  'Daily QC — L. Presentation, Plating & The Pass': 'الجودة اليومية — L. التقديم والتنسيق ومنطقة التسليم',
  'Daily QC — M. Service Choreography & Hospitality': 'الجودة اليومية — M. انسيابية الخدمة وحسن الضيافة',
  'Daily QC — N. Ingredient Quality & Sourcing': 'الجودة اليومية — N. جودة المكونات ومصادر التوريد',
  'Weekly Audit — W1. Food Cost & Financial Leakage': 'التدقيق الأسبوعي — W1. تكلفة الغذاء والتسرب المالي',
  'Weekly Audit — W2. POS Integrity & Fraud Prevention': 'التدقيق الأسبوعي — W2. نزاهة نقاط البيع ومنع الاحتيال',
  'Weekly Audit — W3. Delivery Platforms & Digital Presence': 'التدقيق الأسبوعي — W3. منصات التوصيل والحضور الرقمي',
  'Weekly Audit — W4. Deep Cleaning Verification': 'التدقيق الأسبوعي — W4. التحقق من التنظيف العميق',
  'Weekly Audit — W5. Maintenance & Asset Care': 'التدقيق الأسبوعي — W5. الصيانة والعناية بالأصول',
  'Weekly Audit — W6. People: Training & Scheduling': 'التدقيق الأسبوعي — W6. الأفراد: التدريب والجدولة',
  'Monthly Audit — M1. Legal, Licenses & Documentation': 'التدقيق الشهري — M1. الجوانب القانونية والتراخيص والمستندات',
  'Monthly Audit — M2. Menu Engineering & Profitability': 'التدقيق الشهري — M2. هندسة القائمة والربحية',
  'Monthly Audit — M3. Supplier Performance & Procurement': 'التدقيق الشهري — M3. أداء الموردين والمشتريات',
  'Monthly Audit — M4. Guest Insight, Mystery Shop & Brand': 'التدقيق الشهري — M4. رؤى الضيوف والتسوق السري والعلامة',
  'Monthly Audit — M5. Crisis Readiness & Continuity': 'التدقيق الشهري — M5. الجاهزية للأزمات واستمرارية العمل',
  'Monthly Audit — M6. People Development & Culture': 'التدقيق الشهري — M6. تطوير الأفراد وثقافة العمل',
  'Quarterly Audit — Q1. Infrastructure & Certified Inspections': 'التدقيق الربع سنوي — Q1. البنية التحتية والفحوصات المعتمدة',
  'Quarterly Audit — Q2. Strategic Performance Review': 'التدقيق الربع سنوي — Q2. مراجعة الأداء الاستراتيجي',

  // --- Starter library categories -----------------------------------
  closing: 'الإغلاق',
  equipment: 'المعدات',
  hygiene: 'النظافة',
  receiving: 'الاستلام',
  temperature: 'درجة الحرارة',
  waste: 'الهدر',

  // --- HACCP -------------------------------------------------------
  'Fridge temperature within 1-4°C': 'درجة حرارة الثلاجة بين ١ و٤ °م',
  'Raw and ready-to-eat foods stored separately': 'فصل الأطعمة النيئة عن الجاهزة للأكل في التخزين',
  'Hand-wash stations stocked with soap and towels': 'تجهيز أحواض غسل اليدين بالصابون والمناشف',
  'Food labelled with prep and use-by date': 'وسم الأطعمة بتاريخ التحضير وتاريخ الاستخدام',
  'Pest control traps checked, no signs of activity': 'فحص مصائد مكافحة الآفات دون أي علامات نشاط',
  'Waste bins covered and not overflowing': 'صناديق النفايات مغطاة وغير ممتلئة',
  'Freezer temperature at or below -18°C': 'درجة حرارة الفريزر عند -١٨ °م أو أقل',
  'Cooked food held above 63°C (hot holding)': 'حفظ الطعام المطهو فوق ٦٣ °م (الحفظ الساخن)',
  'Incoming delivery temperature checked and logged': 'قياس وتسجيل درجة حرارة الشحنات الواردة',
  'Cleaning chemicals stored away from food items': 'تخزين مواد التنظيف بعيدًا عن المواد الغذائية',

  // --- ISO 22000 ---------------------------------------------------
  'Staff food safety training records up to date': 'سجلات تدريب الموظفين على سلامة الغذاء محدّثة',
  'Critical control point records signed by supervisor': 'سجلات نقاط التحكم الحرجة موقّعة من المشرف',
  'Traceability records updated for received stock': 'تحديث سجلات التتبع للمخزون المستلم',
  'Allergen matrix displayed and current': 'جدول مسببات الحساسية معروض ومحدّث',
  'Equipment calibration log up to date': 'سجل معايرة المعدات محدّث',
  'Food safety hazard log reviewed for the shift': 'مراجعة سجل مخاطر سلامة الغذاء لهذه الوردية',

  // --- Local code --------------------------------------------------
  'First aid kit stocked and accessible': 'حقيبة الإسعافات الأولية مجهزة وسهلة الوصول',
  'Food handler permits displayed/valid': 'تصاريح متداولي الأغذية معروضة وسارية',
  'Fire extinguisher inspection tag current': 'بطاقة فحص طفاية الحريق سارية',
  'Emergency exits unobstructed': 'مخارج الطوارئ خالية من العوائق',
};
