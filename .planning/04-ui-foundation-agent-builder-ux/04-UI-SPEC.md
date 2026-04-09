---
phase: 4
slug: ui-foundation-agent-builder-ux
status: approved
shadcn_initialized: true
preset: new-york
created: 2026-04-08
---

# Phase 4 - UI Design Contract

> Visual and interaction contract for the admin surface, client portal, and future agent-builder wizard. This document locks the baseline visual language before the wizard and deploy flow become deeper and more expensive to change.

---

## Design System

| Property | Value |
|----------|-------|
| Tool | shadcn |
| Preset | new-york |
| Component library | base-ui + shadcn primitives |
| Icon library | lucide-react |
| Font | Geist Sans + Geist Mono |

### Product UI Direction

Stafless should feel like an operator console for a premium service business platform, not a generic SaaS starter kit. The interface should be clean, structured, and quiet under normal use, with moments of emphasis reserved for onboarding progress, deploy state, and blocked actions.

The design language should communicate:
- operational confidence;
- tenant isolation and clarity;
- human-guided AI rather than "magic";
- premium service infrastructure instead of chatbot toy aesthetics.

### Surface Roles

- Admin surface: control room. Dense enough for operators managing many businesses, but never cluttered.
- Client surface: guided business visibility. Simpler, calmer, and strictly non-technical.
- Agent builder wizard: editorial workspace. Clear step rhythm, strong hierarchy, low ambiguity.

### Product Boundary Rules

- Client surface must expose only five primary sections: `Dashboard`, `Agents`, `Leads`, `Dialogs`, and `Connections`.
- Client copy must stay in plain business language and avoid technical product terms such as prompt, deploy, runtime, tool binding, orchestration, workflow, system config, or model settings.
- Admin surface is organized around clients first, not abstract platform objects first. The main operator flow is: open client list -> open one client -> inspect status, channels, integrations, agents, and activity -> create or edit that client's agent.
- Agent builder is admin-only. Clients must never see builder internals or setup controls beyond simple business-facing connection steps.
- Clients can manage connections but do not edit agents directly in v1.
- `Dialogs` and `Leads` are separate UI concepts: dialogs are all conversations, while leads represent target outcomes captured for that client.
- `Leads` UI must support variable business-specific fields rather than implying one fixed vertical schema.
- `Agents` should remain a first-class client navigation item even when some clients have only one agent, because the product model supports multiple agents.

---

## Spacing Scale

Declared values (all multiples of 4):

| Token | Value | Usage |
|-------|-------|-------|
| xs | 4px | Badge padding, icon gaps, micro-alignment |
| sm | 8px | Compact control spacing, inline field grouping |
| md | 16px | Default card internals, label-to-input spacing |
| lg | 24px | Form section padding, card gutters |
| xl | 32px | Major panel gaps, dashboard grid spacing |
| 2xl | 48px | Page section separation |
| 3xl | 64px | Page-level vertical rhythm for larger screens |

Exceptions: 12px may be used for dense table row padding and compact inline chip groups. 40px may be used for hero/stat spacing when 32 feels cramped and 48 is too loose.

### Layout Rhythm

- Page shell padding: `24px` mobile, `32px` desktop.
- Primary content stack gap: `32px`.
- Card internal padding: `24px`.
- Form field stack gap: `16px`.
- Wizard step section gap: `32px`.
- Related micro-controls inside a single card: `8px` or `12px`.

Avoid:
- random one-off spacing tokens;
- 20px/28px/36px ad hoc values without a strong visual reason;
- giant empty whitespace inside data-dense admin pages.

---

## Typography

| Role | Size | Weight | Line Height |
|------|------|--------|-------------|
| Body | 14px / 16px | 400 / 500 | 1.5 |
| Label | 12px / 13px | 500 / 600 | 1.4 |
| Heading | 24px / 30px / 36px | 600 | 1.15-1.2 |
| Display | 44px | 600 | 1.05 |

### Type Hierarchy Rules

- Page eyebrow: `12px`, uppercase, tracking increased, muted tone.
- Primary page title: `30-36px`, semibold, tight tracking.
- Section title: `20-24px`, semibold.
- Card title: `16px`, semibold.
- Metric/stat value: `32-44px`, semibold.
- Table/body text: `14px`.
- Help text and metadata: `12-13px`.

### Tone of Typography

