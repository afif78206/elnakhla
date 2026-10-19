import { createPortal } from "react-dom";
import { logoUrl } from "@/lib/brand";
import { formatDate, formatNumber } from "@/lib/format";
import type { Settings } from "@/lib/types";
import type { TicketData } from "@/components/fleet/Ticket80";

/** Textes de l'en-tête du carnet papier original (confirmés par l'utilisateur). */
const HEADER_AR = "وحدة تحويل و تصبير الزيت والزيتون";
const OWNER_AR = "صانع أحمد";
const ADDRESS_AR = ["طريق بارمول الزبوجة", "مجاجة ولاية الشلف"];
const PHONES = ["Tél : 027.49.38.38/10", "Fax : 027.49.38.14", "Mobile : 06 96 31 42 29"];
const REMARK_AR = "ملاحظة : يتم تقديم الوصل إجباري عند كل طلب ، و المؤسسة غير مسؤولة عند ضياع الوصل لتعويض قيمته .";
const MIN_ROWS = 8;

const money = (v: number) => formatNumber(Math.round(v * 100) / 100);

export function WholesaleReceipt({ t }: { t: TicketData; settings?: Settings }) {
  const rest = Math.max(t.total - t.paid, 0);
  const empty = Math.max(MIN_ROWS - t.lines.length, 0);
  return <article className="wholesale-a5">
    <div className="wg-watermark" aria-hidden lang="ar">النخلة</div>
    <header className="wg-head">
      <div className="wg-phones">{PHONES.map((p) => <p key={p}>{p}</p>)}</div>
      <div className="wg-title">
        <img src={logoUrl} alt="Medjadja Olive" />
        <p className="wg-bon"><span>Bon Pour</span> <span lang="ar">وصل</span></p>
        <p className="wg-num">N° <strong>{t.number}</strong></p>
      </div>
      <div className="wg-ar" lang="ar" dir="rtl">
        <h1>{HEADER_AR}</h1>
        <h2>{OWNER_AR}</h2>
        {ADDRESS_AR.map((a) => <p key={a}>{a}</p>)}
      </div>
    </header>
    <div className="wg-meta" dir="rtl" lang="ar">
      <p><span>مجاجة في :</span> <b dir="ltr">{formatDate(t.at.slice(0, 10))}</b></p>
      <p><span>السيد :</span> <b>{t.customer || "—"}</b></p>
    </div>
    <table>
      <thead><tr><th>Quantité</th><th>Désignation</th><th>Prix Unitaire</th><th>Montant</th></tr></thead>
      <tbody>
        {t.lines.map((l, i) => <tr key={i}><td>{formatNumber(l.qty)}{l.bundles ? <small> ({l.bundles} × {l.bundleSize})</small> : null}</td><td>{l.name}</td><td>{money(l.price)}</td><td>{money(l.qty * l.price)}</td></tr>)}
        {Array.from({ length: empty }).map((_, i) => <tr key={`e${i}`} className="wg-empty"><td /><td /><td /><td /></tr>)}
      </tbody>
      <tfoot><tr><td colSpan={2} className="wg-blank" /><th>Total</th><th>{money(t.total)} DA</th></tr></tfoot>
    </table>
    <div className="wg-boxes" dir="rtl" lang="ar">
      <div><span>التسبيقات <small dir="ltr">Versé</small></span><b dir="ltr">{money(t.paid)} DA</b></div>
      <div><span>الباقي <small dir="ltr">Reste</small></span><b dir="ltr">{money(rest)} DA</b></div>
      <div><span>خالص <small dir="ltr">Soldé</small></span><b>{rest <= 0 ? "✓" : ""}</b></div>
    </div>
    <p className="wg-remark" lang="ar" dir="rtl">{REMARK_AR}</p>
  </article>;
}

export function WholesalePrintPortal({ t, settings }: { t: TicketData | null; settings: Settings }) {
  if (!t || typeof document === "undefined") return null;
  return createPortal(<div className="wholesale-print-root"><WholesaleReceipt t={t} settings={settings} /></div>, document.body);
}

async function ready(root: Element) {
  await Promise.race([Promise.all([document.fonts.ready, ...Array.from(root.querySelectorAll("img")).map((img) => img.decode().catch(() => undefined))]), new Promise((r) => setTimeout(r, 4000))]);
}

export async function printWholesaleReceipt() {
  const root = document.querySelector(".wholesale-print-root");
  if (!root) return;
  await ready(root);
  const cleanup = () => { document.body.classList.remove("print-wholesale"); window.removeEventListener("afterprint", cleanup); };
  document.body.classList.add("print-wholesale");
  window.addEventListener("afterprint", cleanup);
  await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
  try { window.print(); } catch (error) { cleanup(); throw error; }
}

/** PDF A5 paysage (210 × 148 mm) rendu depuis le bon affiché. Ne touche pas au stock. */
export async function downloadWholesalePdf(number: string) {
  const el = document.querySelector<HTMLElement>(".wholesale-print-root .wholesale-a5");
  if (!el) return;
  await ready(el);
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([import("html2canvas"), import("jspdf")]);
  const holder = el.parentElement as HTMLElement;
  const prev = holder.style.cssText;
  holder.style.cssText = "display:block;position:fixed;left:-10000px;top:0;";
  try {
    const canvas = await html2canvas(el, { scale: 2.5, backgroundColor: "#ffffff", useCORS: true });
    const doc = new jsPDF({ unit: "mm", format: "a5", orientation: "landscape" });
    const w = 198, h = Math.min((canvas.height / canvas.width) * w, 136);
    doc.addImage(canvas.toDataURL("image/jpeg", 0.95), "JPEG", 6, 6, w, h);
    doc.save(`${number || "bon-gros"}.pdf`);
  } finally { holder.style.cssText = prev; }
}
