-- SOPs 12-20, requested by the client by title only (no detailed
-- procedure text was provided, unlike SOP 1-11 which were transcribed
-- directly from the client's own documents). At the client's explicit
-- direction, this content was RESEARCHED rather than invented from
-- scratch or transcribed verbatim: each SOP below was drafted from
-- current industry-standard guidance (FDA Food Code, TIPS/responsible
-- alcohol service training standards, and established restaurant
-- operations sources), then written in the same one-item-per-phase
-- style as SOP 1-11 for consistency in the library.
--
-- THIS IS NOT THE CLIENT'S OWN VERIFIED CONTENT THE WAY SOP 1-11 WERE.
-- It's a reasonable, sourced starting point the client should review,
-- edit, and replace with their own house rules and local legal
-- requirements (alcohol service age, licensing, and health-code specifics
-- vary by jurisdiction) before relying on it operationally.
--
-- is_critical again follows precedent set across every earlier SOP
-- import: SOP 16 (alcohol) and SOP 18 (emergencies) are almost entirely
-- critical because that's genuinely what those domains are (license/
-- legal liability, life safety), mirroring how SOP 4 and SOP 10 turned
-- out. SOP 12/15 (recipe consistency, waste) are quality/cost SOPs with
-- no critical items, mirroring the Monthly Audit's menu-engineering
-- section.

INSERT INTO checklist_items (text, standard, category, description, requires_photo, is_critical, sort_order) VALUES

-- SOP 12: Recipe Standardization and Portion Control (5)
('Standardized recipe followed exactly for every dish', 'SOP', 'SOP 12: Recipe Standardization — 1. Recipe Adherence',
 'Prepare each dish exactly to the standardized recipe card - ingredients, quantities, preparation steps, cook method, and plating - rather than to memory or personal preference.',
 false, false, 1),
('Portion control tools used for every serving', 'SOP', 'SOP 12: Recipe Standardization — 2. Portion Control',
 'Use scales, measured ladles or spoodles, and standard-size scoops for every portion rather than eyeballing it - weigh proteins before serving, use consistent glass sizes, and count items like shrimp or wings per the recipe spec.',
 false, false, 2),
('Plate presentation matches the reference photo at the station', 'SOP', 'SOP 12: Recipe Standardization — 3. Presentation Check',
 'Compare the finished plate against the posted spec photo at each station before it leaves the pass - garnish placement, portion size, and arrangement should match.',
 true, false, 3),
('New or updated recipes trained before service', 'SOP', 'SOP 12: Recipe Standardization — 4. Recipe Rollout Training',
 'Any new dish or recipe change is demonstrated to the team - measured, plated, and served - before it goes on the line, not just explained verbally.',
 false, false, 4),
('Portion consistency spot-checked', 'SOP', 'SOP 12: Recipe Standardization — 5. Spot Checks',
 'Periodically weigh or measure a finished portion against spec to catch drift before it becomes a pattern.',
 false, false, 5),

-- SOP 13: Kitchen Cleaning and Sanitizing Schedule (6)
('Food-contact surfaces cleaned and sanitized during service', 'SOP', 'SOP 13: Cleaning & Sanitizing — 1. During-Service Sanitizing',
 'Clean and sanitize cutting boards, prep surfaces, and utensils after each use and at least every 4 hours during continuous use, per FDA Food Code guidance.',
 false, true, 1),
('Cooking equipment degreased and cleaned at close', 'SOP', 'SOP 13: Cleaning & Sanitizing — 2. Daily Equipment Cleaning',
 'Degrease the grill, flat-top, and fryers after service each night, and wipe down ranges, ovens, and hoods.',
 false, false, 2),
('Floors and drains cleaned daily', 'SOP', 'SOP 13: Cleaning & Sanitizing — 3. Daily Floors & Drains',
 'Sweep and mop kitchen floors after prep and after service, and check that drains run clear with no standing water.',
 true, false, 3),
('Weekly equipment degreasing and grease trap service completed', 'SOP', 'SOP 13: Cleaning & Sanitizing — 4. Weekly Deep Clean',
 'Thoroughly degrease grills and griddles, drain and scrub fryers, clear grease trap clogs, and dust light fixtures.',
 true, false, 4),
