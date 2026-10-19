export type Role =
  | "ADMIN"
  | "RESPONSABLE_PRODUCTION"
  | "MAGASINIER"
  | "COMMERCIAL"
  | "COMPTABLE"
  | "CONSULTATION"
  | "CHAUFFEUR"
  | "VENDEUR";

export type ModuleKey =
  | "dashboard"
  | "receptions"
  | "production"
  | "stock"
  | "suppliers"
  | "customers"
  | "sales"
  | "expenses"
  | "caisse"
  | "reports"
  | "users"
  | "history"
  | "settings"
  | "flotte";

export interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  role: Role;
  active: boolean;
  password: string;
  createdAt: string;
  permissions?: Partial<Record<ModuleKey, "none" | "read" | "write">>;
}

export interface Supplier {
  id: string;
  name: string;
  company: string;
  phone: string;
  address: string;
  wilaya: string;
  commune: string;
  type: "agriculteur" | "fournisseur";
  notes: string;
  createdAt: string;
}

export interface Customer {
  id: string;
  name: string;
  company: string;
  phone: string;
  address: string;
  wilaya: string;
  type: "particulier" | "professionnel";
  notes: string;
  createdAt: string;
}

export type ClientChoice = "NON_RENSEIGNE" | "VENTE_OLIVES" | "TRANSFORMATION_HUILE" | "MIXTE";

export type PaymentStatus = "PAYÉ" | "PARTIELLEMENT_PAYÉ" | "NON_PAYÉ";

export type TransformStatus = "EN_ATTENTE" | "HUILE_DISPONIBLE" | "HUILE_RECUPEREE";

export interface Reception {
  id: string;
  number: string;
  date: string;
  time: string;
  supplierId: string;
  weightKg: number;
  variety: string;
  origin: string;
  pricePerKg: number;
  total: number;
  condition: "Bon" | "Moyen" | "Mauvais";
  notes: string;
  clientChoice: ClientChoice;
  soldKg: number;
  oilKg: number;
  paid: number;
  remaining: number;
  paymentStatus: PaymentStatus;
  transformStatus: TransformStatus;
  cancelled: boolean;
}

export interface Production {
  id: string;
  number: string;
  date: string;
  receptionId: string;
  olivesKg: number;
  oilLiters: number;
  byproductsKg: number;
  yieldPct: number;
  notes: string;
}

export type StockCategory =
  | "Huile en vrac"
  | "Bouteilles"
  | "Bidons"
  | "Bouchons"
  | "Cartons"
  | "Étiquettes"
  | "Autres emballages";

export type StockUnit = "L" | "kg" | "unité" | "carton";

export interface StockItem {
  id: string;
  name: string;
  category: StockCategory;
  quantity: number;
  unit: StockUnit;
  minQuantity: number;
  location: string;
  salePrice?: number;
  imageUrl?: string;
  bundleSize?: number;
  wholesalePrice?: number;
  wholesaleTiers?: { min: number; price: number }[];
  updatedAt: string;
}

export type MovementType = "entrée" | "sortie" | "production" | "vente" | "correction" | "perte";

export interface StockMovement {
  id: string;
  date: string;
  itemId: string;
  quantity: number;
  type: MovementType;
  userId: string;
  reference: string;
}

export type PaymentMode = "espèces" | "virement" | "chèque" | "autre";

export type SaleType = "HUILE" | "EMBALLAGE";

export interface Sale {
  id: string;
  number: string;
  date: string;
  customerId: string;
  itemId: string;
  quantity: number;
  unit: StockUnit;
  unitPrice: number;
  total: number;
  paid: number;
  remaining: number;
  paymentMode: PaymentMode;
  notes: string;
  saleType: SaleType;
}

export interface CashMovement {
  id: string;
  number: string;
  date: string;
  time: string;
  type: "ENTREE" | "SORTIE";
  amount: number;
  source: string;
  motive: string;
  reference: string;
  userId: string;
  notes: string;
}

export type ExpenseCategory =
  | "Électricité"
  | "Carburant"
  | "Transport"
  | "Maintenance"
  | "Achat emballages"
  | "Salaires"
  | "Nettoyage"
  | "Pièces de rechange"
  | "Autres";

export interface Expense {
  id: string;
  number: string;
  date: string;
  category: ExpenseCategory;
  description: string;
  amount: number;
  paymentMode: PaymentMode;
  userId: string;
}

export interface ActivityLog {
  id: string;
  userId: string;
  action: string;
  module: string;
  reference: string;
  at: string;
}

export interface Settings {
  companyName: string;
  phone: string;
  address: string;
  wilaya: string;
  taxNumber: string;
  currency: string;
  defaultUnit: "L" | "kg";
  lowStockThreshold: number;
  numberFormat: string;
  autoPrintReceipt: boolean;
  dailyPrice: number;
}

export interface AppState {
  users: User[];
  suppliers: Supplier[];
  customers: Customer[];
  receptions: Reception[];
  productions: Production[];
  stockItems: StockItem[];
  stockMovements: StockMovement[];
  sales: Sale[];
  expenses: Expense[];
  cashMovements: CashMovement[];
  logs: ActivityLog[];
  settings: Settings;
}
