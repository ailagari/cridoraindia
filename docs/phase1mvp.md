Cridora MVP (Version 1.0)
India-First Gold Savings, Portfolio & Jeweller Network Platform
MVP OBJECTIVE

Cridora MVP is focused on:

fast launch
rapid jeweller onboarding
customer acquisition
trust building
portfolio psychology
gold utility
marketplace visibility
liquidity features
recurring customer retention

The MVP is NOT initially focused on:

nationwide automated settlement
advanced treasury systems
enterprise APIs
bullion routing
automated reserve balancing
AI fraud systems
multi-metal support

The goal is:

prove user adoption + jeweller participation + network utility.
1. USER TYPES
A. Public Visitor

Can:

browse public pages
search jewellers
browse products
understand Cridora
compare jewellers
join waitlist
view marketplace
B. Customer/User

Without verified KYC (after signup / login):

browse jewellers, offerings, products, and pricing (same discovery as a visitor where APIs allow logged-in views)
save preferences where the product supports it

Only after KYC is submitted and admin-verified:

invest in gold
join schemes
deposit physical gold
transfer holdings
redeem holdings
apply for loans
access emergency funds
manage multiple jeweller portfolios
view live portfolio value tied to funded activity

Signup uses email and password only — no OTP and no separate email verification step; the user is signed in immediately and must complete verified KYC before any purchase, deposit, redemption, or other money-movement flow.

C. Jeweller

Before KYB is approved:

submit KYB and prepare the business inside the jeweller dashboard
add products, schemes, gold rates, markups, lock-ins, same-shop benefits, cross-redemption charges, and other supported catalogue / policy settings
merchant profile, products, schemes, and pricing are not shown to customers in the app; users cannot buy, deposit, sell, redeem, or complete any jeweller-routed transactional activity with them

After KYB is approved:

profile, products, schemes, and surfaced pricing become visible to users in discovery and listing flows (subject to admin moderation where the product requires it)
customers who have completed verified KYC can buy, deposit, sell, redeem, join schemes, transfer, and complete other permitted flows with this jeweller
ongoing: manage customer liabilities, process redemptions, update catalogue and schemes, monitor operations

D. Admin

Can:

approve KYC at discretion (including known users without a complete upload checklist)
approve jewellers / KYB at discretion (including trusted partners before full document sets)
approve schemes
moderate products
manage credibility badges
monitor transactions
monitor network liabilities
manage platform fee structures
2. CRIDORA IDENTITY LAYER

This is the core infrastructure layer of the MVP.

Every user and jeweller receives:

unique Cridora IDs.

This works similar to:

UPI IDs
wallet handles
banking usernames
2.1 USER GLOBAL ID

Every user gets:

one permanent global Cridora ID

Example:

rahul4821@cridora

Used for:

login identity
referrals
transfers
gifting
notifications
portfolio ownership
2.2 JEWELLER GLOBAL ID

Every jeweller gets:

one permanent merchant ID

Example:

goldhousekochi@cridora

Used for:

marketplace identity
redemption routing
liability routing
merchant discovery
customer mapping
2.3 USER-JEWELLER UNIQUE IDs (MOST IMPORTANT)

Each user-jeweller relationship creates:

a dedicated vault ID.

Example:

rahul4821.goldhousekochi@cridora

This acts as:

dedicated vault account
jeweller-linked portfolio
transfer destination
scheme identity
referral identity

This is the MOST important routing layer.

WHY THIS IS IMPORTANT

Users may:

invest in multiple jewellers
hold multiple portfolios
join different schemes

Each relationship must remain:

independently trackable.
Example

User:

rahul4821@cridora

Has:

rahul4821.goldhousekochi@cridora

and:

rahul4821.malabargold@cridora

Each vault has:

separate gold holdings
separate rules
separate lock-ins
separate redemption benefits
2.4 DEFAULT JEWELLER SYSTEM

Users can configure:

multiple default jewellers.

Example:

Primary default jeweller
Nearby default jeweller
Preferred ornament jeweller
Preferred redemption jeweller

This helps:

transfer routing
referral routing
marketplace personalization
local redemption
3. AUTHENTICATION & ACCOUNT SYSTEM
User Signup

Required:

email (login identity)
password

Optional:

