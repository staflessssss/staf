# Requirements: Stafless

**Defined:** 2026-04-07
**Core Value:** An operator can quickly assemble and launch a reliable AI agent for a specific business without custom development, integration chaos, or exposing technical setup to the business client.

## v1 Requirements

### Identity & Access

- [ ] **AUTH-01**: Admin user can sign in to an operator dashboard with invite-only authentication.
- [ ] **AUTH-02**: Client user can accept an invite, sign in, and access only their own tenant data.
- [ ] **AUTH-03**: Route protection enforces separate admin and client areas based on role.

### Tenant Management

- [ ] **TENT-01**: Admin can create a tenant with name, slug, timezone, and lifecycle status.
- [ ] **TENT-02**: Admin can view a tenant detail page with connected channels, integrations, agents, and summary activity.
- [ ] **TENT-03**: Admin can issue a client invite linked to a tenant.

### Client Connections

- [ ] **CONN-01**: Client can connect Gmail for their tenant and see connection status.
- [ ] **CONN-02**: Client can connect Telegram for their tenant and see connection status.
- [ ] **CONN-03**: Client can connect Instagram for their tenant and see connection status when Meta access is available.
- [ ] **CONN-04**: Client can connect business integrations such as Google Sheets, Google Calendar, and Google Drive and see connection status.
- [ ] **CONN-05**: Connection credentials are stored encrypted and scoped to the tenant.

### Agent Builder

- [ ] **AGNT-01**: Admin can create an agent for a tenant and define name, persona, tone, and language.
- [ ] **AGNT-02**: Admin can bind an agent to one connected channel for that tenant.
- [ ] **AGNT-03**: Admin can add, edit, reorder, and remove free-form knowledge blocks for an agent.
- [ ] **AGNT-04**: Admin can add, edit, reorder, and remove free-form tools for an agent by binding integration-backed actions.
- [ ] **AGNT-05**: Admin can review the generated prompt and test an agent before deployment.

### Deploy & Runtime

- [ ] **RUN-01**: Admin can deploy an agent and the system stores deploy metadata such as webhook secrets and channel-specific trigger identifiers.
- [ ] **RUN-02**: Incoming Gmail, Instagram, and Telegram events can be normalized into a shared invoke flow.
- [ ] **RUN-03**: Runtime can load the correct agent config, knowledge, tools, channel settings, and conversation history for an incoming message.
- [ ] **RUN-04**: Runtime can let the model choose integration-backed tools and execute multi-step tool calls before generating the final reply.
- [ ] **RUN-05**: Runtime sends the final reply back through the correct channel adapter with channel-specific formatting.

### Conversations & Leads

- [ ] **CONV-01**: System stores a separate conversation per `(agentId, contactId)` so histories never mix across tenants or agents.
- [ ] **CONV-02**: System stores user, assistant, and tool messages with enough metadata to inspect runtime behavior later.
- [ ] **CONV-03**: Admin can view recent conversations for a tenant and inspect agent activity.
- [ ] **CONV-04**: Client can view conversations and lead-relevant activity for their own tenant.

### Security & Reliability

- [ ] **SECR-01**: Sensitive credentials are encrypted at rest with an application-managed encryption key.
- [ ] **SECR-02**: Webhook endpoints authenticate and reject invalid requests.
- [ ] **SECR-03**: Agent deploy and runtime failures are surfaced with actionable status in the dashboard.

## v2 Requirements

### Channel Expansion

- **CHAN-01**: Tenant can connect WhatsApp as an additional channel.
- **CHAN-02**: Platform supports broader multi-channel routing and per-channel agent specialization.

### Agent Operations

- **AOPS-01**: Operator can version, clone, and roll back agent configurations.
- **AOPS-02**: Platform provides reusable templates for common business types.
- **AOPS-03**: Platform provides richer automated follow-up flows and campaign-style automations.

### Analytics & Commercials

- **ANLT-01**: Dashboard includes deeper analytics on resolution rate, lead conversion, and tool usage trends.
- **ANLT-02**: Platform supports billing and subscription management.

## Out of Scope

| Feature | Reason |
|---------|--------|
| Voice agents and call handling | Not needed to validate the operator-managed messaging workflow |
| Self-serve bot building for business users | Contradicts the product model for v1 |
| Generic drag-and-drop flow editor | Adds complexity before the free-form wizard is proven |
| n8n as the main runtime/orchestration engine | The new architecture intentionally replaces this |
| Deep CRM ecosystem coverage in the first release | Focus initial delivery on a smaller integration set |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| AUTH-01 | Phase 1 | Pending |
| AUTH-02 | Phase 1 | Pending |
| AUTH-03 | Phase 1 | Pending |
| TENT-01 | Phase 2 | Pending |
| TENT-02 | Phase 2 | Pending |
| TENT-03 | Phase 2 | Pending |
| CONN-01 | Phase 3 | Pending |
| CONN-02 | Phase 3 | Pending |
| CONN-03 | Phase 3 | Pending |
| CONN-04 | Phase 3 | Pending |
| CONN-05 | Phase 3 | Pending |
| AGNT-01 | Phase 5 | Pending |
| AGNT-02 | Phase 5 | Pending |
| AGNT-03 | Phase 5 | Pending |
| AGNT-04 | Phase 5 | Pending |
| AGNT-05 | Phase 5 | Pending |
| RUN-01 | Phase 6 | Pending |
| RUN-02 | Phase 6 | Pending |
| RUN-03 | Phase 6 | Pending |
| RUN-04 | Phase 6 | Pending |
| RUN-05 | Phase 6 | Pending |
| CONV-01 | Phase 7 | Pending |
| CONV-02 | Phase 7 | Pending |
| CONV-03 | Phase 7 | Pending |
| CONV-04 | Phase 7 | Pending |
| SECR-01 | Phase 8 | Pending |
| SECR-02 | Phase 8 | Pending |
| SECR-03 | Phase 8 | Pending |

**Coverage:**
- v1 requirements: 28 total
- Mapped to phases: 28
- Unmapped: 0

---
*Requirements defined: 2026-04-07*
*Last updated: 2026-04-07 after roadmap shift for dedicated UI foundation phase*
