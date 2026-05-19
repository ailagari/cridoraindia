# Cridora India — API Report

**Base URL:** `/api/v1/`  
**Default auth:** `Authorization: Bearer <access_token>` (JWT)  
**Default permission:** `IsAuthenticated` unless noted.

**Also served:** `GET /admin/` (Django admin), production SPA + `/media/` uploads.

---

## 1. Auth & profile

| Method | Endpoint | Auth | Purpose | Frontend usage |
|--------|----------|------|---------|----------------|
| GET | `health/` | AllowAny | Health check | Native diagnostics |
| POST | `auth/login/` | AllowAny | JWT login | LoginPage |
| POST | `auth/register/` | AllowAny | Customer signup | SignupPage |
| POST | `auth/jeweller/apply/` | AllowAny | Jeweller registration | JewellerApplyPage |
| GET | `auth/me/` | JWT | Current user + wallet embed | Dashboards refresh |
| POST | `auth/password/change/` | JWT | Change password | ChangePasswordPanel |
| POST | `auth/token/refresh/` | Refresh body | New access token | api.ts authFetch |
| POST | `auth/logout/` | JWT | Blacklist refresh | AuthContext |
| PATCH | `customer/profile/` | Customer | Profile update | CustomerAccountDetailsPanel |
| PATCH | `customer/profile/payout-upi/` | Customer | Sellback UPI VPA | CustomerSellbackPanel |
| PATCH | `jeweller/business-profile/` | Jeweller | Business fields | JewellerBusinessProfilePanel |

---

## 2. KYC / KYB

| Method | Endpoint | Auth | Purpose | Frontend |
|--------|----------|------|---------|----------|
| POST | `kyc/bank/` | JWT | Upsert bank account | KYC workflow |
| GET | `kyc/documents/` | JWT | List documents | KYC workflow |
| POST | `kyc/documents/upload/` | JWT | Multipart upload | KYC workflow |

---

## 3. Gold wallet & GoldUPI

| Method | Endpoint | Auth | Purpose | Frontend |
|--------|----------|------|---------|----------|
| GET | `gold/wallet/` | JWT | Vaults, balances, ledger summaries | Portfolio panels |
| POST | `gold/resolve/` | JWT | Resolve GoldUPI handle | Transfer flow |
| POST | `gold/transfers/` | JWT | Create transfer | GoldTransfer* |
| POST/PATCH | `gold/identity/` | JWT | GoldUPI identity | Vault IDs panel |
| GET/PATCH | `gold/default-jeweller/` | JWT | Default custodian | Partial UI |
| GET | `gold/pay/<path:gold_upi>/` | **AllowAny** | Public pay meta | QR/pay links |
| GET | `jeweller/custody-vaults/` | Jeweller | Customer vault list | JewellerCustomerVaultsPanel |
| GET | `jeweller/custody-vaults/<customer_id>/ledger/` | Jeweller | Per-customer ledger | Vault panel detail |

---

## 4. Fractional purchase

| Method | Endpoint | Auth | Purpose | Frontend |
|--------|----------|------|---------|----------|
| POST | `fractional/quote/` | Customer+KYC | Price quote | FractionalPurchasePanel |
| GET/POST | `fractional/orders/` | Customer | List/create orders | FractionalPurchasePanel |
| POST | `fractional/orders/<pk>/counter-otp/` | Customer | Issue counter OTP | Fractional flow |
| GET | `fractional/counter-otp-policy/` | JWT | TTL policy | OTP UI |
| POST | `fractional/orders/<pk>/confirm-upi/` | Customer | Start UPI path | UPI steps |
| GET | `fractional/orders/<pk>/payment/` | Customer | Payment details | UPI steps |
| POST | `fractional/orders/<pk>/submit-utr/` | Customer | Submit UTR | UPI steps |
| POST | `fractional/orders/<pk>/cancel-upi/` | Customer | Cancel UPI order | UPI steps |
| GET | `jeweller/fractional/pending/` | Jeweller | Counter pending | JewellerFractionalVerifyPanel |
| GET | `jeweller/fractional/pending-upi/` | Jeweller | UPI pending | Same |
| GET/PATCH | `jeweller/profile/upi/` | Jeweller | Jeweller VPA | UPI profile |
| POST | `jeweller/fractional/orders/<pk>/verify/` | Jeweller | Verify counter OTP | Verify panel |
| POST | `jeweller/fractional/orders/<pk>/confirm-utr/` | Jeweller | Confirm UTR | Verify panel |

---

## 5. Sellback

