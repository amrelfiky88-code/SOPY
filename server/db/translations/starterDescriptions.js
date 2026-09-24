// Arabic and French for the starter library's checkpoint descriptions
// (HACCP, ISO 22000 and local-code items in server/db/seed_library.sql).
// Their titles and categories are translated inline in ar.js / fr.js.
import { byLanguage } from './rows.js';

export const starterDescriptions = byLanguage([
  // HACCP
  [`Inspect trap stations`, `افحص محطات المصائد`, `Inspecter les postes de piégeage`],
  [`Spot-check labelling in walk-in and prep fridges`, `افحص عشوائيًا الملصقات في غرف التبريد وثلاجات التحضير`, `Contrôler par sondage l'étiquetage en chambre froide et dans les frigos de préparation`],
  [`Visual check of storage segregation`, `فحص بصري لفصل الأطعمة في التخزين`, `Contrôle visuel de la séparation au stockage`],
  [`Check chemical storage area`, `افحص منطقة تخزين المواد الكيميائية`, `Contrôler la zone de stockage des produits chimiques`],
  [`Check all hand-wash stations`, `افحص جميع أحواض غسل اليدين`, `Contrôler tous les postes de lavage des mains`],
  [`Verify chilled/frozen goods arrive within safe range`, `تحقق أن البضائع المبردة/المجمدة تصل ضمن النطاق الآمن`, `Vérifier que les produits frais/surgelés arrivent dans la plage de sécurité`],
  [`Check hot holding equipment temperature`, `افحص حرارة معدات الحفظ الساخن`, `Contrôler la température des équipements de maintien au chaud`],
  [`Record temperature of each freezer unit`, `سجّل حرارة كل وحدة تجميد`, `Relever la température de chaque congélateur`],
  [`Record temperature of each refrigeration unit`, `سجّل حرارة كل وحدة تبريد`, `Relever la température de chaque unité de réfrigération`],
  [`Check kitchen and external waste areas`, `افحص مناطق النفايات في المطبخ وخارجه`, `Contrôler les zones de déchets en cuisine et à l'extérieur`],

  // ISO 22000
  [`Verify CCP log has supervisor sign-off`, `تحقق أن سجل نقاط التحكم الحرجة (CCP) موقّع من المشرف`, `Vérifier que le registre des CCP est signé par le superviseur`],
  [`Check thermometer/probe calibration dates`, `افحص تواريخ معايرة موازين الحرارة/المجسات`, `Vérifier les dates d'étalonnage des thermomètres/sondes`],
  [`Confirm no unresolved hazards from previous shift`, `تأكد من عدم وجود مخاطر غير محلولة من الوردية السابقة`, `Confirmer qu'aucun danger du service précédent n'est resté sans suite`],
  [`Confirm allergen chart matches current menu`, `تأكد أن جدول مسببات الحساسية يطابق القائمة الحالية`, `Confirmer que le tableau des allergènes correspond à la carte actuelle`],
  [`Check training log for the team on shift`, `افحص سجل التدريب لفريق الوردية`, `Vérifier le registre de formation de l'équipe en service`],
  [`Batch/lot numbers logged for new deliveries`, `تسجيل أرقام الدفعات/التشغيلات للتوريدات الجديدة`, `Numéros de lot notés pour les nouvelles livraisons`],

  // Local code
  [`Visual check of all marked exits`, `فحص بصري لجميع المخارج المحددة`, `Contrôle visuel de toutes les issues signalées`],
  [`Check tag date on all extinguishers`, `افحص تاريخ البطاقة على جميع الطفايات`, `Vérifier la date sur l'étiquette de chaque extincteur`],
  [`Check contents against required list`, `طابق المحتويات مع القائمة المطلوبة`, `Vérifier le contenu par rapport à la liste obligatoire`],
  [`Confirm current staff permits on file`, `تأكد من وجود تصاريح الموظفين السارية في الملف`, `Confirmer que les autorisations du personnel en cours sont au dossier`],
]);
