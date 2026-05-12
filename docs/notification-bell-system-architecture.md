# Cridora Notification & Bell System Architecture

Reference document for future implementation. Implement individual notification types and UI as product features become available.

The bell icon in Cridora is not just a notification feature. It acts as:

- Activity center  
- Trust center  
- Portfolio intelligence center  
- Settlement communication system  
- Operational alert system  
- Engagement engine  

Each user type sees completely different notification logic.

---

## 1. User Types

### Main Notification Systems

| User Type       | Purpose                          |
|-----------------|----------------------------------|
| Public Visitor  | Onboarding & conversion          |
| Customer/User   | Portfolio & actions              |
| Jeweller        | Operations & customers           |
| Admin           | Platform control & compliance    |

---

## 2. Global Bell UI Structure

### Desktop View

Top-right navigation:

- Bell icon  
- Unread badge count  
- Dropdown panel  

### Mobile PWA View

Top-right:

- Bell icon  

Click opens:

- Full-screen notification drawer  

---

## 3. Common Notification Types

Every notification contains:

| Field        | Purpose              |
|--------------|----------------------|
| Icon         | Quick understanding  |
| Title        | Short summary        |
| Description  | Details              |
| Timestamp    | Timing               |
| Status       | Read/unread          |
| CTA Button   | Take action          |
| Priority     | Critical/high/normal |

---

## 4. Priority System

| Priority | Styling        | Examples                                              |
|----------|----------------|-------------------------------------------------------|
| Critical | Red            | Fraud, failed transfers, KYC rejection, settlement failures |
| High     | Gold/Amber     | Redemption, loan approval, maturity, transfers       |
| Normal   | Grey/Blue      | Offers, campaigns, reminders                         |

---

## 5. Customer / User Notifications

### User Bell Structure — Tabs

| Tab         | Purpose              |
|-------------|----------------------|
| All         | Everything           |
| Portfolio   | Holdings             |
| Redemption  | Cash/gold/ornaments  |
| Transfers   | Gifting              |
| Loans       | Loan status          |
| Marketplace | Offers/products      |
| Security    | Login/KYC            |

### A. Portfolio Notifications

**Purpose:** Daily engagement.

**Examples**

- Gold price increased 2.1%  
- Portfolio crossed ₹50,000  
- Your holdings gained ₹1,200 today  
- BIS 916 rate updated  
- Market volatility detected  

**CTA:** View Portfolio, Buy More Gold  

### B. Purchase Notifications

**Examples**

- 0.52g added successfully  
- GST invoice generated  
- Purchase locked for 90 days  
- Gold credited to wallet  

**CTA:** Download Invoice, View Ledger  

### C. Redemption Notifications

**Ornament Redemption**

- Shop confirmed redemption  
- Ornament ready for pickup  
- Cross-jeweller fee applicable  
- Making charge waiver applied  

**Cash Redemption**

- Sellback approved  
- Current buyback rate updated  
- Funds transferred  

**Gold Redemption**

- Coin/bar available  
- Pickup scheduled  

**CTA:** Track Redemption, Contact Jeweller  

### D. Transfer Notifications

**Examples**

- You received 2g from Rahman  
- Transfer pending confirmation  
- Recipient verified successfully  
- Transfer failed due to lock-in  

**CTA:** Accept Transfer, View Ledger  

### E. Loan Notifications

**Examples**

- Eligible for ₹45,000 loan  
- Loan approved  
- 2% processing fee applied  
- Gold temporarily locked  

**CTA:** View Loan, Repay Now  

### F. Emergency Fund Notifications

**Examples**

- Emergency funds approved  
- 80% portfolio eligibility available  
- Gold collateral consumed  

**CTA:** Withdraw Funds, View Details  

### G. GoldNest Scheme Notifications

**Examples**

- Installment due tomorrow  
- Scheme matured successfully  
- MC waiver eligibility unlocked  
- Missed contribution alert  

**CTA:** Pay Installment, Redeem Scheme  

### H. Marketplace Notifications

**Examples**

- New bridal collection added  
- 0% making charge weekend  
- Festival offer live  
- Your default jeweller added products  

**CTA:** Shop Now, View Collection  

### I. Security Notifications

**Examples**

- New device login  
- KYC approved  
- PAN verified  
- Password changed  

**CTA:** Review Activity  

---

## 6. Jeweller Notifications

### Jeweller Bell Structure — Tabs

| Tab         | Purpose              |
|-------------|----------------------|
| Customers   | Customer activities  |
| Redemption  | Fulfillment          |
| Settlements | Balances             |
| Schemes     | GoldNest             |
| Inventory   | Stock                |
| Compliance  | KYC/GST              |
| Marketplace | Products/offers      |

### A. Customer Activity

**Examples**

