import { test, expect } from "@playwright/test";
test("navigate from landing page and save a workspace preference", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("link", { name: "Open workspace" }).click();
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  const toggle = page.getByRole("checkbox", {
    name: "Automatically switch providers",
  });
  const before = await toggle.isChecked();
  await toggle.click();
  await expect(page.getByRole("status")).toContainText("Changes saved");
  await page.reload();
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await expect(toggle).toBeChecked({ checked: !before });
});
