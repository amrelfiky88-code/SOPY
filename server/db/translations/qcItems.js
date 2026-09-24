// Arabic and French for the QC Audit System checkpoints
// (server/db/seed_qc_system.sql): Daily A–N, Weekly W1–W6, Monthly M1–M6,
// Quarterly Q1–Q2. The English is the client's own wording; these are an
// additional view of it, loaded as source='machine' until reviewed.
import { byLanguage } from './rows.js';

export const qcItems = byLanguage([
  // Daily QC — A. Exterior & First Impressions
  [`Signage clean, illuminated, no dead bulbs or damage`, `اللافتات نظيفة ومضاءة، دون مصابيح تالفة أو أضرار`, `Enseigne propre et éclairée, sans ampoule grillée ni dégât`],
  [`Entrance glass, doors & handles spotless — no fingerprints or smudges`, `زجاج المدخل والأبواب والمقابض نظيفة تمامًا — بلا بصمات أو بقع`, `Vitres, portes et poignées de l'entrée impeccables — aucune trace de doigts ni salissure`],
  [`Walkway / parking area free of litter, cigarette butts & standing water`, `الممر / موقف السيارات خالٍ من القمامة وأعقاب السجائر والمياه الراكدة`, `Allée / parking sans détritus, mégots ni eau stagnante`],
  [`Exterior menus / promotional displays current, clean & correctly priced`, `القوائم الخارجية / العروض الترويجية محدّثة ونظيفة وأسعارها صحيحة`, `Menus extérieurs / supports promotionnels à jour, propres et correctement tarifés`],
  [`Waste bins outside not overflowing; lids closed; no odor at entrance`, `صناديق النفايات الخارجية غير ممتلئة؛ الأغطية مغلقة؛ لا روائح عند المدخل`, `Poubelles extérieures non débordantes ; couvercles fermés ; aucune odeur à l'entrée`],
  [`No pest activity visible around entrance, waste area or delivery door`, `لا نشاط ظاهر للآفات حول المدخل أو منطقة النفايات أو باب التوريد`, `Aucune activité de nuisibles visible autour de l'entrée, de la zone déchets ou de la porte de livraison`],
  [`Outdoor seating (if any) clean, aligned, stable & weather-appropriate`, `الجلسات الخارجية (إن وجدت) نظيفة ومصفوفة وثابتة ومناسبة للطقس`, `Terrasse (le cas échéant) propre, alignée, stable et adaptée à la météo`],
  [`Accessibility: ramp/entrance unobstructed for wheelchairs & strollers`, `سهولة الوصول: المنحدر/المدخل خالٍ من العوائق للكراسي المتحركة وعربات الأطفال`, `Accessibilité : rampe/entrée dégagée pour fauteuils roulants et poussettes`],

  // Daily QC — B. Food Safety & Temperature Control
  [`Refrigerators at 1–5°C; readings logged with time & initials`, `الثلاجات بين 1 و5 °م؛ القراءات مسجلة بالوقت والأحرف الأولى`, `Réfrigérateurs entre 1 et 5 °C ; relevés notés avec l'heure et les initiales`],
  [`Freezers at or below -18°C; no ice build-up blocking airflow`, `الفريزرات عند -18 °م أو أقل؛ لا تراكم للثلج يعيق تدفق الهواء`, `Congélateurs à -18 °C ou moins ; pas de givre bloquant la circulation d'air`],
  [`Hot holding at or above 63°C; no food in danger zone (5–63°C) over 2 hrs`, `الحفظ الساخن عند 63 °م أو أعلى؛ لا طعام في منطقة الخطر (5–63 °م) لأكثر من ساعتين`, `Maintien au chaud à 63 °C ou plus ; aucun aliment en zone de danger (5–63 °C) plus de 2 h`],
  [`Cooked food core temps verified with calibrated probe (min 75°C)`, `التحقق من حرارة قلب الطعام المطهو بمجس معاير (75 °م كحد أدنى)`, `Températures à cœur des plats cuits vérifiées à la sonde étalonnée (75 °C min.)`],
  [`All food items labeled: prep date, use-by date, staff initials`, `جميع الأصناف الغذائية موسومة: تاريخ التحضير، تاريخ انتهاء الاستخدام، الأحرف الأولى للموظف`, `Tous les aliments étiquetés : date de préparation, DLC, initiales`],
  [`FIFO rotation verified in all storage — no expired items on premises`, `التحقق من تطبيق الوارد أولًا صادر أولًا في جميع أماكن التخزين — لا أصناف منتهية الصلاحية في المنشأة`, `Rotation PEPS vérifiée dans tous les stockages — aucun produit périmé sur place`],
  [`Raw and ready-to-eat foods fully segregated (storage & prep)`, `فصل تام بين الأطعمة النيئة والجاهزة للأكل (في التخزين والتحضير)`, `Aliments crus et prêts à consommer totalement séparés (stockage et préparation)`],
  [`Thermometers calibrated (ice-point test done this week, documented)`, `موازين الحرارة معايرة (اختبار نقطة التجمد أُجري هذا الأسبوع وموثق)`, `Thermomètres étalonnés (test au point de glace fait cette semaine, documenté)`],
  [`Defrosting done in fridge or under running water — never at room temp`, `إذابة التجميد في الثلاجة أو تحت الماء الجاري — وليس في حرارة الغرفة أبدًا`, `Décongélation au réfrigérateur ou sous l'eau courante — jamais à température ambiante`],
  [`Allergen matrix up to date; staff can answer allergen queries correctly`, `جدول مسببات الحساسية محدّث؛ والموظفون يجيبون عن أسئلة الحساسية بشكل صحيح`, `Matrice des allergènes à jour ; l'équipe répond correctement aux questions sur les allergènes`],
  [`Sanitizer buckets at correct concentration; test strips used & logged`, `دلاء المطهر بالتركيز الصحيح؛ شرائط الاختبار مستخدمة ونتائجها مسجلة`, `Seaux de désinfectant à la bonne concentration ; bandelettes utilisées et consignées`],
  [`Cooling logs show 63°C→8°C within 90 minutes for all cooled batches`, `سجلات التبريد تُظهر الانخفاض من 63 °م إلى 8 °م خلال 90 دقيقة لكل الدفعات المبردة`, `Registres de refroidissement : 63 °C → 8 °C en 90 minutes pour tous les lots refroidis`],

  // Daily QC — C. Kitchen Hygiene & Organization
  [`Floors clean, dry, no grease build-up; drains clear & odor-free`, `الأرضيات نظيفة وجافة بلا تراكم للدهون؛ المصارف سالكة وبلا روائح`, `Sols propres et secs, sans graisse accumulée ; siphons dégagés et sans odeur`],
  [`Work surfaces sanitized; color-coded boards in correct use`, `أسطح العمل معقمة؛ ألواح التقطيع الملونة مستخدمة بشكل صحيح`, `Plans de travail désinfectés ; planches à code couleur correctement utilisées`],
  [`Hand-wash stations stocked: soap, paper towels, warm water working`, `أحواض غسل اليدين مجهزة: صابون، مناشف ورقية، ماء دافئ يعمل`, `Postes de lavage des mains approvisionnés : savon, essuie-mains papier, eau chaude fonctionnelle`],
  [`Staff observed washing hands at correct moments (watch for 10 min)`, `ملاحظة غسل الموظفين لأيديهم في الأوقات الصحيحة (المراقبة لمدة 10 دقائق)`, `Lavage des mains observé aux bons moments (observer 10 min)`],
  [`All staff in clean uniform, hair covered, no jewelry, nails compliant`, `جميع الموظفين بزي نظيف وشعر مغطى وبلا مجوهرات وأظافر مطابقة`, `Toute l'équipe en tenue propre, cheveux couverts, sans bijoux, ongles conformes`],
  [`No personal items (phones, drinks, bags) in food prep areas`, `لا أغراض شخصية (هواتف، مشروبات، حقائب) في مناطق تحضير الطعام`, `Aucun effet personnel (téléphones, boissons, sacs) dans les zones de préparation`],
  [`Cleaning schedule signed off for previous day — spot-verify 2 tasks`, `جدول التنظيف موقّع لليوم السابق — تحقق عشوائيًا من مهمتين`, `Planning de nettoyage de la veille signé — vérifier 2 tâches par sondage`],
  [`Extraction hood & filters free of visible grease drip risk`, `الشفاط والفلاتر خالية من خطر تساقط الدهون الظاهر`, `Hotte et filtres sans risque visible d'égouttement de graisse`],
  [`Waste segregated, bins with lids & liners, waste area clean`, `النفايات مفروزة، والصناديق بأغطية وأكياس، ومنطقة النفايات نظيفة`, `Déchets triés, poubelles avec couvercles et sacs, zone déchets propre`],
  [`Pest control devices in place, log book current, no droppings/signs`, `أجهزة مكافحة الآفات في مكانها، والسجل محدّث، ولا فضلات أو علامات`, `Dispositifs antinuisibles en place, registre à jour, aucune déjection ni trace`],
  [`Chemicals stored away from food, labeled, MSDS sheets accessible`, `المواد الكيميائية مخزنة بعيدًا عن الطعام وموسومة، وصحائف بيانات السلامة (MSDS) متاحة`, `Produits chimiques stockés loin des aliments, étiquetés, fiches de données de sécurité accessibles`],
  [`Ice machine interior clean; scoop stored outside on hook`, `داخل ماكينة الثلج نظيف؛ المغرفة معلقة خارجها على خطاف`, `Intérieur de la machine à glaçons propre ; pelle rangée à l'extérieur sur un crochet`],

  // Daily QC — D. Bar & Beverage Station
  [`Beverage fridges at temp; product faced, stocked & in date`, `ثلاجات المشروبات بالحرارة الصحيحة؛ المنتجات مرتبة ومعبأة وصالحة`, `Réfrigérateurs à boissons à température ; produits en façade, réassortis et dans les dates`],
  [`Coffee machine clean, back-flushed; grinder free of stale grounds`, `ماكينة القهوة نظيفة ومغسولة عكسيًا؛ المطحنة خالية من البن القديم`, `Machine à café propre, rincée à contre-courant ; moulin sans mouture rassie`],
  [`Fountain nozzles & drip trays clean; syrup lines checked`, `فوهات موزع المشروبات وصواني التقطير نظيفة؛ خطوط الشراب مفحوصة`, `Becs de la fontaine et égouttoirs propres ; lignes de sirop contrôlées`],
  [`Juicers/blenders sanitized; no fruit residue from previous day`, `العصارات/الخلاطات معقمة؛ لا بقايا فاكهة من اليوم السابق`, `Centrifugeuses/blenders désinfectés ; aucun résidu de fruit de la veille`],
  [`Garnishes fresh today — taste-test one juice & one coffee yourself`, `الزينة طازجة اليوم — تذوق بنفسك عصيرًا واحدًا وقهوة واحدة`, `Garnitures fraîches du jour — goûter soi-même un jus et un café`],
  [`Glassware/cups spotless — hold 3 random glasses up to the light`, `الكؤوس/الأكواب نظيفة تمامًا — ارفع 3 كؤوس عشوائية أمام الضوء`, `Verres/tasses impeccables — examiner 3 verres au hasard à la lumière`],
  [`Bar counter, rails & menus wiped; no sticky surfaces`, `كاونتر البار والحواجز والقوائم ممسوحة؛ لا أسطح لزجة`, `Comptoir, rampes et cartes essuyés ; aucune surface collante`],

  // Daily QC — E. Dining Area & Guest Experience
  [`Tables & chairs clean, stable, aligned; no wobbles or crumbs`, `الطاولات والكراسي نظيفة وثابتة ومصفوفة؛ لا اهتزاز ولا فتات`, `Tables et chaises propres, stables, alignées ; ni bancales ni miettes`],
  [`Floors swept & mopped; no sticky patches under tables`, `الأرضيات مكنوسة وممسوحة؛ لا بقع لزجة تحت الطاولات`, `Sols balayés et lavés ; aucune zone collante sous les tables`],
  [`Lighting: all bulbs working, brightness appropriate for daypart`, `الإضاءة: جميع المصابيح تعمل، والسطوع مناسب لفترة اليوم`, `Éclairage : toutes les ampoules fonctionnent, intensité adaptée au moment de la journée`],
  [`Music: volume right for occupancy level; playlist on-brand`, `الموسيقى: مستوى الصوت مناسب لنسبة الإشغال؛ قائمة التشغيل متوافقة مع هوية العلامة`, `Musique : volume adapté à la fréquentation ; playlist conforme à la marque`],
  [`Temperature & air: comfortable, no kitchen smoke/odor in dining area`, `الحرارة والهواء: مريحان، ولا دخان/روائح من المطبخ في صالة الطعام`, `Température et air : confortables, ni fumée ni odeur de cuisine en salle`],
  [`Restrooms: clean, stocked, dry floors, no odor — check hourly log`, `دورات المياه: نظيفة ومجهزة وأرضياتها جافة وبلا روائح — راجع السجل كل ساعة`, `Toilettes : propres, approvisionnées, sols secs, sans odeur — vérifier le registre horaire`],
  [`Condiment stations/table sets stocked, clean, nothing crusted`, `محطات التوابل/أطقم الطاولات مجهزة ونظيفة وبلا بقايا متيبسة`, `Postes de condiments/dressages de table approvisionnés, propres, rien d'incrusté`],
  [`Menus clean & unfrayed; specials/promos correctly displayed`, `القوائم نظيفة وغير مهترئة؛ الأطباق الخاصة/العروض معروضة بشكل صحيح`, `Cartes propres et en bon état ; suggestions/promos correctement affichées`],
  [`High chairs clean & safe; kids' amenities available`, `كراسي الأطفال العالية نظيفة وآمنة؛ مستلزمات الأطفال متوفرة`, `Chaises hautes propres et sûres ; équipements enfants disponibles`],
  [`POS/ordering kiosks or QR codes working; screens clean`, `نقاط البيع/أكشاك الطلب أو رموز QR تعمل؛ الشاشات نظيفة`, `Caisses/bornes de commande ou QR codes fonctionnels ; écrans propres`],
  [`Wi-Fi working (test it); password displayed if offered`, `شبكة Wi-Fi تعمل (اختبرها)؛ كلمة المرور معروضة إن كانت متاحة للضيوف`, `Wi-Fi fonctionnel (le tester) ; mot de passe affiché s'il est proposé`],
  [`Emergency exits unobstructed; exit signage illuminated`, `مخارج الطوارئ خالية من العوائق؛ لافتات الخروج مضاءة`, `Issues de secours dégagées ; signalisation de sortie éclairée`],

  // Daily QC — F. Staff Readiness & Service Quality
  [`Pre-shift briefing done: specials, 86'd items, targets, VIPs`, `إحاطة ما قبل الوردية تمت: الأطباق الخاصة، الأصناف النافدة، الأهداف، كبار الضيوف`, `Briefing avant service fait : suggestions, plats épuisés, objectifs, VIP`],
  [`Staffing level matches forecast covers; gaps covered before peak`, `عدد الموظفين يتناسب مع عدد الضيوف المتوقع؛ سد النقص قبل الذروة`, `Effectif adapté aux couverts prévus ; manques comblés avant le rush`],
  [`Greeting standard observed: guests acknowledged within 30 seconds`, `الالتزام بمعيار الترحيب: التفاعل مع الضيوف خلال 30 ثانية`, `Standard d'accueil respecté : clients salués dans les 30 secondes`],
  [`Order accuracy: watch 3 orders end-to-end; note any remakes`, `دقة الطلبات: تابع 3 طلبات من البداية للنهاية؛ سجّل أي إعادة تحضير`, `Exactitude des commandes : suivre 3 commandes de bout en bout ; noter les plats refaits`],
  [`Speed of service within target (record actual times for 3 orders)`, `سرعة الخدمة ضمن الهدف (سجّل الأوقات الفعلية لـ 3 طلبات)`, `Rapidité de service dans l'objectif (noter les temps réels de 3 commandes)`],
  [`Upsell/suggestion behavior natural, not scripted or pushy`, `البيع الإضافي/الاقتراحات بأسلوب طبيعي، غير محفوظ أو ملحّ`, `Vente additionnelle/suggestions naturelles, ni récitées ni insistantes`],
  [`Complaint handling: staff know the recovery steps without checking`, `التعامل مع الشكاوى: الموظفون يعرفون خطوات المعالجة دون الرجوع لمرجع`, `Gestion des réclamations : l'équipe connaît les étapes de rattrapage sans vérifier`],
  [`New staff shadowing/training plan active & documented`, `خطة المرافقة/التدريب للموظفين الجدد مفعّلة وموثقة`, `Plan de binôme/formation des nouveaux actif et documenté`],
  [`Team morale check: any conflicts, fatigue, grievances to address`, `فحص معنويات الفريق: أي خلافات أو إرهاق أو تظلمات تحتاج معالجة`, `Moral de l'équipe : conflits, fatigue ou griefs à traiter`],

  // Daily QC — G. Safety, Security & Compliance
  [`Fire extinguishers in place, pins intact, inspection tags current`, `طفايات الحريق في مكانها، والمسامير سليمة، وبطاقات الفحص سارية`, `Extincteurs en place, goupilles intactes, étiquettes de contrôle à jour`],
  [`First aid kit stocked & accessible; trained first aider on shift`, `حقيبة الإسعافات مجهزة وسهلة الوصول؛ مسعف مدرب ضمن الوردية`, `Trousse de secours complète et accessible ; secouriste formé en service`],
  [`Wet floor signs used correctly; no trailing cables or trip hazards`, `لافتات الأرضية المبللة مستخدمة بشكل صحيح؛ لا كابلات ممتدة أو مخاطر تعثر`, `Panneaux « sol glissant » bien utilisés ; aucun câble traînant ni risque de chute`],
  [`Gas connections checked; no smell; shut-off valve accessible`, `وصلات الغاز مفحوصة؛ لا رائحة؛ صمام الإغلاق سهل الوصول`, `Raccords gaz vérifiés ; aucune odeur ; vanne de coupure accessible`],
  [`Electrical panels unobstructed; no overloaded sockets`, `اللوحات الكهربائية خالية من العوائق؛ لا مقابس محمّلة فوق طاقتها`, `Tableaux électriques dégagés ; aucune prise surchargée`],
  [`CCTV operational; recording verified; storage days compliant`, `كاميرات المراقبة تعمل؛ التسجيل مؤكد؛ مدة الحفظ مطابقة`, `Vidéosurveillance opérationnelle ; enregistrement vérifié ; durée de conservation conforme`],
  [`Cash handling: safe locked, float verified, no cash left in open`, `التعامل النقدي: الخزنة مقفلة، والعهدة مؤكدة، ولا نقود متروكة مكشوفة`, `Espèces : coffre fermé, fond de caisse vérifié, aucun argent laissé à découvert`],
  [`Back door secured; delivery access controlled & logged`, `الباب الخلفي مؤمَّن؛ دخول التوريدات مضبوط ومسجل`, `Porte arrière sécurisée ; accès livraisons contrôlé et consigné`],
  [`Licenses & certificates displayed and current (health, fire, business)`, `التراخيص والشهادات معروضة وسارية (صحية، دفاع مدني، تجارية)`, `Licences et certificats affichés et valides (hygiène, incendie, activité)`],
  [`Incident report book accessible; yesterday's incidents reviewed`, `سجل الحوادث متاح؛ حوادث الأمس تمت مراجعتها`, `Registre des incidents accessible ; incidents de la veille revus`],

  // Daily QC — H. Consumer Behavior & Insights
  [`Peak hours today vs. usual pattern — early/late shift in traffic?`, `ساعات الذروة اليوم مقارنة بالنمط المعتاد — هل تقدّم الإقبال أو تأخّر؟`, `Heures de pointe du jour vs habitude — affluence plus tôt ou plus tard ?`],
  [`Table turnover time (dine-in) — faster or slower than target?`, `زمن دوران الطاولات (الأكل في المطعم) — أسرع أم أبطأ من الهدف؟`, `Rotation des tables (sur place) — plus rapide ou plus lente que l'objectif ?`],
  [`Most ordered item today / most returned or left-unfinished item`, `الصنف الأكثر طلبًا اليوم / الصنف الأكثر إرجاعًا أو تركًا دون إكمال`, `Plat le plus commandé du jour / plat le plus renvoyé ou laissé`],
  [`Average party size & type (families / workers / students / couples)`, `متوسط حجم المجموعة ونوعها (عائلات / موظفون / طلاب / أزواج)`, `Taille et type moyens des tables (familles / actifs / étudiants / couples)`],
  [`Dwell behavior: eat & go, linger, laptop campers, waiting groups?`, `نمط البقاء: يأكلون ويغادرون، يطيلون الجلوس، يعملون على الحاسوب، مجموعات منتظرة؟`, `Temps de présence : mangent et partent, s'attardent, travaillent sur ordinateur, groupes en attente ?`],
  [`Delivery vs dine-in vs takeaway split — any shift from the norm?`, `توزيع التوصيل مقابل الأكل في المطعم مقابل الطلبات الخارجية — أي تغير عن المعتاد؟`, `Répartition livraison / sur place / à emporter — un écart par rapport à la normale ?`],
  [`Queue behavior: walk-aways observed? At what queue length?`, `سلوك الطابور: هل غادر ضيوف دون طلب؟ عند أي طول للطابور؟`, `File d'attente : des clients repartis ? À partir de quelle longueur ?`],
  [`Guest comments overheard (food, price, service, cleanliness)`, `تعليقات الضيوف المسموعة (الطعام، السعر، الخدمة، النظافة)`, `Commentaires de clients entendus (plats, prix, service, propreté)`],
  [`Online reviews since yesterday (check platforms) — themes?`, `التقييمات الإلكترونية منذ الأمس (راجع المنصات) — ما المواضيع المتكررة؟`, `Avis en ligne depuis hier (vérifier les plateformes) — thèmes ?`],
  [`Promo/special performance: are guests noticing & ordering it?`, `أداء العرض/الطبق الخاص: هل يلاحظه الضيوف ويطلبونه؟`, `Performance de la promo/suggestion : les clients la remarquent-ils et la commandent-ils ?`],
  [`Competitor activity noticed (openings, offers, pricing moves)`, `نشاط المنافسين الملاحظ (افتتاحات، عروض، تغييرات أسعار)`, `Activité concurrente remarquée (ouvertures, offres, prix)`],
  [`One improvement idea from staff (ask a team member daily)`, `فكرة تحسين واحدة من الموظفين (اسأل أحد أعضاء الفريق يوميًا)`, `Une idée d'amélioration de l'équipe (demander chaque jour à un membre)`],

  // Daily QC — K. Food Quality, Taste & Consistency
  [`Daily line tasting done: every sauce, marinade & base tasted before service`, `تذوق الخط اليومي تم: كل صلصة وتتبيلة وقاعدة تم تذوقها قبل الخدمة`, `Dégustation quotidienne faite : chaque sauce, marinade et base goûtée avant le service`],
  [`Seasoning check: salt, acid & heat balanced — not corrected at the pass`, `فحص التتبيل: الملح والحموضة والحرارة متوازنة — دون تصحيح عند منطقة التسليم`, `Assaisonnement : sel, acidité et piquant équilibrés — pas de correction au passe`],
  [`Texture verified: fries crisp not greasy; buns soft not stale; proteins juicy`, `التحقق من القوام: البطاطس مقرمشة غير دهنية؛ الخبز طري غير بائت؛ البروتينات طرية وعصيرية`, `Textures vérifiées : frites croustillantes et non grasses ; pains moelleux et non rassis ; protéines juteuses`],
  [`Doneness consistency: same item ordered twice — identical cook on both?`, `ثبات درجة النضج: نفس الصنف مطلوب مرتين — هل الطهي متطابق في الاثنين؟`, `Régularité de cuisson : même plat commandé deux fois — cuisson identique ?`],
  [`Signature item benchmark: does today's version match the reference standard?`, `معيار الطبق المميز: هل نسخة اليوم تطابق المعيار المرجعي؟`, `Plat signature : la version du jour correspond-elle au standard de référence ?`],
  [`Oil quality: fried items clean-tasting — no rancid or 'old oil' flavor`, `جودة الزيت: المقليات بطعم نظيف — لا طعم زنخ أو «زيت قديم»`, `Qualité de l'huile : fritures au goût net — aucun goût rance ou de « vieille huile »`],
  [`Bread & bakery: served fresh today; day-old product not in guest service`, `الخبز والمخبوزات: تقدَّم طازجة اليوم؛ لا منتجات من اليوم السابق للضيوف`, `Pain et viennoiserie : servis frais du jour ; aucun produit de la veille servi`],
  [`Menu integrity: dish served matches menu description & photo exactly`, `مصداقية القائمة: الطبق المقدم يطابق وصف القائمة وصورتها تمامًا`, `Fidélité à la carte : le plat servi correspond exactement à la description et à la photo`],
  [`Portion consistency: 2 random items weighed against spec — within 5%`, `ثبات الحصص: وزن صنفين عشوائيين مقارنة بالمواصفات — ضمن 5%`, `Régularité des portions : 2 plats au hasard pesés vs fiche technique — à 5 % près`],
  [`Leftover taste memory: would you crave this dish again tomorrow?`, `الانطباع الباقي: هل ستشتهي هذا الطبق مرة أخرى غدًا؟`, `Souvenir gustatif : auriez-vous envie de ce plat à nouveau demain ?`],

  // Daily QC — L. Presentation, Plating & The Pass
  [`Plating matches spec photos posted at each station — no drift`, `التقديم يطابق صور المواصفات المعلقة عند كل محطة — دون انحراف`, `Dressage conforme aux photos de référence affichées à chaque poste — sans dérive`],
  [`Plate/packaging rims & edges wiped clean before leaving the pass`, `حواف الأطباق/العبوات ممسوحة قبل مغادرة منطقة التسليم`, `Bords des assiettes/emballages essuyés avant de quitter le passe`],
  [`No chipped, cracked or mismatched plates, cups or trays in service`, `لا أطباق أو أكواب أو صوانٍ مثلومة أو مشروخة أو غير متطابقة في الخدمة`, `Aucune assiette, tasse ou plateau ébréché, fêlé ou dépareillé en service`],
  [`Hot food on hot plates / cold food on cold plates — touch-test 3 plates`, `الطعام الساخن في أطباق ساخنة / البارد في أطباق باردة — المس 3 أطباق للتأكد`, `Plats chauds sur assiettes chaudes / froids sur assiettes froides — toucher 3 assiettes`],
  [`Expediter actively checking every order against ticket before handoff`, `منسق التسليم يطابق كل طلب مع التذكرة قبل تسليمه`, `L'aboyeur vérifie chaque commande avec le bon avant l'envoi`],
  [`Garnishes fresh, intentional & edible — nothing wilted or decorative-only`, `الزينة طازجة ومقصودة وصالحة للأكل — لا شيء ذابل أو للزينة فقط`, `Garnitures fraîches, pensées et comestibles — rien de flétri ni de purement décoratif`],
  [`Takeaway/delivery packaging: sealed, clean, upright, sauces separate`, `عبوات الطلبات الخارجية/التوصيل: محكمة الإغلاق ونظيفة وقائمة والصلصات منفصلة`, `Emballages à emporter/livraison : scellés, propres, droits, sauces à part`],
  [`Time from 'ready' to 'served/dispatched' under 2 minutes — food never dies at the pass`, `الوقت من «جاهز» إلى «مقدَّم/مُرسَل» أقل من دقيقتين — لا يُترك الطعام ينتظر عند منطقة التسليم`, `Délai entre « prêt » et « servi/expédié » sous 2 minutes — les plats n'attendent jamais au passe`],

  // Daily QC — M. Service Choreography & Hospitality
  [`Anticipation observed: refills, napkins, extra sauce offered before requested`, `ملاحظة الاستباق: إعادة التعبئة والمناديل والصلصة الإضافية تُعرض قبل طلبها`, `Anticipation observée : resservir, serviettes, sauce supplémentaire proposés avant la demande`],
  [`Table maintenance: cleared within 2 minutes of guests leaving; wiped & reset`, `العناية بالطاولات: تُرفع خلال دقيقتين من مغادرة الضيوف، وتُمسح ويُعاد تجهيزها`, `Entretien des tables : débarrassées dans les 2 minutes après le départ, essuyées et redressées`],
  [`Staff movement calm & purposeful — no running, shouting or visible stress`, `حركة الموظفين هادئة وهادفة — لا جري ولا صراخ ولا توتر ظاهر`, `Déplacements de l'équipe calmes et efficaces — ni course, ni cris, ni stress visible`],
  [`Guests with children, elderly or disabilities offered proactive help`, `تقديم المساعدة استباقيًا للضيوف مع أطفال أو كبار السن أو ذوي الإعاقة`, `Aide proposée spontanément aux clients avec enfants, âgés ou en situation de handicap`],
  [`Order errors recovered gracefully — apology + fix + gesture, without manager prompt`, `معالجة أخطاء الطلبات بلباقة — اعتذار + تصحيح + لفتة، دون تدخل المدير`, `Erreurs rattrapées avec élégance — excuses + correction + geste, sans intervention du manager`],
  [`The farewell: every departing guest acknowledged — last impression = review`, `الوداع: توديع كل ضيف مغادر — الانطباع الأخير = التقييم`, `Le départ : chaque client salué en partant — dernière impression = avis`],
  [`Waiting guests engaged: acknowledged, given time estimate, kept informed`, `التواصل مع الضيوف المنتظرين: الترحيب بهم وإعطاؤهم وقتًا تقديريًا وإبقاؤهم على اطلاع`, `Clients en attente pris en charge : salués, informés du délai, tenus au courant`],
  [`Personal touches observed: regulars recognized, preferences remembered`, `ملاحظة اللمسات الشخصية: التعرف على الزبائن الدائمين وتذكر تفضيلاتهم`, `Attentions personnelles observées : habitués reconnus, préférences mémorisées`],
  [`Phone/online order guests treated with same warmth as walk-ins`, `ضيوف الطلبات الهاتفية/الإلكترونية يُعاملون بنفس الود الذي يلقاه الحاضرون`, `Clients par téléphone/en ligne traités avec la même chaleur que ceux sur place`],
  [`Team communicates internally without guests overhearing operational talk`, `الفريق يتواصل داخليًا دون أن يسمع الضيوف أحاديث التشغيل`, `L'équipe communique sans que les clients n'entendent les échanges opérationnels`],

  // Daily QC — N. Ingredient Quality & Sourcing
  [`Produce: firm, vibrant color, no bruising/wilting — reject on sight, not on paper`, `الخضار والفواكه: متماسكة وزاهية اللون بلا كدمات/ذبول — ارفضها بالمعاينة لا بالأوراق`, `Fruits et légumes : fermes, couleurs vives, ni meurtrissure ni flétrissement — refuser à l'œil, pas sur papier`],
  [`Proteins: smell test passed; flesh springs back; no discoloration or slime`, `البروتينات: اجتازت اختبار الرائحة؛ اللحم يرتد عند الضغط؛ لا تغير في اللون ولا لزوجة`, `Protéines : test olfactif réussi ; chair ferme et élastique ; ni décoloration ni viscosité`],
  [`Dairy & eggs: dates checked AND product visually inspected on opening`, `الألبان والبيض: فحص التواريخ وأيضًا معاينة المنتج بصريًا عند الفتح`, `Produits laitiers et œufs : dates vérifiées ET produit inspecté visuellement à l'ouverture`],
  [`Supplier consistency: same grade/size/brand as approved spec — no silent substitutions`, `ثبات المورد: نفس الدرجة/الحجم/العلامة وفق المواصفات المعتمدة — لا استبدال دون إبلاغ`, `Constance fournisseur : même calibre/taille/marque que la fiche validée — aucune substitution discrète`],
  [`Frozen goods: no freezer burn, no ice crystals indicating thaw-refreeze`, `المجمدات: لا حروق تجميد ولا بلورات ثلج تدل على الذوبان وإعادة التجميد`, `Surgelés : ni brûlure de congélation ni cristaux révélant une décongélation-recongélation`],
  [`One ingredient deep-dive daily (rotate): trace it from delivery note to plate`, `فحص معمق لمكوّن واحد يوميًا (بالتناوب): تتبّعه من إذن التسليم حتى الطبق`, `Un ingrédient analysé en détail chaque jour (en rotation) : le suivre du bon de livraison à l'assiette`],

  // Monthly Audit — M1. Legal, Licenses & Documentation
  [`All staff health certificates valid — expiry dates logged, renewals booked`, `جميع الشهادات الصحية للموظفين سارية — تواريخ الانتهاء مسجلة والتجديدات محجوزة`, `Certificats médicaux de toute l'équipe valides — échéances notées, renouvellements planifiés`],
  [`Business, health & civil defense licenses current & displayed`, `التراخيص التجارية والصحية وتراخيص الدفاع المدني سارية ومعروضة`, `Licences d'activité, sanitaire et de protection civile à jour et affichées`],
  [`Working hours, breaks & rest days compliant with labor law`, `ساعات العمل والاستراحات وأيام الراحة مطابقة لقانون العمل`, `Horaires, pauses et jours de repos conformes au droit du travail`],
  [`Insurance policies (premises, liability, workers) in force`, `وثائق التأمين (المنشأة، المسؤولية، العاملين) سارية`, `Polices d'assurance (locaux, responsabilité civile, salariés) en vigueur`],
  [`HACCP documentation complete for the month — spot-check 5 random days`, `مستندات HACCP مكتملة للشهر — افحص 5 أيام عشوائية`, `Documentation HACCP complète pour le mois — contrôler 5 jours au hasard`],
  [`Incident reports from the month reviewed; corrective actions closed`, `مراجعة تقارير حوادث الشهر؛ الإجراءات التصحيحية مغلقة`, `Rapports d'incidents du mois revus ; actions correctives clôturées`],
  [`Employee files complete: contracts, IDs, signed SOP acknowledgments`, `ملفات الموظفين مكتملة: العقود، الهويات، إقرارات الاطلاع على إجراءات التشغيل موقّعة`, `Dossiers du personnel complets : contrats, pièces d'identité, accusés de lecture des procédures signés`],
  [`Tax & social insurance filings current (confirm with accountant)`, `الإقرارات الضريبية والتأمينات الاجتماعية محدّثة (تأكد مع المحاسب)`, `Déclarations fiscales et sociales à jour (confirmer avec le comptable)`],

  // Monthly Audit — M2. Menu Engineering & Profitability
  [`Item-level sales mix report pulled for the full month`, `استخراج تقرير مزيج المبيعات لكل صنف عن الشهر كاملًا`, `Rapport de ventes par article extrait pour le mois complet`],
  [`Contribution margin per item recalculated with current ingredient costs`, `إعادة حساب هامش المساهمة لكل صنف بتكاليف المكونات الحالية`, `Marge sur coût matière par article recalculée avec les coûts actuels`],
  [`Menu matrix built: Stars / Plowhorses / Puzzles / Dogs classified`, `بناء مصفوفة القائمة: تصنيف النجوم / أحصنة العمل / الألغاز / الكلاب`, `Matrice de la carte établie : Stars / Vaches à lait / Énigmes / Poids morts classés`],
  [`Action taken: at least one Dog reviewed for removal or rework`, `اتخاذ إجراء: مراجعة صنف واحد على الأقل من «الكلاب» لحذفه أو إعادة صياغته`, `Action menée : au moins un « poids mort » étudié pour retrait ou refonte`],
  [`At least one Puzzle repositioned (menu placement, photo, staff push)`, `إعادة تموضع صنف واحد على الأقل من «الألغاز» (موقعه في القائمة، صورته، ترويج الموظفين له)`, `Au moins une « énigme » repositionnée (place sur la carte, photo, mise en avant par l'équipe)`],
  [`Price review vs cost inflation — margin erosion above 1% addressed`, `مراجعة الأسعار مقابل تضخم التكاليف — معالجة تآكل الهامش فوق 1%`, `Revue des prix vs inflation des coûts — érosion de marge au-delà de 1 % traitée`],
  [`New item pipeline: at least one item in development or test`, `الأصناف الجديدة: صنف واحد على الأقل قيد التطوير أو التجربة`, `Nouveautés : au moins un plat en développement ou en test`],
  [`Recipe cards updated for any changed items — kitchen retrained`, `تحديث بطاقات الوصفات لأي أصناف تغيرت — وإعادة تدريب المطبخ`, `Fiches recettes mises à jour pour les plats modifiés — cuisine reformée`],

  // Monthly Audit — M3. Supplier Performance & Procurement
  [`Supplier scorecard updated: quality, punctuality, accuracy, rejects`, `تحديث بطاقة تقييم الموردين: الجودة، الالتزام بالمواعيد، الدقة، المرفوضات`, `Tableau de notation fournisseurs à jour : qualité, ponctualité, exactitude, refus`],
  [`Price benchmarking: top 10 items quoted from at least one alternative`, `مقارنة الأسعار: عروض أسعار لأهم 10 أصناف من مورد بديل واحد على الأقل`, `Comparaison des prix : 10 principaux articles chiffrés chez au moins un autre fournisseur`],
  [`Rejected delivery log reviewed — chronic offenders escalated`, `مراجعة سجل التوريدات المرفوضة — تصعيد المخالفين المتكررين`, `Registre des livraisons refusées revu — récidivistes signalés`],
  [`Payment terms & credit standing with suppliers verified`, `التحقق من شروط الدفع والوضع الائتماني مع الموردين`, `Conditions de paiement et situation de crédit auprès des fournisseurs vérifiées`],
  [`One supplier site visit or virtual audit completed (rotate monthly)`, `إتمام زيارة ميدانية أو تدقيق عن بُعد لمورد واحد (بالتناوب شهريًا)`, `Une visite ou un audit à distance d'un fournisseur réalisé (rotation mensuelle)`],
  [`Contract renewals due next 60 days identified & negotiation started`, `تحديد العقود المستحقة التجديد خلال الـ 60 يومًا القادمة وبدء التفاوض`, `Contrats à renouveler sous 60 jours identifiés et négociation engagée`],

  // Monthly Audit — M4. Guest Insight, Mystery Shop & Brand
  [`Mystery shopper visit completed by someone unknown to staff`, `إتمام زيارة المتسوق السري بواسطة شخص غير معروف للموظفين`, `Visite client mystère effectuée par une personne inconnue de l'équipe`],
  [`Mystery shop report scored & debriefed with the team`, `تقييم تقرير المتسوق السري ومناقشته مع الفريق`, `Rapport client mystère noté et débriefé avec l'équipe`],
  [`Month's review data aggregated: rating trend, complaint themes, praise themes`, `تجميع بيانات تقييمات الشهر: اتجاه التقييم، مواضيع الشكاوى، مواضيع الإشادة`, `Données d'avis du mois consolidées : tendance des notes, thèmes des plaintes et des éloges`],
  [`Repeat-guest indicators reviewed (loyalty data, recognized regulars, app data)`, `مراجعة مؤشرات الضيوف العائدين (بيانات الولاء، الزبائن الدائمون، بيانات التطبيق)`, `Indicateurs de fidélité revus (programme de fidélité, habitués reconnus, données de l'appli)`],
  [`Complaint log: 100% closed with root cause noted, not just apology`, `سجل الشكاوى: مغلق بنسبة 100% مع تسجيل السبب الجذري، لا مجرد اعتذار`, `Registre des plaintes : 100 % clôturées avec cause racine notée, pas seulement des excuses`],
  [`Guest suggestion implemented this month — at least one, publicized to team`, `تنفيذ اقتراح من الضيوف هذا الشهر — واحد على الأقل، مع إعلانه للفريق`, `Suggestion client mise en œuvre ce mois-ci — au moins une, communiquée à l'équipe`],
  [`Brand audit: signage, uniforms, packaging, menus consistent with brand book`, `تدقيق العلامة: اللافتات والأزياء والعبوات والقوائم متوافقة مع دليل العلامة`, `Audit de marque : signalétique, tenues, emballages et cartes conformes à la charte`],
  [`Local competitor visit done by manager — pricing, offers, experience notes`, `زيارة المدير لمنافس محلي — ملاحظات عن الأسعار والعروض والتجربة`, `Visite d'un concurrent local par le manager — notes sur prix, offres, expérience`],

  // Monthly Audit — M5. Crisis Readiness & Continuity
  [`One emergency drill run this month (rotate: fire / gas / power / water)`, `تنفيذ تمرين طوارئ واحد هذا الشهر (بالتناوب: حريق / غاز / كهرباء / مياه)`, `Un exercice d'urgence réalisé ce mois-ci (rotation : incendie / gaz / électricité / eau)`],
  [`Generator tested under load — not just started; runtime logged`, `اختبار المولد تحت الحمل — لا مجرد تشغيله؛ تسجيل مدة التشغيل`, `Groupe électrogène testé en charge — pas seulement démarré ; durée consignée`],
  [`Emergency contact tree updated & posted; staff can locate it`, `تحديث شجرة اتصالات الطوارئ وتعليقها؛ الموظفون يعرفون مكانها`, `Arbre d'appel d'urgence à jour et affiché ; l'équipe sait où le trouver`],
  [`Water outage plan: bottled stock, sanitizer reserve, closure criteria known`, `خطة انقطاع المياه: مخزون مياه معبأة، احتياطي مطهر، معايير الإغلاق معروفة`, `Plan coupure d'eau : stock d'eau en bouteille, réserve de désinfectant, critères de fermeture connus`],
  [`Food recall procedure: staff can explain isolation & documentation steps`, `إجراء سحب الأغذية: الموظفون قادرون على شرح خطوات العزل والتوثيق`, `Procédure de rappel produit : l'équipe sait expliquer l'isolement et la documentation`],
  [`Data backup: POS & CCTV storage verified restorable this month`, `النسخ الاحتياطي: التحقق هذا الشهر من إمكانية استعادة بيانات نقاط البيع وكاميرات المراقبة`, `Sauvegardes : restauration des données caisse et vidéosurveillance vérifiée ce mois-ci`],

  // Monthly Audit — M6. People Development & Culture
  [`Monthly staff meeting held: results shared, wins celebrated, plan set`, `عقد اجتماع الموظفين الشهري: مشاركة النتائج، الاحتفاء بالإنجازات، وضع الخطة`, `Réunion mensuelle tenue : résultats partagés, réussites célébrées, plan fixé`],
  [`Employee of the month (or equivalent recognition) awarded`, `منح لقب موظف الشهر (أو تقدير مماثل)`, `Employé du mois (ou reconnaissance équivalente) décerné`],
  [`Turnover rate calculated; leavers' reasons logged & themed`, `حساب معدل دوران الموظفين؛ تسجيل أسباب المغادرين وتصنيفها`, `Taux de rotation calculé ; motifs de départ consignés et regroupés`],
  [`Training hours per employee tracked vs monthly target`, `متابعة ساعات التدريب لكل موظف مقارنة بالهدف الشهري`, `Heures de formation par employé suivies vs objectif mensuel`],
  [`Succession check: who is ready to step up if a key person leaves?`, `فحص التعاقب الوظيفي: من المستعد لتولي المسؤولية إذا غادر شخص محوري؟`, `Relève : qui est prêt à prendre le relais si une personne clé part ?`],
  [`Staff satisfaction pulse (5-question anonymous survey) run & reviewed`, `إجراء استبيان سريع لرضا الموظفين (5 أسئلة دون ذكر الاسم) ومراجعته`, `Baromètre de satisfaction (sondage anonyme de 5 questions) réalisé et analysé`],

  // Quarterly Audit — Q1. Infrastructure & Certified Inspections
  [`Water quality lab test: potable supply + ice machine output`, `فحص معملي لجودة المياه: مياه الشرب + إنتاج ماكينة الثلج`, `Analyse d'eau en laboratoire : eau potable + glaçons de la machine`],
  [`Fire suppression & alarm system professionally inspected & certified`, `فحص نظام إطفاء الحريق والإنذار واعتماده من جهة متخصصة`, `Système d'extinction et d'alarme incendie inspecté et certifié par un professionnel`],
  [`Pest control contract reviewed; quarterly report & trend analysis received`, `مراجعة عقد مكافحة الآفات؛ استلام التقرير الربع سنوي وتحليل الاتجاهات`, `Contrat antinuisibles revu ; rapport trimestriel et analyse de tendance reçus`],
  [`Gas installation professionally inspected; certificate filed`, `فحص تمديدات الغاز من جهة متخصصة؛ حفظ الشهادة`, `Installation gaz inspectée par un professionnel ; certificat classé`],
  [`Electrical safety inspection: panels, earthing, kitchen circuits`, `فحص السلامة الكهربائية: اللوحات، التأريض، دوائر المطبخ`, `Contrôle de sécurité électrique : tableaux, mise à la terre, circuits de cuisine`],
  [`Hood & duct professional deep clean (fire-risk certification) completed`, `إتمام التنظيف العميق الاحترافي للشفاط ومجاري الهواء (شهادة الوقاية من الحريق)`, `Nettoyage professionnel de la hotte et des gaines (certificat risque incendie) réalisé`],
  [`Structural walk: leaks, cracks, tiles, sealant, door closures repaired`, `جولة على المبنى: إصلاح التسريبات والشقوق والبلاط ومواد العزل ومغالق الأبواب`, `Tour du bâtiment : fuites, fissures, carrelage, joints, ferme-portes réparés`],
  [`Equipment lifecycle review: items nearing end-of-life budgeted for replacement`, `مراجعة دورة حياة المعدات: رصد ميزانية لاستبدال المعدات القريبة من نهاية عمرها`, `Cycle de vie des équipements : remplacement budgété pour ceux en fin de vie`],

  // Quarterly Audit — Q2. Strategic Performance Review
  [`Quarterly P&L reviewed vs budget: sales, prime cost, EBITDA`, `مراجعة قائمة الأرباح والخسائر الربع سنوية مقابل الميزانية: المبيعات، التكلفة الأساسية، EBITDA`, `Compte de résultat trimestriel revu vs budget : ventes, coût principal, EBITDA`],
  [`Sales trend by daypart & channel vs same quarter last year`, `اتجاه المبيعات حسب فترة اليوم والقناة مقارنة بنفس الربع من العام الماضي`, `Tendance des ventes par moment de la journée et canal vs même trimestre l'an dernier`],
  [`Repeat-guest rate & average ticket trend reviewed`, `مراجعة معدل الضيوف العائدين واتجاه متوسط الفاتورة`, `Taux de clients fidèles et évolution du ticket moyen revus`],
  [`Market position: competitor openings/closings mapped; share estimate`, `الموقع في السوق: رصد افتتاحات/إغلاقات المنافسين؛ تقدير الحصة السوقية`, `Position sur le marché : ouvertures/fermetures concurrentes cartographiées ; part estimée`],
  [`Pricing strategy reviewed against cost inflation & competitor moves`, `مراجعة استراتيجية التسعير مقابل تضخم التكاليف وتحركات المنافسين`, `Stratégie tarifaire revue face à l'inflation des coûts et aux mouvements des concurrents`],
  [`Is the audit system itself being followed? Review next quarter's daily/weekly/monthly compliance rates`, `هل يُطبَّق نظام التدقيق نفسه؟ راجع معدلات الالتزام اليومية/الأسبوعية/الشهرية للربع القادم`, `Le système d'audit lui-même est-il suivi ? Revoir les taux de conformité quotidiens/hebdomadaires/mensuels du prochain trimestre`],

  // Weekly Audit — W1. Food Cost & Financial Leakage
  [`Weekly stock count completed for top 20 high-value items`, `إتمام الجرد الأسبوعي لأعلى 20 صنفًا من حيث القيمة`, `Inventaire hebdomadaire fait pour les 20 articles de plus forte valeur`],
  [`Theoretical vs actual food cost variance calculated — within 2%?`, `حساب الفرق بين تكلفة الطعام النظرية والفعلية — ضمن 2%؟`, `Écart coût matière théorique vs réel calculé — dans les 2 % ?`],
  [`Top 3 variance items investigated (over-portioning / waste / theft)`, `التحقيق في أعلى 3 أصناف من حيث الفرق (حصص زائدة / هدر / سرقة)`, `3 principaux écarts analysés (surportionnement / gaspillage / vol)`],
  [`Beverage cost variance calculated separately — within 1.5%?`, `حساب فرق تكلفة المشروبات بشكل منفصل — ضمن 1.5%؟`, `Écart coût boissons calculé séparément — dans les 1,5 % ?`],
  [`Waste log weekly total reviewed; trend vs previous 4 weeks plotted`, `مراجعة إجمالي سجل الهدر الأسبوعي؛ رسم الاتجاه مقارنة بالأسابيع الأربعة السابقة`, `Total hebdomadaire des pertes revu ; tendance sur les 4 semaines précédentes tracée`],
  [`Portion control spot audit: 5 items weighed across different staff`, `تدقيق مفاجئ للحصص: وزن 5 أصناف أعدّها موظفون مختلفون`, `Contrôle ponctuel des portions : 5 plats pesés, préparés par différentes personnes`],
  [`Staff meals policy compliance checked — logged, approved, costed`, `التحقق من الالتزام بسياسة وجبات الموظفين — مسجلة ومعتمدة ومحسوبة التكلفة`, `Respect de la politique repas du personnel vérifié — consignés, approuvés, chiffrés`],
  [`Supplier invoices matched to delivery notes & order sheets — no gaps`, `مطابقة فواتير الموردين مع أذون التسليم وأوامر الشراء — دون فجوات`, `Factures fournisseurs rapprochées des bons de livraison et de commande — sans écart`],

  // Weekly Audit — W2. POS Integrity & Fraud Prevention
  [`All voids reviewed: who, when, why — patterns by staff member?`, `مراجعة جميع عمليات الإلغاء: من، ومتى، ولماذا — هل هناك أنماط لدى موظف معين؟`, `Toutes les annulations revues : qui, quand, pourquoi — des schémas par employé ?`],
  [`All discounts reviewed against authorization records`, `مراجعة جميع الخصومات مقابل سجلات الاعتماد`, `Toutes les remises vérifiées par rapport aux autorisations`],
  [`Refund log matched to till & delivery platform records`, `مطابقة سجل المبالغ المستردة مع سجلات الصندوق ومنصات التوصيل`, `Registre des remboursements rapproché de la caisse et des plateformes de livraison`],
  [`Cash variance log: any till over/short above tolerance investigated`, `سجل الفروقات النقدية: التحقيق في أي زيادة/عجز في الصندوق يتجاوز الحد المسموح`, `Écarts de caisse : tout excédent/manque au-delà de la tolérance analysé`],
  [`No-sale drawer openings reviewed — frequency by cashier`, `مراجعة مرات فتح الدرج دون بيع — تكرارها لكل كاشير`, `Ouvertures de tiroir sans vente revues — fréquence par caissier`],
  [`Item deletion report (pre-send cancellations) reviewed for patterns`, `مراجعة تقرير حذف الأصناف (الإلغاء قبل الإرسال) بحثًا عن أنماط`, `Rapport de suppressions d'articles (annulations avant envoi) analysé`],
  [`CCTV spot check: 2 random transactions matched to camera footage`, `فحص عشوائي للكاميرات: مطابقة معاملتين عشوائيتين مع التسجيلات`, `Contrôle vidéo : 2 transactions au hasard comparées aux images`],

  // Weekly Audit — W3. Delivery Platforms & Digital Presence
  [`Aggregator menus (all platforms) accurate: items, prices, photos current`, `قوائم منصات التوصيل (جميعها) دقيقة: الأصناف والأسعار والصور محدّثة`, `Cartes sur les plateformes (toutes) exactes : plats, prix, photos à jour`],
  [`Order rejection / cancellation rate per platform — within target?`, `معدل رفض / إلغاء الطلبات لكل منصة — ضمن الهدف؟`, `Taux de refus / d'annulation par plateforme — dans l'objectif ?`],
  [`Platform downtime this week reviewed — reasons documented`, `مراجعة فترات توقف المنصات هذا الأسبوع — مع توثيق الأسباب`, `Indisponibilités des plateformes de la semaine revues — causes documentées`],
  [`Average delivery prep time vs promised time — gap analysis`, `متوسط وقت تحضير طلبات التوصيل مقابل الوقت الموعود — تحليل الفجوة`, `Temps moyen de préparation livraison vs temps promis — analyse de l'écart`],
  [`New reviews on all platforms read; themes logged; responses posted`, `قراءة التقييمات الجديدة على جميع المنصات؛ تسجيل المواضيع؛ نشر الردود`, `Nouveaux avis lus sur toutes les plateformes ; thèmes notés ; réponses publiées`],
  [`Rating trend per platform plotted vs previous 4 weeks`, `رسم اتجاه التقييم لكل منصة مقارنة بالأسابيع الأربعة السابقة`, `Évolution de la note par plateforme tracée sur les 4 semaines précédentes`],
  [`Delivery packaging test: order one delivery yourself — arrives intact, hot, sealed?`, `اختبار عبوات التوصيل: اطلب توصيلة بنفسك — هل تصل سليمة وساخنة ومحكمة الإغلاق؟`, `Test d'emballage : commander soi-même une livraison — arrive-t-elle intacte, chaude, scellée ?`],
  [`Social media: this week's posts published; comments & DMs answered`, `وسائل التواصل: نشر منشورات هذا الأسبوع؛ الرد على التعليقات والرسائل`, `Réseaux sociaux : publications de la semaine en ligne ; commentaires et messages traités`],

  // Weekly Audit — W4. Deep Cleaning Verification
  [`Extraction hood & filters degreased — inspect above and behind`, `إزالة الدهون من الشفاط والفلاتر — افحص الأعلى والخلف`, `Hotte et filtres dégraissés — inspecter au-dessus et derrière`],
  [`Grease trap emptied & cleaned — check the log AND the trap`, `تفريغ مصيدة الدهون وتنظيفها — افحص السجل والمصيدة معًا`, `Bac à graisse vidé et nettoyé — vérifier le registre ET le bac`],
  [`Drains flushed with approved treatment; no odor at floor level`, `غسل المصارف بالمعالجة المعتمدة؛ لا روائح على مستوى الأرض`, `Siphons rincés avec le traitement agréé ; aucune odeur au sol`],
  [`Ice machine interior sanitized — inspect for mold/slime`, `تعقيم داخل ماكينة الثلج — افحص وجود عفن/لزوجة`, `Intérieur de la machine à glaçons désinfecté — rechercher moisissures/dépôts visqueux`],
  [`Behind & under all equipment cleaned — move at least 3 units`, `تنظيف خلف جميع المعدات وأسفلها — حرّك 3 وحدات على الأقل`, `Derrière et sous tous les équipements nettoyés — déplacer au moins 3 appareils`],
  [`Walk-in fridge/freezer: shelving washed, door seals cleaned & intact`, `غرفة التبريد/التجميد: غسل الأرفف، وتنظيف جوانات الأبواب والتأكد من سلامتها`, `Chambre froide positive/négative : rayonnages lavés, joints de porte propres et intacts`],
  [`Fryers boiled out; oil disposal documented with certified collector`, `غلي القلايات بالماء للتنظيف؛ توثيق التخلص من الزيت مع جهة جمع معتمدة`, `Friteuses décapées à l'eau bouillante ; élimination de l'huile documentée avec un collecteur agréé`],
  [`Storage areas: shelving wiped, floor corners clean, nothing on floor`, `مناطق التخزين: مسح الأرفف، زوايا الأرض نظيفة، لا شيء على الأرض`, `Réserves : rayonnages essuyés, coins du sol propres, rien au sol`],
  [`A/C vents & fan guards dust-free in kitchen and dining areas`, `فتحات التكييف وحواجز المراوح خالية من الغبار في المطبخ وصالة الطعام`, `Bouches de climatisation et grilles de ventilateurs sans poussière en cuisine et en salle`],

  // Weekly Audit — W5. Maintenance & Asset Care
  [`Preventive maintenance schedule reviewed — this week's tasks done?`, `مراجعة جدول الصيانة الوقائية — هل أُنجزت مهام هذا الأسبوع؟`, `Planning de maintenance préventive revu — tâches de la semaine faites ?`],
  [`Breakdown log reviewed: repeat failures flagged for replacement decision`, `مراجعة سجل الأعطال: تمييز الأعطال المتكررة لاتخاذ قرار الاستبدال`, `Registre des pannes revu : pannes récurrentes signalées pour décision de remplacement`],
  [`Refrigeration: compressor sounds, door seals, drainage checked`, `التبريد: فحص أصوات الضاغط وجوانات الأبواب والتصريف`, `Froid : bruits du compresseur, joints de porte, évacuation vérifiés`],
  [`Cooking equipment: burners, thermostats, timers functioning to spec`, `معدات الطهي: الشعلات والثرموستات والمؤقتات تعمل وفق المواصفات`, `Matériel de cuisson : brûleurs, thermostats, minuteurs conformes`],
  [`Small equipment inventory: knives, boards, pans — condition & count`, `جرد المعدات الصغيرة: السكاكين والألواح والمقالي — الحالة والعدد`, `Inventaire du petit matériel : couteaux, planches, poêles — état et nombre`],
  [`Furniture walk: every chair & table tested; repairs actioned or booked`, `جولة الأثاث: اختبار كل كرسي وطاولة؛ تنفيذ الإصلاحات أو جدولتها`, `Tour du mobilier : chaque chaise et table testée ; réparations faites ou planifiées`],
  [`Lighting audit: 100% of bulbs working, including storage & restrooms`, `تدقيق الإضاءة: 100% من المصابيح تعمل، بما فيها المخازن ودورات المياه`, `Audit éclairage : 100 % des ampoules fonctionnent, réserves et toilettes comprises`],

  // Weekly Audit — W6. People: Training & Scheduling
  [`Next week's rota published; peak coverage matches sales forecast`, `نشر جدول مناوبات الأسبوع القادم؛ تغطية الذروة تتوافق مع توقعات المبيعات`, `Planning de la semaine prochaine publié ; couverture des pics conforme aux prévisions de ventes`],
  [`One training topic delivered this week (15-min huddle counts) — documented`, `تقديم موضوع تدريبي واحد هذا الأسبوع (يُحتسب لقاء قصير مدته 15 دقيقة) — موثق`, `Un thème de formation abordé cette semaine (un point de 15 min compte) — documenté`],
  [`New starters: onboarding checklist progress reviewed`, `الموظفون الجدد: مراجعة التقدم في قائمة التهيئة`, `Nouveaux arrivants : avancement de la check-list d'intégration revu`],
  [`Cross-training matrix updated — every station has 2+ capable staff?`, `تحديث مصفوفة التدريب المتعدد — هل لكل محطة موظفان مؤهلان أو أكثر؟`, `Matrice de polyvalence à jour — chaque poste a-t-il au moins 2 personnes compétentes ?`],
  [`Overtime & absence reviewed; patterns addressed with individuals`, `مراجعة العمل الإضافي والغياب؛ معالجة الأنماط مع الأفراد المعنيين`, `Heures supplémentaires et absences revues ; tendances traitées individuellement`],
  [`One-on-one check-in with at least 2 team members (rotate weekly)`, `لقاء فردي مع عضوين على الأقل من الفريق (بالتناوب أسبوعيًا)`, `Entretien individuel avec au moins 2 membres de l'équipe (rotation hebdomadaire)`],
]);
