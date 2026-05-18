# Issue: V1 Scaffolding — Implement `FooterV1` and `CncfCallout` Layout Components

## Description
This issue focuses on scaffolding the core layout elements for the React V1 interface redesign shell (`V1_REDESIGN`). The goal is to replace the temporary navy-colored legacy footer with a dedicated `<FooterV1 />` and a `<CncfCallout />` component, ensuring cohesive branding and aesthetic alignment with the main `opentelemetry.io` website.

---

## Technical Details

### 1. Key Primitives
* **`<CncfCallout />`**: A full-width callout section highlighting OpenTelemetry’s status as a Cloud Native Computing Foundation (CNCF) incubating project.
  * **Path**: `src/v1/components/layout/cncf-callout.tsx`
  * **Assets**: Inlined scalable `<CncfLogo />` SVG with standard branding colors.
* **`<FooterV1 />`**: A modern Docsy-theme, two-cluster footer with ecosystem outreach links, copyright attributions, and developer resources.
  * **Path**: `src/v1/components/layout/footer-v1.tsx`
  * **Social Icons**: Bluesky, Mastodon, Slack Workspace, and Stack Overflow.

### 2. Icon Optimization Strategy
To keep the application's bundle size lightweight, we will bypass heavy icon packages (like Font Awesome) and implement the brand-marks as lean, inline SVG React components within `src/components/icons/`:
* `cncf-logo.tsx`
* `bluesky-icon.tsx`
* `mastodon-icon.tsx`
* `stackoverflow-icon.tsx`
* `slack-icon.tsx`

### 3. Verification Criteria
* **Unit Testing**: 100% test coverage using Vitest and React Testing Library (`footer-v1.test.tsx` and `cncf-callout.test.tsx`).
* **Router Wiring**: Wire the newly created components into `src/v1/V1App.tsx` in place of the legacy `<Footer />`.

---

## 🎓 4. Mentor Discussion Points & Architecture Trade-offs

When presenting this proposal to your mentor, here are the key architectural decisions and talking points to discuss:

### A. Vector Asset Strategy: Inlined SVGs vs. Font Awesome
* **Trade-off**: The legacy layout relied on standard icons. Adding four custom modern brand logos (Mastodon, Bluesky, Stack Overflow, Slack) would normally require adding an external dependency or loading a heavy Font Awesome kit (~75KB).
* **Decision**: We chose to inline clean, accessible React SVG components under `src/components/icons/`.
* **Discussion Point**: *Is the team comfortable keeping custom SVG marks as standalone React components under `src/components/icons/` to guarantee absolute zero bundle-size overhead?*

### B. CNCF Branding Guidelines Compliance
* **Rationale**: The official OTel site mandates distinct callouts highlighting the graduation status of the project.
* **Discussion Point**: *Should `<CncfCallout />` be conditionally rendered globally on all v1 routes (as proposed), or are there specific detail-rich pages where the mentor prefers to omit the callout to keep focus on primary charts/content?*

### C. Isolation of V1 Layout Elements
* **Design Choice**: The v1 navbar, footer, and callout elements are strictly placed inside `src/v1/components/layout/`.
* **Discussion Point**: *Does this project require maintaining legacy fallback compatibility on certain devices, or can we proceed with a clean, unilateral replacement in the `V1_REDESIGN` sub-app router shell?*

