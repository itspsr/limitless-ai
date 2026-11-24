import { expect, test } from "vitest";
import { route } from "../packages/core/src/index.ts";
import { openAICompatible } from "../packages/providers/src/index.ts";
const history = [{ role: "user" as const, content: "hello" }];
const options = {
  signal: new AbortController().signal,
  autoSwitch: true,
  timeoutMs: 1000,
  async cooldown() {},
};
test("unavailable providers report earliest reset without a network request", async () => {
  const adapter = openAICompatible(
    "https://example.invalid",
    "",
    "model",
    async () => {
      throw Error("unexpected call");
    },
  );
  const now = Date.now();
  const result = await Array.fromAsync(
    route(
      [8000, 2000].map((delay, i) => ({
        id: String(i),
        model: "model",
        availableAt: now + delay,
        adapter,
      })),
      history,
      options,
    ),
  );
  expect(result).toEqual([{ type: "exhausted", resetAt: now + 2000 }]);
});
test("credential errors stop routing and do not reveal upstream error text", async () => {
  const adapter = openAICompatible(
    "https://example.invalid",
    "",
    "model",
    async () => new Response("private upstream error", { status: 401 }),
  );
  await expect(
    Array.fromAsync(
      route(
        [{ id: "A", model: "model", availableAt: 0, adapter }],
        history,
        options,
      ),
    ),
  ).rejects.toThrow("Provider returned HTTP 401");
});
