# AGENTS.md

This repository uses a GSD-style planning flow.

## Project

- Product: `Stafless`
- Model: operator-managed AI-agent platform for SMB
- Core value: an operator can quickly assemble and launch a reliable AI agent for a specific business without custom development, integration chaos, or exposing technical setup to the business client

## Planning Artifacts

Read these before substantial work:

1. `.planning/PROJECT.md`
2. `.planning/REQUIREMENTS.md`
3. `.planning/ROADMAP.md`
4. `.planning/STATE.md`

## Working Rules

- Treat the platform as multi-tenant from the start.
- Keep the separation between admin and client surfaces explicit.
- Prefer direct code integrations over rebuilding orchestration in n8n.
- Preserve conversation isolation by `(agentId, contactId)`.
- Do not expand scope into billing, voice, or self-serve bot building unless roadmap updates explicitly add it.

## Next Step

Start with Phase 1 from `.planning/ROADMAP.md`.
