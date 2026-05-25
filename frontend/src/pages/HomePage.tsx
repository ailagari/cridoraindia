import { Fragment, useCallback, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { useRefLandingReveal } from '@/hooks/useRefLandingReveal'
import { dashboardLandingPath } from '@/lib/routes'

export function HomePage() {
  const { user } = useAuth()
  useRefLandingReveal()

  const [investTab, setInvestTab] = useState(0)

  const goInvestTab = useCallback((i: number) => setInvestTab(i), [])

  const startHref = user ? dashboardLandingPath(user) : '/signup'

  return (
    <div className="ref-landing">
      {/* HERO */}
      <section className="hero" id="home">
        <div className="hero-inner">
          <div>
            <div className="eyebrow reveal">
              <div className="eyebrow-dot" aria-hidden />
              {'India\'s gold savings infrastructure'}
            </div>
            <h1 className="hero-h1 reveal reveal-delay-1">
              Gold savings.
              <br />
              <em>Finally done right.</em>
            </h1>
            <p className="hero-sub reveal reveal-delay-2">
              Cridora links your gold to the verified jewellers you already trust — digital records, live board rates,
              and real redemption options. Start from ₹100.
            </p>
            <div className="hero-pills reveal reveal-delay-3">
              <span className="hero-pill">Start from ₹100</span>
              <span className="hero-pill">No lock-in period</span>
              <span className="hero-pill">916 BIS certified</span>
              <span className="hero-pill">0% interest loans</span>
              <span className="hero-pill">OTP secured</span>
            </div>
            <div className="hero-btns reveal reveal-delay-4">
              <Link className="btn btn-primary btn-xl" to={startHref}>
                <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" width={15} height={15}>
                  <circle cx="10" cy="10" r="8" />
                  <path d="M10 6v4l3 2" />
                </svg>
                Start saving
              </Link>
              <Link className="btn btn-ghost btn-lg" to="/jeweller/apply">
                Join as jeweller
              </Link>
            </div>
          </div>

          <div className="hero-visual reveal reveal-delay-2">
            <div className="hv-card">
              <div className="hv-card-eyebrow">Total Vaulted Gold</div>
              <div className="hv-grams tn">
                14.820<span>g</span>
              </div>
              <div className="hv-inr">≈ ₹1,05,932 at board rate</div>
              <div className="hv-sparkrow">
                <svg className="mini-spark" viewBox="0 0 300 48" preserveAspectRatio="none" style={{ height: 40, marginTop: 14 }}>
                  <defs>
                    <linearGradient id="hsg" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#c9a840" stopOpacity=".2" />
                      <stop offset="100%" stopColor="#c9a840" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  <path
                    d="M0,40 C20,36 40,30 65,24 S110,14 140,12 S190,8 220,5 S265,3 300,2 L300,48 L0,48Z"
                    fill="url(#hsg)"
                  />
                  <path
                    d="M0,40 C20,36 40,30 65,24 S110,14 140,12 S190,8 220,5 S265,3 300,2"
                    fill="none"
                    stroke="#c9a840"
                    strokeWidth="1.8"
                  />
                  <circle cx={300} cy={2} r={3.5} fill="#c9a840" />
                  <circle cx={300} cy={2} r={7} fill="#c9a840" fillOpacity=".2" />
                </svg>
              </div>
              <div className="hv-stats">
                <div className="hv-stat">
                  <div className="hv-stat-lbl">Unrealised P/L</div>
                  <div className="hv-stat-val text-ok tn">+₹11,332</div>
                </div>
                <div className="hv-stat">
                  <div className="hv-stat-lbl">Redeemable</div>
                  <div className="hv-stat-val text-gold tn">12.340 g</div>
                </div>
              </div>
            </div>

            <div className="hv-card-sm">
              <div
                className="hv-ico"
                style={{ background: 'rgba(35,197,94,.1)', border: '1px solid rgba(35,197,94,.2)' }}
                aria-hidden
              >
                🟢
              </div>
              <div>
                <div className="hv-sm-name">Fractional purchase</div>
                <div className="hv-sm-detail">Malabar Gold, Kozhikode · FR-29481-05</div>
              </div>
              <div className="hv-sm-val">
                +0.420 g
                <br />
                <span style={{ fontSize: '0.65rem', color: 'var(--ink3)' }}>₹3,000</span>
              </div>
            </div>

            <div className="hv-card-sm">
              <div className="hv-ico" style={{ background: 'var(--gold-bg)', border: '1px solid var(--gold-bd)' }} aria-hidden>
                🏦
              </div>
              <div>
                <div className="hv-sm-name">Gold deposit verified</div>
                <div className="hv-sm-detail">Kalyan Jewellers, Thrissur · DP-18241</div>
              </div>
              <div className="hv-sm-val">
                +5.000 g
                <br />
                <span style={{ fontSize: '0.65rem', color: 'var(--ink3)' }}>₹34,800</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* STATS */}
      <div className="stats-row">
        <div className="stat-col reveal">
          <div className="sc-val">₹4.2Cr+</div>
          <div className="sc-lbl">Gold vaulted on platform</div>
        </div>
        <div className="stat-col reveal reveal-delay-1">
          <div className="sc-val">1,800+</div>
          <div className="sc-lbl">Active savers</div>
        </div>
        <div className="stat-col reveal reveal-delay-2">
          <div className="sc-val">42</div>
          <div className="sc-lbl">Verified partner jewellers</div>
        </div>
        <div className="stat-col reveal reveal-delay-3">
          <div className="sc-val">0%</div>
          <div className="sc-lbl">Interest on gold loans</div>
        </div>
      </div>

      {/* FEATURE STRIP */}
      <div className="fstrip">
        <div className="fstrip-inner">
          <div className="fstrip-item reveal">
            <div className="fs-ico" style={{ background: 'var(--gold-bg)', border: '1px solid var(--gold-bd)' }}>
              🪙
            </div>
            <div>
              <div className="fs-title">Fractional Gold</div>
              <div className="fs-sub">Buy from ₹100. GST included. Credited instantly.</div>
            </div>
          </div>
          <div className="fstrip-item reveal reveal-delay-1">
            <div className="fs-ico" style={{ background: 'rgba(35,197,94,.08)', border: '1px solid rgba(35,197,94,.18)' }}>
              📦
            </div>
            <div>
              <div className="fs-title">Gold Deposit</div>
              <div className="fs-sub">Digitise physical gold you already own.</div>
            </div>
          </div>
          <div className="fstrip-item reveal reveal-delay-2">
            <div className="fs-ico" style={{ background: 'rgba(59,158,255,.08)', border: '1px solid rgba(59,158,255,.18)' }}>
              💳
            </div>
            <div>
              <div className="fs-title">CridoraPay</div>
              <div className="fs-sub">Pay jeweller bills using vault gold + UPI.</div>
            </div>
          </div>
          <div className="fstrip-item reveal reveal-delay-3">
            <div className="fs-ico" style={{ background: 'rgba(240,71,71,.07)', border: '1px solid rgba(240,71,71,.15)' }}>
              🔐
            </div>
            <div>
              <div className="fs-title">0% Gold Loans</div>
              <div className="fs-sub">Borrow against vault gold. Pay back, get gold.</div>
            </div>
          </div>
        </div>
      </div>

      {/* DISCOVER */}
      <section className="section" id="discover">
        <div className="inner">
          <div className="center inner-narrow">
            <div className="eyebrow reveal">
              <div className="eyebrow-dot" aria-hidden />
              Why Cridora
            </div>
            <h2 className="sh reveal reveal-delay-1">
              Gold saving deserves
              <br />
              better infrastructure.
            </h2>
            <p className="sh-sub reveal reveal-delay-2">
              India holds over 25,000 tonnes of household gold. Most of it sits idle, unleveraged, and un-traceable.
              Cridora is the financial layer that finally makes that gold work — without moving it from jewellers you
              trust.
            </p>
          </div>

          <div className="feat-grid" style={{ marginTop: 56 }}>
            <div className="feat-card feat-card-large reveal">
              <div>
                <div className="fc-ico">🏛️</div>
                <h3 className="fc-title">Infrastructure, not a new wallet</h3>
                <p className="fc-desc">
                  Cridora doesn&apos;t hold your gold. Your verified local jeweller does — the same one your family has
                  trusted for decades. We add digital records, live rates, and redemption tools on top of that
                  relationship.
                </p>
                <span className="fc-tag">No new middleman · Your jeweller keeps the gold</span>
              </div>
              <div>
                <div
                  style={{
                    background: 'var(--s1)',
                    border: '1px solid var(--b0)',
                    borderRadius: 'var(--r2)',
                    padding: 16,
                  }}
                >
                  <div
                    style={{
                      fontSize: '0.6rem',
                      fontWeight: 700,
                      letterSpacing: '0.1em',
                      textTransform: 'uppercase',
                      color: 'var(--ink3)',
                      marginBottom: 10,
                    }}
                  >
                    Your vault · Malabar Gold
                  </div>
                  <div
                    style={{
                      fontSize: '1.6rem',
                      fontWeight: 900,
                      color: 'var(--gold-hi)',
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    14.820 <span style={{ fontSize: '0.8rem', color: 'var(--ink2)', fontWeight: 600 }}>g</span>
                  </div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--ink2)', marginTop: 2, fontVariantNumeric: 'tabular-nums' }}>
                    ≈ ₹1,05,932
                  </div>
                  <svg viewBox="0 0 260 36" style={{ width: '100%', height: 30, marginTop: 12 }} preserveAspectRatio="none">
                    <defs>
                      <linearGradient id="cg2" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#c9a840" stopOpacity=".18" />
                        <stop offset="100%" stopColor="#c9a840" stopOpacity="0" />
                      </linearGradient>
                    </defs>
                    <path
                      d="M0,32 C20,28 40,22 70,18 S110,10 140,8 S190,5 220,3 S250,2 260,1 L260,36 L0,36Z"
                      fill="url(#cg2)"
                    />
                    <path
                      d="M0,32 C20,28 40,22 70,18 S110,10 140,8 S190,5 220,3 S250,2 260,1"
                      fill="none"
                      stroke="#c9a840"
                      strokeWidth="1.6"
                    />
                  </svg>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 12 }}>
                    <div
                      style={{
                        background: 'var(--s2)',
                        border: '1px solid var(--b0)',
                        borderRadius: 'var(--r1)',
                        padding: '10px 12px',
                      }}
                    >
                      <div
                        style={{
                          fontSize: '0.56rem',
                          fontWeight: 700,
                          letterSpacing: '0.08em',
                          textTransform: 'uppercase',
                          color: 'var(--ink3)',
                          marginBottom: 3,
                        }}
                      >
                        Fractional
                      </div>
                      <div style={{ fontSize: '0.82rem', fontWeight: 800, color: 'var(--ink)', fontVariantNumeric: 'tabular-nums' }}>
                        9.340 g
                      </div>
                    </div>
                    <div
                      style={{
                        background: 'var(--s2)',
                        border: '1px solid var(--b0)',
                        borderRadius: 'var(--r1)',
                        padding: '10px 12px',
                      }}
                    >
                      <div
                        style={{
                          fontSize: '0.56rem',
                          fontWeight: 700,
                          letterSpacing: '0.08em',
                          textTransform: 'uppercase',
                          color: 'var(--ink3)',
                          marginBottom: 3,
                        }}
                      >
                        Deposit
                      </div>
                      <div style={{ fontSize: '0.82rem', fontWeight: 800, color: 'var(--ink)', fontVariantNumeric: 'tabular-nums' }}>
                        5.000 g
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="feat-card reveal reveal-delay-1">
              <div className="fc-ico" style={{ background: 'rgba(35,197,94,.08)', borderColor: 'rgba(35,197,94,.18)' }}>
                📈
              </div>
              <h3 className="fc-title">Live board rates. Always.</h3>
              <p className="fc-desc">
                See the jeweller&apos;s actual board rate for every transaction. Compare buyback rates before you sell.
                No guesswork, no &quot;come back tomorrow.&quot;
              </p>
              <span className="fc-tag">Transparent · Auditable</span>
            </div>

            <div className="feat-card reveal reveal-delay-2">
              <div className="fc-ico" style={{ background: 'rgba(59,158,255,.08)', borderColor: 'rgba(59,158,255,.18)' }}>
                🔄
              </div>
              <h3 className="fc-title">Three ways to redeem</h3>
              <p className="fc-desc">
                Sell back for cash, transfer grams to family members, or pledge gold as collateral for a 0% interest
                loan. Your gold works for you.
              </p>
              <span className="fc-tag">No lock-in · Instant settlement</span>
            </div>

            <div className="feat-card reveal reveal-delay-1">
              <div className="fc-ico">💍</div>
              <h3 className="fc-title">Buy jewellery online</h3>
              <p className="fc-desc">
                Browse the BIS 916 catalogue from verified jewellers. Pay using vault gold + UPI. Completed purchases
                appear in your Gold Records vault.
              </p>
              <span className="fc-tag">Marketplace · CridoraPay</span>
            </div>

            <div className="feat-card reveal reveal-delay-2">
              <div className="fc-ico" style={{ background: 'rgba(240,71,71,.07)', borderColor: 'rgba(240,71,71,.15)' }}>
                🛡️
              </div>
              <h3 className="fc-title">OTP-secured every step</h3>
              <p className="fc-desc">
                Every physical transaction — deposit, sellback, or counter payment — requires a one-time code shared
                only at the moment. Your vault can&apos;t be touched without your phone.
              </p>
              <span className="fc-tag">Zero-trust · Cryptographic verification</span>
            </div>
          </div>
        </div>
      </section>

      {/* QUOTE */}
      <div className="quote-banner">
        <div className="inner-mid">
          <blockquote className="qb-text reveal">
            &quot;Indian households hold more gold than the <em>entire reserves of the US Federal Reserve</em> — yet
            most of it earns nothing, protects nothing, and can&apos;t be used as collateral without selling it.&quot;
          </blockquote>
          <div className="qb-source reveal reveal-delay-1">World Gold Council · Cridora Editorial</div>
        </div>
      </div>

      {/* HOW */}
      <section className="section" id="how">
        <div className="inner">
          <div className="center inner-narrow">
            <div className="eyebrow reveal">
              <div className="eyebrow-dot" aria-hidden />
              How Cridora works
            </div>
            <h2 className="sh reveal reveal-delay-1">Four steps to your first gram.</h2>
            <p className="sh-sub reveal reveal-delay-2">
              You don&apos;t need a new bank account. Your existing UPI app and your local jeweller are all you need.
            </p>
          </div>

          <div className="idx-steps">
            {[
              {
                n: '1',
                t: 'Pick a verified jeweller',
                d: 'Browse the Cridora directory. Filter by city, trust score, buyback rate, or services offered. Every jeweller is KYB-verified.',
              },
              {
                n: '2',
                t: 'Start saving digitally',
                d: 'Buy fractional gold via UPI from ₹100 — or visit the store and pay at the counter. Gold is credited to your vault within minutes.',
              },
              {
                n: '3',
                t: 'Track it live',
                d: 'Your dashboard shows live valuation, gram-by-gram history, unrealised P/L, and every transaction with an audit trail.',
              },
              {
                n: '4',
                t: 'Redeem on your terms',
                d: 'Sell back for cash, transfer to family, take a 0% loan, or spend at the store via CridoraPay. No lock-in, no penalty.',
              },
            ].map((step, idx) => (
              <div key={step.n} className={`idx-step-card reveal${idx > 0 ? ` reveal-delay-${idx}` : ''}`}>
                <div className="idx-step-num">{step.n}</div>
                <div>
                  <div className="idx-step-title">{step.t}</div>
                  <div className="idx-step-desc">{step.d}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* INVEST */}
      <section className="section" id="invest" style={{ background: 'var(--s0)', borderTop: '1px solid var(--b0)', borderBottom: '1px solid var(--b0)' }}>
        <div className="inner">
          <div className="inner-narrow">
            <div className="eyebrow reveal">
              <div className="eyebrow-dot" aria-hidden />
              Three ways to invest
            </div>
            <h2 className="sh reveal reveal-delay-1">
              Gold added three ways,
              <br />
              one unified vault.
            </h2>
            <p className="sh-sub reveal reveal-delay-2">
              However you accumulate gold — buying small, depositing physical, or through purchases — every gram
              appears in the same dashboard with live valuation.
            </p>
          </div>

          <div className="invest-tabs reveal" style={{ marginTop: 36 }}>
            {['All methods', 'Fractional', 'Deposit', 'Purchase-linked'].map((label, i) => (
              <button key={label} type="button" className={`it-btn${investTab === i ? ' on' : ''}`} onClick={() => goInvestTab(i)}>
                {label}
              </button>
            ))}
          </div>

          <div className={`invest-grid reveal reveal-delay-1 tab-${investTab}`} aria-hidden>
            {/* Prototype tabs only highlight buttons; grid content unchanged */}
            <div className="invest-card">
              <div className="invc-num">Method 01 — Fractional</div>
              <div className="invc-title">Buy from ₹100, any time</div>
              <div className="invc-desc">
                Choose a partner jeweller, enter any INR amount or gram weight. GST on gold is already included in the
                quote. Pay via UPI — or visit the counter and get an OTP. Grams are credited to your vault within
                minutes.
              </div>
              <span className="invc-tag">Start from ₹100 · UPI or counter</span>
            </div>
            <div className="invest-card">
              <div className="invc-num">Method 02 — Gold Deposit</div>
              <div className="invc-title">Digitise gold you already own</div>
              <div className="invc-desc">
                Bring physical gold — coins, bars, or ornaments — to a verified partner jeweller. The counter records
                weight and purity. You confirm with a one-time OTP. Deposit-class grams appear in your vault immediately.
              </div>
              <span className="invc-tag">No cash moves · Deposit class grams</span>
            </div>
            <div className="invest-card">
              <div className="invc-num">Method 03 — Purchase-linked</div>
              <div className="invc-title">Gold records from store purchases</div>
              <div className="invc-desc">
                When you buy jewellery at a partner store via CridoraPay, the purchase is automatically logged in your
                Gold Records vault — purity, weight, jeweller, date. Perfect for insurance and valuation tracking.
              </div>
              <span className="invc-tag">Auto-logged · Records vault</span>
            </div>
            <div className="invest-card" style={{ background: 'var(--s1)' }}>
              <div className="invc-num">Redemption — Three Options</div>
              <div className="invc-title">Use your gold, don&apos;t just hold it</div>
              <div className="invc-desc">
                <strong style={{ color: 'var(--ink)', display: 'block', marginBottom: 4 }}>Cash Sellback</strong>
                Sell fractional grams back to the jeweller at buyback rate. OTP at counter or UPI payout.
                <br />
                <br />
                <strong style={{ color: 'var(--ink)', display: 'block', marginBottom: 4 }}>Gold Transfer</strong>
                Send grams to any Cridora member by vault card — family, gifts, settlements.
                <br />
                <br />
                <strong style={{ color: 'var(--ink)', display: 'block', marginBottom: 4 }}>0% Gold Loan</strong>
                Pledge grams as collateral. Only 2% flat fee. Repay in parts; gold returns to vault on full repayment.
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* BUILT FOR INDIA */}
      <section className="section">
        <div className="inner">
          <div className="center inner-narrow">
            <div className="eyebrow reveal">
              <div className="eyebrow-dot" aria-hidden />
              Built around real Indian gold behaviour
            </div>
            <h2 className="sh reveal reveal-delay-1">
              Every Indian saves gold.
              <br />
              Most can&apos;t use it.
            </h2>
            <p className="sh-sub reveal reveal-delay-2">
              We built Cridora specifically around how gold actually moves in Indian households — not how Western
              finance thinks it should.
            </p>
          </div>

          <div className="landing-india-grid">
            <div className="landing-india-card wide reveal">
              <div className="ic-num">01</div>
              <div>
                <div className="ic-title">You already own gold — it&apos;s just not working for you</div>
                <div className="ic-desc">
                  India&apos;s household gold stockpile exceeds 25,000 tonnes. Most of it earns zero returns, has no formal
                  record, and can&apos;t be used as collateral without selling it at the wrong time. Cridora adds a financial
                  layer without moving the gold.
                </div>
              </div>
            </div>
            <div className="landing-india-card reveal reveal-delay-1">
              <div className="ic-num">02</div>
              <div>
                <div className="ic-title">You trust your jeweller more than a bank</div>
                <div className="ic-desc">
                  We don&apos;t ask you to change that. Your verified local jeweller remains the physical custodian.
                  Cridora adds digital records, rate transparency, and redemption infrastructure on top.
                </div>
              </div>
            </div>
            <div className="landing-india-card reveal reveal-delay-2">
              <div className="ic-num">03</div>
              <div>
                <div className="ic-title">Small savings matter — ₹100 at a time</div>
                <div className="ic-desc">
                  No minimum holding period. No lock-in. No penalty for selling. Buy from ₹100. Add whenever you can.
                  That&apos;s what a genuine savings tool looks like.
                </div>
              </div>
            </div>
            <div className="landing-india-card reveal reveal-delay-1">
              <div className="ic-num">04</div>
              <div>
                <div className="ic-title">Rate transparency is non-negotiable</div>
                <div className="ic-desc">
                  Live 22K and 24K board rates on every screen. Buyback rates visible before you decide. Full gram-by-gram
                  ledger. BIS 916 hallmarks recorded for every piece.
                </div>
              </div>
            </div>
            <div className="landing-india-card reveal reveal-delay-2">
              <div className="ic-num">05</div>
              <div>
                <div className="ic-title">Gold that earns, pays, and transfers</div>
                <div className="ic-desc">
                  0% loans. Peer-to-peer transfers. CridoraPay at the counter. Vault gold used for online marketplace
                  purchases. Gold as active utility, not just a legacy asset.
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* TRUST */}
      <section className="section" id="trust" style={{ background: 'var(--s0)', borderTop: '1px solid var(--b0)' }}>
        <div className="inner">
          <div className="center inner-narrow">
            <div className="eyebrow reveal">
              <div className="eyebrow-dot" aria-hidden />
              Trust &amp; transparency
            </div>
            <h2 className="sh reveal reveal-delay-1">
              Six pillars of trust.
              <br />
              No exceptions.
            </h2>
          </div>

          <div className="landing-trust-grid">
            {[
              { icon: '🪪', title: 'KYC verified accounts', desc: 'PAN, Aadhaar, and selfie verification before any transaction. Every user is a real person. No anonymous wallets.' },
              { icon: '🏅', title: 'BIS 916 hallmarked gold', desc: 'Every gram deposited or purchased through Cridora is required to carry BIS 916 certification. Purity is recorded and auditable.', d: 'reveal-delay-1' },
              { icon: '🏢', title: 'Jeweller KYB verification', desc: 'Every partner jeweller goes through Know Your Business checks — GST, shop registration, and physical inspection before listing.', d: 'reveal-delay-2' },
              { icon: '📋', title: 'End-to-end audit trail', desc: 'Every transaction — purchase, deposit, transfer, sellback, or loan — is logged with timestamps, rates, and reference IDs. Immutable record.', d: 'reveal-delay-1' },
              { icon: '🔑', title: 'OTP-secured physical actions', desc: 'Counter deposits, sellbacks, and CridoraPay transactions require a time-limited OTP. No action happens without your active confirmation.', d: 'reveal-delay-2' },
              { icon: '📊', title: 'No hidden charges', desc: 'Platform fee: ₹0. GST: 3% (mandated by law, shown upfront). Loan fee: 2% flat. Sellback spread: visible before confirmation. No surprises.', d: 'reveal-delay-3' },
            ].map((cell) => (
              <div key={cell.title} className={`landing-trust-cell reveal ${cell.d ?? ''}`}>
                <div className="tc-ico" aria-hidden>
                  {cell.icon}
                </div>
                <div>
                  <div className="tc-title">{cell.title}</div>
                  <div className="tc-desc">{cell.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* JEWELLERS */}
      <section className="section jw-section" id="jewellers">
        <div className="inner">
          <div className="jw-split">
            <div className="jw-mock reveal">
              <div className="jm-card">
                <div className="jm-header">
                  <div className="jm-av">MG</div>
                  <div>
                    <div className="jm-name">Malabar Gold &amp; Diamonds</div>
                    <div className="jm-city">
                      Kozhikode, Kerala · <span className="badge badge-ok">KYB Verified</span>
                    </div>
                  </div>
                </div>
                <div className="jm-rates">
                  <div className="jm-rate">
                    <label>22K rate</label>
                    <span className="tn">₹7,142/g</span>
                  </div>
                  <div className="jm-rate">
                    <label>Buyback</label>
                    <span className="gold tn">₹7,042/g</span>
                  </div>
                  <div className="jm-rate">
                    <label>Making</label>
                    <span className="tn">₹480/g</span>
                  </div>
                </div>
              </div>
              <div style={{ background: 'var(--s0)', border: '1px solid var(--b0)', borderRadius: 'var(--r3)', padding: 18, boxShadow: 'var(--cs)' }}>
                <div
                  style={{
                    fontSize: '0.6rem',
                    fontWeight: 700,
                    letterSpacing: '0.1em',
                    textTransform: 'uppercase',
                    color: 'var(--ink3)',
                    marginBottom: 12,
                  }}
                >
                  Today&apos;s desk activity
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  {[
                    ['Purchases', '14 txns'],
                    ['Deposits', '3 txns'],
                    ['CridoraPay bills', '₹2.4L'],
                  ].map(([k, v]) => (
                    <div key={k} style={{ background: 'var(--s1)', border: '1px solid var(--b0)', borderRadius: 'var(--r1)', padding: '11px 13px' }}>
                      <div
                        style={{
                          fontSize: '0.58rem',
                          fontWeight: 700,
                          letterSpacing: '0.08em',
                          textTransform: 'uppercase',
                          color: 'var(--ink3)',
                          marginBottom: 4,
                        }}
                      >
                        {k}
                      </div>
                      <div style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--ink)', fontVariantNumeric: 'tabular-nums' }}>{v}</div>
                    </div>
                  ))}
                  <div
                    style={{
                      gridColumn: '1 / -1',
                      background: 'var(--gold-bg)',
                      border: '1px solid var(--gold-bd)',
                      borderRadius: 'var(--r1)',
                      padding: '11px 13px',
                    }}
                  >
                    <div
                      style={{
                        fontSize: '0.58rem',
                        fontWeight: 700,
                        letterSpacing: '0.08em',
                        textTransform: 'uppercase',
                        color: 'var(--ink3)',
                        marginBottom: 4,
                      }}
                    >
                      New customers
                    </div>
                    <div style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--gold-hi)', fontVariantNumeric: 'tabular-nums' }}>+7 today</div>
                  </div>
                </div>
              </div>
            </div>

            <div>
              <div className="eyebrow reveal">
                <div className="eyebrow-dot" aria-hidden />
                For jewellers
              </div>
              <h2 className="sh-md reveal reveal-delay-1">Grow your business with digital gold infrastructure.</h2>
              <p className="sh-sub reveal reveal-delay-2">
                Cridora gives your showroom a modern digital layer — customer loyalty, recurring savings plans, and
                real-time settlement — without replacing your existing workflow.
              </p>

              <div className="jw-features">
                {[
                  { icon: '💳', t: 'CridoraPay desk billing', d: 'Create bills for walk-in customers. They pay with vault gold + UPI. You get settled instantly. No card machine or POS needed.' },
                  { icon: '📦', t: 'Gold deposit management', d: 'Accept physical gold deposits from Cridora customers. Record weight and purity. OTP-verified. Digital grams credited automatically.' },
                  { icon: '👥', t: 'Customer loyalty & recurring savings', d: 'Run golden schemes digitally. Your customers save fractional gold through your verified vault — trackable and auditable in real time.' },
                  { icon: '🏪', t: 'Product marketplace listing', d: 'List your BIS 916 jewellery catalogue online. Reach Cridora savers who can pay using vault gold — a warm audience with existing gold balances.' },
                ].map((item, ix) => (
                  <div key={item.t} className={`jw-feat reveal reveal-delay-${ix + 1}`}>
                    <div className="jf-ico">{item.icon}</div>
                    <div>
                      <div className="jf-title">{item.t}</div>
                      <div className="jf-desc">{item.d}</div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="idx-row" style={{ marginTop: 28 }}>
                <Link className="btn btn-primary btn-lg" to="/jeweller/apply">
                  Apply as jeweller →
                </Link>
                <Link className="btn btn-ghost" to="/investors">
                  Download info kit
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* JOIN */}
      <section className="cta-section" id="join">
        <div className="cta-inner">
          <div className="eyebrow reveal" style={{ margin: '0 auto 18px' }}>
            <div className="eyebrow-dot" aria-hidden />
            Get early access
          </div>
          <h2 className="sh reveal reveal-delay-1">Start your gold vault today.</h2>
          <p className="sh-sub reveal reveal-delay-2" style={{ margin: '12px auto 0' }}>
            Join thousands of Indian savers using Cridora to invest, track, and redeem gold through verified local
            jewellers.
          </p>

          <div className="cta-input-row reveal reveal-delay-2">
            <label htmlFor="idx-cta-placeholder" className="sr-only">
              Mobile or email (optional placeholder)
            </label>
            <input id="idx-cta-placeholder" className="cta-input" type="tel" placeholder="+91 mobile number or email" />
            <Link className="btn btn-primary btn-lg" to="/signup">
              Get started →
            </Link>
          </div>
          <div className="cta-note reveal reveal-delay-3">No credit card. No minimum deposit. KYC takes under 3 minutes.</div>

          <div style={{ display: 'flex', justifyContent: 'center', gap: 24, marginTop: 40, flexWrap: 'wrap' }}>
            {[
              ['₹100', 'Minimum first purchase'],
              ['3 min', 'To complete KYC'],
              ['0%', 'Interest on gold loans'],
              ['42+', 'Verified partner stores'],
            ].map(([a, b], i, arr) => (
              <Fragment key={a}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '1.6rem', fontWeight: 900, color: 'var(--gold-hi)', fontVariantNumeric: 'tabular-nums' }}>{a}</div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--ink2)', marginTop: 3 }}>{b}</div>
                </div>
                {i < arr.length - 1 ? (
                  <div style={{ width: 1, background: 'var(--b0)', flexShrink: 0 }} aria-hidden />
                ) : null}
              </Fragment>
            ))}
          </div>
        </div>
      </section>

    </div>
  )
}
