import { useEffect, useState } from "react";
import { Drawer } from "@base-ui/react/drawer";
import { AlertDialog } from "@base-ui/react/alert-dialog";
import { Archive, ArchiveRestore, ExternalLink, RefreshCw, Star, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { api, type Item } from "../api";
import { useApp } from "../store";
import { AddScreenshot, Media, Meta } from "./Media";
import { useItemActions } from "./actions";

export function ItemSheet() {
  const open = useApp((s) => s.open);
  const openItem = useApp((s) => s.openItem);
  const setTab = useApp((s) => s.setTab);
  const setTag = useApp((s) => s.setTag);
  const setFilter = useApp((s) => s.setFilter);
  const [item, setItem] = useState<Item | null>(open);

  // Keep the last item rendered while the sheet animates closed.
  useEffect(() => {
    if (open) setItem(open);
  }, [open]);

  const close = () => openItem(null);
  const actions = useItemActions((i) => setItem(i), () => close());

  return (
    <Drawer.Root open={Boolean(open)} onOpenChange={(o) => !o && close()}>
      <Drawer.Portal>
        <Drawer.Backdrop className="sheet-backdrop" />
        <Drawer.Viewport className="sheet-viewport">
          <Drawer.Popup className="sheet">
            <div className="grabber" aria-hidden />
            {item && (
              <Drawer.Content className="sheet-body">
                <Drawer.Title className="sr-only">Saved {item.source === "x" ? "post from X" : item.source}</Drawer.Title>
                <Media item={item} eager />

                {!item.images.length && (
                  <div className="frame placeholder" style={{ minHeight: 200 }}>
                    <p>
                      <strong>{item.status === "error" ? "Couldn't load this post." : "No picture yet."}</strong>
                      <br />
                      {item.error ?? "Take a screenshot of the post and add it here."}
                    </p>
                    <AddScreenshot item={item} onDone={setItem} />
                  </div>
                )}

                <div style={{ display: "grid", gap: 8 }}>
                  <Meta item={item} />
                  {item.summary && <Drawer.Description className="summary">{item.summary}</Drawer.Description>}
                  {item.body && <p className="caption" style={{ WebkitLineClamp: 8 }}>{item.body}</p>}
                </div>

                {item.tags.length > 0 && (
                  <div>
                    <p className="section-label">Tags</p>
                    <div className="tag-list">
                      {item.tags.map((t) => (
                        <button
                          key={t}
                          className="chip"
                          aria-pressed="false"
                          onClick={() => {
                            setFilter("all");
                            setTag(t);
                            setTab("library");
                            close();
                          }}
                        >
                          {t}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {item.palette.length > 0 && (
                  <div>
                    <p className="section-label">Colours</p>
                    <div className="swatches">
                      {item.palette.map((c) => (
                        <button
                          key={c}
                          className="swatch"
                          style={{ background: c }}
                          aria-label={`Copy ${c}`}
                          onClick={() => {
                            navigator.clipboard?.writeText(c).then(
                              () => toast.success(`Copied ${c}`),
                              () => toast.error("Couldn't copy. Long-press to copy instead."),
                            );
                          }}
                        />
                      ))}
                    </div>
                  </div>
                )}

                <div className="divider" />

                <div className="row">
                  {item.url && (
                    <a className="btn btn-primary has-icon" href={item.url} target="_blank" rel="noreferrer">
                      <ExternalLink size={18} strokeWidth={1.75} aria-hidden />
                      Open post
                    </a>
                  )}
                  <button
                    className="icon-btn"
                    aria-pressed={item.starred}
                    aria-label={item.starred ? "Unstar" : "Star"}
                    onClick={() => actions.star(item)}
                  >
                    <Star size={20} strokeWidth={1.75} fill={item.starred ? "currentColor" : "none"} />
                  </button>
                  {item.archived ? (
                    <button className="icon-btn" aria-label="Move back to library" onClick={() => actions.restore(item)}>
                      <ArchiveRestore size={20} strokeWidth={1.75} />
                    </button>
                  ) : (
                    <button className="icon-btn" aria-label="Archive" onClick={() => actions.archive(item)}>
                      <Archive size={20} strokeWidth={1.75} />
                    </button>
                  )}
                  {item.images.length > 0 && (
                    <button
                      className="icon-btn"
                      aria-label="Redo AI tags"
                      onClick={() =>
                        api.retag(item.id).then(
                          () => toast("Updating tags", { description: "New tags show up in a few seconds." }),
                          () => toast.error("Couldn't update tags. Try again."),
                        )
                      }
                    >
                      <RefreshCw size={18} strokeWidth={1.75} />
                    </button>
                  )}
                  <DeleteButton onConfirm={() => actions.remove(item)} />
                </div>
              </Drawer.Content>
            )}
          </Drawer.Popup>
        </Drawer.Viewport>
      </Drawer.Portal>
    </Drawer.Root>
  );
}

function DeleteButton({ onConfirm }: { onConfirm: () => void }) {
  return (
    <AlertDialog.Root>
      <AlertDialog.Trigger className="icon-btn" aria-label="Delete" style={{ marginLeft: "auto" }}>
        <Trash2 size={18} strokeWidth={1.75} />
      </AlertDialog.Trigger>
      <AlertDialog.Portal>
        <AlertDialog.Backdrop className="sheet-backdrop" style={{ zIndex: 30 }} />
        <AlertDialog.Popup className="alert">
          <AlertDialog.Title className="sheet-title">Delete this save?</AlertDialog.Title>
          <AlertDialog.Description style={{ color: "var(--text-2)", margin: "8px 0 20px" }}>
            This removes it and its images from Swipefile. You can't undo this. To hide it instead, archive it.
          </AlertDialog.Description>
          <div className="row" style={{ justifyContent: "flex-end" }}>
            <AlertDialog.Close className="btn btn-quiet">Keep it</AlertDialog.Close>
            <AlertDialog.Close className="btn btn-danger" onClick={onConfirm}>Delete</AlertDialog.Close>
          </div>
        </AlertDialog.Popup>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}
