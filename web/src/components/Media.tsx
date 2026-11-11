import { useRef, useState, type ChangeEvent, type ReactNode } from "react";
import { ImagePlus } from "lucide-react";
import { toast } from "sonner";
import { api, SOURCE_LABEL, type Item } from "../api";
import { useApp } from "../store";

export function timeAgo(iso: string) {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return "Just now";
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  const d = Math.floor(s / 86400);
  if (d < 30) return d === 1 ? "Yesterday" : `${d} days ago`;
  return new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

export function Meta({ item }: { item: Item }) {
  return (
    <div className="meta">
      <span className="source">{SOURCE_LABEL[item.source]}</span>
      {item.author && (
        <>
          <span className="dot" aria-hidden />
          <span>{item.author}</span>
        </>
      )}
      <span className="dot" aria-hidden />
      <span>Saved {timeAgo(item.created_at).toLowerCase()}</span>
    </div>
  );
}

/** The saved images, side by side when there are several. Videos from X play inline. */
export function Media({ item, eager }: { item: Item; eager?: boolean }) {
  const [index, setIndex] = useState(0);
  const imgs = item.images.filter((m) => m.url);

  if (item.video_url && imgs.length <= 1) {
    return (
      <div className="frame">
        <video src={item.video_url} poster={imgs[0]?.url ?? undefined} controls playsInline preload="metadata" />
      </div>
    );
  }
  if (!imgs.length) return null;
  if (imgs.length === 1) {
    const m = imgs[0];
    return (
      <div className="frame">
        <img
          src={m.url!}
          width={m.width}
          height={m.height}
          alt={item.summary ?? `Saved ${SOURCE_LABEL[item.source]} image`}
          loading={eager ? "eager" : "lazy"}
          decoding="async"
        />
      </div>
    );
  }
  return (
    <div className="frame">
      <span className="strip-count" aria-hidden>
        {index + 1}/{imgs.length}
      </span>
      <div
        className="strip"
        data-base-ui-swipe-ignore="x"
        onScroll={(e) => {
          const el = e.currentTarget;
          setIndex(Math.round(el.scrollLeft / el.clientWidth));
        }}
      >
        {imgs.map((m, i) => (
          <div key={m.path}>
            <img
              src={m.url!}
              width={m.width}
              height={m.height}
              alt={`${item.summary ?? "Saved image"} (${i + 1} of ${imgs.length})`}
              loading={eager && i === 0 ? "eager" : "lazy"}
              decoding="async"
            />
          </div>
        ))}
      </div>
    </div>
  );
}

/** A button that opens the photo picker and attaches the chosen screenshot to an item. */
export function AddScreenshot({
  item,
  onDone,
  children,
  className = "btn btn-accent has-icon",
}: {
  item: Item;
  onDone?: (item: Item) => void;
  children?: ReactNode;
  className?: string;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const bump = useApp((s) => s.bump);

  async function onPick(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setBusy(true);
    try {
      const { item: updated } = await api.addImage(item.id, file);
      toast.success("Screenshot added");
      onDone?.(updated);
      bump();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't add that screenshot. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button type="button" className={className} disabled={busy} onClick={() => input.current?.click()}>
        {busy ? <span className="spinner" aria-hidden /> : <ImagePlus size={18} strokeWidth={1.75} aria-hidden />}
        {children ?? "Add screenshot"}
      </button>
      <input ref={input} type="file" accept="image/png,image/jpeg,image/webp,image/gif" hidden onChange={onPick} />
    </>
  );
}
