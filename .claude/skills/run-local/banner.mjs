// Browser check: submits a request through the real UI and confirms the
// success banner with the withdraw link renders. Saves a screenshot.
//
// playwright-core is deliberately NOT a repo dependency; it is installed
// in a scratch directory (PW_DIR) and loaded from there, and it drives the
// Chromium headless shell already in ~/.cache/ms-playwright.
//
// Usage: PW_DIR=<dir with playwright-core> node banner.mjs [screenshot.png]
import { createRequire } from "node:module";
import { readdirSync } from "node:fs";
import { join } from "node:path";

const pwDir = process.env.PW_DIR;
if (!pwDir) {
  console.error("Set PW_DIR to the directory where playwright-core is installed.");
  process.exit(2);
}
const { chromium } = createRequire(join(pwDir, "/"))("playwright-core");

// Newest cached headless shell, e.g. chromium_headless_shell-1243.
const cache = join(process.env.HOME, ".cache/ms-playwright");
const shell = readdirSync(cache)
  .filter((d) => d.startsWith("chromium_headless_shell-"))
  .sort()
  .pop();
if (!shell) {
  console.error(`No chromium_headless_shell-* in ${cache}`);
  process.exit(2);
}
const executablePath = join(cache, shell, "chrome-headless-shell-linux64/chrome-headless-shell");

const port = process.env.PORT ?? "3100";
const shot = process.argv[2] ?? "banner.png";
const browser = await chromium.launch({ executablePath });
const page = await browser.newPage({ viewport: { width: 1280, height: 1100 } });
const errors = [];
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));

await page.goto(`http://localhost:${port}/`, { waitUntil: "networkidle" });
// Day 12 of next month is always in the future and selectable.
await page.getByRole("button", { name: /next month/i }).click();
await page.locator(".rdp-day:not(.rdp-outside) button").filter({ hasText: /^12$/ }).click();
await page.getByRole("button", { name: /Loft/ }).first().click();
await page.getByPlaceholder("e.g. Josh").fill("Banner Test");
await page.getByRole("button", { name: /^Send request/ }).click();

const banner = page.getByText("Bookmark this link to withdraw your request later");
let ok = true;
try {
  await banner.waitFor({ timeout: 10000 });
} catch {
  ok = false;
}
await page.screenshot({ path: shot });
const link = ok ? await page.locator('a[href*="/api/cancel/"]').getAttribute("href") : null;
console.log(ok ? `PASS  withdraw banner shown: ${link}` : "FAIL  withdraw banner not shown");
console.log(errors.length ? `Console errors:\n${errors.join("\n")}` : "No console errors.");
console.log(`Screenshot: ${shot}`);
await browser.close();
process.exit(ok && errors.length === 0 ? 0 : 1);