- Admin pages may use denser text blocks, but hierarchy must remain obvious.
- Client pages should feel lighter and more guided.
- Wizard pages must always show a single dominant focal point: current step + what to do next.

Never use:
- oversized marketing-style hero typography in operational screens;
- low-contrast microcopy for critical actions;
- all-caps for main body text.

---

## Color

| Role | Value | Usage |
|------|-------|-------|
| Dominant (60%) | `#F4F1EA` | app backgrounds, page canvas, warm neutral framing |
| Secondary (30%) | `#FFFFFF` and `#E8E1D4` | cards, sidebars, grouped surfaces, section separators |
| Accent (10%) | `#C75C2A` | primary CTA, active wizard step, deploy emphasis, key progress states |
| Destructive | `#B42318` | destructive actions, critical validation and revoke states |

Accent reserved for:
- primary action buttons;
- active step indicators;
- deploy status / test-run emphasis;
- selected nav state when strong focus is needed.

Do not use accent for:
- every interactive control;
- secondary buttons;
- generic info badges;
- entire page backgrounds.

### Supporting Semantic Colors

- Success: `#157347`
- Warning: `#B54708`
- Info: `#175CD3`
- Ink / primary text: `#1F1728`
- Muted text: `#6B6575`
- Border: `#D8D0C2`

### Visual Atmosphere

The interface should feel warm-neutral with terracotta emphasis, not cold enterprise blue and not trendy purple SaaS. Warm paper backgrounds plus dark ink make the product feel more like a premium operations desk than a startup dashboard clone.

---

## Copywriting Contract

| Element | Copy |
|---------|------|
| Primary CTA | `Create tenant`, `Save connection`, `Create agent`, `Deploy agent` |
| Empty state heading | `Nothing connected yet`, `No tenants yet`, `No conversations yet` |
| Empty state body | State what is missing, why it matters, and the exact next action |
| Error state | State the failure plainly, then tell the user what to fix or retry |
| Destructive confirmation | `Delete connection`: `This removes the saved connection from this tenant. You can reconnect it later.` |

### Copy Rules

- Prefer direct verbs + noun: `Create tenant`, not `Start now`.
- Be operational, not cute.
- Avoid AI hype language like `magic`, `supercharge`, `revolutionary`.
- Never make the user decode system terms when plain language works.
- Client-facing copy should reduce anxiety and explain the next step simply.
- Admin-facing copy should optimize for speed and confidence.
- Client-facing copy must describe outcomes and business actions, not internal mechanics.

### Microcopy Style

- Good: `Credentials are encrypted before they are stored.`
- Good: `Connect at least one channel before creating an agent.`
- Good: `Your assistant is active.`
- Good: `Recent customer dialogs`
- Good: `Connect your channels`
- Bad: `Please complete the necessary setup requirements to proceed.`
- Bad: `Configure runtime`
- Bad: `Prompt configuration`
- Bad: `Deploy metadata`

---

## Screen Architecture

### Admin Shell

- Persistent left navigation on desktop.
- Content area max width around `1280px`.
- Primary navigation should center on `Clients`; other sections are secondary.
- Admin dashboard, if present, is secondary to the client list and should function as an operator summary rather than the main product structure.
- Client detail should group into:
  - header;
  - summary metrics;
  - connection status blocks;
  - users / invites / agents.
- If the client has no agent, the dominant CTA should be `Create agent`.
- If the client already has an agent, the detail page should make it obvious how to review or edit it.

### Client Shell

- Simpler top navigation.
- More generous whitespace than admin.
- Navigation must be limited to `Dashboard`, `Agents`, `Leads`, `Dialogs`, and `Connections`.
- Setup-oriented pages should lead with guidance, not metrics overload.
- Client overview should highlight business metrics, simple agent activity, and next action.
- The client surface should never visually resemble an admin console.
- Dashboard should prioritize numbers business users care about, including dialog count, total messages, and period-based summaries.
- Agent cards should expose status, assigned channel, and short purpose/description.
- Lead views should expose both common lead metadata and client-specific captured details.

### Agent Builder Wizard

Wizard contract:
- top progress header with 5 steps;
- one main card/panel per step;
- persistent back/next actions;
- sticky review summary on large screens in later steps if helpful;
- every step must answer one clear question:
  - Basics: who is this agent?
  - Channel: where does it operate?
  - Knowledge: what should it know?
  - Tools: what can it do?
  - Review: is it ready to test and deploy?

