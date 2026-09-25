// Arabic and French for the error messages the API sends people, so a
// refused action reads in the language the app is shown in. Keyed by the
// exact English message; messages with numbers in them are matched by
// PATTERNS instead. Anything not listed (developer-facing validation such
// as "templateId is required") stays in English.
import { isSupportedLanguage, DEFAULT_LANGUAGE } from '../../../shared/languages.js';

const MESSAGES = [
  ['Not found', 'غير موجود', 'Introuvable'],
  ['Password is too long', 'كلمة المرور طويلة جدًا', 'Le mot de passe est trop long'],
  ['Too many failed attempts. Wait 15 minutes and try again.', 'محاولات فاشلة كثيرة. انتظر 15 دقيقة ثم حاول مجددًا.', 'Trop de tentatives échouées. Attendez 15 minutes et réessayez.'],
  ['You can only manage people below your own role', 'يمكنك إدارة من هم دون دورك فقط', 'Vous ne pouvez gérer que les personnes dont le rôle est inférieur au vôtre'],
  ['User not found', 'المستخدم غير موجود', 'Utilisateur introuvable'],
  ['Unknown role', 'دور غير معروف', 'Rôle inconnu'],
  ['This photo link is not valid', 'رابط الصورة هذا غير صالح', "Ce lien de photo n'est pas valide"],
  ['This link is not valid', 'هذا الرابط غير صالح', "Ce lien n'est pas valide"],
  ['Password must be at least 8 characters', 'يجب أن تتكون كلمة المرور من 8 أحرف على الأقل', 'Le mot de passe doit contenir au moins 8 caractères'],
  ['One or more stores were not found', 'لم يتم العثور على فرع واحد أو أكثر', 'Un ou plusieurs établissements sont introuvables'],
  ['No fields to update', 'لا توجد بيانات لتحديثها', 'Aucun champ à mettre à jour'],
  ['Nothing to update', 'لا يوجد ما يُحدَّث', 'Rien à mettre à jour'],
  ['No active subscription', 'لا يوجد اشتراك نشط', "Aucun abonnement actif"],
  ['Missing required fields', 'بعض الحقول المطلوبة ناقصة', 'Des champs obligatoires sont manquants'],
  ['Missing fields', 'بعض الحقول ناقصة', 'Des champs sont manquants'],
  ['Missing credentials', 'أدخل البريد الإلكتروني وكلمة المرور', "Saisissez l'e-mail et le mot de passe"],
  ['Enter a valid email address', 'أدخل بريدًا إلكترونيًا صحيحًا', 'Saisissez une adresse e-mail valide'],
  ['An account with this email already exists', 'يوجد حساب بهذا البريد الإلكتروني بالفعل', 'Un compte existe déjà avec cet e-mail'],
  ['A user with this email already exists', 'يوجد مستخدم بهذا البريد الإلكتروني بالفعل', 'Un utilisateur existe déjà avec cet e-mail'],
  ['Your SOPY subscription has ended. Past reports stay available; subscribe again in Profile & billing to continue.', 'انتهى اشتراكك في SOPY. تظل التقارير السابقة متاحة؛ اشترك مجددًا من الملف الشخصي والفواتير للمتابعة.', 'Votre abonnement SOPY a pris fin. Les rapports passés restent disponibles ; réabonnez-vous dans Profil et facturation pour continuer.'],
  ['Your plan needs at least 1 branch and 1 user before checkout.', 'تحتاج خطتك إلى فرع واحد ومستخدم واحد على الأقل قبل الدفع.', "Votre formule doit comporter au moins 1 établissement et 1 utilisateur avant le paiement."],
  ['Your password was changed. Please sign in again.', 'تم تغيير كلمة المرور. يُرجى تسجيل الدخول مجددًا.', 'Votre mot de passe a été modifié. Reconnectez-vous.'],
  ['Your current password is not correct', 'كلمة المرور الحالية غير صحيحة', 'Votre mot de passe actuel est incorrect'],
  ['You can only assign roles below your own', 'يمكنك تعيين أدوار دون دورك فقط', "Vous ne pouvez attribuer que des rôles inférieurs au vôtre"],
  ['You can only invite people to roles below your own', 'يمكنك دعوة أشخاص لأدوار دون دورك فقط', "Vous ne pouvez inviter qu'à des rôles inférieurs au vôtre"],
  ["You can't change your own role or status", 'لا يمكنك تغيير دورك أو حالتك بنفسك', 'Vous ne pouvez pas modifier votre propre rôle ou statut'],
  ['Write a message before sending.', 'اكتب رسالة قبل الإرسال.', "Écrivez un message avant d'envoyer."],
  ['Choose what kind of feedback this is.', 'اختر نوع الملاحظة.', "Choisissez le type de retour."],
  ['Unsupported language', 'لغة غير مدعومة', 'Langue non prise en charge'],
  ['Unknown status', 'حالة غير معروفة', 'Statut inconnu'],
  ['Unknown standard', 'معيار غير معروف', 'Norme inconnue'],
  ['Unknown report kind', 'نوع تقرير غير معروف', 'Type de rapport inconnu'],
  ['Unknown frequency', 'تكرار غير معروف', 'Fréquence inconnue'],
  ['Unknown business type', 'نوع نشاط غير معروف', "Type d'établissement inconnu"],
  ['This report is too large to save', 'هذا التقرير أكبر من أن يُحفظ', 'Ce rapport est trop volumineux pour être enregistré'],
  ['This report is no longer available', 'هذا التقرير لم يعد متاحًا', "Ce rapport n'est plus disponible"],
  ['This report has already been submitted', 'تم إرسال هذا التقرير بالفعل', 'Ce rapport a déjà été envoyé'],
  ['This photo link has expired', 'انتهت صلاحية رابط الصورة', 'Ce lien de photo a expiré'],
  ['This link has expired', 'انتهت صلاحية هذا الرابط', 'Ce lien a expiré'],
  ['This link has already been used or is no longer valid', 'تم استخدام هذا الرابط بالفعل أو لم يعد صالحًا', "Ce lien a déjà été utilisé ou n'est plus valide"],
  ['This is still in use and can’t be removed', 'هذا العنصر ما زال مستخدمًا ولا يمكن حذفه', 'Cet élément est encore utilisé et ne peut pas être supprimé'],
  ['That store name is too long', 'اسم الفرع طويل جدًا', 'Ce nom d\'établissement est trop long'],
  ['That name or email is too long', 'الاسم أو البريد الإلكتروني طويل جدًا', "Ce nom ou cet e-mail est trop long"],
  ['That checkpoint text is too long', 'نص نقطة الفحص طويل جدًا', 'Ce texte de point de contrôle est trop long'],
  ['That checkpoint is not part of this checklist', 'نقطة الفحص هذه ليست ضمن قائمة الفحص', "Ce point de contrôle ne fait pas partie de cette check-list"],
  ['That checklist name is too long', 'اسم قائمة الفحص طويل جدًا', 'Ce nom de check-list est trop long'],
  ['That already exists', 'هذا موجود بالفعل', 'Cela existe déjà'],
  ['Submit the report before sharing it', 'أرسل التقرير قبل مشاركته', 'Envoyez le rapport avant de le partager'],
  ['Some checkpoints were not found', 'لم يتم العثور على بعض نقاط الفحص', 'Certains points de contrôle sont introuvables'],
  ['Pick at least one checkpoint', 'اختر نقطة فحص واحدة على الأقل', 'Choisissez au moins un point de contrôle'],
  ['Enable this person before sending them a link', 'فعّل هذا الشخص قبل إرسال رابط إليه', 'Réactivez cette personne avant de lui envoyer un lien'],
  ['This link has expired. Ask your manager for a new one.', 'انتهت صلاحية هذا الرابط. اطلب رابطًا جديدًا من مديرك.', 'Ce lien a expiré. Demandez-en un nouveau à votre manager.'],
  ['No checkout in progress', 'لا توجد عملية دفع جارية', 'Aucun paiement en cours'],
  ['New password must be at least 8 characters', 'يجب أن تتكون كلمة المرور الجديدة من 8 أحرف على الأقل', 'Le nouveau mot de passe doit contenir au moins 8 caractères'],
  ['Name cannot be empty', 'لا يمكن ترك الاسم فارغًا', 'Le nom ne peut pas être vide'],
  ['Missing authorization token', 'يُرجى تسجيل الدخول', 'Veuillez vous connecter'],
  ['Keep the note under 2000 characters', 'اجعل الملاحظة أقل من 2000 حرف', 'La note doit faire moins de 2000 caractères'],
  ['Invalid session', 'انتهت الجلسة. سجّل الدخول مجددًا.', 'Session expirée. Reconnectez-vous.'],
  ['Invalid or expired token', 'انتهت الجلسة. سجّل الدخول مجددًا.', 'Session expirée. Reconnectez-vous.'],
  ['Invalid role', 'دور غير صالح', 'Rôle non valide'],
  ['Invalid onboarding step', 'خطوة إعداد غير صالحة', 'Étape de configuration non valide'],
  ['Invalid id', 'معرّف غير صالح', 'Identifiant non valide'],
  ['Invalid date', 'تاريخ غير صالح', 'Date non valide'],
  ['That number is out of range', 'هذا الرقم خارج النطاق المسموح', 'Ce nombre est hors limites'],
  ['That text is too long', 'هذا النص طويل جدًا', 'Ce texte est trop long'],
  ['Invalid email or password', 'البريد الإلكتروني أو كلمة المرور غير صحيحة', 'E-mail ou mot de passe incorrect'],
  ['Insufficient permissions', 'ليست لديك صلاحية لهذا الإجراء', "Vous n'avez pas l'autorisation pour cette action"],
  ['Finish onboarding before building checklists', 'أكمل الإعداد قبل إنشاء قوائم الفحص', 'Terminez la configuration avant de créer des check-lists'],
  ['Enter your current and new password', 'أدخل كلمة المرور الحالية والجديدة', 'Saisissez votre mot de passe actuel et le nouveau'],
  ['Choose a plan and complete checkout first', 'اختر خطة وأكمل الدفع أولًا', "Choisissez une formule et finalisez d'abord le paiement"],
  ['Checklist, store or user not found', 'قائمة الفحص أو الفرع أو المستخدم غير موجود', 'Check-list, établissement ou utilisateur introuvable'],
  ['Checklist or store not found', 'قائمة الفحص أو الفرع غير موجود', 'Check-list ou établissement introuvable'],
  ['Change your own password in Profile & billing', 'غيّر كلمة مرورك من الملف الشخصي والفواتير', 'Modifiez votre propre mot de passe dans Profil et facturation'],
  ['Branch name is required', 'اسم الفرع مطلوب', 'Le nom de l\'établissement est obligatoire'],
  ['Branch and user counts must be numbers', 'يجب أن يكون عدد الفروع والمستخدمين أرقامًا', "Le nombre d'établissements et d'utilisateurs doit être un nombre"],
  ['Assignment not found', 'التكليف غير موجود', 'Attribution introuvable'],
  ['Only checklists built in the Checklist Builder can be assigned', 'يمكن تكليف قوائم الفحص المُنشأة في منشئ قوائم الفحص فقط', 'Seules les check-lists créées dans le créateur de check-lists peuvent être attribuées'],
  ['File too large', 'الملف كبير جدًا', 'Fichier trop volumineux'],
  ['Account disabled', 'الحساب معطّل', 'Compte désactivé'],
  ['A PDF file is required', 'مطلوب ملف PDF', 'Un fichier PDF est requis'],
  ['Only PDF files can be shared', 'يمكن مشاركة ملفات PDF فقط', 'Seuls les fichiers PDF peuvent être partagés'],
  ['Only camera-captured JPEG/PNG images are accepted', 'تُقبل الصور الملتقطة بالكاميرا فقط (JPEG/PNG)', "Seules les photos prises avec l'appareil (JPEG/PNG) sont acceptées"],
  // Second sentences of the "plan is full" message (see PATTERNS).
  ['Ask the business owner to add more to the plan.', 'اطلب من مالك المنشأة إضافة المزيد إلى الخطة.', "Demandez au propriétaire d'augmenter la formule."],
  ['You can add more from Profile & billing once setup is finished.', 'يمكنك إضافة المزيد من الملف الشخصي والفواتير بعد انتهاء الإعداد.', 'Vous pourrez en ajouter depuis Profil et facturation une fois la configuration terminée.'],
  ['Change your plan in Profile & billing to add more.', 'غيّر خطتك من الملف الشخصي والفواتير لإضافة المزيد.', 'Modifiez votre formule dans Profil et facturation pour en ajouter.'],
];

