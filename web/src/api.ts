export const API_URL: string =
  import.meta.env.VITE_API_URL ?? "https://cbxhjtbqhlpxrnsundju.supabase.co/functions/v1/inspo";

export type Img = { path: string; url: string | null; width?: number; height?: number };
export type Source = "x" | "instagram" | "screenshot" | "link";
export type Item = {
  id: string;
  source: Source;
  url: string | null;
  author: string | null;
  body: string | null;
  images: Img[];
  video_url: string | null;
  status: "processing" | "ready" | "needs_image" | "error";
  error: string | null;
  tags: string[];
  summary: string | null;
  palette: string[];
  starred: boolean;
  archived: boolean;
  seen_count: number;
  last_seen_at: string | null;
  created_at: string;
};

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

let key = "";
export const setApiKey = (k: string) => (key = k);

async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      ...init,
      headers: { "x-swipefile-key": key, ...(init.headers ?? {}) },
    });
  } catch {
    throw new ApiError(0, "Can't reach Swipefile. Check your connection and try again.");
  }
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, body.error ?? "Something went wrong. Try again.");
  return body as T;
}

const jsonInit = (method: string, data: unknown): RequestInit => ({
  method,
  headers: { "content-type": "application/json" },
  body: JSON.stringify(data),
});

export const localDate = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

export const api = {
  health: () => call<{ ok: boolean; tagging: boolean }>("/health"),
  items: (p: { q?: string; tag?: string | null; filter?: string; before?: string }) => {
    const s = new URLSearchParams();
    if (p.q) s.set("q", p.q);
    if (p.tag) s.set("tag", p.tag);
    if (p.filter) s.set("filter", p.filter);
    if (p.before) s.set("before", p.before);
    return call<{ items: Item[]; needsImage: number }>(`/items?${s}`);
  },
  tags: () => call<{ tags: { tag: string; count: number }[] }>("/tags"),
  today: () => call<{ date: string; items: Item[]; done: string[]; total: number }>(`/today?date=${localDate()}`),
  seen: (id: string) => call(`/items/${id}/seen?date=${localDate()}`, { method: "POST" }),
  update: (id: string, data: Partial<Pick<Item, "starred" | "archived" | "tags">>) =>
    call<{ item: Item }>(`/items/${id}`, jsonInit("PATCH", data)),
  remove: (id: string) => call(`/items/${id}`, { method: "DELETE" }),
  retag: (id: string) => call(`/items/${id}/retag`, { method: "POST" }),
  addImage: (id: string, file: File) => {
    const form = new FormData();
    form.set("file", file);
    return call<{ item: Item }>(`/items/${id}/image`, { method: "POST", body: form });
  },
  saveText: (text: string) => call<{ id: string; message: string }>("/save", jsonInit("POST", { text })),
  saveFile: (file: File) => {
    const form = new FormData();
    form.set("file", file);
    return call<{ id: string; message: string }>("/save", { method: "POST", body: form });
  },
};

export const SOURCE_LABEL: Record<Source, string> = {
  x: "X",
  instagram: "Instagram",
  screenshot: "Screenshot",
  link: "Link",
};
