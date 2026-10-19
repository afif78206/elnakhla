export type OrderKind = "DETAIL" | "CADEAU" | "GROS";

export function parseOrderQuantity(value: string): number {
  return value.trim() ? Number(value.replace(",", ".")) : 0;
}

export function bundleQuantity(count: string, size: string): number {
  const bundles = parseOrderQuantity(count);
  const units = parseOrderQuantity(size);
  if (!Number.isSafeInteger(bundles) || !Number.isSafeInteger(units) || bundles < 0 || units < 0) return NaN;
  const total = bundles * units;
  return Number.isSafeInteger(total) ? total : NaN;
}

export function orderAmounts(kind: OrderKind, lines: { qty: number; price: number }[], received: string) {
  const total = kind === "CADEAU" ? 0 : lines.reduce((sum, line) => sum + line.qty * line.price, 0);
  const amount = received.trim() ? Number(received.replace(",", ".")) : total;
  if (!Number.isFinite(amount) || amount < 0) throw new Error("Montant reçu invalide");
  if (kind === "GROS" && amount > total) throw new Error("Le paiement dépasse le total");
  if (kind === "DETAIL" && amount < total) throw new Error("Montant reçu insuffisant");
  const paid = kind === "CADEAU" ? 0 : kind === "GROS" ? amount : total;
  return { total, paid, remaining: total - paid, received: kind === "CADEAU" ? 0 : amount, change: kind === "DETAIL" ? Math.max(amount - total, 0) : 0 };
}
export interface WholesaleTier { min: number; price: number }
export interface PricedItem { salePrice?: number; wholesalePrice?: number; wholesaleTiers?: WholesaleTier[] | unknown }

/** Prix unitaire de gros : palier le plus haut atteint, sinon prix de gros, sinon prix de détail (même règle que le serveur). */
export function wholesaleUnitPrice(item: PricedItem, qty: number): number {
  const tiers = Array.isArray(item.wholesaleTiers) ? (item.wholesaleTiers as WholesaleTier[]) : [];
  const tier = tiers.filter((t) => Number(t.price) > 0 && Number(t.min) <= qty).sort((a, b) => Number(b.min) - Number(a.min))[0];
  if (tier) return Number(tier.price);
  if (Number(item.wholesalePrice ?? 0) > 0) return Number(item.wholesalePrice);
  return Number(item.salePrice ?? 0);
}

/** Lecture des paliers saisis sous la forme « 120:950, 240:900 » (quantité minimale en unités : prix). */
export function parseTiers(text: string): WholesaleTier[] | null {
  if (!text.trim()) return [];
  const out: WholesaleTier[] = [];
  for (const part of text.split(/[;,\n]+/)) {
    if (!part.trim()) continue;
    const [a, b] = part.split(":");
    const min = Number((a ?? "").trim()); const price = Number((b ?? "").trim().replace(",", "."));
    if (!Number.isFinite(min) || min <= 0 || !Number.isFinite(price) || price <= 0) return null;
    out.push({ min, price });
  }
  return out.sort((x, y) => x.min - y.min);
}

/** Dette globale d'un client = somme des restes de ses ventes. */
export function customerDebt(sales: { customerId: string; remaining: number }[], customerId: string): number {
  return sales.filter((s) => s.customerId === customerId).reduce((sum, s) => sum + Math.max(Number(s.remaining) || 0, 0), 0);
}

export function checkRepayment(debt: number, amount: number): string | null {
  if (!Number.isFinite(amount) || amount <= 0) return "Montant invalide";
  if (amount > debt) return "Le versement dépasse la dette du client";
  return null;
}
