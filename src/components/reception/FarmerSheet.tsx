import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge } from "@/components/common/StatusBadge";
import { formatDA, formatDate, formatNumber } from "@/lib/format";
import { CHOICE_BADGES, PAYMENT_STATUS_LABELS, isPayable } from "@/lib/reception-choice";
import type { Reception, Supplier } from "@/lib/types";

interface FarmerSheetProps {
  supplier: Supplier | null;
  receptions: Reception[];
  onClose: () => void;
}

/** Fiche agriculteur : coordonnées, résumé des dépôts et historique des réceptions. */
export function FarmerSheet({ supplier, receptions, onClose }: FarmerSheetProps) {
  const rows = supplier
    ? receptions
        .filter((r) => r.supplierId === supplier.id)
        .sort((a, b) => (a.date < b.date ? 1 : -1))
    : [];
  const active = rows.filter((r) => !r.cancelled);
  const totalKg = active.reduce((s, r) => s + r.weightKg, 0);

  return (
    <Dialog open={!!supplier} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Fiche agriculteur — {supplier?.name}</DialogTitle>
        </DialogHeader>
        {supplier && (
          <div className="space-y-5">
            <div className="grid gap-3 text-sm sm:grid-cols-3">
              <Info label="Téléphone" value={supplier.phone || "—"} />
              <Info label="Commune" value={supplier.commune || "—"} />
              <Info label="Wilaya" value={supplier.wilaya || "—"} />
            </div>
            <div className="grid gap-3 rounded-xl bg-secondary/70 px-4 py-3 sm:grid-cols-2">
              <div>
                <p className="text-xs text-muted-foreground">Nombre de dépôts</p>
                <p className="font-display text-xl font-semibold">{active.length}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Total olives déposées</p>
                <p className="font-display text-xl font-semibold">{formatNumber(totalKg, 0)} kg</p>
              </div>
            </div>
            <div>
              <h3 className="mb-2 font-display text-sm font-semibold">Historique des réceptions</h3>
              {rows.length === 0 ? (
                <p className="text-sm text-muted-foreground">Aucune réception enregistrée.</p>
              ) : (
                <div className="overflow-x-auto rounded-lg border border-border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>N°</TableHead>
                        <TableHead className="text-right">Poids</TableHead>
                        <TableHead>Choix</TableHead>
                        <TableHead className="text-right">Montant</TableHead>
                        <TableHead className="text-right">Payé</TableHead>
                        <TableHead>Statut</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rows.map((r) => (
                        <TableRow key={r.id} className={r.cancelled ? "opacity-50" : undefined}>
                          <TableCell>{formatDate(r.date)}</TableCell>
                          <TableCell className="font-medium">{r.number}</TableCell>
                          <TableCell className="text-right">{formatNumber(r.weightKg, 0)} kg</TableCell>
                          <TableCell>
                            <StatusBadge tone={r.cancelled ? "neutral" : "info"}>
                              {r.cancelled ? "ANNULÉE" : CHOICE_BADGES[r.clientChoice]}
                            </StatusBadge>
                          </TableCell>
                          <TableCell className="text-right">{formatDA(r.total)}</TableCell>
                          <TableCell className="text-right">{formatDA(r.paid)}</TableCell>
                          <TableCell>
                            {!r.cancelled && isPayable(r.clientChoice) && (
                              <StatusBadge
                                tone={
                                  r.paymentStatus === "PAYÉ"
                                    ? "success"
                                    : r.paymentStatus === "PARTIELLEMENT_PAYÉ"
                                      ? "warning"
                                      : "danger"
                                }
                              >
                                {PAYMENT_STATUS_LABELS[r.paymentStatus]}
                              </StatusBadge>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-medium">{value}</p>
    </div>
  );
}
