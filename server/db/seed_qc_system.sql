-- Real-world QC content imported from the client's own documents:
-- Daily_QC_Checklist.docx (QC-D-001) and QC_Audit_System.docx (QC-S-001,
-- weekly/monthly/quarterly). Seeded as global library items
-- (tenant_id NULL, standard = 'INTERNAL_QC') so any tenant can search,
-- filter, and assign them via the Checklist Builder — this is the
-- "master checkpoint library" the source documents actually describe.
--
-- is_critical mirrors the ⚠ marks on individual items in the source
-- docs exactly (not just section-level "⚠ CRITICAL" headings) — a
-- failing response on one of these auto-flags the submission as an
-- incident. Category encodes which audit layer + section an item is
-- from, e.g. 'Daily QC — B. Food Safety & Temperature Control'.
--
-- Each item's sort_order is its position in the source document, and the
-- app orders by (standard, category, sort_order) so a section's items
-- display in that original sequence, not alphabetically.

-- ============================================================
-- DAILY QC CHECKLIST (QC-D-001) — 104 points across 12 sections
-- ============================================================

INSERT INTO checklist_items (text, standard, category, requires_photo, is_critical, sort_order) VALUES
-- A. Exterior & First Impressions (8)
('Signage clean, illuminated, no dead bulbs or damage', 'INTERNAL_QC', 'Daily QC — A. Exterior & First Impressions', true, false, 1),
('Entrance glass, doors & handles spotless — no fingerprints or smudges', 'INTERNAL_QC', 'Daily QC — A. Exterior & First Impressions', true, false, 2),
('Walkway / parking area free of litter, cigarette butts & standing water', 'INTERNAL_QC', 'Daily QC — A. Exterior & First Impressions', true, false, 3),
('Exterior menus / promotional displays current, clean & correctly priced', 'INTERNAL_QC', 'Daily QC — A. Exterior & First Impressions', true, false, 4),
('Waste bins outside not overflowing; lids closed; no odor at entrance', 'INTERNAL_QC', 'Daily QC — A. Exterior & First Impressions', true, false, 5),
('No pest activity visible around entrance, waste area or delivery door', 'INTERNAL_QC', 'Daily QC — A. Exterior & First Impressions', false, false, 6),
('Outdoor seating (if any) clean, aligned, stable & weather-appropriate', 'INTERNAL_QC', 'Daily QC — A. Exterior & First Impressions', true, false, 7),
('Accessibility: ramp/entrance unobstructed for wheelchairs & strollers', 'INTERNAL_QC', 'Daily QC — A. Exterior & First Impressions', false, false, 8),

-- B. Food Safety & Temperature Control — CRITICAL (12)
('Refrigerators at 1–5°C; readings logged with time & initials', 'INTERNAL_QC', 'Daily QC — B. Food Safety & Temperature Control', false, true, 9),
('Freezers at or below -18°C; no ice build-up blocking airflow', 'INTERNAL_QC', 'Daily QC — B. Food Safety & Temperature Control', false, true, 10),
('Hot holding at or above 63°C; no food in danger zone (5–63°C) over 2 hrs', 'INTERNAL_QC', 'Daily QC — B. Food Safety & Temperature Control', false, true, 11),
('Cooked food core temps verified with calibrated probe (min 75°C)', 'INTERNAL_QC', 'Daily QC — B. Food Safety & Temperature Control', false, true, 12),
('All food items labeled: prep date, use-by date, staff initials', 'INTERNAL_QC', 'Daily QC — B. Food Safety & Temperature Control', true, true, 13),
('FIFO rotation verified in all storage — no expired items on premises', 'INTERNAL_QC', 'Daily QC — B. Food Safety & Temperature Control', false, true, 14),
('Raw and ready-to-eat foods fully segregated (storage & prep)', 'INTERNAL_QC', 'Daily QC — B. Food Safety & Temperature Control', true, true, 15),
('Thermometers calibrated (ice-point test done this week, documented)', 'INTERNAL_QC', 'Daily QC — B. Food Safety & Temperature Control', false, false, 16),
('Defrosting done in fridge or under running water — never at room temp', 'INTERNAL_QC', 'Daily QC — B. Food Safety & Temperature Control', false, false, 17),
('Allergen matrix up to date; staff can answer allergen queries correctly', 'INTERNAL_QC', 'Daily QC — B. Food Safety & Temperature Control', true, false, 18),
('Sanitizer buckets at correct concentration; test strips used & logged', 'INTERNAL_QC', 'Daily QC — B. Food Safety & Temperature Control', false, false, 19),
('Cooling logs show 63°C→8°C within 90 minutes for all cooled batches', 'INTERNAL_QC', 'Daily QC — B. Food Safety & Temperature Control', false, false, 20),

