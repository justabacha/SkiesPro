# PROJECT ONBOARDING v1.0
## Independent Online Binary Trading Platform

---

## Purpose

This document contains EVERY question, decision, configuration value, and third-party account needed across the entire project. It is filled out ONCE by the owner and then referenced by all future work packages.

**Fill this out before starting WP-01.**

---

## Blocker Level Rules

| Level | Meaning | Examples |
|-------|---------|----------|
| REQUIRED | WP-01 cannot start without this | Project name, Git platform, Node version |
| REQUIRED FOR PHASE 2 | Can start WP-01, but WP-04 needs this | JWT strategy, MFA method |
| REQUIRED FOR PHASE 3 | Can start WP-01-03, but WP-06/07 needs this | Supabase URL, payment gateway |
| REQUIRED FOR PHASE 4 | Pricing-specific | Price feed provider, WebSocket config |
| REQUIRED FOR PHASE 7 | Notification-specific | Email provider, SMS provider |
| REQUIRED FOR PHASE 9 | Admin-specific | Risk control thresholds |
| OPTIONAL | Has default, not blocking | Dark mode colors, analytics |

---

## §1 Project Identity

### §1.1 Business Name
- **Question:** What is the official business name for this platform?
- **Why needed:** WP-01 needs this for package.json name field. Legal documents, email templates, and payment gateway registration require this.
- **Referenced in:** BRD §1, SRS §1
- **Blocker level:** REQUIRED
- **Default value:** None
- **Expected format:** string (company name)
- **Example answer:** Acme Trading Ltd
- **Your answer:** [PENDING]

### §1.2 Legal Entity Name
- **Question:** What is the registered legal entity name (if different from business name)?
- **Why needed:** Payment gateway KYC, terms of service, privacy policy, and regulatory filings require the exact legal entity name.
- **Referenced in:** BRD §10, SRS §10
- **Blocker level:** REQUIRED FOR PHASE 3
- **Default value:** Same as business name
- **Expected format:** string (legal entity name)
- **Example answer:** Acme Trading Limited
- **Your answer:** [PENDING]

### §1.3 Project Codename
- **Question:** What is the internal project codename used for repository and deployment naming?
- **Why needed:** WP-01 needs this for repository name, Docker image names, and environment variable prefixes.
- **Referenced in:** IMP §2, IDS §2
- **Blocker level:** REQUIRED
- **Default value:** None
- **Expected format:** string (kebab-case, no spaces)
- **Example answer:** bullion-terminal
- **Your answer:** [PENDING]

### §1.4 Primary Domain Name
- **Question:** What is the primary domain name for the production platform?
- **Why needed:** SSL certificates, CORS configuration, email SPF/DKIM records, and payment gateway webhooks require this.
- **Referenced in:** SATM §6, IDS §4
- **Blocker level:** REQUIRED FOR PHASE 3
- **Default value:** None
- **Expected format:** domain (e.g., example.com)
- **Example answer:** trading.example.com
- **Your answer:** [PENDING]

### §1.5 API Subdomain
- **Question:** What subdomain will serve the API?
- **Why needed:** API gateway configuration, CORS origins, and rate limiting rules.
- **Referenced in:** ADS §1, SATM §6
- **Blocker level:** REQUIRED FOR PHASE 3
- **Default value:** api
- **Expected format:** string (subdomain name)
- **Example answer:** api
- **Your answer:** [PENDING]

### §1.6 Admin Subdomain
- **Question:** What subdomain will serve the admin portal?
- **Why needed:** Admin portal access control, separate CORS configuration, and security monitoring.
- **Referenced in:** ADS §14, SATM §5
- **Blocker level:** REQUIRED FOR PHASE 9
- **Default value:** admin
- **Expected format:** string (subdomain name)
- **Example answer:** admin
- **Your answer:** [PENDING]

### §1.7 Brand Tagline
- **Question:** What is the brand tagline displayed on the landing page and in marketing materials?
- **Why needed:** UDS §3 branding, email templates, and UI header.
- **Referenced in:** UDS §3, BRD §1
- **Blocker level:** OPTIONAL
- **Default value:** None
- **Expected format:** string (short phrase)
- **Example answer:** Trade with Confidence
- **Your answer:** [PENDING]

---

## §2 Branding & UI

