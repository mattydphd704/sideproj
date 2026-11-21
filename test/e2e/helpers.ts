import { expect, type Page } from "@playwright/test";

/** Value of the "No, I'm new here" option in "Have you already been added?". */
export const NEW_PERSON = "__new__";

/** Types a PIN into an InputOTP field (one box per digit). */
export async function typePin(page: Page, id: string, pin: string) {
  const input = page.locator(`input#${id}`);
  await input.click();
  await input.pressSequentially(pin);
}

export async function joinAs(page: Page, code: string, name: string, pin = "1234") {
  await page.goto(`/j/${code}`);
  await page.locator("#added").selectOption(NEW_PERSON); // GR-2: answer "Have you already been added?" first
  await page.getByLabel("Your name").fill(name);
  await typePin(page, "pin", pin);
  await typePin(page, "pin2", pin);
  await page.getByRole("button", { name: /^Join / }).click();
  await expect(page).toHaveURL(/\/g\//);
}

/** NFR-1: no sideways scrolling. */
export async function expectNoSideScroll(page: Page) {
  const { sw, cw } = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
  expect(sw, `sideways scroll on ${page.url()}`).toBeLessThanOrEqual(cw);
}
