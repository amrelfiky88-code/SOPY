-- Convenience Store / forecourt checkpoints.
--
-- PROVENANCE — READ BEFORE EDITING: unlike SOP 1-11 and the INTERNAL_QC
-- audit content, this section was NOT transcribed from the client's own
-- documents. It was compiled at the client's request from public
-- industry references:
--   * GoAudits "Convenience Store Daily Checklist" — section structure
--     and the bulk of the daily operational checkpoints
--     https://goaudits.com/checklist/convenience-store-daily-checklist/902/49/
--   * Miratag "Convenience Store Daily Opening Checklist (US)" — the
--     opening sequence and the US holding temperatures quoted below
--     https://miratag.com/api/checklist-pdf/convenience-store-daily-opening-checklist-us
--   * Apter Industries "Convenience Store Cleaning Checklist" — the
--     shift / daily / weekly / monthly cleaning cadence
--     https://www.apterindustries.com/convenience-store-cleaning-checklist/
--
-- Treat it as a reviewable starting point, not verified client material.
-- Temperatures follow the US FDA Food Code figures the sources quote
-- (cooler 34-41F, freezer 0F or below, hot hold 135F+); a store running
-- to local Egyptian regulation should have these confirmed before use.
--
-- is_critical is applied where getting it wrong is a safety, legal
-- (age-restricted sales), food-safety or cash-loss risk rather than a
-- presentation issue.

INSERT INTO checklist_items (text, standard, category, description, requires_photo, is_critical, sort_order) VALUES

-- A. Opening: Security & Cash ---------------------------------------
('Alarm deactivated and store confirmed secure', 'C_STORE', 'C-Store — A. Opening: Security & Cash',
 'Disarm the alarm and walk the store before unlocking to customers. Check for signs of forced entry, damage or anything disturbed overnight, and report immediately if found.', true, true, 1),
('Safe opened and bank counted', 'C_STORE', 'C-Store — A. Opening: Security & Cash',
 'Count the safe against the expected balance and record it. Investigate and escalate any variance before trading starts.', true, true, 2),
('Register loaded with the correct opening drawer', 'C_STORE', 'C-Store — A. Opening: Security & Cash',
 'Count the opening float into each register and record the amount.', true, true, 3),
('Card terminal powered on and tested', 'C_STORE', 'C-Store — A. Opening: Security & Cash', NULL, true, false, 4),
('CCTV recording and monitors on', 'C_STORE', 'C-Store — A. Opening: Security & Cash',
 'Confirm the recorder shows no error state and that register and forecourt views are unobstructed.', true, true, 5),
('Previous shift notes and incident log reviewed', 'C_STORE', 'C-Store — A. Opening: Security & Cash', NULL, true, false, 6),

-- B. Opening: Store Presentation ------------------------------------
('Entrance and parking lot swept', 'C_STORE', 'C-Store — B. Opening: Store Presentation', NULL, true, false, 1),
('Signage and window displays correct', 'C_STORE', 'C-Store — B. Opening: Store Presentation', NULL, true, false, 2),
('Aisles clear with no trip hazards', 'C_STORE', 'C-Store — B. Opening: Store Presentation', NULL, true, true, 3),
('Shelves fronted and faced', 'C_STORE', 'C-Store — B. Opening: Store Presentation', NULL, true, false, 4),
('Promotional displays set up and priced', 'C_STORE', 'C-Store — B. Opening: Store Presentation', NULL, true, false, 5),
('All lighting working, inside and out', 'C_STORE', 'C-Store — B. Opening: Store Presentation', NULL, true, false, 6),
('Music / PA system on', 'C_STORE', 'C-Store — B. Opening: Store Presentation', NULL, true, false, 7),
('Trash cans emptied and area tidy', 'C_STORE', 'C-Store — B. Opening: Store Presentation', NULL, true, false, 8),

-- C. Exterior & Forecourt -------------------------------------------
('Parking lot and forecourt free of litter, debris and standing water', 'C_STORE', 'C-Store — C. Exterior & Forecourt', NULL, true, false, 1),
('All fuel pumps operational and displaying correct pricing', 'C_STORE', 'C-Store — C. Exterior & Forecourt', NULL, true, false, 2),
('Pump nozzles, hoses and holsters undamaged', 'C_STORE', 'C-Store — C. Exterior & Forecourt',
 'Look for splits, perforation or leaking at the hose and nozzle. Bag off any pump with damaged equipment until it is repaired.', true, true, 3),
