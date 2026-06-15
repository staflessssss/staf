import { createInitialWeddingSalesState, type WeddingSalesState } from "../state";
import type {
  SemanticAnalysisV2,
  WeddingSalesField,
} from "./schema";

export type SemanticV2EvalCase = {
  id: string;
  state: WeddingSalesState;
  expected: {
    intentIncludes?: SemanticAnalysisV2["intents"][number]["category"][];
    entityFieldsInclude?: WeddingSalesField[];
    entityFieldsExclude?: WeddingSalesField[];
    questionTopicsInclude?: string[];
    objectionTypesInclude?: SemanticAnalysisV2["objections"][number]["type"][];
    pendingResolutionType?: NonNullable<SemanticAnalysisV2["pendingResolution"]>["type"];
    pendingResolutionField?: WeddingSalesField;
    clientType?: NonNullable<SemanticAnalysisV2["clientType"]>["value"];
    providedNameRolesInclude?: Array<"customerName" | "partnerName">;
  };
};

function state(args: {
  message: string;
  previousState?: Partial<WeddingSalesState>;
  conversationContext?: string;
}) {
  return createInitialWeddingSalesState({
    channel: "instagram",
    message: args.message,
    previousState: args.previousState,
    conversationContext: args.conversationContext,
  });
}

export const semanticV2EvalCases: SemanticV2EvalCase[] = [
  {
    id: "A-confirmed-date-correction",
    state: state({
      message: "Yes, I mean October 17, 2027 is our new wedding date.",
      previousState: {
        names: "Anna and Mark",
        weddingDate: "2027-06-14",
        weddingYear: "2027",
        weddingYearKnown: true,
        location: "Charlotte",
        pendingChangeField: "weddingDate",
        pendingChangeValue: "2027-10-17",
        pendingChangeDisplay: "October 17, 2027",
        leadStage: "confirming_change",
        responseDraft: "Just to confirm, is October 17 your updated wedding date?",
      },
    }),
    expected: {
      intentIncludes: ["confirm"],
      entityFieldsInclude: ["weddingDate"],
      pendingResolutionType: "confirm",
      pendingResolutionField: "weddingDate",
    },
  },
  {
    id: "B-complete-details",
    state: state({
      message: "Hey, Olivia and Daniel here. Wedding is November 8, 2026 in Tampa, Florida.",
    }),
    expected: {
      intentIncludes: ["provide_info"],
      entityFieldsInclude: ["names", "weddingDate", "location"],
      providedNameRolesInclude: ["customerName", "partnerName"],
    },
  },
  {
    id: "C-call-objection",
    state: state({
      message: "I am not ready to schedule a call yet, can I ask more questions?",
      previousState: {
        names: "Emma and Liam",
        weddingDate: "2027-06-14",
        weddingYear: "2027",
        weddingYearKnown: true,
        location: "Charlotte",
        availability: "available",
        callProposed: true,
        leadStage: "asking_call_time",
      },
    }),
    expected: {
      intentIncludes: ["express_objection", "ask_question"],
      entityFieldsExclude: ["callTime", "names"],
      objectionTypesInclude: ["not_ready_to_schedule"],
    },
  },
  {
    id: "D-final-film-faq",
    state: state({
      message: "How long until we receive the final film?",
    }),
    expected: {
      intentIncludes: ["ask_question"],
      questionTopicsInclude: ["final_film_delivery"],
    },
  },
  {
    id: "E-past-client-operational-question",
    state: state({
      message:
        "Our wedding already happened last weekend. Could my parents have paid the operators for an additional hour on the wedding day?",
    }),
    expected: {
      intentIncludes: ["ask_question"],
      entityFieldsExclude: ["names", "callTime"],
      clientType: "past_client",
    },
  },
  {
    id: "F-question-before-missing-info",
    state: state({
      message: "Why did you need the venue?",
      previousState: {
        location: "Charlotte",
        askedForNames: true,
        askedForVenue: true,
        leadStage: "missing_names_or_date",
        responseDraft: "Could you share both of your names and your wedding date?",
      },
    }),
    expected: {
      intentIncludes: ["ask_question"],
      questionTopicsInclude: ["venue_travel_details"],
      entityFieldsExclude: ["names"],
    },
  },
  {
    id: "G-address-is-venue",
    state: state({
      message: "The venue is 333 S Franklin Street, Tampa, FL 33602.",
      previousState: {
        names: "Suzie and Rick",
        weddingDate: "2026-10-11",
        weddingYear: "2026",
        weddingYearKnown: true,
        location: "Tampa",
        availability: "available",
        askedForVenue: true,
        leadStage: "missing_location_or_venue",
      },
    }),
    expected: {
      intentIncludes: ["provide_info"],
      entityFieldsInclude: ["venue", "location"],
      entityFieldsExclude: ["weddingDate", "callTime"],
    },
  },
  {
    id: "H-multi-goal-question-and-uncertain-date",
    state: state({
      message: "How long is the film? Also, we may change our date to June 15, but we are not sure yet.",
      previousState: {
        names: "Anna and Mark",
        weddingDate: "2027-06-14",
        weddingYear: "2027",
        weddingYearKnown: true,
        location: "Charlotte",
        availability: "available",
        leadStage: "availability_checked",
      },
    }),
    expected: {
      intentIncludes: ["ask_question", "request_modification"],
      questionTopicsInclude: ["film_length"],
      pendingResolutionType: "ambiguous",
      pendingResolutionField: "weddingDate",
    },
  },
  {
    id: "I-complete-venue-location-date-and-names",
    state: state({
      message:
        "It is 10/18/26 at Harborside Chapel in Safety Harbor FL. Cindy and Paul.",
    }),
    expected: {
      intentIncludes: ["provide_info"],
      entityFieldsInclude: ["weddingDate", "venue", "location"],
      providedNameRolesInclude: ["customerName", "partnerName"],
    },
  },
];

