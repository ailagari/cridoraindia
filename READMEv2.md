# Cridora India v2 — MVP build spec (agent reference)

**Stack:** React + Vite (`frontend/`) · Django REST (`backend/`)

## Local development

**Backend (API on port 8000)**

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver
```

- Health: `GET http://127.0.0.1:8000/api/v1/health/`
- Auth: `POST /api/v1/auth/register/`, `POST /api/v1/auth/jeweller/apply/`, `POST /api/v1/auth/login/`
- KYC uploads (JWT): `POST /api/v1/kyc/documents/upload/` (multipart `doc_type`, `file`), `POST /api/v1/kyc/bank/` (JSON)
- Media files are served under `/media/` in DEBUG.

Create an admin user: `python manage.py createsuperuser` then set **User type** to **Admin** in Django admin if you log into `/admin/`.

**Frontend (Vite on port 5173)**

```powershell
cd frontend
npm install
npm run dev
```

The dev server proxies `/api` and `/media` to `127.0.0.1:8000`. For production builds, set `VITE_API_BASE_URL` to your API origin.

---

## Core platform structure

Cridora has **three primary roles**:

| Role            | Purpose                                                                 |
| --------------- | ----------------------------------------------------------------------- |
| **Users**       | Buy/hold/redeem gold; discover jewellers; transfers and related flows   |
| **Jewellers**   | Liabilities, marketplace, schemes, policy configuration                 |
| **Admin**       | KYC/KYB, approvals, trust engine, ledger monitoring                     |

**Critical rule:** All critical onboarding and **public visibility** are controlled through **admin approval workflows**.

**Key MVP principle:** *Nothing becomes public without admin approval* — for trust, compliance, fraud control, marketplace quality, onboarding safety, and network credibility.

---

## Cridora MVP — refined functional overview

*Product reference for what we are building. Keep API, ledger, and UX aligned to this.*

### Gold purchase and holdings

#### 1. Fractional gold purchase

- Users can purchase gold in **any nominal amount** through participating jewellers.
- **Applicable Indian GST** is charged during purchase.
- Holdings are stored **digitally in grams**.
- Users can monitor **live portfolio value** based on market-linked gold prices.

**Lock-in models** (jeweller policy):

- With lock-in period  
- Without lock-in period  

**Jeweller configuration:**

- Minimum redeemable quantity  
- Minimum holding quantity  
- Lock-in duration  

**Supported lock-in range:** 15 days to 12 months.

#### 2. Gold deposit

- Users can deposit **existing physical gold** through partnered jewellers.
- After verification: **purity is validated**; **equivalent gold grams** are added to the user’s Cridora portfolio.

**Deposited gold can later be:**

- Redeemed  
- Transferred  
- Used for loans  
- Sold back  
- Used for purchases  

---

### Portfolio and ledger system

The user dashboard displays:

- Total gold holdings  
- Current live value  
- Profit/loss  
- Redeemable gold  
- Locked gold  
- Jeweller-wise holdings  

Each holding is shown as **separate ledger cards**.

**Currently supported holding types:**

- Fractional gold  
- Gold deposit  
- GoldNest scheme  

**Each ledger shows:**

- Gold grams  
- Invested value  
- Current value  
- Lock-in details  
- Redemption eligibility  
- Associated jeweller  

---

### Redemption and usage methods

Users can utilize gold holdings in multiple ways.

#### 1. Ornament redemption

- Redeem as **jewellery**, **ornaments**, **coins**, or related products.
- The system directs users to **marketplace/catalog** pages from **participating jewellers across India**.
- Users can **browse products** and compare **making charges**, **cross-redemption fees**, and **jeweller policies**.

**Same jeweller:** users may receive **reduced making charges** or other benefits.

**Another jeweller:** **cross-platform redemption fees** may apply.

#### 2. Cash redemption (sellback)

- Redeem gold as **cash** after applicable lock-ins.

**Per jeweller:**

- Buyback rate  
- Sellback spread  
- Liquidity rules  
- Redemption conditions  

**User sees before confirm:**

- Live sellback value  
- Deductions  
- Applicable fees  

#### 3. Gold transfer and gifting

- Transfer or gift gold to **other Cridora users**.
- Via **Cridora unique username** or **registered phone number**.

**Before execution:**

- System verifies recipient  
- Sender must **confirm recipient first and last name**  
- **Double confirmation** required  

Transferred gold updates **both portfolios** immediately.

#### 4. Loans against gold

- Loans against **available** gold holdings.

**Highlights (product spec):**

- **Zero-interest** loans  
- **Flat 2%** processing fee  
- User can choose **partial quantity** from total holdings  

**Jeweller configuration:**

- Maximum eligible loan percentage  
- Valuation deductions  
- Lock-in restrictions  
- Loan eligibility rules  

Loan utilization **immediately** updates portfolio balances in real time.

#### 5. Emergency funds (Cridora-assisted)

- Users request **emergency liquidity** through Cridora.

**Features:**

- Up to **80%** of portfolio value  
- Processed **against** user holdings  
- **Platform service fees** apply  

Rapid liquidity; portfolio balances update **immediately** once funds are utilized.

---

### Real-time portfolio consumption logic

For **loans**, **transfers**, **cash redemption**, **ornament redemption**, and **emergency funds**:

- Consumed gold quantity is **deducted from the portfolio instantly**.

This maintains:

- Accurate ledger balance  
- Real-time holdings visibility  
- Transparent utilization tracking  

