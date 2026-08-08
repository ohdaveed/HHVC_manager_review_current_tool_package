# SFDPH Environmental Health Branch — Fee Schedule (rates effective 7/1/26–6/30/27)

- **Original file:** `FY27_Website_Fees (1).cleaned.pdf` (provided directly, not yet confirmed as a live SF.gov URL)
- **Source title:** Department of Public Health - Environmental Health Branch — Fee Schedule, Application, License, and Other Fees
- **Authority:** SFDPH Environmental Health Branch (Controller-adjusted fees under Health Code Sec. 609.2)
- **Export date:** 2026-07-06
- **Format:** md (PDF extract)
- **Reviewer:** confirmed current by program staff (2026-07-06)
- **Phase used:** Current source of truth for `payFee`, `noticeOfViolation`, and `afterReport` fee figures, superseding `2026-07-06-dph-ehb-fee-schedule-fy25-26.md` now that FY 2026–27 is the active fiscal year.

---

## Healthy Housing Program — Apartment Buildings (rates effective 7/1/26–6/30/27)

| Number of rental units | Fee per building per year |
| --- | --- |
| 3 | $103 |
| 4–6 | $129 |
| 7–10 | $175 |
| 11–15 | $350 |
| 16–20 | $485 |
| 21–30 | $688 |
| Over 30 | $808 |

## Healthy Housing reinspection fees

- Reinspection by environmental health inspector, per hour: $256
- Reinspection by environmental health technician, per hour: $234
- Additional fee for reinspections requiring more than one hour — each additional half hour: $128 (inspector) / $115 (technician)

## Late payment penalty

- $10 after 30 days
- $30 after 60 days
- (Interest rate not restated on this Healthy Housing line item; see the Refuse Lien Program section of the same PDF, which states interest accrues at 1.5% per month from date of recordation — applied citywide by EHB to unpaid balances, consistent with the FY25-26 schedule.)

## Note on prior "unsourced FY27" flag

`2026-07-06-dph-ehb-fee-schedule-fy25-26.md`'s "Corrects" section previously stated that an apartment-building tier table ($103/$129/$174/$350/$485/$688/$808) and hourly rates ($256/$234) appearing in `notebooklm/hhvc-standards-manual.md` and `pages/pay-healthy-housing-fee.js` were "unsourced" and did not match any certified schedule found at that time (2026-07-06 export). This document is that certified schedule — it confirms those figures were accurate FY 2026–27 data, not fabricated. The earlier correction to the FY25-26 rates ($101/$127/$171/$343/$475/$673/$791 and $251/$229) was itself correct **for FY25-26**; both schedules are/were accurate for their respective fiscal years. Mockup pages should now use the FY26-27 figures on this page, since FY 2026-27 is the current fiscal year (rates effective 7/1/26 per this schedule).

## Note on 7-10 unit tier ($174 vs. $175)

This document's own PDF source states $174 for the 7-10 rental unit apartment tier, and `2026-07-07-fy27-website-fees.pdf` is byte-identical to it (same file, exported twice one day apart — not an independent second confirmation, despite the different filename). A Controller's Office FY26-27 fee-adjustment table (`2026-08-07-controllers-office-fy26-27-fee-adjustment-healthy-housing.png`/`.md`, provided 2026-08-07) shows every other apartment-building tier matching this document exactly, but computes 7-10 units as unrounded $174.50 rounding to **$175.00** — consistent with the same annual Controller-certification series whose FY25-26 figures this repo already treats as confirmed (`2026-07-02-controller-fee-certification-fy25-26.md`, $171 rounded for the same tier that year). Given every other line item agrees between the two FY26-27 sources, the single disagreeing cell most plausibly means this document's worksheet PDF has not been updated to reflect that cycle's Controller adjustment — but that is inference, not a confirmed correction. `pages/pay-healthy-housing-fee.js` currently shows $175 for this tier, flagged `unverified` pending an HHVC/DPH-EHB confirmation of which figure is actually billed.

## Does not cover

- Non-Healthy-Housing EHB program fees (food, hazardous materials, massage, tattoo, etc. — present in the full PDF but out of HHVC scope)
