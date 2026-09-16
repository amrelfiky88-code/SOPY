-- Restaurant Opening & Closing Procedures, imported from the client's
-- SOP content (SOP 1: Opening Procedures, SOP 2: Closing Procedures).
-- Seeded as global library items (tenant_id NULL, standard = 'SOP') so
-- any tenant can search, filter, and assign them via the Checklist
-- Builder into a "Restaurant Opening Checklist" / "Restaurant Closing
-- Checklist" — one item per numbered phase in the source document, with
-- that phase's sub-steps captured in `description` as on-the-job
-- guidance (shown in both the Checklist Builder and while running the
-- checklist — see ChecklistBuilder.jsx / ChecklistRun.jsx).
--
-- Category is prefixed "SOP 1: Opening" / "SOP 2: Closing" (matching the
-- source document's own numbering) rather than "Opening Procedure" /
-- "Closing Procedure" — besides matching the source, it also sorts
-- correctly: "Opening"/"Closing" alone would sort Closing before Opening
-- alphabetically within the same standard.
--
-- is_critical is a judgment call (the source document has no warning
-- marks like the QC docs) applied to the phases where getting it wrong
-- is a safety, security, food-safety, or financial-fraud risk: the
-- opening security walk, opening food-safety/temperature checks,
-- closing cash handling, closing food storage check, and the closing
-- security walkthrough.

INSERT INTO checklist_items (text, standard, category, description, requires_photo, is_critical, sort_order) VALUES

('Arrival and security check completed', 'SOP', 'SOP 1: Opening — 1. Arrival & Security Check',
 'Unlock doors and disarm the alarm (note the time in the log). Walk the entire restaurant checking for signs of break-in or damage, water leaks or equipment issues, pest activity (droppings, damage), and unusual odors. If anything is found: document it, photograph it, and notify the manager immediately.',
 true, true, 1),

('Kitchen equipment startup completed', 'SOP', 'SOP 1: Opening — 2. Kitchen Equipment Startup',
 'Turn on cooking equipment in sequence: ovens/ranges (30-45 min preheat), grills/griddles (20-30 min), fryers (fill to proper oil level, 15-20 min), steam tables and warmers, coffee makers and brewers. Confirm each reaches proper temperature, has no unusual sounds or smells, and that safety features (pilot lights, thermostats) work. Log any equipment issues in the maintenance log.',
 false, false, 2),

('Food safety checks completed', 'SOP', 'SOP 1: Opening — 3. Food Safety Checks',
 'Check and record refrigerator/freezer temperatures: walk-in cooler 37-40F, walk-in freezer 0F or below, reach-in coolers 37-40F. If anything is out of range, notify the manager and do not use it until corrected. Check food dating and rotation: remove expired items, verify FIFO, and check for signs of spoilage.',
 false, true, 3),

('Station prep and mise en place completed', 'SOP', 'SOP 1: Opening — 4. Station Prep & Mise en Place',
 'Set up each cooking station: stock ingredients, prepare mise en place per prep lists, arrange tools within reach. Slice, dice, and portion as needed; prepare sauces and dressings; pre-cook items requiring advance prep. Label and date everything prepared.',
 false, false, 4),

('Dining room setup completed', 'SOP', 'SOP 1: Opening — 5. Dining Room Setup',
 'Unlock and clean entrance doors, turn on dining room lights, set a comfortable thermostat. Check and stock restrooms (toilet paper, towels, soap; clean mirrors/fixtures; empty trash; confirm accessibility). Clean and set tables, fold napkins, check table stability. Stock server stations (silverware, napkins, condiments, beverages) and confirm the POS system is operational and menus are clean and complete.',
 true, false, 5),

('Pre-service meeting held', 'SOP', 'SOP 1: Opening — 6. Pre-Service Meeting',
 'Brief the team on daily specials, 86''d items, reservations and expected volume, special requests or VIP guests, and any equipment issues or limitations. Assign sections and responsibilities, answer questions, and set expectations for the shift.',
 false, false, 6),

('Final opening checklist verified', 'SOP', 'SOP 1: Opening — 7. Final Checklist',
 'Confirm: kitchen ready (all stations stocked and operational); dining room ready (clean, set, welcoming); staff ready (uniformed, informed, sections assigned); systems ready (POS, phones, music); safety ready (first aid kit accessible, exits clear).',
 false, false, 7),

('Open for service', 'SOP', 'SOP 1: Opening — 8. Open for Service',
 'Unlock the front doors, turn on the "Open" sign, and have the host greet the first guests.',
 false, false, 8),

('Kitchen breakdown and cleaning completed', 'SOP', 'SOP 2: Closing — 1. Kitchen Breakdown & Cleaning',
 'Stop accepting new orders and complete pending ones. Break down stations: clean and cover food, store by temperature, label with date/time, rotate for FIFO. Clean cooking equipment (grills scraped and degreased, fryer oil filtered or changed, ovens wiped, range burners and drip pans cleaned). Wash and sanitize work surfaces and air dry. Sweep and mop kitchen floors including corners and drains, and clean the mop bucket.',
 false, false, 1),

('Dining room closing completed', 'SOP', 'SOP 2: Closing — 2. Dining Room Closing',
 'Lock the front doors and turn off the "Open" sign. Clear and clean all tables, reset for next day if needed. Vacuum or sweep the dining room, spot-mop spills, clean and restock restrooms, and take out all trash and recycling with fresh liners.',
 false, false, 2),

('Equipment shutdown completed', 'SOP', 'SOP 2: Closing — 3. Equipment Shutdown',
 'Turn off cooking equipment in reverse order, ensure fryers are covered, and turn off coffee makers after emptying and cleaning them. Run the dishwasher through a final cycle, then clean and drain it. Turn off ice machines if scheduled, and adjust HVAC to overnight settings.',
 false, false, 3),

('Cash handling and POS closing completed', 'SOP', 'SOP 2: Closing — 4. Cash Handling & POS Closing',
 'Count each cash drawer by denomination, total and verify against the POS, and investigate any discrepancy. Prepare the bank deposit: leave starting cash in the drawer, deposit the remainder per policy, complete the deposit slip, and secure it. Close the POS: run end-of-day reports, print the sales summary, verify the credit card batch, and back up data.',
 false, true, 4),

('Food storage final check completed', 'SOP', 'SOP 2: Closing — 5. Food Storage Final Check',
 'Walk through all coolers and storage. Verify all food is properly covered and stored, labeled and dated, and that proper temperature zones are maintained. Lock walk-ins if applicable.',
 false, true, 5),

('Next-day prep completed', 'SOP', 'SOP 2: Closing — 6. Prep for Next Day',
 'Check tomorrow''s prep list. Pull frozen items to thaw overnight if safe to do so, prep any time-intensive items, note inventory needs on the order sheet, and set timers for morning equipment startup.',
 false, false, 6),

('Security and final walkthrough completed', 'SOP', 'SOP 2: Closing — 7. Security & Final Walkthrough',
 'Turn off unnecessary lights (leave security lights on) and check all doors and windows are locked. Verify oven/range burners are off and no water is running. Confirm the back door is secure, set the alarm system, exit through the designated door, and lock and verify the final door. Note the closing time in the log.',
 false, true, 7);
