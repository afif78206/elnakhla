import { createPortal } from "react-dom";
import { logoUrl } from "@/lib/brand";
import { printThermalTicket } from "@/lib/ticket-print";
import { formatDA, formatDateTime, formatNumber } from "@/lib/format";
import type { Settings } from "@/lib/types";

export interface TicketData {
  title: string; // "TICKET DE VENTE" / "BON DE LIVRAISON"
  number: string;
  at: string;
  driver: string;
  vehicle: string;
  customer?: string;
  lines: { name: string; qty: number; price: number; bundles?: number | null; bundleSize?: number | null }[];
  total: number;
  paid: number;
  mode: string;
  variant?: "showroom";
  received?: number;
  change?: number;
  gift?: boolean;
}

export function TicketContent({ t, settings }: { t: TicketData; settings: Settings }) {
  const rest = t.total - t.paid;
  const showroom = t.variant === "showroom";
  const paymentLabel = t.mode === "espèces" ? "Cash" : t.mode;
  return (
    <div className={`ticket-80${showroom ? " tk-showroom" : ""}`}>
      <div className="tk-center">
        <img className="tk-logo" src={logoUrl} alt="Logo" />
        <div className="tk-title">{settings.companyName}</div>
        {settings.address && <div>{settings.address}</div>}
        {showroom && settings.wilaya && <div>{settings.wilaya}</div>}
        {settings.phone && <div>Tél : {settings.phone}</div>}
        {showroom && settings.taxNumber && <div>NIF : {settings.taxNumber}</div>}
      </div>
      <div className="tk-sep" />
      <div className="tk-center tk-title">{t.title}</div>
      <div className="tk-center">N° {t.number}</div>
      <div>Date : {formatDateTime(t.at)}</div>
      <div>{showroom ? "Caissier" : "Chauffeur"} : {t.driver}</div>
      {!showroom && <div>Véhicule : {t.vehicle}</div>}
      {t.customer && <div>Client : {t.customer}</div>}
      <div className="tk-sep" />
      {showroom && <div className="tk-row tk-column-head"><span>Description</span><span>{t.gift ? "Quantité" : "Prix (DA)"}</span></div>}
      {t.lines.map((l, i) => (
        <div key={i}>
          <div>{l.name}</div>
          <div className="tk-row">
            <span>
              {t.gift ? "Offert" : `${formatNumber(l.qty)} x ${formatNumber(l.price)}`}
            </span>
            <span className="tk-amount">{t.gift ? formatNumber(l.qty) : showroom ? formatNumber(l.qty * l.price, 2) : formatDA(l.qty * l.price)}</span>
          </div>
        </div>
      ))}
      <div className="tk-sep" />
      <div className="tk-row tk-big">
        <span>TOTAL</span>
        <span>{formatDA(t.total)}</span>
      </div>
      {t.gift ? <div className="tk-center tk-title">CADEAU — AUCUN ENCAISSEMENT</div> : <div className="tk-row">
        <span>{showroom ? paymentLabel : `Payé (${t.mode})`}</span>
        <span className="tk-amount">{formatDA(t.paid)}</span>
      </div>}
      {showroom && !t.gift && t.mode === "espèces" && <>
        <div className="tk-row"><span>Reçu</span><span className="tk-amount">{formatDA(t.received ?? t.paid)}</span></div>
        <div className="tk-row"><span>Monnaie rendue</span><span className="tk-amount">{formatDA(t.change ?? 0)}</span></div>
      </>}
      {rest > 0 && (
        <div className="tk-row">
          <span>Reste (crédit)</span>
          <span>{formatDA(rest)}</span>
        </div>
      )}
      <div className="tk-sep" />
      <div className="tk-center tk-thanks">Merci de votre confiance</div>
    </div>
  );
}

export function TicketPrintPortal({ t, settings }: { t: TicketData | null; settings: Settings }) {
  if (!t || typeof document === "undefined") return null;
  return createPortal(
    <div className="ticket-print-root">
      <TicketContent t={t} settings={settings} />
    </div>,
    document.body,
  );
}

export function printTicket() {
  void printThermalTicket(80);
}
