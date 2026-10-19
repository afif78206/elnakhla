import { jsPDF } from "jspdf";
import { logoUrl } from "@/lib/brand";
import type { ReceiptData } from "@/components/reception/ReceptionReceipt";
import { formatDate } from "@/lib/format";
import type { Settings } from "@/lib/types";

/** Nombre formaté avec espaces simples (compatible WinAnsi/jsPDF). */
function pdfNum(value: number): string {
  const rounded = Math.round(value * 100) / 100;
  const [int, dec] = String(rounded).split(".");
  const grouped = (int ?? "0").replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return dec ? `${grouped},${dec.padEnd(2, "0").slice(0, 2)}` : grouped;
}

/** Charge le logo et le convertit en data URL pour jsPDF. */
async function loadLogoDataUrl(): Promise<string | null> {
  try {
    const res = await fetch(logoUrl);
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : null);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

/** Charge une police arabe (Amiri) depuis Google Fonts pour le PDF. */
async function loadArabicFont(doc: jsPDF): Promise<boolean> {
  try {
    const res = await fetch(
      "https://fonts.gstatic.com/s/amiri/v27/J7aRnpd8CGxBHqUpvrIw74NL.ttf",
    );
    if (!res.ok) return false;
    const buf = await res.arrayBuffer();
    const bytes = new Uint8Array(buf);
    let binary = "";
    const chunk = 8192;
    for (let i = 0; i < bytes.length; i += chunk) {
      binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
    }
    const base64 = btoa(binary);
    doc.addFileToVFS("Amiri.ttf", base64);
    doc.addFont("Amiri.ttf", "Amiri", "normal");
    doc.addFont("Amiri.ttf", "Amiri", "bold");
    return true;
  } catch {
    return false;
  }
}

/** Génère et télécharge le bon de réception au format PDF A5 portrait. */
export async function downloadReceiptPdf(data: ReceiptData, settings: Settings): Promise<void> {
  const { reception: r, supplier } = data;
  const doc = new jsPDF({ unit: "mm", format: "a5", orientation: "portrait" });
  const W = 148;
  const M = 10;
  const dzd = (v: number) => `${pdfNum(v)} DZD`;
  const logoData = await loadLogoDataUrl();
  const hasArabic = await loadArabicFont(doc);

  // En-tête : logo + unité à gauche, numéros à droite
  if (logoData) {
    try {
      doc.addImage(logoData, "PNG", M, 12, 18, 18);
    } catch {
      doc.setFillColor(17, 17, 17);
      doc.rect(M, 12, 18, 18, "F");
    }
  } else {
    doc.setFillColor(17, 17, 17);
    doc.rect(M, 12, 18, 18, "F");
  }
  doc.setTextColor(0);
  doc.setFontSize(11);
  doc.text(settings.companyName || "Huilerie", M + 21, 17);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  const addr = [settings.address, settings.wilaya].filter(Boolean).join(", ");
  if (addr) doc.text(addr, M + 21, 21.5);
  if (settings.phone) doc.text(`Tél. ${settings.phone}`, M + 21, 25.5);

  doc.setDrawColor(130);
  doc.setLineWidth(0.25);
  doc.setLineDashPattern([1, 1], 0);
  doc.roundedRect(W - M - 50, 11, 50, 7, 1, 1);
  doc.setLineDashPattern([], 0);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text(`RCE N°${r.number}`, W - M - 25, 15.8, { align: "center" });
  doc.roundedRect(W - M - 50, 20, 50, 10, 1, 1);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.text(`BN-${r.number}`, W - M - 25, 26, { align: "center" });

  // Client
  let y = 40;
  doc.roundedRect(M, y, W - 2 * M, 8, 1, 1);
  doc.setFontSize(10);
  doc.text("Client :", M + 3, y + 5.5);
  doc.setFont("helvetica", "bold");
  const extra = [supplier?.phone ? `Tél. ${supplier.phone}` : "", supplier ? [supplier.commune, supplier.wilaya].filter(Boolean).join(" — ") : ""].filter(Boolean).join(" — ");
  doc.text(supplier?.name || "-", M + 17, y + 5.5);
  if (extra) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.text(extra, W - M - 3, y + 5.5, { align: "right" });
  }

  // Tableau article / quantité / date
  y += 11;
  const cols = [M, M + 50, M + 95, W - M];
  const head = ["ARTICLE", "QUANTITÉ OLIVE (kg)", "DATE"];
  const body = [
    `Olive (récolte)${r.variety ? ` — ${r.variety}` : ""}`,
    `${pdfNum(r.weightKg)} kg`,
    `${formatDate(r.date)}${r.time ? ` ${r.time}` : ""}`,
  ];
  for (let i = 0; i < 3; i++) {
    doc.rect(cols[i]!, y, cols[i + 1]! - cols[i]!, 7);
    doc.rect(cols[i]!, y + 7, cols[i + 1]! - cols[i]!, 7);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.text(head[i]!, cols[i]! + 2, y + 4.8);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text(body[i]!, cols[i]! + 2, y + 11.8, { maxWidth: cols[i + 1]! - cols[i]! - 3 });
  }
  y += 20;

  doc.setFontSize(9);
  const row = (label: string, value: string, bold = false) => {
    y += 5.5;
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.text(label, M + 2, y);
    doc.setFont("helvetica", "bold");
    doc.text(value, W - M, y, { align: "right" });
    doc.setDrawColor(170);
    doc.line(M, y + 1.5, W - M, y + 1.5);
  };
  row("Prix olive", `${pdfNum(r.pricePerKg)} DZD / kg`);
  if (r.clientChoice === "VENTE_OLIVES" || r.clientChoice === "MIXTE") {
    row("Montant à payer", dzd(r.total));
    row("Total payé au client", dzd(r.paid), true);
    if (r.remaining > 0) row("Reste à payer", dzd(r.remaining));
  }
  if (r.notes) {
    y += 7;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    const lines = doc.splitTextToSize(`Observations : ${r.notes}`, W - 2 * M) as string[];
    doc.text(lines.slice(0, 3), M, y);
  }

  // Remarque obligatoire (arabe) en bas du bon
  const remark =
    "يتم تقديم الوصل اجباري عند كل طلب و المؤسسة غير مسؤولة عند ضياع الوصل لتعويض قيمته";
  if (hasArabic) {
    doc.setFont("Amiri", "bold");
    doc.setFontSize(11);
    const remarkLines = doc.splitTextToSize(remark, W - 2 * M) as string[];
    doc.text(remarkLines, W / 2, 168, { align: "center", isInputRtl: true });
  } else {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text("Remarque obligatoire — voir le bon imprimé", W / 2, 168, { align: "center" });
  }

  doc.save(`${r.number || "recu-reception"}.pdf`);
}