| Method | Endpoint | Auth | Purpose | Frontend |
|--------|----------|------|---------|----------|
| POST | `gold/sellback/quote/` | Customer+KYC | Quote | CustomerSellbackPanel |
| POST | `gold/sellback/confirm/` | Customer+KYC | Create request | CustomerSellbackPanel |
| GET | `gold/sellback/outstanding/` | Customer | Active requests | Sellback panel |
| POST | `gold/sellback/<pk>/otp/regenerate/` | Customer | Regenerate OTP | Sellback |
| POST | `gold/sellback/<pk>/confirm-utr/` | Customer | Confirm UPI payout | UPI sellback |
| POST | `gold/sellback/<pk>/cancel-upi/` | Customer | Cancel UPI | UPI sellback |
| GET | `jeweller/sellbacks/` | Jeweller | List | JewellerSellbacksPanel |
| POST | `jeweller/sellbacks/<pk>/accept/` | Jeweller | Accept | Panel |
| POST | `jeweller/sellbacks/<pk>/reject/` | Jeweller | Reject | Panel |
| POST | `jeweller/sellbacks/<pk>/complete/` | Jeweller | Complete cash | Panel |
| POST | `jeweller/sellbacks/<pk>/payout/` | Jeweller | Init UPI payout | Panel |
| POST | `jeweller/sellbacks/<pk>/submit-utr/` | Jeweller | Submit UTR | Panel |

---

## 6. Gold deposit

| Method | Endpoint | Auth | Purpose | Frontend |
|--------|----------|------|---------|----------|
| GET | `gold-deposit/intakes/` | Customer | List intakes | Deposit info |
| POST | `gold-deposit/intakes/<pk>/counter-otp/` | Customer | OTP for intake | Customer flow |
| POST | `jeweller/gold-deposit/intakes/` | Jeweller | Create intake | Jeweller deposit panel |
| GET | `jeweller/gold-deposit/pending/` | Jeweller | Pending list | Panel |
| POST | `jeweller/gold-deposit/intakes/<pk>/verify/` | Jeweller | Verify OTP | Panel |

---

## 7. Portfolio (personal holdings)

| Method | Endpoint | Auth | Purpose | Frontend |
|--------|----------|------|---------|----------|
| GET | `portfolio/ledger/` | Customer | Activity ledger | Portfolio |
| GET/POST | `portfolio/personal-holdings/` | Customer | CRUD holdings | Personal holdings UI |
| GET/PATCH/DELETE | `portfolio/personal-holdings/<pk>/` | Customer | Detail | UI |
| POST/DELETE | `.../documents/` | Customer | Upload/delete docs | UI |
| GET | `.../documents/<doc_pk>/download/` | Customer | Download | UI |
| GET/POST | `portfolio/notifications/` | Customer | Inbox | Portfolio notifications |
| POST | `portfolio/notifications/mark-read/` | Customer | Mark read | UI |
| GET | `jeweller/customers/lookup/` | Jeweller | Find customer | Vault panel |
| POST | `jeweller/personal-holdings/` | Jeweller | Create for customer | Jeweller panel |
| GET | `admin/personal-holdings/` | Admin | List all | AdminPersonalHoldingsPanel |
| POST | `admin/personal-holdings/<pk>/remove|verify/` | Admin | Moderate | Admin panel |

---

## 8. Cross-redemption

| Method | Endpoint | Auth | Purpose | Frontend |
|--------|----------|------|---------|----------|
| POST | `cross-redemption/authorize/` | Customer | Customer authorize | Emergency panel |
| GET | `cross-redemption/` | Customer | List own | Emergency panel |
| POST | `cross-redemption/<pk>/cancel/` | Customer | Cancel | Emergency panel |
| GET | `jeweller/cross-redemption/inbox/` | Jeweller | Inbox | Jeweller ops |
| POST | `jeweller/cross-redemption/initiate/` | Jeweller | Start request | Inbox |
| POST | `jeweller/cross-redemption/<pk>/destination/accept|reject/` | Jeweller | Dest actions | Inbox |
| POST | `.../source/request-otp|approve|reject/` | Jeweller | Source actions | Inbox |
| POST | `.../fulfillment/heartbeat/` | Jeweller | Keep-alive | Inbox |
| GET | `admin/cross-redemption/` | Staff | Admin list | Admin (staff check) |
| POST | `admin/cross-redemption/<pk>/risk-block/` | Staff | Block | Admin |
| POST | `admin/cross-redemption/<pk>/settlement-complete/` | Staff | Manual settle | Admin |

---

## 9. Admin platform

