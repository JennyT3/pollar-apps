import { expect, test } from "@playwright/test";

test("home explains pasanaku and regional names", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /pasanaku digital/i })).toBeVisible();
  await expect(page.getByText(/en bolivia es pasanaku/i)).toBeVisible();
  await page.getByText(/en bolivia es pasanaku/i).click();
  await expect(page.getByText("México:")).toBeVisible();
  await expect(page.getByText(/tanda/i).first()).toBeVisible();
});

test("spike hydrates recipient and amount from the query string", async ({ page }) => {
  const to = "G" + "A".repeat(55);
  await page.goto(`/spike?to=${to}&amount=1`);
  await expect(page.getByLabel(/destinatario/i)).toHaveValue(to);
  await expect(page.getByLabel(/monto/i)).toHaveValue("1");
  await expect(page.getByAltText(/qr de pago/i)).toBeVisible();
});
