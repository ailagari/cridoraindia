# Cridora public pages — English copy for Malayalam translation

Use this file to supply Malayalam translations. Each entry has:

- **Key** — identifier in `frontend/src/i18n/messages/en.ts` (Malayalam goes in `ml.ts` with the same key)
- **English** — current English string

**Placeholders** — keep unchanged in Malayalam: `{interval}`, `{mins}`, `{hrs}`, `{count}`

**Malayalam-only accents** — keys ending in `mlAccent` are empty in English; they only appear when the user selects Malayalam. You can write Malayalam for those keys without an English equivalent.

**Hardcoded section (appendix)** — pages that still use English strings in source files, not i18n yet. Optional: you can translate those here and we wire them into i18n later.

---

## Language switcher

| Key | English |
|-----|---------|
| `lang.en` | English |
| `lang.ml` | Malayalam |
| `lang.switchLabel` | Language |

---

## Navigation

| Key | English |
|-----|---------|
| `nav.home` | Home |
| `nav.howItWorks` | How it works |
| `nav.jewellers` | Jewellers |
| `nav.products` | Products |
| `nav.cart` | Cart |
| `nav.waitlist` | Waitlist |
| `nav.dashboard` | Dashboard |
| `nav.login` | Login |
| `nav.signUp` | Sign up |
| `nav.applyJeweller` | Apply as Jeweller |
| `nav.logOut` | Log out |
| `nav.guest` | Guest |

---

## Footer

| Key | English |
|-----|---------|
| `footer.blurb` | A digital gold portfolio, customer engagement & modernization platform for jewellers. Track holdings, store bills, stay connected — without replacing your existing systems. |
| `footer.platform` | Platform |
| `footer.customers` | For customers |
| `footer.company` | Company |
| `footer.home` | Home |
| `footer.discover` | What is Cridora |
| `footer.howItWorks` | How it works |
| `footer.portfolio` | Gold portfolio |
| `footer.integration` | System integration |
| `footer.trust` | Trust & safety |
| `footer.logIn` | Log in |
| `footer.signUp` | Sign up |
| `footer.findJewellers` | Find jewellers |
| `footer.marketplace` | Marketplace |
| `footer.waitlist` | Waitlist |
| `footer.forJewellers` | For jewellers |
| `footer.investors` | Investor relations |
| `footer.features` | Features |
| `footer.whyCridora` | Why Cridora |
| `footer.contact` | Contact |
| `footer.copyright` | © 2026 Cridora India. All rights reserved. |
| `footer.privacy` | Privacy policy |
| `footer.terms` | Terms of use |
| `footer.disclaimer` | Disclaimer |
| `footer.grievance` | Grievance |
| `footer.ratesNote` | Gold rates are indicative. Not SEBI regulated investment advice. |
| `footer.kycBadge` | KYC Secured |
| `footer.bisBadge` | BIS 916 |

---

## Mobile chrome

| Key | English |
|-----|---------|
| `mobile.home` | Home |
| `mobile.discover` | Discover |
| `mobile.shop` | Shop |
| `mobile.how` | How |
| `mobile.join` | Join |
| `mobile.overview` | Overview |
| `mobile.flow` | Flow |
| `mobile.hub` | Hub |
| `mobile.why` | Why |
| `mobile.features` | Features |
| `mobile.network` | Network |
| `mobile.saver` | Saver |
| `mobile.jeweller` | Jeweller |
| `mobile.users` | Users |
| `mobile.publicSite` | Public site |
| `mobile.logIn` | Log in |
| `mobile.openAccountMenu` | Open account menu |
| `mobile.closeAccountMenu` | Close account menu |
| `mobile.discoverAudience` | Discover audience |
| `mobile.shopDestination` | Shop destination |

---

## Gold rate ticker

| Key | English |
|-----|---------|
| `ticker.liveMarket` | Live market |
| `ticker.indiaFacing` | India-facing indicative ₹/g · updates every ~{interval} |
| `ticker.basis.manual` | Admin-set board rate |
| `ticker.basis.published` | Published platform rate |
| `ticker.basis.fallback` | Platform fallback rate |
| `ticker.basis.live` | Live market |

---

## Home page (landing) — Hero & strip

| Key | English |
|-----|---------|
| `idx.hero.eyebrow` | Digital gold portfolio & jeweller engagement platform |
| `idx.hero.h1` | Your Gold. |
| `idx.hero.h1em` | Digitally Visible. |
| `idx.hero.sub` | Track your holdings, store bills safely, receive calm updates, and stay connected with the jewellers you already trust — all in one modern gold experience. |
| `idx.hero.mlAccent` | *(Malayalam-only — optional poetic line; empty in English)* |
| `idx.hero.pill1` | Portfolio tracking |
| `idx.hero.pill2` | Digital bill vault |
| `idx.hero.pill3` | Jeweller-linked |
| `idx.hero.pill4` | Smart notifications |
| `idx.hero.pill5` | No ERP replacement |
| `idx.hero.cta1` | Explore platform |
| `idx.hero.cta2` | Join as jeweller |
| `idx.hero.cta3` | Join waitlist |
| `idx.hero.vaultLabel` | Total Gold Portfolio |
| `idx.hero.boardRateNote` | ≈ ₹1,05,932 at live board rate |
| `idx.hero.unrealisedPL` | Portfolio growth |
| `idx.hero.redeemable` | In-hand gold |
| `idx.hero.txn1` | Purchase recorded |
| `idx.hero.txn2` | Bill stored securely |
| `idx.fstrip.f1title` | Gold Portfolio |
| `idx.fstrip.f1sub` | Track all your gold — purchased, in-hand, and imported holdings. |
| `idx.fstrip.f2title` | Digital Bill Vault |
| `idx.fstrip.f2sub` | Store invoices safely. Never lose proof of your gold again. |
| `idx.fstrip.f3title` | Smart Notifications |
| `idx.fstrip.f3sub` | Calm updates on gold value, portfolio growth, and jeweller news. |
| `idx.fstrip.f4title` | Jeweller Engagement |
| `idx.fstrip.f4sub` | Stay digitally connected with your trusted jeweller — not a marketplace. |

---

## Home page — What is Cridora

