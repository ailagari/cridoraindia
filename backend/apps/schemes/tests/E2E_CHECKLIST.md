# Investment Schemes — Manual E2E Checklist

Prerequisite: enable **Investment schemes** (`golden_scheme`) in Admin → Control → Feature rollout.

## Admin

1. Open `/dashboard/admin?section=mkt_programs`.
2. Create a new draft (or from preset) → verify live preview updates in Designer.
3. Publish the draft → status becomes `published`.
4. Open a published scheme → confirm read-only banner; use **Duplicate as draft** to edit.
5. Deprecate a published scheme → status becomes `deprecated`; it disappears from jeweller catalog.
6. Delete a draft with no jeweller adoptions → removed from list.
7. (Optional) Approve/reject a jeweller scheme request on the Requests tab.

## Jeweller

1. Open `/dashboard/jeweller?section=mkt_schemes`.
2. Search/filter catalog → preview a scheme → **Select scheme**.
3. Adopt a second scheme → both appear under **Your offerings**.
4. Pause one offering → status `paused`; Resume restores `active`.
5. Withdraw an offering → status `withdrawn`; customers cannot enroll (active offerings only).

## Customer

1. Open `/userdashboard?section=invest_scheme`.
2. Select jeweller → enroll in two different schemes → both cards appear under **Active schemes**.
3. Select each card in turn → deposit form switches; OTP/UTR from one scheme does not appear on another.
4. Already-enrolled offerings are hidden from **Join a scheme**.
5. When a cycle completes (`plan_month_complete`), enrollment moves to **Awaiting bonus or redemption** (still visible).

## Cross-check

1. Rates & schemes panel links to Scheme catalog for adopted platform schemes.
2. After admin deprecates a template, jeweller catalog no longer lists it; existing offerings remain until withdrawn.
