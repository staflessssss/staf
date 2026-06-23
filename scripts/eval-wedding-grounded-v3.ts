import { selectWeddingSalesActionPlan } from "@/lib/lang/graphs/wedding-sales/action-plan/selector";
import { analyzeGroundedWeddingTurn } from "@/lib/lang/graphs/wedding-sales/semantic-v3/analyzer";
import { adaptGroundedWeddingUnderstanding } from "@/lib/lang/graphs/wedding-sales/semantic-v3/grounding";
import { createInitialWeddingSalesState } from "@/lib/lang/graphs/wedding-sales/state";
import { applySemanticV2StateMutation } from "@/lib/lang/graphs/wedding-sales/state-v2/mutator";

const cases = [
  {
    name: "monica-logistics-not-names",
    message:
      "April 17 2027, Miami Florida. Church ceremony and reception at different location afterwards.",
    forbiddenFields: ["customerName", "partnerName"],
    requiredFields: ["weddingDate", "location"],
  },
  {
    name: "harborside-complete-turn",
    message:
      "It's 10/18/26 at Harborside Chapel in Safety Harbor FL. Cindy & Paul. Do you include raw footage and are there travel fees?",
    forbiddenFields: [],
    requiredFields: [
      "customerName",
      "partnerName",
      "weddingDate",
      "venue",
      "location",
    ],
    requiredTopics: ["package_inclusions", "travel_fees"],
  },
  {
    name: "third-party-couple",
    message:
      "My friends Anna and Mark used you last year. What do your packages include?",
    forbiddenFields: ["customerName", "partnerName"],
    requiredFields: [],
    requiredTopics: ["package_inclusions"],
  },
  {
    name: "explicit-location-correction",
    message: "Actually, not Tampa. Our wedding will be in Charlotte, NC.",
    forbiddenFields: [],
    requiredFields: ["location"],
    correctionField: "location",
  },
  {
    name: "call-time-and-question",
    message:
      "Monday at 10 AM works. Before we book, when is the final film delivered?",
    forbiddenFields: [],
    requiredFields: ["callTime"],
    requiredTopics: ["final_film_delivery"],
  },
] as const;

async function main() {
  let failed = false;

  for (const testCase of cases) {
    const previousState =
      testCase.name === "explicit-location-correction"
        ? {
            leadStage: "availability_checked" as const,
            customerName: "Cindy",
            partnerName: "Paul",
            names: "Cindy and Paul",
            weddingDate: "2026-10-18",
            weddingYear: "2026",
            weddingYearKnown: true,
            location: "Tampa, FL",
            availability: "available" as const,
            guideSent: true,
          }
        : testCase.name === "call-time-and-question"
          ? {
              leadStage: "asking_call_time" as const,
              customerName: "Cindy",
              partnerName: "Paul",
              names: "Cindy and Paul",
              weddingDate: "2026-10-18",
              weddingYear: "2026",
              weddingYearKnown: true,
              location: "Safety Harbor, FL",
              venue: "Harborside Chapel",
              availability: "available" as const,
              guideSent: true,
              callProposed: true,
            }
          : undefined;
    const state = createInitialWeddingSalesState({
      channel: "instagram",
      message: testCase.message,
      previousState,
    });
    const understanding = await analyzeGroundedWeddingTurn(state);
    const adaptation = adaptGroundedWeddingUnderstanding({
      state,
      understanding,
    });
    const mutation = applySemanticV2StateMutation({
      state,
      analysis: adaptation.analysis,
    });
    const nextState = { ...state, ...mutation };
    const actionPlan = selectWeddingSalesActionPlan({
      state: nextState,
      analysis: adaptation.analysis,
    });
    const acceptedFields = new Set(
      adaptation.acceptedFacts.map((fact) => fact.field),
    );
    const topics = new Set(
      adaptation.analysis.questions
        .map((question) => question.topicId)
        .filter(Boolean),
    );
    const errors: string[] = [];

    for (const field of testCase.requiredFields) {
      if (!acceptedFields.has(field)) errors.push(`missing field ${field}`);
    }
    for (const field of testCase.forbiddenFields) {
      if (acceptedFields.has(field)) errors.push(`forbidden field ${field}`);
    }
    for (const topic of "requiredTopics" in testCase
      ? testCase.requiredTopics
      : []) {
      if (!topics.has(topic)) errors.push(`missing question topic ${topic}`);
    }
    if (
      "correctionField" in testCase &&
      !understanding.facts.some(
        (fact) =>
          fact.field === testCase.correctionField && fact.mode === "correct",
      )
    ) {
      errors.push(`missing correction ${testCase.correctionField}`);
    }

    failed ||= errors.length > 0;
    console.log(
      JSON.stringify(
        {
          case: testCase.name,
          ok: errors.length === 0,
          errors,
          understanding,
          acceptedFacts: adaptation.acceptedFacts,
          rejectedFacts: adaptation.rejectedFacts,
          state: {
            customerName: nextState.customerName,
            partnerName: nextState.partnerName,
            weddingDate: nextState.weddingDate,
            location: nextState.location,
            venue: nextState.venue,
            callTime: nextState.proposedCallTime,
          },
          actionPlan,
        },
        null,
        2,
      ),
    );
  }

  if (failed) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