('Monthly deep-clean tasks completed', 'SOP', 'SOP 13: Cleaning & Sanitizing — 5. Monthly Deep Clean',
 'Complete deep-clean items that only need monthly attention, such as refrigerator condenser coils and furniture care, per the posted monthly schedule.',
 false, false, 5),
('Cleaning schedule signed off with date and initials', 'SOP', 'SOP 13: Cleaning & Sanitizing — 6. Sign-Off',
 'Every completed cleaning task - during-service, daily, weekly, or monthly - is signed off with date and initials on the cleaning log, not just done from memory.',
 false, false, 6),

-- SOP 14: Inventory Management and Ordering (6)
('Par levels set for every inventory item', 'SOP', 'SOP 14: Inventory & Ordering — 1. Par Levels',
 'Par level = (average daily usage x days between orders) + safety stock, calculated from actual usage data rather than guesswork, adjusted for the busiest days of the week.',
 false, false, 1),
('Inventory counted on schedule', 'SOP', 'SOP 14: Inventory & Ordering — 2. Scheduled Counts',
 'Physically count stock at least weekly (more often for high-value or fast-moving items) using a consistent, documented process.',
 false, false, 2),
('Stock rotated FIFO', 'SOP', 'SOP 14: Inventory & Ordering — 3. FIFO Rotation',
 'New stock goes behind existing stock; older items are used first to reduce spoilage and keep inventory fresh.',
 false, true, 3),
('Orders placed against par levels', 'SOP', 'SOP 14: Inventory & Ordering — 4. Ordering Discipline',
 'Reorder when stock falls below its par level rather than by feel - use alerts or a standing order schedule tied to par levels to avoid both stockouts and overstocking.',
 false, false, 4),
('Deliveries checked against the order before stocking', 'SOP', 'SOP 14: Inventory & Ordering — 5. Delivery Reconciliation',
 'Verify quantities, product codes, and condition against the purchase order before accepting and shelving a delivery.',
 false, false, 5),
('Par levels reviewed after menu or demand changes', 'SOP', 'SOP 14: Inventory & Ordering — 6. Par Level Review',
 'Update par levels after menu changes, seasonal shifts, vendor lead-time changes, or sustained sales increases or decreases - stale par levels are a common and expensive mistake.',
 false, false, 6),

-- SOP 15: Waste Reduction and Food Cost Control (5)
('All food waste logged', 'SOP', 'SOP 15: Waste & Cost Control — 1. Waste Logging',
 'Record every instance of food waste - item, quantity, and reason (overproduction, spoilage, error) - rather than discarding it unrecorded.',
 false, false, 1),
('Waste log reviewed regularly for patterns', 'SOP', 'SOP 15: Waste & Cost Control — 2. Pattern Review',
 'Review the waste log on a set cadence to spot recurring causes - a station consistently over-prepping, a supplier consistently short-dating a product - and act on them.',
 false, false, 2),
('Prep quantities adjusted based on actual demand', 'SOP', 'SOP 15: Waste & Cost Control — 3. Prep Calibration',
 'Compare planned prep quantities to actual usage and adjust batch sizes to reduce overproduction waste.',
 false, false, 3),
('Repurposing considered before disposal', 'SOP', 'SOP 15: Waste & Cost Control — 4. Repurposing',
 'Before discarding excess or near-expiry food, consider repurposing it into another dish or donating it, consistent with food safety guidelines.',
 false, false, 4),
('Underperforming menu items reviewed for cost and waste impact', 'SOP', 'SOP 15: Waste & Cost Control — 5. Menu Review',
 'Periodically review which menu items drive disproportionate waste or poor margin, and rework or remove them.',
 false, false, 5),

-- SOP 16: Alcohol Service and ID Checking (6)
('ID checked for every guest who appears under the legal drinking age', 'SOP', 'SOP 16: Alcohol Service — 1. Carding',
 'Card any guest who appears under the legal drinking age (many operators use a buffer, carding anyone who looks under 30) - when in doubt, ask.',
 false, true, 1),