| Key | English |
|-----|---------|
| `idx.what.eyebrow` | What is Cridora |
| `idx.what.h2` | A digital gold portfolio & modernization platform for jewellers. |
| `idx.what.sub` | Cridora is not another gold wallet or trading app. It is the digital engagement layer that helps customers track gold life and helps jewellers modernize relationships — without replacing existing software. |
| `idx.what.mlAccent` | *(Malayalam-only — optional accent; empty in English)* |
| `idx.what.c1title` | Digital engagement layer |
| `idx.what.c1desc` | Cridora sits on top of your existing jeweller relationship — adding visibility, records, and calm communication. Your jeweller stays at the centre. |
| `idx.what.c1tag` | Not a marketplace · Not a jeweller replacement |
| `idx.what.c2title` | Portfolio tracking platform |
| `idx.what.c2desc` | See every gram — purchased gold, in-hand ornaments, imported membership holdings — with live valuation in one calm dashboard. |
| `idx.what.c2tag` | One view · Live rates |
| `idx.what.c3title` | Customer relationship platform |
| `idx.what.c3desc` | Jewellers reach customers with festive greetings, rate updates, and scheme reminders — warm engagement, not aggressive marketing. |
| `idx.what.c3tag` | Retention · Loyalty |
| `idx.what.c4title` | Modernization infrastructure |
| `idx.what.c4desc` | Link existing membership IDs, import Excel records, and auto-create portfolios. No need to replace your current ERP or billing software. |
| `idx.what.c4tag` | Works with what you have |
| `idx.what.c5title` | Trust-first design |
| `idx.what.c5desc` | KYC-verified accounts, OTP-secured actions, BIS 916 records, and full audit trails. Premium, calm, and transparent. |
| `idx.what.c5tag` | Secure · Auditable |

---

## Home page — Customer benefits

| Key | English |
|-----|---------|
| `idx.cust.eyebrow` | For customers |
| `idx.cust.h2` | Track your gold life — simply and beautifully. |
| `idx.cust.sub` | Everything you love about gold, made visible. No crypto vibes, no trading screens — just your gold, your jeweller, your peace of mind. |
| `idx.cust.c1title` | See all your gold in one place |
| `idx.cust.c1desc` | Purchased gold, in-hand ornaments, scheme savings, and imported jeweller holdings — unified in one portfolio. |
| `idx.cust.c2title` | Know your gold net worth |
| `idx.cust.c2desc` | Live board-rate valuation shows what your gold is worth today — updated calmly, never aggressively. |
| `idx.cust.c3title` | Store bills digitally |
| `idx.cust.c3desc` | Invoices and purchase proofs live in a secure digital vault — ready for insurance, resale, or family records. |
| `idx.cust.c4title` | Stay connected with your jeweller |
| `idx.cust.c4desc` | Receive updates from the jewellers you trust — festive wishes, scheme reminders, and calm gold value alerts. |
| `idx.cust.c5title` | Emotionally intelligent experience |
| `idx.cust.c5desc` | Built for Kerala families and Indian gold culture — warm, premium, and respectful of how gold really matters. |

---

## Home page — Personal holdings

| Key | English |
|-----|---------|
| `idx.hold.eyebrow` | Personal holdings |
| `idx.hold.h2` | Every gram you own — tracked with care. |
| `idx.hold.sub` | Whether gold is in your locker, at the jeweller, or still in a savings scheme — Cridora brings it all into one personal view. |
| `idx.hold.mlAccent` | *(Malayalam-only — optional accent; empty in English)* |
| `idx.hold.c1title` | In-hand gold |
| `idx.hold.c1desc` | Record ornaments and physical gold you keep at home — with weight, purity, and valuation. |
| `idx.hold.c2title` | Purchased gold |
| `idx.hold.c2desc` | Every store purchase and fractional buy logged automatically with jeweller and date. |
| `idx.hold.c3title` | Imported jeweller holdings |
| `idx.hold.c3desc` | Existing membership scheme balances linked by your jeweller — no re-entry needed. |
| `idx.hold.c4title` | Total gold net worth |
| `idx.hold.c4desc` | One number that reflects your complete gold life — updated at live board rates. |

---

## Home page — Bill vault

| Key | English |
|-----|---------|
| `idx.bills.eyebrow` | Digital bill vault |
| `idx.bills.h2` | Your gold proof — safe forever. |
| `idx.bills.sub` | Bills get lost. Drawers get cleared. Cridora keeps every invoice digitally — so your gold always has proof behind it. |
| `idx.bills.mlAccent` | *(Malayalam-only — optional accent; empty in English)* |
| `idx.bills.c1title` | Store invoices digitally |
| `idx.bills.c1desc` | Upload or auto-capture purchase bills from partner jewellers — hallmark, weight, and value preserved. |
| `idx.bills.c2title` | Never lose gold proof |
| `idx.bills.c2desc` | Insurance claims, resale, and family inheritance all need records. Your vault is always accessible. |
| `idx.bills.c3title` | Future-ready records |
| `idx.bills.c3desc` | Every bill linked to your portfolio — today's purchases become tomorrow's trusted history. |

---

## Home page — Notifications

| Key | English |
|-----|---------|
| `idx.notif.eyebrow` | Smart notifications |
| `idx.notif.h2` | Calm updates on the gold you care about. |
| `idx.notif.sub` | No trading alerts. No panic push notifications. Just thoughtful updates that help you feel connected to your gold life. |
| `idx.notif.mlAccent` | *(Malayalam-only — optional accent; empty in English)* |
| `idx.notif.c1title` | Gold value updates |
| `idx.notif.c1desc` | Gentle alerts when your portfolio value moves — so you always know, never surprised. |
| `idx.notif.c2title` | Portfolio growth alerts |
| `idx.notif.c2desc` | Celebrate milestones as your gold savings grow — scheme completions and gram targets. |
| `idx.notif.c3title` | Festive greetings |
| `idx.notif.c3desc` | Onam, Vishu, weddings — your jeweller reaches you warmly through Cridora. |
| `idx.notif.c4title` | Jeweller updates |
| `idx.notif.c4desc` | Scheme reminders, new collections, and store news from jewellers you already trust. |

---

## Home page — Gold portfolio mock

| Key | English |
|-----|---------|
| `idx.port.eyebrow` | Gold portfolio |
| `idx.port.h2` | Your complete gold net worth — one calm view. |
| `idx.port.sub` | Live valuation, gram-by-gram history, and growth tracking — designed to feel premium, not like a trading terminal. |
| `idx.port.vaultLabel` | Your portfolio · Malabar Gold |
| `idx.port.inHandLabel` | In-hand |
| `idx.port.purchasedLabel` | Purchased |
| `idx.port.importedLabel` | Imported |
| `idx.port.growthLabel` | Portfolio growth |
| `idx.port.totalLabel` | Total net worth |

---

## Home page — System integration

| Key | English |
|-----|---------|
| `idx.integr.eyebrow` | Works with existing jeweller systems |
| `idx.integr.h2` | Modernize without replacing what already works. |
| `idx.integr.sub` | Cridora integrates with your current workflow — membership IDs, ERP exports, and Excel records. No rip-and-replace. No disruption. |
| `idx.integr.mlAccent` | *(Malayalam-only — optional accent; empty in English)* |
| `idx.integr.c1title` | Existing membership IDs supported |
| `idx.integr.c1desc` | Link customers by their current scheme or membership number — continuity from day one. |
| `idx.integr.c2title` | ERP exports supported |
| `idx.integr.c2desc` | Import customer records from your existing billing or ERP system — mapped automatically. |
| `idx.integr.c3title` | Excel imports supported |
| `idx.integr.c3desc` | Upload a spreadsheet of customers and holdings — Cridora creates portfolios instantly. |
| `idx.integr.c4title` | No software replacement |
| `idx.integr.c4desc` | Keep your current POS, billing, and accounting tools. Cridora adds the digital layer on top. |

