import { FunctionBlockConfig } from "@/lib/agent-config";

const tierAValues = ["google_sheets", "google_calendar", "api_request"] as const;
const tierBValues = ["telegram_report", "file_delivery"] as const;

export type TierAType = (typeof tierAValues)[number];
export type TierBType = (typeof tierBValues)[number];
export type PrimaryDestinationType = TierAType | TierBType;
export type DestinationTier = "A" | "B" | "C";

export type LegacyFunctionTargetLike = {
  type: string;
  label: string;
  isPrimary?: boolean | null;
  primaryStepId?: string | null;
};

export type LegacyFunctionStepLike = FunctionBlockConfig["steps"][number] & {
  id?: string | null;
};

export type StoredFunctionLike<
  TTarget extends LegacyFunctionTargetLike = FunctionBlockConfig["resultTargets"][number],
  TStep = LegacyFunctionStepLike,
  TParameter = FunctionBlockConfig["parameters"][number],
> = Omit<FunctionBlockConfig, "parameters" | "resultTargets" | "steps"> & {
  parameters: TParameter[];
  resultTargets: TTarget[];
  steps: TStep[];
};

export type DestinationOption = {
  value: PrimaryDestinationType;
  label: string;
  tier: "A" | "B";
  compatibility: boolean;
};

type PrimaryDestinationBase<TTarget extends LegacyFunctionTargetLike> = {
  label: string;
  sourceIndex: number;
  target: TTarget;
  primaryStepId?: string | null;
};

export type PrimaryDestinationView<TTarget extends LegacyFunctionTargetLike> =
  | (PrimaryDestinationBase<TTarget> & {
      kind: "google_sheets";
      tier: "A";
      mode: "first_class";
    })
  | (PrimaryDestinationBase<TTarget> & {
      kind: "google_calendar";
      tier: "A";
      mode: "first_class";
    })
  | (PrimaryDestinationBase<TTarget> & {
      kind: "api_request";
      tier: "A";
      mode: "first_class";
    })
  | (PrimaryDestinationBase<TTarget> & {
      kind: "telegram_report";
      tier: "B";
      mode: "compatibility";
    })
  | (PrimaryDestinationBase<TTarget> & {
      kind: "file_delivery";
      tier: "B";
      mode: "compatibility";
    });

export type FunctionViewModel<
  TTarget extends LegacyFunctionTargetLike = FunctionBlockConfig["resultTargets"][number],
  TStep = LegacyFunctionStepLike,
  TParameter = FunctionBlockConfig["parameters"][number],
> = {
  details: Pick<FunctionBlockConfig, "name" | "description" | "active">;
  parameters: TParameter[];
  reactionAction: FunctionBlockConfig["reactionAction"];
  postAction: FunctionBlockConfig["postAction"];
  disableDelayedMessages: boolean;
  resultDelivery: {
    primary: PrimaryDestinationView<TTarget> | null;
  };
  advanced: {
    secondaryTargets: TTarget[];
    legacyCompatTargets: TTarget[];
    advancedOnlyTargets: TTarget[];
    steps: TStep[];
  };
};

export type PrimaryStepStrategy<TStep> = {
  createStep: (type: TierAType) => TStep;
  getStepId: (step: TStep) => string | null;
  findLegacyStepIndex: (steps: TStep[], destinationType: TierAType) => number;
};

export function classifyDestination(type: string): DestinationTier {
  if (tierAValues.includes(type as TierAType)) {
    return "A";
  }

  if (tierBValues.includes(type as TierBType)) {
    return "B";
  }

  return "C";
}

export function getResultTargetLabel(type: PrimaryDestinationType) {
  switch (type) {
    case "google_sheets":
      return "Google Sheets";
    case "google_calendar":
      return "Google Calendar";
    case "api_request":
      return "Custom API";
    case "telegram_report":
      return "Telegram report";
    case "file_delivery":
      return "File delivery";
  }
}

