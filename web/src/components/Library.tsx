import { useCallback, useEffect, useRef, useState } from "react";
import { Search, Settings2, Star, X } from "lucide-react";
import { api, SOURCE_LABEL, type Item } from "../api";
import { useApp, type Filter } from "../store";
import { AddScreenshot } from "./Media";

const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "starred", label: "Starred" },
  { id: "needs_image", label: "Needs a screenshot" },
  { id: "archived", label: "Archived" },
];

export function Library() {
  const { query, setQuery, tag, setTag, filter, setFilter, openItem, version, setSettingsOpen } = useApp();
  const [items, setItems] = useState<Item[] | null>(null);
  const [needsImage, setNeedsImage] = useState(0);
  const [tags, setTags] = useState<{ tag: string; count: number }[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [end, setEnd] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [draft, setDraft] = useState(query);
  const sentinel = useRef<HTMLDivElement>(null);

  // Search waits for a pause in typing.
  useEffect(() => {
    const t = setTimeout(() => setQuery(draft.trim()), 250);
    return () => clearTimeout(t);
  }, [draft, setQuery]);

  const load = useCallback(async () => {
    try {
      const res = await api.items({ q: query, tag, filter });
      setItems(res.items);
      setNeedsImage(res.needsImage);
      setEnd(res.items.length < 40);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't load your library.");
    }
  }, [query, tag, filter]);

  useEffect(() => {
    load();
  }, [load, version]);

  useEffect(() => {
    api.tags().then((r) => setTags(r.tags)).catch(() => null);
  }, [version]);

  // While a post is still being fetched, check back every few seconds.
  useEffect(() => {
    if (!items?.some((i) => i.status === "processing")) return;
    const t = setTimeout(load, 3000);
    return () => clearTimeout(t);
  }, [items, load]);

  // Endless scroll
  useEffect(() => {
    const el = sentinel.current;
    if (!el || end || !items?.length) return;
    const io = new IntersectionObserver(async ([entry]) => {
      if (!entry.isIntersecting || loadingMore) return;
      setLoadingMore(true);
      try {
        const res = await api.items({ q: query, tag, filter, before: items[items.length - 1].created_at });
        setItems((cur) => [...(cur ?? []), ...res.items]);
        if (res.items.length < 40) setEnd(true);
      } finally {
        setLoadingMore(false);
      }
    }, { rootMargin: "600px" });
    io.observe(el);
    return () => io.disconnect();
  }, [items, end, loadingMore, query, tag, filter]);

  const replace = (item: Item) => setItems((cur) => cur?.map((i) => (i.id === item.id ? item : i)) ?? cur);
  const searching = Boolean(query || tag);

  return (
    <>
      <header className="topbar">
        <div>
          <span className="kicker">{items ? `${items.length}${end ? "" : "+"} saves` : "Loading"}</span>
          <h1>Library</h1>
        </div>
        <button className="icon-btn" onClick={() => setSettingsOpen(true)} aria-label="Settings and Share shortcut">
          <Settings2 size={20} strokeWidth={1.75} />
        </button>
      </header>

      <div className="lib-controls">
        <label className="search">
          <Search size={18} strokeWidth={1.75} aria-hidden />
          <span className="sr-only">Search your saves</span>
          <input
            type="search"
            placeholder="Search saves, tags or @names"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            enterKeyHint="search"
          />
          {draft && (
            <button className="icon-btn" style={{ width: 32, height: 32 }} onClick={() => setDraft("")} aria-label="Clear search">
              <X size={16} />
            </button>
          )}
        </label>
        <div className="chip-row" role="toolbar" aria-label="Filters">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              className={f.id === "needs_image" && needsImage ? "chip accent" : "chip"}
              aria-pressed={filter === f.id}
              onClick={() => setFilter(f.id)}
            >
              {f.id === "starred" && <Star size={14} strokeWidth={2} aria-hidden />}
              {f.label}
              {f.id === "needs_image" && needsImage > 0 && <span className="count">{needsImage}</span>}
            </button>
          ))}
        </div>
        {tags.length > 0 && (
          <div className="chip-row" role="toolbar" aria-label="Tags">
            {tags.slice(0, 30).map(({ tag: t, count }) => (
              <button key={t} className="chip" aria-pressed={tag === t} onClick={() => setTag(tag === t ? null : t)}>
                {t}
                <span className="count">{count}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {error && !items && (
        <div className="state" role="alert">
          <h2>Couldn't load your library</h2>
          <p>{error}</p>
          <button className="btn btn-primary" onClick={load}>Try again</button>
        </div>
      )}

      {!items && !error && (
        <div className="grid" aria-busy>
          {[5 / 4, 4 / 5, 1, 9 / 16, 4 / 3, 3 / 4].map((r, i) => (
            <div key={i} className="tile frame shimmer" style={{ aspectRatio: String(r), ["--i" as string]: i }} />
          ))}
        </div>
      )}

      {items && items.length === 0 && (
        <div className="state">
          {searching ? (
            <>
              <h2>No matches</h2>
              <p>Nothing saved matches {query ? `“${query}”` : `the tag “${tag}”`}. Try another word, or clear the search.</p>
              <button className="btn btn-quiet" onClick={() => { setDraft(""); setTag(null); }}>Clear search</button>
            </>
          ) : filter === "starred" ? (
            <>
              <h2>No stars yet</h2>
              <p>Star the saves you want to keep close. They'll gather here.</p>
            </>
          ) : filter === "needs_image" ? (
            <>
              <h2>All caught up</h2>
              <p>Every save has a picture.</p>
            </>
          ) : filter === "archived" ? (
            <>
              <h2>Nothing archived</h2>
              <p>Saves you archive stay here, out of Today.</p>
            </>
          ) : (
            <>
              <h2>Nothing saved yet</h2>
              <p>Share a post from Instagram or X to Swipefile and it shows up here.</p>
              <button className="btn btn-primary" onClick={() => setSettingsOpen(true)}>Set up the Share shortcut</button>
            </>
          )}
        </div>
      )}

      {items && items.length > 0 && (
        <>
          <div className="grid">
            {items.map((item, i) => (
              <Tile key={item.id} item={item} index={i} onOpen={() => openItem(item)} onChange={replace} />
            ))}
          </div>
          <div ref={sentinel} className="more">
            {loadingMore && <span className="spinner" aria-label="Loading more" />}
          </div>
        </>
      )}
    </>
  );
}

function Tile({ item, index, onOpen, onChange }: { item: Item; index: number; onOpen: () => void; onChange: (i: Item) => void }) {
  const img = item.images.find((m) => m.url);
  const style = { ["--i" as string]: Math.min(index, 11) };

  if (item.status === "processing") {
    return (
      <div className="tile" style={style} aria-label="Getting the post's images">
        <div className="frame shimmer" style={{ aspectRatio: "4 / 5" }} />
      </div>
    );
  }

  if (!img) {
    return (
      <div className="tile frame" style={style}>
        <div className="tile-empty">
          <button type="button" className="tile-empty-open" onClick={onOpen}>
            <span className="source">{SOURCE_LABEL[item.source]}</span>
            <strong>{item.status === "error" ? "Couldn't load this post" : "No picture yet"}</strong>
            <span>{item.error ?? "Add a screenshot of the post to see it here."}</span>
          </button>
          <AddScreenshot item={item} onDone={onChange} className="btn btn-quiet has-icon">Add</AddScreenshot>
        </div>
      </div>
    );
  }

  const ratio = img.width && img.height ? `${img.width} / ${img.height}` : undefined;
  return (
    <button className="tile" style={style} onClick={onOpen} aria-label={item.summary ?? `${SOURCE_LABEL[item.source]} save`}>
      <div className="frame" style={{ aspectRatio: ratio }}>
        <img src={img.url!} width={img.width} height={img.height} alt="" loading={index < 6 ? "eager" : "lazy"} decoding="async" />
        <div className="tile-badges" aria-hidden>
          <span className="badge">{SOURCE_LABEL[item.source]}</span>
          {item.images.length > 1 && <span className="badge">{item.images.length}</span>}
          {item.video_url && <span className="badge">Video</span>}
          {item.starred && (
            <span className="badge star">
              <Star size={11} fill="currentColor" strokeWidth={0} />
            </span>
          )}
        </div>
      </div>
    </button>
  );
}
