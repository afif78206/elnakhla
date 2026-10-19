import { createPortal } from "react-dom";
import { logoUrl } from "@/lib/brand";
import { formatDate, formatNumber } from "@/lib/format";
import type { Reception, Settings, Supplier } from "@/lib/types";

export interface ReceiptData {
  reception: Reception;
  supplier: Supplier | undefined;
}

const place = (s: Supplier | undefined) =>
  s ? [s.commune, s.wilaya].filter(Boolean).join(" — ") : "";

/** Contenu du bon de réception A5 (aperçu écran + impression). */
export function ReceiptContent({ data, settings }: { data: ReceiptData; settings: Settings }) {
  const { reception: r, supplier } = data;
  const payable = r.clientChoice === "VENTE_OLIVES" || r.clientChoice === "MIXTE";
  return (
    <div className="receipt-a5">
      <header className="rc-top">
        <div className="rc-brand">
          <img className="rc-logo" src={logoUrl} alt="Logo" />
          <div>
            <p className="rc-company">{settings.companyName || "Huilerie"}</p>
            {(settings.address || settings.wilaya) && (
              <p className="rc-line">{[settings.address, settings.wilaya].filter(Boolean).join(", ")}</p>
            )}
            {settings.phone && <p className="rc-line">Tél. {settings.phone}</p>}
          </div>
        </div>
        <div className="rc-ref">
          <p className="rc-num">RCE N°{r.number}</p>
          <p className="rc-bn">BN-{r.number}</p>
        </div>
      </header>

      <div className="rc-client">
        Client : <strong>{supplier?.name || "—"}</strong>
        {supplier?.phone && <span className="rc-client-sub"> — Tél. {supplier.phone}</span>}
        {place(supplier) && <span className="rc-client-sub"> — {place(supplier)}</span>}
      </div>

      <table className="rc-grid">
        <thead>
          <tr>
            <th>ARTICLE</th>
            <th>QUANTITÉ OLIVE (kg)</th>
            <th>DATE</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Olive (récolte){r.variety ? ` — ${r.variety}` : ""}</td>
            <td>{formatNumber(r.weightKg, 0)} kg</td>
            <td>
              {formatDate(r.date)}
              {r.time ? ` ${r.time}` : ""}
            </td>
          </tr>
        </tbody>
      </table>

      <div className="rc-lines">
        <p className="rc-row">
          <span>Prix olive</span>
          <strong>{formatNumber(r.pricePerKg, 2)} DZD / kg</strong>
        </p>
        {payable && (
          <>
            <p className="rc-row">
              <span>Montant à payer</span>
              <strong>{formatNumber(r.total, 2)} DZD</strong>
            </p>
            <p className="rc-row rc-strong">
              <span>Total payé au client</span>
              <strong>{formatNumber(r.paid, 2)} DZD</strong>
            </p>
            {r.remaining > 0 && (
              <p className="rc-row">
                <span>Reste à payer</span>
                <strong>{formatNumber(r.remaining, 2)} DZD</strong>
              </p>
            )}
          </>
        )}
        {r.notes && <p className="rc-notes">Observations : {r.notes}</p>}
      </div>

      <p className="rc-remark">
        يتم تقديم الوصل اجباري عند كل طلب و المؤسسة غير مسؤولة عند ضياع الوصل لتعويض قيمته
      </p>
    </div>
  );
}

/** Copie invisible à l'écran, portée au niveau body : seule elle s'imprime. */
export function ReceiptPrintPortal({ data, settings }: { data: ReceiptData | null; settings: Settings }) {
  if (!data) return null;
  return createPortal(
    <div className="receipt-print-root">
      <ReceiptContent data={data} settings={settings} />
    </div>,
    document.body,
  );
}
