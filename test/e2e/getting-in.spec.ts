// Section 1, Getting in: UI-01 to UI-14 (UI_INTERACTION_MAPS §1.7).
import { expect, test } from "@playwright/test";
import { seed } from "./seed";
import { NEW_PERSON, expectNoSideScroll, joinAs, typePin } from "./helpers";

test.beforeEach(async () => { await seed.clearRateLimits(); });

test("[UI-01] Home: a valid code opens the Join screen with the group name @desktop", async ({ page }) => {
  const g = await seed.group("Lee Family");
  await page.goto("/");
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

test("[UI-05] Choosing a pre-added name in the dropdown joins as that person", async ({ page }) => {
  const g = await seed.group("Kim Family", ["Grandma", "Uncle Ray"]);
  await page.goto(`/j/${g.display}`);
  await page.locator("#added").selectOption({ label: "Grandma" });
  await expect(page.getByLabel("Your name")).toHaveCount(0); // no name box once a listed name is chosen
  await typePin(page, "pin", "2468");
  await typePin(page, "pin2", "2468");
  await page.getByRole("button", { name: "Join Kim Family" }).click();
  await expect(page.getByText("Signed in as Grandma")).toBeVisible();
});

test("[UI-06] A new person typing a name already in the group is asked \"Is that you?\"; Yes leads to their PIN", async ({ page, browser }) => {
  const g = await seed.group("Chen Family");
  const other = await browser.newPage();
  await joinAs(other, g.display, "Wei", "2468");
  await other.close();
  await page.goto(`/j/${g.display}`);
  await page.locator("#added").selectOption(NEW_PERSON);
  await page.getByLabel("Your name").fill("wei");
  await page.getByLabel("Your name").blur();
  await expect(page.getByText("There's already someone called Wei in Chen Family. Is that you?")).toBeVisible();
  await page.getByRole("button", { name: "Yes, that's me" }).click();
  await expect(page.locator("#added")).toHaveValue("Wei");
  await typePin(page, "spin", "2468");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByText("Welcome back, Wei!")).toBeVisible();
});

test("[UI-07] PINs that don't match are caught before sending", async ({ page }) => {
  const g = await seed.group("Ross Family");
  await page.goto(`/j/${g.display}`);
  await page.getByLabel("Your name").fill("Jo");
  await typePin(page, "pin", "1234");
  await typePin(page, "pin2", "4321");
  // GR-3: shown the moment the 4th number is typed, before tapping Join.
  await expect(page.getByText("The two PINs don't match. Try again.")).toBeVisible();
  await page.getByRole("button", { name: "Join Ross Family" }).click();
  await expect(page).toHaveURL(/\/j\//);
  await expect(page.locator("input#pin2")).toBeFocused();
});

test("[UI-08] Sign back in on a second browser by choosing your own name", async ({ page, browser }) => {
  const g = await seed.group("Nguyen Family");
  await joinAs(page, g.display, "Linh", "5555");
  const ctx = await browser.newContext();
  const second = await ctx.newPage();
  await second.goto(`/j/${g.display}`);
  await second.locator("#added").selectOption("Linh");
  await expect(second.getByLabel("Create a PIN", { exact: false })).toHaveCount(0); // signed in before: no new PIN
  await typePin(second, "spin", "5555");
  await second.getByRole("button", { name: "Sign in" }).click();
  await expect(second.getByText("Welcome back, Linh!")).toBeVisible();
  await expect(second.getByText("Signed in as Linh")).toBeVisible();
  await ctx.close();
});

test("[UI-09] Wrong PIN shows the message and two help buttons; the 5th wrong PIN locks the name", async ({ page, browser }) => {
  const g = await seed.group("Ortiz Family");
  const owner = await browser.newPage();
  await joinAs(owner, g.display, "Luis", "1234");
  await owner.close();
  await page.goto(`/j/${g.display}`);
  await page.locator("#added").selectOption("Luis");
  for (let i = 0; i < 4; i++) {
    await typePin(page, "spin", "0000");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByText("That PIN didn't match.", { exact: false })).toBeVisible();
  }
  await expect(page.getByRole("button", { name: "I don't have a PIN yet" })).toBeVisible();
  await expect(page.getByRole("button", { name: "I can't remember my PIN" })).toBeVisible();
  await typePin(page, "spin", "0000");
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

test("[UI-15] The dropdown lists everyone in the group; joined names lead to Enter your PIN, added names to Create a PIN (round 3)", async ({ page, browser }) => {
  const g = await seed.group("Wu Family", ["Nana", "Pop"]);
  const other = await (await browser.newContext()).newPage();
  await joinAs(other, g.display, "Dad", "1357");
  await page.goto(`/j/${g.display}`);
  await expect(page.locator("#added option")).toHaveText(["Choose your name", "Dad", "Nana", "Pop", "No, I'm new here"]);
  await page.locator("#added").selectOption("Dad");
  await expect(page.locator("input#spin")).toBeVisible();
  await expect(page.locator("input#pin")).toHaveCount(0);
  await page.locator("#added").selectOption("Nana");
  await expect(page.locator("input#pin")).toBeVisible();
  await expect(page.locator("input#spin")).toHaveCount(0);
  // A group with nobody in it: the question still shows, with "No, I'm new here" already chosen (GR-2, G32).
  await seed.clearRateLimits();
  const g2 = await seed.group("Solo Family");
  await page.goto(`/j/${g2.display}`);
  await expect(page.locator("#added")).toHaveValue(NEW_PERSON);
  await expect(page.getByLabel("Your name")).toBeVisible();
});

test("[UI-16] PIN boxes: exactly 4, numbers visible as typed", async ({ page }) => {
  const g = await seed.group("Digit Family");
  await page.goto(`/j/${g.display}`);
  await typePin(page, "pin", "7391");
  const slots = page.locator('[data-slot="input-otp-group"]').first().locator('[data-slot="input-otp-slot"]');
  await expect(slots).toHaveCount(4);
  await expect(slots).toHaveText(["7", "3", "9", "1"]);
});

test("[UI-17] PIN hint: can't contain the PIN; \"Show my hint\" after choosing your name", async ({ page, browser }) => {
  const g = await seed.group("Hint Family");
  await page.goto(`/j/${g.display}`);
  await page.getByLabel("Your name").fill("Rae");
  await typePin(page, "pin", "2580"); await typePin(page, "pin2", "2580");
  await page.getByLabel("PIN hint (optional)").fill("it is 2580");
  await expect(page.getByText("Your hint can't include your PIN.")).toBeVisible();
  await page.getByLabel("PIN hint (optional)").fill("the blue door");
  await page.getByRole("button", { name: "Join Hint Family" }).click();
  await expect(page).toHaveURL(/\/g\//);
  const nohint = await (await browser.newContext()).newPage();
  await joinAs(nohint, g.display, "Ben");
  const second = await (await browser.newContext()).newPage();
  await second.goto(`/j/${g.display}`);
  await second.locator("#added").selectOption("Rae");
  await second.getByRole("button", { name: "Show my hint" }).click();
  await expect(second.getByText("Your hint: the blue door")).toBeVisible();
  await second.locator("#added").selectOption("Ben");
  await second.getByRole("button", { name: "Show my hint" }).click();
  await expect(second.getByText("You didn't set a hint.")).toBeVisible();
});

test("[UI-18] Home has no heading, intro or card title (review round 1) @desktop", async ({ page }) => {
  await page.goto("/?add=1");
  await expect(page.getByLabel("Group code")).toBeVisible();
  await expect(page.getByText("Gift Lists", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Have a group code?")).toHaveCount(0);
  await expect(page.getByText("No accounts. No passwords.", { exact: false })).toHaveCount(0);
  await expect(page.locator("header")).toHaveCount(1); // header line kept for future use
});

test("[UI-19] PIN match is checked the moment the 4th number is typed, on Join and Start a group (GR-3)", async ({ page }) => {
  const g = await seed.group("Live Family");
  await page.goto(`/j/${g.display}`);
  await typePin(page, "pin", "1234");
  await typePin(page, "pin2", "123");
  await expect(page.getByText("The two PINs don't match. Try again.")).toHaveCount(0);
  await page.locator("input#pin2").press("9");
  await expect(page.getByText("The two PINs don't match. Try again.")).toBeVisible();
  await page.locator("input#pin2").press("Backspace");
  await page.locator("input#pin2").press("4");
  await expect(page.getByText("PINs match.")).toBeVisible();
  await expect(page.getByText("The two PINs don't match. Try again.")).toHaveCount(0);
  await page.goto("/new");
  await typePin(page, "npin", "5555");
  await typePin(page, "npin2", "5556");
  await expect(page.getByText("The two PINs don't match. Try again.")).toBeVisible();
});

test("[UI-20] Join is answered in order: dropdown first, then name (new people only), then PIN block (GR-2)", async ({ page }) => {
  const g = await seed.group("Order Family", ["Aunt May"]);
  await page.goto(`/j/${g.display}`);
  await expect(page.getByLabel("Your name")).toHaveCount(0);
  await expect(page.locator("input#pin")).toHaveCount(0);
  await page.getByRole("button", { name: "Join Order Family" }).click();
  await expect(page.getByText(`Choose your name, or "No, I'm new here".`)).toBeVisible();
  await expect(page.locator("#added")).toBeFocused();
  await page.locator("#added").selectOption(NEW_PERSON);
  await expect(page.getByLabel("Your name")).toBeVisible();
  await expect(page.locator("input#pin")).toBeVisible();
  await page.locator("#added").selectOption({ label: "Aunt May" });
  await expect(page.getByLabel("Your name")).toHaveCount(0);
  await expect(page.locator("input#pin")).toBeVisible();
});

test("[UI-21] Every dropdown uses the phone's own picker (GR-4)", async ({ page }) => {
  const g = await seed.group("Picker Family", ["Kid"]);
  await page.goto(`/j/${g.display}`);
  expect(await page.locator("#added").evaluate((e) => e.tagName)).toBe("SELECT");
  await page.goto(`/j/${g.display}/back`); // old sign-in address opens the same Join screen
  expect(await page.locator("#added").evaluate((e) => e.tagName)).toBe("SELECT");
  await page.goto("/new");
  expect(await page.locator("#currency").evaluate((e) => e.tagName)).toBe("SELECT");
});


test("[UI-22] \"I don't have a PIN yet\" explains and switches to a new, distinguishing name (round 3)", async ({ page, browser }) => {
  const g = await seed.group("Twin Family");
  const first = await (await browser.newContext()).newPage();
  await joinAs(first, g.display, "Alex", "1234");
  await page.goto(`/j/${g.display}`);
  await page.locator("#added").selectOption("Alex");
  await typePin(page, "spin", "9999");
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.getByRole("button", { name: "I don't have a PIN yet" }).click();
  await expect(page.getByText(`Then you're probably a different Alex.`, { exact: false })).toBeVisible();
  await expect(page.getByText(`like "Alex B"`, { exact: false })).toBeVisible();
  await page.getByRole("button", { name: "Use a different name" }).click();
  await expect(page.locator("#added")).toHaveValue(NEW_PERSON);
  // Typing the same name again is refused with the suggestion.
  await page.getByLabel("Your name").fill("Alex");
  await page.getByLabel("Your name").blur();
  await expect(page.getByText(`Add something to tell you apart, like "Alex B".`)).toBeVisible();
  await page.getByLabel("Your name").fill("Alex B");
  await typePin(page, "pin", "4321"); await typePin(page, "pin2", "4321");
  await page.getByRole("button", { name: "Join Twin Family" }).click();
  await expect(page.getByText("Signed in as Alex B")).toBeVisible();
});

test("[UI-23] \"I can't remember my PIN\" shows the hint and says to ask the organiser (round 3)", async ({ page, browser }) => {
  const g = await seed.group("Memory Family");
  const first = await (await browser.newContext()).newPage();
  await first.goto(`/j/${g.display}`);
  await first.getByLabel("Your name").fill("Pat");
  await typePin(first, "pin", "1470"); await typePin(first, "pin2", "1470");
  await first.getByLabel("PIN hint (optional)").fill("kitchen drawer");
  await first.getByRole("button", { name: "Join Memory Family" }).click();
  await expect(first).toHaveURL(/\/g\//);
  await page.goto(`/j/${g.display}`);
  await page.locator("#added").selectOption("Pat");
  await typePin(page, "spin", "0000");
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.getByRole("button", { name: "I can't remember my PIN" }).click();
  await expect(page.getByText("Your hint: kitchen drawer")).toBeVisible();
  await expect(page.getByText("Forgot your PIN? Ask the group organiser to reset it.")).toBeVisible();
});

test("[UI-24] Dark mode: outline buttons have a visible surface and border (global flag, round 3)", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/?add=1");
  const btn = page.getByRole("button", { name: "Start a new group" });
  const { bg, border } = await btn.evaluate((e) => { const c = getComputedStyle(e); return { bg: c.backgroundColor, border: c.borderColor }; });
  const alpha = (c: string) => Number(c.match(/\/\s*([\d.]+)\)/)?.[1] ?? 1);
  expect(alpha(border)).toBeGreaterThanOrEqual(0.2);
  expect(alpha(bg)).toBeGreaterThan(0.03);
});
