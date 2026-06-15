import type { WeddingSalesField } from "../semantic-v2/schema";
import type { WeddingSalesState } from "../state";

export function wasSemanticFieldCommittedThisTurn(
  state: Pick<WeddingSalesState, "lastStateMutationTrace">,
  field: WeddingSalesField,
) {
  return Boolean(
    state.lastStateMutationTrace?.some(
      (entry) =>
        entry.field === field &&
        (entry.action === "accepted" || entry.action === "resolved"),
    ),
  );
}