-- C. Kitchen Hygiene & Organization (12)
('Floors clean, dry, no grease build-up; drains clear & odor-free', 'INTERNAL_QC', 'Daily QC — C. Kitchen Hygiene & Organization', true, false, 21),
('Work surfaces sanitized; color-coded boards in correct use', 'INTERNAL_QC', 'Daily QC — C. Kitchen Hygiene & Organization', true, false, 22),
('Hand-wash stations stocked: soap, paper towels, warm water working', 'INTERNAL_QC', 'Daily QC — C. Kitchen Hygiene & Organization', true, false, 23),
('Staff observed washing hands at correct moments (watch for 10 min)', 'INTERNAL_QC', 'Daily QC — C. Kitchen Hygiene & Organization', false, false, 24),
('All staff in clean uniform, hair covered, no jewelry, nails compliant', 'INTERNAL_QC', 'Daily QC — C. Kitchen Hygiene & Organization', false, false, 25),
('No personal items (phones, drinks, bags) in food prep areas', 'INTERNAL_QC', 'Daily QC — C. Kitchen Hygiene & Organization', false, false, 26),
('Cleaning schedule signed off for previous day — spot-verify 2 tasks', 'INTERNAL_QC', 'Daily QC — C. Kitchen Hygiene & Organization', false, false, 27),
('Extraction hood & filters free of visible grease drip risk', 'INTERNAL_QC', 'Daily QC — C. Kitchen Hygiene & Organization', true, false, 28),
('Waste segregated, bins with lids & liners, waste area clean', 'INTERNAL_QC', 'Daily QC — C. Kitchen Hygiene & Organization', true, false, 29),
('Pest control devices in place, log book current, no droppings/signs', 'INTERNAL_QC', 'Daily QC — C. Kitchen Hygiene & Organization', false, false, 30),
('Chemicals stored away from food, labeled, MSDS sheets accessible', 'INTERNAL_QC', 'Daily QC — C. Kitchen Hygiene & Organization', false, false, 31),
('Ice machine interior clean; scoop stored outside on hook', 'INTERNAL_QC', 'Daily QC — C. Kitchen Hygiene & Organization', true, false, 32),

-- D. Bar & Beverage Station (7)
('Beverage fridges at temp; product faced, stocked & in date', 'INTERNAL_QC', 'Daily QC — D. Bar & Beverage Station', true, false, 33),
('Coffee machine clean, back-flushed; grinder free of stale grounds', 'INTERNAL_QC', 'Daily QC — D. Bar & Beverage Station', false, false, 34),
('Fountain nozzles & drip trays clean; syrup lines checked', 'INTERNAL_QC', 'Daily QC — D. Bar & Beverage Station', true, false, 35),
('Juicers/blenders sanitized; no fruit residue from previous day', 'INTERNAL_QC', 'Daily QC — D. Bar & Beverage Station', false, false, 36),
('Garnishes fresh today — taste-test one juice & one coffee yourself', 'INTERNAL_QC', 'Daily QC — D. Bar & Beverage Station', false, false, 37),
('Glassware/cups spotless — hold 3 random glasses up to the light', 'INTERNAL_QC', 'Daily QC — D. Bar & Beverage Station', true, false, 38),
('Bar counter, rails & menus wiped; no sticky surfaces', 'INTERNAL_QC', 'Daily QC — D. Bar & Beverage Station', true, false, 39),

-- E. Dining Area & Guest Experience (12)
('Tables & chairs clean, stable, aligned; no wobbles or crumbs', 'INTERNAL_QC', 'Daily QC — E. Dining Area & Guest Experience', true, false, 40),
('Floors swept & mopped; no sticky patches under tables', 'INTERNAL_QC', 'Daily QC — E. Dining Area & Guest Experience', false, false, 41),
('Lighting: all bulbs working, brightness appropriate for daypart', 'INTERNAL_QC', 'Daily QC — E. Dining Area & Guest Experience', false, false, 42),
('Music: volume right for occupancy level; playlist on-brand', 'INTERNAL_QC', 'Daily QC — E. Dining Area & Guest Experience', false, false, 43),
('Temperature & air: comfortable, no kitchen smoke/odor in dining area', 'INTERNAL_QC', 'Daily QC — E. Dining Area & Guest Experience', false, false, 44),
('Restrooms: clean, stocked, dry floors, no odor — check hourly log', 'INTERNAL_QC', 'Daily QC — E. Dining Area & Guest Experience', true, false, 45),
('Condiment stations/table sets stocked, clean, nothing crusted', 'INTERNAL_QC', 'Daily QC — E. Dining Area & Guest Experience', true, false, 46),
('Menus clean & unfrayed; specials/promos correctly displayed', 'INTERNAL_QC', 'Daily QC — E. Dining Area & Guest Experience', false, false, 47),
('High chairs clean & safe; kids'' amenities available', 'INTERNAL_QC', 'Daily QC — E. Dining Area & Guest Experience', false, false, 48),
('POS/ordering kiosks or QR codes working; screens clean', 'INTERNAL_QC', 'Daily QC — E. Dining Area & Guest Experience', false, false, 49),
('Wi-Fi working (test it); password displayed if offered', 'INTERNAL_QC', 'Daily QC — E. Dining Area & Guest Experience', false, false, 50),
('Emergency exits unobstructed; exit signage illuminated', 'INTERNAL_QC', 'Daily QC — E. Dining Area & Guest Experience', true, true, 51),

