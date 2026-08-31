import fs from "node:fs";
import path from "node:path";
import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { A, B, C, setHorizon } from "./helpers/horizon";

const OUT = path.join(process.cwd(), "docs/screenshots");

type CircleView = {
  code: string;
  name: string;
  amount: string;
  status: string;
  currentRound: number;
  recipient: string | null;
  members: { address: string; paid: boolean }[];
};

async function createDemoCircle(request: APIRequestContext) {
  const res = await request.post("/api/circles", {
    data: {
      name: "Familia La Paz",
      amount: "10",
      frequency: "weekly",
      organizerAddress: A,
    },
  });
  const body = await res.json();
  expect(res.ok(), JSON.stringify(body)).toBeTruthy();
  const code = body.code as string;
  expect(await request.post(`/api/circles/${code}/join`, { data: { address: B } })).toBeOK();
  expect(await request.post(`/api/circles/${code}/join`, { data: { address: C } })).toBeOK();
  return code;
}

async function getCircle(request: APIRequestContext, code: string): Promise<CircleView> {
  const res = await request.get(`/api/circles/${code}`);
  expect(res.ok()).toBeTruthy();
  return res.json();
}

async function payAs(request: APIRequestContext, code: string, payer: string, hash: string) {
  const circle = await getCircle(request, code);
  expect(circle.recipient).toBeTruthy();
  const memo = await (
    await request.get(`/api/circles/${code}/memo?payer=${payer}`)
  ).json();
  await setHorizon(hash, {
    from: payer,
    to: circle.recipient as string,
    amount: circle.amount,
    memo: memo.memoId,
  });
  const paid = await request.post(`/api/circles/${code}/pay`, {
    data: { hash, payer },
  });
  expect(paid.ok(), await paid.text()).toBeTruthy();
}

async function payRound(request: APIRequestContext, code: string, tag: string) {
  const circle = await getCircle(request, code);
  const payers = circle.members
    .filter((m) => m.address !== circle.recipient && !m.paid)
    .map((m) => m.address);
  for (const [i, payer] of payers.entries()) {
    await payAs(request, code, payer, `${tag}-${i}-${Date.now()}`);
  }
}

async function hideDevOverlay(page: Page) {
  await page.addStyleTag({
    content: "nextjs-portal,[data-nextjs-toast]{display:none!important}",
  });
}

async function shot(page: Page, viewport: "mobile" | "desktop", name: string) {
  await page.setViewportSize(
    viewport === "mobile"
      ? { width: 390, height: 844 }
      : { width: 1280, height: 900 }
  );
  await hideDevOverlay(page);
  await page.waitForTimeout(200);
  const dir = path.join(OUT, viewport);
  fs.mkdirSync(dir, { recursive: true });
  await page.screenshot({
    path: path.join(dir, `${name}.png`),
    fullPage: true,
  });
}

async function shotLocator(
  page: Page,
  viewport: "mobile" | "desktop",
  name: string,
  locator: ReturnType<Page["locator"]>
) {
  await page.setViewportSize(
    viewport === "mobile"
      ? { width: 390, height: 844 }
      : { width: 1280, height: 900 }
  );
  await hideDevOverlay(page);
  await page.waitForTimeout(200);
  const dir = path.join(OUT, viewport);
  fs.mkdirSync(dir, { recursive: true });
  await locator.screenshot({ path: path.join(dir, `${name}.png`) });
}

async function shotBoth(page: Page, name: string) {
  await shot(page, "mobile", name);
  await shot(page, "desktop", name);
}

test("capture the product flow for the pull request", async ({ page }) => {
  test.setTimeout(120_000);
  const request = page.request;

  await page.goto("/");
  await expect(page.getByRole("heading", { name: /pasanaku digital/i })).toBeVisible();
  await shotBoth(page, "01-home");

  await page.getByText(/en bolivia es pasanaku/i).click();
  await expect(page.getByText("México:")).toBeVisible();
  await shotBoth(page, "02-home-nombres-regionales");

  await page.goto("/c/new");
  await expect(page.getByRole("heading", { name: /crear círculo/i })).toBeVisible();
  await page.getByRole("textbox").first().fill("Familia La Paz");
  await shotBoth(page, "03-crear-circulo");

  const to = A;
  await page.goto(`/spike?to=${to}&amount=1`);
  await expect(page.getByAltText(/qr de pago/i)).toBeVisible();
  await shotBoth(page, "04-spike-qr");

  const code = await createDemoCircle(request);

  await page.goto(`/c/${code}/join`);
  await expect(page.getByRole("heading", { name: /unirse/i })).toBeVisible();
  await shotBoth(page, "05-unirse");

  await page.goto(`/c/${code}/qr`);
  await expect(page.getByAltText(/qr para pagar/i)).toBeVisible();
  await expect(page.getByAltText(/qr para unirse/i)).toBeVisible();
  await shotBoth(page, "06-qrs-join-y-pago");

  await page.goto(`/c/${code}`);
  await expect(page.getByRole("heading", { name: "Familia La Paz" })).toBeVisible();
  await expect(page.getByText(/le toca/i).first()).toBeVisible();
  await expect(page.getByRole("heading", { name: /orden de turnos/i })).toBeVisible();
  await shotBoth(page, "07-dashboard-abierto-turnos");

  await page.goto(`/c/${code}/pay`);
  await expect(page.getByRole("heading", { name: /pagar la ronda/i })).toBeVisible();
  await shotBoth(page, "08-pagar-ronda");

  const open = await getCircle(request, code);
  const firstPayer = open.members
    .map((m) => m.address)
    .find((address) => address !== open.recipient) as string;
  await payAs(request, code, firstPayer, `shot-first-${Date.now()}`);
  await page.goto(`/c/${code}`);
  await expect(page.getByText("Pagó")).toBeVisible();
  await expect(page.getByText("Debe")).toBeVisible();
  await expect(page.getByText("Le toca")).toBeVisible();
  await shotBoth(page, "09-dashboard-ronda-en-curso");
  await expect(page.getByText(/paga/i).first()).toBeVisible();
  const history = page.getByRole("heading", { name: "Historial" }).locator("..");
  await shotLocator(page, "mobile", "10-historial", history);
  await shotLocator(page, "desktop", "10-historial", history);

  await payRound(request, code, "shot-r1");
  await payRound(request, code, "shot-r2");
  await payRound(request, code, "shot-r3");
  await page.goto(`/c/${code}`);
  await expect(page.getByText(/círculo cerrado/i).first()).toBeVisible();
  await shotBoth(page, "11-dashboard-cerrado");

  for (const viewport of ["mobile", "desktop"] as const) {
    for (let i = 1; i <= 11; i += 1) {
      const prefix = String(i).padStart(2, "0");
      const matches = fs
        .readdirSync(path.join(OUT, viewport))
        .filter((file) => file.startsWith(prefix));
      expect(matches.length, `${viewport}/${prefix}`).toBe(1);
    }
  }
});