---

## Home page — Membership systems banner

| Key | English |
|-----|---------|
| `idx.member.eyebrow` | Already have membership systems? |
| `idx.member.h2` | Cridora works alongside — not instead of. |
| `idx.member.sub` | Your customers keep their existing IDs. Your staff keep their familiar tools. Cridora adds digital portfolios and engagement on top. |
| `idx.member.c1` | Link existing customer IDs |
| `idx.member.c2` | Import Excel records in minutes |
| `idx.member.c3` | Auto-create customer portfolios |
| `idx.member.c4` | Modernize engagement without workflow change |

---

## Home page — How it works

| Key | English |
|-----|---------|
| `idx.how.eyebrow` | How it works |
| `idx.how.h2` | Simple steps for customers and jewellers. |
| `idx.how.sub` | Two calm flows — one platform. No complexity, no disruption. |
| `idx.how.customerTitle` | Customer flow |
| `idx.how.jewellerTitle` | Jeweller flow |
| `idx.how.cs1title` | Create account |
| `idx.how.cs1desc` | Sign up with phone and KYC — takes under 3 minutes. |
| `idx.how.cs2title` | Link jeweller |
| `idx.how.cs2desc` | Connect to your trusted jeweller from the verified directory. |
| `idx.how.cs3title` | Track gold |
| `idx.how.cs3desc` | See holdings, live value, and growth in your personal portfolio. |
| `idx.how.cs4title` | Store bills |
| `idx.how.cs4desc` | Upload or auto-save invoices to your digital bill vault. |
| `idx.how.cs5title` | Receive updates |
| `idx.how.cs5desc` | Get calm notifications on value, schemes, and jeweller news. |
| `idx.how.js1title` | Join Cridora |
| `idx.how.js1desc` | Apply as a partner jeweller — KYB verified before listing. |
| `idx.how.js2title` | Upload / import customers |
| `idx.how.js2desc` | Excel import or ERP export — customer records mapped in minutes. |
| `idx.how.js3title` | Link membership IDs |
| `idx.how.js3desc` | Existing scheme numbers connect automatically — no customer re-registration. |
| `idx.how.js4title` | Engage digitally |
| `idx.how.js4desc` | Send notifications, festive greetings, and scheme updates to customers. |
| `idx.how.js5title` | Build stronger loyalty |
| `idx.how.js5desc` | Modern digital experience that keeps customers coming back to your showroom. |

---

## Home page — Jeweller benefits

| Key | English |
|-----|---------|
| `idx.jw.eyebrow` | For jewellers |
| `idx.jw.h2` | Modernize customer relationships — without changing your business. |
| `idx.jw.sub` | Cridora helps jewellers retain customers, increase engagement, and add digital visibility — while keeping existing membership systems and workflows intact. |
| `idx.jw.mlAccent` | *(Malayalam-only — optional accent; empty in English)* |
| `idx.jw.f1title` | Customer retention |
| `idx.jw.f1desc` | Digital portfolios and scheme tracking keep customers emotionally connected to your brand. |
| `idx.jw.f2title` | Digital engagement |
| `idx.jw.f2desc` | Festive greetings, rate updates, and scheme reminders — warm outreach that builds loyalty. |
| `idx.jw.f3title` | Existing customer continuity |
| `idx.jw.f3desc` | Import membership IDs and Excel records — your current customers appear on day one. |
| `idx.jw.f4title` | No ERP replacement |
| `idx.jw.f4desc` | Keep your billing, POS, and accounting tools. Cridora is the engagement layer, not a replacement. |
| `idx.jw.f5title` | Notification system |
| `idx.jw.f5desc` | Reach customers with calm, permission-based updates — not spam, not trading alerts. |
| `idx.jw.f6title` | Digital portfolio experience |
| `idx.jw.f6desc` | Give customers a premium gold tracking experience linked to your showroom. |
| `idx.jw.cta1` | Apply as jeweller → |
| `idx.jw.cta2` | Learn more |
| `idx.jw.mockDeskTitle` | Today's engagement |
| `idx.jw.mockCustomers` | Active customers |
| `idx.jw.mockNotifications` | Notifications sent |
| `idx.jw.mockPortfolios` | Portfolios linked |
| `idx.jw.mockNewCustomers` | New this week |
| `idx.jw.mockRate22k` | 22K rate |
| `idx.jw.mockBuyback` | Buyback |
| `idx.jw.mockMaking` | Making |

---

## Home page — Trust & modernization

| Key | English |
|-----|---------|
| `idx.modern.eyebrow` | Trusted jeweller modernization |
| `idx.modern.h2` | Built for trust. Designed for continuity. |
| `idx.modern.sub` | Cridora is infrastructure for the jeweller-customer bond — not a competitor, not a replacement, not a trading exchange. |
| `idx.modern.t1title` | KYC verified accounts |
| `idx.modern.t1desc` | Every customer is a real person — PAN, Aadhaar, and selfie verified before any transaction. |
| `idx.modern.t2title` | BIS 916 hallmarked records |
| `idx.modern.t2desc` | Purity and hallmark data preserved for every recorded purchase and deposit. |
| `idx.modern.t3title` | Jeweller KYB verification |
| `idx.modern.t3desc` | Every partner jeweller verified — GST, shop registration, and physical inspection. |
| `idx.modern.t4title` | End-to-end audit trail |
| `idx.modern.t4desc` | Every action logged with timestamps, rates, and reference IDs — immutable record. |
| `idx.modern.t5title` | OTP-secured actions |
| `idx.modern.t5desc` | Physical transactions require active confirmation — your gold cannot move without you. |
| `idx.modern.t6title` | No hidden charges |
| `idx.modern.t6desc` | Transparent fees shown upfront. No surprises, no aggressive upselling. |

---

## Home page — FAQ

| Key | English |
|-----|---------|
| `idx.faq.eyebrow` | FAQ |
| `idx.faq.h2` | Questions jewellers and customers ask. |
| `idx.faq.sub` | Practical answers about how Cridora works with your existing gold life and business. |
| `idx.faq.q1` | Is Cridora replacing jeweller software? |
| `idx.faq.a1` | No. Cridora is a digital engagement and portfolio layer that works alongside your existing billing, POS, and membership systems — not instead of them. |
| `idx.faq.q2` | Can existing membership IDs be used? |
| `idx.faq.a2` | Yes. Cridora links customers by their current scheme or membership number. Your customers keep the IDs they already know. |
| `idx.faq.q3` | Can jewellers upload Excel data? |
| `idx.faq.a3` | Yes. Upload a spreadsheet of customers and holdings — Cridora maps records and auto-creates digital portfolios in minutes. |
| `idx.faq.q4` | Is personal gold transferable? |
| `idx.faq.a4` | Gold tracked in Cridora remains linked to your jeweller relationship. Transfer and redemption options depend on your jeweller's policies and Cridora features enabled for their store. |
| `idx.faq.q5` | Can bills be stored? |
| `idx.faq.a5` | Yes. The Digital Bill Vault lets you store invoices and purchase proofs securely — linked to your portfolio for insurance and records. |
| `idx.faq.q6` | How are notifications sent? |
| `idx.faq.a6` | Calm, permission-based push and in-app notifications — gold value updates, portfolio milestones, festive greetings, and jeweller news. No trading alerts. |
| `idx.faq.q7` | Is this free for jewellers initially? |
| `idx.faq.a7` | Early partner jewellers join during our launch phase with introductory access. Contact us via the waitlist or jeweller application for current partner terms. |

