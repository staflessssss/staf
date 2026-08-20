import assert from "node:assert/strict";
import test from "node:test";

import { ChannelType } from "@prisma/client";

import {
  conversationAutomationScopes,
  decideInstagramNewLeadEligibility,
  getInstagramNewLeadPolicy,
  isConversationEligibleForAutomation,
} from "@/lib/instagram-new-lead-policy";

const cutoverAt = "2026-08-20T08:00:00.000Z";
const strictConfig = {
  instagramInboundPolicy: "new_leads_only",
  instagramNewLeadCutoverAt: cutoverAt,
};

test("allows a first Instagram message with no earlier thread history", () => {
  const decision = decideInstagramNewLeadEligibility({
    policy: getInstagramNewLeadPolicy(strictConfig),
    preflight: { status: "no_prior_history" },
  });

  assert.equal(decision.allowAutomation, true);
  assert.equal(decision.scope, conversationAutomationScopes.NEW_LEAD);
});

test("keeps a rapid second message from a new lead eligible", () => {
  const decision = decideInstagramNewLeadEligibility({
    policy: getInstagramNewLeadPolicy(strictConfig),
    preflight: {
      status: "prior_history_found",
      historyMessages: [{ createdAt: new Date("2026-08-20T08:01:00.000Z") }],
    },
  });

  assert.equal(decision.allowAutomation, true);
  assert.equal(decision.reason, "eligible_post_cutover_history");
});

test("blocks a thread with any history from before the cutover", () => {
  const decision = decideInstagramNewLeadEligibility({
    policy: getInstagramNewLeadPolicy(strictConfig),
    preflight: {
      status: "prior_history_found",
      historyMessages: [{ createdAt: new Date("2026-08-19T22:00:00.000Z") }],
    },
  });

  assert.equal(decision.allowAutomation, false);
  assert.equal(decision.scope, conversationAutomationScopes.LEGACY);
});

test("fails closed when Instagram history cannot be verified", () => {
  const decision = decideInstagramNewLeadEligibility({
    policy: getInstagramNewLeadPolicy(strictConfig),
    preflight: { status: "error" },
  });

  assert.equal(decision.allowAutomation, false);
  assert.equal(decision.scope, conversationAutomationScopes.PRECHECK_FAILED);
});

test("only persisted new leads may continue under the strict policy", () => {
  assert.equal(
    isConversationEligibleForAutomation({
      channel: ChannelType.INSTAGRAM,
      channelConfig: strictConfig,
      automationScope: conversationAutomationScopes.NEW_LEAD,
    }),
    true,
  );
  assert.equal(
    isConversationEligibleForAutomation({
      channel: ChannelType.INSTAGRAM,
      channelConfig: strictConfig,
      automationScope: conversationAutomationScopes.LEGACY,
    }),
    false,
  );
  assert.equal(
    isConversationEligibleForAutomation({
      channel: ChannelType.GMAIL,
      channelConfig: strictConfig,
      automationScope: conversationAutomationScopes.LEGACY,
    }),
    true,
  );
});