('ID authenticity verified before serving', 'SOP', 'SOP 16: Alcohol Service — 2. ID Verification',
 'Accept only a current, unexpired state-issued driver''s license, passport, or military ID. Check the photo and details against the person presenting it, and look for security features such as holograms, raised text, and UV markings.',
 false, true, 2),
('Suspicious or fake ID handled correctly', 'SOP', 'SOP 16: Alcohol Service — 3. Suspicious ID',
 'Follow the trained procedure for a suspicious ID: do not serve, notify a manager, and follow local law and house policy on retaining or returning the ID and involving authorities if required.',
 false, true, 3),
('Signs of intoxication monitored throughout service', 'SOP', 'SOP 16: Alcohol Service — 4. Intoxication Monitoring',
 'Watch for signs of intoxication throughout service, not just at the point of the first drink, and slow or stop alcohol service accordingly.',
 false, true, 4),
('Service refused or cut off when appropriate', 'SOP', 'SOP 16: Alcohol Service — 5. Refusing Service',
 'Refuse or stop alcohol service to an intoxicated or underage guest, involving a manager for support with the guest interaction.',
 false, true, 5),
('Alcohol server certification current for all staff serving alcohol', 'SOP', 'SOP 16: Alcohol Service — 6. Server Certification',
 'Confirm every employee who serves or sells alcohol holds a current responsible-service certification (e.g. TIPS or the local equivalent), and track renewal dates.',
 false, true, 6),

-- SOP 17: Allergen Awareness and Communication (5)
('Staff trained on major food allergens and reaction symptoms', 'SOP', 'SOP 17: Allergen Awareness — 1. Staff Training',
 'All staff can identify the major food allergens (milk, eggs, fish, shellfish, tree nuts, peanuts, wheat, soybeans, sesame) and recognize the symptoms of an allergic reaction.',
 false, true, 1),
('Allergen information communicated to guests', 'SOP', 'SOP 17: Allergen Awareness — 2. Guest Communication',
 'Make allergen information available to guests through menu notations, table tents, or staff who can answer allergen questions accurately - in writing where required.',
 false, false, 2),
('Cross-contact prevented in prep and service', 'SOP', 'SOP 17: Allergen Awareness — 3. Cross-Contact Prevention',
 'Use dedicated or thoroughly cleaned tools, surfaces, and prep areas when preparing an allergen-free order - allergen proteins transfer easily and are not destroyed by cooking.',
 false, true, 3),
('Guest allergy noted and relayed to kitchen for every order', 'SOP', 'SOP 17: Allergen Awareness — 4. Order Communication',
 'Every allergy mentioned by a guest is written prominently on the ticket, relayed to the kitchen manager, and confirmed before the dish leaves the kitchen.',
 false, true, 4),
('Allergic reaction emergency response known by all staff', 'SOP', 'SOP 17: Allergen Awareness — 5. Emergency Response',
 'All staff know the steps to take if a guest has an allergic reaction: call emergency services, alert the manager, keep the guest calm, and preserve packaging or food for reference.',
 false, true, 5),

-- SOP 18: Emergency Procedures - Fire, Injury, Choking (6)
('Fire response and evacuation followed correctly', 'SOP', 'SOP 18: Emergency Procedures — 1. Fire Response',
 'For a small, controllable fire: alert others and use the correct extinguisher type (Class K for kitchen/oil fires, Class ABC for general areas). For a large or spreading fire: evacuate immediately via the posted route to the assembly point, call emergency services, and do not re-enter.',
 false, true, 1),
('Choking response performed correctly', 'SOP', 'SOP 18: Emergency Procedures — 2. Choking Response',
 'If someone is choking and cannot talk, cry, or laugh forcefully: give 5 back blows followed by 5 abdominal thrusts, repeating until the object clears. If the person becomes unresponsive, lower them to the ground and begin CPR.',
 false, true, 2),
('Injury and first aid response followed', 'SOP', 'SOP 18: Emergency Procedures — 3. Injury & First Aid',
 'For any injury, notify a manager immediately, apply appropriate first aid (e.g. cool a burn under running water for 20 minutes, apply pressure to a cut with a food-safe detectable plaster), and log the incident regardless of severity.',
 false, true, 3),
