-- NFSA site visit: the Egyptian National Food Safety Authority's
-- inspection checkpoints, as a self-inspection to run before a visit.
--
-- PROVENANCE — READ BEFORE EDITING: not the client's own manual. Compiled
-- at the client's request from:
--   * the NFSA inspection mission form ("الهيئة القومية لسلامة الغذاء",
--     academy.amsol.ca copy, 2022): its sections (staff, site, design,
--     buildings, ventilation, lighting, toilets, pests, water, cleaning,
--     receiving and storage, production, transport, waste, documents,
--     HACCP) and requirements, condensed and reworded for restaurants
--     (the form is written for factories: production lines, packaging);
--   * the client's own notes on what NFSA inspectors check in restaurants
--     (receiving at 5 °C / -18 °C, FIFO, pallets 15 cm off the floor,
--     cooking above 75 °C, hot holding above 60 °C, safe thawing, health
--     certificates, the food safety file).
-- Treat it as a reviewable starting point, not the inspectors' own form.
--
-- The NFSA form scores each requirement as critical, important or
-- necessary: a visit allows no failed critical points and some failed
-- important or necessary ones. The form doesn't say which tier each line
-- is, so is_critical marks the direct food-safety risks (temperatures,
-- approved suppliers, expired food, raw/ready-to-eat separation, health
-- certificates, sick staff, hand washing, pests, chemicals near food).
--
-- Section letters (A–L) keep the sections in order and stay in every
-- language. Safe to run again: it inserts only when no NFSA checkpoints
-- exist yet, so the server also runs it at start-up (src/db/upgrade.js).

