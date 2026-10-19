import { Search, UserPlus, X } from "lucide-react";
import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { matchesQuery } from "@/lib/text";
import type { Supplier } from "@/lib/types";

interface FarmerPickerProps {
  suppliers: Supplier[];
  value: string;
  onSelect: (s: Supplier) => void;
  onClear: () => void;
  onQuickAdd: (query: string) => void;
}

const place = (s: Supplier) => [s.commune, s.wilaya].filter(Boolean).join(" — ");

/** Recherche rapide d'un agriculteur : tapez 2-3 lettres, cliquez, ou ajoutez-le à la volée. */
export function FarmerPicker({ suppliers, value, onSelect, onClear, onQuickAdd }: FarmerPickerProps) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const selected = suppliers.find((s) => s.id === value);

  const results = useMemo(() => {
    const q = query.trim();
    if (!q) return [];
    return suppliers.filter((s) => matchesQuery(`${s.name} ${s.commune} ${s.wilaya}`, q)).slice(0, 8);
  }, [suppliers, query]);

  if (selected) {
    return (
      <div className="flex h-9 items-center justify-between rounded-md border border-input bg-secondary/60 px-3 text-sm">
        <span className="truncate font-medium">
          {selected.name}
          {place(selected) && (
            <span className="ml-2 text-xs font-normal text-muted-foreground">{place(selected)}</span>
          )}
        </span>
        <button
          type="button"
          onClick={onClear}
          className="ml-2 shrink-0 text-muted-foreground transition-colors hover:text-foreground"
          aria-label="Changer d'agriculteur"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return (
    <div className="flex gap-2">
    <button
      type="button"
      onClick={() => onQuickAdd(query.trim())}
      className="order-2 inline-flex h-9 shrink-0 items-center gap-1.5 rounded-md border border-input bg-background px-3 text-sm font-medium text-primary transition-colors hover:bg-accent"
    >
      <UserPlus className="h-4 w-4" /> Nouveau
    </button>
    <div className="relative order-1 flex-1">
      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        value={query}
        onFocus={() => setOpen(true)}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={(e) => {
          if (e.key === "Escape") setOpen(false);
        }}
        placeholder="Rechercher un agriculteur…"
        className="pl-9"
        autoComplete="off"
      />
      {open && query.trim().length > 0 && (
        <div className="absolute z-50 mt-1 w-full overflow-hidden rounded-md border border-border bg-popover shadow-md">
          {results.length === 0 && (
            <p className="px-3 py-2 text-xs text-muted-foreground">Aucun agriculteur trouvé</p>
          )}
          {results.map((s) => (
            <button
              key={s.id}
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                onSelect(s);
                setQuery("");
                setOpen(false);
              }}
              className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm transition-colors hover:bg-accent"
            >
              <span className="truncate font-medium">{s.name}</span>
              <span className="shrink-0 text-xs text-muted-foreground">{place(s)}</span>
            </button>
          ))}
          <button
            type="button"
            onMouseDown={(e) => {
              e.preventDefault();
              onQuickAdd(query.trim());
              setQuery("");
              setOpen(false);
            }}
            className="flex w-full items-center gap-2 border-t border-border px-3 py-2 text-left text-sm font-medium text-primary transition-colors hover:bg-accent"
          >
            <UserPlus className="h-4 w-4" /> Ajouter un nouvel agriculteur
          </button>
        </div>
      )}
    </div>
    </div>
  );
}
