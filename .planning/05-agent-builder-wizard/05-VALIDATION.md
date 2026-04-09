---
phase: 5
slug: agent-builder-wizard
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-08
---

# Phase 5 - Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Next.js lint/build plus targeted Vitest coverage added in Wave 1 |
| **Config file** | `vitest.config.ts` or `vitest.workspace.ts` (Wave 1 adds) |
| **Quick run command** | `npm run lint` |
| **Full suite command** | `npm run build` |
| **Estimated runtime** | ~20-60 seconds depending on build cache |

---

## Sampling Rate

- **After every task commit:** Run `npm run lint`
- **After every plan wave:** Run `npm run build`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 60 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 05-01-01 | 01 | 1 | AGNT-01, AGNT-02, AGNT-06 | T-05-01 | Agent write API rejects invalid or duplicate channel assignment and preserves multilingual-first basics data | route/unit | `npm run lint` | X W1 | pending |
| 05-01-02 | 01 | 1 | AGNT-03, AGNT-04 | T-05-02 | Builder write API rejects cross-tenant integration binding and preserves ordered features/steps | route/unit | `npm run lint` | X W1 | pending |
| 05-02-01 | 02 | 2 | AGNT-01, AGNT-02 | T-05-03 | Wizard form captures basics and channel state consistently across create/edit | component/manual | `npm run lint` | X W2 | pending |
| 05-02-02 | 02 | 2 | AGNT-03, AGNT-04 | T-05-04 | Knowledge and tool blocks can be added, edited, removed, and reordered without sample fallbacks | component/manual | `npm run lint` | X W2 | pending |
| 05-03-01 | 03 | 3 | AGNT-05 | T-05-05 | Prompt preview reflects the saved or in-memory wizard state accurately | unit | `npm run lint` | X W3 | pending |
| 05-03-02 | 03 | 3 | AGNT-05 | T-05-06 | Sandbox test mode stays pre-deploy and tenant-scoped | route/manual | `npm run build` | X W3 | pending |

*Status: pending · green · red · flaky*

---

## Wave 0 Requirements

- [ ] `vitest.config.ts` - targeted unit and route test runner for builder logic
- [ ] `package.json` test script(s) - stable local command for focused validation
- [ ] Test stubs covering channel assignment, prompt preview, and builder transforms

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Wizard step rhythm and readiness copy feel aligned with Phase 4 UI contract | AGNT-01 to AGNT-05 | UX fidelity and copy quality still need human judgment | Open the admin create/edit flow and verify step labels, CTAs, error copy, and review checklist stay consistent with `04-UI-SPEC.md`. |
| Sandbox test experience reads as pre-deploy and not live runtime | AGNT-05 | User trust and interaction framing are visual/product concerns | Trigger a test message in the review step and confirm the UI clearly communicates draft-safe testing rather than live deployment. |

---

## Validation Sign-Off

- [ ] All tasks have automated verify steps or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all missing references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
