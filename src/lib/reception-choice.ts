import type { ClientChoice, PaymentStatus, TransformStatus } from "@/lib/types";

export const CHOICE_LABELS: Record<ClientChoice, string> = {
  NON_RENSEIGNE: "Non renseigné",
  VENTE_OLIVES: "Vente des olives",
  TRANSFORMATION_HUILE: "Transformation en huile",
  MIXTE: "Mixte",
};

export const CHOICE_BADGES: Record<ClientChoice, string> = {
  NON_RENSEIGNE: "EN ATTENTE",
  VENTE_OLIVES: "VENTE OLIVES",
  TRANSFORMATION_HUILE: "HUILE",
  MIXTE: "MIXTE",
};

export const TRANSFORM_LABELS: Record<TransformStatus, string> = {
  EN_ATTENTE: "En attente de production",
  HUILE_DISPONIBLE: "Huile disponible",
  HUILE_RECUPEREE: "Huile récupérée",
};

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  PAYÉ: "PAYÉ",
  PARTIELLEMENT_PAYÉ: "PARTIELLEMENT PAYÉ",
  NON_PAYÉ: "NON PAYÉ",
};

/** Le choix implique-t-il un paiement à l'agriculteur ? */
export const isPayable = (c: ClientChoice) => c === "VENTE_OLIVES" || c === "MIXTE";

/** Le choix implique-t-il une transformation en huile ? */
export const hasTransform = (c: ClientChoice) => c === "TRANSFORMATION_HUILE" || c === "MIXTE";