-- F. Staff Readiness & Service Quality (9)
('Pre-shift briefing done: specials, 86''d items, targets, VIPs', 'INTERNAL_QC', 'Daily QC — F. Staff Readiness & Service Quality', false, false, 52),
('Staffing level matches forecast covers; gaps covered before peak', 'INTERNAL_QC', 'Daily QC — F. Staff Readiness & Service Quality', false, false, 53),
('Greeting standard observed: guests acknowledged within 30 seconds', 'INTERNAL_QC', 'Daily QC — F. Staff Readiness & Service Quality', false, false, 54),
('Order accuracy: watch 3 orders end-to-end; note any remakes', 'INTERNAL_QC', 'Daily QC — F. Staff Readiness & Service Quality', false, false, 55),
('Speed of service within target (record actual times for 3 orders)', 'INTERNAL_QC', 'Daily QC — F. Staff Readiness & Service Quality', false, false, 56),
('Upsell/suggestion behavior natural, not scripted or pushy', 'INTERNAL_QC', 'Daily QC — F. Staff Readiness & Service Quality', false, false, 57),
('Complaint handling: staff know the recovery steps without checking', 'INTERNAL_QC', 'Daily QC — F. Staff Readiness & Service Quality', false, false, 58),
('New staff shadowing/training plan active & documented', 'INTERNAL_QC', 'Daily QC — F. Staff Readiness & Service Quality', false, false, 59),
('Team morale check: any conflicts, fatigue, grievances to address', 'INTERNAL_QC', 'Daily QC — F. Staff Readiness & Service Quality', false, false, 60),

-- G. Safety, Security & Compliance (10)
('Fire extinguishers in place, pins intact, inspection tags current', 'INTERNAL_QC', 'Daily QC — G. Safety, Security & Compliance', true, true, 61),
('First aid kit stocked & accessible; trained first aider on shift', 'INTERNAL_QC', 'Daily QC — G. Safety, Security & Compliance', true, true, 62),
('Wet floor signs used correctly; no trailing cables or trip hazards', 'INTERNAL_QC', 'Daily QC — G. Safety, Security & Compliance', false, false, 63),
('Gas connections checked; no smell; shut-off valve accessible', 'INTERNAL_QC', 'Daily QC — G. Safety, Security & Compliance', false, false, 64),
('Electrical panels unobstructed; no overloaded sockets', 'INTERNAL_QC', 'Daily QC — G. Safety, Security & Compliance', true, false, 65),
('CCTV operational; recording verified; storage days compliant', 'INTERNAL_QC', 'Daily QC — G. Safety, Security & Compliance', false, false, 66),
('Cash handling: safe locked, float verified, no cash left in open', 'INTERNAL_QC', 'Daily QC — G. Safety, Security & Compliance', false, false, 67),
('Back door secured; delivery access controlled & logged', 'INTERNAL_QC', 'Daily QC — G. Safety, Security & Compliance', false, false, 68),
('Licenses & certificates displayed and current (health, fire, business)', 'INTERNAL_QC', 'Daily QC — G. Safety, Security & Compliance', true, false, 69),
('Incident report book accessible; yesterday''s incidents reviewed', 'INTERNAL_QC', 'Daily QC — G. Safety, Security & Compliance', false, false, 70),

-- H. Consumer Behavior & Insights — observation points, not pass/fail (12)
('Peak hours today vs. usual pattern — early/late shift in traffic?', 'INTERNAL_QC', 'Daily QC — H. Consumer Behavior & Insights', false, false, 71),
('Table turnover time (dine-in) — faster or slower than target?', 'INTERNAL_QC', 'Daily QC — H. Consumer Behavior & Insights', false, false, 72),
('Most ordered item today / most returned or left-unfinished item', 'INTERNAL_QC', 'Daily QC — H. Consumer Behavior & Insights', false, false, 73),
('Average party size & type (families / workers / students / couples)', 'INTERNAL_QC', 'Daily QC — H. Consumer Behavior & Insights', false, false, 74),
('Dwell behavior: eat & go, linger, laptop campers, waiting groups?', 'INTERNAL_QC', 'Daily QC — H. Consumer Behavior & Insights', false, false, 75),
('Delivery vs dine-in vs takeaway split — any shift from the norm?', 'INTERNAL_QC', 'Daily QC — H. Consumer Behavior & Insights', false, false, 76),
('Queue behavior: walk-aways observed? At what queue length?', 'INTERNAL_QC', 'Daily QC — H. Consumer Behavior & Insights', false, false, 77),
('Guest comments overheard (food, price, service, cleanliness)', 'INTERNAL_QC', 'Daily QC — H. Consumer Behavior & Insights', false, false, 78),
('Online reviews since yesterday (check platforms) — themes?', 'INTERNAL_QC', 'Daily QC — H. Consumer Behavior & Insights', false, false, 79),
('Promo/special performance: are guests noticing & ordering it?', 'INTERNAL_QC', 'Daily QC — H. Consumer Behavior & Insights', false, false, 80),
('Competitor activity noticed (openings, offers, pricing moves)', 'INTERNAL_QC', 'Daily QC — H. Consumer Behavior & Insights', false, false, 81),
('One improvement idea from staff (ask a team member daily)', 'INTERNAL_QC', 'Daily QC — H. Consumer Behavior & Insights', false, false, 82),

