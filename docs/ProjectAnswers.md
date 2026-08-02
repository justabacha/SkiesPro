# PROJECT ONBOARDING — KENYA EDITION
## SkiesPro Binary Trading Platform

**For: Project Owner + Tech Lead**  
**Last updated:** 2026-07-28

---

## ✅ ALREADY DECIDED (Pre-filled — Change if you disagree)

| # | Item | Decision | Why |
|---|------|----------|-----|
| 1 | Business name | **SKIESPRO** | You provided |
| 2 | Node.js version | **22.x LTS** | Supabase requires Node 22+, WebSocket support |
| 3 | Backend framework | **Express.js** | Industry standard |
| 4 | Package manager | **npm** | Default |
| 5 | Language | **TypeScript** | Type safety |
| 6 | Testing framework | **Jest** | Standard |
| 7 | Git platform | **GitHub** | Default |
| 8 | Use Docker? | **Yes** | For deployment |
| 9 | Health check path | **/health** | Standard |
| 10 | Database provider | **Supabase** | PostgreSQL + managed |
| 11 | Backup strategy | **Daily full + continuous WAL** | Best practice |
| 12 | PITR enabled? | **Yes** | Point-in-time recovery |
| 13 | Read replicas? | **Yes** | Performance |
| 14 | JWT generation | **Auto-generated** | Secure |
| 15 | JWT expiration | **15 minutes** | Standard |
| 16 | Refresh token expiry | **7 days** | Standard |
| 17 | MFA method | **TOTP** (Google Authenticator) | Secure, free |
| 18 | Min password length | **8 characters** | Standard |
| 19 | Password complexity | **1 upper, 1 lower, 1 digit, 1 special** | Secure |
| 20 | Encryption | **AES-256-GCM** | Industry standard |
| 21 | Rate limiting | **Redis-based with fallback** | Performance |
| 22 | Access control | **RBAC** | Role-based |
| 23 | API subdomain | **api** | Standard |
| 24 | Admin subdomain | **admin** | Standard |
| 25 | Frontend framework | **React** | Standard |
| 26 | Font family | **Inter** | Clean, modern |
| 27 | Tone of voice | **Professional, calm, informative** | Trust-building |
| 28 | Primary color | **#2563EB** (Blue) | Trust, finance |
| 29 | Secondary color | **#1D4ED8** | Complementary |
| 30 | Accent color | **#DBEAFE** | Light blue |
| 31 | Dark mode bg | **#0F1117** | Standard dark |
| 32 | Dark mode text | **#F3F4F6** | Readable |
| 33 | Payout ratio | **80%** | Industry standard |
| 34 | Referral commission | **5%** | Standard |
| 35 | KYC provider | **SumSub** | International standard |
| 36 | Cookie consent | **Yes** | Required |
| 37 | Price validation | **Within 5% of previous tick** | Prevents manipulation |
| 38 | Stale price threshold | **30 seconds** | Standard |
| 39 | WebSocket port | **443** (WSS) | Secure |
| 40 | Default instruments | **EUR/USD, GBP/USD, USD/JPY, Gold, Oil** | Liquid markets |
| 41 | Market hours | **Forex: 00:00-23:59 UTC Mon-Fri, Crypto: 24/7** | Standard |
| 42 | Escalation path | **Support → Tech Lead → Owner → CTO** | Standard |

---

## ❓ MUST ANSWER — ONLY YOU KNOW THESE

### A. PROJECT IDENTITY

| # | Question | Your Answer | Notes |
|---|----------|-------------|-------|
| A1 | Project codename (kebab-case) | [skiespro] | e.g., "skiespro", "skies-pro" |
| A2 | Your full name (project owner) | [AMOS FX] | |
| A3 | Your email | [austines.bot@gmail.com] | |
| A4 | Your phone number | [+254710114619] | |
| A5 | Tech lead name + email | [RYAN RAY, EMAIL: ryan141rays@gmail.com] | Could be you |

---

### B. DOMAIN & BRANDING

| # | Question | Your Answer | Notes |
|---|----------|-------------|-------|
| B1 | Primary domain | [PENDING] | e.g., skiespro.co.ke |
| B2 | Do you own this domain? | [PENDING] | Yes / No — if No, we buy it |
| B3 | Domain registrar | [PENDING] | e.g., Truehost Kenya, HostPinnacle |
| B4 | Do you have a logo? | [PENDING] | Yes (provide file) / No (we design) |
| B5 | Brand colors different from blue? | [PENDING] | Skip if blue is fine |

---

### C. M-PESA PAYMENTS (CRITICAL)

