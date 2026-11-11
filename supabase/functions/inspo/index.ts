// Swipefile API. One function, a few routes:
//   POST   /save              share-sheet entry: multipart (file, text) or JSON {text}
//   GET    /items             library (q, tag, filter=all|starred|needs_image|archived, before)
//   GET    /tags              tag counts
//   GET    /today?date=       today's 5 (stable for the day)
//   POST   /items/:id/seen    mark as looked at
//   POST   /items/:id/image   attach a screenshot (for Instagram link cards)
//   POST   /items/:id/retag   run AI tags again
//   PATCH  /items/:id         {starred?, archived?, tags?}
//   DELETE /items/:id
//   GET    /health
// Every route needs the x-swipefile-key header.
import { createClient } from "npm:@supabase/supabase-js@2.119.0";
import { fetchOgImage, fetchTweet, imageSize, parseShared, safeFetch, sniffType } from "./sources.ts";
import { tagImages } from "./tagger.ts";

const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
  auth: { persistSession: false },
});
const KEY = Deno.env.get("INSPO_TOKEN") ?? "";
const BUCKET = "media";
const SIGN_SECONDS = 60 * 60 * 6;

const cors = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "content-type, x-swipefile-key",
  "access-control-allow-methods": "GET, POST, PATCH, DELETE, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "content-type": "application/json" } });
const fail = (status: number, error: string) => json({ error }, status);

type Img = { path: string; width?: number; height?: number };
type Item = Record<string, unknown> & { id: string; images: Img[] };