### §2.1 Primary Brand Color
- **Question:** What is the primary brand color (hex code)?
- **Why needed:** UDS §2 design system, button styles, active states, and logo usage.
- **Referenced in:** UDS §2.2
- **Blocker level:** OPTIONAL
- **Default value:** #2563EB (blue)
- **Expected format:** hex color (e.g., #2563EB)
- **Example answer:** #2563EB
- **Your answer:** [PENDING]

### §2.2 Secondary Brand Color
- **Question:** What is the secondary brand color (hex code)?
- **Why needed:** UDS §2 design system, hover states, and accent elements.
- **Referenced in:** UDS §2.2
- **Blocker level:** OPTIONAL
- **Default value:** #1D4ED8
- **Expected format:** hex color (e.g., #1D4ED8)
- **Example answer:** #1D4ED8
- **Your answer:** [PENDING]

### §2.3 Accent Color
- **Question:** What is the accent color for highlights and focus states (hex code)?
- **Why needed:** UDS §2 design system, focus rings, and interactive elements.
- **Referenced in:** UDS §2.2
- **Blocker level:** OPTIONAL
- **Default value:** #DBEAFE
- **Expected format:** hex color (e.g., #DBEAFE)
- **Example answer:** #DBEAFE
- **Your answer:** [PENDING]

### §2.4 Dark Mode Background Color
- **Question:** What is the dark mode background color (hex code)?
- **Why needed:** UDS §2 design system, dark mode theme.
- **Referenced in:** UDS §2.2
- **Blocker level:** OPTIONAL
- **Default value:** #0F1117
- **Expected format:** hex color (e.g., #0F1117)
- **Example answer:** #0F1117
- **Your answer:** [PENDING]

### §2.5 Dark Mode Text Color
- **Question:** What is the dark mode primary text color (hex code)?
- **Why needed:** UDS §2 design system, dark mode readability.
- **Referenced in:** UDS §2.2
- **Blocker level:** OPTIONAL
- **Default value:** #F3F4F6
- **Expected format:** hex color (e.g., #F3F4F6)
- **Example answer:** #F3F4F6
- **Your answer:** [PENDING]

### §2.6 Logo URL
- **Question:** What is the URL for the platform logo?
- **Why needed:** UDS §3 branding, email headers, and UI header.
- **Referenced in:** UDS §3
- **Blocker level:** OPTIONAL
- **Default value:** None
- **Expected format:** URL (https://...)
- **Example answer:** https://assets.example.com/logo.png
- **Your answer:** [PENDING]

### §2.7 Favicon URL
- **Question:** What is the URL for the favicon?
- **Why needed:** Browser tab display, bookmark icons.
- **Referenced in:** UDS §3
- **Blocker level:** OPTIONAL
- **Default value:** None
- **Expected format:** URL (https://...)
- **Example answer:** https://assets.example.com/favicon.ico
- **Your answer:** [PENDING]

### §2.8 Email Sender Name
- **Question:** What name appears in the "From" field for transactional emails?
- **Why needed:** Email deliverability, user trust, and brand recognition.
- **Referenced in:** IMP §9, BRD §6
- **Blocker level:** REQUIRED FOR PHASE 7
- **Default value:** [Business Name]
- **Expected format:** string (sender name)
- **Example answer:** Acme Trading
- **Your answer:** [PENDING]

### §2.9 Email Sender Address
- **Question:** What email address sends transactional emails?
- **Why needed:** SPF/DKIM configuration, email deliverability, and reply-to handling.
- **Referenced in:** IMP §9, BRD §6
- **Blocker level:** REQUIRED FOR PHASE 7
- **Default value:** noreply@[domain]
- **Expected format:** email address
- **Example answer:** noreply@trading.example.com
- **Your answer:** [PENDING]

### §2.10 Font Family
- **Question:** What font family should be used for the UI?
- **Why needed:** UDS §2 typography, web font loading, and design consistency.
- **Referenced in:** UDS §2.1
- **Blocker level:** OPTIONAL
- **Default value:** Inter
- **Expected format:** string (font name)
- **Example answer:** Inter
- **Your answer:** [PENDING]

### §2.11 Tone of Voice
- **Question:** What is the communication tone for UI copy and emails?
- **Why needed:** UDS §1 design philosophy, copywriting guidelines, and user communication.
- **Referenced in:** UDS §1.2
- **Blocker level:** OPTIONAL
- **Default value:** Professional, calm, informative
- **Expected format:** string (tone description)
- **Example answer:** Professional, calm, informative
- **Your answer:** [PENDING]

---

## §3 Technology Stack

### §3.1 Node.js Version
- **Question:** What Node.js version will be used for the backend?
- **Why needed:** WP-01 needs this for package.json engines field, Docker base image, and CI/CD runtime.
- **Referenced in:** IMP §2, IDS §5
- **Blocker level:** REQUIRED
- **Default value:** 20.x LTS
- **Expected format:** version string (e.g., 20.x)
- **Example answer:** 20.x
- **Your answer:** [PENDING]

### §3.2 Backend Framework
- **Question:** What backend framework will be used?
- **Why needed:** WP-01 project structure, middleware selection, and dependency installation.
- **Referenced in:** IMP §6, SAD §4
- **Blocker level:** REQUIRED
- **Default value:** Express
- **Expected format:** string (framework name)
- **Example answer:** Express
- **Your answer:** [PENDING]

### §3.3 Package Manager
- **Question:** What package manager will be used?
- **Why needed:** WP-01 needs this for lockfile generation, CI/CD commands, and dependency installation.
- **Referenced in:** IMP §2, IDS §11
- **Blocker level:** REQUIRED
- **Default value:** npm
- **Expected format:** string (npm / yarn / pnpm)
- **Example answer:** npm
- **Your answer:** [PENDING]

### §3.4 Frontend Framework
- **Question:** What frontend framework will be used?
- **Why needed:** WP-10 frontend scaffolding, component library selection, and build configuration.
- **Referenced in:** IMP §8, UDS §1
- **Blocker level:** REQUIRED FOR PHASE 10
- **Default value:** React
- **Expected format:** string (React / Vue / Svelte)
- **Example answer:** React
- **Your answer:** [PENDING]

### §3.5 Language
- **Question:** What language will be used for backend development?
- **Why needed:** WP-01 project structure, TypeScript configuration, and linting rules.
- **Referenced in:** IMP §6, DHCS §5
- **Blocker level:** REQUIRED
- **Default value:** TypeScript
- **Expected format:** string (TypeScript / JavaScript)
- **Example answer:** TypeScript
- **Your answer:** [PENDING]

### §3.6 ORM Choice
- **Question:** What ORM will be used for database access?
- **Why needed:** WP-02 database setup, query patterns, and migration tooling.
- **Referenced in:** IMP §6, DDS §2
- **Blocker level:** REQUIRED FOR PHASE 2
- **Default value:** Prisma
- **Expected format:** string (ORM name)
- **Example answer:** Prisma
- **Your answer:** [PENDING]

### §3.7 Testing Framework
- **Question:** What testing framework will be used for unit and integration tests?
- **Why needed:** WP-01 test setup, CI/CD test commands, and test file conventions.
- **Referenced in:** TSQS §4, IMP §18
- **Blocker level:** REQUIRED
- **Default value:** Jest
- **Expected format:** string (framework name)
- **Example answer:** Jest
- **Your answer:** [PENDING]

---

## §4 Infrastructure & Hosting

### §4.1 Git Platform
- **Question:** Which Git platform will host the repository?
- **Why needed:** WP-01 needs this for CI/CD configuration, repository initialization, and webhook setup.
- **Referenced in:** IDS §11, IMP §18
- **Blocker level:** REQUIRED
- **Default value:** GitHub
- **Expected format:** string (GitHub / GitLab / Bitbucket)
- **Example answer:** GitHub
- **Your answer:** [PENDING]

### §4.2 Hosting Provider
- **Question:** Which cloud provider will host the platform?
- **Why needed:** IDS §4 hosting strategy, infrastructure provisioning, and cost estimation.
- **Referenced in:** IDS §4, DOM §2
- **Blocker level:** REQUIRED FOR PHASE 3
- **Default value:** AWS
- **Expected format:** string (AWS / GCP / Azure / Railway / Vercel)
- **Example answer:** AWS
- **Your answer:** [PENDING]

### §4.3 Docker Usage
- **Question:** Will Docker be used for containerization?
- **Why needed:** WP-01 Dockerfile creation, deployment strategy, and local development setup.
- **Referenced in:** IDS §5, IMP §2
- **Blocker level:** REQUIRED
- **Default value:** Yes
- **Expected format:** boolean (Yes / No)
- **Example answer:** Yes
- **Your answer:** [PENDING]

### §4.4 Container Orchestration
- **Question:** Which container orchestration platform will be used?
- **Why needed:** IDS §5 compute layer, deployment manifests, and scaling configuration.
- **Referenced in:** IDS §5, DOM §5
- **Blocker level:** REQUIRED FOR PHASE 3
- **Default value:** Kubernetes
- **Expected format:** string (Kubernetes / Docker Compose / ECS)
- **Example answer:** Kubernetes
- **Your answer:** [PENDING]

### §4.5 CDN Provider
- **Question:** Which CDN will serve static assets?
- **Why needed:** IDS §4 hosting strategy, asset delivery performance, and SSL termination.
- **Referenced in:** IDS §4, DOM §2
- **Blocker level:** REQUIRED FOR PHASE 10
- **Default value:** Cloudflare
- **Expected format:** string (Cloudflare / AWS CloudFront)
- **Example answer:** Cloudflare
- **Your answer:** [PENDING]

### §4.6 Domain Registrar
- **Question:** Which registrar manages the domain?
- **Why needed:** DNS configuration, SSL certificate provisioning, and domain renewal management.
- **Referenced in:** IDS §4, SATM §6
- **Blocker level:** REQUIRED FOR PHASE 3
- **Default value:** None
- **Expected format:** string (registrar name)
- **Example answer:** Namecheap
- **Your answer:** [PENDING]

### §4.7 SSL Certificate Provider
- **Question:** Which SSL certificate provider will be used?
- **Why needed:** SATM §6 transport security, certificate automation, and renewal management.
- **Referenced in:** SATM §6, IDS §4
- **Blocker level:** REQUIRED FOR PHASE 3
- **Default value:** Let's Encrypt
- **Expected format:** string (Let's Encrypt / DigiCert)
- **Example answer:** Let's Encrypt
- **Your answer:** [PENDING]

---

## §5 Database

### §5.1 Database Provider
- **Question:** Which managed PostgreSQL provider will be used?
- **Why needed:** WP-02 database setup, connection string configuration, and backup strategy.
- **Referenced in:** DDS §2, IDS §7
- **Blocker level:** REQUIRED FOR PHASE 2
- **Default value:** Supabase
- **Expected format:** string (Supabase / Neon / Railway / AWS RDS)
- **Example answer:** Supabase
- **Your answer:** [PENDING]

### §5.2 Database Project URL
- **Question:** What is the database project/connection URL?
- **Why needed:** WP-02 environment configuration, ORM setup, and connection pooling.
- **Referenced in:** DDS §2, IMP §14
- **Blocker level:** REQUIRED FOR PHASE 2
- **Default value:** None
- **Expected format:** connection string (postgresql://...)
- **Example answer:** postgresql://user:pass@host:5432/db
- **Your answer:** [PENDING]

### §5.3 Database Region
- **Question:** Which region will host the primary database?
- **Why needed:** IDS §7 database infrastructure, latency optimization, and compliance requirements.
- **Referenced in:** IDS §7, DDS §2
- **Blocker level:** REQUIRED FOR PHASE 2
- **Default value:** us-east-1
- **Expected format:** string (region code)
- **Example answer:** us-east-1
- **Your answer:** [PENDING]

### §5.4 Connection String Format
- **Question:** What connection string format will be used?
- **Why needed:** WP-02 environment configuration, ORM connection setup, and SSL mode configuration.
- **Referenced in:** DDS §2, IMP §14
- **Blocker level:** REQUIRED FOR PHASE 2
- **Default value:** postgresql://[user]:[password]@[host]:[port]/[database]
- **Expected format:** string (connection string template)
- **Example answer:** postgresql://[user]:[password]@[host]:[port]/[database]
- **Your answer:** [PENDING]

### §5.5 Backup Strategy
- **Question:** What backup strategy will be used?
- **Why needed:** DDS §13 backup strategy, disaster recovery planning, and RPO/RTO targets.
- **Referenced in:** DDS §13, IDS §15
- **Blocker level:** REQUIRED FOR PHASE 2
- **Default value:** Daily full + continuous WAL
- **Expected format:** string (backup description)
- **Example answer:** Daily full backup + continuous WAL archiving
- **Your answer:** [PENDING]

### §5.6 Point-in-Time Recovery
- **Question:** Will PITR (Point-in-Time Recovery) be enabled?
- **Why needed:** DDS §13, IDS §15 disaster recovery, and data corruption recovery.
- **Referenced in:** DDS §13, IDS §15
- **Blocker level:** REQUIRED FOR PHASE 2
- **Default value:** Yes
- **Expected format:** boolean (Yes / No)
- **Example answer:** Yes
- **Your answer:** [PENDING]

### §5.7 Read Replica
- **Question:** Will read replicas be used for reporting queries?
- **Why needed:** DDS §2, IDS §7 database infrastructure, and query performance optimization.
- **Referenced in:** DDS §2, IDS §7
- **Blocker level:** REQUIRED FOR PHASE 2
- **Default value:** Yes
- **Expected format:** boolean (Yes / No)
- **Example answer:** Yes
- **Your answer:** [PENDING]

---

## §6 Payments & Financial

### §6.1 Payment Gateway
- **Question:** Which payment gateway will be used for deposits and withdrawals?
- **Why needed:** WP-05 payment integration, API configuration, and webhook setup.
- **Referenced in:** BRD §6, ADS §10
- **Blocker level:** REQUIRED FOR PHASE 3
- **Default value:** Stripe
- **Expected format:** string (Stripe / PayPal / Custom)
- **Example answer:** Stripe
- **Your answer:** [PENDING]

### §6.2 Sandbox Mode
- **Question:** Will the payment gateway start in sandbox mode?
- **Why needed:** WP-05 payment integration, testing configuration, and production readiness.
- **Referenced in:** BRD §6, ADS §10
- **Blocker level:** REQUIRED FOR PHASE 3
- **Default value:** Yes
- **Expected format:** boolean (Yes / No)
- **Example answer:** Yes
- **Your answer:** [PENDING]

### §6.3 Live API Key
- **Question:** What is the live payment gateway API key?
- **Why needed:** WP-05 production deployment, payment processing, and transaction execution.
- **Referenced in:** SATM §10, ADS §10
- **Blocker level:** REQUIRED FOR PHASE 3 (production)
- **Default value:** None
- **Expected format:** API key string
- **Example answer:** sk_live_...
- **Your answer:** [PENDING]

### §6.4 Sandbox API Key
- **Question:** What is the sandbox payment gateway API key?
- **Why needed:** WP-05 development and testing, payment integration testing.
- **Referenced in:** ADS §10, TSQS §6
- **Blocker level:** REQUIRED FOR PHASE 3
- **Default value:** None
- **Expected format:** API key string
- **Example answer:** sk_test_...
- **Your answer:** [PENDING]

### §6.5 Webhook URL
- **Question:** What URL will receive payment gateway webhooks?
- **Why needed:** WP-05 webhook configuration, payment confirmation handling, and security verification.
- **Referenced in:** ADS §10, SATM §10
- **Blocker level:** REQUIRED FOR PHASE 3
- **Default value:** https://[api-subdomain].[domain]/api/v1/payments/webhook
- **Expected format:** URL
- **Example answer:** https://api.trading.example.com/api/v1/payments/webhook
- **Your answer:** [PENDING]

### §6.6 Supported Currencies
- **Question:** Which currencies will be supported?
- **Why needed:** BRD §6, ADS §10 payment configuration, and wallet currency setup.
- **Referenced in:** BRD §6, DDS §5
- **Blocker level:** REQUIRED FOR PHASE 3
- **Default value:** USD
- **Expected format:** comma-separated list (USD, EUR, GBP)
- **Example answer:** USD, EUR, GBP
- **Your answer:** [PENDING]

### §6.7 Default Currency
- **Question:** What is the default platform currency?
- **Why needed:** BRD §6, wallet configuration, and display formatting.
- **Referenced in:** BRD §6, DDS §5
- **Blocker level:** REQUIRED FOR PHASE 3
- **Default value:** USD
- **Expected format:** currency code (USD)
- **Example answer:** USD
- **Your answer:** [PENDING]

### §6.8 Minimum Deposit
- **Question:** What is the minimum deposit amount?
- **Why needed:** BRD §7 business rules, payment validation, and UI limits.
- **Referenced in:** BRD §7, ADS §10
- **Blocker level:** REQUIRED FOR PHASE 3
- **Default value:** 10.00
- **Expected format:** number (decimal)
- **Example answer:** 10.00
- **Your answer:** [PENDING]

### §6.9 Maximum Deposit
- **Question:** What is the maximum deposit amount?
- **Why needed:** BRD §7 business rules, payment validation, and risk controls.
- **Referenced in:** BRD §7, ADS §10
- **Blocker level:** REQUIRED FOR PHASE 3
- **Default value:** 10000.00
- **Expected format:** number (decimal)
- **Example answer:** 10000.00
- **Your answer:** [PENDING]

### §6.10 Minimum Withdrawal
- **Question:** What is the minimum withdrawal amount?
- **Why needed:** BRD §7 business rules, payment validation, and operational costs.
- **Referenced in:** BRD §7, ADS §10
- **Blocker level:** REQUIRED FOR PHASE 3
- **Default value:** 15.00
- **Expected format:** number (decimal)
- **Example answer:** 15.00
- **Your answer:** [PENDING]

### §6.11 Maximum Withdrawal
- **Question:** What is the maximum withdrawal amount?
- **Why needed:** BRD §7 business rules, payment validation, and risk controls.
- **Referenced in:** BRD §7, ADS §10
- **Blocker level:** REQUIRED FOR PHASE 3
- **Default value:** 5000.00
- **Expected format:** number (decimal)
- **Example answer:** 5000.00
- **Your answer:** [PENDING]

### §6.12 Withdrawal Fee
- **Question:** What is the withdrawal processing fee?
- **Why needed:** BRD §8 revenue rules, fee calculation, and user communication.
- **Referenced in:** BRD §8, ADS §10
- **Blocker level:** REQUIRED FOR PHASE 3
- **Default value:** 1.5% or $2.00 (whichever higher)
- **Expected format:** string (fee description)
- **Example answer:** 1.5% or $2.00 (whichever higher)
- **Your answer:** [PENDING]

### §6.13 Deposit Fee
- **Question:** What is the deposit processing fee?
- **Why needed:** BRD §8 revenue rules, fee calculation, and user communication.
- **Referenced in:** BRD §8, ADS §10
- **Blocker level:** REQUIRED FOR PHASE 3
- **Default value:** 0%
- **Expected format:** percentage (0%)
- **Example answer:** 0%
- **Your answer:** [PENDING]

### §6.14 Payout Ratio
- **Question:** What is the default payout ratio for winning trades?
- **Why needed:** BRD §8 revenue rules, payout calculation, and platform margin.
- **Referenced in:** BRD §8, ADS §11
- **Blocker level:** REQUIRED FOR PHASE 5
- **Default value:** 80%
- **Expected format:** percentage (65%-88%)
- **Example answer:** 80%
- **Your answer:** [PENDING]

### §6.15 Referral Commission Rate
- **Question:** What is the commission rate for referrals?
- **Why needed:** BRD §8 revenue rules, referral calculation, and affiliate program.
- **Referenced in:** BRD §8, ADS §13
- **Blocker level:** REQUIRED FOR PHASE 8
- **Default value:** 5%
- **Expected format:** percentage
- **Example answer:** 5%
- **Your answer:** [PENDING]

---

## §7 Security

### §7.1 JWT Secret Generation Method
- **Question:** How will the JWT signing secret be generated?
- **Why needed:** SATM §4 authentication security, token signing, and key rotation.
- **Referenced in:** SATM §4, IMP §17
- **Blocker level:** REQUIRED FOR PHASE 2
- **Default value:** Auto-generated by secrets manager
- **Expected format:** string (manual / auto)
- **Example answer:** Auto-generated by secrets manager
- **Your answer:** [PENDING]

### §7.2 JWT Expiration Time
- **Question:** What is the JWT access token expiration time?
- **Why needed:** SATM §4 authentication security, token lifecycle, and session management.
- **Referenced in:** SATM §4, ADS §2
- **Blocker level:** REQUIRED FOR PHASE 2
- **Default value:** 15 minutes
- **Expected format:** duration (15 minutes)
- **Example answer:** 15 minutes
- **Your answer:** [PENDING]

### §7.3 Refresh Token Expiration
- **Question:** What is the refresh token expiration time?
- **Why needed:** SATM §4 authentication security, session persistence, and token rotation.
- **Referenced in:** SATM §4, ADS §2
- **Blocker level:** REQUIRED FOR PHASE 2
- **Default value:** 7 days
- **Expected format:** duration (7 days)
- **Example answer:** 7 days
- **Your answer:** [PENDING]

### §7.4 MFA Method
- **Question:** Which MFA method will be used?
- **Why needed:** SATM §4 authentication security, MFA enforcement, and user security.
- **Referenced in:** SATM §4, SRS §2
- **Blocker level:** REQUIRED FOR PHASE 2
- **Default value:** TOTP
- **Expected format:** string (TOTP / SMS / both)
- **Example answer:** TOTP
- **Your answer:** [PENDING]

### §7.5 Password Minimum Length
- **Question:** What is the minimum password length?
- **Why needed:** SATM §4 password policy, user registration validation, and security requirements.
- **Referenced in:** SATM §4, SRS NFR-SEC-001
- **Blocker level:** REQUIRED FOR PHASE 2
- **Default value:** 8 characters
- **Expected format:** number (characters)
- **Example answer:** 8
- **Your answer:** [PENDING]

### §7.6 Password Complexity Requirements
- **Question:** What password complexity rules apply?
- **Why needed:** SATM §4 password policy, user registration validation, and security requirements.
- **Referenced in:** SATM §4, SRS NFR-SEC-001
- **Blocker level:** REQUIRED FOR PHASE 2
- **Default value:** 1 uppercase, 1 lowercase, 1 digit, 1 special character
- **Expected format:** string (complexity description)
- **Example answer:** 1 uppercase, 1 lowercase, 1 digit, 1 special character
- **Your answer:** [PENDING]

### §7.7 Encryption Algorithm
- **Question:** What encryption algorithm will be used for PII?
- **Why needed:** SATM §7 database security, PII encryption, and compliance requirements.
- **Referenced in:** SATM §7, DDS §12
- **Blocker level:** REQUIRED FOR PHASE 2
- **Default value:** AES-256-GCM
- **Expected format:** string (algorithm name)
- **Example answer:** AES-256-GCM
- **Your answer:** [PENDING]

### §7.8 Secrets Management
- **Question:** Which secrets management solution will be used?
- **Why needed:** SATM §9 secrets management, credential storage, and access control.
- **Referenced in:** SATM §9, IDS §4
- **Blocker level:** REQUIRED FOR PHASE 3
- **Default value:** AWS Secrets Manager
- **Expected format:** string (HashiCorp Vault / AWS Secrets Manager / Azure Key Vault)
- **Example answer:** AWS Secrets Manager
- **Your answer:** [PENDING]

### §7.9 Rate Limiting Strategy
- **Question:** What rate limiting strategy will be used?
- **Why needed:** SATM §6 API security, DDoS protection, and API abuse prevention.
- **Referenced in:** SATM §6, IDS §13
- **Blocker level:** REQUIRED FOR PHASE 2
- **Default value:** Redis-based with in-app fallback
- **Expected format:** string (strategy description)
- **Example answer:** Redis-based with in-app fallback
- **Your answer:** [PENDING]

### §7.10 CORS Origins
- **Question:** Which origins will be allowed for CORS?
- **Why needed:** SATM §6 API security, frontend-backend communication, and browser security.
- **Referenced in:** SATM §6, ADS §6
- **Blocker level:** REQUIRED FOR PHASE 10
- **Default value:** https://[domain]
- **Expected format:** comma-separated URLs
- **Example answer:** https://trading.example.com
- **Your answer:** [PENDING]

### §7.11 Allowed Domains
- **Question:** Which domains are allowed to access the API?
- **Why needed:** SATM §6 API security, access control, and security monitoring.
- **Referenced in:** SATM §6, IDS §6
- **Blocker level:** REQUIRED FOR PHASE 3
- **Default value:** [domain]
- **Expected format:** comma-separated domains
- **Example answer:** trading.example.com
- **Your answer:** [PENDING]

---

## §8 Notifications

### §8.1 Email Provider
- **Question:** Which email provider will be used?
- **Why needed:** WP-07 notification integration, email delivery, and transactional emails.
- **Referenced in:** IMP §9, BRD §6
- **Blocker level:** REQUIRED FOR PHASE 7
- **Default value:** SendGrid
- **Expected format:** string (SendGrid / AWS SES / Mailgun)
- **Example answer:** SendGrid
- **Your answer:** [PENDING]

### §8.2 Email API Key
- **Question:** What is the email provider API key?
- **Why needed:** WP-07 notification integration, email sending, and provider authentication.
- **Referenced in:** SATM §9, IMP §9
- **Blocker level:** REQUIRED FOR PHASE 7
- **Default value:** None
- **Expected format:** API key string
- **Example answer:** SG.xxxxxxxx
- **Your answer:** [PENDING]

### §8.3 SMS Provider
- **Question:** Which SMS provider will be used?
- **Why needed:** WP-07 notification integration, SMS delivery, and 2FA.
- **Referenced in:** IMP §9, BRD §6
- **Blocker level:** REQUIRED FOR PHASE 7
- **Default value:** Twilio
- **Expected format:** string (Twilio / Vonage)
- **Example answer:** Twilio
- **Your answer:** [PENDING]

### §8.4 SMS API Key
- **Question:** What is the SMS provider API key?
- **Why needed:** WP-07 notification integration, SMS sending, and provider authentication.
- **Referenced in:** SATM §9, IMP §9
- **Blocker level:** REQUIRED FOR PHASE 7
- **Default value:** None
- **Expected format:** API key string
- **Example answer:** ACxxxxxxx
- **Your answer:** [PENDING]

### §8.5 Push Notification Provider
- **Question:** Which push notification provider will be used?
- **Why needed:** WP-07 notification integration, push delivery, and mobile notifications.
- **Referenced in:** IMP §9, BRD §6
- **Blocker level:** OPTIONAL
- **Default value:** Firebase
- **Expected format:** string (Firebase / OneSignal)
- **Example answer:** Firebase
- **Your answer:** [PENDING]

### §8.6 Push API Key
- **Question:** What is the push notification provider API key?
- **Why needed:** WP-07 notification integration, push sending, and provider authentication.
- **Referenced in:** SATM §9, IMP §9
- **Blocker level:** OPTIONAL
- **Default value:** None
- **Expected format:** API key string
- **Example answer:** AAAAxxxxx
- **Your answer:** [PENDING]

### §8.7 Default Notification Channels
- **Question:** Which notification channels will be used by default for each event type?
- **Why needed:** IMP §9 notification configuration, user preferences, and event routing.
- **Referenced in:** IMP §9, BRD §6
- **Blocker level:** REQUIRED FOR PHASE 7
- **Default value:** Email for all events
- **Expected format:** string (channel mapping)
- **Example answer:** Trade result: Email, SMS; Deposit: Email; Withdrawal: Email, SMS
- **Your answer:** [PENDING]

---

## §9 Compliance & Legal

### §9.1 Jurisdiction of Operation
- **Question:** In which jurisdiction will the platform operate?
- **Why needed:** BRD §10 compliance, regulatory requirements, and legal framework.
- **Referenced in:** BRD §10, SRS §10
- **Blocker level:** REQUIRED FOR PHASE 3
- **Default value:** None
- **Expected format:** string (country/region)
- **Example answer:** United Kingdom
- **Your answer:** [PENDING]

### §9.2 KYC Provider
- **Question:** Which KYC provider will be used?
- **Why needed:** WP-04 KYC integration, identity verification, and compliance requirements.
- **Referenced in:** BRD §10, SRS §2
- **Blocker level:** REQUIRED FOR PHASE 4
- **Default value:** SumSub
- **Expected format:** string (SumSub / Jumio / Manual)
- **Example answer:** SumSub
- **Your answer:** [PENDING]

### §9.3 KYC API Key
- **Question:** What is the KYC provider API key?
- **Why needed:** WP-04 KYC integration, identity verification, and provider authentication.
- **Referenced in:** SATM §9, IMP §7
- **Blocker level:** REQUIRED FOR PHASE 4
- **Default value:** None
- **Expected format:** API key string
- **Example answer:** sbx_xxxxxxxx
- **Your answer:** [PENDING]

### §9.4 AML Screening Provider
- **Question:** Which AML screening provider will be used?
- **Why needed:** BRD §10 compliance, AML checks, and regulatory requirements.
- **Referenced in:** BRD §10, SRS §10
- **Blocker level:** REQUIRED FOR PHASE 4
- **Default value:** SumSub (included)
- **Expected format:** string (provider name)
- **Example answer:** SumSub
- **Your answer:** [PENDING]

### §9.5 Required Licenses
- **Question:** What licenses are required to operate in the chosen jurisdiction?
- **Why needed:** BRD §10 compliance, legal requirements, and operational setup.
- **Referenced in:** BRD §10, SRS §10
- **Blocker level:** REQUIRED FOR PHASE 3
- **Default value:** None
- **Expected format:** string (license names)
- **Example answer:** Financial Services License, Data Protection License
- **Your answer:** [PENDING]

### §9.6 Data Retention Period
- **Question:** What is the data retention period for user data (GDPR compliance)?
- **Why needed:** BRD §10 compliance, data lifecycle, and regulatory requirements.
- **Referenced in:** BRD §10, SRS §10
- **Blocker level:** REQUIRED FOR PHASE 3
- **Default value:** 7 years
- **Expected format:** duration (7 years)
- **Example answer:** 7 years
- **Your answer:** [PENDING]

### §9.7 Privacy Policy URL
- **Question:** What is the URL for the privacy policy?
- **Why needed:** BRD §10 compliance, legal requirements, and UI footer links.
- **Referenced in:** BRD §10, UDS §3
- **Blocker level:** REQUIRED FOR PHASE 10
- **Default value:** https://[domain]/privacy
- **Expected format:** URL
- **Example answer:** https://trading.example.com/privacy
- **Your answer:** [PENDING]

### §9.8 Terms of Service URL
- **Question:** What is the URL for the terms of service?
- **Why needed:** BRD §10 compliance, legal requirements, and UI footer links.
- **Referenced in:** BRD §10, UDS §3
- **Blocker level:** REQUIRED FOR PHASE 10
- **Default value:** https://[domain]/terms
- **Expected format:** URL
- **Example answer:** https://trading.example.com/terms
- **Your answer:** [PENDING]

### §9.9 Cookie Consent Required
- **Question:** Is cookie consent required for the jurisdiction?
- **Why needed:** BRD §10 compliance, GDPR requirements, and UI cookie banner.
- **Referenced in:** BRD §10, SATM §13
- **Blocker level:** REQUIRED FOR PHASE 10
- **Default value:** Yes
- **Expected format:** boolean (Yes / No)
- **Example answer:** Yes
- **Your answer:** [PENDING]

---

## §10 Operations & Monitoring

### §10.1 Monitoring Stack
- **Question:** Which monitoring stack will be used?
- **Why needed:** IDS §13 monitoring, observability, and alerting configuration.
- **Referenced in:** IDS §13, DOM §9
- **Blocker level:** REQUIRED FOR PHASE 3
- **Default value:** Prometheus + Grafana
- **Expected format:** string (stack description)
- **Example answer:** Prometheus + Grafana
- **Your answer:** [PENDING]

### §10.2 Alerting Platform
- **Question:** Which alerting platform will be used?
- **Why needed:** IDS §13 monitoring, incident notification, and on-call management.
- **Referenced in:** IDS §13, DOM §10
- **Blocker level:** REQUIRED FOR PHASE 3
- **Default value:** PagerDuty
- **Expected format:** string (PagerDuty / Opsgenie)
- **Example answer:** PagerDuty
- **Your answer:** [PENDING]

### §10.3 Incident Notification Email
- **Question:** What email address receives incident notifications?
- **Why needed:** IDS §13 monitoring, incident response, and team notification.
- **Referenced in:** DOM §10, IDS §13
- **Blocker level:** REQUIRED FOR PHASE 3
- **Default value:** incidents@[domain]
- **Expected format:** email address
- **Example answer:** incidents@trading.example.com
- **Your answer:** [PENDING]

### §10.4 On-Call Rotation Schedule
- **Question:** What is the on-call rotation schedule?
- **Why needed:** DOM §10 incident response, team coordination, and escalation paths.
- **Referenced in:** DOM §10, IDS §13
- **Blocker level:** REQUIRED FOR PHASE 3
- **Default value:** Weekly rotation
- **Expected format:** string (schedule description)
- **Example answer:** Weekly rotation, Monday 00:00 UTC
- **Your answer:** [PENDING]

### §10.5 Log Retention Period
- **Question:** What is the log retention period?
- **Why needed:** IDS §14 logging, compliance requirements, and storage costs.
- **Referenced in:** IDS §14, DOM §12
- **Blocker level:** REQUIRED FOR PHASE 3
- **Default value:** 90 days hot, 1 year warm, 7 years cold
- **Expected format:** string (retention description)
- **Example answer:** 90 days hot, 1 year warm, 7 years cold
- **Your answer:** [PENDING]

### §10.6 Health Check Endpoint Path
- **Question:** What is the health check endpoint path?
- **Why needed:** IDS §13 monitoring, load balancer health checks, and service discovery.
- **Referenced in:** IDS §13, ADS §1
- **Blocker level:** REQUIRED
- **Default value:** /health
- **Expected format:** string (path)
- **Example answer:** /health
- **Your answer:** [PENDING]

### §10.7 Metrics Endpoint Path
- **Question:** What is the metrics endpoint path?
- **Why needed:** IDS §13 monitoring, metrics collection, and Prometheus scraping.
- **Referenced in:** IDS §13
- **Blocker level:** REQUIRED FOR PHASE 3
- **Default value:** /metrics
- **Expected format:** string (path)
- **Example answer:** /metrics
- **Your answer:** [PENDING]

---

## §11 Team & Access

### §11.1 Project Owner Name
- **Question:** What is the name of the project owner?
- **Why needed:** DOM §2 operational ownership, escalation paths, and access control.
- **Referenced in:** DOM §2, IDS §1
- **Blocker level:** REQUIRED
- **Default value:** None
- **Expected format:** string (full name)
- **Example answer:** John Smith
- **Your answer:** [PENDING]

### §11.2 Project Owner Email
- **Question:** What is the email address of the project owner?
- **Why needed:** DOM §2 operational ownership, escalation paths, and notifications.
- **Referenced in:** DOM §2, IDS §1
- **Blocker level:** REQUIRED
- **Default value:** None
- **Expected format:** email address
- **Example answer:** john@example.com
- **Your answer:** [PENDING]

### §11.3 Tech Lead Email
- **Question:** What is the email address of the tech lead?
- **Why needed:** DOM §2 operational ownership, technical escalation, and code review.
- **Referenced in:** DOM §2, IDS §1
- **Blocker level:** REQUIRED
- **Default value:** None
- **Expected format:** email address
- **Example answer:** tech@example.com
- **Your answer:** [PENDING]

### §11.4 DevOps Contact
- **Question:** What is the contact information for the DevOps team?
- **Why needed:** DOM §2 operational ownership, infrastructure issues, and deployment support.
- **Referenced in:** DOM §2, IDS §1
- **Blocker level:** REQUIRED FOR PHASE 3
- **Default value:** devops@[domain]
- **Expected format:** email address
- **Example answer:** devops@trading.example.com
- **Your answer:** [PENDING]

### §11.5 QA Contact
- **Question:** What is the contact information for the QA team?
- **Why needed:** DOM §2 operational ownership, testing coordination, and quality gates.
- **Referenced in:** DOM §2, TSQS §2
- **Blocker level:** REQUIRED
- **Default value:** qa@[domain]
- **Expected format:** email address
- **Example answer:** qa@trading.example.com
- **Your answer:** [PENDING]

### §11.6 Support Email
- **Question:** What is the support email address for users?
- **Why needed:** DOM §2 operational ownership, user support, and ticket routing.
- **Referenced in:** DOM §2, BRD §6
- **Blocker level:** REQUIRED FOR PHASE 9
- **Default value:** support@[domain]
- **Expected format:** email address
- **Example answer:** support@trading.example.com
- **Your answer:** [PENDING]

### §11.7 Escalation Path
- **Question:** What is the escalation path for incidents?
- **Why needed:** DOM §10 incident response, team coordination, and critical issue handling.
- **Referenced in:** DOM §10, IDS §13
- **Blocker level:** REQUIRED FOR PHASE 3
- **Default value:** Support → Tech Lead → Project Owner → CTO
- **Expected format:** string (escalation chain)
- **Example answer:** Support → Tech Lead → Project Owner → CTO
- **Your answer:** [PENDING]

### §11.8 Access Control Strategy
- **Question:** What access control strategy will be used?
- **Why needed:** SATM §5 authorization, RBAC implementation, and security enforcement.
- **Referenced in:** SATM §5, SRS §4
- **Blocker level:** REQUIRED FOR PHASE 2
- **Default value:** RBAC (Role-Based Access Control)
- **Expected format:** string (RBAC / ABAC)
- **Example answer:** RBAC (Role-Based Access Control)
- **Your answer:** [PENDING]

---

## §12 Price Feed & Market Data

### §12.1 Price Feed Provider
- **Question:** Which price feed provider will be used?
- **Why needed:** WP-04 price feed integration, market data ingestion, and trading execution.
- **Referenced in:** BRD §13, ADS §12
- **Blocker level:** REQUIRED FOR PHASE 4
- **Default value:** Binance
- **Expected format:** string (Binance / FXCM / OANDA)
- **Example answer:** Binance
- **Your answer:** [PENDING]

### §12.2 Feed API Key
- **Question:** What is the price feed API key?
- **Why needed:** WP-04 price feed integration, market data authentication, and rate limits.
- **Referenced in:** SATM §9, ADS §12
- **Blocker level:** REQUIRED FOR PHASE 4
- **Default value:** None
- **Expected format:** API key string
- **Example answer:** xxxxxxxx
- **Your answer:** [PENDING]

### §12.3 Feed Endpoint URL
- **Question:** What is the price feed endpoint URL?
- **Why needed:** WP-04 price feed integration, WebSocket connection, and market data streaming.
- **Referenced in:** ADS §12, IMP §6
- **Blocker level:** REQUIRED FOR PHASE 4
- **Default value:** None
- **Expected format:** URL (wss://...)
- **Example answer:** wss://stream.binance.com:9443/ws
- **Your answer:** [PENDING]

### §12.4 Fallback Feed Provider
- **Question:** Which fallback price feed provider will be used?
- **Why needed:** BRD §13, ADS §12 failover, and price feed redundancy.
- **Referenced in:** BRD §13, ADS §12
- **Blocker level:** REQUIRED FOR PHASE 4
- **Default value:** None
- **Expected format:** string (provider name)
- **Example answer:** OANDA
- **Your answer:** [PENDING]

### §12.5 Price Validation Rules
- **Question:** What price validation rules will be applied?
- **Why needed:** BRD §9 risk management, price integrity, and fraud prevention.
- **Referenced in:** BRD §9, SATM §11
- **Blocker level:** REQUIRED FOR PHASE 4
- **Default value:** Price must be within 5% of previous tick
- **Expected format:** string (validation rules)
- **Example answer:** Price must be within 5% of previous tick, no negative prices
- **Your answer:** [PENDING]

### §12.6 Stale Price Threshold
- **Question:** What is the stale price threshold in seconds?
- **Why needed:** BRD §9 risk management, price freshness, and trading halt conditions.
- **Referenced in:** BRD §9, ADS §12
- **Blocker level:** REQUIRED FOR PHASE 4
- **Default value:** 30 seconds
- **Expected format:** number (seconds)
- **Example answer:** 30
- **Your answer:** [PENDING]

### §12.7 WebSocket Port
- **Question:** What WebSocket port will be used for price streaming?
- **Why needed:** ADS §17 WebSocket API, client connection, and firewall rules.
- **Referenced in:** ADS §17, IDS §6
- **Blocker level:** REQUIRED FOR PHASE 4
- **Default value:** 443 (WSS)
- **Expected format:** number (port)
- **Example answer:** 443
- **Your answer:** [PENDING]

### §12.8 Allowed Trading Instruments
- **Question:** Which trading instruments will be supported?
- **Why needed:** BRD §6, ADS §12 asset configuration, and trading UI.
- **Referenced in:** BRD §6, DDS §5
- **Blocker level:** REQUIRED FOR PHASE 4
- **Default value:** EUR/USD, GBP/USD, USD/JPY, Gold, Oil
- **Expected format:** comma-separated list
- **Example answer:** EUR/USD, GBP/USD, USD/JPY, XAU/USD, XTI/USD
- **Your answer:** [PENDING]

### §12.9 Market Open/Close Times
- **Question:** What are the market open and close times for each instrument?
- **Why needed:** BRD §6, ADS §12 trading hours, and contract availability.
- **Referenced in:** BRD §6, DDS §5
- **Blocker level:** REQUIRED FOR PHASE 4
- **Default value:** 24/7 for crypto, market hours for forex
- **Expected format:** string (time schedule)
- **Example answer:** Forex: 00:00-23:59 UTC Mon-Fri, Crypto: 24/7
- **Your answer:** [PENDING]

---

## §13 Third-Party Integrations

### §13.1 Analytics Provider
- **Question:** Which analytics provider will be used?
- **Why needed:** User behavior tracking, business intelligence, and product optimization.
- **Referenced in:** IDS §4, BRD §11
- **Blocker level:** OPTIONAL
- **Default value:** Google Analytics
- **Expected format:** string (Google Analytics / Plausible)
- **Example answer:** Google Analytics
- **Your answer:** [PENDING]

### §13.2 Error Tracking Provider
- **Question:** Which error tracking provider will be used?
- **Why needed:** Error monitoring, crash reporting, and production debugging.
- **Referenced in:** IDS §13, DOM §9
- **Blocker level:** REQUIRED FOR PHASE 3
- **Default value:** Sentry
- **Expected format:** string (Sentry / Rollbar)
- **Example answer:** Sentry
- **Your answer:** [PENDING]

### §13.3 Error Tracking DSN
- **Question:** What is the error tracking DSN?
- **Why needed:** Error tracking integration, error reporting, and alert configuration.
- **Referenced in:** IDS §13, DOM §9
- **Blocker level:** REQUIRED FOR PHASE 3
- **Default value:** None
- **Expected format:** DSN string
- **Example answer:** https://xxxxxxx@sentry.io/xxxxx
- **Your answer:** [PENDING]

### §13.4 CDN Provider
- **Question:** Which CDN provider will be used for static assets?
- **Why needed:** Asset delivery performance, global distribution, and SSL termination.
- **Referenced in:** IDS §4, DOM §2
- **Blocker level:** REQUIRED FOR PHASE 10
- **Default value:** Cloudflare
- **Expected format:** string (Cloudflare / AWS CloudFront)
- **Example answer:** Cloudflare
- **Your answer:** [PENDING]

### §13.5 Object Storage Provider
- **Question:** Which object storage provider will be used?
- **Why needed:** KYC document storage, database backups, and file uploads.
- **Referenced in:** IDS §10, DDS §13
- **Blocker level:** REQUIRED FOR PHASE 3
- **Default value:** AWS S3
- **Expected format:** string (AWS S3 / Cloudflare R2)
- **Example answer:** AWS S3
- **Your answer:** [PENDING]

### §13.6 Storage Bucket Name
- **Question:** What is the object storage bucket name?
- **Why needed:** KYC document storage, backup storage, and file upload configuration.
- **Referenced in:** IDS §10, DDS §13
- **Blocker level:** REQUIRED FOR PHASE 3
- **Default value:** None
- **Expected format:** string (bucket name)
- **Example answer:** bullion-terminal-production
- **Your answer:** [PENDING]

### §13.7 Other External APIs
- **Question:** Are there any other external APIs that need to be integrated?
- **Why needed:** Third-party integrations, API configuration, and dependency management.
- **Referenced in:** SRS §7, ADS §16
- **Blocker level:** OPTIONAL
- **Default value:** None
- **Expected format:** string (API descriptions)
- **Example answer:** None
- **Your answer:** [PENDING]

---

## §14 Custom / Project-Specific

### §14.1 Business Model Specifics
- **Question:** Are there any unique business model specifics not covered in standard sections?
- **Why needed:** Custom business logic, unique features, and competitive differentiation.
- **Referenced in:** BRD §3, BRD §12
- **Blocker level:** OPTIONAL
- **Default value:** None
- **Expected format:** string (description)
- **Example answer:** None
- **Your answer:** [PENDING]

### §14.2 Unique Features
- **Question:** Are there any unique features that require special configuration?
- **Why needed:** Feature implementation, configuration, and testing.
- **Referenced in:** BRD §12, SRS §2
- **Blocker level:** OPTIONAL
- **Default value:** None
- **Expected format:** string (feature descriptions)
- **Example answer:** None
- **Your answer:** [PENDING]

### §14.3 Custom Requirements
- **Question:** Are there any custom requirements from the owner not covered in previous sections?
- **Why needed:** Project-specific needs, custom integrations, and special considerations.
- **Referenced in:** BRD §13, SRS §12
- **Blocker level:** OPTIONAL
- **Default value:** None
- **Expected format:** string (requirements description)
- **Example answer:** None
- **Your answer:** [PENDING]

---

## Completion Checklist

Before starting WP-01, ensure all REQUIRED questions are answered:

- [ ] §1 Project Identity - All REQUIRED questions answered
- [ ] §3 Technology Stack - All REQUIRED questions answered
- [ ] §4 Infrastructure & Hosting - All REQUIRED questions answered
- [ ] §5 Database - All REQUIRED questions answered
- [ ] §6 Payments & Financial - All REQUIRED questions answered
- [ ] §7 Security - All REQUIRED questions answered
- [ ] §10 Operations & Monitoring - All REQUIRED questions answered
- [ ] §11 Team & Access - All REQUIRED questions answered

**Status:** [PENDING COMPLETION]

---

## Notes for AI Agents

When executing a work package, if a question value is `[PENDING]`, the AI agent MUST:

1. Check the blocker level
2. If REQUIRED or REQUIRED FOR CURRENT PHASE, ask the owner for the value
3. If OPTIONAL or REQUIRED FOR FUTURE PHASE, use the default value
4. Never proceed without REQUIRED values for the current phase

---

**END OF PROJECT ONBOARDING**
