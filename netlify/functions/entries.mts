import type { Context, Config } from "@netlify/functions";
import { getStore } from "@netlify/blobs";

const MAX_BODY_BYTES = 3 * 1024 * 1024;

function entriesStore() {
  return getStore("wedding-entries", { consistency: "strong" });
}

export default async (req: Request, context: Context) => {
  const store = entriesStore();

  if (req.method === "GET") {
    const { blobs } = await store.list({ prefix: "entry:" });
    const sortedKeys = blobs.map((b) => b.key).sort().reverse();
    const entries = [];
    for (const key of sortedKeys) {
      const value = await store.get(key, { type: "json" });
      if (value) entries.push(value);
    }
    return new Response(JSON.stringify({ entries }), {
      headers: { "content-type": "application/json" },
    });
  }

  if (req.method === "POST") {
    const raw = await req.text();
    if (raw.length > MAX_BODY_BYTES) {
      return new Response(JSON.stringify({ error: "Entrada demasiado grande" }), {
        status: 413,
        headers: { "content-type": "application/json" },
      });
    }
    let body;
    try {
      body = JSON.parse(raw);
    } catch (e) {
      return new Response(JSON.stringify({ error: "JSON inválido" }), {
        status: 400,
        headers: { "content-type": "application/json" },
      });
    }
    if (!body || typeof body !== "object" || !body.type) {
      return new Response(JSON.stringify({ error: "Falta el campo type" }), {
        status: 400,
        headers: { "content-type": "application/json" },
      });
    }

    const ts = Date.now();
    const key = "entry:" + ts + "-" + Math.random().toString(36).slice(2, 8);
    const entry = { ...body, ts };
    await store.setJSON(key, entry);

    return new Response(JSON.stringify({ ok: true, key }), {
      headers: { "content-type": "application/json" },
    });
  }

  return new Response("Method not allowed", { status: 405 });
};

export const config: Config = {
  path: "/api/entries",
};