const EXACT = { ar: {}, fr: {} };
for (const [en, ar, fr] of MESSAGES) {
  EXACT.ar[en] = ar;
  EXACT.fr[en] = fr;
}

// Messages with numbers in them. Each returns null when it can't
// translate a part, so the whole message stays English rather than mixed.
const PATTERNS = [
  {
    re: /^Your plan covers (\d+) (store|user)s?\. (.+)$/,
    ar: ([, n, what, rest]) => EXACT.ar[rest] && `تغطي خطتك ${n} ${what === 'store' ? 'فرع' : 'مستخدم'} فقط. ${EXACT.ar[rest]}`,
    fr: ([, n, what, rest]) => EXACT.fr[rest] && `Votre formule couvre ${n} ${what === 'store' ? 'établissement' : 'utilisateur'}${n === '1' ? '' : 's'}. ${EXACT.fr[rest]}`,
  },
  {
    re: /^You have (\d+) users \(including pending invites\)\. Disable users in Team & stores before lowering the plan to (\d+)\.$/,
    ar: ([, n, to]) => `لديك ${n} مستخدمين (بمن فيهم الدعوات المعلّقة). عطّل مستخدمين من الفريق والفروع قبل تخفيض الخطة إلى ${to}.`,
    fr: ([, n, to]) => `Vous avez ${n} utilisateurs (invitations en attente comprises). Désactivez des utilisateurs dans Équipe et établissements avant de réduire la formule à ${to}.`,
  },
  {
    re: /^You have (\d+) active stores\. Remove stores in Team & stores before lowering the plan to (\d+)\.$/,
    ar: ([, n, to]) => `لديك ${n} فروع نشطة. احذف فروعًا من الفريق والفروع قبل تخفيض الخطة إلى ${to}.`,
    fr: ([, n, to]) => `Vous avez ${n} établissements actifs. Supprimez des établissements dans Équipe et établissements avant de réduire la formule à ${to}.`,
  },
  {
    re: /^Answer every checkpoint, with a photo, before submitting \((\d+) left\)\.$/,
    ar: ([, n]) => `أجب عن كل نقاط الفحص مع صورة لكل منها قبل الإرسال (المتبقي: ${n}).`,
    fr: ([, n]) => `Répondez à chaque point de contrôle, avec une photo, avant d'envoyer (${n} restant${n === '1' ? '' : 's'}).`,
  },
  {
    re: /^Keep it under (\d+) characters\.$/,
    ar: ([, n]) => `اجعلها أقل من ${n} حرف.`,
    fr: ([, n]) => `Moins de ${n} caractères, s'il vous plaît.`,
  },
];

export function translateError(message, lang) {
  if (lang === DEFAULT_LANGUAGE || !EXACT[lang] || typeof message !== 'string') return message;
  if (EXACT[lang][message]) return EXACT[lang][message];
  for (const p of PATTERNS) {
    const m = message.match(p.re);
    if (m) return p[lang](m) || message;
  }
  return message;
}

// The web app sends its current language as Accept-Language ("ar"); a
// browser opening a shared link sends its own ("fr-FR,fr;q=0.9").
export function uiLanguageFromHeader(header) {
  const first = String(header || '').split(',')[0].split(';')[0].trim().toLowerCase().split('-')[0];
  return isSupportedLanguage(first) ? first : DEFAULT_LANGUAGE;
}

// Express middleware: error bodies ({ error }) go out in the caller's language.
export function translateErrorResponses(req, res, next) {
  const lang = uiLanguageFromHeader(req.headers['accept-language']);
  if (lang === DEFAULT_LANGUAGE) return next();
  const json = res.json.bind(res);
  res.json = (body) => json(
    body && typeof body.error === 'string' ? { ...body, error: translateError(body.error, lang) } : body
  );
  next();
}
