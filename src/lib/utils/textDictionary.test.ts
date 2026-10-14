import assert from "node:assert/strict";
import { importDictionary, normalizeDictionary } from "./textDictionary";

assert.deepEqual(importDictionary('{"위스퍼":"Whisper","머지":"Merge"}', []), [
  { from: "위스퍼", to: "Whisper" },
  { from: "머지", to: "Merge" },
]);
assert.deepEqual(
  importDictionary('[{"from":"위스퍼","to":"Whisper"}]', [
    { from: "위스퍼", to: "old" },
  ]),
  [{ from: "위스퍼", to: "Whisper" }],
);
assert.throws(
  () => normalizeDictionary([{ from: "", to: "Whisper" }]),
  /invalidEntry/,
);
assert.throws(() => importDictionary('{"위스퍼":1}', []), /invalidEntry/);
assert.throws(
  () =>
    normalizeDictionary([
      { from: "위스퍼", to: "Whisper" },
      { from: " 위스퍼 ", to: "other" },
    ]),
  /duplicate/,
);
assert.throws(
  () => normalizeDictionary([{ from: "위스\n퍼", to: "Whisper" }]),
  /invalidEntry/,
);
console.log("Dictionary import and validation tests passed.");
