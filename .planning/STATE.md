# State: Stafless

**Initialized:** 2026-04-07
**Current status:** Phase 1 completed, Phase 2 completed at baseline, Phase 3 completed at baseline, Phase 4 UI contract created and partially implemented, Phase 5 completed, Phase 6 active with live runtime/client flows, Phase 6.1 next

## Project Reference

See: `.planning/PROJECT.md` (updated 2026-04-07)

**Core value:** An operator can quickly assemble and launch a reliable AI agent for a specific business without custom development, integration chaos, or exposing technical setup to the business client.
**Current focus:** Phase 6.1 - Runtime Boundary & Playbook Versioning

## Current Milestone

Initial project bootstrap and architecture setup for the first usable Stafless version.

## Next Recommended Action

Add `playbookVersion` and a safe legacy/v2 runtime split so the first gold-reference client can stay stable while deterministic playbook execution is introduced.

## Notes

- Project initialized from Russian-language discovery with a detailed architecture brief.
- Product model is explicitly operator-managed, not self-serve for end business users.
- n8n remains only as a thin Gmail relay in the target architecture.
- Next.js scaffold is live and builds successfully.
- Prisma schema is pushed to Supabase and Prisma Client is generated.
- Admin seed has been executed successfully.
- Invite-only auth foundation is implemented with login, invite acceptance, and role-aware route protection.
- Admin dashboard, tenant list, tenant creation, tenant detail, and invite generation are implemented at a baseline level.
- Client portal now includes overview, connection management, and conversation list foundations.
- Channel and integration connections can now be stored for a client tenant with encrypted credentials.
- Roadmap now includes a dedicated UI Foundation & Agent Builder UX phase before deeper agent-builder implementation.
- UI design contract created at `.planning/04-ui-foundation-agent-builder-ux/04-UI-SPEC.md`.
- Product rule clarified: client surface must remain strictly business-facing with only `Dashboard`, `Agents`, `Leads`, `Dialogs`, and `Connections`.
- Product rule clarified: admin surface is client-centric; operator starts from client list, then drills into one client to review status and manage agents.
- Approved Stitch screen set is now the visual reference pack for client dashboard/agents/leads/dialogs/connections and admin clients/client-detail layouts. Implementation must preserve product rules while wiring real routes and actions.
- Current implementation status: routing and IA were updated in code, but the visual layer still needs a dedicated rewrite to match the approved reference pack.
- Phase 5 planning pack created at `.planning/05-agent-builder-wizard/` with context, research, validation, and three execution plans.
- Phase 5 completed: admin can create/edit agent drafts, manage knowledge and tools, preview prompts, run sandbox tests, and check readiness for the next phase.
- Phase 5 shipped multilingual-first behavior with an optional preferred response language instead of a single-language restriction.
- `npm run prisma:generate`, `npm test`, `npm run lint`, and `npm run build` passed after the Phase 5 implementation.
- Phase 6 progressed from builder-only deploy checks to real shared-runtime execution with tenant-scoped conversations, Telegram webhook replies, Google OAuth connections, and live Google Sheets / Google Calendar tool paths.
- The first gold-reference client flow now exists as a real operator-built agent, but runtime behavior still mixes prompt-heavy orchestration with deterministic tool execution.
- New architectural decision: before expanding templates or new integration families, the project should introduce `playbookVersion` and a safe v1/v2 runtime boundary so deterministic playbook execution can evolve without breaking the first live client.
- Phase 6.1 is now the immediate focus: keep the current client stable, add a structured LLM decision boundary, and move selected tool-block execution into a deterministic runner.

---
*Last updated: 2026-04-11 after reframing the next step as Phase 6.1 runtime boundary and playbook versioning*
