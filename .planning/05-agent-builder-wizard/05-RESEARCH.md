# Phase 5 - Agent Builder Wizard Research

**Date:** 2026-04-08
**Status:** Complete

## Research Goal

Answer: what needs to be true to plan Phase 5 well, given the current Stafless codebase and the approved Phase 4 UI contract?

## Current Codebase Findings

### What already exists

- Prisma already models tenant-scoped `Agent`, `Feature`, and `Step` records, with `FeatureType` split between `KNOWLEDGE` and `TOOL`, plus ordered `sortOrder` fields.
- Admin create, edit, and detail pages already load real tenant, connection, and agent data.
- The Phase 4 builder shell already establishes the five-step layout, the review sidebar, and the sandbox visual treatment.
- Admin tenant detail already surfaces a `Create Agent` entry point and filters out channels already assigned in the UI.

### What is still stubbed or mock-only

- Admin agent API routes for list/create/update are placeholders and return empty data or `501`.
- Prompt preview is only `persona` plus `tone`, ignoring actual knowledge and tool content.
- The wizard fields are uncontrolled `defaultValue` inputs with no submit flow, no validation, and no step state.
- Knowledge blocks and tools fall back to sample content when no persisted features exist.
- Sandbox/test output is hardcoded and not backed by runtime logic.

### Gaps that matter for Phase 5

- The planning requirement around language should be implemented as multilingual-first behavior with an optional preference, not as a hard one-language-only agent setting.
- Channel uniqueness is enforced only in admin read logic, not in write-time validation or the database schema.
- Tool step references do not yet validate tenant ownership of the underlying integration.
- Deploy/runtime files exist, but are intentionally Phase 6 territory and should not absorb Phase 5 scope.

## Recommended Architecture

### 1. Treat Phase 5 as a draft-builder phase, not a deploy phase

The right seam is:
- Phase 5 owns draft persistence, editability, prompt assembly, and sandbox testing.
- Phase 6 owns turning a reviewed draft into a live deployed agent.

That keeps this phase focused and prevents the wizard from dragging in incomplete channel/runtime work.

### 2. Make the wizard output map directly onto the Prisma model

Recommended persisted shape:
- `Agent`: `name`, `persona`, `tone`, optional `languagePreference`, `channelId`, `status`
- `Feature(type=KNOWLEDGE)`: free-form knowledge block records with `name`, `description`, `knowledgeContent`, `sortOrder`
- `Feature(type=TOOL)`: free-form tool records with `name`, `description`, `sortOrder`
- `Step`: ordered integration-backed actions for each tool feature

This keeps the UI, persistence, and prompt builder aligned on one canonical shape.

### 3. Enforce channel assignment in multiple layers

Recommended enforcement stack:
- UI: show only connected channels; mark already assigned channels as unavailable
- API: reject create/update when channel is disconnected, belongs to another tenant, or is already assigned to a different agent
- DB: add a uniqueness constraint on `Agent.channelId` so concurrent writes cannot violate the rule

### 4. Validate tenant safety for tool bindings

Every tool step should validate:
- the parent agent belongs to the current tenant
- the referenced integration belongs to the same tenant
- the referenced integration is in `CONNECTED` state

This is an important multi-tenant safety rule, not just a convenience check.

### 5. Keep prompt preview deterministic and editable

The prompt builder should produce a structured preview from wizard state, with sections for:
- agent identity and tone
- channel context
- ordered knowledge blocks
- ordered tool capabilities and constraints

The preview does not need to solve full runtime orchestration yet. It only needs to be faithful enough for operator review and pre-deploy testing.

### 6. Add a draft-safe test endpoint

Phase 5 should provide a test flow that:
- accepts the current draft or persisted draft state
- builds the prompt from that state
- runs a safe, non-channel sandbox invocation
- returns the response plus enough metadata for operator review

This can be a dedicated admin test route or a draft branch in the invoke path. The important thing is that it remains tenant-scoped, pre-deploy, and clearly separate from production channel traffic.

## Delivery Strategy

### Wave 1

Build the backend contract first:
- schema gap (`languagePreference` if we persist one)
- agent create/update/list/detail contracts
- channel uniqueness and tenant-safe integration validation
- request validation and write transactions

### Wave 2

Build the real wizard UX:
- controlled state
- back/next flow
- block CRUD and reorder
- create/edit submission
- empty-state and validation behavior

### Wave 3

Finish review/test fidelity:
- prompt preview based on real builder state
- readiness checklist backed by actual validations
- sandbox test flow for sample prompts

## Validation Architecture

Recommended verification stack for this phase:

- Fast checks: `npm run lint`
- Full app safety check: `npm run build`
- Add targeted automated coverage for:
  - agent create/update validation
  - channel uniqueness rule
  - prompt preview assembly
  - builder block ordering transforms

Since the repo does not yet expose a test harness, Phase 5 should include a small Wave 0 setup for targeted unit/route tests rather than relying only on manual browser checks.

## Risks and Mitigations

### Risk: Phase 5 leaks into Phase 6
- Mitigation: keep deploy activation and live runtime wiring out of scope; use sandbox test semantics only.

### Risk: duplicate channel assignment under concurrent writes
- Mitigation: combine API validation with a database uniqueness constraint on `channelId`.

### Risk: cross-tenant tool binding
- Mitigation: validate integration ownership inside create/update transactions.

### Risk: prompt preview drifts from saved agent state
- Mitigation: use one builder-state serializer shared by save, preview, and test.

### Risk: current UI shell hides missing requirements
- Mitigation: make review/readiness checks explicit and block progression when essentials are missing.

## Planning Implications

Plans for this phase should cover all of the following:

1. Schema and API work for real wizard persistence.
2. UI conversion from mock shell to controlled create/edit wizard.
3. Prompt preview and sandbox testing backed by the actual builder state.
4. Verification coverage for AGNT-01 through AGNT-06, with special attention to multilingual behavior, free-form blocks, and channel uniqueness.

---

*Phase: 05-agent-builder-wizard*
*Research completed: 2026-04-08*
