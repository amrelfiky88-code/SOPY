-- Restaurant Health Code Compliance Requirements, imported from the
-- client's regulatory reference content (critical vs. non-critical
-- violation categories per FDA Food Code, inspection frequency, and
-- required certifications). Unlike SOP 1-20, this document isn't a
-- procedure for staff to follow step by step - it's a reference for
-- what health inspectors actually cite, which mostly VALIDATES the
-- is_critical choices already made across the library rather than
-- introducing new content:
--
--   temperature, handwashing, cross-contamination, illness policy,
--   labeling/dating, and (in SOP 11) pest evidence were already
--   critical; insufficient lighting, torn gaskets, equipment disrepair,
--   and chemicals-near-food were already non-critical.
--
-- Three genuinely distinct, currently-uncovered critical checkpoints
-- from this list are added here rather than silently retrofitted into
-- existing items (which would mean overriding a client-authored
-- critical flag from an earlier transcription with our own judgment -
-- not done):
--
--   - "Food from unapproved sources" is a named critical violation in
--     its own right, distinct from SOP 3's broader delivery-acceptance
--     procedure (which only mentions vendor approval as one detail in a
--     non-critical item's description).
--   - "Bare hand contact with ready-to-eat food" (must use gloves,
--     tongs, or deli paper) is a specific, named FDA Food Code
--     violation not covered by the existing glove-use or handwashing
--     items, which are about hygiene practice rather than this
--     particular contact rule.
--   - "No water supply or sewage backup" isn't covered anywhere in the
--     library.
--
-- The "Food Manager Certification" requirement (at least one certified
-- manager on-site during all operating hours) is also added as a daily-
-- verifiable checkpoint, distinct from the existing "certificates
-- posted" documentation item.
--
-- NOTE: actual per-employee certification expiry tracking (ServSafe
-- renewal every 3-5 years, food handler cards every 2-3 years) is not
-- built as a feature here - this only adds the checklist item. Tracking
-- individual certification expiry dates with renewal reminders would be
-- a genuinely new feature, not something to build silently as a side
-- effect of a content import.

INSERT INTO checklist_items (text, standard, category, description, requires_photo, is_critical, sort_order) VALUES

('Food received only from approved, licensed suppliers', 'SOP', 'Health Code Compliance — Critical Violation Checkpoints',
 'Accept deliveries only from approved, licensed vendors. Food from an unapproved source is a critical health code violation on its own, regardless of how the delivery itself looks or tastes.',
 false, true, 1),

('No bare hand contact with ready-to-eat food', 'SOP', 'Health Code Compliance — Critical Violation Checkpoints',
 'Ready-to-eat food (anything served without further cooking) must be handled with gloves, tongs, deli paper, or other utensils - never bare hands, even freshly washed ones. This is a distinct, commonly cited critical violation separate from general handwashing practice.',
 false, true, 2),

('Water supply and sewage systems functioning normally', 'SOP', 'Health Code Compliance — Critical Violation Checkpoints',
 'Confirm there is no loss of water supply and no sewage backup anywhere on the premises. Either condition is a critical violation with immediate-closure risk.',
 false, true, 3),

('Certified food manager on-site during all operating hours', 'SOP', 'Health Code Compliance — Critical Violation Checkpoints',
 'At least one staff member holding a current food manager certification (ServSafe or the local equivalent) must be present on-site during every hour of operation, not just scheduled to be.',
 false, true, 4);
