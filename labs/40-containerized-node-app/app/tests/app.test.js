import test from "node:test";
import assert from "node:assert";
import { buildApp } from "../app/app.js";

const createMockPg = (rows = []) => ({
  async query(sql) {
    // Keep the mock simple—just return the provided rows.
    assert.match(sql, /SELECT \* FROM quotes/);
    return { rows };
  },
});

test("GET / renvoie la page avec les citations", async (t) => {
  const mockQuotes = [
    { author: "Ada Lovelace", text: "L'imagination compte plus que la connaissance." },
    { author: "Alan Turing", text: "Nous ne pouvons voir qu'un peu du futur, mais assez pour savoir qu'il y a beaucoup à faire." },
  ];

  const app = await buildApp({ logger: false, pgClient: createMockPg(mockQuotes) });
  t.after(() => app.close());

  const response = await app.inject({ method: "GET", url: "/" });

  assert.strictEqual(response.statusCode, 200);
  assert.match(response.headers["content-type"], /text\/html/);
  assert.match(response.body, /QuoteBoard/);
  assert.match(response.body, /Ada Lovelace/);
  assert.match(response.body, /Alan Turing/);
});

test("GET /health renvoie ok", async (t) => {
  const app = await buildApp({
    logger: false,
    // No DB interaction on /health, so we keep a minimal mock.
    pgClient: { async query() { return { rows: [] }; } },
  });
  t.after(() => app.close());

  const response = await app.inject({ method: "GET", url: "/health" });

  assert.strictEqual(response.statusCode, 200);
  assert.deepStrictEqual(JSON.parse(response.body), { ok: true });
});