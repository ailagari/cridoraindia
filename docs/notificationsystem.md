CRIDORA NOTIFICATION & ENGAGEMENT SYSTEM

Developer Ready Implementation Specification
Version 1.0

==================================================

1.  CORE OBJECTIVE

==================================================

The Cridora Notification System is NOT a simple alert system.

It acts as:

•  engagement engine

•

•

jeweller marketing infrastructure

customer retention layer

•  portfolio psychology engine

•  wealth growth communication system

The system should emotionally feel:

•  warm

•

•

trusted

caring

•  premium

•

culturally relatable

NOT:

•  aggressive fintech

•

•

spam marketing

trading alerts

==================================================
2. PRIMARY GOALS

A. Increase user engagement
B. Increase repeat investments

C. Increase jeweller retention
D. Help jewellers market digitally
E. Create emotional attachment to gold holdings
F. Create viral/shareable notifications
G. Make Cridora feel human

==================================================
3. DELIVERY CHANNELS

MVP:

•

In-App Notifications

•  PWA Push Notifications

•  Android Push Notifications

•

iOS Push Notifications

Future:

•  WhatsApp

•  SMS

•  Email

==================================================
4. TARGET TYPES

Notification targets:

ALL_USERS
ALL_APP_INSTALLS
SPECIFIC_JEWELLER_USERS
DEFAULT_JEWELLER_USERS
SPECIFIC_USERS
HIGH_VALUE_USERS
INACTIVE_USERS
SCHEME_USERS

==================================================
5. BRANDING SYSTEM

IMPORTANT:
If notification belongs to specific jeweller campaign:

Replace Cridora logo with Jeweller logo.

Display format:
“ABC Jewellers via Cridora”

Otherwise:
Use Cridora branding.

==================================================
6. DATABASE TABLES

==================================================
6A. notifications

Fields:

id
uuid
title
body
expanded_body nullable
notification_type
priority
tone
image_url nullable
logo_url nullable
cta_text nullable
cta_route nullable
target_type
target_metadata JSON nullable
is_global boolean
created_by_admin_id nullable
created_by_jeweller_id nullable
scheduled_at nullable
expires_at nullable
sent_at nullable
status
created_at
updated_at

==================================================
6B. user_notifications

Fields:

id
notification_id
user_id nullable
device_id nullable
is_read boolean
read_at nullable
clicked_at nullable
delivered_at nullable
delivery_status
created_at

==================================================
6C. notification_preferences

Fields:

id
user_id
allow_promotional
allow_gold_alerts
allow_portfolio_alerts
allow_jeweller_campaigns
allow_festival_alerts
allow_push_notifications
allow_sound
quiet_hours_start nullable
quiet_hours_end nullable
created_at
updated_at

==================================================
6D. notification_templates

Fields:

id
name
category
tone
title_template

body_template
variables JSON
is_active
created_at
updated_at

==================================================
7. NOTIFICATION TYPES ENUM

SYSTEM
GOLD_RATE
PORTFOLIO_GAIN
PORTFOLIO_DROP
PERSONAL_HOLDING
WELCOME_GIFT
JEWELLER_CAMPAIGN
FESTIVAL
RE_ENGAGEMENT
SECURITY
PAYMENT
TRANSFER
LOAN
REMINDER

==================================================
8. PRIORITY ENUM

HIGH
MEDIUM
LOW

==================================================
9. TONE ENUM

PROFESSIONAL
FRIENDLY
FUN
PREMIUM
FESTIVAL
MINIMAL

==================================================
10. CHARACTER LIMITS

Push Title:
max 45 chars

Push Body:
max 120 chars

Expanded Body:
max 300 chars

CTA Button:
max 20 chars

==================================================
11. IMAGE SUPPORT

Supported:
PNG
JPG
WEBP

Recommended sizes:

Banner:
1200x600

Square:
1080x1080

Logo:
512x512

==================================================
12. GOLD RATE NOTIFICATION ENGINE

IMPORTANT:
Gold rates are MANUALLY UPDATED.

NOT realtime market tickers.

==================================================
13. GOLD RATE HISTORY TABLE

gold_rate_history

Fields:

