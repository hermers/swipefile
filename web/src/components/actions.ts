import { toast } from "sonner";
import { api, type Item } from "../api";
import { useApp } from "../store";

/** Optimistic item actions: the UI changes at once, the request follows, failure puts it back. */
export function useItemActions(onChange: (item: Item) => void, onRemove?: (id: string) => void) {
  const bump = useApp((s) => s.bump);

  async function star(item: Item) {
    const next = { ...item, starred: !item.starred };
    onChange(next);
    try {
      await api.update(item.id, { starred: next.starred });
      bump();
    } catch {
      onChange(item);
      toast.error("Couldn't update the star. Try again.");
    }
  }

  async function archive(item: Item) {
    onRemove?.(item.id);
    try {
      await api.update(item.id, { archived: true });
      bump();
      toast("Archived", {
        description: "It won't come back in Today.",
        action: {
          label: "Undo",
          onClick: async () => {
            await api.update(item.id, { archived: false }).catch(() => null);
            onChange({ ...item, archived: false });
            bump();
          },
        },
      });
    } catch {
      onChange(item);
      toast.error("Couldn't archive it. Try again.");
    }
  }

  async function restore(item: Item) {
    onRemove?.(item.id);
    try {
      await api.update(item.id, { archived: false });
      bump();
      toast.success("Back in your library");
    } catch {
      onChange(item);
      toast.error("Couldn't restore it. Try again.");
    }
  }

  async function remove(item: Item) {
    onRemove?.(item.id);
    try {
      await api.remove(item.id);
      bump();
      toast("Deleted");
    } catch {
      onChange(item);
      toast.error("Couldn't delete it. Try again.");
    }
  }

  return { star, archive, restore, remove };
}