| # | Question | Your Answer | Notes |
|---|----------|-------------|-------|
| C1 | **Do you have a Safaricom M-Pesa Business Account?** | [PENDING] | **YES / NO** — This is critical |
| C2 | **M-Pesa Business Shortcode** | [PENDING] | 5-6 digit number from Safaricom |
| C3 | **Do you have Daraja API access?** | [PENDING] | **YES / NO / Applied** |
| C4 | **Consumer Key** | [PENDING] | From Daraja portal |
| C5 | **Consumer Secret** | [PENDING] | From Daraja portal |
| C6 | **Passkey** | [PENDING] | From Daraja portal |
| C7 | **Minimum deposit (KES)** | [500KES] | e.g., 100 |
| C8 | **Maximum deposit (KES)** | [100,000KES] | e.g., 150,000 |
| C9 | **Minimum withdrawal (KES)** | [1,500KES] | e.g., 200 |
| C10 | **Maximum withdrawal per day (KES)** | [60,000KES] | e.g., 70,000 |
| C11 | **Withdrawal fee** | [2%] | e.g., "KES 30 flat" or "1%" |
| C12 | **Deposit fee** | [0%] | Usually 0% |
| C13 | **Backup payment method?** | [PENDING] | Bank transfer? Card? Or M-Pesa only? |

**If you DON'T have M-Pesa Business Account yet:**
→ Apply at Safaricom. Takes 1-2 weeks. We can build with sandbox first.

**If you DON'T have Daraja API yet:**
→ Apply at [developer.safaricom.co.ke](https://developer.safaricom.co.ke). We use sandbox keys until approved.

---

### D. TRADING RULES (Business Model)

| # | Question | Your Answer | Notes |
|---|----------|-------------|-------|
| D1 | **Minimum trade amount (KES)** | [100] | e.g., 50 |
| D2 | **Maximum trade amount (KES)** | [50,000] | e.g., 50,000 |
| D3 | **Trade duration options** | [1MIN/OPTIONS] | e.g., 1 min, 5 min, 15 min, 1 hour |
| D4 | **Demo/practice account?** | [YES] | Yes / No |
| D5 | **Daily trading limit per user?** | [NO] | Yes / No — if Yes, how much? |

---

### E. LEGAL & COMPLIANCE (Kenya)

| # | Question | Your Answer | Notes |
|---|----------|-------------|-------|
| E1 | **Business registered in Kenya?** | [PENDING] | Yes / No / In progress |
| E2 | **Business registration number** | [PENDING] | If registered |
| E3 | **Do you have a lawyer?** | [PENDING] | For terms of service, privacy policy |
| E4 | **Terms of service needed?** | [PENDING] | Yes — we write or your lawyer |
| E5 | **Privacy policy needed?** | [PENDING] | Yes — required by law |
| E6 | **Data retention period** | [PENDING] | Default: 7 years |

---

### F. NOTIFICATIONS

| # | Question | Your Answer | Notes |
|---|----------|-------------|-------|
| F1 | **Email sender name** | [SkiePro] | e.g., "SkiesPro" |
| F2 | **Email sender address** | [PENDING] | e.g., noreply@skiespro.co.ke |
| F3 | **SMS provider for Kenya** | [Africa's Talking] | Africa's Talking? Twilio? Or skip SMS? |
| F4 | **Support email** | [PENDING] | e.g., support@skiespro.co.ke |

---

### G. TEAM & OPERATIONS

| # | Question | Your Answer | Notes |
|---|----------|-------------|-------|
| G1 | **DevOps contact** | [ryan141rays@gmail.com] | Could be you or tech lead |
| G2 | **Support contact** | [skiespro.ltd@gmail.com] | Who handles user complaints? |
| G3 | **Launch target date** | [7MONTHS] | Realistic date |
| G4 | **Start with MVP or full build?** | [MVP] | MVP recommended |

---

### H. PRICE FEED

| # | Question | Your Answer | Notes |
|---|----------|-------------|-------|
| H1 | **Price feed provider** | [Binance] | Default: Binance (free) |
| H2 | **Do you have API key?** | [PENDING] | Binance is free, just register |
| H3 | **Fallback provider** | [PENDING] | e.g., Forex API backup |

---

## 🚀 NEXT STEPS

1. **Fill out Section A–H above** (skip what you don't know)
2. **If M-Pesa not ready:** Tell us, we build with sandbox first
3. **Send back to tech team**
4. **We schedule 30-min call** to clarify anything unclear

---

## M-PESA CHECKLIST FOR YOU

- [ ] Apply for M-Pesa Business Account (Safaricom shop or online)
- [ ] Apply for Daraja API access ([developer.safaricom.co.ke](https://developer.safaricom.co.ke))
- [ ] Get Shortcode, Consumer Key, Consumer Secret, Passkey
- [ ] Decide min/max deposit and withdrawal amounts
- [ ] Decide trading rules (min/max trade, duration)

**Questions? Call/WhatsApp the tech lead.**

---

**Filled by:** ___________________  
**Date:** ___________________  
**Send back to:** [Your email]