id
jeweller_id nullable
previous_rate
new_rate
difference
difference_percentage
updated_by
effective_from
created_at

==================================================
14. GOLD RATE NOTIFICATION RULE

When admin/jeweller updates rate:

IF:
abs(new_rate - previous_rate)

= configured_threshold

THEN:
send notification.

==================================================
15. ADMIN SETTINGS

notification_settings

Fields:

gold_rate_threshold
portfolio_gain_threshold_amount
portfolio_gain_threshold_percentage
max_gold_alerts_per_day
max_promotional_per_week
enable_fun_notifications
enable_festival_notifications
quiet_hours_enabled

==================================================
16. GOLD RATE NOTIFICATION FORMAT

IMPORTANT:
Always show:

OLD RATE
NEW RATE
DIFFERENCE

==================================================
17. GOLD RATE EXAMPLES

“Gold rate increased ₹200/g today.
₹1000 → ₹1200”

“Today’s gold valuation updated:
₹1000/g → ₹1200/g”

“Gold prices moved upward today (+₹200/g)”

==================================================
18. PORTFOLIO GAIN ENGINE

Trigger when:

current_portfolio_value

purchase_value

crosses threshold.

==================================================
19. PORTFOLIO CALCULATION

Use:
current jeweller valuation rate

NOT realtime global spot price.

==================================================
20. PORTFOLIO GAIN EXAMPLES

“Your portfolio gained ₹1,250 today    ”

“Your gold holdings increased in value.”

“Nalla decision aayirunnu alle?
Your gold value increased today.”

“Your gold is quietly growing while you enjoy your day    ”

==================================================
21. PERSONAL HOLDING NOTIFICATIONS

“Your personal gold holdings appreciated in value.”

“The jewellery tracked in Cridora increased in estimated value.”

==================================================
22. WELCOME GOLD GIFT NOTIFICATIONS

“You received complimentary gold from ABC Jewellers    ”

“Your welcome gold reward increased in value.”

“The complimentary gold in your account appreciated today.”

==================================================
23. HUMAN / FUN NOTIFICATIONS

VERY IMPORTANT.

Goal:
Make Cridora feel caring and memorable.

==================================================
24. FUN NOTIFICATION RULES

Use sparingly.
Never spam.

Max:
1 fun notification/day.

Tone:
warm
light
human

Avoid:
cringe
excessive slang
forced memes

==================================================
25. MORNING NOTIFICATIONS

“Suprabhatham
Today’s gold rates are updated.”

“Morning check ചെയ ്‌ത ോ?

Gold valuation updated today    ”

==================================================
26. LUNCH TIME NOTIFICATIONS

“Food kazhicho?
Gold prices also had lunch break updates today.”

“Biriyani okke pinne mathi…
Portfolio nokkikko      ”

==================================================
27. TEA TIME NOTIFICATIONS

“Chaaya kudichalo?
Gold rates refreshed today.”

“Evening tea + checking portfolio.
Good combo alle?    ”

“Sheenimokke marakkalle…
Portfolioum nokkikko      ”

==================================================
28. NIGHT NOTIFICATIONS

“Sleep peacefully
Your gold portfolio is safely tracked in Cridora.”

“Today your gold stayed stronger than yesterday    ”

==================================================
29. FESTIVAL NOTIFICATIONS

Admin can:

•

send globally

•

•

send jeweller-specific

schedule campaigns

==================================================
30. FESTIVAL EXAMPLES

AKSHAYA TRITIYA:
“Celebrate Akshaya Tritiya with digital gold benefits    ”

ONAM:
“Wishing you a prosperous Onam    ”

VISHU:
“Wishing you wealth and prosperity this Vishu    ”

EID:
“Eid Mubarak from your trusted jeweller   ”

==================================================
31. JEWELLER CAMPAIGN NOTIFICATIONS

“0% making charges available this weekend.”

“Exclusive portfolio holder benefits available.”

“Your trusted jeweller updated today’s gold valuation.”

==================================================
32. RE-ENGAGEMENT NOTIFICATIONS

“Add ₹500 more to unlock redemption eligibility    ”

“You are close to your next gold milestone.”

“Small grams today can become big wealth tomorrow    ”

==================================================
33. PUSH DELIVERY ARCHITECTURE