---

## Home page — CTA

| Key | English |
|-----|---------|
| `idx.cta.eyebrow` | Start your gold experience |
| `idx.cta.h2` | Track your gold life. Modernize your jeweller bond. |
| `idx.cta.sub` | Join customers and jewellers building a calmer, more visible gold future — starting in Kerala, built for all of India. |
| `idx.cta.mlAccent` | *(Malayalam-only — optional accent; empty in English)* |
| `idx.cta.placeholder` | +91 mobile number or email |
| `idx.cta.btn` | Get started → |
| `idx.cta.btnJeweller` | Apply as jeweller |
| `idx.cta.btnWaitlist` | Join waitlist |
| `idx.cta.note` | Free to explore. KYC takes under 3 minutes. No credit card required. |
| `idx.cta.stat1label` | Portfolio tracking |
| `idx.cta.stat2label` | To complete KYC |
| `idx.cta.stat3label` | ERP replacement needed |
| `idx.cta.stat4label` | Verified partner stores |

---

## How it works page (`/how-it-works`)

| Key | English |
|-----|---------|
| `how.eyebrow` | How it works |
| `how.heroTitle` | How Cridora Works |
| `how.heroLead` | A trusted gold infrastructure connecting customers and verified jewellers. |
| `how.customersHeading` | For Customers |
| `how.customerStep1Title` | Discover verified jewellers |
| `how.customerStep1Body` | Browse jeweller storefronts, gold products, and partner vaults. |
| `how.customerStep2Title` | Save gold digitally |
| `how.customerStep2Body` | Buy gold in small amounts using supported payment methods through partner jewellers. |
| `how.customerStep3Title` | Track your vault |
| `how.customerStep3Body` | Your holdings are tracked digitally in grams and linked to custodians. |
| `how.customerStep4Title` | Use your gold |
| `how.customerStep4Body` | Redeem, transfer, sell back, or apply vault gold toward jewellery purchases. |
| `how.jewellersHeading` | Built for real showroom workflows. |
| `how.jewellersIntro` | Cridora supports practical jeweller operations including: |
| `how.jewellersFeature1` | Counter billing |
| `how.jewellersFeature2` | OTP-based verification |
| `how.jewellersFeature3` | UPI-based purchases |
| `how.jewellersFeature4` | Customer vault management |
| `how.jewellersFeature5` | Sellback workflows |
| `how.jewellersFeature6` | Gold deposits |
| `how.jewellersFeature7` | Digital storefronts |
| `how.jewellersClosing` | Jewellers remain central to the customer relationship. |
| `how.vaultHeading` | What is a gold vault? |
| `how.vaultIntro` | A vault represents digitally tracked gold holdings connected to a custodian jeweller. |
| `how.vaultCustomersHeading` | Customers can: |
| `how.vaultCustomer1` | View holdings in grams |
| `how.vaultCustomer2` | Track transactions |
| `how.vaultCustomer3` | Transfer gold |
| `how.vaultCustomer4` | Redeem through partner jewellers |
| `how.vaultClosing` | Cridora acts as the technology and trust layer connecting these workflows. |
| `how.transparencyHeading` | What Cridora currently supports |
| `how.transparencyIntro` | Cridora currently supports: |
| `how.transparency1` | Verified jeweller workflows |
| `how.transparency2` | Fractional gold purchase tracking |
| `how.transparency3` | Vault ownership records |
| `how.transparency4` | Gold transfers |
| `how.transparency5` | Showroom-linked transactions |
| `how.transparency6` | UPI and counter-assisted operational flows |
| `how.transparencyNote` | Some advanced settlement and payment automation features are still evolving. |
| `how.ctaBrowse` | Explore Jewellers |
| `how.ctaWaitlist` | Join Waitlist |

---

## Jeweller directory page (`/jewellers`)

| Key | English |
|-----|---------|
| `jewellers.pill` | Verified jeweller network |
| `jewellers.heroTitle` | Partner with Cridora |
| `jewellers.heroLead` | Bring your jewellery business into the digital gold economy while keeping trust, showroom relationships, and operational control. |
| `jewellers.whyJoinTitle` | Built for jewellers, not against them. |
| `jewellers.whyJoinIntro` | Cridora helps jewellers: |
| `jewellers.whyJoin1` | Build recurring customer engagement |
| `jewellers.whyJoin2` | Offer digital gold saving experiences |
| `jewellers.whyJoin3` | Manage customer vault liabilities digitally |
| `jewellers.whyJoin4` | Increase showroom conversions |
| `jewellers.whyJoin5` | Modernize operations without replacing existing business practices |
| `jewellers.featuresTitle` | Features for Jewellers |
| `jewellers.feature1Title` | Verified storefront |
| `jewellers.feature1Body` | Build a trusted digital presence. |
| `jewellers.feature2Title` | Digital customer vaults |
| `jewellers.feature2Body` | Track customer gold holdings and transactions. |
| `jewellers.feature3Title` | Fractional gold purchases |
| `jewellers.feature3Body` | Allow customers to save gold gradually. |
| `jewellers.feature4Title` | Sellback workflows |
| `jewellers.feature4Body` | Support customer liquidity and repeat engagement. |
| `jewellers.feature5Title` | CridoraPay counter billing |
| `jewellers.feature5Body` | Connect showroom billing with customer vault gold. |
| `jewellers.feature6Title` | Gold deposits |
| `jewellers.feature6Body` | Digitize physical gold intake workflows. |
| `jewellers.feature7Title` | Loan workflows |
| `jewellers.feature7Body` | Support gold-backed customer borrowing workflows. |
| `jewellers.mattersTitle` | Traditional jewellers need digital infrastructure. |
| `jewellers.mattersIntro` | Many independent jewellers rely on: |
| `jewellers.matters1` | notebooks |
| `jewellers.matters2` | manual schemes |
| `jewellers.matters3` | WhatsApp communication |
| `jewellers.matters4` | disconnected customer records |
| `jewellers.mattersClosing` | Cridora helps digitize customer relationships while preserving jeweller trust and flexibility. |
| `jewellers.verificationTitle` | KYB verification and operational safeguards. |
| `jewellers.verification1` | Jeweller onboarding review |
| `jewellers.verification2` | KYB verification |
| `jewellers.verification3` | Operational approval flows |
| `jewellers.verification4` | Transaction audit history |
| `jewellers.verification5` | Customer verification support |
| `jewellers.directoryTitle` | Browse verified jewellers |
| `jewellers.directoryIntro` | Compare partner storefronts, gold offerings, and trust signals across the network. |
| `jewellers.closingTitle` | Join the Cridora jeweller network. |
| `jewellers.closingCta` | Apply as Jeweller |

