import { test, expect } from "@playwright/test";
import path from "path";

test.describe("Upload Page", () => {
  test("should show upload form", async ({ page }) => {
    await page.goto("/upload");
    await expect(page.locator("h1")).toContainText("Upload");
    await expect(page.locator("text=Drop your CSV file here")).toBeVisible();
  });

  test("should show empty dashboard state", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page.locator("text=No Analysis Results")).toBeVisible();
    await expect(page.locator("a[href='/upload']")).toBeVisible();
  });
});

test.describe("Navigation", () => {
  test("should navigate between all pages", async ({ page }) => {
    // Landing
    await page.goto("/");
    await expect(page.locator("h1")).toBeVisible();

    // Upload
    await page.click("nav a[href='/upload']");
    await expect(page).toHaveURL("/upload");

    // Dashboard (empty state)
    await page.click("nav a[href='/dashboard']");
    await expect(page).toHaveURL("/dashboard");

    // Insights
    await page.click("nav a[href='/insights']");
    await expect(page).toHaveURL("/insights");

    // Fixes
    await page.click("nav >> text=Fix Suggestions");
    await expect(page).toHaveURL("/fixes");

    // Simulator
    await page.click("nav >> text=What-If");
    await expect(page).toHaveURL("/simulator");

    // History
    await page.click("nav a[href='/history']");
    await expect(page).toHaveURL("/history");
  });
});