Use:

Firebase Cloud Messaging (FCM)

for:

•  Android

•  PWA

•

future iOS

==================================================
34. DEVICE TOKEN TABLE

device_tokens

Fields:

id
user_id nullable
device_id
platform
fcm_token
app_version
last_seen_at
created_at

==================================================
35. PWA PUSH FLOW

Browser requests permission.
Store push token.
Associate token with:

•  user
OR

•  anonymous install

==================================================
36. NOTIFICATION PIPELINE

Admin/Jeweller Action
→ Notification Created
→ Audience Resolver
→ Queue Job
→ Push Delivery
→ Delivery Tracking
→ User Click Tracking

==================================================
37. QUEUE SYSTEM

Use:
background jobs/queues

Examples:
BullMQ
Redis queues
Laravel queues
RabbitMQ

Never send synchronously.

==================================================
38. USER PREFERENCES

Users can toggle:

•  promotional

•

•

jeweller campaigns

fun notifications

•  gold movement

•  portfolio alerts

Security notifications:
cannot disable.

==================================================
39. CLICK ACTIONS

Notifications can deep link to:

/portfolio
/shop
/redeem
/notifications
/product/:id
/jeweller/:id

==================================================
40. ADMIN DASHBOARD FEATURES

Admin should manage:

•

create campaigns

•  upload images

•

•

•

•

select audience

schedule notifications

see delivery stats

see click stats

•  disable campaigns

==================================================
41. JEWELLER DASHBOARD FEATURES

Jewellers can:

•

•

create promotional notifications

send offers

•  upload banners

•

•

send festive greetings

target their own users only

Admin approval optional later.

==================================================
42. ANALYTICS

Track:

delivery_rate
open_rate
click_rate
dismiss_rate
conversion_rate

==================================================
43. ANTI-SPAM RULES

IMPORTANT.

Gold Alerts:
max 2/day

Fun Notifications:
max 1/day

Promotional:
max 3/week/jeweller

Festival:
scheduled only

==================================================
44. SECURITY

Validate:

•  audience permissions

•

•

jeweller ownership

image uploads

•  notification frequency

Prevent:

•  mass spam

•  unauthorized targeting

==================================================
45. FUTURE READY FEATURES

Design extensible for:

•  AI targeting

•  engagement scoring

•  behavioural campaigns

•

•

smart reminders

referral growth

•  milestone celebrations

==================================================
46. UI/UX GOAL

The entire experience should feel like:

•

trusted

•  premium

•  warm

•  wealth-oriented

•

culturally relatable

NOT:

•

•

stock trading app

spammy fintech

•  aggressive ads

==================================================
47. MOST IMPORTANT PRODUCT PRINCIPLE

Cridora notifications should make users feel:

“Someone is helping me build gold wealth slowly and safely.”

That emotional positioning is critical.

1. NOTIFICATION SYSTEM OVERVIEW

Cridora notifications are NOT generic alerts.

The notification system is designed for:

•

customer engagement

•  portfolio psychology

•

•

•

retention

trust building

jeweller-customer bonding

•  operational updates

•  promotional engagement

Notifications should emotionally feel like:
“gold wealth relationship management”

NOT:
“app spam”.

2.  NOTIFICATION TYPES

There are 4 major notification categories:

1.  SYSTEM NOTIFICATIONS

2.  PORTFOLIO INSIGHT NOTIFICATIONS

3.  JEWELLER ENGAGEMENT NOTIFICATIONS

4.  SECURITY & COMPLIANCE NOTIFICATIONS

3.  DELIVERY CHANNELS

MVP Delivery Channels:

•

In-App Notifications

•  Push Notifications (PWA Supported)

•  Optional Email (Later)

•  Optional WhatsApp/SMS (Later)

4.  USER NOTIFICATION CENTER UI

Bell Icon Features:

•  unread count badge

•

categorized notifications

•  mark as read

•  filter by category

•  priority highlights

•

click to open related section

Notification Categories:

•  Transactions

•  Portfolio

•  Offers

•

Loans

•  Security

•

Jeweller Updates

5.  USER NOTIFICATION SCENARIOS

=========================================
A. ACCOUNT & KYC