mobile number

There is no OTP step and no mandatory email verification gate: after successful signup the user receives a session (JWT) and can use the app immediately. Transactional actions (purchases, deposits, redemptions, transfers, schemes, loans, emergency funds, etc.) remain blocked until KYC is completed and verified by admin.

Jeweller apply follows the same pattern: email/password account creation with immediate login. Jewellers may enter products, schemes, and rates while KYB is pending; only after admin-approved KYB does that merchant appear to customers with visible catalogue, and only then can verified-KYC users transact (buy, deposit, sell/redemption, etc.) with them.
4. KYC SYSTEM
User KYC

Required:

Aadhaar
PAN
selfie/photo

Backend and product flows must enforce verified KYC before allowing purchases, deposits, redemptions, transfers, scheme joins, loans, or emergency fund actions; browsing and discovery do not require verified KYC.

Who becomes verified is entirely up to platform admin: uploads and bank details aid review, but admins may approve customers they already know without requiring every checklist item. Rejection and re-review likewise follow admin judgment.

Status:

pending
approved
rejected

Jeweller KYC (KYB)

Required:

GST certificate
PAN
owner details
shop photos
address proof

Admin approval (verified KYB) is required before the jeweller’s identity, products, schemes, and customer-visible pricing go live in the app. Until then, prepared catalogue data stays private to the jeweller account. Customer-facing purchases, deposits, selling, redemption, scheme joins, and other jeweller-routed activity must only be offered once KYB is verified for that merchant (and the customer meets verified KYC where applicable).

Granting KYB is admin-discretionary: document uploads support due diligence, but admins may verify jewellers they trust directly without waiting for every file.

5. PUBLIC WEBSITE
Core Pages
Home
platform overview
benefits
CTA buttons
What is Cridora

Explain:

digital gold utility
jeweller network
portfolio vault
redemption flexibility
How It Works

Flow:

Choose jeweller
Buy gold
Build portfolio
Redeem anywhere
For Users

Benefits:

fractional buying
gold portfolio
liquidity access
loans
gifting
emergency funds
For Jewellers

Benefits:

recurring customers
digital presence
marketplace traffic
customer retention
gold liabilities dashboard
Jeweller Marketplace

Search by:

city
name
rating
verified badge
Product Marketplace

Browse:

ornaments
coins
bars
Investor Relations

Google Form CTA.

Waitlist

Separate forms for:

users
jewellers
6. JEWELLER MARKETPLACE
Jeweller Card Includes
Item	Details
Logo	shop image
Shop Name	jeweller name
Merchant ID	unique Cridora ID
City	location
Verified Badge	yes/no
Credibility Score	rating
Years in Business	optional
Live Gold Rate	current rate
Buyback Rate	displayed
Cross Redemption Fee	displayed
Same-Shop Benefits	reduced MC
Lock-in Availability	yes/no
7. PRODUCT MARKETPLACE
Product Card Includes
Item	Details
Product Image	ornament photo
Jeweller Name	linked
Product Type	ring/chain/etc
Weight	grams
Purity	BIS 916
Making Charge	displayed
Approx Gold Value	estimate
Cross Redemption Eligible	yes/no
8. GOLD HOLDING TYPES

MVP supports ONLY 3 holding types.

A. Fractional Gold Holdings

Users buy:

₹100
₹500
₹1000

System converts amount into grams.

Features:

live portfolio value
transferability
loans
emergency funds
sellback

Jeweller configures:

lock-in period
minimum redeemable quantity
same-shop benefits

Lock-in:
15 days → 12 months.

B. Gold Deposit Holdings

Users deposit:

old jewellery
coins
bars

Jeweller verifies purity and credits grams.

Features:

redeemable
transferable
sellback eligible
C. Golden Scheme

(Simple MVP version)

Users:

contribute monthly amounts
join jeweller savings plans

Gold rate may apply:

during investment
OR
during redemption

Jeweller configures:

duration
lock-in
minimum amount
benefits

This is:

jewellery savings mode

NOT direct live gold ownership.

9. USER PORTFOLIO DASHBOARD
Main Cards
Card	Example
Total Gold Holdings	12.5g
Current Value	₹1,20,000
Profit/Loss	+₹8,000
Redeemable Gold	10g
Locked Gold	2.5g
Portfolio Segmentation

