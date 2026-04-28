import test from "node:test";
import assert from "node:assert/strict";

import {
  changePrimaryDestinationType,
  classifyDestination,
  createPrimaryDestination,
  getDestinationSelectorOptions,
  getLinkedPrimaryStep,
  getOrderedResultTargets,
  getPrimaryStoredTarget,
  loadViewModel,
  pickPrimary,
  removePrimaryDestination,
  saveViewModel,
  updatePrimaryDestinationStep,
} from "@/lib/functions/destination-mapping";

function createFunctionFixture(
  overrides: Partial<{
    resultTargets: Array<{
      type: string;
      label: string;
      isPrimary?: boolean;
      primaryStepId?: string;
    }>;
    steps: Array<{ id?: string; integrationId: string; action: string; params: string }>;
  }> = {},
) {
  return {
    name: "Check delivery",
    description: "Function fixture",
    active: true,
    parameters: [],
    reactionAction: "ai_agent_decides" as const,
    postAction: "continue_dialog" as const,
    disableDelayedMessages: false,
    resultTargets: overrides.resultTargets ?? [],
    steps: overrides.steps ?? [],
  };
}

const stepStrategy = {
  createStep: (type: "google_sheets" | "google_calendar" | "api_request") => ({
    id: crypto.randomUUID(),
    integrationId: `${type}-integration`,
    action: `${type}-action`,
    params: "{}",
  }),
  getStepId: (
    step: { id?: string; integrationId: string; action: string; params: string },
  ) => step.id ?? null,
  findLegacyStepIndex: (
    steps: Array<{ integrationId: string; action: string; params: string }>,
    destinationType: "google_sheets" | "google_calendar" | "api_request",
  ) => {
    const matches = steps
      .map((step, index) => ({ step, index }))
      .filter(({ step }) => step.integrationId.startsWith(destinationType));

    return matches.length === 1 ? matches[0]!.index : -1;
  },
};

test("pickPrimary prefers first-class targets over Tier C even with corrupted isPrimary", () => {
  const result = pickPrimary([
    { type: "python_hook", label: "Python", isPrimary: true },
    { type: "google_sheets", label: "Google Sheets" },
  ]);

  assert.equal(result.primary?.type, "google_sheets");
  assert.equal(result.primaryIndex, 1);
  assert.equal(result.secondaryBag[0]?.type, "python_hook");
});

test("getDestinationSelectorOptions never exposes Tier C entries", () => {
  const options = getDestinationSelectorOptions({
    isNewFunction: false,
    currentTargets: [
      { type: "telegram_report", label: "Telegram" },
      { type: "python_hook", label: "Python" },
      { type: "unknown_future_target", label: "Unknown" },
    ],
  });

  assert.deepEqual(
    options.map((option) => option.value),
    ["google_sheets", "google_calendar", "api_request", "telegram_report"],
  );
});

test("save(load(fn)) preserves legacy targets and steps for mixed fixture", () => {
  const fixture = createFunctionFixture({
    resultTargets: [
      { type: "google_sheets", label: "Sheets report" },
      { type: "telegram_report", label: "Telegram summary" },
      { type: "python_hook", label: "Python post-process" },
    ],
    steps: [{ integrationId: "step-1", action: "append row", params: "{}" }],
  });

  const roundTrip = saveViewModel(loadViewModel(fixture));

  assert.deepEqual(roundTrip.resultTargets, fixture.resultTargets);
  assert.equal(roundTrip.steps.length, fixture.steps.length);
  assert.equal(roundTrip.steps[0]?.integrationId, fixture.steps[0]?.integrationId);
  assert.equal(roundTrip.steps[0]?.action, fixture.steps[0]?.action);
  assert.equal(roundTrip.steps[0]?.params, fixture.steps[0]?.params);
  assert.equal(typeof roundTrip.steps[0]?.id, "string");
});

test("save(load(fn)) keeps primary null when function only has Tier C targets", () => {
  const fixture = createFunctionFixture({
    resultTargets: [{ type: "python_hook", label: "Python only" }],
  });

  const viewModel = loadViewModel(fixture);
  const saved = saveViewModel(viewModel);

  assert.equal(viewModel.resultDelivery.primary, null);
  assert.deepEqual(saved.resultTargets, fixture.resultTargets);
});

