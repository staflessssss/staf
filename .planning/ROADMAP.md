# Roadmap: Stafless

**Created:** 2026-04-07
**Granularity:** standard
**Coverage:** 28 of 28 v1 requirements mapped

## Summary

The roadmap is organized around the product's actual operating model: secure multi-tenant foundations first, then client connectivity, then operator agent assembly, then deploy/runtime, then conversation visibility, and finally hardening. This keeps the first usable vertical slice aligned with the business promise of "operator-managed agents for many clients."

## Phases

| # | Phase | Goal | Requirements | Success Criteria |
|---|-------|------|--------------|------------------|
| 1 | Identity & Access Foundation | Establish invite-only auth, roles, and route protection for admin and client surfaces | AUTH-01, AUTH-02, AUTH-03 | 3 |
| 2 | Tenant Administration Core | Let the operator create tenants, inspect them, and invite client users | TENT-01, TENT-02, TENT-03 | 3 |
| 3 | Client Connections & Credential Vault | Let clients connect channels/integrations with encrypted credential storage and visible status | CONN-01, CONN-02, CONN-03, CONN-04, CONN-05 | 4 |
| 4 | Agent Builder Wizard | Enable operators to assemble, review, and test agents from flexible knowledge blocks and tools | AGNT-01, AGNT-02, AGNT-03, AGNT-04, AGNT-05 | 4 |
| 5 | Deploy & Shared Runtime | Deploy agents and process incoming channel events through a shared tool-calling runtime | RUN-01, RUN-02, RUN-03, RUN-04, RUN-05 | 5 |
| 6 | Conversation Visibility & Client Reporting | Persist isolated conversations and expose useful views to admins and clients | CONV-01, CONV-02, CONV-03, CONV-04 | 4 |
| 7 | Security, Reliability & Operational Clarity | Harden webhooks, credential handling, and failure visibility for production readiness | SECR-01, SECR-02, SECR-03 | 4 |

## Phase Details

### Phase 1: Identity & Access Foundation

**Goal:** Establish the minimum secure access model for a two-surface product with admin and client roles.

**Requirements:** AUTH-01, AUTH-02, AUTH-03

**Success criteria:**
1. Admin can sign in and reach `/admin` while client users cannot.
2. Client can accept an invite and reach `/client` while admin-only pages stay protected.
3. The app enforces role-aware redirects and route guards consistently across protected surfaces.

### Phase 2: Tenant Administration Core

**Goal:** Give the operator enough tenant management to onboard businesses into the platform.

**Requirements:** TENT-01, TENT-02, TENT-03

**Success criteria:**
1. Operator can create a tenant with the core tenant metadata needed to continue setup.
2. Operator can open a tenant detail page and see its current connections, agents, and status.
3. Operator can generate and manage a tenant-bound invite for a client user.

### Phase 3: Client Connections & Credential Vault

**Goal:** Let business clients complete their side of setup by connecting channels and integrations safely.

**Requirements:** CONN-01, CONN-02, CONN-03, CONN-04, CONN-05

**Success criteria:**
1. Client can connect at least the initial supported channels and see meaningful connection state.
2. Client can connect the initial supported business integrations and the app stores usable metadata for later tool binding.
3. Credentials are encrypted before persistence and are not exposed in plain text in the UI or logs.
4. Operators can see that required connections exist before building an agent for a tenant.

### Phase 4: Agent Builder Wizard

**Goal:** Enable the operator to define an agent in a universal, business-agnostic builder flow.

**Requirements:** AGNT-01, AGNT-02, AGNT-03, AGNT-04, AGNT-05

**Success criteria:**
1. Operator can complete the five-step wizard from basics to review for any tenant with valid connections.
2. Knowledge blocks and tools are truly free-form and can be added or removed without relying on hardcoded templates.
3. Prompt preview reflects the current wizard configuration accurately enough for operator review.
4. Test mode lets the operator send a sample message and inspect the agent response before deploy.

### Phase 5: Deploy & Shared Runtime

**Goal:** Turn an agent config into a live, shared-runtime agent that can answer and use tools in the right channel.

**Requirements:** RUN-01, RUN-02, RUN-03, RUN-04, RUN-05

**Success criteria:**
1. Deploy moves an agent from draft toward active status and records deployment metadata required by the channel.
2. Incoming Gmail, Instagram, and Telegram events normalize into one invocation path.
3. Runtime loads the correct tenant-scoped agent config, tool definitions, and conversation history before invoking the model.
4. Model can call real tools backed by integrations and continue multi-step reasoning to a final answer.
5. Final replies are delivered back through the correct adapter with channel-specific formatting rules.

### Phase 6: Conversation Visibility & Client Reporting

**Goal:** Make runtime behavior inspectable and useful to both the operator and the client.

**Requirements:** CONV-01, CONV-02, CONV-03, CONV-04

**Success criteria:**
1. Conversations remain isolated by `(agentId, contactId)` even when the same external contact talks to multiple businesses.
2. Message history records user, assistant, and tool steps with enough metadata to debug behavior.
3. Operator can inspect recent conversations and agent activity from the admin surface.
4. Client can view their own conversations and lead-relevant activity without seeing platform internals from other tenants.

### Phase 7: Security, Reliability & Operational Clarity

**Goal:** Close the most important production-readiness gaps around safety and visibility.

**Requirements:** SECR-01, SECR-02, SECR-03

**Success criteria:**
1. Credential encryption and decryption paths are validated and handled through application-level safeguards.
2. Webhook endpoints reject unauthenticated or invalid traffic and expose only the minimal safe surface.
3. Agent deploy/runtime failures are surfaced in statuses or logs that let an operator act quickly.
4. The platform is ready for the next milestone without depending on n8n for core runtime debugging.

## Notes

- Phase 4 depends on Phase 3 because agent creation must select from tenant-connected channels and integrations.
- Phase 5 depends on Phase 4 because deploy/runtime must consume the persisted builder output.
- Phase 6 should begin only after Phase 5 produces real conversation data worth inspecting.
- Phase 7 runs last in this milestone, but security checks should still influence implementation earlier when convenient.

---
*Last updated: 2026-04-07 after roadmap creation*