('Emergency fuel shutoff accessible and unobstructed', 'C_STORE', 'C-Store — C. Exterior & Forecourt',
 'The emergency stop must be reachable without moving anything. Nothing may be stored or parked in front of it.', true, true, 4),
('Forecourt and canopy lighting functional', 'C_STORE', 'C-Store — C. Exterior & Forecourt', NULL, true, false, 5),
('No fuel spills or hazardous conditions on the pump island', 'C_STORE', 'C-Store — C. Exterior & Forecourt',
 'Any spill is contained with absorbent from the spill kit immediately, the area cordoned, and the incident logged.', true, true, 6),
('Spill kit stocked and accessible', 'C_STORE', 'C-Store — C. Exterior & Forecourt', NULL, true, true, 7),
('Air and vacuum station operational and priced correctly', 'C_STORE', 'C-Store — C. Exterior & Forecourt', NULL, true, false, 8),
('Car wash operational and signage accurate (if present)', 'C_STORE', 'C-Store — C. Exterior & Forecourt', NULL, true, false, 9),
('Exterior signage, price boards and banners correct and undamaged', 'C_STORE', 'C-Store — C. Exterior & Forecourt', NULL, true, false, 10),
('Squeegee stations stocked with fluid and clean tools', 'C_STORE', 'C-Store — C. Exterior & Forecourt', NULL, true, false, 11),
('Forecourt trash cans emptied and not overflowing', 'C_STORE', 'C-Store — C. Exterior & Forecourt', NULL, true, false, 12),
('Dumpster area clean, lids closed, no odor or pest activity', 'C_STORE', 'C-Store — C. Exterior & Forecourt', NULL, true, false, 13),

-- D. Sales Floor ----------------------------------------------------
('Entry mats in place, clean and lying flat', 'C_STORE', 'C-Store — D. Sales Floor', NULL, true, false, 1),
('Aisle floors dry and free of slip hazards', 'C_STORE', 'C-Store — D. Sales Floor', NULL, true, true, 2),
('Wet floor signs available and stored accessibly', 'C_STORE', 'C-Store — D. Sales Floor', NULL, true, false, 3),
('Shelves fully faced and free of visible gaps', 'C_STORE', 'C-Store — D. Sales Floor', NULL, true, false, 4),
('Shelf pricing labels present, legible and matching the product', 'C_STORE', 'C-Store — D. Sales Floor', NULL, true, false, 5),
('No expired or damaged products on the sales floor', 'C_STORE', 'C-Store — D. Sales Floor',
 'Walk the aisles checking date codes. Pull anything out of date, log it as waste and dispose of it — never return it to the shelf.', true, true, 6),
('Promotional displays match the current promotion and pricing', 'C_STORE', 'C-Store — D. Sales Floor', NULL, true, false, 7),
('Lottery ticket dispensers stocked and functioning', 'C_STORE', 'C-Store — D. Sales Floor', NULL, true, false, 8),
('Windows and entry doors clean and free of clutter', 'C_STORE', 'C-Store — D. Sales Floor', NULL, true, false, 9),

-- E. Coolers & Refrigerated Cases -----------------------------------
('All refrigerated display units within required temperature range', 'C_STORE', 'C-Store — E. Coolers & Refrigerated Cases',
 'Cooler cases 34-41F (1-5C). Anything outside range: move product to a working unit, log it, and report the fault before stocking continues.', true, true, 1),