test("classifyDestination treats unknown types as Tier C", () => {
  assert.equal(classifyDestination("google_sheets"), "A");
  assert.equal(classifyDestination("telegram_report"), "B");
  assert.equal(classifyDestination("python_hook"), "C");
  assert.equal(classifyDestination("future_delivery"), "C");
});

test("getPrimaryStoredTarget returns the contract-selected primary target", () => {
  const primary = getPrimaryStoredTarget([
    { type: "python_hook", label: "Python", isPrimary: true },
    { type: "google_sheets", label: "Google Sheets" },
    { type: "telegram_report", label: "Telegram" },
  ]);

  assert.equal(primary?.type, "google_sheets");
  assert.equal(primary?.label, "Google Sheets");
});

test("getOrderedResultTargets returns primary first and preserves secondary order", () => {
  const ordered = getOrderedResultTargets([
    { type: "python_hook", label: "Python", isPrimary: true },
    { type: "google_sheets", label: "Google Sheets" },
    { type: "telegram_report", label: "Telegram" },
  ]);

  assert.deepEqual(
    ordered.map((target) => target.type),
    ["google_sheets", "python_hook", "telegram_report"],
  );
});

test("createPrimaryDestination creates a first-class primary and one linked step", () => {
  const fixture = createFunctionFixture();

  const updated = createPrimaryDestination(
    loadViewModel(fixture),
    "google_sheets",
    stepStrategy,
  );
  const saved = saveViewModel(updated);

  assert.equal(updated.resultDelivery.primary?.kind, "google_sheets");
  assert.ok(updated.resultDelivery.primary?.primaryStepId);
  assert.equal(saved.resultTargets.length, 1);
  assert.equal(saved.resultTargets[0]?.type, "google_sheets");
  assert.equal(saved.resultTargets[0]?.primaryStepId, updated.resultDelivery.primary?.primaryStepId);
  assert.equal(saved.steps.length, 1);
  assert.equal(saved.steps[0]?.integrationId, "google_sheets-integration");
  assert.equal(saved.steps[0]?.id, updated.resultDelivery.primary?.primaryStepId);
});

test("createPrimaryDestination does not create steps for Tier B compatibility targets", () => {
  const fixture = createFunctionFixture();

  const updated = createPrimaryDestination(
    loadViewModel(fixture),
    "telegram_report",
    stepStrategy,
  );
  const saved = saveViewModel(updated);

  assert.equal(updated.resultDelivery.primary?.kind, "telegram_report");
  assert.equal(saved.steps.length, 0);
});

test("changePrimaryDestinationType replaces first-class step when changing destination kind", () => {
  const fixture = createFunctionFixture();
  const withSheets = createPrimaryDestination(
    loadViewModel(fixture),
    "google_sheets",
    stepStrategy,
  );
  const changed = changePrimaryDestinationType(withSheets, "api_request", stepStrategy);
  const saved = saveViewModel(changed);

  assert.equal(changed.resultDelivery.primary?.kind, "api_request");
  assert.equal(saved.steps.length, 1);
  assert.equal(saved.steps[0]?.integrationId, "api_request-integration");
});

test("updatePrimaryDestinationStep patches only the linked primary step", () => {
  const fixture = createFunctionFixture({
    steps: [{ integrationId: "extra-step", action: "keep me", params: "{}" }],
  });
  const withSheets = createPrimaryDestination(
    loadViewModel(fixture),
    "google_sheets",
    stepStrategy,
  );
  const updated = updatePrimaryDestinationStep(
    withSheets,
    (step) => ({
      ...step,
      params: '{"mode":"lookup"}',
    }),
    stepStrategy,
  );
  const saved = saveViewModel(updated);

  assert.equal(saved.steps.length, 2);
  assert.equal(saved.steps[0]?.integrationId, "extra-step");
  assert.equal(saved.steps[1]?.params, '{"mode":"lookup"}');
});

