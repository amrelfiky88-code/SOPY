-- Customer Service and Front-of-House Procedures, imported from the
-- client's SOP content (SOP 6: Guest Greeting and Seating, SOP 7: Order
-- Taking and POS Entry, SOP 8: Food Running and Service, SOP 9: Handling
-- Customer Complaints). Continues the 'SOP' standard and "SOP N: Name -
-- phase" category convention established for SOP 1-5.
--
-- Most of this content is hospitality/service-quality guidance rather
-- than a compliance checkpoint, so is_critical stays false for nearly
-- all of it — the two exceptions are the ones the source document itself
-- singles out as a genuine safety/escalation trigger: the allergy alert
-- in SOP 7 (explicitly labeled "(Critical)" in the source, and an actual
-- anaphylaxis risk if mishandled) and the "involve a manager" step in
-- SOP 9 that gates on food safety, illness, or injury complaints.
--
-- SOP 9's "Compensation Guidelines" isn't a numbered phase in the source
-- (it's a small reference table after the 7 numbered steps), but it's
-- genuine actionable guidance a server needs in the moment, so it became
-- an 8th item here rather than being dropped.

INSERT INTO checklist_items (text, standard, category, description, requires_photo, is_critical, sort_order) VALUES

-- SOP 6: Guest Greeting and Seating (7)
('Guest greeted within 30 seconds of entry', 'SOP', 'SOP 6: Greeting & Seating — 1. Greeting',
 'Make eye contact and smile. Greet warmly ("Welcome to [Restaurant Name]!"). If busy, say "We''ll be right with you" and acknowledge their presence.',
 false, false, 1),

('Party assessed and reservation checked', 'SOP', 'SOP 6: Greeting & Seating — 2. Party Assessment',
 'Ask how many are in the party. Note any special needs (high chair or booster, wheelchair accessibility, booth vs. table preference) and check for a reservation.',
 false, false, 2),

('Wait managed correctly when no tables available', 'SOP', 'SOP 6: Greeting & Seating — 3. Wait Management',
 'Give an honest wait-time estimate, offer to add the guest''s name to the waitlist, and explain the wait process. Suggest bar seating if available, and update the guest every 10 minutes if the wait runs over estimate.',
 false, false, 3),

('Table selected appropriately', 'SOP', 'SOP 6: Greeting & Seating — 4. Table Selection',
 'Assign to the server with the lightest section when possible. Avoid seating large parties near small tables, seat families with children away from business diners, and rotate sections fairly among servers.',
 false, false, 4),

('Guest seated properly', 'SOP', 'SOP 6: Greeting & Seating — 5. Seating',
 'Walk at the guest''s pace, looking back to confirm they are following. Pull out chairs if appropriate, present a menu to each guest, remove extra place settings if the party is smaller than the table setup, and bring high chairs or boosters immediately.',
 false, false, 5),

('Server notified of new table', 'SOP', 'SOP 6: Greeting & Seating — 6. Server Notification',
 'Inform the server ("Table 12 is seated"), note any special requests or needs, and update the seating chart or system.',
 false, false, 6),

('Server greeted the table within 1-2 minutes', 'SOP', 'SOP 6: Greeting & Seating — 7. Server Greeting',
 'Approach with a smile, introduce yourself by name, offer beverages, and briefly mention specials or note that you will return to discuss them.',
 false, false, 7),

-- SOP 7: Order Taking and POS Entry (7)
('Beverages returned within 3-5 minutes', 'SOP', 'SOP 7: Order Taking & POS — 1. Return with Beverages',
 'Deliver drinks from the guest''s right side with your right hand, announcing each one as you place it. Ask if guests are ready to order or need more time; if they need time, let them know you will check back shortly.',
 false, false, 1),

('Order taken correctly', 'SOP', 'SOP 7: Order Taking & POS — 2. Taking Orders',
 'Stand to the side of the table, not hovering, and take orders in a logical order. Write seat numbers to ensure correct delivery later, and record each guest''s starter, main course with temperature if applicable, sides, and any modifications or allergies.',
 false, false, 2),

('Key clarifying questions asked', 'SOP', 'SOP 7: Order Taking & POS — 3. Key Questions',
 'Ask how items should be cooked, which side dishes are wanted, soup or salad if included, dressing choice for salads, and whether there is anything else needed.',
 false, false, 3),

('Allergy alert handled correctly', 'SOP', 'SOP 7: Order Taking & POS — 4. Allergy Alerts',
 'If a guest mentions an allergy, take it very seriously: write "ALLERGY" in large letters on the ticket, notify the kitchen manager immediately, verify ingredients do not contain the allergen, tell the guest if an item cannot be made safely, ensure a dedicated prep area and utensils are used, and communicate to everyone involved in the order.',
 false, true, 4),

('Upselling done appropriately', 'SOP', 'SOP 7: Order Taking & POS — 5. Upselling',
 'Suggest appetizers if none were ordered, recommend premium sides or add-ons, and mention desserts and specialty drinks - genuinely, not pushily.',
 false, false, 5),

('Order repeated back for accuracy', 'SOP', 'SOP 7: Order Taking & POS — 6. Repeat Order Back',
 'Briefly repeat each person''s order, confirm any modifications, and ask if everything was captured correctly.',
 false, false, 6),

('Order entered into POS immediately and correctly', 'SOP', 'SOP 7: Order Taking & POS — 7. POS Entry',
 'Enter all items accurately using modifier buttons for temperature, sides/options, substitutions, and special instructions, with allergies highlighted prominently. Assign items to the correct seat numbers, fire courses appropriately (appetizers first, mains delayed or fired via the course function), print the kitchen ticket, and verify it printed correctly before leaving the POS.',
 false, false, 7),

-- SOP 8: Food Running and Service (6)
('Food quality checked before leaving the kitchen', 'SOP', 'SOP 8: Food Running & Service — 1. When Food is Ready',
 'Respond promptly when the kitchen calls an order up. Check the ticket against the plates, and inspect presentation: proper portions, correct garnishes, clean plate rims, and correct temperature (hot food hot, cold food cold). If there is an issue, address it with the kitchen before taking the food to the table.',
 true, false, 1),

('Service tray loaded safely', 'SOP', 'SOP 8: Food Running & Service — 2. Tray Loading',
 'Place heavier items in the center and balance the tray''s weight evenly. Keep hot and cold items separate, confirm stability before lifting, and use a tray stand near the table.',
 false, false, 2),

('Table approached correctly', 'SOP', 'SOP 8: Food Running & Service — 3. Table Approach',
 'Approach from the guest''s right side and set the tray on a stand if used.',
 false, false, 3),

('Food delivered accurately and properly', 'SOP', 'SOP 8: Food Running & Service — 4. Food Delivery',
 'Announce each dish as you place it, using seat numbers from the order to confirm accuracy. Serve from the guest''s right with your right hand, never reaching across guests, and place the main protein at the 6 o''clock position. If unsure who ordered what, ask politely.',
 false, false, 4),

('Final delivery check completed', 'SOP', 'SOP 8: Food Running & Service — 5. Final Check',
 'Ask if there is anything else needed right now, verify condiments are on the table, refill water glasses, and wish the guests a good meal.',
 false, false, 5),

('Two-minute check-back performed', 'SOP', 'SOP 8: Food Running & Service — 6. Two-Minute Check-Back',
 'Return to the table after guests have had a couple of bites (roughly 2 minutes) and ask how everything is tasting. Address any issues immediately - refire for wrong temperature, reprioritize for an incorrect order, or remove and offer a replacement for a quality issue - and refill beverages as needed.',
 false, false, 6),

-- SOP 9: Handling Customer Complaints (8, including the compensation reference table)
('Complaint listened to actively', 'SOP', 'SOP 9: Complaint Handling — 1. Listen Actively',
 'Let the guest fully explain without interrupting, make eye contact and nod to show you are listening, do not get defensive or make excuses, and take the complaint seriously no matter how minor it seems.',
 false, false, 1),

('Empathy and apology given', 'SOP', 'SOP 9: Complaint Handling — 2. Empathize & Apologize',
 'Acknowledge the guest''s frustration and apologize - even if it was not your fault, you represent the restaurant.',
 false, false, 2),

('Clarifying questions asked', 'SOP', 'SOP 9: Complaint Handling — 3. Ask Clarifying Questions',
 'Make sure you fully understand the issue and ask what would make it right for the guest.',
 false, false, 3),

('Immediate action taken to resolve the issue', 'SOP', 'SOP 9: Complaint Handling — 4. Take Immediate Action',
 'For food issues: replace a wrong order at no charge as priority, recook undercooked or overcooked items immediately, reheat or remake cold food, or remove a quality issue from the bill and offer an alternative. For service issues: expedite remaining items (possibly comping an appetizer or dessert) for slow service, or apologize and correct a server error immediately.',
 false, false, 4),

('Manager involved when required', 'SOP', 'SOP 9: Complaint Handling — 5. Involve Manager',
 'Involve a manager for serious complaints (food safety, illness, or injury), when the guest remains unsatisfied after your attempts to resolve it, when a guest asks to speak with a manager, for requests of significant comps or refunds, or for complaints about other staff.',
 false, true, 5),

('Follow-up completed', 'SOP', 'SOP 9: Complaint Handling — 6. Follow Up',
 'Check back after the issue is resolved, provide extra attention for the rest of the meal, and thank the guest for the feedback.',
 false, false, 6),

('Significant complaint documented', 'SOP', 'SOP 9: Complaint Handling — 7. Documentation',
 'Log the date, time, nature of the complaint, and resolution in the daily log so the manager can review for patterns or training needs.',
 false, false, 7),

('Compensation guidelines followed', 'SOP', 'SOP 9: Complaint Handling — 8. Compensation Guidelines',
 'Minor issue (cold food, slow drink refill): free dessert or appetizer. Moderate issue (wrong order, long wait): comp the item that had the issue. Major issue (multiple problems, food safety): comp the entire meal or a significant discount. Always get manager approval for comps over $20.',
 false, false, 8);
