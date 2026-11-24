import assert from "node:assert/strict";
import { route, type Event, type History } from "../packages/core/src/index.ts";
import { openAICompatible } from "../packages/providers/src/index.ts";

export async function fallback(interrupted: boolean) {
  const history: History = [
    { role: "system", content: "Cite sources" },
    { role: "user", content: "Explain tides" },
    { role: "assistant", content: "Gravity drives tides." },
    { role: "user", content: "And on Mars?" },
  ];
  const calls: unknown[] = [];
  const cooldowns: string[] = [];
  function candidate(id: string) {
    const adapter = openAICompatible(
      "https://example.invalid/v1",
      "",
      id,
      async (_, init) => {
        calls.push(JSON.parse(String(init?.body)).messages);
        if (id === "A" && !interrupted)
          return new Response(null, {
            status: 429,
            headers: { "retry-after": "60" },
          });
        const content = id === "A" ? "partial" : "complete";
        const frame = JSON.stringify({ choices: [{ delta: { content } }] });
        return new Response(
          "data: " +
            frame +
            "\r\n\r\n" +
            (id === "B" ? "data: [DONE]\n\n" : ""),
        );
      },
    );
    return { id, model: id, availableAt: 0, adapter };
  }
  const events: Event[] = [];
  for await (const event of route(["A", "B"].map(candidate), history, {
    signal: new AbortController().signal,
    autoSwitch: true,
    timeoutMs: 5000,
    async cooldown(id, until) {
      assert.ok(until > Date.now());
      cooldowns.push(id);
    },
  }))
    events.push(event);
  assert.deepEqual(calls, [history, history]);
  assert.deepEqual(cooldowns, ["A"]);
  assert.deepEqual(
    events.find((e) => e.type === "switch"),
    { type: "switch", from: "A", to: "B", replaceDraft: interrupted },
  );
  assert.deepEqual(events.at(-1), { type: "done", provider: "B", model: "B" });
}