INSERT INTO checklist_items (text, standard, category, requires_photo, is_critical, sort_order)
SELECT v.text, 'NFSA', v.category, true, v.is_critical, v.sort_order
FROM (VALUES
-- A. Staff Hygiene & Training ------------------------------------------
('Staff wash their hands correctly (soap and water, rinse, single-use drying) before work, after breaks, after using the toilet and after touching waste or raw food', 'NFSA Site Visit — A. Staff Hygiene & Training', true, 1),
('Hand sanitiser is used only after washing hands, never instead of it, and gloves are changed before they become a source of contamination', 'NFSA Site Visit — A. Staff Hygiene & Training', false, 2),
('Staff and visitors in food areas wear clean protective clothing: hair cover, apron, and a mask and shoe covers where required', 'NFSA Site Visit — A. Staff Hygiene & Training', false, 3),
('No smoking, e-cigarettes, eating, drinking, chewing or spitting in food areas', 'NFSA Site Visit — A. Staff Hygiene & Training', false, 4),
('No jewellery, watches, nail varnish or strong cosmetics while handling food, and personal belongings are kept out of food areas', 'NFSA Site Visit — A. Staff Hygiene & Training', false, 5),
('Every kitchen and service worker holds a valid health certificate, kept on file', 'NFSA Site Visit — A. Staff Hygiene & Training', true, 6),
('Staff who are ill (diarrhoea, vomiting, fever, infected wounds, discharge from the eyes, ears or nose) are kept away from food until cleared to return', 'NFSA Site Visit — A. Staff Hygiene & Training', true, 7),
('All staff are trained in good hygiene and food safety for their job, with a yearly training plan and training records', 'NFSA Site Visit — A. Staff Hygiene & Training', false, 8),
-- B. Location & Layout ----------------------------------------------
('The premises are away from sources of contamination (waste, sewage, polluting activities) and animals are kept away', 'NFSA Site Visit — B. Location & Layout', false, 9),
('The layout keeps raw and cooked food apart and food preparation separate from toilets, stores and receiving, so work flows one way: receiving, preparation, cooking, service', 'NFSA Site Visit — B. Location & Layout', false, 10),
('Doors into food areas close properly and are protected by air or plastic strip curtains', 'NFSA Site Visit — B. Location & Layout', false, 11),
-- C. Building & Equipment ----------------------------------------------
('Floors, walls, ceilings, doors and windows are smooth, non-absorbent, free of cracks and easy to clean', 'NFSA Site Visit — C. Building & Equipment', false, 12),
('Floor-to-wall joints are coved where floors are washed, floors drain properly, and drains are covered with no sewage backflow', 'NFSA Site Visit — C. Building & Equipment', false, 13),
('Food-contact surfaces, equipment and utensils are made of suitable food-grade materials, in good repair and easy to clean', 'NFSA Site Visit — C. Building & Equipment', false, 14),
('No wood or glass in food handling areas, or, where unavoidable, written controls and checks for it', 'NFSA Site Visit — C. Building & Equipment', false, 15),
('Separate sinks for washing hands and for washing food, supplied with hot and cold water', 'NFSA Site Visit — C. Building & Equipment', false, 16),
-- D. Ventilation & Lighting -----------------------------------------
('Natural or mechanical ventilation controls heat, humidity, condensation and smells, and can be cleaned and maintained', 'NFSA Site Visit — D. Ventilation & Lighting', false, 17),
('Lighting is adequate in all food and storage areas, and light fittings are protected so broken glass cannot fall into food', 'NFSA Site Visit — D. Ventilation & Lighting', false, 18),
-- E. Toilets, Changing & Hand Washing ------------------------------
('Toilets do not open directly onto food areas and have foot-operated bins', 'NFSA Site Visit — E. Toilets, Changing & Hand Washing', false, 19),
('Hand-wash stations at the entrances to food areas have liquid soap, sanitiser, single-use drying and a hand-washing sign', 'NFSA Site Visit — E. Toilets, Changing & Hand Washing', true, 20),
('Staff have a changing room, and a set area to eat, drink and smoke away from food', 'NFSA Site Visit — E. Toilets, Changing & Hand Washing', false, 21),
-- F. Pest Control ----------------------------------------------------
('The building is sealed against pests: gaps around doors, ceilings and walls are closed, and doors, windows and vents are screened', 'NFSA Site Visit — F. Pest Control', false, 22),
('No insects or signs of insects anywhere on the premises', 'NFSA Site Visit — F. Pest Control', true, 23),
('No rodents or other pests, and no signs of them such as droppings or gnaw marks', 'NFSA Site Visit — F. Pest Control', true, 24),
('A contract with a licensed pest-control company, with visit records; pesticides are applied only by them, and flying-insect killers work and are placed away from food', 'NFSA Site Visit — F. Pest Control', false, 25),
-- G. Water, Cleaning & Sanitising ------------------------------------
('Drinking-quality water supply, with water tanks of food-grade material that are cleaned and disinfected regularly, with records', 'NFSA Site Visit — G. Water, Cleaning & Sanitising', false, 26),
('A written cleaning plan covers every area, piece of equipment and utensil and is followed, with records; clean utensils and cleaning tools are kept in their own set places', 'NFSA Site Visit — G. Water, Cleaning & Sanitising', false, 27),
('Cleaning and sanitising chemicals are approved for food premises, diluted as the manufacturer instructs, and their use is recorded', 'NFSA Site Visit — G. Water, Cleaning & Sanitising', false, 28),
('Chemicals are stored apart from food in labelled containers and are never put into food containers', 'NFSA Site Visit — G. Water, Cleaning & Sanitising', true, 29),
-- H. Suppliers & Receiving --------------------------------------------
('All meat, poultry, fish and other raw materials come from approved suppliers or establishments on the NFSA white list, and a supplier list is kept', 'NFSA Site Visit — H. Suppliers & Receiving', true, 30),
('Deliveries are checked on arrival against set limits: chilled food at 5 °C or below, frozen food at -18 °C or below', 'NFSA Site Visit — H. Suppliers & Receiving', true, 31),
('Receiving records show supplier, date, quantity and batch, rejected deliveries are recorded with the reason, and purchase invoices are kept so every product can be traced', 'NFSA Site Visit — H. Suppliers & Receiving', false, 32),
('Every product carries a label with the brand, production date and expiry date', 'NFSA Site Visit — H. Suppliers & Receiving', false, 33),
-- I. Storage -----------------------------------------------------------
('Fridges hold 5 °C or below and freezers -18 °C or below, checked with thermometers', 'NFSA Site Visit — I. Storage', true, 34),
('Raw meat, poultry and fish are stored below and apart from ready-to-eat food', 'NFSA Site Visit — I. Storage', true, 35),
('Stock is used first in, first out (FIFO)', 'NFSA Site Visit — I. Storage', false, 36),
('No expired or spoiled raw materials or products in storage', 'NFSA Site Visit — I. Storage', true, 37),
('In the dry store, cartons and sacks are on pallets at least 15 cm off the floor and away from the walls', 'NFSA Site Visit — I. Storage', false, 38),
('Each product is stored at a suitable temperature and humidity, with raw materials, finished food, packaging and chemicals in separate areas', 'NFSA Site Visit — I. Storage', false, 39),
('Food prepared on site is covered and labelled with its name, preparation date and use-by date', 'NFSA Site Visit — I. Storage', false, 40),
-- J. Cooking & Preparation ----------------------------------------
('Meat and poultry are cooked to a core temperature above 75 °C, checked with a probe thermometer', 'NFSA Site Visit — J. Cooking & Preparation', true, 41),
('Hot food on display is kept above 60 °C', 'NFSA Site Visit — J. Cooking & Preparation', true, 42),
('Frozen food is thawed in the fridge or under cold running water, never at room temperature', 'NFSA Site Visit — J. Cooking & Preparation', true, 43),
('Separate boards and utensils are used for raw and ready-to-eat food', 'NFSA Site Visit — J. Cooking & Preparation', false, 44),
('Allergens are controlled so that no allergen gets into food without being declared on the label or menu', 'NFSA Site Visit — J. Cooking & Preparation', false, 45),
-- K. Transport & Waste ---------------------------------------------
('Vehicles and boxes carrying food are clean and keep the right temperature, recorded while loading and in transit', 'NFSA Site Visit — K. Transport & Waste', false, 46),
('Waste is kept in covered bins fully separate from food and removed by a licensed contractor or the local authority', 'NFSA Site Visit — K. Transport & Waste', false, 47),
-- L. HACCP & Records -----------------------------------------------
('The food safety file is ready for the inspector: prerequisite programmes (PRPs), cleaning and sanitising plans, and the HACCP plan', 'NFSA Site Visit — L. HACCP & Records', false, 48),
('HACCP is applied: hazards are analysed, critical control points are monitored, and corrective actions are recorded when a limit is missed', 'NFSA Site Visit — L. HACCP & Records', false, 49),
('Fridge and freezer temperatures are recorded every day', 'NFSA Site Visit — L. HACCP & Records', false, 50),
('Records are kept for the required period, equipment is maintained, and thermometers and other measuring devices are calibrated on a plan', 'NFSA Site Visit — L. HACCP & Records', false, 51),
('A traceability and recall procedure can find and withdraw any unsafe product', 'NFSA Site Visit — L. HACCP & Records', false, 52),
('A complaints procedure is in place, including how to report suspected food poisoning', 'NFSA Site Visit — L. HACCP & Records', false, 53)
) AS v(text, category, is_critical, sort_order)
WHERE NOT EXISTS (SELECT 1 FROM checklist_items WHERE tenant_id IS NULL AND standard = 'NFSA');