('Freezer temperature at or below 0F (-18C)', 'C_STORE', 'C-Store — E. Coolers & Refrigerated Cases', NULL, true, true, 2),
('Temperature log completed and recorded for this shift', 'C_STORE', 'C-Store — E. Coolers & Refrigerated Cases', NULL, true, true, 3),
('Coolers stocked with priority never-out items', 'C_STORE', 'C-Store — E. Coolers & Refrigerated Cases', NULL, true, false, 4),
('Product rotated with the nearest expiry date at the front', 'C_STORE', 'C-Store — E. Coolers & Refrigerated Cases', NULL, true, false, 5),
('No expired or damaged product in the cooler', 'C_STORE', 'C-Store — E. Coolers & Refrigerated Cases', NULL, true, true, 6),
('Cooler doors close and seal properly, gaskets undamaged', 'C_STORE', 'C-Store — E. Coolers & Refrigerated Cases', NULL, true, false, 7),
('Cooler lighting fully functional', 'C_STORE', 'C-Store — E. Coolers & Refrigerated Cases', NULL, true, false, 8),

-- F. Food Service & Hot Case ----------------------------------------
('Hot holding at or above 135F (57C)', 'C_STORE', 'C-Store — F. Food Service & Hot Case',
 'Probe the hot case and roller grill rather than trusting the dial. Anything below the threshold for an unknown period is discarded, not reheated.', true, true, 1),
('Roller grill operational, at temperature and stocked to planogram', 'C_STORE', 'C-Store — F. Food Service & Hot Case', NULL, true, false, 2),
('Hot food labeled with product name, cook time and expiry time', 'C_STORE', 'C-Store — F. Food Service & Hot Case', NULL, true, true, 3),
('Food past its holding time discarded and logged', 'C_STORE', 'C-Store — F. Food Service & Hot Case', NULL, true, true, 4),
('Food service surface temperatures recorded and in range', 'C_STORE', 'C-Store — F. Food Service & Hot Case', NULL, true, true, 5),
('Coffee and hot beverage station stocked, clean and operational', 'C_STORE', 'C-Store — F. Food Service & Hot Case', NULL, true, false, 6),
('Fountain station stocked, nozzles clean, ice available', 'C_STORE', 'C-Store — F. Food Service & Hot Case', NULL, true, false, 7),
('Food service equipment (fryers, warmers, microwaves) operating correctly', 'C_STORE', 'C-Store — F. Food Service & Hot Case', NULL, true, false, 8),
('Gloves, tongs and food-handling tools available at every station', 'C_STORE', 'C-Store — F. Food Service & Hot Case', NULL, true, true, 9),
('Expiration dates checked and out-of-date stock pulled', 'C_STORE', 'C-Store — F. Food Service & Hot Case', NULL, true, true, 10),

-- G. Restrooms ------------------------------------------------------
('Restrooms cleaned and signed off for this shift', 'C_STORE', 'C-Store — G. Restrooms', NULL, true, false, 1),
('Soap, paper towels and toilet tissue stocked', 'C_STORE', 'C-Store — G. Restrooms', NULL, true, false, 2),
('All fixtures functioning (toilets, sinks, hand dryers)', 'C_STORE', 'C-Store — G. Restrooms', NULL, true, false, 3),
('Restroom floors dry and free of standing water', 'C_STORE', 'C-Store — G. Restrooms', NULL, true, true, 4),
('Handwashing signage posted and visible', 'C_STORE', 'C-Store — G. Restrooms', NULL, true, false, 5),
('Exhaust fan working and restroom free of odor', 'C_STORE', 'C-Store — G. Restrooms', NULL, true, false, 6),

-- H. Checkout & Cash Handling ---------------------------------------
('All POS terminals and card readers operational', 'C_STORE', 'C-Store — H. Checkout & Cash Handling', NULL, true, false, 1),
('Cash drawer counted and opening float confirmed', 'C_STORE', 'C-Store — H. Checkout & Cash Handling', NULL, true, true, 2),
('Receipt paper stocked at all registers', 'C_STORE', 'C-Store — H. Checkout & Cash Handling', NULL, true, false, 3),
('Lottery terminals operational and ticket inventory confirmed', 'C_STORE', 'C-Store — H. Checkout & Cash Handling', NULL, true, true, 4),
('Tobacco display locked, compliant and correctly priced', 'C_STORE', 'C-Store — H. Checkout & Cash Handling', NULL, true, true, 5),
('Age-restricted product signage posted at all relevant displays', 'C_STORE', 'C-Store — H. Checkout & Cash Handling', NULL, true, true, 6),
('Register security camera active and unobstructed', 'C_STORE', 'C-Store — H. Checkout & Cash Handling', NULL, true, true, 7),
('Loyalty and promotional signage at checkout current', 'C_STORE', 'C-Store — H. Checkout & Cash Handling', NULL, true, false, 8),