Trigger:
Account created

Message:
“Welcome to Cridora. Your digital gold portfolio is now ready.”

Trigger:
KYC submitted

Message:
“KYC submitted successfully. Verification is in progress.”

Trigger:
KYC approved

Message:
“Your KYC has been approved. All Cridora features are now unlocked.”

Trigger:
KYC rejected

Message:
“KYC verification was rejected. Please review and re-submit the requested documents.”

=========================================
B. GOLD PURCHASES

Trigger:
Fractional purchase initiated

Message:
“Your gold purchase request has been created.”

Trigger:
Payment proof submitted

Message:
“Payment submitted successfully and awaiting jeweller verification.”

Trigger:
Payment approved

Message:
“Gold purchase approved. Your portfolio has been updated.”

Trigger:
Payment rejected

Message:
“Payment verification was rejected. Please review remarks and re-submit proof.”

Trigger:
Payment rejected twice

Message:
“Transaction placed on hold. Please visit the jeweller for manual verification.”

=========================================
C. PORTFOLIO & VALUE INSIGHTS

Trigger:
Portfolio value increased significantly

Message:
“Your gold portfolio increased by ₹2,450 this week.”

Trigger:
Gold rate increase

Message:
“Gold prices increased ₹120/g since your last purchase.”

Trigger:
Portfolio milestone reached

Message:
“Congratulations. Your portfolio crossed 25 grams.”

Trigger:
New holding added

Message:
“A new gold holding has been added to your portfolio.”

Trigger:
Personal holding added by jeweller

Message:
“Your jeweller added a personal gold holding to your portfolio.”

=========================================
D. DEPOSITS

Trigger:
Deposit initiated

Message:
“Gold deposit request submitted successfully.”

Trigger:
Deposit verified

Message:
“Your deposited gold has been verified and added to your portfolio.”

Trigger:
Deposit rejected

Message:
“Gold deposit verification was rejected. Please contact the jeweller.”

=========================================
E. GOLD TRANSFERS

Trigger:
Transfer initiated

Message:
“You are transferring gold to @username. Please verify details carefully.”

Trigger:
Transfer completed

Message:
“Gold transfer completed successfully.”

Trigger:
Gold received

Message:
“You received gold from @username.”

=========================================
F. LOAN SYSTEM

Trigger:
Loan eligibility reached

Message:
“You are eligible for a 0% gold-backed loan.”

Trigger:
Loan request submitted

Message:
“Your gold loan request has been submitted.”

Trigger:
Loan approved

Message:
“Your gold loan request has been approved.”

Trigger:
Loan rejected

Message:
“Your loan request was rejected. Please contact the jeweller.”

=========================================
G. EMERGENCY FUNDS

Trigger:
Emergency fund eligibility

Message:
“You are eligible for emergency liquidity against your gold holdings.”

Trigger:
Emergency fund approved

Message:
“Emergency funds approved successfully.”

=========================================
H. JEWELLER PROMOTIONS

Trigger:
Festival campaigns

Message:
“Exclusive festive offers now available for Cridora customers.”

Trigger:
Making charge discounts

Message:
“0% making charges available for eligible Cridora customers.”

Trigger:
New collections launched

Message:
“Your default jeweller launched new jewellery collections.”

Trigger:
Scheme reminder

Message:
“Your monthly gold scheme contribution is due.”

=========================================
I. SECURITY & ACCOUNT SAFETY

Trigger:
New device login

Message:
“New device login detected.”

Trigger:
Profile changes

Message:
“Your account details were updated successfully.”

Trigger:
Suspicious activity

Message:
“Suspicious activity detected. Please verify your account.”

6.  JEWELLER NOTIFICATION SCENARIOS

=========================================
A. CUSTOMER ACTIVITY

Trigger:
New customer joined

Message:
“A new customer joined through your jeweller profile.”

Trigger:
Customer selected as default jeweller

Message:
“You were selected as a default jeweller by a customer.”

Trigger:
Large portfolio created

Message:
“A customer portfolio crossed high-value threshold.”

=========================================
B. PAYMENT VERIFICATION

Trigger:
Payment proof submitted

Message:
“New payment awaiting verification.”

Trigger:
Fraud report raised