-- K. Food Quality, Taste & Consistency (10)
('Daily line tasting done: every sauce, marinade & base tasted before service', 'INTERNAL_QC', 'Daily QC — K. Food Quality, Taste & Consistency', false, false, 83),
('Seasoning check: salt, acid & heat balanced — not corrected at the pass', 'INTERNAL_QC', 'Daily QC — K. Food Quality, Taste & Consistency', false, false, 84),
('Texture verified: fries crisp not greasy; buns soft not stale; proteins juicy', 'INTERNAL_QC', 'Daily QC — K. Food Quality, Taste & Consistency', false, false, 85),
('Doneness consistency: same item ordered twice — identical cook on both?', 'INTERNAL_QC', 'Daily QC — K. Food Quality, Taste & Consistency', false, false, 86),
('Signature item benchmark: does today''s version match the reference standard?', 'INTERNAL_QC', 'Daily QC — K. Food Quality, Taste & Consistency', true, false, 87),
('Oil quality: fried items clean-tasting — no rancid or ''old oil'' flavor', 'INTERNAL_QC', 'Daily QC — K. Food Quality, Taste & Consistency', false, false, 88),
('Bread & bakery: served fresh today; day-old product not in guest service', 'INTERNAL_QC', 'Daily QC — K. Food Quality, Taste & Consistency', false, false, 89),
('Menu integrity: dish served matches menu description & photo exactly', 'INTERNAL_QC', 'Daily QC — K. Food Quality, Taste & Consistency', true, true, 90),
('Portion consistency: 2 random items weighed against spec — within 5%', 'INTERNAL_QC', 'Daily QC — K. Food Quality, Taste & Consistency', false, false, 91),
('Leftover taste memory: would you crave this dish again tomorrow?', 'INTERNAL_QC', 'Daily QC — K. Food Quality, Taste & Consistency', false, false, 92),

-- L. Presentation, Plating & The Pass (8)
('Plating matches spec photos posted at each station — no drift', 'INTERNAL_QC', 'Daily QC — L. Presentation, Plating & The Pass', true, false, 93),
('Plate/packaging rims & edges wiped clean before leaving the pass', 'INTERNAL_QC', 'Daily QC — L. Presentation, Plating & The Pass', true, false, 94),
('No chipped, cracked or mismatched plates, cups or trays in service', 'INTERNAL_QC', 'Daily QC — L. Presentation, Plating & The Pass', true, true, 95),
('Hot food on hot plates / cold food on cold plates — touch-test 3 plates', 'INTERNAL_QC', 'Daily QC — L. Presentation, Plating & The Pass', false, false, 96),
('Expediter actively checking every order against ticket before handoff', 'INTERNAL_QC', 'Daily QC — L. Presentation, Plating & The Pass', false, false, 97),
('Garnishes fresh, intentional & edible — nothing wilted or decorative-only', 'INTERNAL_QC', 'Daily QC — L. Presentation, Plating & The Pass', true, false, 98),
('Takeaway/delivery packaging: sealed, clean, upright, sauces separate', 'INTERNAL_QC', 'Daily QC — L. Presentation, Plating & The Pass', true, false, 99),
('Time from ''ready'' to ''served/dispatched'' under 2 minutes — food never dies at the pass', 'INTERNAL_QC', 'Daily QC — L. Presentation, Plating & The Pass', false, false, 100),

-- M. Service Choreography & Hospitality Details (10)
('Anticipation observed: refills, napkins, extra sauce offered before requested', 'INTERNAL_QC', 'Daily QC — M. Service Choreography & Hospitality', false, false, 101),
('Table maintenance: cleared within 2 minutes of guests leaving; wiped & reset', 'INTERNAL_QC', 'Daily QC — M. Service Choreography & Hospitality', false, false, 102),
('Staff movement calm & purposeful — no running, shouting or visible stress', 'INTERNAL_QC', 'Daily QC — M. Service Choreography & Hospitality', false, false, 103),
('Guests with children, elderly or disabilities offered proactive help', 'INTERNAL_QC', 'Daily QC — M. Service Choreography & Hospitality', false, false, 104),
('Order errors recovered gracefully — apology + fix + gesture, without manager prompt', 'INTERNAL_QC', 'Daily QC — M. Service Choreography & Hospitality', false, false, 105),
('The farewell: every departing guest acknowledged — last impression = review', 'INTERNAL_QC', 'Daily QC — M. Service Choreography & Hospitality', false, false, 106),
('Waiting guests engaged: acknowledged, given time estimate, kept informed', 'INTERNAL_QC', 'Daily QC — M. Service Choreography & Hospitality', false, false, 107),
('Personal touches observed: regulars recognized, preferences remembered', 'INTERNAL_QC', 'Daily QC — M. Service Choreography & Hospitality', false, false, 108),
('Phone/online order guests treated with same warmth as walk-ins', 'INTERNAL_QC', 'Daily QC — M. Service Choreography & Hospitality', false, false, 109),
('Team communicates internally without guests overhearing operational talk', 'INTERNAL_QC', 'Daily QC — M. Service Choreography & Hospitality', false, false, 110),