Avoid:
- showing all steps expanded at once;
- burying deploy/test actions below noisy forms;
- making knowledge/tools feel like technical JSON editors.

---

## Component Patterns

### Cards

- Rounded `24px` outer radius for main cards.
- Soft border plus subtle shadow.
- White or light secondary surface on warm page background.
- Titles at top-left, actions top-right if needed.

### Tables and Lists

- Admin tables can be used for tenant lists and future agent lists.
- Row hover should be subtle, never loud.
- Dense but readable: 12-14px metadata, 14px body.

### Forms

- Labels always above inputs.
- Help text below controls, never inside placeholder only.
- Textareas for credentials/metadata should look utilitarian, not chat-like.
- Required fields must be obvious without visual noise.

### Status Badges

- Use compact rounded pills.
- Status color must pair with explicit text label.
- Required statuses: `CONNECTED`, `PENDING`, `ERROR`, `REVOKED`, `ACTIVE`, `PAUSED`, `DRAFT`, `DEPLOYING`.

### Knowledge Blocks and Tool Rows

For the future wizard:
- each block should look like a structured editorial card;
- title + short summary visible at a glance;
- edit/delete actions in the header;
- avoid spreadsheet-like rows for knowledge content.

### Review / Test / Deploy Area

- Review should feel like a launch checklist, not just another form.
- Prompt preview in a mono or structured text panel.
- Test agent box should visually read as a sandbox.
- Deploy CTA should be isolated and clearly final.

---

## Responsive Contract

- Mobile first for client portal and simple forms.
- Admin dashboard may simplify density on mobile rather than fully preserve desktop layout.
- Wizard must remain usable on tablet widths without horizontal scrolling.
- Tables should collapse into stacked cards on narrow screens if necessary.
- Critical actions should never sit side-by-side if tap targets become cramped.

---

## Interaction Contract

- Primary action = solid accent button.
- Secondary action = outline or neutral surface button.
- Destructive action = red text/border, never same visual weight as primary unless inside explicit confirmation.
- Focus states must be obvious and keyboard-friendly.
- Save actions should produce quiet inline success confirmation, not only console behavior.
- In setup flows, each page should make the next action unmistakable.

---

## Registry Safety

| Registry | Blocks Used | Safety Gate |
|----------|-------------|-------------|
| shadcn official | button and future form/card/dialog primitives | not required |
| third-party registry | none yet | shadcn view + diff required before use |

No unreviewed third-party component registry should enter the wizard flow without explicit review, because this product depends heavily on consistent operational UX.

---

## Checker Sign-Off

- [x] Dimension 1 Copywriting: PASS
- [x] Dimension 2 Visuals: PASS
- [x] Dimension 3 Color: PASS
- [x] Dimension 4 Typography: PASS
- [x] Dimension 5 Spacing: PASS
- [x] Dimension 6 Registry Safety: PASS

**Approval:** approved 2026-04-08

---

## Approved Visual References

The following Stitch-generated screens are approved as visual and structural references for implementation. They are not source code contracts and should not override product rules, permissions, routing, or real backend behavior.

### Client Surface References

- `Dashboard`: approved as reference for layout, metric hierarchy, recent dialogs/leads sections, and period selector.
- `Agents`: approved as partial reference for agent cards, status treatment, and channel/description layout. Copy and actions must remain client-safe.
- `Leads`: approved as reference for lead list structure, filters, source-agent visibility, and support for client-specific captured fields.
- `Dialogs`: approved as reference for split-pane list/detail layout, agent visibility, and channel filtering. Client-side takeover or reply controls are not approved for v1.
- `Connections`: approved as reference for two-column `Channels` + `Integrations` structure and guided setup presentation.

### Admin Surface References

- `Clients`: approved as reference for the primary admin home screen, search/filter layout, client readiness visibility, and table/list structure.
- `Client Detail`: approved as reference for the managed-client workspace layout, including client identity, channels, integrations, agents, recent activity, and channel-assignment prompts.

### Reference Use Rules

- Keep the approved visual direction, hierarchy, and layout patterns.
- Replace demo-only copy, fake metrics, AI-lab wording, and decorative platform concepts with real product copy.
- Buttons and controls in implementation must route to real app pages and actions that follow the Stafless product model.
- Client-side screens must not inherit operator-only actions from the reference designs.
- Admin-side screens must stay client-centric and should not drift into a generic platform-operations dashboard.