---

## Products / marketplace intro (`/products`)

| Key | English |
|-----|---------|
| `products.pill` | Verified jewellers |
| `products.heroTitle` | Gold products and showroom experiences from verified jewellers. |
| `products.heroLead` | Explore jewellery collections, gold savings, and showroom-linked purchases through partner jewellers. |
| `products.whatYouCanDoTitle` | What you can do |
| `products.card1Title` | Save gold gradually |
| `products.card1Body` | Buy fractional gold linked to partner jewellers. |
| `products.card2Title` | Browse jewellery collections |
| `products.card2Body` | Discover products with purity, weight, and pricing details. |
| `products.card3Title` | Use vault gold |
| `products.card3Body` | Apply saved gold toward jewellery purchases. |
| `products.card4Title` | Transfer gold |
| `products.card4Body` | Send gold grams to family and trusted contacts. |
| `products.card5Title` | Sell back gold |
| `products.card5Body` | Convert vault gold through partner jeweller workflows. |
| `products.philosophyTitle` | More than an ecommerce marketplace. |
| `products.philosophyBody` | Cridora connects digital gold ownership with real showroom relationships. Instead of isolated online transactions, customers interact with verified jewellers connected to vault and redemption workflows. |
| `products.transparencyNote` | Some checkout and payment features are currently operationally assisted while platform infrastructure continues to evolve. |

---

## Waitlist page (`/waitlist`)

| Key | English |
|-----|---------|
| `waitlist.eyebrow` | Waitlist |
| `waitlist.heroTitle` | Join the future of connected gold ownership. |
| `waitlist.heroLead` | Be among the first users and jewellers joining the Cridora network. |
| `waitlist.customersTitle` | Why join early? |
| `waitlist.customers1` | Early access to verified jeweller network |
| `waitlist.customers2` | Fractional gold savings |
| `waitlist.customers3` | Vault-based gold tracking |
| `waitlist.customers4` | Gold transfers and redemption workflows |
| `waitlist.customers5` | Priority onboarding and updates |
| `waitlist.jewellersTitle` | Why jewellers are joining |
| `waitlist.jewellers1` | Digital customer engagement |
| `waitlist.jewellers2` | Modern gold-saving workflows |
| `waitlist.jewellers3` | Showroom-linked infrastructure |
| `waitlist.jewellers4` | Verified marketplace presence |
| `waitlist.jewellers5` | Access to future network features |
| `waitlist.customerPlaceholder` | Enter your mobile number or email |
| `waitlist.jewellerPlaceholder` | Business name and contact details |
| `waitlist.joinButton` | Join Waitlist |
| `waitlist.customerCardTitle` | For customers |
| `waitlist.jewellerCardTitle` | For jewellers |

---

## Jeweller apply page (`/jeweller/apply`)

| Key | English |
|-----|---------|
| `apply.eyebrow` | Jeweller partner |
| `apply.heroTitle` | Apply as a Cridora Jeweller Partner |
| `apply.heroLead` | Join a trusted digital gold network built for real jeweller workflows. |
| `apply.requirementsTitle` | Who can apply? |
| `apply.requirement1` | Registered jewellery businesses |
| `apply.requirement2` | Jewellers with operational showroom presence |
| `apply.requirement3` | Businesses willing to complete KYB verification |
| `apply.requirement4` | Jewellers interested in digital customer engagement |
| `apply.benefitsTitle` | What you get |
| `apply.benefit1` | Verified storefront |
| `apply.benefit2` | Customer vault infrastructure |
| `apply.benefit3` | Fractional gold workflows |
| `apply.benefit4` | Sellback and redemption support |
| `apply.benefit5` | Counter billing tools |
| `apply.benefit6` | Digital customer relationship layer |
| `apply.trustBody` | Cridora is designed to support jeweller-led operations instead of replacing traditional business relationships. Partner jewellers remain central to customer trust, fulfillment, and showroom experience. |
| `apply.finalTitle` | Start your jeweller onboarding. |
| `apply.finalCta` | Apply Now |
| `apply.formEyebrow` | Application form |
| `apply.formTitle` | Create your jeweller account |
| `apply.retailPrompt` | Retail customer? |
| `apply.signUpLink` | Sign up |

---

## Login & signup

| Key | English |
|-----|---------|
| `auth.account` | Account |
| `auth.welcomeBack` | Welcome back |
| `auth.loginSubheadline` | Access your gold vault, jeweller dashboard, and Cridora services. |
| `auth.loginTrustNote` | Protected access for customers and verified jeweller accounts. |
| `auth.email` | Email |
| `auth.password` | Password |
| `auth.signIn` | Sign in |
| `auth.signInFailed` | Sign in failed |
| `auth.noAccount` | No account? |
| `auth.createOne` | Create one |
| `auth.joinTitle` | Create your Cridora account |
| `auth.signupSubheadline` | Start your digital gold journey with verified jewellers. |
| `auth.signupBenefit1` | Save gold digitally |
| `auth.signupBenefit2` | Track vault holdings |
| `auth.signupBenefit3` | Transfer gold |
| `auth.signupBenefit4` | Use gold in showrooms |
| `auth.signupBenefit5` | Access verified jeweller network |
| `auth.signUp` | Sign up |
| `auth.signUpFailed` | Sign up failed |
| `auth.newHere` | New here? |
| `auth.createCustomer` | Create a customer account |
| `auth.applyJewellerShort` | apply as a jeweller |
| `auth.onboarding` | Customer onboarding |
| `auth.createAccount` | Create account |
| `auth.firstName` | First name |
| `auth.lastName` | Last name |
| `auth.mobile` | Mobile |
| `auth.registrationFailed` | Registration failed |
| `auth.jewellerPrompt` | Jeweller? |
| `auth.applyKyb` | Apply for KYB |

---

## Notifications (public chrome)

