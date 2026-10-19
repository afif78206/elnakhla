import { createFileRoute } from "@tanstack/react-router";
import { History, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState } from "@/components/common/EmptyState";
import { selectClass } from "@/components/common/select-class";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useApp } from "@/context/AppContext";
import { formatDateTime } from "@/lib/format";

export const Route = createFileRoute("/historique")({
  ssr: false,
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { title: "Historique — Medjadja Olive" },
      {
        name: "description",
        content: "Journal des opérations : connexions, ajouts, modifications et suppressions.",
      },
      { property: "og:title", content: "Historique — Medjadja Olive" },
      { property: "og:description", content: "Journal d'activité de l'application." },
    ],
  }),
  component: HistoryPage,
});

function HistoryPage() {
  const { state } = useApp();
  const [query, setQuery] = useState("");
  const [module, setModule] = useState("tous");

  const modules = useMemo(
    () => [...new Set(state.logs.map((l) => l.module))].sort(),
    [state.logs],
  );
  const userName = (id: string) => {
    const u = state.users.find((x) => x.id === id);
    return u ? `${u.firstName} ${u.lastName}` : "Système";
  };

  const rows = useMemo(
    () =>
      state.logs
        .filter((l) => {
          const q = query.trim().toLowerCase();
          return (
            (!q ||
              `${userName(l.userId)} ${l.action} ${l.module} ${l.reference}`
                .toLowerCase()
                .includes(q)) &&
            (module === "tous" || l.module === module)
          );
        })
        .sort((a, b) => (a.at < b.at ? 1 : -1)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [state.logs, state.users, query, module],
  );

  return (
    <AppShell module="history">
      <PageHeader title="Historique des opérations" subtitle={`${rows.length} entrée(s)`} />

      <div className="card-surface overflow-hidden">
        <div className="grid gap-3 border-b border-border p-4 sm:grid-cols-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Utilisateur, action, référence…"
              className="pl-9"
            />
          </div>
          <select className={selectClass} value={module} onChange={(e) => setModule(e.target.value)}>
            <option value="tous">Tous les modules</option>
            {modules.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>

        {rows.length === 0 ? (
          <EmptyState
            icon={History}
            title="Aucune opération"
            description="Les actions des utilisateurs seront enregistrées ici."
          />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date et heure</TableHead>
                  <TableHead>Utilisateur</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Module</TableHead>
                  <TableHead>Référence</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((l) => (
                  <TableRow key={l.id}>
                    <TableCell>{formatDateTime(l.at)}</TableCell>
                    <TableCell className="font-medium">{userName(l.userId)}</TableCell>
                    <TableCell>{l.action}</TableCell>
                    <TableCell>{l.module}</TableCell>
                    <TableCell className="text-muted-foreground">{l.reference || "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </AppShell>
  );
}
