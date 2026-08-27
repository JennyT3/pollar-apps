import { expect, test, type APIRequestContext } from "@playwright/test";

const A = "G" + "A".repeat(55);
const B = "G" + "B".repeat(55);
const C = "G" + "C".repeat(55);
const D = "G" + "D".repeat(55);
const USDC_ISSUER =
  "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AT7L7TXMV4L";
const HORIZON = "http://127.0.0.1:9876";

async function setHorizon(
  hash: string,
  input: {
    from: string;
    to: string;
    amount: string;
    memo: string | null;
    memoType?: string | null;
    assetType?: string;
    assetCode?: string;
    assetIssuer?: string | null;
    opType?: string;
  }
) {
  const op = {
    type: input.opType ?? "payment",
    from: input.from,
    to: input.to,
    amount: input.amount,
    asset_type: input.assetType ?? "credit_alphanum4",
    asset_code: input.assetCode ?? "USDC",
    asset_issuer: input.assetIssuer ?? USDC_ISSUER,
  };
  const res = await fetch(`${HORIZON}/__set`, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      hash,
      successful: true,
      memo: input.memo,
      memoType: input.memoType ?? (input.memo ? "id" : null),
      ops: [op],
    }),
  });
  expect(res.ok).toBeTruthy();
}

async function createCircle(request: APIRequestContext, amount = "10") {
  const res = await request.post("/api/circles", {
    data: {
      name: `e2e-${Date.now()}`,
      amount,
      frequency: "weekly",
      organizerAddress: A,
    },
  });
  const body = await res.json();
  expect(res.ok(), JSON.stringify(body)).toBeTruthy();
  expect(body.code, JSON.stringify(body)).toBeTruthy();
  return body.code as string;
}

test("create join shuffle pay and reject xlm", async ({ request }) => {
  const code = await createCircle(request);
  expect(await request.post(`/api/circles/${code}/join`, { data: { address: B } })).toBeOK();
  expect(await request.post(`/api/circles/${code}/join`, { data: { address: C } })).toBeOK();

  const shuffled = await request.post(`/api/circles/${code}/turns`, {
    data: { shuffle: true },
  });
  expect(shuffled.ok(), await shuffled.text()).toBeTruthy();

  const view = await (await request.get(`/api/circles/${code}`)).json();
  expect(view.status).toBe("open");
  expect(view.members).toHaveLength(3);
  expect(view.history).toEqual([]);

  const recipient = view.recipient as string;
  const payer = view.members.find((m: { address: string }) => m.address !== recipient)
    .address as string;

  const memo = await (
    await request.get(`/api/circles/${code}/memo?payer=${payer}`)
  ).json();
  expect(memo.recipient).toBe(recipient);
  expect(memo.amount).toBe("10");

  const suffix = `${Date.now()}`;
  await setHorizon(`e2e-xlm-${suffix}`, {
    from: payer,
    to: recipient,
    amount: "10",
    memo: memo.memoId,
    assetType: "native",
    assetCode: "XLM",
    assetIssuer: null,
  });
  const xlm = await request.post(`/api/circles/${code}/pay`, {
    data: { hash: `e2e-xlm-${suffix}`, payer },
  });
  expect(xlm.status()).toBe(400);
  expect(JSON.stringify(await xlm.json())).toMatch(/xlm|asset|native|usdc/i);
  const stillOpen = await (await request.get(`/api/circles/${code}`)).json();
  expect(stillOpen.history).toHaveLength(0);

  await setHorizon(`e2e-usdc-${suffix}`, {
    from: payer,
    to: recipient,
    amount: "10",
    memo: memo.memoId,
  });
  const paid = await request.post(`/api/circles/${code}/pay`, {
    data: { hash: `e2e-usdc-${suffix}`, payer },
  });
  expect(paid.ok(), await paid.text()).toBeTruthy();

  const after = await (await request.get(`/api/circles/${code}`)).json();
  expect(after.status).toBe("active");
  expect(after.history).toHaveLength(1);
  expect(after.history[0].payer).toBe(payer);
  expect(after.history[0].recipient).toBe(recipient);
  expect(after.history[0].createdAt).toBeGreaterThan(0);

  const joinLate = await request.post(`/api/circles/${code}/join`, {
    data: { address: D },
  });
  expect(joinLate.status()).toBe(400);

  const selfPay = await request.post(`/api/circles/${code}/pay`, {
    data: { hash: "e2e-self", payer: recipient },
  });
  expect(selfPay.status()).toBe(400);
});
