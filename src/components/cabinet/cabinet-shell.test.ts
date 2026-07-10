import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const shellSource = readFileSync(
  join(process.cwd(), "src/components/cabinet/cabinet-shell.tsx"),
  "utf8",
);
const frameSource = readFileSync(
  join(process.cwd(), "src/components/cabinet/cabinet-frame.tsx"),
  "utf8",
);
const clientLayoutSource = readFileSync(join(process.cwd(), "src/app/client/layout.tsx"), "utf8");
const globalsSource = readFileSync(join(process.cwd(), "src/app/globals.css"), "utf8");

test("cabinet shell applies Behalfy themed scrollbars to client surfaces", () => {
  assert.match(shellSource, /behalfy-scroll/);
  assert.match(globalsSource, /\.behalfy-scroll/);
  assert.match(globalsSource, /::-webkit-scrollbar-thumb/);
  assert.match(globalsSource, /scrollbar-color/);
});

test("client layout keeps the cabinet frame outside route content", () => {
  assert.match(clientLayoutSource, /<CabinetFrame/);
  assert.match(frameSource, /<ClientRail/);
  assert.doesNotMatch(shellSource, /<ClientRail/);
});