-- I. Age Verification & Compliance ----------------------------------
('All staff on shift have completed age verification training', 'C_STORE', 'C-Store — I. Age Verification & Compliance', NULL, true, true, 1),
('Challenge policy and minimum age signage posted at checkout', 'C_STORE', 'C-Store — I. Age Verification & Compliance', NULL, true, true, 2),
('Previous shift age verification log reviewed by the manager', 'C_STORE', 'C-Store — I. Age Verification & Compliance', NULL, true, true, 3),
('Alcohol display complies with local placement and signage rules', 'C_STORE', 'C-Store — I. Age Verification & Compliance', NULL, true, true, 4),
('Tobacco stored and displayed per applicable regulations', 'C_STORE', 'C-Store — I. Age Verification & Compliance', NULL, true, true, 5),
('Every age-restricted sale this shift was ID-checked and logged', 'C_STORE', 'C-Store — I. Age Verification & Compliance',
 'A single unchallenged sale to a minor can cost the licence. If in any doubt about age, ask for ID; if still in doubt, refuse the sale and log it.', true, true, 6),

-- J. Safety & Security ----------------------------------------------
('Surveillance cameras operational and covering all required areas', 'C_STORE', 'C-Store — J. Safety & Security', NULL, true, true, 1),
('Recording system active with no error messages', 'C_STORE', 'C-Store — J. Safety & Security', NULL, true, true, 2),
('Safe balance verified and recorded by the shift manager', 'C_STORE', 'C-Store — J. Safety & Security', NULL, true, true, 3),
('Fire extinguishers present, unobstructed and in service date', 'C_STORE', 'C-Store — J. Safety & Security', NULL, true, true, 4),
('Emergency exits unobstructed and exit signage illuminated', 'C_STORE', 'C-Store — J. Safety & Security', NULL, true, true, 5),
('First aid kit stocked and accessible', 'C_STORE', 'C-Store — J. Safety & Security', NULL, true, true, 6),
('Emergency contact list and incident forms accessible to all staff', 'C_STORE', 'C-Store — J. Safety & Security', NULL, true, false, 7),
('Panic button / duress alarm functional', 'C_STORE', 'C-Store — J. Safety & Security',
 'Test to the local schedule rather than every shift, and notify the monitoring company before testing so it is not treated as a live alarm.', true, true, 8),

-- K. Shift Handover -------------------------------------------------
('Incident log and open issues from the previous shift reviewed', 'C_STORE', 'C-Store — K. Shift Handover', NULL, true, false, 1),
('Open maintenance issues documented and reported', 'C_STORE', 'C-Store — K. Shift Handover', NULL, true, false, 2),
('Stock orders and deliveries expected this shift confirmed', 'C_STORE', 'C-Store — K. Shift Handover', NULL, true, false, 3),
('Outgoing manager has briefed the incoming manager', 'C_STORE', 'C-Store — K. Shift Handover', NULL, true, false, 4),
('All shift documentation complete and filed', 'C_STORE', 'C-Store — K. Shift Handover',
 'Temperature logs, age verification log and cash count all completed and filed before handover is signed.', true, true, 5),
('Stockroom tidy and deliveries put away', 'C_STORE', 'C-Store — K. Shift Handover', NULL, true, false, 6),
('Break room clean', 'C_STORE', 'C-Store — K. Shift Handover', NULL, true, false, 7),

-- L. Cleaning: Every Shift ------------------------------------------
('Spills spot-mopped and wet floor signs placed', 'C_STORE', 'C-Store — L. Cleaning: Every Shift', NULL, true, true, 1),
('Door handles, card readers, pin pads and counters wiped', 'C_STORE', 'C-Store — L. Cleaning: Every Shift', NULL, true, false, 2),
('Trash at registers and food areas emptied before overflow', 'C_STORE', 'C-Store — L. Cleaning: Every Shift', NULL, true, false, 3),
('Restroom soap, towels and tissue restocked; high-touch points wiped', 'C_STORE', 'C-Store — L. Cleaning: Every Shift', NULL, true, false, 4),
('Forecourt inspected for hazards, litter picked, squeegee fluid replaced', 'C_STORE', 'C-Store — L. Cleaning: Every Shift', NULL, true, false, 5),

