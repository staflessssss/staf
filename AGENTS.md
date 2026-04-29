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

## Context and Token Discipline

- Do not reread broad planning files on every task. Use `.planning/PROJECT.md`, `.planning/REQUIREMENTS.md`, `.planning/ROADMAP.md`, and `.planning/STATE.md` only when scope, roadmap, or product boundaries are unclear.
- For workspace feature cadence, prefer the specific cadence/feature artifact plus the relevant code paths over loading global planning context.
- During development, run targeted tests and type checks first. Run the full `npm test` suite only before commit/deploy or when a change touches shared runtime behavior.
- Do not paste full successful `npm test`, `npm run build`, or deploy logs into the conversation. Summarize pass/fail counts and include only actionable errors.
- Use review agents once near final verification, then rerun only when they find important issues.

## Next Step

Start with Phase 1 from `.planning/ROADMAP.md`.
