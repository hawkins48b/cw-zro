---
name: ios-compliance
description: Apple iOS App Store compliance rules for the ZRO ballistic calculator. Use when writing UI text, app descriptions, metadata, implementing features that touch privacy/data/payments, or reviewing any content that could affect App Store approval. This is a firearms-related calculation tool and must follow strict guidelines.
user-invocable: true
---

# iOS App Store Compliance — ZRO Ballistic Calculator

This app is a **precision shooting sports and long-range marksmanship calculation tool**. It must pass Apple App Store review. Every feature, string, image, and metadata choice must be evaluated against these rules.

See [references/app-store-guidelines.md](references/app-store-guidelines.md) for the full relevant Apple guidelines with section numbers.

## Critical Rules for This App

### Content & Language (Sections 1.1.2, 1.1.3, 1.4.3)

**Allowed**: ballistic calculation, trajectory computation, dope cards, scope adjustment, sporting/competitive shooting reference.

**Forbidden**:
- Facilitating firearms or ammunition purchase
- Content encouraging illegal or reckless use of weapons
- Realistic depictions of people being killed or maimed
- Combat, tactical assault, or violence-glorifying framing

**Language guidelines**:
- Use neutral, technical, scientific terminology
- Say "target distance" not "kill range"
- Say "point of impact" not "hit zone"
- Say "precision shooting sports" not "tactical shooting"
- Say "projectile" or "bullet" in a physics context, not in a harmful context
- Describe the app as an "educational and sporting tool for marksmanship"
- Metadata (title, subtitle, description, screenshots) must be appropriate for a **4+ audience** even if the app is rated higher (Section 2.3.8)

### Age Rating (Sections 2.3.6, 2.3.8)

- Rate the app **12+** (Infrequent/Mild Realistic Violence — firearms reference)
- Answer age rating questionnaire honestly in App Store Connect
- App icon, screenshots, and previews must all adhere to **4+ rating** regardless of app rating
- Do not show firearms imagery in screenshots or icon — focus on data, charts, calculations

### Privacy & Data (Sections 5.1.1, 5.1.2)

- **Prefer local-only storage** — ballistic profiles, settings, and calculations should stay on-device
- If any data is collected, a **privacy policy link is mandatory** in App Store Connect and in-app
- Privacy policy must explicitly state: what data is collected, how it's used, third-party sharing, retention/deletion policies
- Only request permissions relevant to core functionality (Section 5.1.1(iii))
- If no account is needed, **do not require sign-in** (Section 5.1.1(v))
- If accounts exist, must provide **account deletion** in-app
- No App Tracking Transparency needed if no cross-app tracking

### In-App Purchases (Sections 3.1.1, 3.1.2)

- All digital content/feature unlocks **must** use Apple IAP — no external payment links
- If offering a subscription, it must provide ongoing value and last at least 7 days
- Clearly disclose any IAP in app description and screenshots (Section 2.3.2)
- Free trial: use Non-Consumable IAP at Price Tier 0 with naming convention "XX-day Trial"

### Hybrid App / Capacitor Rules (Sections 2.5.1, 2.5.2, 2.5.6, 4.2)

- Must use **WebKit** for web views (Capacitor uses WKWebView — compliant)
- App must be **self-contained** — cannot download code that changes functionality
- Must use only **public APIs** — no private API access via Capacitor plugins
- App must feel **"app-like"** — not just a repackaged website (Section 4.2)
- No hidden or dormant features (Section 2.3.1(a))

### Support & Contact (Section 1.5)

- Must include a Support URL with contact information
- Must be accessible from within the app

## Checklist Before Submission

- [ ] All UI text uses neutral, technical language
- [ ] No firearms imagery in icon or screenshots — show charts, data tables, calculations
- [ ] App description frames tool as educational/sporting
- [ ] Age rating set to 12+ with accurate questionnaire answers
- [ ] Privacy policy linked in App Store Connect AND accessible in-app
- [ ] Data collection is minimal and disclosed
- [ ] No sign-in required (or account deletion available if accounts exist)
- [ ] All paid features use Apple IAP
- [ ] Support URL with contact info accessible in-app
- [ ] App feels native, not like a website wrapper
- [ ] No hidden features or undocumented functionality

## Existing Approved Competitors (Precedent)

These ballistic calculator apps are live on the App Store, proving the category is accepted:
- Ballistic: Advanced Edition
- Shooter: Ballistic Calculator
- Applied Ballistics
- SBC - Ballistic Calculator
- Ballistics Calculator 2026

These all frame themselves as precision shooting, hunting, and sport tools.
