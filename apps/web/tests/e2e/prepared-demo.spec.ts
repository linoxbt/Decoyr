import { test, expect } from "@playwright/test";

/**
 * Prepared demo end-to-end. Requires the Decoyr API (and sandbox services) to be running.
 * landing → Test an agent → Start Trial → Compromised → Derive Minimum Authority → Replay with Guard → Contained → Passport
 */
test("prepared demo: compromised baseline, guarded replay contained, passport", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /Give your AI agent a fake company/i })).toBeVisible();

  // click 1: create prepared trial
  await page.getByRole("button", { name: "Test an agent" }).first().click();
  await page.waitForURL(/\/app\/trials\/[^/]+$/);
  const trialUrl = page.url();

  // click 2: start the baseline
  await page.getByRole("button", { name: "Start Trial" }).first().click();
  await page.waitForURL(/\/run\//);
  await expect(page.getByRole("log", { name: "Live trace" })).toBeVisible({ timeout: 60_000 });

  // baseline reaches the unsafe path and finishes compromised
  await expect(page.getByText("Unsafe path observed - trial continues inside the synthetic environment.")).toBeVisible({ timeout: 180_000 });
  await expect(page.getByRole("button", { name: "Derive Minimum Authority" }).first()).toBeVisible({ timeout: 180_000 });
  await expect(page.locator("header, div").getByText("Compromised", { exact: true }).first()).toBeVisible();

  // findings show the causal chain
  await page.goto(`${trialUrl}/findings`);
  await expect(page.getByText(/prompt injection/i).first()).toBeVisible();

  // calibrate
  await page.getByRole("button", { name: "Derive Minimum Authority" }).first().click();
  await page.waitForURL(/\/authority$/);
  await expect(page.getByTestId("authority-delta")).toContainText(/requested/);
  await expect(page.getByText("Dangerous").first()).toBeVisible();

  // guard
  await page.goto(`${trialUrl}/guard`);
  await expect(page.getByRole("cell", { name: "secrets.get" }).first()).toBeVisible();

  // replay
  await page.getByRole("button", { name: "Replay with Guard" }).first().click();
  await page.waitForURL(/\/replay$/);
  await expect(page.getByTestId("replay-header")).toContainText("Same agent");
  await expect(page.getByTestId("replay-header")).toContainText("New authority");
  await expect(page.getByTestId("replay-verdict")).toContainText("Contained for this tested scope", { timeout: 180_000 });
  await expect(page.getByText("release-notes.md").first()).toBeVisible();

  // passport
  await page.getByRole("link", { name: "View Passport" }).first().click();
  await page.waitForURL(/\/passport$/);
  await expect(page.getByText(/Calibrated: Release Notes/)).toBeVisible();
  await expect(page.locator("#limitations")).toBeVisible();
  await expect(page.getByText(/trust score/i)).toHaveCount(0);
});