---

### Nationwide redemption infrastructure

- Users can use portfolio holdings to **purchase gold products** from **any partnered jeweller in India**.

**Cridora manages internally:**

- Settlement routing  
- Liability balancing  
- Inter-jeweller accounting  
- Redemption reconciliation  

#### Example flow

1. User buys gold worth ₹100 from **Shop A** → holdings stored digitally in grams **including GST-adjusted purchase value**.  
2. Gold price rises later.  
3. User redeems jewellery from **Shop B**.  
4. User pays: **cross-platform fee** (if applicable), **making charges**, **GST on making charges**.

**Internally:** gold liability is **settled between Shop A and Shop B** through Cridora; the user does **not** manage inter-jeweller settlement manually.

**Outcomes:** nationwide redemption portability, inventory interoperability, connected jeweller ecosystem.

---

### Jeweller discovery and trust layer

**Search jewellers by:**

- Shop name  
- Location  
- Address  
- City  
- State  

**Each jeweller profile:**

- Verification badge  
- Credibility score  
- Lock-in policies  
- Redemption rules  
- Loan rules  
- Sellback policies  
- Cross-redemption fees  

**Preferred / default jeweller**

- User selects a **default jeweller** as primary routing for:

  - Purchases  
  - Redemptions  
  - Transfers  
  - Offers  
  - Loyalty benefits  

---

## Jeweller features (MVP)

### 1. Jeweller dashboard

Surface:

- Customer liabilities  
- Gold balances  
- Redemption requests  
- Sellback requests  
- Loan requests  
- Transfer activity  

### 2. Product and marketplace management

Jewellers can:

- Add ornaments/products  
- Add offers  
- Upload collections  
- Configure making charges  

**Important:** Products (and related catalog entries) remain **private until admin approval**.

### 3. Scheme management (GoldNest)

Jewellers can:

- Create savings schemes  
- Configure lock-in periods  
- Configure maturity rules  
- Configure waiver structures  

**Important:** Schemes remain **hidden until admin approval**.

### 4. Gold policy controls

Jewellers configure:

- Buy markup  
- Sellback deduction  
- Loan eligibility %  
- Redemption rules  
- Lock-in periods  

---

## Admin features (critical MVP layer)

### 1. User KYC approval

Admin verifies:

- PAN  
- Aadhaar  
- Mobile/email verification  
- Suspicious activity checks  

**Only approved users** become **active** for full platform use as designed.

### 2. Jeweller KYC and KYB approval

Admin verifies:

- GST  
- PAN  
- BIS details  
- Business registration  
- Shop verification  
- Bank details  
- Ownership details  

**Only approved jewellers** become **publicly visible** (subject to suspension/rejection rules below).

### 3. Marketplace approval system

Admin approves before **public visibility**:

- Products  
- Schemes  
- Offers  
- Promotional banners  
- Jeweller profiles (where applicable to “go live”)

**Intent:** Reduce fraud, fake pricing, misleading listings, and compliance violations.

### 4. Credibility and trust engine

Admin controls:

- Verified badges  
- Trust scores  
- Suspension  
- Warnings  
- Account restrictions  

### 5. Ledger and monitoring

Admin monitors:

- Transactions  
- Liabilities  
- Settlements  
- Suspicious activity  
- Redemption patterns  
- Transfer abuse  

---

## Public visibility logic

| Status                    | Visibility                                      |
| ------------------------- | ----------------------------------------------- |
| Registered, **pending KYC** | **Private**                                   |
| **Admin approved**        | **Public** (per approved entities/content)    |
| **Suspended**             | **Hidden**                                     |
| **Rejected**              | **Disabled**                                   |

Implement consistent checks on **API** (authoritative) and reflect in **React** (UX).

---

## Simplified MVP architecture (responsibilities)

| Actor               | Owns                                                                                   |
| ------------------- | -------------------------------------------------------------------------------------- |
| **Users**           | Buy gold, hold gold, redeem, transfer, loans, emergency funds (as scoped)              |
| **Jewellers**       | Hold liabilities, provide redemption, run schemes, sell products, policy configuration |
| **Cridora (platform)** | Ledger, KYC/KYB approvals, visibility gates, interoperability, settlement routing, trust |

---

## Implementation notes for agents

1. **Approval gates:** Model explicit states (`draft`, `pending_review`, `approved`, `rejected`, `suspended`) for users, jewellers, products, schemes, offers, banners — align naming with Django conventions.  
2. **Public APIs:** Only return entities that are **approved** and **not suspended**; enforce in serializers/views or querysets, not only in the UI.  
3. **Transfers:** Enforce verification + **double confirmation** in backend workflow (state machine or equivalent).  
4. **GST:** Purchase flows must support Indian GST line items/rates per business rules (placeholder rates acceptable in MVP if not yet defined).  
5. **Settlement:** Inter-jeweller liability and redemption reconciliation must be **server-authoritative**; mirror the nationwide example flow in domain logic.  
6. **Consumption:** All redemption/loan/transfer/emergency paths must **deduct ledger balance atomically** and remain auditable.  
7. **Audit:** Admin actions that affect visibility, trust scores, and suspensions should be traceable (minimal audit log in MVP is recommended).

---

## Repository layout (target)

When scaffolding, prefer a clear split, for example:

- `frontend/` — React app  
- `backend/` — Django project (API, admin, domain apps)

Keep this README updated if MVP scope changes.
