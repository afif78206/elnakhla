import { toast } from "sonner";
import { api } from "@/lib/api";

export type DeliveryStatus = "A_LIVRER" | "EN_COURS" | "LIVREE" | "ECHEC" | "REPORTEE" | "ANNULEE";

export const DELIVERY_LABELS: Record<string, string> = {
  A_LIVRER: "À livrer",
  EN_COURS: "En cours",
  LIVREE: "Livrée",
  ECHEC: "Échec",
  REPORTEE: "Reportée",
  ANNULEE: "Annulée",
};
export const HANDOVER_LABELS: Record<string, string> = {
  A_REMETTRE: "À remettre",
  REMIS: "Remis",
  VALIDE: "Validé",
};
export const VMOV_LABELS: Record<string, string> = {
  CHARGEMENT: "Chargement",
  LIVRAISON: "Livraison",
  VENTE: "Vente directe",
  RETOUR: "Retour dépôt",
  PERTE: "Endommagé / manquant",
};
export const PAY_MODES = ["espèces", "virement", "chèque"] as const;

export interface CartLine {
  item_id: string;
  qty: number;
  price?: number;
}

function friendly(raw: string): string {
  if (/insuffisant|Impossible|introuvable|invalide|obligatoire|déjà/i.test(raw)) return raw;
  if (/permission|row-level/i.test(raw)) return "Vous n'avez pas les droits pour cette action.";
  if (/Failed to fetch|NetworkError/i.test(raw)) return "Connexion impossible. Vérifiez le réseau.";
  return "Opération impossible. Veuillez réessayer.";
}

let busy = false;
/** Appel serveur protégé contre le double clic. */
export async function rpc<T = unknown>(fn: string, args: Record<string, unknown>): Promise<T | null> {
  if (busy) return null;
  busy = true;
  try {
    const data = await api.rpc<T>(fn, args);
    return (data ?? true) as T;
  } catch (e) {
    toast.error(friendly(e instanceof Error ? e.message : ""));
    return null;
  } finally {
    busy = false;
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Row = any;

export interface FleetData {
  vehicles: Row[];
  vstock: Row[];
  routes: Row[];
  vmov: Row[];
  deliveries: Row[];
  deliveryItems: Row[];
  sales: Row[];
  saleItems: Row[];
  cash: Row[];
}

const FLEET_TABLES = [
  "vehicles",
  "vehicle_stock",
  "driver_routes",
  "vehicle_stock_movements",
  "deliveries",
  "delivery_items",
  "driver_sales",
  "driver_sale_items",
  "driver_cash_movements",
] as const;

export async function loadFleet(): Promise<FleetData> {
  const results = await Promise.all(FLEET_TABLES.map((t) => api.list<Row>(t).catch(() => [] as Row[])));
  const d = (rows: Row[] | undefined) => (rows ?? []).map(numify);
  return {
    vehicles: d(results[0]),
    vstock: d(results[1]),
    routes: d(results[2]),
    vmov: d(results[3]),
    deliveries: d(results[4]),
    deliveryItems: d(results[5]),
    sales: d(results[6]),
    saleItems: d(results[7]),
    cash: d(results[8]),
  };
}

function numify(r: Record<string, any>) {
  const o: Record<string, any> = { ...r };
  for (const k of ["quantity", "total", "paid", "remaining", "amount", "unit_price", "cash_expected", "cash_handed"])
    if (o[k] != null) o[k] = Number(o[k]);
  return o;
}

export const isToday = (iso: string) => !!iso && iso.slice(0, 10) === new Date().toISOString().slice(0, 10);
