import { createFileRoute } from "@tanstack/react-router";
import { RotateCcw, Save } from "lucide-react";
import { useEffect, useState } from "react";
import { Download } from "lucide-react";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/common/PageHeader";
import { Field } from "@/components/common/Field";
import { selectClass } from "@/components/common/select-class";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useApp } from "@/context/AppContext";

export const Route = createFileRoute("/parametres")({
  ssr: false,
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { title: "Paramètres — Medjadja Olive" },
      {
        name: "description",
        content: "Informations de l'unité, devise, unité par défaut et seuil de stock faible.",
      },
      { property: "og:title", content: "Paramètres — Medjadja Olive" },
      { property: "og:description", content: "Configuration de l'application de gestion." },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const { state, saveSettings, log, canEdit, resetDemo } = useApp();
  const editable = canEdit("settings");
  const [form, setForm] = useState(state.settings);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!(await saveSettings(form))) return;
    log("a modifié les paramètres", "Paramètres", form.companyName);
    toast.success("Paramètres enregistrés");
  }

  return (
    <AppShell module="settings">
      <PageHeader
        title="Paramètres"
        subtitle="Informations de l'unité et préférences de l'application"
      />

      <form onSubmit={submit} className="space-y-6">
        <div className="card-surface p-5">
          <h2 className="mb-4 font-display text-base font-semibold">Unité de production</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Nom de l'unité">
              <Input
                disabled={!editable}
                value={form.companyName}
                onChange={(e) => setForm({ ...form, companyName: e.target.value })}
              />
            </Field>
            <Field label="Téléphone">
              <Input
                disabled={!editable}
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
            </Field>
            <Field label="Adresse">
              <Input
                disabled={!editable}
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
              />
            </Field>
            <Field label="Wilaya">
              <Input
                disabled={!editable}
                value={form.wilaya}
                onChange={(e) => setForm({ ...form, wilaya: e.target.value })}
              />
            </Field>
            <Field label="Numéro fiscal">
              <Input
                disabled={!editable}
                value={form.taxNumber}
                onChange={(e) => setForm({ ...form, taxNumber: e.target.value })}
              />
            </Field>
          </div>
        </div>

        <div className="card-surface p-5">
          <h2 className="mb-4 font-display text-base font-semibold">Préférences</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Devise">
              <Input
                disabled={!editable}
                value={form.currency}
                onChange={(e) => setForm({ ...form, currency: e.target.value })}
              />
            </Field>
            <Field label="Unité par défaut">
              <select
                className={selectClass}
                disabled={!editable}
                value={form.defaultUnit}
                onChange={(e) => setForm({ ...form, defaultUnit: e.target.value as "L" | "kg" })}
              >
                <option value="L">Litre (L)</option>
                <option value="kg">Kilogramme (kg)</option>
              </select>
            </Field>
            <Field label="Seuil d'alerte de stock faible (%)">
              <Input
                type="number"
                min="0"
                disabled={!editable}
                value={form.lowStockThreshold}
                onChange={(e) => setForm({ ...form, lowStockThreshold: Number(e.target.value) })}
              />
            </Field>
            <Field label="Format des numéros">
              <Input
                disabled={!editable}
                value={form.numberFormat}
                onChange={(e) => setForm({ ...form, numberFormat: e.target.value })}
              />
            </Field>
            <Field
              label="Imprimer automatiquement après enregistrement"
              hint="Après une réception d'olives, ouvre directement le dialogue d'impression du reçu A5."
            >
              <div className="flex h-9 items-center gap-3">
                <Switch
                  disabled={!editable}
                  checked={form.autoPrintReceipt ?? false}
                  onCheckedChange={(v) => setForm({ ...form, autoPrintReceipt: v })}
                  aria-label="Imprimer automatiquement après enregistrement"
                />
                <span className="text-sm text-muted-foreground">
                  {(form.autoPrintReceipt ?? false) ? "Activée" : "Désactivée"}
                </span>
              </div>
            </Field>
          </div>
        </div>

        {editable && (
          <div className="flex flex-wrap gap-3">
            <Button type="submit">
              <Save className="mr-1.5 h-4 w-4" /> Enregistrer
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                resetDemo();
                toast.success("Données actualisées depuis le serveur");
              }}
            >
              <RotateCcw className="mr-1.5 h-4 w-4" /> Actualiser les données
            </Button>
          </div>
        )}
      </form>

      {editable && <BackupSection />}
    </AppShell>
  );
}

const BACKUP_TABLES = [
  ["fournisseurs", "suppliers"],
  ["receptions", "olive_receptions"],
  ["productions", "productions"],
  ["stock", "stock_items"],
  ["mouvements", "stock_movements"],
  ["clients", "customers"],
  ["ventes", "sales"],
  ["lignes_vente", "sale_items"],
  ["paiements", "payments"],
  ["depenses", "expenses"],
  ["historique", "activity_logs"],
  ["parametres", "settings"],
] as const;

function BackupSection() {
  const { log } = useApp();
  const [last, setLast] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void api.list<Record<string, unknown>>("settings")
      .then((rows) => {
        const s = rows.find((r) => Number(r["id"]) === 1) ?? rows[0];
        setLast((s?.["last_backup_at"] as string | undefined) ?? null);
      })
      .catch(() => undefined);
  }, []);

  async function exportAll() {
    setBusy(true);
    try {
      const out: Record<string, unknown> = { exporte_le: new Date().toISOString() };
      for (const [label, table] of BACKUP_TABLES) {
        out[label] = await api.list(table);
      }
      const blob = new Blob([JSON.stringify(out, null, 2)], { type: "application/json" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `sauvegarde-huilerie-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(a.href);
      const now = new Date().toISOString();
      await api.update("settings", 1, { last_backup_at: now });
      setLast(now);
      log("a exporté une sauvegarde des données", "Paramètres", "Sauvegarde");
      toast.success("Sauvegarde téléchargée");
    } catch {
      toast.error("La sauvegarde a échoué. Réessayez.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card-surface mt-6 p-5">
      <h2 className="mb-1 font-display text-base font-semibold">Sauvegarde des données</h2>
      <p className="mb-4 text-sm text-muted-foreground">
        Télécharge fournisseurs, réceptions, productions, stock, mouvements, clients, ventes, paiements,
        dépenses et historique dans un seul fichier. Conservez-le sur une clé USB ou un disque externe.
      </p>
      <div className="flex flex-wrap items-center gap-4">
        <Button type="button" onClick={exportAll} disabled={busy}>
          <Download className="mr-1.5 h-4 w-4" /> {busy ? "Export en cours…" : "Exporter les données"}
        </Button>
        <span className="text-sm text-muted-foreground">
          Dernière sauvegarde :{" "}
          {last ? new Date(last).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" }) : "jamais"}
        </span>
      </div>
    </div>
  );
}