function cloneTargetWithPrimaryFlag<TTarget extends LegacyFunctionTargetLike>(
  target: TTarget,
  isPrimary: boolean,
) {
  const clone = { ...target } as TTarget & Record<string, unknown>;

  if (Object.prototype.hasOwnProperty.call(target, "isPrimary")) {
    clone.isPrimary = isPrimary;
  }

  return clone as TTarget;
}

function toPrimaryDestinationView<TTarget extends LegacyFunctionTargetLike>(
  target: TTarget,
  sourceIndex: number,
): PrimaryDestinationView<TTarget> | null {
  const normalizedTarget = cloneTargetWithPrimaryFlag(target, true);

  switch (target.type) {
    case "google_sheets":
      return {
        kind: "google_sheets",
        tier: "A",
        mode: "first_class",
        label: target.label,
        sourceIndex,
        target: normalizedTarget,
        primaryStepId: target.primaryStepId ?? null,
      };
    case "google_calendar":
      return {
        kind: "google_calendar",
        tier: "A",
        mode: "first_class",
        label: target.label,
        sourceIndex,
        target: normalizedTarget,
        primaryStepId: target.primaryStepId ?? null,
      };
    case "api_request":
      return {
        kind: "api_request",
        tier: "A",
        mode: "first_class",
        label: target.label,
        sourceIndex,
        target: normalizedTarget,
        primaryStepId: target.primaryStepId ?? null,
      };
    case "telegram_report":
      return {
        kind: "telegram_report",
        tier: "B",
        mode: "compatibility",
        label: target.label,
        sourceIndex,
        target: normalizedTarget,
        primaryStepId: null,
      };
    case "file_delivery":
      return {
        kind: "file_delivery",
        tier: "B",
        mode: "compatibility",
        label: target.label,
        sourceIndex,
        target: normalizedTarget,
        primaryStepId: null,
      };
    default:
      return null;
  }
}

export function pickPrimary<TTarget extends LegacyFunctionTargetLike>(resultTargets: TTarget[]) {
  const explicitPrimaryIndex = resultTargets.findIndex(
    (target) => target.isPrimary === true && classifyDestination(target.type) !== "C",
  );
  const tierAIndex =
    explicitPrimaryIndex >= 0
      ? explicitPrimaryIndex
      : resultTargets.findIndex((target) => classifyDestination(target.type) === "A");
  const primaryIndex =
    tierAIndex >= 0
      ? tierAIndex
      : resultTargets.findIndex((target) => classifyDestination(target.type) === "B");

  if (primaryIndex < 0) {
    return {
      primary: null,
      primaryIndex: -1,
      secondaryBag: resultTargets.map((target) =>
        cloneTargetWithPrimaryFlag(target, false),
      ),
    };
  }

  return {
    primary: cloneTargetWithPrimaryFlag(resultTargets[primaryIndex], true),
    primaryIndex,
    secondaryBag: resultTargets
      .filter((_, index) => index !== primaryIndex)
      .map((target) => cloneTargetWithPrimaryFlag(target, false)),
  };
}

export function getPrimaryStoredTarget<TTarget extends LegacyFunctionTargetLike>(
  resultTargets: TTarget[],
) {
  return pickPrimary(resultTargets).primary;
}

export function getOrderedResultTargets<TTarget extends LegacyFunctionTargetLike>(
  resultTargets: TTarget[],
) {
  const { primary, secondaryBag } = pickPrimary(resultTargets);

  return primary ? [primary, ...secondaryBag] : secondaryBag;
}

function ensureStepId<TStep extends LegacyFunctionStepLike>(step: TStep): TStep {
  if (typeof step.id === "string" && step.id.trim()) {
    return step;
  }

  return {
    ...step,
    id: crypto.randomUUID(),
  };
}

function findStepIndexById<TStep extends LegacyFunctionStepLike>(
  steps: TStep[],
  stepId?: string | null,
) {
  if (!stepId) {
    return -1;
  }

  return steps.findIndex((step) => step.id === stepId);
}

function resolvePrimaryStepId<
  TTarget extends LegacyFunctionTargetLike,
  TStep extends LegacyFunctionStepLike,