-- N. Ingredient Quality & Sourcing (6)
('Produce: firm, vibrant color, no bruising/wilting — reject on sight, not on paper', 'INTERNAL_QC', 'Daily QC — N. Ingredient Quality & Sourcing', true, false, 111),
('Proteins: smell test passed; flesh springs back; no discoloration or slime', 'INTERNAL_QC', 'Daily QC — N. Ingredient Quality & Sourcing', false, false, 112),
('Dairy & eggs: dates checked AND product visually inspected on opening', 'INTERNAL_QC', 'Daily QC — N. Ingredient Quality & Sourcing', false, false, 113),
('Supplier consistency: same grade/size/brand as approved spec — no silent substitutions', 'INTERNAL_QC', 'Daily QC — N. Ingredient Quality & Sourcing', false, true, 114),
('Frozen goods: no freezer burn, no ice crystals indicating thaw-refreeze', 'INTERNAL_QC', 'Daily QC — N. Ingredient Quality & Sourcing', true, false, 115),
('One ingredient deep-dive daily (rotate): trace it from delivery note to plate', 'INTERNAL_QC', 'Daily QC — N. Ingredient Quality & Sourcing', false, false, 116);

-- ============================================================
-- WEEKLY AUDIT (QC-S-001 Part 1) — 45 points across 6 sections
-- ============================================================

INSERT INTO checklist_items (text, standard, category, requires_photo, is_critical, sort_order) VALUES
-- W1. Food Cost & Financial Leakage (8)
('Weekly stock count completed for top 20 high-value items', 'INTERNAL_QC', 'Weekly Audit — W1. Food Cost & Financial Leakage', false, false, 117),
('Theoretical vs actual food cost variance calculated — within 2%?', 'INTERNAL_QC', 'Weekly Audit — W1. Food Cost & Financial Leakage', false, true, 118),
('Top 3 variance items investigated (over-portioning / waste / theft)', 'INTERNAL_QC', 'Weekly Audit — W1. Food Cost & Financial Leakage', false, false, 119),
('Beverage cost variance calculated separately — within 1.5%?', 'INTERNAL_QC', 'Weekly Audit — W1. Food Cost & Financial Leakage', false, false, 120),
('Waste log weekly total reviewed; trend vs previous 4 weeks plotted', 'INTERNAL_QC', 'Weekly Audit — W1. Food Cost & Financial Leakage', false, false, 121),
('Portion control spot audit: 5 items weighed across different staff', 'INTERNAL_QC', 'Weekly Audit — W1. Food Cost & Financial Leakage', false, false, 122),
('Staff meals policy compliance checked — logged, approved, costed', 'INTERNAL_QC', 'Weekly Audit — W1. Food Cost & Financial Leakage', false, false, 123),
('Supplier invoices matched to delivery notes & order sheets — no gaps', 'INTERNAL_QC', 'Weekly Audit — W1. Food Cost & Financial Leakage', false, false, 124),

-- W2. POS Integrity & Fraud Prevention (7)
('All voids reviewed: who, when, why — patterns by staff member?', 'INTERNAL_QC', 'Weekly Audit — W2. POS Integrity & Fraud Prevention', false, true, 125),
('All discounts reviewed against authorization records', 'INTERNAL_QC', 'Weekly Audit — W2. POS Integrity & Fraud Prevention', false, false, 126),
('Refund log matched to till & delivery platform records', 'INTERNAL_QC', 'Weekly Audit — W2. POS Integrity & Fraud Prevention', false, false, 127),
('Cash variance log: any till over/short above tolerance investigated', 'INTERNAL_QC', 'Weekly Audit — W2. POS Integrity & Fraud Prevention', false, false, 128),
('No-sale drawer openings reviewed — frequency by cashier', 'INTERNAL_QC', 'Weekly Audit — W2. POS Integrity & Fraud Prevention', false, false, 129),
('Item deletion report (pre-send cancellations) reviewed for patterns', 'INTERNAL_QC', 'Weekly Audit — W2. POS Integrity & Fraud Prevention', false, false, 130),
('CCTV spot check: 2 random transactions matched to camera footage', 'INTERNAL_QC', 'Weekly Audit — W2. POS Integrity & Fraud Prevention', false, false, 131),

-- W3. Delivery Platforms & Digital Presence (8)
('Aggregator menus (all platforms) accurate: items, prices, photos current', 'INTERNAL_QC', 'Weekly Audit — W3. Delivery Platforms & Digital Presence', true, false, 132),
('Order rejection / cancellation rate per platform — within target?', 'INTERNAL_QC', 'Weekly Audit — W3. Delivery Platforms & Digital Presence', false, false, 133),
('Platform downtime this week reviewed — reasons documented', 'INTERNAL_QC', 'Weekly Audit — W3. Delivery Platforms & Digital Presence', false, false, 134),
('Average delivery prep time vs promised time — gap analysis', 'INTERNAL_QC', 'Weekly Audit — W3. Delivery Platforms & Digital Presence', false, false, 135),
('New reviews on all platforms read; themes logged; responses posted', 'INTERNAL_QC', 'Weekly Audit — W3. Delivery Platforms & Digital Presence', false, false, 136),
('Rating trend per platform plotted vs previous 4 weeks', 'INTERNAL_QC', 'Weekly Audit — W3. Delivery Platforms & Digital Presence', false, false, 137),
('Delivery packaging test: order one delivery yourself — arrives intact, hot, sealed?', 'INTERNAL_QC', 'Weekly Audit — W3. Delivery Platforms & Digital Presence', true, false, 138),
('Social media: this week''s posts published; comments & DMs answered', 'INTERNAL_QC', 'Weekly Audit — W3. Delivery Platforms & Digital Presence', false, false, 139),

