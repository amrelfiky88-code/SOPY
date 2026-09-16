-- Cash Handling and Financial Procedures, imported from the client's SOP
-- content (SOP 10: Cash Handling and POS Procedures). Continues the
-- 'SOP' standard and category convention from SOP 1-9.
--
-- Like SOP 4 (temperature monitoring), this is a domain that's almost
-- entirely critical by nature: cash handling is one of the two or three
-- places fraud and theft actually happen in a restaurant, and the source
-- document's own tone reflects that (ending on "pattern of shortages may
-- result in termination"). Only the starting-drawer setup step is a
-- baseline/administrative task rather than a fraud-detection or
-- fraud-prevention point, matching the same setup-vs-verification
-- distinction used for the Weekly Audit's W1/W2 sections.
--
-- "Cash Handling Security" isn't a numbered phase in the source (it's a
-- short list of standing rules after the 6 numbered steps), but same as
-- SOP 9's Compensation Guidelines, it's genuine actionable guidance, so
-- it became a 7th item here.

INSERT INTO checklist_items (text, standard, category, description, requires_photo, is_critical, sort_order) VALUES

('Starting cash drawer counted and verified', 'SOP', 'SOP 10: Cash Handling — 1. Starting Cash Drawer',
 'Count the starting bank in front of a manager (standard bank guidance: $100-$200 in small bills with a limited number of $20s and no $50s or $100s, plus a full set of coins - adjust per restaurant). Both you and the manager sign the starting count form, keep a copy, and return the bank to your assigned till.',
 false, false, 1),

('Cash payments processed correctly', 'SOP', 'SOP 10: Cash Handling — 2. Processing Cash Payments',
 'Enter the amount due in the POS first and announce it to the guest. Accept payment and announce the amount received ("Out of $60"). Let the POS calculate change due, then count the change back to the guest starting from the bill amount and counting up to what they gave you - hand it directly to the guest rather than counting it into your own hand first.',
 false, true, 2),

('Credit card payments processed correctly', 'SOP', 'SOP 10: Cash Handling — 3. Processing Credit Cards',
 'Take the card, swipe/insert/tap as appropriate, and if declined discreetly ask for an alternative payment. Print both merchant and customer receipts, present them for signature or approval, verify the signature matches the card if signed, and return the card and customer copy immediately - never walk away with a guest''s card. Keep the merchant copy for end-of-day reconciliation.',
 false, true, 3),

('Large bills checked for authenticity', 'SOP', 'SOP 10: Cash Handling — 4. Handling Large Bills',
 'Check $50 and $100 bills by holding to light and checking the watermark and security thread, or with a counterfeit detection pen if provided. If a bill looks suspicious, politely ask for an alternative payment and notify the manager. If the till does not have enough change, get change from the manager or safe before completing the transaction.',
 false, true, 4),

('Till drop completed and documented', 'SOP', 'SOP 10: Cash Handling — 5. Till Drops',
 'When cash in the drawer exceeds $200-300, remove the excess (keeping enough for making change), count what is being dropped, and fill out a till drop envelope with your name, till number, date, time, and amount. Seal it, drop it in the safe immediately, and keep a copy of the drop slip.',
 false, true, 5),

('Cash drawer closed and reconciled', 'SOP', 'SOP 10: Cash Handling — 6. Closing Cash Drawer',
 'Run the end-of-shift report from the POS and count all cash in the drawer by denomination, writing subtotals on the count sheet. Compare the total to the POS report (starting bank plus cash sales minus till drops) - a small variance of $1-2 is acceptable, but a large variance must be recounted and investigated. Sign the count sheet, have the manager verify and sign it, note any overage or shortage, remove the starting bank for the next shift, and prepare the remaining cash for deposit.',
 false, true, 6),

('Cash handling security rules followed', 'SOP', 'SOP 10: Cash Handling — 7. Cash Handling Security',
 'Never leave the cash drawer open and unattended, and close it between transactions. Do not share your POS login or password. Report discrepancies immediately rather than waiting, and never loan money to coworkers from the till. A pattern of shortages may result in termination.',
 false, true, 7);