Separate vaults by:

jeweller
holding type
lock-in status
Ledger View
Type	Jeweller	Grams	Status

Types:

fractional
deposit
golden scheme
10. LIVE RATE + MARKUP SYSTEM

Cridora displays:

Reference Market Gold Rate.

Each jeweller can configure:

buy rate markup
sellback deduction
ornament pricing
redemption fee
cross redemption fee

Users always see:

jeweller-specific live rates.
11. CRIDORA REVENUE SETUP
Revenue Sources
A. Transaction Fee

Applied during:

purchases
transfers
redemptions
B. Cross Redemption Fee

When redeeming across jewellers.

C. Emergency Fund Fee

Platform fee for emergency liquidity.

D. Loan Processing Share

2% processing fee shared between:

Cridora
jeweller
E. Marketplace Promotions

Featured listings for jewellers/products.

F. SaaS Subscription

Jeweller dashboard subscription later.

12. GOLD PURCHASE FLOW
User selects jeweller
User enters amount
GST shown
Payment completed
Grams credited
Vault updated
Portfolio updated
13. REDEMPTION OPTIONS
A. Ornament Redemption

Users:

browse marketplace
redeem using grams
Same Jeweller Benefits

Jeweller may configure:

0% making charge
reduced MC
bonus benefits
Cross Jeweller Redemption

User pays:

cross redemption fee
making charge difference

Settlement handled internally by Cridora.

B. Cash Sellback

Jeweller sets:

sellback rate
deduction spread
lock-in rules
C. Gold Transfer

Users transfer using:

rahul4821.goldhousekochi@cridora

System verifies:

name
jeweller
profile

Double confirmation required.

D. Gold Loan

Features:

0% interest
2% processing fee
jeweller-defined LTV
holdings-backed

Initially manual approval flow.

E. Emergency Funds

Cridora provides:

emergency liquidity
configurable portfolio percentage

Portfolio grams reduced accordingly.

14. JEWELLER DASHBOARD
Dashboard Overview

Cards:

total liabilities
customer count
total holdings
redemption requests
pending approvals
Gold Rate Management

Manage:

buy rates
markups
sellback rates
lock-ins
cross redemption charges
Product Management

Upload:

products
images
weights
making charges
Scheme Management

Manage:

Golden Scheme
benefits
duration
lock-in
Customer Vaults

View:

holdings
ledgers
liabilities
transactions
Redemption Requests

Manage:

ornament redemption
loans
sellbacks
transfers
15. ADMIN DASHBOARD
Admin Features
User Management
approve KYC
suspend users
Jeweller Management
approve onboarding
assign badges
manage visibility
Product Moderation
approve listings
Scheme Moderation
approve schemes
Transaction Monitoring
monitor ledgers
monitor liabilities
monitor transfers
16. MOBILE PWA UI
User Bottom Navigation
Button	Purpose
Shop	jewellers + products
Invest	buy gold
Portfolio	holdings
Redeem	loan/cash/ornament
Profile	KYC/settings
Jeweller Bottom Navigation
Button	Purpose
Dashboard	overview
Products	listings
Customers	vaults
Requests	redemption
Profile	settings
17. NOTIFICATION SYSTEM
User Notifications
KYC approved
gold purchased
transfer received
redemption approved
loan updates
lock-in completed
Jeweller Notifications
new customer
redemption request
transfer request
low liquidity alerts
Admin Notifications
pending approvals
suspicious activity
high-value transfers
18. IMPORTANT MVP LIMITATIONS

NOT included initially:

automated nationwide settlement
AI fraud systems
advanced treasury engine
programmable GoldNest rules
multi-metal support
bullion routing
RFID/NFC
enterprise APIs
19. CORE MVP POSITIONING

Cridora MVP is:

“A Digital Gold Portfolio & Jeweller Network Platform”

Where users can:

accumulate gold
build flexible gold portfolios
transfer holdings
access liquidity
redeem across jewellers
use gold as utility

and jewellers can:

digitize customer relationships
increase retention
gain marketplace visibility
manage gold liabilities
participate in a connected network

while Cridora becomes:

the infrastructure, routing, identity, and settlement layer for India’s evolving digital jewellery economy.