import { create } from "zustand";
import { setApiKey, type Item } from "./api";

const KEY_STORAGE = "swipefile:key";
const TAB_STORAGE = "swipefile:tab";

const read = (k: string) => {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
};
const write = (k: string, v: string | null) => {
  try {
    if (v === null) localStorage.removeItem(k);
    else localStorage.setItem(k, v);
  } catch {
    /* private mode: the key lasts for this visit only */
  }
};

export type Tab = "today" | "library";
export type Filter = "all" | "starred" | "needs_image" | "archived";

type State = {
  key: string | null;
  tab: Tab;
  query: string;
  tag: string | null;
  filter: Filter;
  open: Item | null;
  settingsOpen: boolean;
  // bumped whenever an item changes, so every view refetches the same truth
  version: number;
  setKey: (k: string | null) => void;
  setTab: (t: Tab) => void;
  setQuery: (q: string) => void;
  setTag: (t: string | null) => void;
  setFilter: (f: Filter) => void;
  openItem: (i: Item | null) => void;
  setSettingsOpen: (o: boolean) => void;
  bump: () => void;
};

// Local development only: .env.development.local is never loaded by production builds.
const initialKey = read(KEY_STORAGE) ?? (import.meta.env.DEV ? import.meta.env.VITE_DEV_KEY ?? null : null);
if (initialKey) setApiKey(initialKey);

export const useApp = create<State>((set) => ({
  key: initialKey,
  tab: (read(TAB_STORAGE) as Tab) ?? "today",
  query: "",
  tag: null,
  filter: "all",
  open: null,
  settingsOpen: false,
  version: 0,
  setKey: (k) => {
    write(KEY_STORAGE, k);
    setApiKey(k ?? "");
    set({ key: k });
  },
  setTab: (tab) => {
    write(TAB_STORAGE, tab);
    set({ tab });
  },
  setQuery: (query) => set({ query }),
  setTag: (tag) => set({ tag }),
  setFilter: (filter) => set({ filter }),
  openItem: (open) => set({ open }),
  setSettingsOpen: (settingsOpen) => set({ settingsOpen }),
  bump: () => set((s) => ({ version: s.version + 1 })),
}));
