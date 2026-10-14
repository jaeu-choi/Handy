import { test, expect } from "@playwright/test";

test("waiting leaves Settings and retry available, then expires", async ({
  page,
}) => {
  await page.clock.install();
  await page.goto("/tests/fixtures/permissions.html");
  await page
    .getByRole("button", { name: "Grant Permission", exact: true })
    .click();
  await expect(page.getByText("Waiting...", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Open System Settings", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Check permissions again" }),
  ).toBeEnabled();
  expect(
    await page.evaluate(() => window.__permissionTest.openedSettings),
  ).toContain(
    "x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility",
  );
  await page.clock.fastForward(21000);
  await expect(page.getByText("Waiting...", { exact: true })).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Grant Permission", exact: true }),
  ).toBeVisible();
});

test("returning from Settings completes without waiting for input initialization", async ({
  page,
}) => {
  await page.goto("/tests/fixtures/permissions.html");
  await expect(
    page.getByRole("button", { name: "Grant Permission", exact: true }),
  ).toBeVisible();
  await page.evaluate(() => {
    window.__permissionTest.accessibility = true;
    window.dispatchEvent(new Event("focus"));
  });
  await expect(page.getByRole("status")).toHaveText("Permissions complete");
  expect(await page.evaluate(() => window.__permissionTest.initialized)).toBe(
    0,
  );
  expect(await page.evaluate(() => window.__permissionTest.completed)).toBe(1);
});

test("reopening with both permissions already granted skips the request screen", async ({
  page,
}) => {
  await page.goto("/tests/fixtures/permissions.html?accessibility=true");
  await expect(page.getByRole("status")).toHaveText("Permissions complete");
  expect(
    await page.evaluate(() => window.__permissionTest.openedSettings),
  ).toEqual([]);
  expect(await page.evaluate(() => window.__permissionTest.initialized)).toBe(
    0,
  );
});

test("an unresponsive accessibility check preserves microphone status and allows recovery", async ({
  page,
}) => {
  await page.clock.install();
  await page.goto("/tests/fixtures/permissions.html?hang=1");
  await expect
    .poll(() =>
      page.evaluate(() => window.__permissionTest.accessibilityChecks),
    )
    .toBe(1);
  await page.clock.fastForward(6000);
  await expect(
    page.getByRole("button", { name: "Check permissions again" }),
  ).toBeEnabled();
  await expect(page.getByText("Granted", { exact: true })).toHaveCount(1);
  await page.clock.fastForward(10000);
  expect(
    await page.evaluate(() => window.__permissionTest.accessibilityChecks),
  ).toBe(1);
  await page.evaluate(() => {
    window.__permissionTest.hangAccessibility = false;
    window.__permissionTest.accessibility = true;
    window.dispatchEvent(new Event("focus"));
  });
  await page.clock.runFor(500);
  await expect(page.getByRole("status")).toHaveText("Permissions complete");
});