export function evaluateSemanticV2Case(args: {
  testCase: SemanticV2EvalCase;
  analysis: SemanticAnalysisV2;
}) {
  const failures: string[] = [];
  const intents = new Set(args.analysis.intents.map((intent) => intent.category));
  const entityFields = new Set(args.analysis.entities.map((entity) => entity.field));
  const questionTopics = new Set(
    args.analysis.questions.map((question) => question.topicId).filter(Boolean),
  );
  const objectionTypes = new Set(
    args.analysis.objections.map((objection) => objection.type),
  );

  for (const intent of args.testCase.expected.intentIncludes ?? []) {
    if (!intents.has(intent)) {
      failures.push(`missing intent: ${intent}`);
    }
  }

  for (const field of args.testCase.expected.entityFieldsInclude ?? []) {
    if (!entityFields.has(field)) {
      failures.push(`missing entity field: ${field}`);
    }
  }

  for (const field of args.testCase.expected.entityFieldsExclude ?? []) {
    if (entityFields.has(field)) {
      failures.push(`forbidden entity field: ${field}`);
    }
  }

  for (const topic of args.testCase.expected.questionTopicsInclude ?? []) {
    if (!questionTopics.has(topic)) {
      failures.push(`missing question topic: ${topic}`);
    }
  }

  for (const objection of args.testCase.expected.objectionTypesInclude ?? []) {
    if (!objectionTypes.has(objection)) {
      failures.push(`missing objection: ${objection}`);
    }
  }

  for (const role of args.testCase.expected.providedNameRolesInclude ?? []) {
    if (!args.analysis.providedInfo[role]) {
      failures.push(`missing provided name role: ${role}`);
    }
  }

  if (
    args.testCase.expected.pendingResolutionType &&
    args.analysis.pendingResolution?.type !==
      args.testCase.expected.pendingResolutionType
  ) {
    failures.push(
      `expected pending type ${args.testCase.expected.pendingResolutionType}, got ${args.analysis.pendingResolution?.type ?? "none"}`,
    );
  }

  if (
    args.testCase.expected.pendingResolutionField &&
    args.analysis.pendingResolution?.field !==
      args.testCase.expected.pendingResolutionField
  ) {
    failures.push(
      `expected pending field ${args.testCase.expected.pendingResolutionField}, got ${args.analysis.pendingResolution?.field ?? "none"}`,
    );
  }

  if (
    args.testCase.expected.clientType &&
    args.analysis.clientType?.value !== args.testCase.expected.clientType
  ) {
    failures.push(
      `expected client type ${args.testCase.expected.clientType}, got ${args.analysis.clientType?.value ?? "none"}`,
    );
  }

  return {
    id: args.testCase.id,
    passed: failures.length === 0,
    failures,
  };
}
