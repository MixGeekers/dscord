import assert from "node:assert/strict";
import { test } from "node:test";
import {
  equalWorkGrants,
  fileTools,
  parseWorkGrants,
} from "../web/src/bot-work-grants.ts";
import { roomAttachmentRoute } from "../web/src/attachment-proof.ts";

const document = {
  revision: 3,
  grants: [
    {
      roomId: "!opaque-v12-room",
      requesterIds: ["@sam:b.example", "@sam:a.example"],
      tools: ["write", "read"],
      enabled: true,
    },
  ],
};
test("owner work documents retain exact room and human IDs with only the four supported file tools", () => {
  const value = parseWorkGrants(document);
  assert.equal(value.revision, 3);
  assert.deepEqual(value.grants[0].requesterIds, [
    "@sam:a.example",
    "@sam:b.example",
  ]);
  assert.deepEqual(value.grants[0].tools, ["read", "write"]);
  assert.deepEqual(fileTools, ["read", "write", "edit", "read_image"]);
  assert.equal(document.grants[0].requesterIds[0], "@sam:b.example");
});
test("invalid owner grant documents reject version, duplicate rooms, incomplete IDs and expanded tool scopes", () => {
  for (const value of [
    null,
    { ...document, revision: -1 },
    { ...document, revision: 1.5 },
    { ...document, grants: [...document.grants, ...document.grants] },
    { ...document, grants: [{ ...document.grants[0], requesterIds: ["sam"] }] },
    { ...document, grants: [{ ...document.grants[0], tools: ["bash"] }] },
    {
      ...document,
      grants: [{ ...document.grants[0], tools: ["read", "read"] }],
    },
    { ...document, grants: [{ ...document.grants[0], enabled: "yes" }] },
  ])
    assert.throws(() => parseWorkGrants(value));
});
test("normalized save receipts can change ordering but cannot silently broaden a requester or tool", () => {
  assert.equal(
    equalWorkGrants(document, {
      ...document,
      revision: 4,
      grants: [
        {
          ...document.grants[0],
          requesterIds: document.grants[0].requesterIds.toReversed(),
          tools: ["read", "write"],
        },
      ],
    }),
    true,
  );
  assert.equal(
    equalWorkGrants(document, {
      ...document,
      grants: [{ ...document.grants[0], tools: ["read", "write", "edit"] }],
    }),
    false,
  );
  assert.equal(
    equalWorkGrants(document, {
      ...document,
      grants: [{ ...document.grants[0], requesterIds: ["@sam:c.example"] }],
    }),
    false,
  );
});

const attachment = {
  id: "same-index-id",
  name: "proof.txt",
  mimeType: "text/plain",
  size: 7,
  sha256: "a".repeat(64),
  contentUri: "mxc://home.example/proof",
};
const source = { roomId: "!opaque-v12-room", eventId: "$original-event" };
test("room media route always includes the original complete event and room IDs", () => {
  assert.equal(
    roomAttachmentRoute("id/with?chars", source),
    "/api/rooms/!opaque-v12-room/attachments/id%2Fwith%3Fchars?eventId=%24original-event",
  );
  assert.equal(
    roomAttachmentRoute(attachment.id, source, true),
    "/api/rooms/!opaque-v12-room/attachments/same-index-id/metadata?eventId=%24original-event",
  );
});