-- W4. Deep Cleaning Verification (9)
('Extraction hood & filters degreased — inspect above and behind', 'INTERNAL_QC', 'Weekly Audit — W4. Deep Cleaning Verification', true, true, 140),
('Grease trap emptied & cleaned — check the log AND the trap', 'INTERNAL_QC', 'Weekly Audit — W4. Deep Cleaning Verification', true, false, 141),
('Drains flushed with approved treatment; no odor at floor level', 'INTERNAL_QC', 'Weekly Audit — W4. Deep Cleaning Verification', false, false, 142),
('Ice machine interior sanitized — inspect for mold/slime', 'INTERNAL_QC', 'Weekly Audit — W4. Deep Cleaning Verification', true, true, 143),
('Behind & under all equipment cleaned — move at least 3 units', 'INTERNAL_QC', 'Weekly Audit — W4. Deep Cleaning Verification', true, false, 144),
('Walk-in fridge/freezer: shelving washed, door seals cleaned & intact', 'INTERNAL_QC', 'Weekly Audit — W4. Deep Cleaning Verification', true, false, 145),
('Fryers boiled out; oil disposal documented with certified collector', 'INTERNAL_QC', 'Weekly Audit — W4. Deep Cleaning Verification', false, false, 146),
('Storage areas: shelving wiped, floor corners clean, nothing on floor', 'INTERNAL_QC', 'Weekly Audit — W4. Deep Cleaning Verification', true, false, 147),
('A/C vents & fan guards dust-free in kitchen and dining areas', 'INTERNAL_QC', 'Weekly Audit — W4. Deep Cleaning Verification', true, false, 148),

-- W5. Maintenance & Asset Care (7)
('Preventive maintenance schedule reviewed — this week''s tasks done?', 'INTERNAL_QC', 'Weekly Audit — W5. Maintenance & Asset Care', false, false, 149),
('Breakdown log reviewed: repeat failures flagged for replacement decision', 'INTERNAL_QC', 'Weekly Audit — W5. Maintenance & Asset Care', false, false, 150),
('Refrigeration: compressor sounds, door seals, drainage checked', 'INTERNAL_QC', 'Weekly Audit — W5. Maintenance & Asset Care', false, false, 151),
('Cooking equipment: burners, thermostats, timers functioning to spec', 'INTERNAL_QC', 'Weekly Audit — W5. Maintenance & Asset Care', false, false, 152),
('Small equipment inventory: knives, boards, pans — condition & count', 'INTERNAL_QC', 'Weekly Audit — W5. Maintenance & Asset Care', false, false, 153),
('Furniture walk: every chair & table tested; repairs actioned or booked', 'INTERNAL_QC', 'Weekly Audit — W5. Maintenance & Asset Care', false, false, 154),
('Lighting audit: 100% of bulbs working, including storage & restrooms', 'INTERNAL_QC', 'Weekly Audit — W5. Maintenance & Asset Care', false, false, 155),

-- W6. People: Training & Scheduling (6)
('Next week''s rota published; peak coverage matches sales forecast', 'INTERNAL_QC', 'Weekly Audit — W6. People: Training & Scheduling', false, false, 156),
('One training topic delivered this week (15-min huddle counts) — documented', 'INTERNAL_QC', 'Weekly Audit — W6. People: Training & Scheduling', false, false, 157),
('New starters: onboarding checklist progress reviewed', 'INTERNAL_QC', 'Weekly Audit — W6. People: Training & Scheduling', false, false, 158),
('Cross-training matrix updated — every station has 2+ capable staff?', 'INTERNAL_QC', 'Weekly Audit — W6. People: Training & Scheduling', false, false, 159),
('Overtime & absence reviewed; patterns addressed with individuals', 'INTERNAL_QC', 'Weekly Audit — W6. People: Training & Scheduling', false, false, 160),
('One-on-one check-in with at least 2 team members (rotate weekly)', 'INTERNAL_QC', 'Weekly Audit — W6. People: Training & Scheduling', false, false, 161);

-- ============================================================
-- MONTHLY AUDIT (QC-S-001 Part 2) — 42 points across 6 sections
-- ============================================================