-- M. Cleaning: Daily Close ------------------------------------------
('Sales floor shelves dusted, faced and glass cleaned; floors damp-mopped', 'C_STORE', 'C-Store — M. Cleaning: Daily Close', NULL, true, false, 1),
('Entry doors, frames and glass cleaned inside and out', 'C_STORE', 'C-Store — M. Cleaning: Daily Close', NULL, true, false, 2),
('Restroom fixtures, partitions and touch points disinfected; floors mopped', 'C_STORE', 'C-Store — M. Cleaning: Daily Close',
 'Apply disinfectant and respect the label dwell time — wiping it straight off does not disinfect. Mop from the far corner toward the door.', true, false, 3),
('Food and coffee surfaces, brewers, nozzles and drip trays sanitized', 'C_STORE', 'C-Store — M. Cleaning: Daily Close',
 'Food-contact surfaces are washed, rinsed, then sanitized and left to air dry. Use only food-safe products on prep surfaces.', true, true, 4),
('Cooler gaskets, handles and glass wiped; expired product removed', 'C_STORE', 'C-Store — M. Cleaning: Daily Close', NULL, true, false, 5),
('Forecourt trash removed, pump handles and keypads wiped, spill pads cleaned', 'C_STORE', 'C-Store — M. Cleaning: Daily Close', NULL, true, false, 6),
('Back room mopped, mop sink cleaned, chemicals stored correctly', 'C_STORE', 'C-Store — M. Cleaning: Daily Close',
 'Chemicals are never stored near food or food packaging, and secondary containers must be labelled.', true, true, 7),

-- N. Cleaning: Weekly -----------------------------------------------
('Vents, lights and top shelves high-dusted', 'C_STORE', 'C-Store — N. Cleaning: Weekly', NULL, true, false, 1),
('Floors machine-scrubbed or deep-mopped including edges and grout', 'C_STORE', 'C-Store — N. Cleaning: Weekly', NULL, true, false, 2),
('Behind hot cases, roller grills and fryers degreased', 'C_STORE', 'C-Store — N. Cleaning: Weekly',
 'Grease behind hot equipment is a fire risk, not just a cleanliness issue.', true, true, 3),
('Curb lines and walkways pressure-rinsed or scrubbed', 'C_STORE', 'C-Store — N. Cleaning: Weekly', NULL, true, false, 4),
('Drain pans, floor drains and odor control checked', 'C_STORE', 'C-Store — N. Cleaning: Weekly', NULL, true, false, 5),
('Beverage dispenser cleaning cycle run per manufacturer guidance', 'C_STORE', 'C-Store — N. Cleaning: Weekly', NULL, true, false, 6),
('Cooler shelf edges and price rails cleaned; date codes checked', 'C_STORE', 'C-Store — N. Cleaning: Weekly', NULL, true, false, 7),

-- O. Cleaning: Monthly & Quarterly -----------------------------------
('Forecourt and canopy posts power-washed; pump bases and bollards cleaned', 'C_STORE', 'C-Store — O. Cleaning: Monthly & Quarterly', NULL, true, false, 1),
('Finished floors stripped and recoated if required', 'C_STORE', 'C-Store — O. Cleaning: Monthly & Quarterly', NULL, true, false, 2),
('Cooler coils and fan guards cleaned; racks detailed', 'C_STORE', 'C-Store — O. Cleaning: Monthly & Quarterly', NULL, true, false, 3),
('Caulk and grout in restrooms and food areas inspected and repaired', 'C_STORE', 'C-Store — O. Cleaning: Monthly & Quarterly', NULL, true, false, 4),
('Chemical inventory reviewed, damaged tools replaced, training refreshed', 'C_STORE', 'C-Store — O. Cleaning: Monthly & Quarterly', NULL, true, false, 5),
('Safety Data Sheet binder current and accessible', 'C_STORE', 'C-Store — O. Cleaning: Monthly & Quarterly', NULL, true, true, 6);