| Key | English |
|-----|---------|
| `notifications.alerts` | Alerts |
| `notifications.markRead` | Mark read |
| `notifications.justNow` | Just now |
| `notifications.minutesAgo` | {mins}m ago |
| `notifications.hoursAgo` | {hrs}h ago |
| `notifications.noAlerts` | No alerts yet. |
| `notifications.noMatch` | No alerts match this view. |
| `notifications.allCaughtUp` | You're all caught up — nothing unread. |
| `notifications.signInForAlerts` | Sign in to see your alerts, or enable push for gold rate updates. |
| `notifications.noBroadcasts` | No broadcasts yet. After an admin sends one, it will show here. |
| `notifications.promo` | Promo |
| `notifications.turnOn` | Turn on device notifications |
| `notifications.turnOnTray` | Turn on tray notifications |
| `notifications.turningOn` | Turning on… |
| `notifications.trayRegion` | Device notification tray |
| `notifications.trayOn` | Tray notifications on |
| `notifications.trayOnDetail` | Alerts appear in your phone or system notification tray. |
| `notifications.trayOff` | Notification tray |
| `notifications.trayBlocked` | Tray notifications blocked |
| `notifications.openSettings` | Open app settings |
| `notifications.blocked` | Notifications blocked — allow them in your browser or system settings. |
| `notifications.previewOnly` | Sample alerts below are for UI preview only. |
| `notifications.unavailable` | Unavailable on this deployment. |
| `notifications.ariaLabel` | Notifications |
| `notifications.ariaLabelUnread` | Notifications, {count} unread |
| `notifications.mock.ledgerTitle` | Ledger credit |
| `notifications.mock.ledgerBody` | Fractional gold credited after UPI settlement · ref #CRD-9F2A |
| `notifications.mock.kycTitle` | KYC checkpoint |
| `notifications.mock.kycBody` | Proof of address may be required if admin requests a re-upload. |
| `notifications.mock.spotTitle` | Spot price band |
| `notifications.mock.spotBody` | Gold ₹/g moved within your alert range (illustrative demo data). |
| `notifications.mock.promoTitle` | GoldNest window |
| `notifications.mock.promoBody` | Early bird waivers on selected schemes — review before month end. |
| `notifications.mock.yesterday` | Yesterday |

---

## Legacy home keys (`home.*`)

*These exist in i18n but the main `/` route uses `idx.*` landing copy. Include if you still need them elsewhere.*

| Key | English |
|-----|---------|
| `home.tagline` | Trusted digital gold infrastructure |
| `home.positioning` | Cridora helps people save, track, and use gold digitally through verified jeweller networks. |
| `home.heroTitle` | Save Gold Digitally. Redeem with Real Jewellers. |
| `home.heroSubheadline` | Cridora helps you save gold in small amounts with verified jewellers, track your vault digitally, and redeem gold across trusted partner stores. |
| `home.heroPoint1` | Verified jeweller network |
| `home.heroPoint2` | Fractional gold savings |
| `home.heroPoint3` | Gold tracked in grams |
| `home.heroPoint4` | Redeem with partner jewellers |
| `home.heroPoint5` | Built for real showroom workflows |
| `home.ctaStartSaving` | Start Saving Gold |
| `home.ctaExploreJewellers` | Explore Jewellers |
| `home.ctaApplyJeweller` | Apply as Jeweller |
| `home.whyExistsTitle` | Gold saving in India deserves better infrastructure. |
| `home.whyExistsIntro1` | Millions of people save for jewellery, weddings, festivals, and family needs through informal gold schemes and manual records. |
| `home.whyExistsIntro2` | Cridora brings that experience into a secure digital system while keeping trusted jewellers at the center. |
| `home.whyExistsCustomersHeading` | Customers can: |
| `home.whyExistsCustomer1` | Save gold gradually |
| `home.whyExistsCustomer2` | Track holdings digitally |
| `home.whyExistsCustomer3` | Buy from verified jewellers |
| `home.whyExistsCustomer4` | Transfer gold to family |
| `home.whyExistsCustomer5` | Use vault gold for showroom purchases |
| `home.whyExistsJewellersHeading` | Jewellers can: |
| `home.whyExistsJeweller1` | Manage customer gold digitally |
| `home.whyExistsJeweller2` | Build recurring customer relationships |
| `home.whyExistsJeweller3` | Offer modern gold saving experiences |
| `home.whyExistsJeweller4` | Operate with verified trust layers |
| `home.howTitle` | How Cridora Works |
| `home.howStep1Title` | Choose a verified jeweller |
| `home.howStep1Body` | Browse partner jewellers, storefronts, and gold offerings. |
| `home.howStep2Title` | Buy or deposit gold |
| `home.howStep2Body` | Save gold in small amounts or digitize physical gold through partner jewellers. |
| `home.howStep3Title` | Track your vault |
| `home.howStep3Body` | View your gold holdings digitally in grams across custodians. |
| `home.howStep4Title` | Redeem or use your gold |
| `home.howStep4Body` | Use vault gold for jewellery purchases, transfers, or redemption. |
| `home.behaviourTitle` | Built Around Real Indian Gold Behaviour |
| `home.behaviour1Title` | Save gradually |
| `home.behaviour1Body` | Start from small amounts instead of waiting for large lump sums. |
| `home.behaviour2Title` | Family-focused |
| `home.behaviour2Body` | Useful for weddings, gifting, long-term savings, and family gold planning. |
| `home.behaviour3Title` | Real jeweller network |
| `home.behaviour3Body` | Gold relationships stay connected to trusted jewellers, not anonymous wallets. |
| `home.behaviour4Title` | Showroom redemption |
| `home.behaviour4Body` | Use saved gold during real jewellery purchases. |
| `home.behaviour5Title` | Counter-friendly workflows |
| `home.behaviour5Body` | Designed for real-world jeweller operations including UPI, OTP, and in-store verification. |
| `home.trustTitle` | Built with verification and transparency. |
| `home.trustPoint1` | Customer KYC support |
| `home.trustPoint2` | Jeweller KYB verification |
| `home.trustPoint3` | Vault-linked ownership records |
| `home.trustPoint4` | Transaction history and audit trails |
| `home.trustPoint5` | OTP verification for critical actions |
| `home.trustPoint6` | Gold tracked in grams, not reward points |
| `home.forJewellersTitle` | Bring your jewellery business online without losing customer trust. |
| `home.forJewellersBody` | Cridora helps jewellers build digital customer relationships while preserving traditional showroom operations. |
| `home.forJewellersFeature1` | Verified storefronts |
| `home.forJewellersFeature2` | Customer vault management |
| `home.forJewellersFeature3` | Fractional gold purchases |
| `home.forJewellersFeature4` | Sellback workflows |
| `home.forJewellersFeature5` | Counter billing support |
| `home.forJewellersFeature6` | Gold deposit intake |
| `home.forJewellersFeature7` | Customer engagement tools |
| `home.closingTitle` | Start building your digital gold journey. |
| `home.closingCtaWaitlist` | Join Waitlist |
| `home.closingCtaExplore` | Explore Jewellers |

---

# Appendix A — SEO (`frontend/index.html`)

| Location | English |
|----------|---------|
| `<title>` | Cridora India — Digital Gold Portfolio & Jeweller Engagement |
| `meta description` | Cridora India — digital gold portfolio, customer engagement & modernization platform for jewellers. Track gold holdings, store bills, stay connected with trusted jewellers in Kerala and across India. |
| `og:title` | Cridora India — Your Gold. Digitally Visible. |
| `og:description` | Track your gold portfolio, store bills safely, and stay connected with trusted jewellers. Modern customer engagement without replacing existing systems. |
| `twitter:title` | Cridora India — Digital Gold Portfolio Platform |
| `twitter:description` | A digital gold portfolio & jeweller engagement platform. Track holdings, store bills, modernize customer relationships. |

