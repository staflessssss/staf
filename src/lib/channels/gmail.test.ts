import test from "node:test";
import assert from "node:assert/strict";

import { gmailAdapter, gmailAdapterTestHelpers } from "@/lib/channels/gmail";

test("gmail helper converts markdown links into html anchors", () => {
  const html = gmailAdapterTestHelpers.convertMarkdownishToHtml(
    "See our [gallery](https://galleries.vidflow.co/rwjo8nz2)",
  );

  assert.match(html, /<a href="https:\/\/galleries\.vidflow\.co\/rwjo8nz2">gallery<\/a>/i);
});

test("gmail helper preserves model-provided html anchors as clickable links", () => {
  const html = gmailAdapterTestHelpers.convertMarkdownishToHtml(
    'See <a href="https://galleries.vidflow.co/rwjo8nz2">Callista and Kevin</a>',
  );

  assert.match(
    html,
    /See <a href="https:\/\/galleries\.vidflow\.co\/rwjo8nz2">Callista and Kevin<\/a>/i,
  );
  assert.doesNotMatch(html, /&lt;a href=/i);
});

test("gmail helper converts html anchors to readable plain text", () => {
  const text = gmailAdapterTestHelpers.htmlAnchorsToPlainText(
    'See <a href="https://galleries.vidflow.co/rwjo8nz2">Callista and Kevin</a>',
  );

  assert.equal(text, "See Callista and Kevin: https://galleries.vidflow.co/rwjo8nz2");
});

test("gmail helper strips attachment placeholders and duplicate Myndful signatures", () => {
  const signature = `Taras Mynd
Founder & Creative Director / MYNDFUL FILMS LLC
www.myndfulfilms.co
contact@myndfulfilms.com`;
  const cleaned = gmailAdapterTestHelpers.cleanGeneratedEmailText(
    `I’m attaching the collections guide.

${signature}

(Attaching collections guide…)

${signature}`,
    {},
  );

  assert.equal(
    cleaned,
    `I’m attaching the collections guide.

${signature}`,
  );
});

test("gmail helper does not append duplicate signature when existing signature uses markdown spacing", () => {
  const signature = `Taras Mynd
Founder & Creative Director / MYNDFUL FILMS LLC
www.myndfulfilms.co
contact@myndfulfilms.com`;
  const existing = `Thanks so much 🤍

Taras Mynd  
Founder & Creative Director / MYNDFUL FILMS LLC  
www.myndfulfilms.co  
contact@myndfulfilms.com`;
  const withSignature = gmailAdapterTestHelpers.appendSignature(existing, {
    signatureText: signature,
  });

  assert.equal((withSignature.match(/Taras Mynd/g) ?? []).length, 1);
});

test("gmail helper strips localized Gmail quoted reply headers", () => {
  const cleaned = gmailAdapterTestHelpers.stripQuotedReply(`Sure, we are Anna and Mark. Our wedding is June 14 in Charlotte.

вс, 17 мая 2026 г. в 16:54, Fhdh Fhdh <fhdhf2211@gmail.com>:
> prior reply`);

  assert.equal(cleaned, "Sure, we are Anna and Mark. Our wedding is June 14 in Charlotte.");
});

test("gmail helper never infers an attachment from pricing language", () => {
  const attachments = gmailAdapterTestHelpers.collectAutoAttachments({
    attachments: [],
  });

  assert.equal(attachments.length, 0);
});

test("gmail helper preserves only an explicit collections-guide attachment", () => {
  const attachments = gmailAdapterTestHelpers.collectAutoAttachments({
    attachments: [
      {
        source: "google_drive",
        fileId: "fl-guide",
        fileName: "price-fl.png",
        mimeType: "image/png",
      },
    ],
  });

  assert.equal(attachments.length, 1);
  assert.equal(attachments[0]?.fileId, "fl-guide");
  assert.equal(attachments[0]?.fileName, "price-fl.png");
});

test("gmail delivery attachments respect message-layer attachment permission", () => {
  const blocked = gmailAdapterTestHelpers.collectDeliveryAttachments({
    text: "",
    attachments: [{ fileId: "guide", source: "google_drive" }],
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
    text: "",
    attachments: [{ fileId: "guide", source: "google_drive" }],
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

test("gmail parseIncoming drops quote-only reply payloads instead of replaying history", () => {
  const parsed = gmailAdapter.parseIncoming({
    from: "anna@example.com",
    subject: "Re: Wedding films",
    text: `On Wed, May 20, 2026 at 5:05 AM Taras <contact@myndfulfilms.com> wrote:
> June 14, 2027, in Charlotte is wide open on my calendar.
> Our collections start at $2,750.`,
  });

  assert.equal(parsed.message, "");
});

test("gmail parseIncoming keeps only the new client text before quoted history", () => {
  const parsed = gmailAdapter.parseIncoming({
    from: "anna@example.com",
    subject: "Re: Wedding films",
    text: `Could you send pricing again? Also do you travel?

On Wed, May 20, 2026 at 5:05 AM Taras <contact@myndfulfilms.com> wrote:
> June 14, 2027, in Charlotte is wide open on my calendar.
> Our collections start at $2,750.`,
  });

  assert.equal(parsed.message, "Could you send pricing again? Also do you travel?");
});
