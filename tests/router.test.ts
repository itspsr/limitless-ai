import { test } from "vitest";
import { fallback } from "./routing-cases.ts";
test("429 retries B with every turn intact", () => fallback(false));
test("interrupted stream replaces partial answer and replays history", () =>
  fallback(true));
