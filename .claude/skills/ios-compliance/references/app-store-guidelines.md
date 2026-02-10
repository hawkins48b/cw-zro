# Apple App Store Review Guidelines — Relevant Sections

Source: https://developer.apple.com/app-store/review/guidelines/

## 1. Safety

### 1.1.2 — Realistic Violence
Realistic portrayals of people or animals being killed, maimed, tortured, or abused, or content that encourages violence. "Enemies" within the context of a game cannot solely target a specific race, culture, real government, corporation, or any other real entity.

### 1.1.3 — Weapons & Firearms
Depictions that encourage illegal or reckless use of weapons and dangerous objects, or facilitate the purchase of firearms or ammunition.

### 1.4.3 — Controlled Substances & Weapons
Apps that encourage consumption of tobacco and vape products, illegal drugs, or excessive amounts of alcohol are not permitted. Facilitating the sale of controlled substances or tobacco is not allowed.

### 1.4.5 — Physical Harm
Apps should not urge customers to participate in activities or use their devices in a way that risks physical harm to themselves or others.

### 1.5 — Developer Information
People need to know how to reach you with questions and support issues. Make sure your app and its Support URL include an easy way to contact you.

### 1.6 — Data Security
Apps should implement appropriate security measures to ensure proper handling of user information and prevent unauthorized use, disclosure, or access by third parties.

## 2. Performance

### 2.3.1(a) — Hidden Features
Don't include any hidden, dormant, or undocumented features in your app; your app's functionality should be clear to end users and App Review.

### 2.3.2 — In-App Purchase Disclosure
If your app includes in-app purchases, make sure your app description, screenshots, and previews clearly indicate whether any featured items require additional purchases.

### 2.3.6 — Age Rating Accuracy
Answer the age rating questions in App Store Connect honestly so that your app aligns properly with parental controls.

### 2.3.8 — Metadata Age Appropriateness
Metadata should be appropriate for all audiences, so make sure your app and in-app purchase icons, screenshots, and previews adhere to a 4+ age rating even if your app is rated higher.

### 2.5.1 — Public APIs Only
Apps may only use public APIs and must run on the currently shipping OS.

### 2.5.2 — Self-Contained Apps
Apps should be self-contained in their bundles, and may not read or write data outside the designated container area, nor may they download, install, or execute code which introduces or changes features or functionality of the app.

### 2.5.6 — Web Browser Engines
Apps that browse the web must use the appropriate WebKit framework and WebKit JavaScript.

### 2.5.18 — Display Advertising
Display advertising should be limited to your main app binary. Ads must be appropriate for the app's age rating and allow users to see all targeting data. Must provide ability to report inappropriate ads.

## 3. Business

### 3.1.1 — In-App Purchase Requirements
If you want to unlock features or functionality within your app, you must use in-app purchase. Apps may not use their own mechanisms to unlock content or functionality.

Non-subscription apps may offer a free time-based trial period by setting up a Non-Consumable IAP item at Price Tier 0 following naming convention: "XX-day Trial."

### 3.1.2 — Subscriptions
Auto-renewable subscription period must last at least seven days and be available across all of the user's devices. Must provide ongoing value.

## 4. Design

### 4.2 — Minimum Functionality
Your app should include features, content, and UI that elevate it beyond a repackaged website.

### 4.2.2 — Marketing vs. Functionality
Apps shouldn't primarily be marketing materials, advertisements, web clippings, content aggregators, or a collection of links.

### 4.2.3 — App Functionality
Your app should work on its own without requiring installation of another app to function. If your app needs to download additional resources on initial launch, disclose the size and prompt users.

## 5. Legal — Privacy

### 5.1.1(i) — Privacy Policies
All apps must include a link to their privacy policy in App Store Connect metadata and within the app. The privacy policy must clearly:
- Identify what data the app collects, how it collects that data, and all uses
- Confirm third parties provide equal protection of user data
- Explain data retention/deletion policies and how users can revoke consent

### 5.1.1(ii) — Permission
Apps that collect user or usage data must secure user consent. Paid functionality must not depend on granting data access.

### 5.1.1(iii) — Data Minimization
Apps should only request access to data relevant to core functionality. Use out-of-process pickers rather than full access to protected resources where possible.

### 5.1.1(v) — Account Sign-In
If your app doesn't include significant account-based features, let people use it without a login. If your app supports account creation, you must also offer account deletion within the app.

### 5.1.2(i) — Data Use and Sharing
You may not use, transmit, or share someone's personal data without first obtaining their permission. Clearly disclose where personal data will be shared with third parties. Must receive explicit permission via App Tracking Transparency APIs to track activity.

### 5.1.5 — Location Services
Use Location Services only when directly relevant to features provided by the app. Notify and obtain consent before collecting location data.

## Summary — Risk Areas for ZRO

| Risk Area | Guideline | Mitigation |
|-----------|-----------|------------|
| Firearms content | 1.1.3 | Calculation tool only, neutral language, no sales |
| Violence framing | 1.1.2 | Scientific/sporting terminology, no violent imagery |
| Age rating | 2.3.6, 2.3.8 | 12+ rating, 4+ metadata and screenshots |
| Privacy | 5.1.1 | Local storage, minimal data, privacy policy |
| Hybrid app | 2.5.2, 4.2 | Native-feeling UI, no code downloads, WebKit only |
| Payments | 3.1.1 | Apple IAP for all digital unlocks |
| Contact info | 1.5 | Support URL in-app and in metadata |
