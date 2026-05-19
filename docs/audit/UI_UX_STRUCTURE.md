# Cridora India — UI/UX Structure

**Frontend root:** `frontend/src/`  
**Design approach:** Custom CSS design system (no MUI/Tailwind). Theme via `data-theme` on `<html>` from `ThemeContext` (system light/dark).

---

## 1. Design system

### Colors & theme

- Dark-first marketing aesthetic; dashboard uses role accent variables.
- Theme toggle follows `prefers-color-scheme` unless overridden.
- PWA manifest: `theme_color` `#000814`, `background_color` `#000814`.

### Typography & spacing

- `clamp()` for responsive headings on marketing/login pages.
- Dashboard uses consistent card/panel classes (`dash-card`, `dash-panel`).

### Reusable components

| Location | Components |
|----------|------------|
| `components/ui/` | Input, button helpers, `DeferredFilePicker` |
| `components/` | `DashboardLayout`, `PublicLayout`, `NotificationBell`, `ProductPhoto`, `CridoraLogo`, `NativeAppSplash` |
| `features/*/LegalDisclosureStrip` | Cross-redemption legal copy |

### Navigation consistency

| Surface | Pattern |
|---------|---------|
| Public desktop | Top nav in `PublicLayout` |
| Public mobile | Fixed bottom nav (Home, Discover, Shop, Join, Account) |
| Dashboard mobile | 5 hub bottom tabs + horizontal subsection pills |
| Dashboard desktop | Collapsible sidebar accordion |

---

## 2. Route map (complete)

### Public routes (`PublicLayout`)

| Path | Page component |
|------|----------------|
| `/` | HomePage |
| `/discover` | DiscoverPage |
| `/shop` | ShopHubPage |
| `/join` | JoinHubPage |
| `/why-cridora` | WhyCridoraPage |
| `/features` | FeaturesPage |
| `/how-it-works` | HowItWorksPage |
| `/investors` | InvestorRelationsPage |
| `/waitlist` | WaitlistPage |
| `/jewellers` | JewellerDirectoryPage |
| `/jewellers/:id` | JewellerPublicPage |
| `/marketplace` | ProductMarketplacePage |
| `/marketplace/product/:productId` | MarketplaceProductDetailPage |
| `/login` | LoginPage |
| `/signup` | SignupPage |
| `/jeweller/apply` | JewellerApplyPage |
| `/verified-jewellers` | redirect → `/jewellers` |

### Protected routes

| Path | Guard | Component |
|------|-------|-----------|
| `/dashboard` | auth | DashboardIndexRedirect |
| `/userdashboard` | customer | CustomerDashboardPage |
| `/dashboard/customer` | — | redirect → `/userdashboard` |
| `/dashboard/jeweller` | jeweller | JewellerDashboardPage |
| `/dashboard/admin` | admin | AdminDashboardPage |
| `/onboarding/kyc` | — | redirect → KYC section |
| `/onboarding/jeweller-kyb` | — | redirect → KYB section |
| `*` | — | redirect `/` |

### Route protection (`ProtectedRoute`)

1. If no access token → `/login`.
2. If `user_type` mismatch → `dashboardLandingPath(user)` (role home).

---

## 3. Dashboard structure

Dashboards use **`?section=<key>`** — not separate router paths.

### Customer (`/userdashboard`)

**Hubs (bottom nav):** Market | Invest | Portfolio | Redeem | Profile

| Section key | Label | Panel / state |
|-------------|-------|---------------|
| `shop_jewellers` | Search jeweller | CustomerJewellersBrowsePanel |
| `shop_products` | Products | CustomerProductsBrowsePanel |
| `invest_fractional` | Fractional | FractionalPurchasePanel |
| `invest_deposit` | Deposit | Deposit info panel |
| `invest_scheme` | Scheme | **Coming Soon** |
| `portfolio_overview` | Overview | CustomerPortfolioPanel (default) |
| `portfolio_holdings` | Vault | CustomerVaultsPanel |
| `portfolio_vault_ids` | Vault ID | CustomerVaultAddressesPanel |
| `redeem_cash` | Cash sell | CustomerSellbackPanel |
| `redeem_transfer` | Transfer | GoldTransferMobileFlow / desktop |
| `redeem_loan` | Loan | **Coming Soon** |
| `redeem_emergency` | Emergency | Cross-redemption feature |
| `profile_cridora_id` | Cridora ID | Vault IDs |
| `profile_qr` | QR code | QR display |
| `profile_security` | Password | ChangePasswordPanel |
| `profile_personal` | Personal | CustomerAccountDetailsPanel |
| `profile_kyc` | KYC | CustomerKycWorkflow |