- New user selected your store  
- User purchased 15g  
- VIP customer joined  
- Referral signup completed  

**CTA:** View Customer  

### B. Redemption Notifications

**Examples**

- Ornament redemption request received  
- Cross-jeweller redemption incoming  
- Gold pickup scheduled  
- Sellback request pending  

**CTA:** Approve Request, Manage Redemption  

### C. Settlement Notifications

**Examples**

- Settlement received from Cridora  
- Liability imbalance warning  
- Daily reconciliation complete  
- Cross-redemption pending  

**CTA:** View Ledger, Resolve Issue  

### D. Inventory Notifications

**Examples**

- BIS 916 inventory low  
- High redemption demand  
- Sellback demand increasing  
- Excess liability accumulation  

**CTA:** Manage Inventory  

### E. GoldNest Scheme Notifications

**Examples**

- New scheme awaiting approval  
- Customer nearing maturity  
- High MC waiver exposure  
- Installment defaults rising  

**CTA:** View Scheme  

### F. Marketplace Notifications

**Examples**

- Product trending in your district  
- Offer campaign performing well  
- Marketplace traffic increased  

**CTA:** Promote Product  

### G. Compliance Notifications

**Examples**

- GST mismatch detected  
- KYC pending review  
- AML flag triggered  

**CTA:** Resolve Compliance Issue  

---

## 7. Admin Notifications

### Admin Bell Structure — Tabs

| Tab         | Purpose               |
|-------------|-----------------------|
| KYC         | Approvals             |
| Risk        | Fraud/liquidity       |
| Settlements | Network balancing     |
| Jewellers   | Operations            |
| Users       | Escalations           |
| Marketplace | Moderation            |
| System      | Technical alerts      |

### A. KYC & Compliance

**Examples**

- New jeweller onboarding  
- PAN mismatch detected  
- AML review required  
- High-risk user flagged  

**CTA:** Review KYC  

### B. Fraud & Risk

**Examples**

- Circular arbitrage suspected  
- Sudden redemption spike  
- Multiple linked accounts  
- Abnormal transfer patterns  

**CTA:** Investigate  

### C. Settlement Alerts

**Examples**

- Jeweller liquidity stress  
- Settlement failure  
- Ledger imbalance  
- Redemption backlog  

**CTA:** Resolve Settlement  

### D. System Alerts

**Examples**

- Notification service degraded  
- API latency high  
- Payment gateway issue  
- Server anomaly detected  

**CTA:** Open Monitoring  

### E. Marketplace Moderation

**Examples**

- Product pending approval  
- Suspicious pricing  
- Offer policy violation  

**CTA:** Moderate Listing  

---

## 8. Public Visitor Notifications

Only if logged in but not onboarded.

**Examples**

- KYC pending  
- Waitlist approved  
- New jeweller joined nearby  
- Gold rate alerts  

**CTA:** Complete Onboarding  

---

## 9. Smart Notification Features

### A. Real-Time Gold Alerts

Users can configure:

- Notify above ₹X  
- Notify below ₹X  
- Daily summary  
- Volatility alerts  

### B. Geo-Based Alerts

**Examples**

- Jeweller nearby added offer  
- Store near you supports instant redemption  

### C. AI-Based Insights (Future)

**Examples**

- “Your portfolio can redeem 12g without extra MC.”  
- “Gold rates dipped today.”  

---

## 10. Bell Dropdown Design

### Header

Shows:

- Total unread count  
- Live gold ticker  
- Portfolio movement  

**Example:** Gold ↑ 1.8% Today  

### Body

Notification cards:

- Icon  
- Title  
- Description  
- Timestamp  
- CTA  

### Footer

Buttons:

- Mark all as read  
- Notification settings  
- View all  

---

## 11. Notification Settings Page

Users can enable/disable:

| Setting           | User        |
|-------------------|-------------|
| Gold alerts       | Yes         |
| Portfolio updates | Yes         |
| Offers            | Yes         |
| Transfers         | Yes         |
| Loans             | Yes         |
| Security alerts   | Mandatory   |

---

## 12. Important Product Strategy

The bell icon should create:

**For Users**

- Emotional engagement  
- Daily app opens  
- Investment attachment  

**For Jewellers**

- Operational awareness  
- Customer retention  

**For Admins**

- Risk visibility  
- Control tower operations  

---

## Final Positioning

The Cridora notification system should feel like:

**Bloomberg + Zerodha + Banking + Gold Marketplace** combined into one live operational inbox.

---

## Implementation Notes (for later)

- Current frontend scaffold: `frontend/src/components/NotificationBell.tsx` (mock data; `/api/notifications/` pending).  
- Implement notification types and bell UX incrementally as backend events and features ship.  
- Prefer one persisted inbox API with filters for tabs, priority, and audience—not duplicate feeds per tab unless required.
