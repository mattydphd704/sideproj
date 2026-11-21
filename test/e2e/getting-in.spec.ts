// Section 1, Getting in: UI-01 to UI-14 (UI_INTERACTION_MAPS §1.7).
import { expect, test } from "@playwright/test";
import { seed } from "./seed";
import { expectNoSideScroll, joinAs, typePin } from "./helpers";

test.beforeEach(async () => { await seed.clearRateLimits(); });

test("[UI-01] Home: a valid code opens the Join screen with the group name @desktop", async ({ page }) => {
  const g = await seed.group("Lee Family");
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Gift Lists" })).toBeVisible();
  await page.getByLabel("Group code").fill(g.group_code.toLowerCase());
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByRole("heading", { name: "Join Lee Family" })).toBeVisible();
  await expect(page.getByText("You're the first one here.")).toBeVisible();
});

test("[UI-02] Home: an invalid code shows the error and keeps focus on the box @desktop", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("Group code").fill("ZZZZ-ZZZZ");
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByText("That group code didn't work. Check it and try again.")).toBeVisible();
  await expect(page.getByLabel("Group code")).toBeFocused();
  await expect(page.getByLabel("Group code")).toHaveAttribute("aria-invalid", "true");
});

test("[UI-03] /j/<code> opens Join directly; an already-joined browser goes straight in", async ({ page }) => {
  const g = await seed.group("Park Family");
  await page.goto(`/j/${g.display}`);
  await expect(page.getByRole("heading", { name: "Join Park Family" })).toBeVisible();
  await joinAs(page, g.display, "Min");
  await page.goto(`/j/${g.display}`);
  await expect(page).toHaveURL(/\/g\//);
  await expect(page.getByText("You're already in Park Family.")).toBeVisible();
});

test("[UI-04] Joining as a new person lands inside the group with a welcome message @desktop", async ({ page }) => {
  const g = await seed.group("Diaz Family");
  const started = Date.now();
  await joinAs(page, g.display, "Ana");
  await expect(page.getByText("Welcome to Diaz Family!")).toBeVisible();
  await expect(page.getByText("Signed in as Ana")).toBeVisible();
  expect(Date.now() - started).toBeLessThan(120_000); // success criterion 2 (joining part)
});

test("[UI-05] Tapping a pre-added name fills it in and joins as that person", async ({ page }) => {
  const g = await seed.group("Kim Family", ["Grandma", "Uncle Ray"]);
  await page.goto(`/j/${g.display}`);
  await expect(page.getByText("Is one of these you?")).toBeVisible();
  await page.getByRole("button", { name: "Grandma" }).click();
  await expect(page.getByLabel("Your name")).toHaveValue("Grandma");
  await typePin(page, "pin", "2468");
  await typePin(page, "pin2", "2468");
  await page.getByRole("button", { name: "Join Kim Family" }).click();
  await expect(page.getByText("Signed in as Grandma")).toBeVisible();
});

test("[UI-06] Name taken shows the error with a working 'Sign back in' link", async ({ page, browser }) => {
  const g = await seed.group("Chen Family");
  const other = await browser.newPage();
  await joinAs(other, g.display, "Wei");
  await other.close();
  await page.goto(`/j/${g.display}`);
  await page.getByLabel("Your name").fill("wei");
  await typePin(page, "pin", "1111");
  await typePin(page, "pin2", "1111");
  await page.getByRole("button", { name: "Join Chen Family" }).click();
  await expect(page.getByText("Someone in this group already uses that name.", { exact: false })).toBeVisible();
  await page.getByRole("button", { name: "Sign back in", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Welcome back to Chen Family" })).toBeVisible();
  await expect(page).toHaveURL(/\/back$/);
});

test("[UI-07] PINs that don't match are caught before sending", async ({ page }) => {
  const g = await seed.group("Ross Family");
  await page.goto(`/j/${g.display}`);
  await page.getByLabel("Your name").fill("Jo");
  await typePin(page, "pin", "1234");
  await typePin(page, "pin2", "4321");
  await page.getByRole("button", { name: "Join Ross Family" }).click();
  await expect(page.getByText("The two PINs don't match. Try again.")).toBeVisible();
  await expect(page).toHaveURL(/\/j\//);
});

test("[UI-08] Sign back in on a second browser", async ({ page, browser }) => {
  const g = await seed.group("Nguyen Family");
  await joinAs(page, g.display, "Linh", "5555");
  const ctx = await browser.newContext();
  const second = await ctx.newPage();
  await second.goto(`/j/${g.display}/back`);
  await second.locator("#rname").click();
  await second.getByRole("option", { name: "Linh" }).click();
  await typePin(second, "rpin", "5555");
  await second.getByRole("button", { name: "Sign in" }).click();
  await expect(second.getByText("Welcome back, Linh!")).toBeVisible();
  await expect(second.getByText("Signed in as Linh")).toBeVisible();
  await ctx.close();
});

test("[UI-09] Wrong PIN message; the 5th wrong PIN shows the locked alert", async ({ page, browser }) => {
  const g = await seed.group("Ortiz Family");
  const owner = await browser.newPage();
  await joinAs(owner, g.display, "Luis", "1234");
  await owner.close();
  await page.goto(`/j/${g.display}/back`);
  await page.locator("#rname").click();
  await page.getByRole("option", { name: "Luis" }).click();
  for (let i = 0; i < 4; i++) {
    await typePin(page, "rpin", "0000");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByText("That name and PIN didn't match.", { exact: false })).toBeVisible();
  }
  await typePin(page, "rpin", "0000");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByText("Too many wrong PINs")).toBeVisible();
  await expect(page.getByText(/For safety, Luis is locked until/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Sign in" })).toBeDisabled();
});

test("[UI-10] Request a group → waiting → approved → moved in automatically", async ({ page }) => {
  await page.goto("/new");
  await page.getByLabel("Group name").fill("Bell Family");
  await page.getByLabel("Your name").fill("Ivy");
  await typePin(page, "npin", "8080");
  await typePin(page, "npin2", "8080");
  await page.getByRole("button", { name: "Send request" }).click();
  await expect(page.getByText("Waiting for approval")).toBeVisible();
  await expect(page.getByText('We\'ll move you into "Bell Family" as soon as it\'s approved.')).toBeVisible();
  // Coming back later on the same device also shows the waiting screen.
  await page.goto("/");
  await expect(page.getByText("Waiting for approval")).toBeVisible();
  await seed.approve(await seed.latestRequestId("Bell Family"));
  await page.getByRole("button", { name: "Check now" }).click();
  await expect(page).toHaveURL(/\/g\//);
  await expect(page.getByText('"Bell Family" is ready. Welcome!')).toBeVisible();
  await expect(page.getByText("Signed in as Ivy")).toBeVisible();
});

test("[UI-11] Declined request → message → 'Send a new request'", async ({ page }) => {
  await page.goto("/new");
  await page.getByLabel("Group name").fill("No Family");
  await page.getByLabel("Your name").fill("Max");
  await typePin(page, "npin", "1212");
  await typePin(page, "npin2", "1212");
  await page.getByRole("button", { name: "Send request" }).click();
  await expect(page.getByText("Waiting for approval")).toBeVisible();
  await seed.decline(await seed.latestRequestId("No Family"));
  await page.getByRole("button", { name: "Check now" }).click();
  await expect(page.getByText("Your request wasn't approved")).toBeVisible();
  await page.getByRole("button", { name: "Send a new request" }).click();
  await expect(page.getByRole("heading", { name: "Start a new group" })).toBeVisible();
});

test("[UI-12] 360 px wide: no sideways scrolling on any Section 1 screen", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 780 });
  const g = await seed.group("A Family With A Rather Long Name For Testing Wrap", ["Grandma Josephine", "Uncle Raymond"]);
  for (const path of ["/?add=1", `/j/${g.display}`, `/j/${g.display}/back`, "/j/ZZZZ-ZZZZ", "/new"]) {
    await page.goto(path);
    await page.waitForLoadState("networkidle");
    await expectNoSideScroll(page);
  }
});

test("[UI-14] Keyboard only: join with Tab and Enter; errors are announced", async ({ page }) => {
  const g = await seed.group("Keys Family");
  await page.goto(`/j/${g.display}`);
  await expect(page.getByRole("heading", { name: "Join Keys Family" })).toBeVisible();
  // Submitting empty announces an error (role=alert) and focuses the name box.
  await page.getByRole("button", { name: "Join Keys Family" }).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("alert").filter({ hasText: "Enter your name." })).toBeVisible();
  await expect(page.getByLabel("Your name")).toBeFocused();
  await page.keyboard.type("Kai");
  await page.keyboard.press("Tab");
  await page.keyboard.type("4242");
  await page.keyboard.press("Tab");
  await page.keyboard.type("4242");
  await page.keyboard.press("Enter");
  await expect(page.getByText("Signed in as Kai")).toBeVisible();
});