| Method | Endpoint | Auth | Purpose | Frontend |
|--------|----------|------|---------|----------|
| GET | `admin/overview/` | Platform admin | Stats cards | Admin ops_overview |
| GET/PATCH | `admin/fractional-counter-otp-policy/` | Admin | OTP TTL | AdminFractionalOtpPolicyPanel |
| GET | `admin/notifications/` | Admin | Admin feed | NotificationBell |
| POST | `admin/notifications/mark-read/` | Admin | Mark read | Bell |
| GET | `admin/users/<user_id>/documents/` | Admin | KYC docs | KYC modal |
| POST | `admin/users/<user_id>/kyc/<action>/` | Admin | approve/reject | Modal |
| POST | `admin/users/<user_id>/kyb/<action>/` | Admin | approve/reject | Modal |
| POST | `admin/users/<user_id>/verification/revoke/` | Admin | Revoke | Modal |
| POST | `admin/users/<user_id>/documents/<doc_id>/request-reupload/` | Admin | Re-upload | Modal |
| POST | `admin/users/<user_id>/freeze/` | Admin | Toggle is_active | Modal |
| GET/POST | `admin/festival-broadcasts/` | Admin | Broadcasts | AdminFestivalBroadcastPanel |
| POST | `admin/festival-broadcasts/<pk>/cancel/` | Admin | Cancel | Panel |
| POST | `admin/push/test/` | Admin | Test push | Panel |

---

## 10. Push & notifications

| Method | Endpoint | Auth | Purpose | Frontend |
|--------|----------|------|---------|----------|
| GET | `push/vapid-public-key/` | AllowAny | VAPID public key | webPushApi |
| POST | `push/subscribe|unsubscribe/` | JWT | Web push | Push setup |
| GET/POST/DELETE | `push/native-status|native-subscribe|native-unsubscribe/` | JWT | FCM tokens | nativeNotifications |
| GET | `notifications/` | JWT | User notifications | NotificationBell |
| POST | `notifications/mark-read/` | JWT | Mark read | Bell |

---

## 11. Marketplace (public & jeweller & admin)

| Method | Endpoint | Auth | Purpose | Frontend |
|--------|----------|------|---------|----------|
| GET | `marketplace/spot-prices/` | AllowAny | Live spot | Ticker, pricing |
| GET | `marketplace/catalog-meta/` | AllowAny | Categories/purities | Catalog |
| GET | `marketplace/gold-ticker/` | AllowAny | Platform ticker | Header, panels |
| GET | `marketplace/gold-ticker/history/` | AllowAny | History chart | Charts |
| GET | `marketplace/jewellers/` | AllowAny | Directory | Directory pages |
| GET | `marketplace/jewellers/<pk>/` | AllowAny | Storefront | JewellerPublicPage |
| GET | `marketplace/products/` | AllowAny | Product list | Marketplace |
| GET | `marketplace/products/<pk>/` | AllowAny | Product detail | Detail page |
| POST | `marketplace/redemption/quote/` | Customer+KYC | Vault redemption quote | Checkout/redemption |
| POST | `marketplace/redemption/cross-authorize/` | Customer | Cross bridge | Redemption |
| POST | `marketplace/redemption/confirm/` | Customer+KYC | Confirm redemption | Checkout |
| GET | `jeweller/marketplace/ornament-redemptions/` | Jeweller | Redemption list | Ops panel |
| GET/PATCH | `jeweller/marketplace/profile/` | Jeweller | Pricing profile | Rates panel |
| POST | `jeweller/marketplace/logo/` | Jeweller | Logo upload | Storefront |
| POST | `jeweller/marketplace/product-image/` | Jeweller | Image upload | Products |
| GET/POST | `jeweller/marketplace/products/` | Jeweller | SKU CRUD | JewellerMarketplacePanel |
| GET/PATCH/DELETE | `jeweller/marketplace/products/<pk>/` | Jeweller | SKU detail | Panel |
| GET/PATCH | `admin/gold-ticker/` | Admin | Ticker config | Admin gold |
| GET | `admin/spot-prices/` | Admin | Spot admin view | Admin gold |
| GET | `admin/marketplace/products/` | Admin | All products | Admin catalog |
| POST | `admin/marketplace/products/<pk>/moderate/` | Admin | Approve/reject SKU | Admin catalog |

---

## 12. API quality notes

### Likely unused by frontend

- Some admin cross-redemption endpoints may only be used from admin dashboard intermittently.
- `GET /fractional/counter-otp-policy/` — used indirectly.

### Missing validations / risks

| Issue | Detail |
|-------|--------|
| No rate limiting | OTP and login endpoints |
| AllowAny endpoints | `health/`, `gold/pay/`, VAPID key, public marketplace |
| Inconsistent admin check | Some use `user_is_platform_admin()`, cross-redemption admin uses `is_staff` |
| Manual UTR | No PSP verification of payment |
| File uploads | Size limit via settings; MIME validation should be verified per view |

### Duplicate logic

- UPI fractional and UPI sellback share patterns in separate view modules (`fractional_upi_views`, `sellback_upi_views`).
- Pricing logic split across `marketplace/pricing.py`, `metal_pricing.py`, `redemption_pricing.py`.

### Broken / unwired frontend

- `CustomerVaultRedemptionShopPanel` — no route calls vault redemption quote API from dedicated shop UI.

---

*Total documented endpoints: ~120. Source of truth: `backend/apps/accounts/urls.py`, `backend/apps/marketplace/urls.py`.*
