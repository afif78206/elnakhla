export function formatDA(amount: number): string {
  return `${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2 }).format(amount)} DA`;
}

export function formatNumber(value: number, digits = 2): string {
  return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: digits }).format(value);
}

export function formatDate(iso: string): string {
  if (!iso) return "—";
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
}

export function formatDateTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return `${formatDate(date.toISOString())} ${date.toTimeString().slice(0, 5)}`;
}

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export function nowTime(): string {
  return new Date().toTimeString().slice(0, 5);
}

export function daysAgoISO(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

export function nextNumber(prefix: string, existing: string[]): string {
  const year = new Date().getFullYear();
  const max = existing
    .filter((n) => n.startsWith(`${prefix}-${year}-`))
    .map((n) => Number(n.split("-")[2]) || 0)
    .reduce((a, b) => Math.max(a, b), 0);
  return `${prefix}-${year}-${String(max + 1).padStart(4, "0")}`;
}

export function uid(): string {
  return crypto.randomUUID();
}
