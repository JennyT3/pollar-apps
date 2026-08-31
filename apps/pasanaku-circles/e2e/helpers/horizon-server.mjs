import http from "node:http";

const PORT = Number(process.env.MOCK_HORIZON_PORT ?? 9876);
const canned = new Map();

function send(res, status, body) {
  const json = JSON.stringify(body);
  res.writeHead(status, {
    "content-type": "application/json",
    "content-length": Buffer.byteLength(json),
  });
  res.end(json);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}"));
      } catch (err) {
        reject(err);
      }
    });
    req.on("error", reject);
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", `http://127.0.0.1:${PORT}`);

  if (req.method === "GET" && url.pathname === "/health") {
    send(res, 200, { ok: true });
    return;
  }

  if (req.method === "PUT" && url.pathname === "/__set") {
    const body = await readBody(req);
    canned.set(body.hash, body);
    send(res, 200, { ok: true });
    return;
  }

  const ops = url.pathname.match(/^\/transactions\/([^/]+)\/operations$/);
  if (req.method === "GET" && ops) {
    const row = canned.get(ops[1]);
    if (!row) {
      send(res, 404, { detail: "not found" });
      return;
    }
    send(res, 200, { _embedded: { records: row.ops ?? [] } });
    return;
  }

  const tx = url.pathname.match(/^\/transactions\/([^/]+)$/);
  if (req.method === "GET" && tx) {
    const row = canned.get(tx[1]);
    if (!row) {
      send(res, 404, { detail: "not found" });
      return;
    }
    send(res, 200, {
      successful: row.successful ?? true,
      memo: row.memo ?? null,
      memo_type: row.memoType ?? null,
    });
    return;
  }

  send(res, 404, { detail: "not found" });
});

server.listen(PORT, "127.0.0.1", () => {
  process.stdout.write(`mock horizon on 127.0.0.1:${PORT}\n`);
});
