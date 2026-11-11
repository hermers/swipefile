import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Archive, ExternalLink, Settings2, Star } from "lucide-react";
import { api, type Item } from "../api";
import { useApp } from "../store";
import { AddScreenshot, Media, Meta } from "./Media";
import { useItemActions } from "./actions";

type Data = { items: Item[]; done: string[]; total: number };

const EASE_OUT = [0.23, 1, 0.32, 1] as const;

export function Today() {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);
  const setTab = useApp((s) => s.setTab);
  const setSettingsOpen = useApp((s) => s.setSettingsOpen);
  const openItem = useApp((s) => s.openItem);
  const version = useApp((s) => s.version);
  const reduce = useReducedMotion();

  const load = useCallback(async () => {
    try {
      const d = await api.today();
      setData({ items: d.items, done: d.done, total: d.total });
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't load today's picks.");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load, version]);

  const replace = (item: Item) =>
    setData((d) => (d ? { ...d, items: d.items.map((i) => (i.id === item.id ? item : i)) } : d));
  const markDone = (id: string) => setData((d) => (d ? { ...d, done: Array.from(new Set([...d.done, id])) } : d));
  const actions = useItemActions(replace, markDone);

  async function next(item: Item) {
    markDone(item.id);
    api.seen(item.id).catch(() => null);
  }

  const date = new Date().toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" });
  const header = (
    <header className="topbar">
      <div>
        <span className="kicker">{date}</span>
        <h1>Today</h1>
      </div>
      <button className="icon-btn" onClick={() => setSettingsOpen(true)} aria-label="Settings and Share shortcut">
        <Settings2 size={20} strokeWidth={1.75} />
      </button>
    </header>
  );

  if (error && !data) {
    return (
      <>
        {header}
        <div className="state" role="alert">
          <h2>Couldn't load today</h2>
          <p>{error}</p>
          <button className="btn btn-primary" onClick={load}>Try again</button>
        </div>
      </>
    );
  }

  if (!data) {
    return (
      <>
        {header}
        <div className="today" aria-busy>
          <div className="frame shimmer" style={{ aspectRatio: "4 / 5" }} />
        </div>
      </>
    );
  }

  if (data.total === 0) {
    return (
      <>
        {header}
        <div className="state">
          <EmptyArt />
          <h2>Nothing saved yet</h2>
          <p>Share a post from Instagram or X to Swipefile and it shows up here. Each day, 5 of your saves come back for a second look.</p>
          <button className="btn btn-primary" onClick={() => setSettingsOpen(true)}>Set up the Share shortcut</button>
        </div>
      </>
    );
  }

  const queue = data.items.filter((i) => !data.done.includes(i.id));
  const current = queue[0];
  const doneCount = data.items.length - queue.length;

  return (
    <>
      <header className="topbar">
        <div>
          <span className="kicker">{date}</span>
          <h1>Today</h1>
        </div>
        <div className="row" style={{ gap: 12 }}>
          <div
            className="progress"
            role="progressbar"
            aria-label="Today's picks looked at"
            aria-valuemin={0}
            aria-valuemax={data.items.length}
            aria-valuenow={doneCount}
          >
            {data.items.map((i) => (
              <span key={i.id} data-done={data.done.includes(i.id)} />
            ))}
          </div>
          <button className="icon-btn" onClick={() => setSettingsOpen(true)} aria-label="Settings and Share shortcut">
            <Settings2 size={20} strokeWidth={1.75} />
          </button>
        </div>
      </header>

      <div className="today">
        <AnimatePresence mode="popLayout" initial={false}>
          {current ? (
            <motion.article
              key={current.id}
              className="today-card"
              initial={reduce ? { opacity: 0 } : { opacity: 0, transform: "translateX(28px) scale(0.98)" }}
              animate={reduce ? { opacity: 1 } : { opacity: 1, transform: "translateX(0px) scale(1)" }}
              exit={reduce ? { opacity: 0 } : { opacity: 0, transform: "translateX(-28px) scale(0.98)" }}
              transition={{ duration: 0.24, ease: EASE_OUT }}
              aria-label={`Pick ${doneCount + 1} of ${data.items.length}`}
            >
              {current.images.length || current.video_url ? (
                <button
                  type="button"
                  onClick={() => openItem(current)}
                  style={{ all: "unset", cursor: "zoom-in", display: "block" }}
                  aria-label="Open details"
                >
                  <Media item={current} eager />
                </button>
              ) : (
                <div className="frame placeholder">
                  <p>
                    <strong>This Instagram post has no picture yet.</strong>
                    <br />
                    Take a screenshot of it and add it here.
                  </p>
                  <div className="row" style={{ justifyContent: "center" }}>
                    <AddScreenshot item={current} onDone={replace} />
                    {current.url && (
                      <a className="btn btn-quiet has-icon" href={current.url} target="_blank" rel="noreferrer">
                        <ExternalLink size={18} strokeWidth={1.75} aria-hidden />
                        Open post
                      </a>
                    )}
                  </div>
                </div>
              )}

              <div style={{ display: "grid", gap: 8 }}>
                <Meta item={current} />
                {current.summary && <p className="summary">{current.summary}</p>}
                {current.body && <p className="caption">{current.body}</p>}
                {current.tags.length > 0 && (
                  <div className="tag-list" style={{ marginTop: 4 }}>
                    {current.tags.map((t) => (
                      <span key={t} className="chip" aria-pressed="false" style={{ cursor: "default" }}>
                        {t}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div className="actions">
                <button
                  className="icon-btn"
                  aria-pressed={current.starred}
                  aria-label={current.starred ? "Unstar" : "Star"}
                  onClick={() => actions.star(current)}
                >
                  <Star size={20} strokeWidth={1.75} fill={current.starred ? "currentColor" : "none"} />
                </button>
                <button className="icon-btn" aria-label="Archive" onClick={() => actions.archive(current)}>
                  <Archive size={20} strokeWidth={1.75} />
                </button>
                <button className="btn btn-primary" onClick={() => next(current)}>
                  {queue.length > 1 ? "Next" : "Finish"}
                </button>
              </div>
            </motion.article>
          ) : (
            <motion.div
              key="done"
              className="state"
              style={{ marginTop: "8dvh" }}
              initial={reduce ? { opacity: 0 } : { opacity: 0, transform: "translateY(12px)" }}
              animate={reduce ? { opacity: 1 } : { opacity: 1, transform: "translateY(0px)" }}
              transition={{ duration: 0.28, ease: EASE_OUT }}
            >
              <DoneArt />
              <h2>That's today's {data.items.length}</h2>
              <p>
                You looked back at {data.items.length} {data.items.length === 1 ? "save" : "saves"}. New picks tomorrow.
              </p>
              <button className="btn btn-primary" onClick={() => setTab("library")}>Browse your library</button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </>
  );
}

function EmptyArt() {
  return (
    <svg className="state-art" viewBox="0 0 96 96" fill="none" aria-hidden>
      <rect x="14" y="22" width="44" height="58" rx="8" fill="var(--fill-strong)" transform="rotate(-8 36 51)" />
      <rect x="34" y="14" width="48" height="62" rx="8" fill="var(--surface)" stroke="var(--ring-strong)" />
      <rect x="41" y="22" width="34" height="24" rx="4" fill="currentColor" opacity="0.9" />
      <rect x="41" y="52" width="24" height="4" rx="2" fill="var(--fill-strong)" />
      <rect x="41" y="60" width="16" height="4" rx="2" fill="var(--fill-strong)" />
    </svg>
  );
}

function DoneArt() {
  return (
    <svg className="state-art" viewBox="0 0 96 96" fill="none" aria-hidden>
      <circle cx="48" cy="48" r="34" fill="var(--accent-soft)" />
      <path d="M33 49.5 43.5 60 64 37" stroke="currentColor" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
