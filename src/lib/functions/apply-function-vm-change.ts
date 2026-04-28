import {
  FunctionViewModel,
  LegacyFunctionStepLike,
  LegacyFunctionTargetLike,
  loadViewModel,
  saveViewModel,
  StoredFunctionLike,
} from "@/lib/functions/destination-mapping";

export type FunctionVmPatch<
  TTarget extends LegacyFunctionTargetLike,
  TStep,
  TParameter,
> = Pick<
  StoredFunctionLike<TTarget, TStep, TParameter>,
  | "name"
  | "description"
  | "active"
  | "parameters"
  | "reactionAction"
  | "postAction"
  | "disableDelayedMessages"
  | "resultTargets"
  | "steps"
>;

export function applyFunctionVmChange<
  TTarget extends LegacyFunctionTargetLike,
  TStep extends LegacyFunctionStepLike,
  TParameter,
>(
  currentFunction: StoredFunctionLike<TTarget, TStep, TParameter>,
  updater: (
    currentVm: FunctionViewModel<TTarget, TStep, TParameter>,
  ) => FunctionViewModel<TTarget, TStep, TParameter>,
): FunctionVmPatch<TTarget, TStep, TParameter> {
  const nextVm = updater(loadViewModel(currentFunction));
  const savedFunction = saveViewModel(nextVm);

  return {
    name: savedFunction.name,
    description: savedFunction.description,
    active: savedFunction.active,
    parameters: savedFunction.parameters,
    reactionAction: savedFunction.reactionAction,
    postAction: savedFunction.postAction,
    disableDelayedMessages: savedFunction.disableDelayedMessages,
    resultTargets: savedFunction.resultTargets,
    steps: savedFunction.steps,
  };
}