---

# Appendix B — Hardcoded English (not in i18n yet)

## Discover page (`DiscoverPage.tsx`)

| ID | English |
|----|---------|
| discover.pill | Discover |
| discover.h1.desktop | Who Cridora is for |
| discover.lead.desktop | Explore benefits tailored to savers and to partner jewellers — one platform, two clear value stories. |
| discover.card.customers.title | For customers |
| discover.card.customers.body | Savings, live portfolio, nationwide redemption, and physical jewellery — see why savers join. |
| discover.card.customers.cta | View benefits |
| discover.card.jewellers.title | For jewellers |
| discover.card.jewellers.body | Acquisition, retention, marketplace visibility, and digital ops — see why stores partner. |
| discover.card.jewellers.cta | View benefits |
| discover.h1.mobile.jewellers | For jewellers |
| discover.h1.mobile.customers | For users |
| discover.lead.mobile.jewellers | Why partner stores join Cridora — acquisition, retention, and digital rails in one place. |
| discover.lead.mobile.customers | Why savers choose Cridora — real grams, nationwide redemption, and physical jewellery. |
| discover.footer.link.features | Platform features |
| discover.footer.link.how | How it works |

## Why Cridora page (`WhyCridoraPage.tsx` + `discoverBenefits.ts`)

| ID | English |
|----|---------|
| why.pill | Why Cridora |
| why.h1 | One platform for India's gold savings |
| why.positioning | A live gold utility and redemption ecosystem — not simple balance-only digital gold, not stocks, ETFs, or commodity day-trading. |
| why.section.why | Why Cridora? |
| why.section.why.lead | Cridora is designed to solve the biggest problems in India's fragmented gold savings and jewellery ecosystem by combining five pillars into one unified experience. |
| why.pillar1.title | Digital flexibility |
| why.pillar1.hint | Save and move gold like software — grams, not opaque points. |
| why.pillar2.title | Physical redemption |
| why.pillar2.hint | Jewellery, ornaments, coins, and bars from real storefronts. |
| why.pillar3.title | Jeweller interoperability |
| why.pillar3.hint | Nationwide partners with settlement handled on-platform. |
| why.pillar4.title | Liquidity access |
| why.pillar4.hint | Sellback, loans, and emergency paths without leaving the network. |
| why.pillar5.title | Nationwide usability |
| why.pillar5.hint | Compare, switch, and redeem without one-shop lock-in. |
| why.users.heading | Why users will join Cridora |
| why.jewellers.heading | Why jewellers will join Cridora |
| why.wins.heading | Why Cridora wins |
| why.wins.network.title | Network effects |
| why.wins.network.body | More jewellers attract more users; more users attract more jewellers — compounding adoption. |
| why.wins.asset.title | Asset-light model |
| why.wins.asset.body | No need to own vaults, inventory, or manufacturing — Cridora scales as infrastructure. |
| why.wins.revenue.title | Recurring revenue |
| why.wins.revenue.body | Sustainable economics from transaction fees, cross-redemption fees, subscriptions, marketplace placements, emergency services, and settlement tooling. |
| why.wins.revenue.li1 | Transaction & cross-redemption fees |
| why.wins.revenue.li2 | SaaS or platform subscriptions |
| why.wins.revenue.li3 | Marketplace promotions |
| why.wins.revenue.li4 | Emergency-fund and settlement services |
| why.wins.infra.title | Infrastructure positioning |
| why.wins.infra.body | Cridora is the interoperability layer — jeweller OS, settlement network, and distributed gold ecosystem — not "just another gold app." |
| why.ships.title | What ships today |
| why.ships.body | Three holding types on every ledger: fractional gold, gold deposit, and GoldNest. Messaging stays simple — buy gold, track it, use it, redeem across the jeweller network. Surfaces today centre on BIS 916 gold in India; other metals and purities stay off public flows until the product expands. |
| why.nationwide.title | Nationwide redemption |
| why.nationwide.body | Spend holdings at any partnered jeweller; Cridora settles liability between stores so customers are not manual couriers of inter-shop metal. |
| why.not.title | Cridora is not |
| why.not.li1 | the stock market or equity apps |
| why.not.li2 | an ETF or paper gold wrapper |
| why.not.li3 | a commodity day-trading product |
| why.not.li4 | generic balance-only "digital gold" without redemption utility |
| why.not.li5 | a bank, NBFC, or deposit-taking institution |
| why.is.title | Cridora is |
| why.is.li1 | a live gold savings, portfolio, and redemption network |
| why.is.li2 | jeweller-backed grams with ornament and cash paths |
| why.is.li3 | nationwide usability with cross-jeweller settlement |
| why.is.li4 | liquidity without selling (loans, emergency funds) |
| why.is.li5 | technology infrastructure for trusted retail jewellers |
| why.custody.title | Distributed custody |
| why.custody.body | Jewellers are custodians and redemption operators; Cridora runs ledgers, settlement routing, compliance, reconciliation, and customer UX. Listings stay private until admin approval. |
| why.cta.features | Platform features |
| why.cta.jewellers | Jeweller marketplace |

### User reasons (`USER_REASONS` in `discoverBenefits.ts`)

| # | Title | Body |
|---|-------|------|
| 1 | Buy gold in any amount | Start from ₹10, ₹500, or ₹1,000 — no large lump sums required. Gold savings stay within reach. |
| 2 | Real gold in grams | Hold actual quantity in grams, not abstract rewards. Value tracks live gold prices. |
| 3 | Live portfolio tracking | See live value, profit/loss, redeemable quantity, and jeweller-wise holdings as they update. |
| 4 | Nationwide redemption | Buy from one partner jeweller and redeem through another across India — less location lock-in. |
| 5 | Physical jewellery redemption | Convert holdings to BIS 916 ornaments and coins from real jewellers — designed around jewellery you wear or gift, not a passive balance line. |
| 6 | Better making-charge benefits | Redeeming with the same jeweller can unlock reduced making, loyalty perks, and offers. |
| 7 | Gold as emergency money | Sell for cash, borrow against holdings, or use Cridora-assisted emergency liquidity when life hits. |
| 8 | Zero-interest loans | Borrow interest-free against eligible gold with instant utilisation and a flat processing fee — a sharp differentiator. |
| 9 | Gold transfer & gifting | Gift or transfer grams instantly — weddings, family, friends — gold that moves like trusted money. |
| 10 | Deposit gold you already own | Bring verified physical gold in and credit your portfolio for one unified vault experience. |
| 11 | Choose between jewellers | Compare trust scores, pricing, lock-ins, redemption rules, sellback, and making charges in one place. |
| 12 | Not locked to one shop | Avoid schemes that trap savings in a single store, city, or path. |
| 13 | Safer than speculative markets | Gold stays tangible, culturally understood, and physically redeemable — unlike leveraged retail trading. |
| 14 | Family & community savings | Save together, share vaults, and move grams between members for collective goals. |

