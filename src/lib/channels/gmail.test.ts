import test from "node:test";
import assert from "node:assert/strict";

import { gmailAdapterTestHelpers } from "@/lib/channels/gmail";

test("gmail helper converts markdown links into html anchors", () => {
  const html = gmailAdapterTestHelpers.convertMarkdownishToHtml(
    "See our [gallery](https://galleries.vidflow.co/rwjo8nz2)",
  );

  assert.match(html, /<a href="https:\/\/galleries\.vidflow\.co\/rwjo8nz2">gallery<\/a>/i);
});

test("gmail helper recognizes pricing replies beyond one exact phrase", () => {
  assert.equal(
    gmailAdapterTestHelpers.isPricingReply("Our pricing starts at $2,750 and I can send more details."),
    true,
  );
  assert.equal(gmailAdapterTestHelpers.isPricingReply("Just checking in on the venue."), false);
});

test("gmail helper auto-adds pricing attachment when pricing is mentioned", () => {
  const attachments = gmailAdapterTestHelpers.collectAutoAttachments({
    text: "Our pricing starts at $2,750 and I just sent over details.",
    channelConfig: {},
  });

  assert.equal(attachments.length, 1);
  assert.equal(attachments[0]?.fileId, "1m3EBiPTnIVq-8i2qD-3CMMKJ6UfYgZxi");
});

test("gmail delivery attachments respect message-layer attachment permission", () => {
  const blocked = gmailAdapterTestHelpers.collectDeliveryAttachments({
    text: "Our pricing starts at $2,750 and I just sent over details.",
    channelConfig: {
      channelBehavior: {
        allowAttachments: false,
        bufferDelaySeconds: 0,
        followUpEnabled: false,
        followUpRules: [],
      },
    },
  });

  const allowed = gmailAdapterTestHelpers.collectDeliveryAttachments({
    text: "Our pricing starts at $2,750 and I just sent over details.",
    channelConfig: {
      channelBehavior: {
        allowAttachments: true,
        bufferDelaySeconds: 0,
        followUpEnabled: false,
        followUpRules: [],
      },
    },
  });

  assert.equal(blocked.length, 0);
  assert.equal(allowed.length, 1);
});

test("gmail helper strips quoted reply history from incoming messages", () => {
  const cleaned = gmailAdapterTestHelpers.stripQuotedReply(`10-00 looks good

On Wed, Apr 15, 2026 at 12:08 PM <test@example.com> wrote:
> Tuesday at 11 AM Eastern is just a little bit booked up on my end
> Would any of those times work for you both?`);

  assert.equal(cleaned, "10-00 looks good");
});