### Jeweller (`/dashboard/jeweller`)

**Hubs:** Customer | Marketplace | Portfolio | Operations | Profile

| Section key | Panel |
|-------------|-------|
| `cust_hub` | JewellerCustomerVaultsPanel |
| `mkt_products` | JewellerMarketplacePanel |
| `mkt_policy` | JewellerRatesSchemesPanel |
| `portfolio` | JewellerPortfolioOverviewPanel |
| `txn_purchases` | JewellerFractionalVerifyPanel |
| `txn_deposits` | Jeweller gold deposit |
| `txn_ops` | Sellbacks, cross-redemption inbox, ornament redemptions |
| `txn_transfers` | Transfers |
| `prof_more` | JewellerBusinessProfilePanel, storefront, UPI |
| `prof_security` | Password |
| `prof_kyb` | KYB workflow |

### Admin (`/dashboard/admin`)

**Hubs:** Users | Marketplace | Portfolio | Treasury | Control

| Section key | Panel / state |
|-------------|---------------|
| `users_jewellers` | Jeweller directory |
| `users_customers` | Customer directory |
| `users_kyc_kyb` | KYC/KYB queue (badge) |
| `mkt_products` | AdminMarketplaceCatalogSetupPanel |
| `mkt_programs` | **Coming Soon** |
| `ops_overview` | Stats from admin overview API (default) |
| `ops_portfolio` | AdminPortfolioPanel |
| `ops_personal_vault` | AdminPersonalHoldingsPanel |
| `fin_hub` | **Coming Soon** (settlements) |
| `plat_festival` | AdminFestivalBroadcastPanel |
| `plat_gold` | Gold ticker admin |
| `plat_control` | Fractional OTP policy + partial placeholder |
| `plat_security` | Password |
| `plat_account` | **Coming Soon** |

**KYC modal:** Large inline modal on admin page — approve/reject/revoke/re-upload/freeze without separate route.

---

## 4. Mobile responsiveness

| Breakpoint | Behavior |
|------------|----------|
| ~879px | Public desktop nav hidden; mobile chrome shown |
| 767px | `usePublicLayoutMax767` for narrow layouts |
| 960px | Notification bell → bottom sheet |

### Mobile-specific features

- `GoldTransferMobileFlow` with ML Kit barcode scan (Capacitor).
- `DashboardMobileSubNav` — horizontal pills for subsections.
- Sidebar overlay + backdrop on small screens.
- `prefers-reduced-motion` respected in CSS.

---

## 5. PWA & Capacitor behavior

### PWA (web)

| Item | Implementation |
|------|----------------|
| Service worker | `src/sw.ts` (Workbox injectManifest) |
| Register | `pwaRegister.ts`, `registerType: 'prompt'` |
| Update UI | `PwaUpdateBar` in main.tsx |
| Manifest | Icons 192/512, standalone, scope `/` |
| Offline | Limited — precached assets; API requires network |

### Capacitor (Android)

| Item | Value |
|------|-------|
| App ID | `in.cridora.app` |
| Router | HashRouter |
| Splash | `NativeAppSplash`, boot splash HTML injection |
| Push | `NativeNotificationBridge` |
| Build | `npm run build:android` → Gradle APK |

**Skipped on native:** PWA update bar registration.

---

## 6. UX issues & inconsistencies

| Issue | Severity | Detail |
|-------|----------|--------|
| Section URLs not bookmark-friendly for all legacy keys | Low | Legacy map exists |
| Demo products in catalog | Medium | Confusing next to real SKUs |
| Guest notifications look real | Medium | Mock data |
| Vault redemption shop unwired | High | Dead feature code |
| Card checkout in flow | Medium | Demo labeled but visible |
| Auth bootstrap without `/me/` | Low | Stale KYC status until refresh |
| Default jeweller UI missing | Medium | Backend ready |
| Admin treasury empty | High | Expected capability missing |

### Unfinished sections

Explicit `ComingSoon` component in `CustomerDashboardPage` (scheme, loan) and `AdminDashboardPage` (settlements, programs, account, partial controls).

---

## 7. Scalability (UI)

- Single-file admin dashboard is hard to maintain — candidate to split by section.
- No lazy-loaded routes — all dashboards load with parent page.
- Feature folders scale well; continue pattern for new modules under `src/features/<domain>/`.

---

*Flows: [USER_FLOWS.md](./USER_FLOWS.md). Features: [FEATURE_STATUS_REPORT.md](./FEATURE_STATUS_REPORT.md).*