function safeEqual(a: string, b: string) {
  if (!a || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

// Background work keeps running after the response is sent, so the Shortcut returns fast.
function later(p: Promise<unknown>) {
  const rt = (globalThis as { EdgeRuntime?: { waitUntil(p: Promise<unknown>): void } }).EdgeRuntime;
  if (rt) rt.waitUntil(p);
  else p.catch(console.error);
}

// ---------- storage ----------

async function storeBytes(itemId: string, bytes: Uint8Array, hint?: { width?: number; height?: number }): Promise<Img | null> {
  const type = sniffType(bytes);
  if (!type) return null;
  const ext = type.split("/")[1].replace("jpeg", "jpg");
  const path = `${itemId}/${crypto.randomUUID()}.${ext}`;
  const { error } = await db.storage.from(BUCKET).upload(path, bytes, { contentType: type, upsert: false });
  if (error) throw error;
  const size = imageSize(bytes);
  return { path, width: size.width ?? hint?.width, height: size.height ?? hint?.height };
}

async function storeRemote(itemId: string, url: string, hint?: { width?: number; height?: number }) {
  const res = await safeFetch(url, { signal: AbortSignal.timeout(15000) });
  if (!res.ok) return null;
  return storeBytes(itemId, new Uint8Array(await res.arrayBuffer()), hint);
}

async function signed(items: Item[]) {
  const paths = items.flatMap((i) => i.images.map((m) => m.path));
  if (!paths.length) return items.map((i) => ({ ...i, images: [] }));
  const { data } = await db.storage.from(BUCKET).createSignedUrls(paths, SIGN_SECONDS);
  const byPath = new Map((data ?? []).map((d) => [d.path, d.signedUrl]));
  return items.map((i) => ({ ...i, images: i.images.map((m) => ({ ...m, url: byPath.get(m.path) ?? null })) }));
}

// ---------- processing ----------

async function knownTags(): Promise<string[]> {
  const { data } = await db.from("items").select("tags").eq("archived", false).limit(500);
  const counts = new Map<string, number>();
  for (const r of data ?? []) for (const t of r.tags as string[]) counts.set(t, (counts.get(t) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([t]) => t);
}

async function tag(itemId: string) {
  const { data: item } = await db.from("items").select("*").eq("id", itemId).single();
  if (!item || !(item.images as Img[]).length) return;
  const { data: urls } = await db.storage.from(BUCKET).createSignedUrls((item.images as Img[]).map((m) => m.path), 600);
  const result = await tagImages(
    (urls ?? []).map((u) => u.signedUrl).filter(Boolean),
    { body: item.body, author: item.author },
    await knownTags(),
  );
  if (!result) return;
  await db.from("items").update({ tags: result.tags, summary: result.summary, palette: result.palette }).eq("id", itemId);
}

async function processX(itemId: string, tweetId: string) {
  const t = await fetchTweet(tweetId);
  if (!t) {
    await db.from("items").update({ status: "error", error: "Couldn't load this post. It may be private or deleted." }).eq("id", itemId);
    return;
  }
  const images: Img[] = [];
  for (const m of t.images.slice(0, 4)) {
    const stored = await storeRemote(itemId, m.url, m).catch(() => null);
    if (stored) images.push(stored);
  }
  await db.from("items").update({
    author: t.author,
    body: t.body,
    images,
    video_url: t.videoUrl,
    status: images.length ? "ready" : "needs_image",
  }).eq("id", itemId);
  if (images.length) await tag(itemId);
}

async function processLink(itemId: string, url: string) {
  const og = await fetchOgImage(url);
  const stored = og.image ? await storeRemote(itemId, og.image).catch(() => null) : null;
  await db.from("items").update({
    body: og.title,
    images: stored ? [stored] : [],
    status: stored ? "ready" : "needs_image",
  }).eq("id", itemId);
  if (stored) await tag(itemId);
}

// ---------- routes ----------

async function save(req: Request) {
  let text: string | null = null;
  let file: Uint8Array | null = null;

  const type = req.headers.get("content-type") ?? "";
  if (type.includes("multipart/form-data")) {
    const form = await req.formData();
    const t = form.get("text") ?? form.get("url");
    if (typeof t === "string") text = t;
    const f = form.get("file") ?? form.get("image");
    if (f instanceof File && f.size > 0) file = new Uint8Array(await f.arrayBuffer());
  } else if (type.startsWith("image/")) {
    file = new Uint8Array(await req.arrayBuffer());
  } else {
    const body = await req.json().catch(() => ({}));
    text = body.text ?? body.url ?? null;
  }

  // A screenshot (optionally with a link alongside it)
  if (file) {
    if (!sniffType(file)) return fail(415, "That file isn't a PNG, JPEG, GIF or WebP image. Add “Convert Image” to JPEG in the Shortcut.");
    const parsed = parseShared(text);

    // Instagram only shares a link, so the usual flow is: share the link, then share a screenshot.
    // A screenshot arriving within 10 minutes of a link that still has no picture joins that save.
    if (parsed.source === "none") {
      const since = new Date(Date.now() - 10 * 60 * 1000).toISOString();
      const { data: waiting } = await db.from("items").select("id")
        .eq("status", "needs_image").eq("archived", false).gte("created_at", since)
        .order("created_at", { ascending: false }).limit(1).maybeSingle();
      if (waiting) {
        const stored = await storeBytes(waiting.id, file);
        if (stored) {
          await db.from("items").update({ images: [stored], status: "ready", error: null }).eq("id", waiting.id);
          later(tag(waiting.id));
          return json({ ok: true, id: waiting.id, message: "Added to the post you just saved" }, 201);
        }
      }
    }

    const { data: item, error } = await db.from("items").insert({
      source: "screenshot",
      url: parsed.source === "none" ? null : parsed.url,
      body: text && parsed.source === "none" ? text.slice(0, 2000) : null,
      status: "processing",
    }).select().single();
    if (error) return fail(500, error.message);
    const stored = await storeBytes(item.id, file);
    await db.from("items").update({ images: stored ? [stored] : [], status: "ready" }).eq("id", item.id);
    later(tag(item.id));
    return json({ ok: true, id: item.id, message: "Saved to Swipefile" }, 201);
  }

  const parsed = parseShared(text);
  if (parsed.source === "none") return fail(400, "Nothing to save. Share a post link or an image.");

  // Already saved? Bring it back instead of making a copy.
  if (parsed.externalId) {
    const { data: existing } = await db.from("items").select("id").eq("source", parsed.source).eq("external_id", parsed.externalId).maybeSingle();
    if (existing) {
      await db.from("items").update({ archived: false }).eq("id", existing.id);
      return json({ ok: true, id: existing.id, duplicate: true, message: "Already in Swipefile" });
    }
  }

  const { data: item, error } = await db.from("items").insert({
    source: parsed.source,
    url: parsed.url,
    external_id: parsed.externalId,
    status: parsed.source === "instagram" ? "needs_image" : "processing",
  }).select().single();
  if (error) return fail(500, error.message);

  if (parsed.source === "x") later(processX(item.id, parsed.externalId));
  if (parsed.source === "link") later(processLink(item.id, parsed.url));

  const message = parsed.source === "instagram"
    ? "Saved. Now share a screenshot of it so you can see it later."
    : "Saved to Swipefile";
  return json({ ok: true, id: item.id, message }, 201);
}

async function list(url: URL) {
  const filter = url.searchParams.get("filter") ?? "all";
  const tagParam = url.searchParams.get("tag");
  const q = (url.searchParams.get("q") ?? "").replace(/[^\p{L}\p{N}@#\s-]/gu, " ").trim();
  const before = url.searchParams.get("before");
  const limit = Math.min(Number(url.searchParams.get("limit") ?? 40), 100);

  let query = db.from("items").select("*").order("created_at", { ascending: false }).limit(limit);
  query = query.eq("archived", filter === "archived");
  if (filter === "starred") query = query.eq("starred", true);
  if (filter === "needs_image") query = query.eq("status", "needs_image");
  if (tagParam) query = query.contains("tags", [tagParam]);
  if (before) query = query.lt("created_at", before);
  if (q) {
    const words = q.split(/\s+/).slice(0, 5);
    for (const w of words) {
      query = query.or(`body.ilike.%${w}%,summary.ilike.%${w}%,author.ilike.%${w}%,tags.cs.{${w.toLowerCase()}}`);
    }
  }
  const { data, error } = await query;
  if (error) return fail(500, error.message);

  const { count: needsImage } = await db.from("items").select("id", { count: "exact", head: true })
    .eq("status", "needs_image").eq("archived", false);
  return json({ items: await signed(data as Item[]), needsImage: needsImage ?? 0 });
}

async function tags() {
  const { data } = await db.from("items").select("tags").eq("archived", false);
  const counts = new Map<string, number>();
  for (const r of data ?? []) for (const t of r.tags as string[]) counts.set(t, (counts.get(t) ?? 0) + 1);
  return json({ tags: [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([tag, count]) => ({ tag, count })) });
}

async function today(url: URL) {
  const date = /^\d{4}-\d{2}-\d{2}$/.test(url.searchParams.get("date") ?? "")
    ? url.searchParams.get("date")!
    : new Date().toISOString().slice(0, 10);
  const key = `today:${date}`;

  const { data: row } = await db.from("settings").select("value").eq("key", key).maybeSingle();
  let ids: string[] = row?.value?.ids ?? [];
  let done: string[] = row?.value?.done ?? [];

  // Pick again while today's set is short and untouched, so new saves on day one still show up.
  if (!row || (ids.length < 5 && done.length === 0)) {
    const { data: picks, error } = await db.rpc("pick_today", { n: 5 });
    if (error) return fail(500, error.message);
    ids = (picks as Item[]).map((p) => p.id);
    done = [];
    await db.from("settings").upsert({ key, value: { ids, done } });
  }

  const { data: rows } = ids.length ? await db.from("items").select("*").in("id", ids) : { data: [] };
  const order = new Map(ids.map((id, i) => [id, i]));
  const items = ((rows ?? []) as Item[]).filter((r) => !r.archived).sort((a, b) => order.get(a.id)! - order.get(b.id)!);
  const { count: total } = await db.from("items").select("id", { count: "exact", head: true }).eq("archived", false);
  return json({ date, items: await signed(items), done, total: total ?? 0 });
}

async function markSeen(id: string, url: URL) {
  const { data: item } = await db.from("items").select("seen_count").eq("id", id).single();
  if (!item) return fail(404, "Not found");
  await db.from("items").update({ seen_count: item.seen_count + 1, last_seen_at: new Date().toISOString() }).eq("id", id);
  const date = url.searchParams.get("date");
  if (date) {
    const key = `today:${date}`;
    const { data: row } = await db.from("settings").select("value").eq("key", key).maybeSingle();
    if (row) {
      const done = Array.from(new Set([...(row.value.done ?? []), id]));
      await db.from("settings").update({ value: { ...row.value, done }, updated_at: new Date().toISOString() }).eq("key", key);
    }
  }
  return json({ ok: true });
}

async function attachImage(id: string, req: Request) {
  const form = await req.formData().catch(() => null);
  const f = form?.get("file");
  if (!(f instanceof File)) return fail(400, "Choose an image to add.");
  const bytes = new Uint8Array(await f.arrayBuffer());
  if (!sniffType(bytes)) return fail(415, "That file isn't a PNG, JPEG, GIF or WebP image.");
  const { data: item } = await db.from("items").select("images").eq("id", id).single();
  if (!item) return fail(404, "Not found");
  const stored = await storeBytes(id, bytes);
  if (!stored) return fail(415, "That image couldn't be read.");
  await db.from("items").update({ images: [...(item.images as Img[]), stored], status: "ready", error: null }).eq("id", id);
  later(tag(id));
  const { data: updated } = await db.from("items").select("*").eq("id", id).single();
  return json({ item: (await signed([updated as Item]))[0] });
}

async function patch(id: string, req: Request) {
  const body = await req.json().catch(() => ({}));
  const update: Record<string, unknown> = {};
  if (typeof body.starred === "boolean") update.starred = body.starred;
  if (typeof body.archived === "boolean") update.archived = body.archived;
  if (Array.isArray(body.tags)) update.tags = body.tags.map((t: string) => String(t).toLowerCase().trim()).filter(Boolean).slice(0, 12);
  const { data, error } = await db.from("items").update(update).eq("id", id).select().single();
  if (error) return fail(404, "Not found");
  return json({ item: (await signed([data as Item]))[0] });
}

async function remove(id: string) {
  const { data: item } = await db.from("items").select("images").eq("id", id).single();
  if (!item) return fail(404, "Not found");
  const paths = (item.images as Img[]).map((m) => m.path);
  if (paths.length) await db.storage.from(BUCKET).remove(paths);
  await db.from("items").delete().eq("id", id);
  return json({ ok: true });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (!safeEqual(req.headers.get("x-swipefile-key") ?? "", KEY)) return fail(401, "Wrong or missing key.");

  const url = new URL(req.url);
  const parts = url.pathname.split("/").filter(Boolean);
  const i = parts.indexOf("inspo");
  const [a, b, c] = i >= 0 ? parts.slice(i + 1) : parts;

  try {
    if (a === "health") return json({ ok: true, tagging: Boolean(Deno.env.get("ANTHROPIC_API_KEY")) });
    if (a === "save" && req.method === "POST") return await save(req);
    if (a === "items" && !b && req.method === "GET") return await list(url);
    if (a === "tags") return await tags();
    if (a === "today") return await today(url);
    if (a === "items" && b) {
      if (c === "seen" && req.method === "POST") return await markSeen(b, url);
      if (c === "image" && req.method === "POST") return await attachImage(b, req);
      if (c === "retag" && req.method === "POST") { later(tag(b)); return json({ ok: true }); }
      if (!c && req.method === "PATCH") return await patch(b, req);
      if (!c && req.method === "DELETE") return await remove(b);
    }
    return fail(404, "Unknown route");
  } catch (err) {
    console.error(err);
    return fail(500, "Something went wrong on the server. Try again.");
  }
});
