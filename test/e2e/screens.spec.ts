// Review screenshots for the TPM: every Section 1 screen and state, at phone size.
// Run: npx playwright test --project=screens   → docs/screens/section-1/*.png
import { expect, test, type Page } from "@playwright/test";
import { seed } from "./seed";
import { joinAs, typePin } from "./helpers";

const DIR = "docs/screens/section-1";
const shot = async (page: Page, name: string) => {
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(400); // let toasts and animations settle
  await page.screenshot({ path: `${DIR}/${name}.png`, fullPage: true });
};

test.beforeEach(async () => { await seed.clearRateLimits(); });

test("Section 1 screens", async ({ page, browser }) => {
  const g = await seed.group("Smith Family", ["Grandma", "Uncle Ray"]);
  for (const [n, p] of [["Sam", "1234"], ["Alex", "1234"], ["Jo", "1234"], ["Pat", "1234"], ["Lee", "1234"]] as const) {
    const ctx = await browser.newContext(); const pg = await ctx.newPage();
    await pg.goto(`/j/${g.display}`);
    await pg.getByLabel("Your name").fill(n);
    await typePin(pg, "pin", p); await typePin(pg, "pin2", p);
    if (n === "Alex") await pg.getByLabel("PIN hint (optional)").fill("the garden gate");
    await pg.getByRole("button", { name: /^Join / }).click();
    await expect(pg).toHaveURL(/\/g\//);
    await ctx.close();
  }

  // §1.1 Home
  await page.goto("/");
  await shot(page, "01-home");
  await page.getByLabel("Group code").fill("ZZZZ-ZZZZ");
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByText("That group code didn't work.", { exact: false })).toBeVisible();
  await shot(page, "02-home-code-didnt-work");

  // §1.2 Join
  await page.goto(`/j/${g.display}`);
  await expect(page.getByRole("heading", { name: "Join Smith Family" })).toBeVisible();
  await shot(page, "03-join");
  await page.getByLabel("Have you already been added?").click();
  await shot(page, "04a-join-added-dropdown-open");
  await page.getByRole("option", { name: "Grandma" }).click();
  await typePin(page, "pin", "2468");
  await shot(page, "04b-join-picked-pre-added-name");
  await page.goto(`/j/${g.display}`);
  await page.getByLabel("Have you already been added?").click();
  await page.getByRole("option", { name: "No, I'm new here" }).click();
  await page.getByLabel("Your name").fill("Sam");
  await typePin(page, "pin", "1234"); await typePin(page, "pin2", "1234");
  await page.getByRole("button", { name: "Join Smith Family" }).click();
  await expect(page.getByText("Someone in this group already uses that name.", { exact: false })).toBeVisible();
  await shot(page, "05-join-name-taken");
  await page.getByLabel("Your name").fill("Robin");
  await typePin(page, "pin", "1234"); await typePin(page, "pin2", "9999");
  await page.getByRole("button", { name: "Join Smith Family" }).click();
  await expect(page.getByText("The two PINs don't match.", { exact: false })).toBeVisible();
  await shot(page, "06-join-pins-dont-match");
  await page.goto("/j/ZZZZ-ZZZZ");
  await expect(page.getByText("This invite didn't work")).toBeVisible();
  await shot(page, "07-invite-didnt-work");

  // §1.3 Sign back in
  await page.goto(`/j/${g.display}/back`);
  await expect(page.getByRole("heading", { name: "Welcome back to Smith Family" })).toBeVisible();
  await shot(page, "08-sign-back-in");
  await page.locator("#rname").click();
  await shot(page, "09-sign-back-in-choose-name");
  await page.getByRole("option", { name: "Alex" }).click();
  await page.getByRole("button", { name: "Show my hint" }).click();
  await expect(page.getByText("Your hint: the garden gate")).toBeVisible();
  await shot(page, "09b-sign-back-in-hint-shown");
  await typePin(page, "rpin", "0000");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByText("That name and PIN didn't match.", { exact: false })).toBeVisible();
  await shot(page, "10-sign-back-in-wrong-pin");
  for (let i = 0; i < 4; i++) { await typePin(page, "rpin", "0000"); await page.getByRole("button", { name: "Sign in" }).click(); await page.waitForTimeout(300); }
  await expect(page.getByText("Too many wrong PINs")).toBeVisible();
  await shot(page, "11-sign-back-in-locked");

  // Inside the group (temporary placeholder) with the welcome toast.
  // (The steps above use up the 30-per-hour attempts on this one code, so reset the counters.)
  await seed.clearRateLimits();
  const ctx = await browser.newContext({ ...test.info().project.use });
  const fresh = await ctx.newPage();
  await fresh.goto(`/j/${g.display}`);
  await fresh.getByLabel("Your name").fill("Morgan");
  await typePin(fresh, "pin", "2468"); await typePin(fresh, "pin2", "2468");
  await fresh.getByRole("button", { name: "Join Smith Family" }).click();
  await expect(fresh.getByText("Welcome to Smith Family!")).toBeVisible();
  await shot(fresh, "12-inside-group-placeholder");
  await ctx.close();

  // §1.4 Start a group
  const ctx2 = await browser.newContext({ ...test.info().project.use });
  const req = await ctx2.newPage();
  await req.goto("/new");
  await expect(req.getByRole("heading", { name: "Start a new group" })).toBeVisible();
  await shot(req, "13-start-a-group");
  await req.getByLabel("Group name").fill("Garcia Family");
  await req.getByLabel("Your name").fill("Rosa");
  await typePin(req, "npin", "1357"); await typePin(req, "npin2", "1357");
  await req.getByRole("button", { name: "Send request" }).click();
  await expect(req.getByText("Waiting for approval")).toBeVisible();
  await shot(req, "14-waiting-for-approval");
  await seed.decline(await seed.latestRequestId("Garcia Family"));
  await req.getByRole("button", { name: "Check now" }).click();
  await expect(req.getByText("Your request wasn't approved")).toBeVisible();
  await shot(req, "15-request-declined");
  await ctx2.close();

  // S-03 rate limited
  await seed.clearRateLimits();
  await page.goto("/?add=1");
  for (let i = 0; i < 11; i++) { await page.getByLabel("Group code").fill("ZZZZ-ZZZZ"); await page.getByRole("button", { name: "Continue" }).click(); await page.waitForTimeout(150); }
  await expect(page.getByText(/Too many attempts/)).toBeVisible();
  await shot(page, "16-rate-limited");

  // Dark mode (follows the phone's setting, G23)
  await seed.clearRateLimits();
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/?add=1");
  await shot(page, "17-home-dark");
  await page.goto(`/j/${g.display}`);
  await expect(page.getByRole("heading", { name: "Join Smith Family" })).toBeVisible();
  await shot(page, "18-join-dark");
});
