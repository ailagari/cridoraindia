# Cridora India — User Flows

Step-by-step journeys based on implemented routes, APIs, and UI sections. Status markers: ✅ implemented, ⚠️ partial, ❌ not implemented.

---

## Public visitor flows

### Browse marketing site ✅

1. Land on `/` (HomePage) within `PublicLayout`.
2. Navigate via top nav or mobile bottom bar: Discover, Shop, Join, Account.
3. Pages: `/why-cridora`, `/features`, `/how-it-works`, `/investors`, `/waitlist` (mailto only — ❌ no API).

### Browse jewellers & marketplace ✅

1. `/jewellers` — directory from `GET /api/v1/marketplace/jewellers/` (+ demo merge in UI).
2. `/jewellers/:id` — public storefront profile.
3. `/marketplace` — product catalog; demo SKUs blocked at checkout.
4. `/marketplace/product/:productId` — detail page.

### Sign up / log in ✅

1. `/signup` → `POST /auth/register/` (customer).
2. `/jeweller/apply` → `POST /auth/jeweller/apply/`.
3. `/login` → `POST /auth/login/` → JWT stored → redirect by role.

---

## Customer flows

**Dashboard:** `/userdashboard?section=<key>`  
**Default section:** `portfolio_overview`

### Signup & onboarding ✅

1. Register at `/signup` with email, password, name, phone.
2. Redirect to `/userdashboard` or `?section=profile_kyc` if `kyc_status != verified`.
3. `/onboarding/kyc` alias redirects to KYC section.

### KYC ⚠️ (no automated verification)

1. Open **Profile → KYC** (`profile_kyc`).
2. `CustomerKycWorkflow`: upload docs via `POST /kyc/documents/upload/` (aadhaar, pan, selfie).
3. Optional: `POST /kyc/bank/` for bank account.
4. Wait for admin approval (`users_kyc_kyb` queue).
5. Until verified: fractional purchase, sellback, vault redemption **blocked** by API.

### Default jeweller ⚠️

- Backend: `GET/PATCH /gold/default-jeweller/`, jeweller preference FKs on User.
- UI: marketplace “Set default jeweller” — **coming soon** on grid.
- GoldUPI identity: `GET/PATCH /gold/identity/`.

### Buy fractional gold ✅

**Section:** `invest_fractional`

1. Select jeweller (verified).
2. `POST /fractional/quote/` — amount/grams, rate, GST.
3. `POST /fractional/orders/` — create order.
4. **Path A — Counter:** `POST .../counter-otp/` → jeweller enters OTP → `POST /jeweller/fractional/orders/:id/verify/`.
5. **Path B — UPI:** `POST .../confirm-upi/` → customer pays → `POST .../submit-utr/` → jeweller `confirm-utr`.
6. Completion credits `VaultHolding` (fractional) + jeweller liability ledger.

### Gold deposit (customer view) ✅

**Section:** `invest_deposit` (info) + jeweller initiates intake

1. Jeweller creates intake → customer sees `GET /gold-deposit/intakes/`.
2. Customer requests `POST .../counter-otp/`.
3. Jeweller verifies → vault credited.

### Golden scheme ❌

**Section:** `invest_scheme` — **Coming Soon** UI only.  
Jeweller can disclose scheme on storefront (backend fields on `JewellerPricingProfile`); no customer enrollment API.

### Portfolio viewing ✅

| Section | Panel | APIs |
|---------|-------|------|
| `portfolio_overview` | CustomerPortfolioPanel | `/gold/wallet/`, portfolio helpers |
| `portfolio_holdings` | Vault breakdown | wallet |
| `portfolio_vault_ids` | Cridora ID, routing, QR | identity, wallet |

**Personal holdings** (off-vault): accessible via portfolio features — `GET/POST /portfolio/personal-holdings/` (tracking only, not redeemable).

### Transfer gold (GoldUPI) ✅

**Section:** `redeem_transfer`

1. Resolve payee: `POST /gold/resolve/` or scan QR (`GoldTransferMobileFlow`).
2. `POST /gold/transfers/` — debit/credit vaults.
3. Public meta: `GET /gold/pay/<gold_upi>/` (AllowAny).

### Cash sellback (redeem) ✅

**Section:** `redeem_cash`

1. `POST /gold/sellback/quote/`.
2. `POST /gold/sellback/confirm/` — creates request.
3. Jeweller accept → cash OTP or UPI payout path.
4. Customer confirms UTR or OTP; vault debited.

### Cross redemption (emergency) ✅

**Section:** `redeem_emergency`

1. Customer authorizes: `POST /cross-redemption/authorize/`.
2. Track: `GET /cross-redemption/`.
3. Cancel: `POST /cross-redemption/:id/cancel/`.
4. Jeweller destination accept/reject; source OTP approve.
5. Settlement completed manually by admin.

### Vault ornament redemption (shop from vault) ⚠️

- Backend: `POST /marketplace/redemption/quote|confirm/`.
- UI: `CustomerVaultRedemptionShopPanel` exists but **not wired to any section** — use marketplace checkout for SKUs instead.

### Gold loan ❌