test("removePrimaryDestination keeps advanced steps intact", () => {
  const withSheets = createPrimaryDestination(
    loadViewModel(createFunctionFixture()),
    "google_sheets",
    stepStrategy,
  );
  const removed = removePrimaryDestination(withSheets);
  const saved = saveViewModel(removed);

  assert.equal(removed.resultDelivery.primary, null);
  assert.equal(saved.resultTargets.length, 0);
  assert.equal(saved.steps.length, 1);
});

test("getDestinationSelectorOptions exposes Tier B only when present", () => {
  const withoutLegacyCompat = getDestinationSelectorOptions({
    isNewFunction: true,
    currentTargets: [],
  });
  const withLegacyCompat = getDestinationSelectorOptions({
    isNewFunction: false,
    currentTargets: [{ type: "telegram_report", label: "Telegram" }],
  });

  assert.deepEqual(
    withoutLegacyCompat.map((option) => option.value),
    ["google_sheets", "google_calendar", "api_request"],
  );
  assert.deepEqual(
    withLegacyCompat.map((option) => option.value),
    ["google_sheets", "google_calendar", "api_request", "telegram_report"],
  );
});

test("loadViewModel preserves linked primary step across reorder by stable id", () => {
  const linkedStepId = crypto.randomUUID();
  const fixture = createFunctionFixture({
    resultTargets: [{ type: "google_sheets", label: "Sheets", primaryStepId: linkedStepId }],
    steps: [
      { id: crypto.randomUUID(), integrationId: "google_sheets-other", action: "first", params: "{}" },
      { id: linkedStepId, integrationId: "google_sheets-linked", action: "second", params: "{}" },
    ],
  });

  const loaded = loadViewModel(fixture, stepStrategy);
  const reordered = {
    ...loaded,
    advanced: {
      ...loaded.advanced,
      steps: [loaded.advanced.steps[1]!, loaded.advanced.steps[0]!],
    },
  };
  const reloaded = loadViewModel(saveViewModel(reordered), stepStrategy);
  const linked = getLinkedPrimaryStep(reloaded);

  assert.equal(linked?.step.id, linkedStepId);
  assert.equal(linked?.step.action, "second");
});

test("loadViewModel leaves primary without linked step after linked step is deleted", () => {
  const linkedStepId = crypto.randomUUID();
  const fixture = createFunctionFixture({
    resultTargets: [{ type: "google_sheets", label: "Sheets", primaryStepId: linkedStepId }],
    steps: [{ id: linkedStepId, integrationId: "google_sheets-linked", action: "linked", params: "{}" }],
  });

  const loaded = loadViewModel(fixture, stepStrategy);
  const withoutLinkedStep = {
    ...loaded,
    advanced: {
      ...loaded.advanced,
      steps: [],
    },
  };
  const reloaded = loadViewModel(saveViewModel(withoutLinkedStep), stepStrategy);

  assert.equal(getLinkedPrimaryStep(reloaded), null);
  assert.equal(reloaded.resultDelivery.primary?.primaryStepId ?? null, null);
});

test("loadViewModel keeps primary linked to the correct duplicate-type step by id", () => {
  const firstStepId = crypto.randomUUID();
  const secondStepId = crypto.randomUUID();
  const fixture = createFunctionFixture({
    resultTargets: [{ type: "google_sheets", label: "Sheets", primaryStepId: secondStepId }],
    steps: [
      { id: firstStepId, integrationId: "google_sheets-a", action: "first", params: "{}" },
      { id: secondStepId, integrationId: "google_sheets-b", action: "second", params: "{}" },
    ],
  });

  const loaded = loadViewModel(fixture, stepStrategy);
  const linked = getLinkedPrimaryStep(loaded);

  assert.equal(linked?.step.id, secondStepId);
  assert.equal(linked?.step.action, "second");
});

test("legacy fallback stays null when multiple steps match the same destination type", () => {
  const fixture = createFunctionFixture({
    resultTargets: [{ type: "google_sheets", label: "Sheets" }],
    steps: [
      { integrationId: "google_sheets-a", action: "first", params: "{}" },
      { integrationId: "google_sheets-b", action: "second", params: "{}" },
    ],
  });

  const loaded = loadViewModel(fixture, stepStrategy);

  assert.equal(loaded.resultDelivery.primary?.primaryStepId ?? null, null);
  assert.equal(getLinkedPrimaryStep(loaded), null);
});
