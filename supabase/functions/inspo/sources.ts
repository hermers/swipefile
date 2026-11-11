// Works out what was shared and pulls the images out of it.

export type Parsed =
  | { source: "x"; url: string; externalId: string }
  | { source: "instagram"; url: string; externalId: string }
  | { source: "link"; url: string; externalId: null }
  | { source: "none" };

const URL_RE = /https?:\/\/[^\s<>"']+/i;
const X_RE = /^https?:\/\/(?:www\.|mobile\.)?(?:x|twitter|fxtwitter|vxtwitter)\.com\/(?:[^/]+|i\/web)\/status(?:es)?\/(\d+)/i;
const IG_RE = /^https?:\/\/(?:www\.)?instagram\.com\/(?:[^/]+\/)?(?:p|reel|reels|tv)\/([A-Za-z0-9_-]+)/i;

export function parseShared(text: string | null | undefined): Parsed {
  const match = text?.match(URL_RE);
  if (!match) return { source: "none" };
  const raw = match[0].replace(/[).,]+$/, "");

  const x = raw.match(X_RE);
  if (x) return { source: "x", externalId: x[1], url: `https://x.com/i/status/${x[1]}` };

  const ig = raw.match(IG_RE);
  if (ig) return { source: "instagram", externalId: ig[1], url: `https://www.instagram.com/p/${ig[1]}/` };

  return { source: "link", url: raw, externalId: null };
}

export type RemoteMedia = { url: string; width?: number; height?: number };
export type TweetData = {
  author: string | null;
  body: string | null;
  images: RemoteMedia[];
  videoUrl: string | null;
};

// X's public embed endpoint (the one embedded tweets use). No API key needed.
async function fromSyndication(id: string): Promise<TweetData | null> {
  const token = ((Number(id) / 1e15) * Math.PI).toString(36).replace(/(0+|\.)/g, "");
  const res = await fetch(`https://cdn.syndication.twimg.com/tweet-result?id=${id}&token=${token}&lang=en`);
  if (!res.ok) return null;
  const t = await res.json().catch(() => null);
  if (!t || t.__typename === "TweetTombstone" || !t.id_str) return null;

  const images: RemoteMedia[] = [];
  let videoUrl: string | null = null;
  for (const m of t.mediaDetails ?? []) {
    const w = m.original_info?.width;
    const h = m.original_info?.height;
    // Photos come back as the image; videos and GIFs come back as their poster frame.
    images.push({ url: `${m.media_url_https}?name=large`, width: w, height: h });
    if ((m.type === "video" || m.type === "animated_gif") && !videoUrl) {
      const mp4s = (m.video_info?.variants ?? []).filter((v: { content_type: string }) => v.content_type === "video/mp4");
      mp4s.sort((a: { bitrate?: number }, b: { bitrate?: number }) => (b.bitrate ?? 0) - (a.bitrate ?? 0));
      videoUrl = mp4s[0]?.url ?? null;
    }
  }
  // A tweet quoting another tweet's screenshot: use the quoted media when there's none.
  if (!images.length && t.quoted_tweet?.mediaDetails) {
    for (const m of t.quoted_tweet.mediaDetails) {
      images.push({ url: `${m.media_url_https}?name=large`, width: m.original_info?.width, height: m.original_info?.height });
    }
  }
  return {
    author: t.user?.screen_name ? `@${t.user.screen_name}` : null,
    body: cleanTweetText(t.text ?? ""),
    images,
    videoUrl,
  };
}

// Unofficial fallback (fxtwitter), used only when the embed endpoint fails.
async function fromFx(id: string): Promise<TweetData | null> {
  const res = await fetch(`https://api.fxtwitter.com/status/${id}`, { headers: { "user-agent": "swipefile/0.1" } });
  if (!res.ok) return null;
  const j = await res.json().catch(() => null);
  const t = j?.tweet;
  if (!t) return null;
  const images: RemoteMedia[] = [];
  for (const p of t.media?.photos ?? []) images.push({ url: p.url, width: p.width, height: p.height });
  for (const v of t.media?.videos ?? []) images.push({ url: v.thumbnail_url, width: v.width, height: v.height });
  return {
    author: t.author?.screen_name ? `@${t.author.screen_name}` : null,
    body: cleanTweetText(t.text ?? ""),
    images,
    videoUrl: t.media?.videos?.[0]?.url ?? null,
  };
}

export async function fetchTweet(id: string): Promise<TweetData | null> {
  try {
    const a = await fromSyndication(id);
    if (a) return a;
  } catch (_) { /* fall through */ }
  try {
    return await fromFx(id);
  } catch (_) {
    return null;
  }
}

function cleanTweetText(s: string) {
  return s.replace(/\s*https?:\/\/t\.co\/\w+/g, "").trim() || null;
}

// For ordinary links (Dribbble, Behance, a blog post): the page's share image.
export async function fetchOgImage(url: string): Promise<{ image: string | null; title: string | null }> {
  try {
    const res = await fetch(url, {
      headers: { "user-agent": "Mozilla/5.0 (compatible; swipefile/0.1)", accept: "text/html" },
      redirect: "follow",
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return { image: null, title: null };
    const html = (await res.text()).slice(0, 300_000);
    const meta = (prop: string) =>
      html.match(new RegExp(`<meta[^>]+(?:property|name)=["']${prop}["'][^>]*content=["']([^"']+)`, "i"))?.[1] ??
      html.match(new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]*(?:property|name)=["']${prop}["']`, "i"))?.[1] ??
      null;
    const image = meta("og:image") ?? meta("twitter:image");
    const title = meta("og:title") ?? html.match(/<title>([^<]+)<\/title>/i)?.[1] ?? null;
    return { image: image ? new URL(image, url).toString() : null, title: title?.trim() ?? null };
  } catch (_) {
    return { image: null, title: null };
  }
}

// Width and height straight from the file header, so the gallery can reserve space.
export function imageSize(bytes: Uint8Array): { width?: number; height?: number } {
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  // PNG
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes.length > 24) {
    return { width: dv.getUint32(16), height: dv.getUint32(20) };
  }
  // JPEG: walk the segments to the first SOF marker
  if (bytes[0] === 0xff && bytes[1] === 0xd8) {
    let i = 2;
    while (i + 9 < bytes.length) {
      if (bytes[i] !== 0xff) { i++; continue; }
      const marker = bytes[i + 1];
      const len = dv.getUint16(i + 2);
      if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
        return { height: dv.getUint16(i + 5), width: dv.getUint16(i + 7) };
      }
      i += 2 + len;
    }
  }
  return {};
}

export function sniffType(bytes: Uint8Array): string | null {
  if (bytes[0] === 0x89 && bytes[1] === 0x50) return "image/png";
  if (bytes[0] === 0xff && bytes[1] === 0xd8) return "image/jpeg";
  if (bytes[0] === 0x47 && bytes[1] === 0x49) return "image/gif";
  if (bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50) return "image/webp";
  return null;
}