**Section:** `redeem_loan` — Coming Soon. Ticker has loan APR fields; no loan API.

### Marketplace usage ✅

**Sections:** `shop_jewellers`, `shop_products`

- Browse, cart (`MarketplaceCartViews`), checkout (`MarketplaceCheckoutFlow`).
- Real SKUs only; card payment is **demo**.
- Vault redemption quote path for authenticated customers with KYC.

### Notifications ⚠️

- Logged in: live `GET /notifications/`.
- Guest header: mock notifications.

### Profile management ✅

| Section | Feature |
|---------|---------|
| `profile_personal` | `PATCH /customer/profile/` |
| `profile_security` | Password change |
| `profile_kyc` | KYC workflow |
| `profile_cridora_id` / `profile_qr` | Gold identity display |

### Logout ✅

`POST /auth/logout/` → clear tokens → `/login`.

---

## Jeweller flows

**Dashboard:** `/dashboard/jeweller?section=<key>`  
**Default:** `portfolio`

### Onboarding & KYB ✅

1. Apply at `/jeweller/apply`.
2. Redirect to `?section=prof_kyb` if not verified.
3. Upload KYB docs (GST, PAN business, shop proof, etc.).
4. Admin approves via `POST /admin/users/:id/kyb/approve/`.

### Dashboard usage ✅

Hubs: Customer, Marketplace, Portfolio, Operations, Profile (see [UI_UX_STRUCTURE.md](./UI_UX_STRUCTURE.md)).

### Rate management ✅

**Section:** `mkt_policy` — `JewellerRatesSchemesPanel`  
`GET/PATCH /jeweller/marketplace/profile/` — gold rate source, markups, metal pricing JSON, golden scheme **disclosure** fields.

### Adding products ✅

**Section:** `mkt_products`  
`GET/POST /jeweller/marketplace/products/` — requires KYB verified for writes. Image upload endpoints. Admin moderation for visibility.

### Scheme management ⚠️

Disclosure-only on profile (enabled, duration, min monthly INR). No scheme ledger or customer subscriptions.

### Handling customers ✅

**Section:** `cust_hub` — `JewellerCustomerVaultsPanel`  
`GET /jeweller/custody-vaults/`, per-customer ledger. Customer lookup for personal holdings.

### Approval flows ✅

| Flow | Section | APIs |
|------|---------|------|
| Fractional pending | `txn_purchases` | pending, verify, UPI confirm |
| Gold deposit | `txn_deposits` | create intake, verify OTP |
| Sellbacks | `txn_ops` | accept/reject/complete/payout |
| Ornament redemptions | `txn_ops` | ornament-redemptions list |
| Cross-redemption inbox | `txn_ops` | inbox + accept/reject/approve |

### Cross redemption handling ✅

1. Initiate: `POST /jeweller/cross-redemption/initiate/`.
2. Destination jeweller accept/reject.
3. Source jeweller OTP + approve/reject.
4. Fulfillment heartbeat during in-progress state.

### Liability tracking ✅

Automatic via `jeweller_liability_service` on fractional, sellback, deposit, redemption events. Visible in wallet/portfolio APIs.

### Notifications ✅

Platform notifications feed when authenticated.

### Settlement flows ⚠️

Backend MVP commands exist; **no jeweller UI** for settlement batches — admin marks complete.

---

## Admin flows

**Dashboard:** `/dashboard/admin?section=<key>`  
**Default:** `ops_overview`

### User approval ✅

**Section:** `users_kyc_kyb`

1. Queue from users with `kyc_status != verified`.
2. Inspect modal: `GET /admin/users/:id/documents/`.
3. Actions: `POST .../kyc/approve|reject/`, `kyb/approve|reject/`, revoke, re-upload request, freeze.

### Jeweller / customer directories ✅

**Sections:** `users_jewellers`, `users_customers` — lists with drill-down to KYC modal.

### Moderation ✅

**Section:** `mkt_products` — `AdminMarketplaceCatalogSetupPanel`  
`POST /admin/marketplace/products/:id/moderate/`

### Dashboard monitoring ✅

**Section:** `ops_overview` — `GET /admin/overview/` stats.

### Notifications ✅

Admin notification feed + mark read.

### Fraud monitoring ⚠️

Partial: cross-redemption `risk-block` admin action. No dedicated fraud dashboard.

### Ledger monitoring ⚠️

Portfolio panels + personal holdings admin. Full ledger UI **not built** — treasury Coming Soon.

### Product / scheme approval ✅ / ❌

Product moderation ✅. Scheme/program admin ❌ (Coming Soon).

### Platform controls ✅

| Section | Feature |
|---------|---------|
| `plat_gold` | Gold ticker admin, spot prices |
| `plat_festival` | Festival broadcast CRUD |
| `plat_control` | Fractional counter OTP TTL policy |
| `plat_security` | Password change |

### Cross-redemption admin ✅

`GET /admin/cross-redemption/`, risk-block, settlement-complete.

---

*Cross-reference: [FEATURE_STATUS_REPORT.md](./FEATURE_STATUS_REPORT.md), [API_REPORT.md](./API_REPORT.md).*
