import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { shouldSubmitTestChatKey } from "./agent-test-chat-drawer";

const drawerPath = path.join(process.cwd(), "src/components/stafless/agent-test-chat-drawer.tsx");

test("agent test chat drawer sends with Enter and keeps Shift+Enter for new lines", () => {
  assert.equal(
    shouldSubmitTestChatKey({
      key: "Enter",
      shiftKey: false,
      ctrlKey: false,
      metaKey: false,
      altKey: false,
    }),
    true,
  );
  assert.equal(
    shouldSubmitTestChatKey({
      key: "Enter",
      shiftKey: true,
      ctrlKey: false,
      metaKey: false,
      altKey: false,
    }),
    false,
  );
  assert.equal(
    shouldSubmitTestChatKey({
      key: "Enter",
      shiftKey: false,
      ctrlKey: true,
      metaKey: false,
      altKey: false,
    }),
    false,
  );
  assert.equal(
    shouldSubmitTestChatKey({
      key: "a",
      shiftKey: false,
      ctrlKey: false,
      metaKey: false,
      altKey: false,
    }),
    false,
  );
});

test("agent test chat drawer follows the dark reference shell and surfaces tool calls", () => {
  const source = fs.readFileSync(drawerPath, "utf8");

  assert.match(source, /slide-in-from-right/);
  assert.match(source, /Agent called/);
  assert.match(source, /Shift\+Enter adds a new line/);
  assert.match(source, /onKeyDown/);
});

test("agent test chat drawer renders image attachments returned by the test runtime", () => {
  const source = fs.readFileSync(drawerPath, "utf8");

  assert.match(source, /result\.item\.attachments/);
  assert.match(source, /attachment\.mimeType\?\.startsWith\("image\/"\)/);
  assert.match(source, /src=\{attachment\.publicUrl\}/);
});