('Emergency equipment checked and accessible', 'SOP', 'SOP 18: Emergency Procedures — 4. Equipment Readiness',
 'Fire extinguishers, first aid kits, and an AED if required locally are in their marked locations, inspected and in date, and not blocked or obstructed.',
 true, true, 4),
('Staff emergency training and certification current', 'SOP', 'SOP 18: Emergency Procedures — 5. Staff Readiness',
 'At least two staff members per shift are current on CPR/First Aid certification, and all staff know the evacuation route, their role in it, and the location of utility shutoffs.',
 false, true, 5),
('Emergency drill conducted and documented', 'SOP', 'SOP 18: Emergency Procedures — 6. Drills',
 'Run a scheduled emergency drill (fire, gas, power, or water, rotating focus) and document staff attendance and any gaps found.',
 false, true, 6),

-- SOP 19: New Employee Onboarding and Training (6)
('Pre-boarding preparation completed', 'SOP', 'SOP 19: Onboarding & Training — 1. Pre-Boarding',
 'Send the new hire a welcome message before day one with start time, dress code, where to report, and what to bring, and prepare their schedule, uniform, and paperwork in advance.',
 false, false, 1),
('Day-one orientation completed', 'SOP', 'SOP 19: Onboarding & Training — 2. Day-One Orientation',
 'Cover the employee handbook (attendance, dress code, phone use, break rules), a facility tour, and introductions to the team on the first day.',
 false, false, 2),
('Compliance documentation collected', 'SOP', 'SOP 19: Onboarding & Training — 3. Compliance Paperwork',
 'Collect required paperwork - pay/tax forms, food handler certification, alcohol service permit if applicable - before the employee starts independent work.',
 false, true, 3),
('Role-specific training completed', 'SOP', 'SOP 19: Onboarding & Training — 4. Role Training',
 'Walk the new hire through their station, menu knowledge, and POS basics with hands-on demonstration, not just verbal explanation.',
 false, false, 4),
('Training buddy or mentor assigned', 'SOP', 'SOP 19: Onboarding & Training — 5. Mentor Assignment',
 'Pair the new hire with an experienced team member for their first shifts to answer questions and reinforce training.',
 false, false, 5),
('30/60/90-day check-ins completed', 'SOP', 'SOP 19: Onboarding & Training — 6. Milestone Check-Ins',
 'Hold a formal check-in with the new hire at 30, 60, and 90 days to review performance, answer questions, and address any gaps.',
 false, false, 6),

-- SOP 20: Daily Manager Checklist and Shift Duties (5)
('Opening walkthrough and setup verified', 'SOP', 'SOP 20: Manager Shift Duties — 1. Opening',
 'Arrive at least 30 minutes before the first employee, survey the premises for repairs or cleanliness issues, check and log cold-storage temperatures, verify scheduled deliveries arrived and are stored correctly, and review the day''s schedule, specials, and reservations.',
 false, false, 1),
('Shift briefing and staffing confirmed', 'SOP', 'SOP 20: Manager Shift Duties — 2. Shift Briefing',
 'Brief the team on specials, promotions, out-of-stock items, and any VIPs or large parties, assign sections and duties, and confirm staffing matches expected volume.',
 false, false, 2),
('Mid-shift oversight maintained', 'SOP', 'SOP 20: Manager Shift Duties — 3. Mid-Shift Oversight',
 'Stay visible and available on the floor throughout the shift, addressing issues as they come up rather than only at open and close.',
 false, false, 3),
('Closing walkthrough and cash reconciliation completed', 'SOP', 'SOP 20: Manager Shift Duties — 4. Closing',
 'Walk the entire restaurant for cleanliness, verify staff clock-in/clock-out times, count each register and compare actual cash against the POS report, and investigate any discrepancy immediately.',
 false, true, 4),
('Manager logbook completed', 'SOP', 'SOP 20: Manager Shift Duties — 5. Logbook',
 'Record the shift''s key events, staff performance notes, and incidents for the next manager, then lock up and secure the building before leaving.',
 false, false, 5);
