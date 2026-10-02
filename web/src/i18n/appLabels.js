// Wording for the phone app layout (Claude Design handoff "SOPY App"): the
// tabs, Today, Library, Inbox and Notifications. Written [key, en, ar, fr]
// side by side like pageLabels.js and merged in i18n/index.jsx. Where the
// design's own Arabic and French existed for the same English, it's used.

const ROWS = [
  // --- Tabs and shell -------------------------------------------------
  ['app.tabs', 'Main sections', 'الأقسام الرئيسية', 'Sections principales'],
  ['app.tabToday', 'Today', 'اليوم', "Aujourd'hui"],
  ['app.tabLibrary', 'Library', 'المكتبة', 'Bibliothèque'],
  ['app.tabInbox', 'Inbox', 'الوارد', 'Messages'],
  ['app.tabProfile', 'Profile', 'الملف الشخصي', 'Profil'],
  ['app.notifications', 'Notifications', 'الإشعارات', 'Notifications'],
  ['app.notificationsUnread', 'Notifications, {n} unread', 'الإشعارات، {n} غير مقروءة', 'Notifications, {n} non lues'],

  // --- Today ----------------------------------------------------------
  ['app.goodMorning', 'Good morning, {name}', 'صباح الخير يا {name}', 'Bonjour, {name}'],
  ['app.goodAfternoon', 'Good afternoon, {name}', 'مساء الخير يا {name}', 'Bon après-midi, {name}'],
  ['app.goodEvening', 'Good evening, {name}', 'مساء الخير يا {name}', 'Bonsoir, {name}'],
  ['app.checklistsDone', '{done} of {total} checklists done', 'أُنجزت {done} من {total} قوائم فحص', '{done} check-lists sur {total} terminées'],
  ['app.dailyReports', 'Daily reports', 'التقارير اليومية', 'Rapports quotidiens'],
  ['app.opening', 'Opening', 'الافتتاح', 'Ouverture'],
  ['app.closing', 'Closing', 'الإغلاق', 'Fermeture'],
  ['app.visitReports', 'Visit reports', 'تقارير الزيارات', 'Rapports de visite'],

  // --- Welcome (sample cards) ----------------------------------------
  ['welcome.sampleReport', 'Daily QC Checklist', 'قائمة فحص الجودة اليومية', 'Check-list QC quotidienne'],
  ['welcome.green', 'Green', 'أخضر', 'Vert'],
  ['welcome.sampleCompliant', '101 of 104 checkpoints compliant', '101 من 104 بنود فحص مطابقة', '101 points de contrôle conformes sur 104'],
  ['welcome.photoCaptured', 'Photo evidence captured', 'تم التقاط صورة الإثبات', 'Photo de preuve prise'],
  ['welcome.photoMeta', 'Walk-in chiller · 3.2 °C · 07:42', 'غرفة التبريد · 3.2 °م · 07:42', 'Chambre froide · 3,2 °C · 07:42'],

  // --- Library --------------------------------------------------------
  ['library.intro', 'SOPs and QC checkpoints your team runs.', 'إجراءات التشغيل وبنود فحص الجودة التي ينفذها فريقك.', 'Les procédures et points de contrôle qualité de votre équipe.'],
  ['library.search', 'Search procedures and checkpoints', 'ابحث في الإجراءات وبنود الفحص', 'Rechercher procédures et points de contrôle'],
  ['library.filter.all', 'All', 'الكل', 'Tout'],
  ['library.filter.qc', 'QC audits', 'تدقيقات الجودة', 'Audits qualité'],
  ['library.filter.sop', 'SOPs', 'الإجراءات', 'Procédures'],
  ['library.filter.health', 'Health code', 'اللائحة الصحية', 'Code sanitaire'],
  ['library.filter.starter', 'Starter sets', 'مجموعات البداية', 'Ensembles de départ'],
  ['library.filter.cstore', 'C-Store', 'المتجر الصغير', 'Supérette'],
  ['library.filter.custom', 'Your own', 'الخاصة بك', 'Les vôtres'],
  ['library.count', '{groups} procedures · {items} checkpoints', '{groups} إجراءً · {items} بند فحص', '{groups} procédures · {items} points de contrôle'],
  ['library.checkpoints', '{n} checkpoints', '{n} بند فحص', '{n} points de contrôle'],
  ['library.criticalCount', '{n} critical', '{n} حرج', '{n} critiques'],
  ['library.none', 'No procedures match your search.', 'لا توجد إجراءات تطابق بحثك.', 'Aucune procédure ne correspond à votre recherche.'],
  ['library.notFound', "This procedure isn't in the library.", 'هذا الإجراء غير موجود في المكتبة.', "Cette procédure n'est pas dans la bibliothèque."],
  ['library.researched', 'Researched', 'من البحث', 'Issu de recherches'],
  ['library.statCheckpoints', 'Checkpoints', 'البنود', 'Points de contrôle'],
  ['library.statCritical', 'Critical', 'حرجة', 'Critiques'],
  ['library.statFrequency', 'Frequency', 'التكرار', 'Fréquence'],
  ['library.critical', 'Critical', 'حرج', 'Critique'],
  ['library.photoRequired', 'Photo required', 'صورة مطلوبة', 'Photo requise'],
  ['library.sourceClient', "From your own procedures manual. Critical marks follow your manual's ⚠ items.", 'من دليل الإجراءات الخاص بك. علامات البنود الحرجة تتبع البنود المعلَّمة بـ ⚠ في دليلك.', 'Tiré de votre propre manuel de procédures. Les points critiques suivent les ⚠ de votre manuel.'],
  ['library.sourceResearched', 'Researched from public sources (such as the FDA Food Code) as a starting point. Review it against your local rules before relying on it.', 'مُعدّ من مصادر عامة (مثل قانون الأغذية الأمريكي FDA) كنقطة بداية. راجعه وفق لوائحك المحلية قبل الاعتماد عليه.', "Issu de sources publiques (comme le FDA Food Code), comme point de départ. Vérifiez-le par rapport à votre réglementation locale avant de vous y fier."],
  ['library.sourceCustom', "Checkpoints your business added.", 'بنود فحص أضافتها منشأتك.', 'Points de contrôle ajoutés par votre entreprise.'],
  ['library.addToChecklist', 'Add to checklist', 'إضافة إلى قائمة الفحص', 'Ajouter à la check-list'],
  ['library.runNow', 'Run now', 'تنفيذ الآن', 'Lancer maintenant'],

  // --- Reports --------------------------------------------------------
  ['reports.search', 'Search by report, store or person', 'ابحث بالتقرير أو الفرع أو الشخص', 'Rechercher par rapport, établissement ou personne'],
  ['reports.noMatch', 'No reports match.', 'لا توجد تقارير مطابقة.', 'Aucun rapport ne correspond.'],
  ['reports.filter.all', 'All', 'الكل', 'Tout'],
  ['reports.filter.incidents', 'Incidents', 'الحوادث', 'Incidents'],
  ['reports.filter.checklists', 'Checklists', 'قوائم الفحص', 'Check-lists'],
  ['reports.filter.daily', 'Daily reports', 'التقارير اليومية', 'Rapports quotidiens'],
  ['reports.filter.visits', 'Visits', 'الزيارات', 'Visites'],

  // --- Inbox ----------------------------------------------------------
  ['inbox.intro', 'Incidents open a thread with the managers who need to act.', 'تفتح كل حادثة محادثة مع المديرين المعنيين بالتصرف.', 'Chaque incident ouvre une conversation avec les managers qui doivent agir.'],
  ['inbox.newMessage', 'New message', 'رسالة جديدة', 'Nouveau message'],
  ['inbox.noPeople', 'No one else is on the team yet.', 'لا يوجد أحد آخر في الفريق بعد.', "Personne d'autre dans l'équipe pour l'instant."],
  ['inbox.empty', 'No messages yet. Incidents and conversations with your team show up here.', 'لا توجد رسائل بعد. تظهر هنا الحوادث والمحادثات مع فريقك.', 'Aucun message pour le moment. Les incidents et les conversations avec votre équipe apparaissent ici.'],
  ['inbox.notFound', "This conversation can't be opened. It may not include you.", 'تعذّر فتح هذه المحادثة. قد لا تكون من أعضائها.', "Impossible d'ouvrir cette conversation. Vous n'en faites peut-être pas partie."],
  ['inbox.incidentTitle', 'Incident · {report}', 'حادثة · {report}', 'Incident · {report}'],
  ['inbox.members', '{store} · {n} members', '{store} · {n} أعضاء', '{store} · {n} membres'],
  ['inbox.incidentAt', '{report} at {store}.', '{report} في {store}.', '{report} à {store}.'],
  ['inbox.criticalFailed', '{n} critical checkpoint(s) failed. This report is flagged as an incident.', 'لم يتحقق {n} من البنود الحرجة. تم تصنيف هذا التقرير كحادثة.', "{n} point(s) de contrôle critique(s) non conforme(s). Ce rapport est signalé comme incident."],
  ['inbox.tempsOut', '{n} temperature reading(s) out of the safe range. This report is flagged as an incident.', '{n} من قراءات الحرارة خارج النطاق الآمن. تم تصنيف هذا التقرير كحادثة.', '{n} relevé(s) de température hors de la plage sûre. Ce rapport est signalé comme incident.'],
  ['inbox.flagged', 'This report is flagged as an incident.', 'تم تصنيف هذا التقرير كحادثة.', 'Ce rapport est signalé comme incident.'],
  ['inbox.filedBy', 'Filed by {name}.', 'قدّمه {name}.', 'Déposé par {name}.'],
  ['inbox.notifiedCount', '{n} manager(s) notified.', 'تم إبلاغ {n} من المديرين.', '{n} manager(s) prévenu(s).'],
  ['inbox.you', 'You: {text}', 'أنت: {text}', 'Vous : {text}'],
  ['inbox.formerMember', 'Former team member', 'عضو سابق في الفريق', "Ancien membre de l'équipe"],
  ['inbox.yesterday', 'Yesterday', 'أمس', 'Hier'],
  ['inbox.message', 'Message', 'رسالة', 'Message'],
  ['inbox.send', 'Send', 'إرسال', 'Envoyer'],

  ['inbox.storeChat', '{store} team', 'فريق {store}', 'Équipe {store}'],
  ['inbox.memberCount', '{n} members', '{n} أعضاء', '{n} membres'],
  ['inbox.storeChatEmpty', 'Team chat for everyone at this store.', 'محادثة الفريق لكل العاملين في هذا الفرع.', "Discussion d'équipe pour tout l'établissement."],

  // --- Store time zone ----------------------------------------------
  ['tz.label', 'Time zone', 'المنطقة الزمنية', 'Fuseau horaire'],
  ['tz.labelFor', 'Time zone for {store}', 'المنطقة الزمنية لـ {store}', 'Fuseau horaire de {store}'],
  ['tz.hint', "Checklist due times and reminders follow the store's clock.", 'مواعيد قوائم الفحص وتذكيراتها تتبع توقيت الفرع.', "Les heures limites et les rappels suivent l'heure de l'établissement."],

  // --- Phone notifications ----------------------------------------------
  ['push.title', 'Phone notifications', 'إشعارات الهاتف', 'Notifications sur le téléphone'],
  ['push.onHint', 'On for this device. They show even when SOPY is closed.', 'مفعّلة على هذا الجهاز. تظهر حتى عندما يكون SOPY مغلقًا.', 'Activées sur cet appareil. Elles s’affichent même quand SOPY est fermé.'],
  ['push.offHint', 'Get alerts and reminders on this device even when SOPY is closed.', 'تلقَّ التنبيهات والتذكيرات على هذا الجهاز حتى عندما يكون SOPY مغلقًا.', 'Recevez alertes et rappels sur cet appareil même quand SOPY est fermé.'],
  ['push.blocked', 'Blocked in this browser. Allow notifications for SOPY in the browser’s site settings, then come back here.', 'محظورة في هذا المتصفح. اسمح بإشعارات SOPY من إعدادات الموقع في المتصفح ثم عُد إلى هنا.', 'Bloquées dans ce navigateur. Autorisez les notifications de SOPY dans les réglages du site, puis revenez ici.'],
  ['push.homeScreen', 'On iPhone, add SOPY to your Home Screen first (Share › Add to Home Screen), then turn them on from there.', 'على iPhone، أضف SOPY إلى الشاشة الرئيسية أولًا (مشاركة › إضافة إلى الشاشة الرئيسية)، ثم فعّلها من هناك.', "Sur iPhone, ajoutez d'abord SOPY à l'écran d'accueil (Partager › Sur l'écran d'accueil), puis activez-les depuis là."],
  ['push.failed', "Couldn't turn on notifications on this device. Check that SOPY is allowed to send notifications, then try again.", 'تعذّر تفعيل الإشعارات على هذا الجهاز. تأكد من السماح لـ SOPY بإرسال الإشعارات ثم حاول مجددًا.', "Impossible d'activer les notifications sur cet appareil. Vérifiez que SOPY est autorisé à en envoyer, puis réessayez."],
  ['push.unsupported', "This browser can't show phone notifications.", 'لا يدعم هذا المتصفح إشعارات الهاتف.', 'Ce navigateur ne peut pas afficher de notifications.'],

  // --- Notifications --------------------------------------------------
  ['notif.markAll', 'Mark all read', 'تعليم الكل كمقروء', 'Tout marquer comme lu'],
  ['notif.today', 'Today', 'اليوم', "Aujourd'hui"],
  ['notif.earlier', 'Earlier', 'سابقًا', 'Plus tôt'],
  ['notif.empty', "You're all caught up.", 'لا جديد لديك.', 'Vous êtes à jour.'],
  ['notif.unread', 'Unread', 'غير مقروء', 'Non lu'],
  ['notif.criticalTitle', 'Critical fail flagged', 'رُصد إخفاق حرج', 'Échec critique signalé'],
  ['notif.incidentTitle', 'Incident flagged', 'رُصدت حادثة', 'Incident signalé'],
  ['notif.submittedTitle', '{report} submitted', 'تم تقديم {report}', '{report} envoyé'],
  ['notif.dueTitle', '{report} due at {time}', '{report} مستحق الساعة {time}', '{report} à faire avant {time}'],
  ['notif.dueNotStarted', 'Not started yet', 'لم يبدأ بعد', 'Pas encore commencé'],
  ['notif.dueStarted', 'Started, not signed off yet', 'بدأ ولم يُعتمد بعد', 'Commencé, pas encore validé'],
  ['prefs.incidents', 'Critical fails & incidents', 'الإخفاقات الحرجة والحوادث', 'Échecs critiques et incidents'],
  ['prefs.incidentsHint', 'When a report at your store is flagged. You stay in its Inbox thread either way.', 'عند تصنيف تقرير في فرعك كحادثة. تبقى في محادثته في الوارد في كل الأحوال.', "Quand un rapport de votre établissement est signalé. Vous restez dans sa conversation dans tous les cas."],
  ['prefs.reminders', 'Checklist reminders', 'تذكيرات قوائم الفحص', 'Rappels de check-lists'],
  ['prefs.remindersHint', '30 minutes before a checklist is due, if it isn\'t done yet.', 'قبل 30 دقيقة من موعد قائمة الفحص إن لم تُنجز بعد.', "30 minutes avant l'heure limite d'une check-list, si elle n'est pas encore faite."],
  ['builder.dueBy', 'Due by', 'موعد الإنجاز', 'À faire avant'],
  ['builder.dueByHint', 'Optional. People get a reminder 30 minutes before, in the store\'s time zone.', 'اختياري. يصل تذكير قبل 30 دقيقة، بتوقيت الفرع.', "Facultatif. Un rappel est envoyé 30 minutes avant, à l'heure de l'établissement."],
  ['app.dueAt', 'Due {time}', 'مستحق {time}', 'Avant {time}'],
  ['notif.referralTitle', 'Referral credit earned', 'حصلت على رصيد إحالة', 'Crédit de parrainage obtenu'],
  // --- NFSA site visit (pages/nfsa/NfsaVisit.jsx) -----------------------
  ['nfsa.title', 'NFSA site visit', 'زيارة هيئة سلامة الغذاء', "Visite d'inspection NFSA"],
  ['nfsa.menu', 'NFSA visit', 'زيارة هيئة سلامة الغذاء', 'Visite NFSA'],
  ['nfsa.rowMeta', 'Self-inspection before an inspection visit', 'تفتيش ذاتي قبل زيارة التفتيش', "Auto-inspection avant une visite d'inspection"],
  ['nfsa.intro', "Egypt's National Food Safety Authority (NFSA) inspects food businesses on site against a checklist of food safety requirements. Run this self-inspection before a visit to find and fix gaps: the same areas, with a photo for every checkpoint.", 'تجري الهيئة القومية لسلامة الغذاء المصرية (NFSA) زيارات تفتيش وتدقيق ميداني للمنشآت الغذائية وفق قائمة فحص لاشتراطات سلامة الغذاء. نفّذ هذا التفتيش الذاتي قبل الزيارة لاكتشاف أوجه القصور ومعالجتها: نفس المحاور، مع صورة لكل بند.', "L'Autorité nationale égyptienne de sécurité des aliments (NFSA) inspecte sur place les établissements alimentaires selon une grille d'exigences. Faites cette auto-inspection avant une visite pour repérer et corriger les écarts : les mêmes points, avec une photo pour chacun."],
  ['nfsa.scoringTitle', 'How a visit is scored', 'كيف تُقيَّم الزيارة', 'Comment une visite est notée'],
  ['nfsa.tierCritical', 'Critical', 'حاسمة', 'Critique'],
  ['nfsa.tierCriticalNote', 'No failed point is allowed. Here, a failed critical checkpoint flags an incident.', 'لا يُسمح بأي مخالفة. هنا، أي بند حرج غير مستوفي يُسجَّل كحادثة.', 'Aucun écart toléré. Ici, un point critique non conforme signale un incident.'],
  ['nfsa.tierImportant', 'Important', 'هامة', 'Important'],
  ['nfsa.tierNecessary', 'Necessary', 'ضرورية', 'Nécessaire'],
  ['nfsa.someAccepted', 'Some failed points are accepted.', 'يُقبل وجود بعض المخالفات.', 'Quelques écarts sont acceptés.'],
  ['nfsa.checksTitle', 'What the inspectors check', 'ما يفحصه المفتشون', 'Ce que vérifient les inspecteurs'],
  ['nfsa.area.staff', 'Staff', 'العاملون', 'Personnel'],
  ['nfsa.area.staffNote', 'Personal hygiene, hand washing, protective clothing, health certificates and training.', 'النظافة الشخصية وغسل الأيدي والملابس الواقية والشهادات الصحية والتدريب.', 'Hygiène personnelle, lavage des mains, tenue de protection, certificats de santé et formation.'],
  ['nfsa.area.premises', 'Premises', 'المنشأة والتصميم', 'Locaux'],
  ['nfsa.area.premisesNote', 'Away from contamination, a layout that keeps raw and cooked food apart, ventilation, lighting and separate toilets.', 'البعد عن مصادر التلوث، وتصميم يمنع التلوث المتبادل بين الأغذية النيئة والمطهية، والتهوية والإضاءة ودورات مياه مستقلة.', 'Éloignés des sources de contamination, agencement séparant cru et cuit, ventilation, éclairage et toilettes séparées.'],
  ['nfsa.area.storage', 'Storage & transport', 'التخزين والنقل', 'Stockage et transport'],
  ['nfsa.area.storageNote', 'Temperatures and humidity, first in first out, nothing expired, and food protected in storage and transport.', 'درجات الحرارة والرطوبة، وما يدخل أولًا يخرج أولًا، ولا منتجات منتهية الصلاحية، وحماية الغذاء أثناء التخزين والنقل.', 'Températures et humidité, premier entré premier sorti, rien de périmé, et aliments protégés au stockage et au transport.'],
  ['nfsa.area.pests', 'Pests & cleaning', 'مكافحة الآفات والنظافة', 'Nuisibles et nettoyage'],
  ['nfsa.area.pestsNote', 'Documented cleaning and sanitising plans, and an effective pest-control programme.', 'خطط موثقة للتنظيف والتطهير وبرنامج فعال لمكافحة الحشرات والقوارض.', 'Plans de nettoyage et de désinfection documentés, et un programme efficace de lutte contre les nuisibles.'],
  ['nfsa.area.haccp', 'HACCP', 'نظام الهاسب (HACCP)', 'HACCP'],
  ['nfsa.area.haccpNote', 'HACCP and good practices applied, critical control points monitored, and records kept.', 'تطبيق مبادئ الهاسب والممارسات الجيدة، ومراقبة نقاط التحكم الحرجة، والاحتفاظ بالسجلات.', 'HACCP et bonnes pratiques appliqués, points critiques surveillés et registres tenus.'],
  ['nfsa.docsTitle', 'Have these ready for the inspector', 'جهّز هذه للمفتش', "À préparer pour l'inspecteur"],
  ['nfsa.doc1', 'Food safety file: prerequisite programmes (PRPs) and cleaning and sanitising plans', 'ملف سلامة الغذاء: برامج الاشتراطات الأساسية (PRPs) وخطط التنظيف والتطهير', 'Dossier de sécurité des aliments : programmes prérequis (PRP) et plans de nettoyage et de désinfection'],
  ['nfsa.doc2', 'Daily fridge and freezer temperature records', 'سجلات درجات حرارة الثلاجات والمجمدات اليومية', 'Relevés quotidiens des températures des réfrigérateurs et congélateurs'],
  ['nfsa.doc3', 'Purchase invoices, to trace food and recall it if needed', 'فواتير الشراء لتتبع الأغذية وسحبها عند الحاجة', "Factures d'achat, pour tracer les aliments et les rappeler si besoin"],
  ['nfsa.doc4', 'Valid health certificates for every worker', 'شهادات صحية سارية لجميع العاملين', 'Certificats de santé valides pour chaque employé'],
  ['nfsa.doc5', 'Pest-control contract and visit records', 'عقد مكافحة الآفات وسجلات الزيارات', 'Contrat de lutte contre les nuisibles et registres de passage'],
  ['nfsa.doc6', 'Licence, and the supplier list (NFSA white list)', 'الرخصة وقائمة الموردين (القائمة البيضاء للهيئة)', 'Licence et liste des fournisseurs (liste blanche de la NFSA)'],
  ['nfsa.pastTitle', 'Your self-inspections', 'عمليات التفتيش الذاتي', 'Vos auto-inspections'],
  ['nfsa.noneYet', 'None yet. Start one below.', 'لا توجد بعد. ابدأ واحدة من الأسفل.', "Aucune pour l'instant. Lancez-en une ci-dessous."],
  ['nfsa.inProgress', 'In progress', 'قيد التنفيذ', 'En cours'],
  ['nfsa.start', 'Start self-inspection', 'ابدأ التفتيش الذاتي', "Lancer l'auto-inspection"],
  ['nfsa.allCheckpoints', 'See every checkpoint', 'عرض كل البنود', 'Voir tous les points de contrôle'],
  ['library.filter.nfsa', 'NFSA', 'هيئة سلامة الغذاء', 'NFSA'],
  ['library.sourceNfsa', "Based on the inspection form and requirements of Egypt's National Food Safety Authority (NFSA), adapted for restaurants. Use it to prepare for a visit; the inspectors' own form is what counts.", 'مبني على قائمة فحص الهيئة القومية لسلامة الغذاء المصرية (NFSA) واشتراطاتها، مع تكييفها للمطاعم. استخدمه للاستعداد للزيارة، والمعتمد هو نموذج المفتشين أنفسهم.', "Fondé sur la grille d'inspection et les exigences de l'Autorité nationale égyptienne de sécurité des aliments (NFSA), adaptées aux restaurants. Servez-vous-en pour préparer une visite ; seule compte la grille des inspecteurs."],

  // --- Password and phone boxes ------------------------------------------
  ['field.showPassword', 'Show password', 'إظهار كلمة المرور', 'Afficher le mot de passe'],
  ['field.hidePassword', 'Hide password', 'إخفاء كلمة المرور', 'Masquer le mot de passe'],
  ['field.countryCode', 'Country code', 'رمز الدولة', 'Indicatif du pays'],
  ['field.phoneNumber', 'Phone number', 'رقم الهاتف', 'Numéro de téléphone'],
  ['notif.referralBody', '{name} made its first payment. {amount} comes off your next SOPY payment.', 'سدّد {name} أول دفعة. سيُخصم {amount} من دفعتك القادمة في SOPY.', '{name} a effectué son premier paiement. {amount} seront déduits de votre prochain paiement SOPY.'],
];

export const APP_LABELS = { en: {}, ar: {}, fr: {} };
for (const [key, en, ar, fr] of ROWS) {
  APP_LABELS.en[key] = en;
  APP_LABELS.ar[key] = ar;
  APP_LABELS.fr[key] = fr;
}
