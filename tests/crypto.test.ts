import {test,expect} from "vitest";
import {randomBytes} from "node:crypto";
import {seal,unseal} from "../apps/web/lib/crypto.ts";
test("credentials are randomized and bound to their owner",()=>{
  process.env.ENCRYPTION_SECRET=randomBytes(32).toString("hex");
  const encrypted=seal("example","one");
  expect(encrypted).not.toBe(seal("example","one"));
  expect(unseal(encrypted,"one")).toBe("example");
  expect(()=>unseal(encrypted,"two")).toThrow();
});