>(
  primary: TTarget,
  steps: TStep[],
  strategy?: PrimaryStepStrategy<TStep>,
) {
  const explicitStepIndex = findStepIndexById(steps, primary.primaryStepId);

  if (explicitStepIndex >= 0) {
    return steps[explicitStepIndex]?.id ?? null;
  }

  if (
    !strategy ||
    (primary.type !== "google_sheets" &&
      primary.type !== "google_calendar" &&
      primary.type !== "api_request")
  ) {
    return null;
  }

  const legacyStepIndex = strategy.findLegacyStepIndex(steps, primary.type);

  if (legacyStepIndex < 0) {
    return null;
  }

  return steps[legacyStepIndex]?.id ?? null;
}

export function loadViewModel<
  TTarget extends LegacyFunctionTargetLike,
  TStep extends LegacyFunctionStepLike,
  TParameter,
>(
  fn: StoredFunctionLike<TTarget, TStep, TParameter>,
  strategy?: PrimaryStepStrategy<TStep>,
): FunctionViewModel<TTarget, TStep, TParameter> {
  const { primary, primaryIndex, secondaryBag } = pickPrimary(fn.resultTargets);
  const normalizedSteps = fn.steps.map((step) => ensureStepId(step));
  const resolvedPrimaryStepId = primary
    ? resolvePrimaryStepId(primary, normalizedSteps, strategy)
    : null;

  return {
    details: {
      name: fn.name,
      description: fn.description,
      active: fn.active,
    },
    parameters: fn.parameters,
    reactionAction: fn.reactionAction,
    postAction: fn.postAction,
    disableDelayedMessages: fn.disableDelayedMessages,
    resultDelivery: {
      primary: primary
        ? toPrimaryDestinationView(
            {
              ...primary,
              primaryStepId: resolvedPrimaryStepId,
            } as TTarget,
            primaryIndex,
          )
        : null,
    },
    advanced: {
      secondaryTargets: secondaryBag,
      legacyCompatTargets: secondaryBag.filter(
        (target) => classifyDestination(target.type) === "B",
      ),
      advancedOnlyTargets: secondaryBag.filter(
        (target) => classifyDestination(target.type) === "C",
      ),
      steps: normalizedSteps,
    },
  };
}

export function saveViewModel<
  TTarget extends LegacyFunctionTargetLike,
  TStep extends LegacyFunctionStepLike,
  TParameter,
>(vm: FunctionViewModel<TTarget, TStep, TParameter>): StoredFunctionLike<TTarget, TStep, TParameter> {
  const primaryTarget = vm.resultDelivery.primary
    ? ((() => {
        const target = cloneTargetWithPrimaryFlag(vm.resultDelivery.primary.target, true) as TTarget &
          Record<string, unknown>;

        if (
          vm.resultDelivery.primary.tier === "A" &&
          vm.resultDelivery.primary.primaryStepId
        ) {
          target.primaryStepId = vm.resultDelivery.primary.primaryStepId;
        } else {
          delete target.primaryStepId;
        }

        return target as TTarget;
      })())
    : null;
  const secondaryTargets = vm.advanced.secondaryTargets.map((target) =>
    ((() => {
      const normalizedTarget = cloneTargetWithPrimaryFlag(target, false) as TTarget &
        Record<string, unknown>;
      delete normalizedTarget.primaryStepId;

      return normalizedTarget as TTarget;
    })()),
  );

  return {
    name: vm.details.name,
    description: vm.details.description,
    active: vm.details.active,
    parameters: vm.parameters,
    reactionAction: vm.reactionAction,
    postAction: vm.postAction,
    disableDelayedMessages: vm.disableDelayedMessages,
    resultTargets: primaryTarget ? [primaryTarget, ...secondaryTargets] : secondaryTargets,
    steps: vm.advanced.steps.map((step) => ensureStepId(step as TStep)),
  };
}

