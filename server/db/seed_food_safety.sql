-- Food Safety and Sanitation Procedures, imported from the client's SOP
-- content (SOP 3: Food Receiving and Storage, SOP 4: Food Safety and
-- Temperature Monitoring, SOP 5: Handwashing and Personal Hygiene).
-- Continues the 'SOP' standard used by SOP 1/2 (opening/closing) — same
-- one-item-per-phase pattern, sub-steps captured in `description`.
--
-- SOP 5 has no numbered "Procedure: 1. 2. 3." phase list like SOP 3/4 —
-- it's organized by topic (when/how to wash hands, personal hygiene
-- standards, illness policy, glove use), so those four topics became
-- the four items instead of numbered phases.
--
-- is_critical is a judgment call, same basis as SOP 1/2: phases where
-- getting it wrong is a direct foodborne-illness or contamination risk.
-- SOP 4 in particular is almost entirely food-safety-critical by nature
-- (it's literally the temperature-control CCPs), so 6 of its 7 items are
-- critical; only equipment calibration (a weekly maintenance task, one
-- step removed from the actual food-safety check) is not.

INSERT INTO checklist_items (text, standard, category, description, requires_photo, is_critical, sort_order) VALUES

-- SOP 3: Food Receiving and Storage (7)
('Delivery acceptance verified', 'SOP', 'SOP 3: Receiving & Storage — 1. Delivery Acceptance',
 'Confirm the delivery is scheduled and from an approved vendor. Check the driver''s cleanliness and food-handling practices, and check the delivery vehicle for clean condition, proper refrigeration (if a cold truck), and no cross-contamination with non-food items.',
 false, false, 1),

('Product inspection completed', 'SOP', 'SOP 3: Receiving & Storage — 2. Product Inspection',
 'Check the invoice against delivery contents and verify quantities and product codes. Inspect temperature (cold foods 41F or below, frozen foods 0F or below solid frozen, hot foods 135F or above - reject if not met), packaging (intact, no dented/bulging/rusted cans, vacuum seals intact), and quality (produce free of mold or soft spots, meat/poultry proper color and odor within sell-by date, seafood ocean-fresh smell with clear eyes and firm flesh, dairy within expiration with proper consistency). If anything fails: reject immediately, note the rejection on the invoice, photograph evidence, and contact the vendor about credit or replacement.',
 true, true, 2),

('Immediate storage completed within 15 minutes', 'SOP', 'SOP 3: Receiving & Storage — 3. Immediate Storage',
 'Store refrigerated and frozen items within 15 minutes of delivery - perishables first, then shelf-stable items. Do not leave items at room temperature.',
 false, true, 3),

('Storage by type organized correctly', 'SOP', 'SOP 3: Receiving & Storage — 4. Storage by Type',
 'Refrigerated (37-40F): ready-to-eat/cooked foods on top, seafood and whole cuts of meat in the middle, raw ground meat and poultry on the bottom to prevent dripping; keep raw separate from ready-to-eat, in original packaging or covered containers. Frozen (0F or below): organized by product type, labeled with receive date, rotated FIFO, not overloaded so air can circulate. Dry storage (50-70F): shelves 6 inches off the floor and away from walls, rotated FIFO, chemicals stored separate from food, dry goods in sealed containers.',
 true, false, 4),

('Labeling and dating completed', 'SOP', 'SOP 3: Receiving & Storage — 5. Labeling & Dating',
 'Label every item with product name, receive date or use-by date, and open date if the container has been opened. Use waterproof labels or markers placed where clearly visible.',
 true, false, 5),

('FIFO rotation verified', 'SOP', 'SOP 3: Receiving & Storage — 6. FIFO Rotation',
 'Place new stock behind existing stock and use older items first. Check dates weekly and remove expired items immediately.',
 false, false, 6),

('Receiving log completed', 'SOP', 'SOP 3: Receiving & Storage — 7. Documentation',
 'Record date and time, vendor name, products received, temperatures checked, any rejections, and the staff member who received the delivery.',
 false, false, 7),

-- SOP 4: Food Safety and Temperature Monitoring (7)
('Thermometer calibration completed', 'SOP', 'SOP 4: Temperature Monitoring — 1. Equipment Calibration',
 'Calibrate all food thermometers weekly using the ice water method: fill a cup with ice and water, insert the thermometer stem, and confirm it reads 32F (adjust if not). Replace any thermometer that won''t calibrate.',
 false, false, 1),

('Cooking temperatures verified', 'SOP', 'SOP 4: Temperature Monitoring — 2. Temperature Checking During Cooking',
 'Check internal (not surface) temperature in the thickest part of the item, avoiding bone, fat, or pan, and wait for the reading to stabilize. Minimum temperatures: 165F for poultry, stuffed meats, casseroles, and reheated leftovers; 155F for ground/injected meats and eggs for hot holding; 145F for whole cuts of beef/pork/lamb/veal, fish, and eggs for immediate service; 135F for vegetables, fruits, grains, and legumes held hot. If not met, keep cooking and recheck. Clean and sanitize the thermometer between uses, and log the temperature.',
 false, true, 2),

('Two-stage cooling procedure followed', 'SOP', 'SOP 4: Temperature Monitoring — 3. Cooling Procedures',
 'Cool from 135F to 70F within 2 hours, then from 70F to 41F within another 4 hours - 6 hours total, maximum. Use shallow containers (2-3 inches deep), divide large batches, use an ice bath, stir frequently, and leave uncovered or loosely covered until cooled. Never put hot food directly in the cooler. Check temperature every 30-60 minutes and log times/temps. If cooling too slowly, adjust technique immediately; if the 6-hour window is exceeded, discard the food.',
 false, true, 3),

('Reheating for hot holding completed', 'SOP', 'SOP 4: Temperature Monitoring — 4. Reheating for Hot Holding',
 'Reheat leftovers to 165F within 2 hours, checking multiple spots including thick portions and the center, and stirring for even heat. Reheat only once - never cool and reheat the same batch more than once. After reheating, hold at 135F or above.',
 false, true, 4),

('Hot holding temperatures verified', 'SOP', 'SOP 4: Temperature Monitoring — 5. Hot Holding Monitoring',
 'Check steam tables and warmers every 2 hours and log the reading; food must stay at 135F or above. If below 135F: reheat to 165F if it is still above 70F and has been under 2 hours, otherwise discard. Stir periodically and keep pans covered.',
 false, true, 5),

('Cold holding temperatures verified', 'SOP', 'SOP 4: Temperature Monitoring — 6. Cold Holding Monitoring',
 'Check salad bars and prep coolers every 2 hours; food must stay at 41F or below. If above 41F: re-chill rapidly if it is still under 70F and has been under 4 hours, otherwise discard.',
 false, true, 6),

('Time as Public Health Control (TPHC) applied correctly', 'SOP', 'SOP 4: Temperature Monitoring — 7. Time as Public Health Control',
 'If using time instead of temperature control, mark the food with a discard time 4 hours from when it was removed from temperature control, and discard it after 4 hours even if it looks or smells fine. Once at room temperature under this method, it cannot go back into the cooler.',
 false, true, 7),

-- SOP 5: Handwashing and Personal Hygiene (4 topics, not numbered phases)
('Handwashing performed correctly and at required times', 'SOP', 'SOP 5: Handwashing & Hygiene — 1. Handwashing',
 'Wash hands before starting work; after the restroom; after touching hair, face, or body; after sneezing, coughing, eating, drinking, or smoking; after handling raw meat, poultry, seafood, dirty dishes, trash, or money; before putting on gloves; and after switching tasks (especially raw to ready-to-eat). Procedure: wet hands with warm running water (100F+), apply liquid soap, lather for at least 20 seconds covering palms, backs, between fingers, under nails, and forearms, rinse thoroughly, dry with a single-use paper towel, and use that towel to turn off the faucet.',
 false, true, 1),

('Personal hygiene standards followed', 'SOP', 'SOP 5: Handwashing & Hygiene — 2. Personal Hygiene Standards',
 'Only a plain ring is allowed - no watches, bracelets, or decorative rings. Fingernails short, clean, and unpolished, with no artificial nails. Hair restrained in a hat or hairnet; facial hair covered with a beard net if applicable. Clean uniform/apron daily, removed before using the restroom. Smoking only in designated areas with handwashing after; eating and drinking only in designated break areas.',
 false, false, 2),

('Illness policy followed', 'SOP', 'SOP 5: Handwashing & Hygiene — 3. Illness Policy',
 'Staff must report vomiting, diarrhea, jaundice, sore throat with fever, an infected wound or boil, or a diagnosis of norovirus, hepatitis A, shigella, E. coli, or salmonella, and cannot work with food while symptomatic. Staff must be symptom-free for 24-48 hours (per local health department) before returning, and a diagnosed illness may need medical clearance first.',
 false, true, 3),

('Glove use followed correctly', 'SOP', 'SOP 5: Handwashing & Hygiene — 4. Glove Use',
 'Gloves do not replace handwashing - wash hands before putting gloves on. Change gloves when torn or contaminated, between raw and ready-to-eat foods, after touching face, hair, or non-food surfaces or money, and at least every 4 hours during continuous use. Remove gloves before leaving the food prep area, and never wash and reuse a glove.',
 false, true, 4);
