import { ScanLine, TriangleAlert, UserPlus } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Field } from "@/components/common/Field";
import { IdScanDialog } from "@/components/reception/IdScanDialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useApp } from "@/context/AppContext";
import { uid } from "@/lib/format";
import { similarName } from "@/lib/text";
import type { Supplier } from "@/lib/types";

interface QuickFarmerDialogProps {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  initialQuery: string;
  suppliers: Supplier[];
  onDone: (s: Supplier) => void;
}

const EMPTY_FORM = { nom: "", prenom: "", phone: "", commune: "", wilaya: "" };

/** Ajout express d'un agriculteur depuis la réception, avec détection de doublon. */
export function QuickFarmerDialog({
  open,
  onOpenChange,
  initialQuery,
  suppliers,
  onDone,
}: QuickFarmerDialogProps) {
  const { add, log } = useApp();
  const [form, setForm] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [dup, setDup] = useState<Supplier | null>(null);
  const [scanOpen, setScanOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    const words = initialQuery.trim().split(/\s+/).filter(Boolean);
    setForm({ ...EMPTY_FORM, nom: words[0] ?? "", prenom: words.slice(1).join(" ") });
    setErrors({});
    setDup(null);
  }, [open, initialQuery]);

  const fullName = () => `${form.nom.trim()} ${form.prenom.trim()}`.replace(/\s+/g, " ").trim();

  async function save(force: boolean) {
    const errs: Record<string, string> = {};
    if (!form.nom.trim()) errs["nom"] = "Le nom est obligatoire.";
    if (!form.prenom.trim()) errs["prenom"] = "Le prénom est obligatoire.";
    setErrors(errs);
    if (Object.keys(errs).length) return;

    if (!force) {
      const similar = suppliers.find((s) => similarName(s.name, fullName()));
      if (similar) {
        setDup(similar);
        return;
      }
    }

    setBusy(true);
    const supplier: Supplier = {
      id: uid(),
      name: fullName(),
      company: "",
      phone: form.phone.trim(),
      address: "",
      wilaya: form.wilaya.trim(),
      commune: form.commune.trim(),
      type: "agriculteur",
      notes: "",
      createdAt: new Date().toISOString(),
    };
    const ok = await add("suppliers", supplier);
    setBusy(false);
    if (!ok) return;
    log("a ajouté un agriculteur", "Fournisseurs", supplier.name);
    toast.success(`Agriculteur ${supplier.name} enregistré`);
    onDone(supplier);
    onOpenChange(false);
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5 text-primary" /> Nouvel agriculteur
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Nom *" error={errors["nom"]}>
                <Input
                  value={form.nom}
                  onChange={(e) => {
                    setForm({ ...form, nom: e.target.value });
                    setDup(null);
                  }}
                />
              </Field>
              <Field label="Prénom *" error={errors["prenom"]}>
                <Input
                  value={form.prenom}
                  onChange={(e) => {
                    setForm({ ...form, prenom: e.target.value });
                    setDup(null);
                  }}
                />
              </Field>
              <Field label="Téléphone">
                <Input
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                />
              </Field>
              <Field label="Commune">
                <Input
                  value={form.commune}
                  onChange={(e) => setForm({ ...form, commune: e.target.value })}
                />
              </Field>
              <Field label="Wilaya">
                <Input
                  value={form.wilaya}
                  onChange={(e) => setForm({ ...form, wilaya: e.target.value })}
                />
              </Field>
            </div>

            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={() => setScanOpen(true)}
            >
              <ScanLine className="mr-1.5 h-4 w-4" /> Scanner la carte d'identité (optionnel)
            </Button>

            {dup && (
              <div className="rounded-lg border border-warning/40 bg-warning/10 p-3">
                <p className="flex items-center gap-2 text-sm font-medium text-warning-foreground">
                  <TriangleAlert className="h-4 w-4 shrink-0" /> Un agriculteur similaire existe déjà
                </p>
                <p className="mt-1 text-sm">
                  {dup.name}
                  {[dup.commune, dup.wilaya].filter(Boolean).length > 0 && (
                    <span className="text-muted-foreground">
                      {" "}— {[dup.commune, dup.wilaya].filter(Boolean).join(" — ")}
                    </span>
                  )}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      onDone(dup);
                      onOpenChange(false);
                    }}
                  >
                    Utiliser cette fiche
                  </Button>
                  <Button type="button" size="sm" onClick={() => void save(true)} disabled={busy}>
                    Créer quand même
                  </Button>
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Annuler
            </Button>
            <Button type="button" onClick={() => void save(false)} disabled={busy}>
              {busy ? "Enregistrement…" : "Enregistrer et sélectionner"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <IdScanDialog
        open={scanOpen}
        onOpenChange={setScanOpen}
        onApply={(nom, prenom) => {
          setForm((f) => ({ ...f, nom: nom || f.nom, prenom: prenom || f.prenom }));
          setScanOpen(false);
        }}
      />
    </>
  );
}
