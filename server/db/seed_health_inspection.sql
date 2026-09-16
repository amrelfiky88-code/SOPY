-- Health Inspection and Compliance, imported from the client's SOP
-- content (SOP 11: Daily Health Inspection Readiness). Continues the
-- 'SOP' standard, but structured differently from SOP 1-10:
--
-- The "Daily Checklist" portion lists, under each of 7 categories,
-- several INDEPENDENT parallel facts to verify (e.g. under Temperature
-- Monitoring: fridge temps, cooking temps, holding temps, and log
-- completeness are four separate things, not four sequential steps of
-- one task). That's the same shape as the original Daily QC Checklist
-- (QC-D-001), not the sequential-procedure shape of SOP 1-10 — so each
-- bullet became its own checklist item here, same as the QC import, with
-- no `description` needed since the item text is already the complete
-- checkpoint.
--
-- "When Inspector Arrives" IS a sequential response procedure (greet ->
-- verify ID -> notify manager -> ... -> address violations), so it gets
-- the SOP 1-10 treatment instead: the 12 source steps bundled into 6
-- logical checkpoints with the detail captured in `description`.
--
-- is_critical follows the precedent set across every earlier import for
-- the same underlying concept (e.g. raw-meat segregation, FIFO, and
-- labeling were critical in the Daily QC Checklist, so they're critical
-- here too) plus this document's own emphasis (manager notification
-- "even if in middle of rush", "never lie or hide issues", "immediately
-- address any critical violations").

INSERT INTO checklist_items (text, standard, category, requires_photo, is_critical, sort_order) VALUES

-- 1. Temperature Monitoring (4)
('All refrigerator/freezer temps recorded and within range', 'SOP', 'SOP 11: Health Inspection Readiness — 1. Temperature Monitoring', false, true, 1),
('Food cooking temps documented', 'SOP', 'SOP 11: Health Inspection Readiness — 1. Temperature Monitoring', false, true, 2),
('Hot/cold holding temps checked every 2 hours', 'SOP', 'SOP 11: Health Inspection Readiness — 1. Temperature Monitoring', false, true, 3),
('Temperature logs complete and up-to-date', 'SOP', 'SOP 11: Health Inspection Readiness — 1. Temperature Monitoring', false, false, 4),

-- 2. Food Storage (6)
('All food covered and properly stored', 'SOP', 'SOP 11: Health Inspection Readiness — 2. Food Storage', true, false, 1),
('Raw meats on bottom shelves, away from ready-to-eat', 'SOP', 'SOP 11: Health Inspection Readiness — 2. Food Storage', true, true, 2),
('All items labeled and dated', 'SOP', 'SOP 11: Health Inspection Readiness — 2. Food Storage', true, true, 3),
('Food stored 6 inches off floor', 'SOP', 'SOP 11: Health Inspection Readiness — 2. Food Storage', true, false, 4),
('FIFO rotation being followed', 'SOP', 'SOP 11: Health Inspection Readiness — 2. Food Storage', false, true, 5),
('No expired food in storage', 'SOP', 'SOP 11: Health Inspection Readiness — 2. Food Storage', false, true, 6),

-- 3. Personal Hygiene (6)
('All staff in clean uniforms', 'SOP', 'SOP 11: Health Inspection Readiness — 3. Personal Hygiene', false, false, 1),
('Hair properly restrained', 'SOP', 'SOP 11: Health Inspection Readiness — 3. Personal Hygiene', false, false, 2),
('No jewelry except plain wedding band', 'SOP', 'SOP 11: Health Inspection Readiness — 3. Personal Hygiene', false, false, 3),
('Nails short and clean', 'SOP', 'SOP 11: Health Inspection Readiness — 3. Personal Hygiene', false, false, 4),
('Gloves being changed appropriately', 'SOP', 'SOP 11: Health Inspection Readiness — 3. Personal Hygiene', false, true, 5),
('Handwashing being done properly and frequently', 'SOP', 'SOP 11: Health Inspection Readiness — 3. Personal Hygiene', false, true, 6),

-- 4. Cleaning and Sanitation (6)
('All work surfaces clean and sanitized', 'SOP', 'SOP 11: Health Inspection Readiness — 4. Cleaning & Sanitation', true, false, 1),
('Sanitizer buckets at proper concentration (test with strips)', 'SOP', 'SOP 11: Health Inspection Readiness — 4. Cleaning & Sanitation', false, false, 2),
('No dirty dishes accumulating', 'SOP', 'SOP 11: Health Inspection Readiness — 4. Cleaning & Sanitation', true, false, 3),
('Dishwasher reaching proper temperature', 'SOP', 'SOP 11: Health Inspection Readiness — 4. Cleaning & Sanitation', false, true, 4),
('Floors clean, no spills', 'SOP', 'SOP 11: Health Inspection Readiness — 4. Cleaning & Sanitation', true, false, 5),
('Drains clear, no standing water', 'SOP', 'SOP 11: Health Inspection Readiness — 4. Cleaning & Sanitation', true, false, 6),