INSERT INTO checklist_items (text, standard, category, requires_photo, is_critical, sort_order) VALUES
-- M1. Legal, Licenses & Documentation (8)
('All staff health certificates valid — expiry dates logged, renewals booked', 'INTERNAL_QC', 'Monthly Audit — M1. Legal, Licenses & Documentation', false, true, 162),
('Business, health & civil defense licenses current & displayed', 'INTERNAL_QC', 'Monthly Audit — M1. Legal, Licenses & Documentation', true, true, 163),
('Working hours, breaks & rest days compliant with labor law', 'INTERNAL_QC', 'Monthly Audit — M1. Legal, Licenses & Documentation', false, false, 164),
('Insurance policies (premises, liability, workers) in force', 'INTERNAL_QC', 'Monthly Audit — M1. Legal, Licenses & Documentation', false, false, 165),
('HACCP documentation complete for the month — spot-check 5 random days', 'INTERNAL_QC', 'Monthly Audit — M1. Legal, Licenses & Documentation', false, false, 166),
('Incident reports from the month reviewed; corrective actions closed', 'INTERNAL_QC', 'Monthly Audit — M1. Legal, Licenses & Documentation', false, false, 167),
('Employee files complete: contracts, IDs, signed SOP acknowledgments', 'INTERNAL_QC', 'Monthly Audit — M1. Legal, Licenses & Documentation', false, false, 168),
('Tax & social insurance filings current (confirm with accountant)', 'INTERNAL_QC', 'Monthly Audit — M1. Legal, Licenses & Documentation', false, false, 169),

-- M2. Menu Engineering & Profitability (8)
('Item-level sales mix report pulled for the full month', 'INTERNAL_QC', 'Monthly Audit — M2. Menu Engineering & Profitability', false, false, 170),
('Contribution margin per item recalculated with current ingredient costs', 'INTERNAL_QC', 'Monthly Audit — M2. Menu Engineering & Profitability', false, false, 171),
('Menu matrix built: Stars / Plowhorses / Puzzles / Dogs classified', 'INTERNAL_QC', 'Monthly Audit — M2. Menu Engineering & Profitability', false, false, 172),
('Action taken: at least one Dog reviewed for removal or rework', 'INTERNAL_QC', 'Monthly Audit — M2. Menu Engineering & Profitability', false, false, 173),
('At least one Puzzle repositioned (menu placement, photo, staff push)', 'INTERNAL_QC', 'Monthly Audit — M2. Menu Engineering & Profitability', false, false, 174),
('Price review vs cost inflation — margin erosion above 1% addressed', 'INTERNAL_QC', 'Monthly Audit — M2. Menu Engineering & Profitability', false, false, 175),
('New item pipeline: at least one item in development or test', 'INTERNAL_QC', 'Monthly Audit — M2. Menu Engineering & Profitability', false, false, 176),
('Recipe cards updated for any changed items — kitchen retrained', 'INTERNAL_QC', 'Monthly Audit — M2. Menu Engineering & Profitability', false, false, 177),

-- M3. Supplier Performance & Procurement (6)
('Supplier scorecard updated: quality, punctuality, accuracy, rejects', 'INTERNAL_QC', 'Monthly Audit — M3. Supplier Performance & Procurement', false, false, 178),
('Price benchmarking: top 10 items quoted from at least one alternative', 'INTERNAL_QC', 'Monthly Audit — M3. Supplier Performance & Procurement', false, false, 179),
('Rejected delivery log reviewed — chronic offenders escalated', 'INTERNAL_QC', 'Monthly Audit — M3. Supplier Performance & Procurement', false, false, 180),
('Payment terms & credit standing with suppliers verified', 'INTERNAL_QC', 'Monthly Audit — M3. Supplier Performance & Procurement', false, false, 181),
('One supplier site visit or virtual audit completed (rotate monthly)', 'INTERNAL_QC', 'Monthly Audit — M3. Supplier Performance & Procurement', false, false, 182),
('Contract renewals due next 60 days identified & negotiation started', 'INTERNAL_QC', 'Monthly Audit — M3. Supplier Performance & Procurement', false, false, 183),

-- M4. Guest Insight, Mystery Shop & Brand (8)
('Mystery shopper visit completed by someone unknown to staff', 'INTERNAL_QC', 'Monthly Audit — M4. Guest Insight, Mystery Shop & Brand', false, true, 184),
('Mystery shop report scored & debriefed with the team', 'INTERNAL_QC', 'Monthly Audit — M4. Guest Insight, Mystery Shop & Brand', false, false, 185),
('Month''s review data aggregated: rating trend, complaint themes, praise themes', 'INTERNAL_QC', 'Monthly Audit — M4. Guest Insight, Mystery Shop & Brand', false, false, 186),
('Repeat-guest indicators reviewed (loyalty data, recognized regulars, app data)', 'INTERNAL_QC', 'Monthly Audit — M4. Guest Insight, Mystery Shop & Brand', false, false, 187),
('Complaint log: 100% closed with root cause noted, not just apology', 'INTERNAL_QC', 'Monthly Audit — M4. Guest Insight, Mystery Shop & Brand', false, false, 188),
('Guest suggestion implemented this month — at least one, publicized to team', 'INTERNAL_QC', 'Monthly Audit — M4. Guest Insight, Mystery Shop & Brand', false, false, 189),
('Brand audit: signage, uniforms, packaging, menus consistent with brand book', 'INTERNAL_QC', 'Monthly Audit — M4. Guest Insight, Mystery Shop & Brand', true, false, 190),
('Local competitor visit done by manager — pricing, offers, experience notes', 'INTERNAL_QC', 'Monthly Audit — M4. Guest Insight, Mystery Shop & Brand', false, false, 191),

