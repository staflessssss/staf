# Phase 5: Agent Builder Wizard - Context

**Gathered:** 2026-04-08
**Status:** Ready for planning

<domain>
## Phase Boundary

Turn the Phase 4 agent-builder shell into a real admin-only wizard that lets an operator create, edit, review, and prepare an agent for a tenant. This phase owns builder data capture, channel assignment, free-form knowledge/tool editing, prompt preview fidelity, and pre-deploy test behavior. Actual live deploy plumbing and shared-runtime execution stay in Phase 6.

</domain>

<decisions>
## Implementation Decisions

### Wizard scope
- **D-01:** Phase 5 must implement the full five-step admin wizard: `Basics`, `Channel`, `Knowledge`, `Tools`, `Review`.
- **D-02:** Builder must support both create and edit flows from the same tenant-scoped admin surface.
- **D-03:** The wizard remains admin-only; no client routes or client-facing copy should expose builder internals.

### Agent basics
- **D-04:** The wizard should keep multilingual behavior as the default selling point. If a language setting exists, it should be an optional preferred response language, not a hard single-language restriction.
- **D-05:** Agent status for this phase should stay draft-oriented; Phase 5 prepares the agent and review flow, while Phase 6 owns live deploy transitions.

### Channel assignment
- **D-06:** Agent creation requires one tenant-connected channel in `CONNECTED` state.
- **D-07:** One connected channel may belong to only one agent at a time; enforce this in both write-time validation and storage constraints, not only in UI filtering.
- **D-08:** The wizard should show unavailable channels explicitly so the operator understands why a channel cannot be chosen.

### Knowledge and tools
- **D-09:** Knowledge blocks stay free-form editorial records, not templates or JSON blobs.
- **D-10:** Tool blocks stay free-form business actions whose executable steps bind only to integrations connected for the same tenant.
- **D-11:** Operators must be able to add, edit, remove, and reorder both knowledge blocks and tool blocks.
- **D-12:** Tool-step validation must reject cross-tenant integration references.

### Review and testing
- **D-13:** Prompt preview must reflect current wizard state, including ordered knowledge blocks and tool descriptions, not just persona/tone.
- **D-14:** Test mode in this phase is a safe pre-deploy sandbox for sample messages and generated responses; it should not require live channel deployment.
- **D-15:** Review must read like a launch/readiness checkpoint and clearly surface missing requirements before the operator can proceed.

### Safety and phase boundary
- **D-16:** Phase 5 may add the contracts needed for later deploy/runtime work, but must not expand scope into production webhook activation, live channel delivery, billing, voice, or self-serve client editing.

### the agent's Discretion
- Exact client-side state-management approach for the wizard.
- Exact component decomposition for block editors and reorder controls.
- Whether test mode uses a dedicated admin test endpoint or a draft-safe branch of the invoke path, as long as it stays pre-deploy and tenant-safe.

</decisions>

<specifics>
## Specific Ideas

- Reuse the Phase 4 editorial-card treatment for knowledge and tool blocks instead of falling back to table-like editing.
- Keep the review sidebar/checklist from the current shell, but back it with real readiness checks.
- Preserve the client-centric admin flow: operator starts from `Clients`, opens a tenant workspace, then creates or edits the tenant's agent from there.

</specifics>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Product contract
- `.planning/PROJECT.md` - operator-managed product model, client/admin surface boundary, multi-tenant and conversation-isolation rules.
- `.planning/REQUIREMENTS.md` - Phase 5 requirements `AGNT-01` through `AGNT-06`.
- `.planning/ROADMAP.md` - official Phase 5 goal and success criteria.
- `.planning/STATE.md` - current phase status and previously approved direction.

### UI and interaction contract
- `.planning/04-ui-foundation-agent-builder-ux/04-UI-SPEC.md` - approved wizard rhythm, copy, component patterns, and admin/client surface rules.

### Current implementation anchor points
- `prisma/schema.prisma` - current agent, feature, step, channel, integration, and conversation models.
- `src/components/stafless/agent-builder.tsx` - existing Phase 4 builder shell and current mock behaviors.
- `src/app/admin/clients/[clientId]/page.tsx` - tenant workspace and current channel-availability logic.
- `src/app/admin/tenants/[tenantId]/agents/new/page.tsx` - create flow entry point.
- `src/app/admin/tenants/[tenantId]/agents/[agentId]/edit/page.tsx` - edit flow entry point.
- `src/app/admin/tenants/[tenantId]/agents/[agentId]/page.tsx` - detail/review workspace entry point.
- `src/app/api/admin/tenants/[tenantId]/agents/route.ts` - current list/create stub.
- `src/app/api/admin/tenants/[tenantId]/agents/[agentId]/route.ts` - current detail/update stub.
- `src/lib/prompt-builder.ts` - current placeholder prompt preview logic.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/components/stafless/foundation.tsx`: shared page header, cards, badges, wizard stepper, and form primitives already aligned with Phase 4.
- `prisma/schema.prisma`: `Agent`, `Feature`, and `Step` already model knowledge and tool structure with sort ordering.
- Admin tenant pages already load real tenant/channel/integration/agent data through Prisma.

### Established Patterns
- Admin access is enforced with `requireAdminSession()`.
- Tenant-scoped resources are loaded from server components, and `/admin/clients/...` routes redirect into tenant-based routes.
- Connected-channel availability is already computed in admin read logic, but not yet protected in write APIs or DB constraints.

### Integration Points
- Wizard persistence will connect to admin agent API routes under `src/app/api/admin/tenants/[tenantId]/agents/...`.
- Prompt preview and test mode should build on `src/lib/prompt-builder.ts` and the draft-safe runtime/test path created in this phase.
- Later deploy/runtime work in Phase 6 will consume the persisted agent/feature/step output of this phase.

</code_context>

<deferred>
## Deferred Ideas

- Live deploy activation, webhook secrets, and channel-specific trigger metadata - Phase 6.
- Shared-runtime invocation, tool execution, and outbound channel delivery - Phase 6.
- Client-side agent editing or self-serve builder access - out of scope.
- Versioning, cloning, rollback, and reusable templates - v2 roadmap.

</deferred>

---

*Phase: 05-agent-builder-wizard*
*Context gathered: 2026-04-08*
