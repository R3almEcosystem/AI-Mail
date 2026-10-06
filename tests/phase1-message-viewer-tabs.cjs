const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");

const read = (path) => fs.readFileSync(path, "utf8");

test("message viewer exposes Message, Attachments, and Security Review tabs", () => {
  const ui = read("src/components/inbox-workspace.tsx");

  assert.match(ui, /useState<"message" \| "attachments" \| "security">\("message"\)/);
  assert.match(ui, /aria-label="Message viewer"/);
  assert.match(ui, />Message<\/button>/);
  assert.match(ui, />Attachments/);
  assert.match(ui, />Security Review<\/button>/);
});

test("changing the selected email resets the viewer to Message", () => {
  const ui = read("src/components/inbox-workspace.tsx");

  assert.match(ui, /setViewerTab\("message"\)/);
  assert.match(ui, /\[selected\?\.accountId, selected\?\.folder, selected\?\.uid/);
});

test("attachments and security content live in dedicated viewer panels", () => {
  const ui = read("src/components/inbox-workspace.tsx");

  assert.match(ui, /viewerTab === "attachments"/);
  assert.match(ui, /viewerTab === "security"/);
  assert.match(ui, /viewerTab === "message"/);
  assert.match(ui, /<MessageSecurityPanel assessment=\{selected\.security\} inspection=\{selected\.attachmentInspection\} demo=\{demo\} \/>/);

  const messagePanel = ui.match(/\{viewerTab === "message"[\s\S]*?\{viewerTab === "attachments"/)?.[0] || "";
  assert.doesNotMatch(messagePanel, /MessageSecurityPanel/);
  assert.doesNotMatch(messagePanel, /message-attachment-list/);
});

test("attachments tab handles stored, pending, and empty attachment states", () => {
  const ui = read("src/components/inbox-workspace.tsx");

  assert.match(ui, /Stored in the private S\.I\.-Mail attachment vault/);
  assert.match(ui, /Attachment metadata is available, but no vault record was created/);
  assert.match(ui, /No attachments/);
});
