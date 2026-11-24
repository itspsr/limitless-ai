import { createRequire } from "node:module";
import { spawn, execFileSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { mkdtempSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { setTimeout as wait } from "node:timers/promises";
import { seed } from "./demo/seed.mjs";
const web = createRequire(new URL("../apps/web/package.json", import.meta.url));
const { chromium } = web("@playwright/test");
const scratch = mkdtempSync(path.join(tmpdir(), "limitless-visuals-"));
const url = "file:" + path.join(scratch, "demo.db");
const origin = "http://127.0.0.1:3481";
const out = path.resolve("docs/images");
const env = {
  ...process.env,
  DATABASE_URL: url,
  AUTH_URL: origin,
  AUTH_SECRET: randomBytes(32).toString("hex"),
  ENCRYPTION_SECRET: randomBytes(32).toString("hex"),
  SINGLE_USER: "true",
  LIMITLESS_SCREENSHOTS: "1",
  CHECKPOINT_DISABLE: "1",
  NEXT_TELEMETRY_DISABLED: "1",
};
let browser, server;
try {
  if (
    await fetch(origin).then(
      () => true,
      () => false,
    )
  )
    throw Error("Port 3481 is already in use.");
  mkdirSync(out, { recursive: true });
  execFileSync("pnpm", ["db:setup"], { env, stdio: "inherit" });
  process.env.ENCRYPTION_SECRET = env.ENCRYPTION_SECRET;
  await seed(url);
  server = spawn("pnpm", ["dev", "-p", "3481"], {
    detached: true,
    stdio: "inherit",
    env: {
      ...env,
      NODE_OPTIONS:
        "--require=" +
        JSON.stringify(path.resolve("scripts/demo/providers.cjs")),
    },
  });
  let ready = false;
  for (let n = 0; n < 120 && !ready; n++) {
    if (server.exitCode !== null) throw Error("Demo server exited");
    await wait(500);
    ready = await fetch(origin + "/workspace").then(
      (r) => r.ok,
      () => false,
    );
  }
  if (!ready) throw Error("Timed out starting demo workspace");
  if (!process.env.CHROMIUM_PATH)
    execFileSync(
      "pnpm",
      [
        "--filter",
        "@limitless/web",
        "exec",
        "playwright",
        "install",
        "chromium",
      ],
      { stdio: "inherit" },
    );
  browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH,
  });
  const page = await browser.newPage({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
    colorScheme: "dark",
  });
  await page.goto(origin + "/workspace");
  await page.evaluate(() => document.fonts.ready);
  const btn = (name) => page.getByRole("button", { name, exact: true });
  const shot = async (name, locator = page.locator("main")) => {
    await locator.screenshot({
      path: path.join(out, name + ".png"),
      animations: "disabled",
    });
  };
  await btn("Chat").click();
  await btn("Coastal field study").click();
  await page
    .getByRole("textbox", { name: "Message" })
    .fill("How should we collect comparable readings?");
  const capture = async () => {
    const start = Date.now();
    for (let frame = 0; frame < 48; frame++) {
      await wait(Math.max(0, start + frame * 250 - Date.now()));
      await page.screenshot({
        path: path.join(scratch, "f" + String(frame).padStart(3, "0") + ".png"),
        scale: "css",
      });
    }
  };
  await Promise.all([
    capture(),
    (async () => {
      await wait(1750);
      await btn("Send message").click();
      await page
        .getByText(
          "Limit reached. Continuing with next provider. Context preserved.",
          { exact: true },
        )
        .waitFor();
      await page
        .getByText("Cirrus / cirrus-chat", { exact: true })
        .first()
        .waitFor();
    })(),
  ]);
  await shot("chat-autoswitch");
  await btn("Dashboard").click();
  await page.getByText("Limit reached", { exact: true }).waitFor();
  await shot("dashboard");
  await btn("Connect provider").click();
  await shot("connect-tool", page.getByRole("dialog"));
  await btn("Cancel").click();
  await btn("Settings").click();
  await shot("fallback-order");
  execFileSync("ffmpeg", [
    "-loglevel",
    "error",
    "-y",
    "-framerate",
    "4",
    "-i",
    path.join(scratch, "f%03d.png"),
    "-filter_complex",
    "scale=1000:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=128[p];[b][p]paletteuse=dither=bayer",
    "-loop",
    "0",
    path.join(out, "demo.gif"),
  ]);
} finally {
  await browser?.close();
  if (server?.pid)
    try {
      process.kill(-server.pid, "SIGTERM");
    } catch {}
  rmSync(scratch, { recursive: true, force: true });
}