### Jeweller reasons (`JEWELLER_REASONS` in `discoverBenefits.ts`)

| # | Title | Body |
|---|-------|------|
| 1 | Customer acquisition | Digital traffic, younger savers, and nationwide visibility without rebuilding discovery from zero. |
| 2 | Retain customers longer | Lock-ins and portfolio tools improve stickiness, repeat visits, and long-term relationships. |
| 3 | Compete with large brands | Enterprise-grade rails, online presence, and tooling for SMEs that cannot fund bespoke platforms. |
| 4 | Customer gold float stays local | Funds and metal economics remain with jewellers — supporting working capital and inventory. |
| 5 | Marketplace visibility | Show ornaments, offers, collections, and indicative pricing once listings are approved. |
| 6 | Configurable models | Design lock-ins, GoldNest schemes, loyalty, waivers, and bespoke commercial rules. |
| 7 | Cross-jeweller revenue | Attract users redeeming from other partners — incremental footfall and margin opportunities. |
| 8 | Loan & sellback revenue | Earn via processing fees, spreads, making, and liquidity services aligned with policy. |
| 9 | Digital CRM & ledger | Customer records, liabilities, settlements, and redemption queues in one operating layer. |
| 10 | Trust & verification | Badges and credibility scores help trustworthy jewellers stand out in search. |
| 11 | Lower technology barrier | Dashboards, onboarding, and marketplace tooling so teams focus on craft and service — not greenfield IT. |

## Features page (`FeaturesPage.tsx`)

| ID | English |
|----|---------|
| features.pill | Platform features |
| features.h1 | User features |
| features.lead | How savers move through gold accumulation, portfolio tracking, redemption, and liquidity — in plain language. Some jeweller and admin controls still land in-dashboard as APIs harden each flow. |
| features.item1.title | Fractional gold purchase |
| features.item1.body | Buy any nominal amount through participating jewellers (GST at purchase). Digital gram holdings; live rate-linked value. Optional jeweller lock-in: 15 days–12 months, or none — during lock-in: no cash redemption, transfer, loan, or emergency draw on those grams. |
| features.item2.title | Gold deposit |
| features.item2.body | Deposit physical gold after verification; grams credit your portfolio as the deposit holding type. Redeem as ornaments, cash (via jeweller sellback rules), loans, transfers, or in the product marketplace. |
| features.item3.title | GoldNest |
| features.item3.body | Recurring contributions, live accumulation, maturity tracking, jeweller-defined benefits, and optional making-charge perks — one clear plan shape per jeweller today. |
| features.item4.title | Portfolio and ledger |
| features.item4.body | Dashboard: total gold (g), current live ₹ value, profit/loss, redeemable gold. Ledgers split into fractional, deposits, and GoldNest with grams, dates, jeweller, lock-in, value, and redemption eligibility. |
| features.item5.title | Ornament redemption |
| features.item5.body | Same jeweller: often 0% or reduced making charges, special pricing, and a faster path. Cross-jeweller: making, GST on making, and a cross-platform fee; you still spend grams while Cridora settles liability between partners. |
| features.item6.title | Cash redemption (sellback) |
| features.item6.body | From original/default jeweller only; subject to lock-in and jeweller sellback rate plus configurable deductions. UI shows live rate, sellback rate, deductions, and final receivable. |
| features.item7.title | Transfer and gifting |
| features.item7.body | Send by Cridora username or phone; see first name, last name, and verification; double confirmation required. |
| features.item8.title | Gold loans |
| features.item8.body | Zero-interest gold loans — highlight: only a 2% processing fee. Jeweller sets max loan %, eligible holdings, lock-in rules; choose grams and partial utilisation with instant available amount. |
| features.item9.title | Emergency funds |
| features.item9.body | Cridora-backed: up to ~80% of portfolio value with temporarily locked holdings; gold consumed if default. Positioning: instant liquidity without selling your gold. |
| features.item10.title | Jeweller marketplace |
| features.item10.body | Cards show logo, name, verified badge, credibility score, city, live rate, jeweller rate, sellback, lock-in, min redeemable, same-store MC benefit, cross fee, feature tags, light metrics, and CTAs (view, invest, compare, default). |
| features.item11.title | Product marketplace |
| features.item11.body | BIS 916 ornaments, chains, bangles, coins, bridal sets — image, name, jeweller, weight, purity, making, final price. Strong CTA: "Use your gold" (e.g. use X g from portfolio, pay ₹Y extra). |
| features.item12.title | Real-time consumption |
| features.item12.body | Loans, transfers, cash redemption, ornament redemption, and emergency draws deduct grams immediately — one ledger across paths. |
| features.cta.jewellers | Jeweller marketplace |
| features.cta.products | Product marketplace |

## Join hub (`JoinHubPage.tsx`)

| ID | English |
|----|---------|
| join.pill | Join |
| join.h1 | Create your account |
| join.lead | Start as a saver building gold holdings, or apply as a partner jeweller — pick the path that fits you. |
| join.customer.title | Customer / saver |
| join.customer.body | Sign up to save in gold, track your portfolio, and redeem across the network. |
| join.customer.cta | Sign up |
| join.jeweller.title | Jeweller |
| join.jeweller.body | Apply to list your store, run schemes, and connect with savers on Cridora. |
| join.jeweller.cta | Apply as jeweller |

## Shop hub (`ShopHubPage.tsx`)

| ID | English |
|----|---------|
| shop.pill | Shop |
| shop.h1 | Browse the marketplace |
| shop.lead | Explore verified jeweller storefronts or product listings — pick a path below. |
| shop.jewellers.title | Jewellers |
| shop.jewellers.body | Directory of partner stores, trust signals, and discovery. |
| shop.jewellers.cta | Open jewellers |
| shop.products.title | Products |
| shop.products.body | Browse ornaments and listings from the product marketplace. |
| shop.products.cta | Open products |

## Investor relations (`InvestorRelationsPage.tsx`)

| ID | English |
|----|---------|
| investors.eyebrow | Investor relations |
| investors.h1 | Institutional enquiries |
| investors.lead | For accredited investors and strategic partners evaluating India's digital gold and jeweller-network infrastructure. |
| investors.body | Submit your mandate through our briefing request form. We respond to qualified introductions on a rolling basis. |
| investors.cta | Briefing request (Google Form) |

---

## Returning translations

When you have Malayalam ready:

1. For **i18n keys** — paste into `frontend/src/i18n/messages/ml.ts` using the same key names.
2. For **appendix hardcoded** — send back with the ID column; we can wire into i18n in a follow-up.
3. Keep placeholders `{interval}`, `{mins}`, `{hrs}`, `{count}` exactly as shown.

Total i18n keys in this export: **~270** (including legacy `home.*`).
