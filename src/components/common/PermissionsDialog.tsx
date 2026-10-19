import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useApp } from "@/context/AppContext";
import { api } from "@/lib/api";
import {
  ALL_MODULES,
  MODULE_LABELS,
  ROLE_LABELS,
  effectiveLevel,
  roleLevel,
  type AccessLevel,
} from "@/lib/permissions";
import type { ModuleKey, User } from "@/lib/types";
import { cn } from "@/lib/utils";

const LEVELS: { v: AccessLevel; label: string }[] = [
  { v: "none", label: "Aucun" },
  { v: "read", label: "Lecteur" },
  { v: "write", label: "Éditeur" },
];

export function PermissionsDialog({ user, onClose }: { user: User | null; onClose: () => void }) {
  const { resetDemo, log } = useApp();
  const [levels, setLevels] = useState<Record<string, AccessLevel>>({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!user) return;
    setLevels(Object.fromEntries(ALL_MODULES.map((m) => [m, effectiveLevel(user.role, m, user.permissions)])));
  }, [user]);

  if (!user) return null;
  const isAdmin = user.role === "ADMIN";

  async function save() {
    if (!user) return;
    setBusy(true);
    const rows = ALL_MODULES.filter((m) => levels[m] !== roleLevel(user.role, m)).map((m) => ({
      user_id: user.id,
      module: m,
      level: levels[m]!,
    }));
    try {
      await api.rpc("save_user_permissions", { _user_id: user.id, _levels: rows });
    } catch {
      setBusy(false);
      toast.error("Enregistrement des droits impossible.");
      return;
    }
    setBusy(false);
    log("a modifié les droits", "Utilisateurs", `${user.firstName} ${user.lastName}`);
    toast.success("Droits enregistrés");
    resetDemo();
    onClose();
  }

  return (
    <Dialog open={!!user} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            Droits de {user.firstName} {user.lastName}
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            Modèle de départ : {ROLE_LABELS[user.role]}
          </p>
        </DialogHeader>
        {isAdmin ? (
          <p className="text-sm text-muted-foreground">Un administrateur a accès à tout.</p>
        ) : (
          <div className="divide-y divide-border rounded-lg border border-border">
            {ALL_MODULES.map((m: ModuleKey) => {
              const adminOnly = m === "users" || m === "settings";
              return (
                <div key={m} className="flex items-center justify-between gap-3 px-3 py-2">
                  <span className="text-sm font-medium">{MODULE_LABELS[m]}</span>
                  <div className="flex gap-1">
                    {LEVELS.filter((l) => !(adminOnly && l.v === "write")).map((l) => (
                      <button
                        key={l.v}
                        type="button"
                        onClick={() => setLevels((s) => ({ ...s, [m]: l.v }))}
                        className={cn(
                          "rounded-md border px-2.5 py-1 text-xs font-medium transition-colors",
                          levels[m] === l.v
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-input bg-background hover:bg-accent",
                        )}
                      >
                        {l.label}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => setLevels(Object.fromEntries(ALL_MODULES.map((m) => [m, roleLevel(user.role, m)])))}
            disabled={isAdmin}
          >
            Revenir au rôle
          </Button>
          <Button type="button" onClick={() => void save()} disabled={busy || isAdmin}>
            {busy ? "Enregistrement…" : "Enregistrer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