export function getDestinationSelectorOptions<TTarget extends LegacyFunctionTargetLike>({
  currentTargets,
}: {
  isNewFunction: boolean;
  currentTargets: TTarget[];
}): DestinationOption[] {
  const legacyCompatTypes = new Set<PrimaryDestinationType>();

  currentTargets.forEach((target) => {
    if (classifyDestination(target.type) === "B") {
      legacyCompatTypes.add(target.type as PrimaryDestinationType);
    }
  });

  return [...tierAValues, ...tierBValues]
    .filter((type) => classifyDestination(type) === "A" || legacyCompatTypes.has(type))
    .map((type) => ({
      value: type,
      label: getResultTargetLabel(type),
      tier: classifyDestination(type) as "A" | "B",
      compatibility: classifyDestination(type) === "B",
    }));
}

function toPrimaryTarget<TTarget extends LegacyFunctionTargetLike>(
  type: PrimaryDestinationType,
  currentTarget?: TTarget | null,
) {
  const baseTarget = currentTarget ? { ...currentTarget } : ({} as TTarget & Record<string, unknown>);

  return {
    ...baseTarget,
    type,
    label: currentTarget?.label?.trim() || getResultTargetLabel(type),
  } as TTarget;
}

function toDestinationViewFromType<TTarget extends LegacyFunctionTargetLike>(
  type: PrimaryDestinationType,
  target: TTarget,
  sourceIndex: number,
) {
  return toPrimaryDestinationView(
    cloneTargetWithPrimaryFlag(
      {
        ...target,
        type,
      } as TTarget,
      true,
    ),
    sourceIndex,
  ) as PrimaryDestinationView<TTarget> | null;
}

function removeAtIndex<TItem>(items: TItem[], index: number) {
  return items.filter((_, currentIndex) => currentIndex !== index);
}

function replaceAtIndex<TItem>(items: TItem[], index: number, nextItem: TItem) {
  return items.map((item, currentIndex) => (currentIndex === index ? nextItem : item));
}

export function createPrimaryDestination<
  TTarget extends LegacyFunctionTargetLike,
  TStep extends LegacyFunctionStepLike,
  TParameter,
>(
  vm: FunctionViewModel<TTarget, TStep, TParameter>,
  type: PrimaryDestinationType,
  strategy?: PrimaryStepStrategy<TStep>,
): FunctionViewModel<TTarget, TStep, TParameter> {
  if (vm.resultDelivery.primary) {
    return changePrimaryDestinationType(vm, type, strategy);
  }

  const nextTarget = toPrimaryTarget(type);
  const nextStep =
    classifyDestination(type) === "A" && strategy
      ? ensureStepId(strategy.createStep(type as TierAType) as TStep)
      : null;
  const nextPrimary = toDestinationViewFromType(
    type,
    {
      ...nextTarget,
      primaryStepId: nextStep?.id ?? undefined,
    } as TTarget,
    0,
  );

  if (!nextPrimary) {
    return vm;
  }

  return {
    ...vm,
    resultDelivery: {
      primary: nextPrimary as PrimaryDestinationView<TTarget>,
    },
    advanced: {
      ...vm.advanced,
      steps: nextStep ? [...vm.advanced.steps, nextStep] : vm.advanced.steps,
    },
  };
}

export function changePrimaryDestinationType<
  TTarget extends LegacyFunctionTargetLike,
  TStep extends LegacyFunctionStepLike,
  TParameter,
