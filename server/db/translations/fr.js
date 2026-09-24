// French translations of library content, keyed by the exact English
// source string from checklist_items (text, description or category).
// Same rules as ar.js: English stays the source of truth, anything not
// listed here renders in English, and rows marked 'reviewed' in the
// database are never overwritten by a re-run.
import { sopCategoryTranslations } from './sopCategories.js';
import { cStoreCategories, cStoreItems, cStoreDescriptions } from './cStore.js';
import { qcItems } from './qcItems.js';
import { sopItems } from './sopItems.js';
import { sopResearchedItems } from './sopResearchedItems.js';
import { starterDescriptions } from './starterDescriptions.js';

export default {
  ...sopCategoryTranslations().fr,
  ...cStoreCategories.fr,
  ...cStoreItems.fr,
  ...cStoreDescriptions.fr,
  ...qcItems.fr,
  ...sopItems.fr,
  ...sopResearchedItems.fr,
  ...starterDescriptions.fr,

  // --- QC audit system categories -----------------------------------
  // The A/B/C and W1/M1/Q1 letters are kept as-is: they're the client's
  // own section references in the QC Audit System document.
  'Daily QC — A. Exterior & First Impressions': 'QC quotidien — A. Extérieur et première impression',
  'Daily QC — B. Food Safety & Temperature Control': 'QC quotidien — B. Sécurité alimentaire et températures',
  'Daily QC — C. Kitchen Hygiene & Organization': 'QC quotidien — C. Hygiène et organisation de la cuisine',
  'Daily QC — D. Bar & Beverage Station': 'QC quotidien — D. Bar et poste boissons',
  'Daily QC — E. Dining Area & Guest Experience': 'QC quotidien — E. Salle et expérience client',
  'Daily QC — F. Staff Readiness & Service Quality': 'QC quotidien — F. Préparation du personnel et qualité de service',
  'Daily QC — G. Safety, Security & Compliance': 'QC quotidien — G. Sécurité, sûreté et conformité',
  'Daily QC — H. Consumer Behavior & Insights': 'QC quotidien — H. Comportement client et enseignements',
  'Daily QC — K. Food Quality, Taste & Consistency': 'QC quotidien — K. Qualité, goût et régularité',
  'Daily QC — L. Presentation, Plating & The Pass': 'QC quotidien — L. Présentation, dressage et passe',
  'Daily QC — M. Service Choreography & Hospitality': 'QC quotidien — M. Orchestration du service et hospitalité',
  'Daily QC — N. Ingredient Quality & Sourcing': 'QC quotidien — N. Qualité des ingrédients et approvisionnement',
  'Weekly Audit — W1. Food Cost & Financial Leakage': 'Audit hebdomadaire — W1. Coût matière et fuites financières',
  'Weekly Audit — W2. POS Integrity & Fraud Prevention': 'Audit hebdomadaire — W2. Intégrité de la caisse et prévention de la fraude',
  'Weekly Audit — W3. Delivery Platforms & Digital Presence': 'Audit hebdomadaire — W3. Plateformes de livraison et présence digitale',
  'Weekly Audit — W4. Deep Cleaning Verification': 'Audit hebdomadaire — W4. Vérification du nettoyage approfondi',
  'Weekly Audit — W5. Maintenance & Asset Care': 'Audit hebdomadaire — W5. Maintenance et entretien des actifs',
  'Weekly Audit — W6. People: Training & Scheduling': 'Audit hebdomadaire — W6. Personnel : formation et planning',
  'Monthly Audit — M1. Legal, Licenses & Documentation': 'Audit mensuel — M1. Juridique, licences et documentation',
  'Monthly Audit — M2. Menu Engineering & Profitability': 'Audit mensuel — M2. Ingénierie de la carte et rentabilité',
  'Monthly Audit — M3. Supplier Performance & Procurement': 'Audit mensuel — M3. Performance fournisseurs et achats',
  'Monthly Audit — M4. Guest Insight, Mystery Shop & Brand': 'Audit mensuel — M4. Retour client, visite mystère et marque',
  'Monthly Audit — M5. Crisis Readiness & Continuity': 'Audit mensuel — M5. Gestion de crise et continuité',
  'Monthly Audit — M6. People Development & Culture': 'Audit mensuel — M6. Développement des équipes et culture',
  'Quarterly Audit — Q1. Infrastructure & Certified Inspections': 'Audit trimestriel — Q1. Infrastructures et contrôles certifiés',
  'Quarterly Audit — Q2. Strategic Performance Review': 'Audit trimestriel — Q2. Revue de performance stratégique',

  // --- Starter library categories -----------------------------------
  closing: 'Fermeture',
  equipment: 'Équipement',
  hygiene: 'Hygiène',
  receiving: 'Réception',
  temperature: 'Température',
  waste: 'Déchets',

  // --- HACCP -------------------------------------------------------
  'Fridge temperature within 1-4°C': 'Température du réfrigérateur entre 1 et 4 °C',
  'Raw and ready-to-eat foods stored separately': 'Aliments crus et prêts à consommer stockés séparément',
  'Hand-wash stations stocked with soap and towels': 'Postes de lavage des mains approvisionnés en savon et essuie-mains',
  'Food labelled with prep and use-by date': 'Aliments étiquetés avec la date de préparation et la DLC',
  'Pest control traps checked, no signs of activity': 'Pièges antinuisibles contrôlés, aucun signe d’activité',
  'Waste bins covered and not overflowing': 'Poubelles couvertes et non débordantes',
  'Freezer temperature at or below -18°C': 'Température du congélateur à -18 °C ou moins',
  'Cooked food held above 63°C (hot holding)': 'Aliments cuits maintenus au-dessus de 63 °C (maintien au chaud)',
  'Incoming delivery temperature checked and logged': 'Température des livraisons contrôlée et consignée',
  'Cleaning chemicals stored away from food items': 'Produits d’entretien stockés à l’écart des denrées',

  // --- ISO 22000 ---------------------------------------------------
  'Staff food safety training records up to date': 'Registres de formation du personnel à la sécurité alimentaire à jour',
  'Critical control point records signed by supervisor': 'Relevés des points critiques signés par le responsable',
  'Traceability records updated for received stock': 'Registres de traçabilité mis à jour pour le stock reçu',
  'Allergen matrix displayed and current': 'Tableau des allergènes affiché et à jour',
  'Equipment calibration log up to date': 'Registre d’étalonnage des équipements à jour',
  'Food safety hazard log reviewed for the shift': 'Registre des dangers sanitaires revu pour le service',

  // --- Local code --------------------------------------------------
  'First aid kit stocked and accessible': 'Trousse de premiers secours complète et accessible',
  'Food handler permits displayed/valid': 'Autorisations des manipulateurs de denrées affichées et valides',
  'Fire extinguisher inspection tag current': 'Étiquette de contrôle de l’extincteur à jour',
  'Emergency exits unobstructed': 'Issues de secours dégagées',
};