Message:
“A suspicious transaction was flagged.”

=========================================
C. LOANS & REDEMPTIONS

Trigger:
Loan request submitted

Message:
“New gold loan request received.”

Trigger:
Redemption request

Message:
“New redemption request received.”

=========================================
D. ENGAGEMENT INSIGHTS

Trigger:
Customer inactive

Message:
“Some customers have become inactive. Send engagement campaigns.”

Trigger:
Campaign performance

Message:
“Your latest campaign reached 420 users.”

=========================================
E. OPERATIONAL ALERTS

Trigger:
Low liquidity threshold

Message:
“Liquidity threshold nearing configured limit.”

Trigger:
Pending approvals

Message:
“You have pending verification requests.”

7.  ADMIN NOTIFICATIONS

Trigger:
Pending jeweller approval

Message:
“New jeweller onboarding awaiting review.”

Trigger:
Fraud escalation

Message:
“Fraud report submitted for treasury review.”

Trigger:
High-value activity

Message:
“High-value transaction detected.”

Trigger:
KYC backlog

Message:
“KYC approvals pending review.”

8.  USER BENEFITS

Cridora helps users:

•  Track all gold holdings digitally

•  Build a live gold portfolio

•  Buy gold fractionally

•

Join digital gold schemes

•  Access 0% gold-backed loans

•  Store jewellery bills safely

•  Track personal gold holdings

•  Monitor live estimated gold values

•  Build family wealth visibility

•  Receive portfolio insights

•  Get jeweller offers & benefits

•  Maintain long-term gold records

•  Stay connected with trusted jewellers

•  Use a modern digital gold passbook

9.  JEWELLER BENEFITS

Cridora helps jewellers:

•  Digitize customer gold relationships

•

Increase customer retention

•  Engage younger digital customers

•  Run digital gold portfolios

•

Improve repeat customer visits

•  Send targeted customer campaigns

•  Manage schemes digitally

•  Track liabilities & customer holdings

•

Increase marketplace visibility

•  Build long-term customer ecosystems

•  Maintain digital customer history

•  Enable future-ready gold infrastructure

•  Modernize without changing existing operations

10. IMPORTANT WEBSITE WORDINGS

Homepage Hero:
“Track, Grow & Manage Gold Digitally.”

Subheadline:
“A digital gold portfolio and customer engagement platform connecting users with trusted
jewellers.”

User Section:
“Your Gold. Digitally Organized.”

Jeweller Section:
“Turn one-time jewellery buyers into long-term digital customers.”

Portfolio Section:
“Track your gold holdings, personal jewellery and portfolio growth in one place.”

Loan Section:
“Access 0% gold-backed liquidity against eligible holdings.”

Trust Section:
“Built for trusted jeweller relationships — not to replace them.”

Engagement Section:
“Smart customer engagement powered by gold portfolios.”

Digital Passbook:
“A modern digital gold passbook for the next generation.”

Jeweller Positioning:
“Cridora works alongside existing jewellery businesses without changing current operations.”

Early Adoption Messaging:
“Currently onboarding Founding Jeweller Partners.”

11. IMPORTANT POSITIONING RULES

DO:

•

•

•

•

•

focus on customer retention

focus on digital modernization

focus on engagement

focus on portfolios

focus on trust

DO NOT:

•  heavily market cross redemption initially

•  position as jeweller replacement

•  position as gold exchange

•  position as nationwide liquidity engine

12. MVP NOTIFICATION PRIORITIES

Build FIRST:

•  purchase alerts

•  KYC alerts

•  payment verification alerts

•  portfolio value updates

•

•

jeweller campaigns

loan eligibility alerts

Build LATER:

•  AI insights

•  analytics

•

•

segmentation

campaign automation

•  predictive engagement

13. UX GOAL

Users should emotionally feel:

•  wealth growth

•  portfolio ownership

•

•

•

trust

long-term value

family asset visibility

Jewellers should emotionally feel:

•

customer retention

•  modernization

•  digital presence

•

customer engagement

•  business growth

The system should NEVER feel like:

•

•

spam marketing

trading platform

•  generic fintech app

It should feel like:
“A trusted digital gold relationship ecosystem.”