-- M5. Crisis Readiness & Continuity (6)
('One emergency drill run this month (rotate: fire / gas / power / water)', 'INTERNAL_QC', 'Monthly Audit — M5. Crisis Readiness & Continuity', false, true, 192),
('Generator tested under load — not just started; runtime logged', 'INTERNAL_QC', 'Monthly Audit — M5. Crisis Readiness & Continuity', false, false, 193),
('Emergency contact tree updated & posted; staff can locate it', 'INTERNAL_QC', 'Monthly Audit — M5. Crisis Readiness & Continuity', true, false, 194),
('Water outage plan: bottled stock, sanitizer reserve, closure criteria known', 'INTERNAL_QC', 'Monthly Audit — M5. Crisis Readiness & Continuity', false, false, 195),
('Food recall procedure: staff can explain isolation & documentation steps', 'INTERNAL_QC', 'Monthly Audit — M5. Crisis Readiness & Continuity', false, false, 196),
('Data backup: POS & CCTV storage verified restorable this month', 'INTERNAL_QC', 'Monthly Audit — M5. Crisis Readiness & Continuity', false, false, 197),

-- M6. People Development & Culture (6)
('Monthly staff meeting held: results shared, wins celebrated, plan set', 'INTERNAL_QC', 'Monthly Audit — M6. People Development & Culture', false, false, 198),
('Employee of the month (or equivalent recognition) awarded', 'INTERNAL_QC', 'Monthly Audit — M6. People Development & Culture', false, false, 199),
('Turnover rate calculated; leavers'' reasons logged & themed', 'INTERNAL_QC', 'Monthly Audit — M6. People Development & Culture', false, false, 200),
('Training hours per employee tracked vs monthly target', 'INTERNAL_QC', 'Monthly Audit — M6. People Development & Culture', false, false, 201),
('Succession check: who is ready to step up if a key person leaves?', 'INTERNAL_QC', 'Monthly Audit — M6. People Development & Culture', false, false, 202),
('Staff satisfaction pulse (5-question anonymous survey) run & reviewed', 'INTERNAL_QC', 'Monthly Audit — M6. People Development & Culture', false, false, 203);

-- ============================================================
-- QUARTERLY AUDIT (QC-S-001 Part 3) — 14 points across 2 sections
-- ============================================================

INSERT INTO checklist_items (text, standard, category, requires_photo, is_critical, sort_order) VALUES
-- Q1. Infrastructure & Certified Inspections (8)
('Water quality lab test: potable supply + ice machine output', 'INTERNAL_QC', 'Quarterly Audit — Q1. Infrastructure & Certified Inspections', false, true, 204),
('Fire suppression & alarm system professionally inspected & certified', 'INTERNAL_QC', 'Quarterly Audit — Q1. Infrastructure & Certified Inspections', false, true, 205),
('Pest control contract reviewed; quarterly report & trend analysis received', 'INTERNAL_QC', 'Quarterly Audit — Q1. Infrastructure & Certified Inspections', false, false, 206),
('Gas installation professionally inspected; certificate filed', 'INTERNAL_QC', 'Quarterly Audit — Q1. Infrastructure & Certified Inspections', false, false, 207),
('Electrical safety inspection: panels, earthing, kitchen circuits', 'INTERNAL_QC', 'Quarterly Audit — Q1. Infrastructure & Certified Inspections', false, false, 208),
('Hood & duct professional deep clean (fire-risk certification) completed', 'INTERNAL_QC', 'Quarterly Audit — Q1. Infrastructure & Certified Inspections', false, false, 209),
('Structural walk: leaks, cracks, tiles, sealant, door closures repaired', 'INTERNAL_QC', 'Quarterly Audit — Q1. Infrastructure & Certified Inspections', true, false, 210),
('Equipment lifecycle review: items nearing end-of-life budgeted for replacement', 'INTERNAL_QC', 'Quarterly Audit — Q1. Infrastructure & Certified Inspections', false, false, 211),

-- Q2. Strategic Performance Review (6)
('Quarterly P&L reviewed vs budget: sales, prime cost, EBITDA', 'INTERNAL_QC', 'Quarterly Audit — Q2. Strategic Performance Review', false, false, 212),
('Sales trend by daypart & channel vs same quarter last year', 'INTERNAL_QC', 'Quarterly Audit — Q2. Strategic Performance Review', false, false, 213),
('Repeat-guest rate & average ticket trend reviewed', 'INTERNAL_QC', 'Quarterly Audit — Q2. Strategic Performance Review', false, false, 214),
('Market position: competitor openings/closings mapped; share estimate', 'INTERNAL_QC', 'Quarterly Audit — Q2. Strategic Performance Review', false, false, 215),
('Pricing strategy reviewed against cost inflation & competitor moves', 'INTERNAL_QC', 'Quarterly Audit — Q2. Strategic Performance Review', false, false, 216),
('Is the audit system itself being followed? Review next quarter''s daily/weekly/monthly compliance rates', 'INTERNAL_QC', 'Quarterly Audit — Q2. Strategic Performance Review', false, true, 217);
