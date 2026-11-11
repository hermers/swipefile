import { useEffect } from "react";
import { Toaster } from "sonner";
import { LayoutGrid, Sun } from "lucide-react";
import { useApp } from "./store";
import { Setup } from "./components/Setup";
import { Today } from "./components/Today";
import { Library } from "./components/Library";
import { ItemSheet } from "./components/ItemSheet";
import { SettingsSheet } from "./components/Settings";

export default function App() {
  const key = useApp((s) => s.key);
  const tab = useApp((s) => s.tab);
  const setTab = useApp((s) => s.setTab);
  const setKey = useApp((s) => s.setKey);

  // A setup link (…#key=abc) connects this device in one tap, then the key leaves the address bar.
  useEffect(() => {
    const m = location.hash.match(/key=([a-f0-9]{16,})/i);
    if (m) {
      setKey(m[1]);
      history.replaceState(null, "", location.pathname + location.search);
    }
  }, [setKey]);

  return (
    <>
      <Toaster
        position="top-center"
        theme="system"
        offset={{ top: "calc(env(safe-area-inset-top) + 12px)" }}
        mobileOffset={{ top: "calc(env(safe-area-inset-top) + 12px)" }}
        toastOptions={{ style: { fontFamily: "var(--font-ui)", borderRadius: 14 } }}
      />
      {!key ? (
        <Setup />
      ) : (
        <>
          <div className="status-cover" aria-hidden />
          <main className="shell">{tab === "today" ? <Today /> : <Library />}</main>
          <nav className="tabbar" aria-label="Sections">
            <button className="tab" aria-current={tab === "today" ? "page" : undefined} onClick={() => setTab("today")}>
              <Sun size={22} strokeWidth={1.75} aria-hidden />
              Today
            </button>
            <button className="tab" aria-current={tab === "library" ? "page" : undefined} onClick={() => setTab("library")}>
              <LayoutGrid size={22} strokeWidth={1.75} aria-hidden />
              Library
            </button>
          </nav>
          <ItemSheet />
          <SettingsSheet />
        </>
      )}
    </>
  );
}
