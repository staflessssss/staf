# Rasa-Style Runtime Migration Plan

This runtime is moving toward a Rasa-style shape without returning to the old
planner-heavy v3 behavior.

## Roles

- LLM/dialogue understanding: read the customer message and extract meaning.
- Dialogue commands: convert the message into structured commands.
- Flow runner: advance the wedding lead qualification flow.
- Slots: store durable facts about the lead and booking.
- Patterns: handle non-linear conversation moves such as FAQ interruptions,
  acknowledgements, corrections, reschedules, and knowledge gaps.
- Response key: describe the response needed for the current turn only.
- Responses/rephraser: produce human wording from a controlled response key.
- Guard: block unsafe, stale, missing, or robotic output.
- Delivery: apply channel-specific behavior such as Instagram pacing.

## Current Bridge

The existing runtime still uses `replyType`, `decisionTrace`, `replyContract`,
and deterministic writer templates. The first migration step keeps all current
behavior intact and adds compatibility fields:

- `SimpleWeddingSalesSlots`
- `SimpleWeddingSalesFlowState`
- extended `SimpleWeddingSalesPendingUserAction`
- `SimpleWeddingSalesDialogueCommand`
- `SimpleWeddingSalesResponseKey`
- `ReplyActionContract.responseKey`

`replyType` remains for compatibility. `responseKey` is a current-turn output
selection key and should not become long-lived state.

## Target Flow

```text
dialogueUnderstanding -> dialogueCommands -> flowRunner -> responseKey
  -> response variation/rephrase -> guard -> channel delivery
```

## Migration Order

1. Add Rasa-style types and `responseKey` without behavior changes.
2. Add `dialogueCommands` to dialogue understanding and safety logs.
3. Extract a `flow-runner.ts` wrapper around the existing decision logic.
4. Move response selection from `replyType` to `responseKey`.
5. Add `responses.ts` with deterministic response variations.
6. Add a guarded contextual rephraser.
7. Add reusable conversation `patterns.ts`.
8. Split tests into command, flow, contract, writer, delivery, and live fixtures.

## Invariants

- Business decisions stay in code, not in free-form generation.
- `responseKey` describes only the current reply.
- Durable state is represented as slots, flow state, and pending user action.
- FAQ interruptions answer the question and preserve the active flow.
- Knowledge gaps and risky states go to handoff.
- Delivery behavior is channel-specific.
