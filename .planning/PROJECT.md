# Stafless

## What This Is

Stafless is an operator-managed platform for building and running AI agents for small and medium-sized businesses. Business clients connect their communication channels and business integrations in a client cabinet, while an operator uses a separate admin panel to assemble, test, deploy, and monitor agents for each tenant. The product is not a self-serve bot builder for end clients; it is a multi-tenant operator tool that lets one operator manage many businesses and many agents from a single runtime.

## Core Value

An operator can quickly assemble and launch a reliable AI agent for a specific business without custom development, integration chaos, or exposing technical setup to the business client.

## Requirements

### Validated

(None yet - ship to validate)

### Active

- [ ] Client can log into their cabinet, connect supported channels, and connect supported business integrations without operator-side manual wiring.
- [ ] Operator can create, configure, test, deploy, pause, and update AI agents for any tenant from an admin panel.
- [ ] A shared runtime can load the correct agent config, conversation history, tools, and tenant credentials for each incoming message and respond through the correct channel.
- [ ] Conversations, tool activity, and leads stay isolated per tenant and per agent while remaining visible in dashboards for operators and clients.
- [ ] Credentials and sensitive connection data are stored securely with encryption and role-based access boundaries.

### Out of Scope

- Self-service bot building for business clients - the product is intentionally operator-managed.
- Voice agents and calling workflows - not required for the first release.
- Billing and subscription management - defer until the core operator workflow is proven.
- Generic visual flow-builder or drag-and-drop workflow editor - the first release uses a guided free-form wizard.
- n8n as the main agent runtime - n8n stays only as a thin Gmail trigger relay.
- Broad multi-channel expansion beyond Gmail, Instagram, and Telegram - keep initial channel scope tight.

## Context

The product evolved from an earlier n8n-centric architecture that became expensive in complexity, fragile to maintain, and difficult to scale across many tenants and agents. The new direction keeps n8n only where it is strong, specifically Gmail polling/relay, and moves the actual runtime, tool execution, logging, and deployment logic into application code.

The technical target stack is Next.js 15 with App Router and TypeScript, PostgreSQL with Prisma ORM, Auth.js v5 for invite-only authentication, Vercel AI SDK with OpenAI for tool-calling, and deployment on Vercel. Tenant credentials must be encrypted at rest. Runtime execution is shared: agents are database records, not separate processes.

The product has two distinct surfaces. The client-facing area is intentionally simple and business-facing: it lets a business review a dashboard, their agents, leads, dialogs, and connections without seeing technical agent-building concepts. The operator-facing admin panel is account-centric: the operator manages a list of clients, opens a specific client workspace, reviews that client's status, channels, integrations, agents, and activity, and creates or edits agents only from the admin side. This separation is central to the product model.

The universal agent creation flow is a five-step wizard:
- Basics: name, persona, tone, and optional preferred response language for a multilingual agent
- Channel: choose one of the tenant's connected channels
- Knowledge: add any number of free-form knowledge blocks
- Tools: add any number of free-form tools bound to real integrations/actions
- Review: preview prompt, test behavior, deploy

Knowledge blocks are intentionally free-form rather than template-driven. A wedding videography business may need many nuanced blocks, while a dental clinic or photo studio may need only a few. The same flexibility applies to tools.

Conversation isolation is critical. The same external contact may talk to different businesses, and those histories must never mix. The correct isolation model is one conversation per `(agentId, contactId)`.

## Constraints

- **Tech stack**: Next.js 15, TypeScript, Prisma, PostgreSQL, Auth.js v5, Vercel AI SDK, OpenAI - these choices are already directionally fixed and should anchor implementation.
- **Channels**: Start with Gmail, Instagram, and Telegram - v1 should not sprawl beyond these unless a later milestone explicitly expands scope.
- **Integration strategy**: Direct SDK/API integrations in code - avoid rebuilding runtime logic inside n8n.
- **Security**: Client credentials must be encrypted at rest and separated by tenant - this is a hard requirement, not a polish item.
- **Product model**: Operator-managed first - business clients should not see or control technical agent construction details.
- **Surface boundary**: Client UX must stay in plain business language and expose only `Dashboard`, `Agents`, `Leads`, `Dialogs`, and `Connections` - agent construction, technical settings, and internal setup logic belong only to the admin surface.
- **Runtime architecture**: One shared runtime serving many DB-backed agents - do not introduce per-agent processes unless later evidence demands it.
- **Deploy target**: Vercel for app deployment, self-hosted n8n only for thin Gmail relay - design should respect these operational boundaries.

