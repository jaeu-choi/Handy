import assert from "node:assert/strict";
import { withPermissionTimeout } from "./permissionTimeout";

assert.equal(await withPermissionTimeout(Promise.resolve(true), 50), true);
await assert.rejects(
  withPermissionTimeout(Promise.reject(new Error("native failure")), 50),
  /native failure/,
);
await assert.rejects(
  withPermissionTimeout(new Promise<never>(() => {}), 5),
  /timed out/,
);
let finish: (value: boolean) => void = () => {};
const delayed = new Promise<boolean>((resolve) => {
  finish = resolve;
});
await assert.rejects(withPermissionTimeout(delayed, 5), /timed out/);
finish(true);
console.log("Permission IPC timeout and late-response checks passed");