>(
  vm: FunctionViewModel<TTarget, TStep, TParameter>,
  type: PrimaryDestinationType,
  strategy?: PrimaryStepStrategy<TStep>,
): FunctionViewModel<TTarget, TStep, TParameter> {
  const currentPrimary = vm.resultDelivery.primary;

  if (!currentPrimary) {
    return createPrimaryDestination(vm, type, strategy);
  }

  const currentTierA =
    currentPrimary.kind === "google_sheets" ||
    currentPrimary.kind === "google_calendar" ||
    currentPrimary.kind === "api_request";
  const nextTierA = classifyDestination(type) === "A";
  let nextSteps = [...vm.advanced.steps];

  if (strategy && currentTierA && currentPrimary.kind !== type) {
    const currentStepIndex = findStepIndexById(nextSteps, currentPrimary.primaryStepId);

    if (currentStepIndex >= 0) {
      nextSteps = removeAtIndex(nextSteps, currentStepIndex);
    }
  }

  let nextPrimaryStepId: string | null = currentTierA ? currentPrimary.primaryStepId ?? null : null;

  if (strategy && nextTierA) {
    const createdStep = ensureStepId(strategy.createStep(type as TierAType) as TStep);
    nextSteps = [...nextSteps, createdStep];
    nextPrimaryStepId = createdStep.id ?? null;
  } else {
    nextPrimaryStepId = null;
  }

  const currentTarget = currentPrimary.target;
  const nextTarget = toPrimaryTarget(type, {
    ...currentTarget,
    primaryStepId: nextPrimaryStepId ?? undefined,
  } as TTarget);
  const nextPrimary = toDestinationViewFromType(
    type,
    {
      ...nextTarget,
      primaryStepId: nextPrimaryStepId ?? undefined,
    } as TTarget,
    currentPrimary.sourceIndex,
  );

  if (!nextPrimary) {
    return vm;
  }

  return {
    ...vm,
    resultDelivery: {
      primary: nextPrimary as PrimaryDestinationView<TTarget>,
    },
    advanced: {
      ...vm.advanced,
      steps: nextSteps,
    },
  };
}

export function updatePrimaryDestinationLabel<
  TTarget extends LegacyFunctionTargetLike,
  TStep,
  TParameter,
>(
  vm: FunctionViewModel<TTarget, TStep, TParameter>,
  label: string,
): FunctionViewModel<TTarget, TStep, TParameter> {
  const currentPrimary = vm.resultDelivery.primary;

  if (!currentPrimary) {
    return vm;
  }

  return {
    ...vm,
    resultDelivery: {
      primary: {
        ...currentPrimary,
        label,
        target: {
          ...currentPrimary.target,
          label,
        },
      },
    },
  };
}

export function updatePrimaryDestinationStep<
  TTarget extends LegacyFunctionTargetLike,
  TStep extends LegacyFunctionStepLike,
  TParameter,
>(
  vm: FunctionViewModel<TTarget, TStep, TParameter>,
  patchStep: (step: TStep) => TStep,
  strategy: PrimaryStepStrategy<TStep>,
): FunctionViewModel<TTarget, TStep, TParameter> {
  void strategy;
  const currentPrimary = vm.resultDelivery.primary;

  if (!currentPrimary || currentPrimary.tier !== "A") {
    return vm;
  }

  const stepIndex = findStepIndexById(vm.advanced.steps, currentPrimary.primaryStepId);

  if (stepIndex < 0) {
    return vm;
  }

  return {
    ...vm,
    advanced: {
      ...vm.advanced,
      steps: replaceAtIndex(
        vm.advanced.steps,
        stepIndex,
        patchStep(vm.advanced.steps[stepIndex] as TStep),
      ),
    },
  };
}

export function removePrimaryDestination<
  TTarget extends LegacyFunctionTargetLike,
  TStep,
  TParameter,
>(
  vm: FunctionViewModel<TTarget, TStep, TParameter>,
): FunctionViewModel<TTarget, TStep, TParameter> {
  if (!vm.resultDelivery.primary) {
    return vm;
  }

  return {
    ...vm,
    resultDelivery: {
      primary: null,
    },
  };
}

export function getLinkedPrimaryStep<
  TTarget extends LegacyFunctionTargetLike,
  TStep extends LegacyFunctionStepLike,
  TParameter,
>(vm: FunctionViewModel<TTarget, TStep, TParameter>) {
  const primary = vm.resultDelivery.primary;

  if (!primary || primary.tier !== "A") {
    return null;
  }

  const stepIndex = findStepIndexById(vm.advanced.steps, primary.primaryStepId);

  if (stepIndex < 0) {
    return null;
  }

  return {
    step: vm.advanced.steps[stepIndex] as TStep,
    stepIndex,
  };
}
