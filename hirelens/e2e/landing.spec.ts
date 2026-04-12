import { test, expect } from "@playwright/test";

test.describe("Landing Page", () => {
  test("should display hero section", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("h1")).toContainText("hiring bias");
  });

  test("should have navigation links", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("nav")).toBeVisible();
    await expect(page.locator("nav a[href='/upload']")).toBeVisible();
    await expect(page.locator("nav a[href='/dashboard']")).toBeVisible();
  });

  test("should navigate to upload page", async ({ page }) => {
    await page.goto("/");
    await page.click("a[href='/upload']");
    await expect(page).toHaveURL("/upload");
    await expect(page.locator("h1")).toContainText("Upload");
  });

  test("should show feature cards", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("text=Bias Detection")).toBeVisible();
    await expect(page.locator("text=AI Explanations")).toBeVisible();
    await expect(page.locator("text=What-If Simulator")).toBeVisible();
    await expect(page.locator("text=Actionable Fixes")).toBeVisible();
  });
});
