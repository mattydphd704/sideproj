// PROTO-01..12: every prototype scenario, walked exactly as its card's steps describe.
// Catches scenario cards and screens drifting apart (TPM review round 2).
import { expect, test, type Page } from "@playwright/test";
import { resolve } from "node:path";

const FILE = `file://${resolve("dist/prototype/prototype-local.html")}`;

let page: Page;
test.beforeAll(async ({ browser }) => {
  page = await browser.newPage();
  await page.goto(FILE);
});
test.afterAll(async () => { await page.close(); });

const ph = () => page.locator(".proto-screen");
const open = async (id: string) => {
  await page.locator(".proto-list-btn", { hasText: id }).click();
  await expect(page.locator(".proto-stage-bar")).toContainText(id);
};
const pin = async (id: string, v: string) => { const i = ph().locator(`input#${id}`); await i.click(); await i.pressSequentially(v); };
const see = (t: string) => expect(ph().getByText(t, { exact: false }).first()).toBeVisible();
const newPerson = async (name: string, a = "4321", b = "4321") => {
  await ph().locator("#added").selectOption("__new__");
  await ph().getByLabel("Your name").fill(name);
  await pin("pin", a); await pin("pin2", b);
};
const join = () => ph().getByRole("button", { name: "Join Smith Family" }).click();

test("[PROTO-01] SC-01 Join from an invite link", async () => {
  await open("SC-01"); await see("Join Smith Family");
  await newPerson("Morgan"); await see("PINs match."); await join(); await see("Signed in as Morgan");
});
test("[PROTO-02] SC-02 Type a group code", async () => {
  await open("SC-02");
  await ph().getByLabel("Group code").fill("ABCD-EFGH"); await ph().getByRole("button", { name: "Continue" }).click(); await see("That group code didn't work");
  await ph().getByLabel("Group code").fill("smth2345"); await ph().getByRole("button", { name: "Continue" }).click(); await see("Join Smith Family");
  await newPerson("Pat"); await join(); await see("Signed in as Pat");
});
test("[PROTO-03] SC-03 Join under a name the organiser added", async () => {
  await open("SC-03");
  await expect(ph().locator("#added option")).toHaveText(["Choose your name", "Grandma", "Uncle Ray", "No, I'm new here"]);
  await ph().locator("#added").selectOption({ label: "Grandma" });
  await expect(ph().getByLabel("Your name")).toHaveCount(0);
  await pin("pin", "2468"); await pin("pin2", "2468"); await see("PINs match."); await join(); await see("Signed in as Grandma");
});
test("[PROTO-11] SC-11 Open an invite link when already in the group", async () => {
  await open("SC-11"); await see("You're already in Smith Family."); await see("Signed in as Sam");
});
test("[PROTO-04] SC-04 Name already taken, so sign back in", async () => {
  await open("SC-04"); await newPerson("Alex"); await join(); await see("Someone in this group already uses that name");
  await ph().getByRole("button", { name: "Sign back in", exact: true }).click(); await see("Welcome back to Smith Family");
  await ph().locator("#rname").selectOption("Alex"); await pin("rpin", "1234"); await ph().getByRole("button", { name: "Sign in" }).click();
  await see("Welcome back, Alex!");
});
test("[PROTO-05] SC-05 Sign back in on a new device, using the hint", async () => {
  await open("SC-05"); await ph().getByRole("button", { name: "Been here before? Sign back in" }).click();
  await ph().locator("#rname").selectOption("Jo"); await ph().getByRole("button", { name: "Show my hint" }).click(); await see("Your hint: the garden gate");
  await pin("rpin", "2580"); await ph().getByRole("button", { name: "Sign in" }).click(); await see("Welcome back, Jo!");
});
test("[PROTO-06] SC-06 Too many wrong PINs", async () => {
  await open("SC-06"); await ph().getByRole("button", { name: "Been here before? Sign back in" }).click();
  await ph().locator("#rname").selectOption("Sam");
  for (let i = 0; i < 4; i++) { await pin("rpin", "0000"); await ph().getByRole("button", { name: "Sign in" }).click(); await see("That name and PIN didn't match"); }
  await pin("rpin", "0000"); await ph().getByRole("button", { name: "Sign in" }).click();
  await see("Too many wrong PINs"); await expect(ph().getByRole("button", { name: "Sign in" })).toBeDisabled();
});
test("[PROTO-09] SC-09 Start a new group (approved)", async () => {
  await open("SC-09"); await ph().getByRole("button", { name: "Start a new group" }).click();
  await ph().getByLabel("Group name").fill("Garcia Family"); await ph().getByLabel("Your name").fill("Rosa");
  await pin("npin", "1357"); await pin("npin2", "1357"); await see("PINs match.");
  await ph().getByRole("button", { name: "Send request" }).click(); await see("Waiting for approval");
  await page.getByRole("button", { name: "Approve request" }).click();
  await ph().getByRole("button", { name: "Check now" }).click(); await see("Signed in as Rosa");
});
test("[PROTO-10] SC-10 Start a new group (declined)", async () => {
  await open("SC-10"); await ph().getByRole("button", { name: "Start a new group" }).click();
  await ph().getByLabel("Group name").fill("Max's Mates"); await ph().getByLabel("Your name").fill("Max");
  await pin("npin", "2222"); await pin("npin2", "2222"); await ph().getByRole("button", { name: "Send request" }).click(); await see("Waiting for approval");
  await page.getByRole("button", { name: "Decline request" }).click();
  await ph().getByRole("button", { name: "Check now" }).click(); await see("Your request wasn't approved");
  await ph().getByRole("button", { name: "Send a new request" }).click(); await see("Start a new group");
});
test("[PROTO-07] SC-07 PIN typo while joining", async () => {
  await open("SC-07"); await newPerson("Robin", "1234", "9999");
  await see("The two PINs don't match. Try again.");
  for (let i = 0; i < 4; i++) await ph().locator("input#pin2").press("Backspace");
  await ph().locator("input#pin2").pressSequentially("1234"); await see("PINs match.");
});
test("[PROTO-08] SC-08 Broken invite link", async () => {
  await open("SC-08"); await see("This invite didn't work");
  await ph().getByRole("button", { name: "Enter a code" }).click();
  await ph().getByLabel("Group code").fill("SMTH-2345"); await ph().getByRole("button", { name: "Continue" }).click(); await see("Join Smith Family");
});
test("[PROTO-12] SC-12 Too many attempts from one network", async () => {
  await open("SC-12"); await ph().getByLabel("Group code").fill("ABCD-EFGH"); await ph().getByRole("button", { name: "Continue" }).click();
  await see("Too many attempts"); await expect(ph().getByRole("button", { name: "Continue" })).toBeDisabled();
});
test("[PROTO-00] every scenario card uses the shared group data and opens its start screen", async () => {
  const buttons = page.locator(".proto-list-btn");
  await expect(buttons).toHaveCount(12);
  for (let i = 0; i < 12; i++) {
    await buttons.nth(i).click();
    await expect(page.locator(".proto-side")).toContainText("How they arrive");
    await expect(page.locator(".proto-side")).toContainText("This browser");
    await expect(ph().locator("main")).toBeVisible();
  }
});