-- 5. Equipment Maintenance (5)
('All equipment in good repair', 'SOP', 'SOP 11: Health Inspection Readiness — 5. Equipment Maintenance', false, false, 1),
('No duct tape or temporary fixes visible', 'SOP', 'SOP 11: Health Inspection Readiness — 5. Equipment Maintenance', true, false, 2),
('Gaskets on coolers/freezers intact', 'SOP', 'SOP 11: Health Inspection Readiness — 5. Equipment Maintenance', true, false, 3),
('Can openers clean (not rusty)', 'SOP', 'SOP 11: Health Inspection Readiness — 5. Equipment Maintenance', true, false, 4),
('Cutting boards in good condition (not scored/stained)', 'SOP', 'SOP 11: Health Inspection Readiness — 5. Equipment Maintenance', true, false, 5),

-- 6. Facility Conditions (6)
('No evidence of pests (droppings, damage)', 'SOP', 'SOP 11: Health Inspection Readiness — 6. Facility Conditions', true, true, 1),
('Trash cans covered with lids', 'SOP', 'SOP 11: Health Inspection Readiness — 6. Facility Conditions', true, false, 2),
('Back door kept closed when not in use', 'SOP', 'SOP 11: Health Inspection Readiness — 6. Facility Conditions', false, false, 3),
('No holes in walls or ceilings', 'SOP', 'SOP 11: Health Inspection Readiness — 6. Facility Conditions', true, false, 4),
('Proper lighting in all areas', 'SOP', 'SOP 11: Health Inspection Readiness — 6. Facility Conditions', false, false, 5),
('Hand sinks stocked (soap, towels)', 'SOP', 'SOP 11: Health Inspection Readiness — 6. Facility Conditions', true, false, 6),

-- 7. Documentation (5)
('Temperature logs complete', 'SOP', 'SOP 11: Health Inspection Readiness — 7. Documentation', false, false, 1),
('Cleaning checklists completed and signed', 'SOP', 'SOP 11: Health Inspection Readiness — 7. Documentation', false, false, 2),
('Employee health policy posted', 'SOP', 'SOP 11: Health Inspection Readiness — 7. Documentation', false, false, 3),
('Food handler certificates current and posted', 'SOP', 'SOP 11: Health Inspection Readiness — 7. Documentation', true, true, 4),
('Permits current and properly displayed', 'SOP', 'SOP 11: Health Inspection Readiness — 7. Documentation', true, true, 5);

INSERT INTO checklist_items (text, standard, category, description, requires_photo, is_critical, sort_order) VALUES

-- 8. When Inspector Arrives (6, bundled from the source's 12 sequential steps)
('Inspector greeted and identification verified', 'SOP', 'SOP 11: Health Inspection Readiness — 8. When Inspector Arrives',
 'Greet the inspector professionally ("Good morning" / "Good afternoon"), then request and verify identification.',
 false, false, 1),

('Manager notified immediately of inspector arrival', 'SOP', 'SOP 11: Health Inspection Readiness — 8. When Inspector Arrives',
 'Notify the manager right away, even if it is in the middle of a rush.',
 false, true, 2),

('Inspector accompanied and assisted throughout', 'SOP', 'SOP 11: Health Inspection Readiness — 8. When Inspector Arrives',
 'Offer to answer questions, accompany the inspector throughout the visit taking notes, and ask for clarification if a violation is not understood.',
 false, false, 3),

('Honest, professional conduct maintained with inspector', 'SOP', 'SOP 11: Health Inspection Readiness — 8. When Inspector Arrives',
 'Answer honestly - never lie or hide issues - and do not argue or become defensive if issues are found.',
 false, true, 4),

('Inspection report reviewed, signed, and copy obtained', 'SOP', 'SOP 11: Health Inspection Readiness — 8. When Inspector Arrives',
 'Review the report before the inspector leaves and sign it (signing does not mean you agree, only that you saw it), then request a copy.',
 false, false, 5),

('Critical violations addressed immediately', 'SOP', 'SOP 11: Health Inspection Readiness — 8. When Inspector Arrives',
 'Any critical violations found during the inspection must be corrected immediately, not scheduled for later.',
 false, true, 6);
