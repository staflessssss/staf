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

The product has two distinct surfaces. The client-facing area lets a business connect channels and integrations and review conversations, leads, and activity. The operator-facing admin panel manages tenants, invites, agents, testing, deploy, and ongoing oversight. This separation is central to the product model.

The universal agent creation flow is a five-step wizard:
- Basics: name, persona, tone, language
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
- **Runtime architecture**: One shared runtime serving many DB-backed agents - do not introduce per-agent processes unless later evidence demands it.
- **Deploy target**: Vercel for app deployment, self-hosted n8n only for thin Gmail relay - design should respect these operational boundaries.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Keep Stafless operator-managed rather than end-client self-serve | The main value is fast, reliable service delivery by an operator across many businesses | - Pending |
| Represent agents as database records in one shared runtime | This simplifies scaling, deployment, and multi-tenant maintenance | - Pending |
| Use direct code integrations for tools instead of n8n runtime orchestration | The previous n8n-heavy model caused credential pain, JSON workflow complexity, and poor debugging | - Pending |
| Make the agent builder a universal five-step wizard with free-form knowledge and tools | Different businesses need different structures; rigid templates would constrain the product too early | - Pending |
| Separate client and admin surfaces | The client experience is onboarding/visibility, while the operator experience is configuration and operations | - Pending |

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
*Last updated: 2026-04-07 after initialization*
