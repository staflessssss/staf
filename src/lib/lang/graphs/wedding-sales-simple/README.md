# Wedding Sales Simple Runtime

This runtime is intentionally simple. Its simplicity is measured by the number of decision
centers, not by lines of code.

## Architectural Invariants

- The LLM may extract facts and write final copy.
- The LLM must not decide `nextStep`, tool calls, booking eligibility, required fields, or handoff.
- All business decisions live in `decide.ts`.
- All business facts live in `knowledge.ts`.
- All output obligations live in `reply-contract.ts`.
- `reply-writer.ts` only renders the contract in the configured voice.
- Unsafe or stale output is blocked by `reply-guards.ts`.
- Transport and webhook behavior must not alter business decisions.

Do not add planner, analyzer, reflection, reasoner, strategy, semantic-vNext, or action-plan
layers to this runtime. If a bug appears, fix it in exactly one existing responsibility:

1. extraction / normalization
2. state / merge
3. decision
4. tool execution
5. reply contract
6. writer wording
7. guard
8. transport / webhook

The debugging loop is:

```text
bug -> identify responsibility -> add replay test -> fix locally -> do not add a layer
```
