-- Master checkpoint library seed — global items (tenant_id NULL) that
-- every tenant can search/filter/assign from in the Checklist Builder.

INSERT INTO checklist_items (text, description, standard, category, requires_photo) VALUES
-- HACCP
('Fridge temperature within 1-4°C', 'Record temperature of each refrigeration unit', 'HACCP', 'temperature', false),
('Freezer temperature at or below -18°C', 'Record temperature of each freezer unit', 'HACCP', 'temperature', false),
('Cooked food held above 63°C (hot holding)', 'Check hot holding equipment temperature', 'HACCP', 'temperature', false),
('Incoming delivery temperature checked and logged', 'Verify chilled/frozen goods arrive within safe range', 'HACCP', 'receiving', false),
('Raw and ready-to-eat foods stored separately', 'Visual check of storage segregation', 'HACCP', 'hygiene', true),
('Hand-wash stations stocked with soap and towels', 'Check all hand-wash stations', 'HACCP', 'hygiene', true),
('Food labelled with prep and use-by date', 'Spot-check labelling in walk-in and prep fridges', 'HACCP', 'hygiene', true),
('Pest control traps checked, no signs of activity', 'Inspect trap stations', 'HACCP', 'hygiene', true),
('Waste bins covered and not overflowing', 'Check kitchen and external waste areas', 'HACCP', 'waste', true),
('Cleaning chemicals stored away from food items', 'Check chemical storage area', 'HACCP', 'hygiene', false),
-- ISO 22000
('Food safety hazard log reviewed for the shift', 'Confirm no unresolved hazards from previous shift', 'ISO_22000', 'hygiene', false),
('Critical control point records signed by supervisor', 'Verify CCP log has supervisor sign-off', 'ISO_22000', 'closing', false),
('Traceability records updated for received stock', 'Batch/lot numbers logged for new deliveries', 'ISO_22000', 'receiving', false),
('Staff food safety training records up to date', 'Check training log for the team on shift', 'ISO_22000', 'hygiene', false),
('Allergen matrix displayed and current', 'Confirm allergen chart matches current menu', 'ISO_22000', 'hygiene', true),
('Equipment calibration log up to date', 'Check thermometer/probe calibration dates', 'ISO_22000', 'equipment', false),
-- Local codes (generic starting set — tenants should add jurisdiction-specific items)
('Fire extinguisher inspection tag current', 'Check tag date on all extinguishers', 'LOCAL_CODE', 'equipment', true),
('Emergency exits unobstructed', 'Visual check of all marked exits', 'LOCAL_CODE', 'equipment', true),
('First aid kit stocked and accessible', 'Check contents against required list', 'LOCAL_CODE', 'hygiene', false),
('Food handler permits displayed/valid', 'Confirm current staff permits on file', 'LOCAL_CODE', 'hygiene', false);