## Canonical Product Contract v1

### Client Surface

- Client navigation is limited to `Dashboard`, `Agents`, `Leads`, `Dialogs`, and `Connections`.
- Client copy must stay business-facing and simple. Do not expose builder internals, technical setup concepts, or admin terminology.
- Clients can manage only connections in v1. They do not create or edit agents directly.
- `Dashboard` should emphasize business-facing metrics such as dialog volume, total messages, and period-based summaries, plus current agent status.
- `Agents` shows all client agents with status, assigned channel, and short purpose/description.
- `Dialogs` shows all dialogs and supports filtering by agent.
- `Leads` shows qualified business outcomes, not all dialogs.
- `Connections` presents channels and integrations in a guided, non-technical way.

### Admin Surface

- Admin navigation centers on `Clients`. That is the primary operator workspace.
- Admin flow is: open client list -> open one client -> inspect client status, agents, channels, integrations, and activity -> edit client data or create/update an agent.
- Client detail is the main admin page for account management.
- If a client has no agent, the dominant CTA is `Create agent`.
- Agent creation and editing are admin-only flows.
- Client-requested business changes are handled by editing existing client/agent fields, not by a separate formal change-request system in v1.

### Agent and Channel Rules

- A client may have multiple agents.
- One connected channel may be assigned to only one agent.
- Agent creation requires an available connected channel.
- If a channel is already assigned to an agent, it cannot be reused by another agent.
- Agent status exposed to clients should stay simple in v1: `Active` and `Paused`.
- Channel enable/disable behavior should live with the agent experience rather than inside client connection forms when practical.

### Lead and Dialog Model

- `Dialogs` represent all conversations for a client.
- `Leads` are created only when the agent completes one of the client-specific target actions.
- Target actions are defined per client. For the first client, the primary target action is creating a Google Calendar event.
- Lead schema must not be vertical-specific. Each lead has:
  - a base layer of common fields;
  - plus client-specific captured fields relevant to that business.
- Example client-specific fields may vary by business and must not be hardcoded around one industry.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Keep Stafless operator-managed rather than end-client self-serve | The main value is fast, reliable service delivery by an operator across many businesses | - Pending |
| Represent agents as database records in one shared runtime | This simplifies scaling, deployment, and multi-tenant maintenance | - Pending |
| Use direct code integrations for tools instead of n8n runtime orchestration | The previous n8n-heavy model caused credential pain, JSON workflow complexity, and poor debugging | - Pending |
| Make the agent builder a universal five-step wizard with free-form knowledge and tools | Different businesses need different structures; rigid templates would constrain the product too early | - Pending |
| Separate client and admin surfaces | The client experience is onboarding/visibility, while the operator experience is configuration and operations | - Pending |
| Keep the client surface strictly business-facing and non-technical | Clients need confidence and clarity, not builder complexity or system language | - Approved 2026-04-08 |
| Make the admin surface client-centric rather than tool-centric | The operator primarily works account-by-account: review client state, then create or update that client's agent | - Approved 2026-04-08 |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition**:
1. Requirements invalidated? -> Move to Out of Scope with reason
2. Requirements validated? -> Move to Validated with phase reference
3. New requirements emerged? -> Add to Active
4. Decisions to log? -> Add to Key Decisions
5. "What This Is" still accurate? -> Update if drifted

**After each milestone**:
1. Full review of all sections
2. Core Value check - still the right priority?
3. Audit Out of Scope - reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-04-08 after clarifying client/admin surface boundaries*
