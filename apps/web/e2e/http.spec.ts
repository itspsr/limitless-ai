import { test, expect } from "@playwright/test";
test("workspace persists a settings change through authenticated HTTP routes", async ({
  request,
  baseURL,
}) => {
  const initial = await request.get("/api/workspace");
  expect(initial.ok()).toBe(true);
  const data = await initial.json();
  expect(data.registry).toHaveLength(9);
  const update = await request.post("/api/workspace", {
    headers: { origin: baseURL! },
    data: { action: "settings", ...data.settings, warn: !data.settings.warn },
  });
  expect(update.status()).toBe(200);
  expect(
    (await (await request.get("/api/workspace")).json()).settings.warn,
  ).toBe(!data.settings.warn);
});