test("[PROTO-13] \"Works as expected\" puts a green check on the scenario and counts it", async () => {
  await open("SC-08");
  await page.getByRole("button", { name: "Works as expected" }).click();
  const btn = page.locator(".proto-list-btn", { hasText: "SC-08" });
  await expect(btn.getByLabel("Works as expected")).toBeVisible();
  await expect(page.locator(".proto-progress")).toContainText("1 of 12 working");
  await expect(page.locator(".proto-passed")).toContainText("Works as expected");
  await page.getByRole("button", { name: "Needs changes" }).click();
  await expect(btn.getByLabel("Works as expected")).toHaveCount(0);
  await expect(btn).toContainText("Fix");
});

test("[PROTO-14] A global change on the Join screen appears in every scenario that shows Join, and only those", async () => {
  await open("SC-01");
  await page.getByRole("button", { name: "Global change" }).click();
  await expect(page.locator("#flag-scope-screen")).toBeChecked();
  await expect(page.locator(".proto-card-active")).toContainText("SC-01, SC-02, SC-03, SC-11, SC-04, SC-05, SC-06, SC-07, SC-08");
  await page.locator("#flag-note").fill("All error text should be bold");
  await page.getByRole("button", { name: "Save global change" }).click();
  for (const id of ["SC-03", "SC-07", "SC-05"]) {
    await open(id);
    await expect(page.locator(".proto-side")).toContainText("All error text should be bold");
  }
  for (const id of ["SC-12", "SC-09"]) {
    await open(id);
    await expect(page.locator(".proto-side")).not.toContainText("All error text should be bold");
  }
  // A scenario-only flag stays in its own scenario.
  await open("SC-02");
  await page.getByRole("button", { name: "Flag something" }).click();
  await ph().getByLabel("Group code").click();
  await page.locator("#flag-note").fill("Only for SC-02");
  await page.getByRole("button", { name: "Save flag" }).click();
  await open("SC-01");
  await expect(page.locator(".proto-side")).not.toContainText("Only for SC-02");
});
