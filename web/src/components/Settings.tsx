import { useEffect, useRef, useState, type FormEvent } from "react";
import { Drawer } from "@base-ui/react/drawer";
import { Copy, ImagePlus } from "lucide-react";
import { toast } from "sonner";
import { api, API_URL } from "../api";
import { useApp } from "../store";

export function SettingsSheet() {
  const open = useApp((s) => s.settingsOpen);
  const setOpen = useApp((s) => s.setSettingsOpen);
  const key = useApp((s) => s.key);
  const setKey = useApp((s) => s.setKey);
  const bump = useApp((s) => s.bump);
  const [health, setHealth] = useState<{ ok: boolean; tagging: boolean } | null | "error">(null);
  const [link, setLink] = useState("");
  const [saving, setSaving] = useState(false);
  const file = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    api.health().then(setHealth, () => setHealth("error"));
  }, [open]);

  const copy = (value: string, what: string) =>
    navigator.clipboard?.writeText(value).then(
      () => toast.success(`${what} copied`),
      () => toast.error("Couldn't copy. Select the text and copy it instead."),
    );

  async function saveLink(e: FormEvent) {
    e.preventDefault();
    if (!link.trim()) return;
    setSaving(true);
    try {
      const r = await api.saveText(link.trim());
      toast.success(r.message);
      setLink("");
      bump();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't save that link.");
    } finally {
      setSaving(false);
    }
  }

  async function saveFile(f: File) {
    setSaving(true);
    try {
      const r = await api.saveFile(f);
      toast.success(r.message);
      bump();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't save that image.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Drawer.Root open={open} onOpenChange={setOpen}>
      <Drawer.Portal>
        <Drawer.Backdrop className="sheet-backdrop" />
        <Drawer.Viewport className="sheet-viewport">
          <Drawer.Popup className="sheet">
            <div className="grabber" aria-hidden />
            <Drawer.Content className="sheet-body" style={{ gap: 24 }}>
              <Drawer.Title className="sheet-title">Settings</Drawer.Title>

              <section style={{ display: "grid", gap: 8 }}>
                <p className="section-label" style={{ margin: 0 }}>Status</p>
                <p className="status-line">
                  <span className="status-dot" data-on={health !== "error" && Boolean(health?.ok)} />
                  {health === null ? "Checking…" : health === "error" ? "Can't reach Swipefile right now" : "Connected"}
                </p>
                {health && health !== "error" && (
                  <p className="status-line">
                    <span className="status-dot" data-on={health.tagging} />
                    {health.tagging ? "AI tags are on" : "AI tags are off. Add a Claude API key on your Mac to turn them on."}
                  </p>
                )}
              </section>

              <section style={{ display: "grid", gap: 10 }}>
                <p className="section-label" style={{ margin: 0 }}>Add a save</p>
                <form className="row" onSubmit={saveLink} style={{ flexWrap: "nowrap" }}>
                  <label htmlFor="add-link" className="sr-only">Link to save</label>
                  <input
                    id="add-link"
                    className="input"
                    style={{ flex: 1, minWidth: 0 }}
                    type="url"
                    inputMode="url"
                    placeholder="Paste a post link"
                    value={link}
                    onChange={(e) => setLink(e.target.value)}
                  />
                  <button className="btn btn-primary" type="submit" disabled={saving || !link.trim()}>
                    {saving ? <span className="spinner" aria-label="Saving" /> : "Save"}
                  </button>
                </form>
                <button className="btn btn-quiet has-icon" style={{ justifySelf: "start" }} disabled={saving} onClick={() => file.current?.click()}>
                  <ImagePlus size={18} strokeWidth={1.75} aria-hidden />
                  Upload screenshots
                </button>
                <input
                  ref={file}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  multiple
                  hidden
                  onChange={async (e) => {
                    const files = Array.from(e.target.files ?? []);
                    e.target.value = "";
                    for (const f of files) await saveFile(f);
                  }}
                />
              </section>

              <section style={{ display: "grid", gap: 12 }}>
                <p className="section-label" style={{ margin: 0 }}>Save from your iPhone</p>
                <p style={{ color: "var(--text-2)", fontSize: "var(--t-sm)" }}>
                  Make 2 small shortcuts once, about 3 minutes. After that, tap Share on any post, then Swipefile.
                </p>
                <p className="section-label" style={{ margin: "4px 0 0" }}>Shortcut 1 · links from X and Instagram</p>
                <ol className="steps">
                  <li>
                    Open <strong>Shortcuts</strong>, tap <strong>+</strong> and name it <strong>Swipefile</strong>. Tap
                    <strong> ⓘ</strong>, turn on <strong>Show in Share Sheet</strong> and set it to receive only
                    <strong> URLs</strong> and <strong>Text</strong>.
                  </li>
                  <li>
                    Add <strong>Get Contents of URL</strong>. Paste the address below, tap <strong>Show More</strong>, set
                    Method to <strong>POST</strong>, add a header <strong>x-swipefile-key</strong> with your key, and set
                    Request Body to <strong>JSON</strong> with a Text field <strong>text</strong> = <strong>Shortcut Input</strong>.
                  </li>
                  <li>
                    Add <strong>Get Dictionary Value</strong> for <strong>message</strong>, then <strong>Show Notification</strong> with
                    the Dictionary Value.
                  </li>
                </ol>
                <p className="section-label" style={{ margin: "4px 0 0" }}>Shortcut 2 · screenshots</p>
                <ol className="steps">
                  <li>
                    Duplicate the first shortcut and name it <strong>Swipefile image</strong>. Set it to receive only
                    <strong> Images</strong>.
                  </li>
                  <li>
                    At the top, add <strong>Convert Image</strong>: Shortcut Input to <strong>JPEG</strong>.
                  </li>
                  <li>
                    In <strong>Get Contents of URL</strong>, change Request Body to <strong>Form</strong> with a
                    <strong> File</strong> field <strong>file</strong> = <strong>Converted Image</strong>.
                  </li>
                </ol>
                <p style={{ color: "var(--text-2)", fontSize: "var(--t-sm)" }}>
                  Try it: in X or Instagram tap <strong style={{ color: "var(--text)" }}>Share</strong>, then
                  <strong style={{ color: "var(--text)" }}> Swipefile</strong>. Instagram only shares the link, so also screenshot
                  the post and share it with <strong style={{ color: "var(--text)" }}>Swipefile image</strong> within 10 minutes.
                  It gets added to that post.
                </p>
                <div>
                  <p className="section-label" style={{ margin: 0 }}>Address</p>
                  <div className="copy-row">
                    <span>{API_URL}/save</span>
                    <button className="btn btn-quiet" onClick={() => copy(`${API_URL}/save`, "Address")}>
                      <Copy size={14} aria-hidden /> Copy
                    </button>
                  </div>
                </div>
                <div>
                  <p className="section-label" style={{ margin: 0 }}>Your key</p>
                  <div className="copy-row">
                    <span>{key ? `${key.slice(0, 6)}••••••••${key.slice(-4)}` : ""}</span>
                    <button className="btn btn-quiet" onClick={() => key && copy(key, "Key")}>
                      <Copy size={14} aria-hidden /> Copy
                    </button>
                  </div>
                </div>
                <p style={{ color: "var(--text-3)", fontSize: "var(--t-xs)" }}>
                  Tip: in Safari, tap Share, then Add to Home Screen, so Swipefile opens like an app.
                </p>
              </section>

              <div className="divider" />
              <button
                className="btn btn-ghost"
                style={{ justifySelf: "start", color: "var(--danger)" }}
                onClick={() => {
                  setOpen(false);
                  setKey(null);
                }}
              >
                Disconnect this device
              </button>
            </Drawer.Content>
          </Drawer.Popup>
        </Drawer.Viewport>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
