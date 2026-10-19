import { ScanLine, TriangleAlert, UserPlus, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Field } from "@/components/common/Field";
import { IdScanDialog } from "@/components/reception/IdScanDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useApp } from "@/context/AppContext";
import { uid } from "@/lib/format";
import { similarName } from "@/lib/text";
import type { Supplier } from "@/lib/types";

interface Props {
  initialQuery: string;
  suppliers: Supplier[];
  onDone: (s: Supplier) => void;
  onCancel: () => void;
}

/** Saisie d'un nouvel agriculteur directement dans le formulaire de réception. */
export function InlineFarmerForm({ initialQuery, suppliers, onDone, onCancel }: Props) {
  const { add, log } = useApp();
  const words = initialQuery.trim().split(/\s+/).filter(Boolean);
  const [form, setForm] = useState({
    nom: words[0] ?? "",
    prenom: words.slice(1).join(" "),
    phone: "",
    commune: "",
    wilaya: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [dup, setDup] = useState<Supplier | null>(null);
  const [scanOpen, setScanOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const fullName = () => `${form.nom.trim()} ${form.prenom.trim()}`.replace(/\s+/g, " ").trim();
  const set = (k: keyof typeof form, v: string) => {
    setForm((f) => ({ ...f, [k]: v }));
    if (k === "nom" || k === "prenom") setDup(null);
  };

  async function save(force: boolean) {
    const errs: Record<string, string> = {};
    if (!form.nom.trim()) errs["nom"] = "Le nom est obligatoire.";
    if (!form.prenom.trim()) errs["prenom"] = "Le prénom est obligatoire.";
    setErrors(errs);
    if (Object.keys(errs).length) return;
    if (!force) {
      const similar = suppliers.find((s) => similarName(s.name, fullName()));
      if (similar) return setDup(similar);
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
  }

  return (
    <div className="space-y-3 rounded-lg border border-primary/30 bg-secondary/40 p-3">
      <div className="flex items-center justify-between">
        <p className="flex items-center gap-2 text-sm font-semibold text-primary">
          <UserPlus className="h-4 w-4" /> Nouvel agriculteur
        </p>
        <button type="button" onClick={onCancel} aria-label="Fermer" className="text-muted-foreground hover:text-foreground">
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Nom *" error={errors["nom"]}>
          <Input value={form.nom} onChange={(e) => set("nom", e.target.value)} autoFocus />
        </Field>
        <Field label="Prénom *" error={errors["prenom"]}>
          <Input value={form.prenom} onChange={(e) => set("prenom", e.target.value)} />
        </Field>
        <Field label="Téléphone">
          <Input value={form.phone} onChange={(e) => set("phone", e.target.value)} />
        </Field>
        <Field label="Commune">
          <Input value={form.commune} onChange={(e) => set("commune", e.target.value)} />
        </Field>
        <Field label="Wilaya">
          <Input value={form.wilaya} onChange={(e) => set("wilaya", e.target.value)} />
        </Field>
        <div className="flex items-end">
          <Button type="button" variant="outline" className="w-full" onClick={() => setScanOpen(true)}>
            <ScanLine className="mr-1.5 h-4 w-4" /> Scanner la carte
          </Button>
        </div>
      </div>

      {dup && (
        <div className="rounded-lg border border-warning/40 bg-warning/10 p-3">
          <p className="flex items-center gap-2 text-sm font-medium text-warning-foreground">
            <TriangleAlert className="h-4 w-4 shrink-0" /> Un agriculteur similaire existe déjà : {dup.name}
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => onDone(dup)}>
              Utiliser cette fiche
            </Button>
            <Button type="button" size="sm" onClick={() => void save(true)} disabled={busy}>
              Créer quand même
            </Button>
          </div>
        </div>
      )}

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" size="sm" onClick={onCancel}>
          Annuler
        </Button>
        <Button type="button" size="sm" onClick={() => void save(false)} disabled={busy}>
          {busy ? "Enregistrement…" : "Ajouter l'agriculteur"}
        </Button>
      </div>

      <IdScanDialog
        open={scanOpen}
        onOpenChange={setScanOpen}
        onApply={(nom, prenom) => {
          setForm((f) => ({ ...f, nom: nom || f.nom, prenom: prenom || f.prenom }));
          setScanOpen(false);
        }}
      />
    </div>
  );
}
