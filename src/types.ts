export interface Env {
  DB: D1Database;
  ASSETS: Fetcher;
  PUBLIC_FORM_LIMITER: RateLimit;
  ENVIRONMENT?: string;
  ADMIN_EMAILS?: string;
  DEV_ADMIN_EMAIL?: string;
  CF_ACCESS_ISSUER?: string;
  CF_ACCESS_AUD?: string;
  MCP_ENABLED?: string;
}

export interface AdminIdentity {
  email: string;
  subject?: string;
}

export interface Product {
  id: string;
  sourceNumber: number;
  sortOrder: number;
  nameTh: string;
  labelMy: string;
  stockUnit: string;
  purchaseUnit: string;
  recommendedBags: number | null;
  itemsPerBag: number | null;
  hasStockField: boolean;
  isActive: boolean;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export type OrderStatus = "ORDER" | "NO_ORDER";

export interface InventoryLineInput {
  productId: string;
  remainingQuantity: number | null;
  orderQuantity: number | null;
}

export interface DailyReportInput {
  reportDate: string;
  nextDate: string;
  orderStatus: OrderStatus;
  recorderName: string;
  lines: InventoryLineInput[];
  version?: number;
}

export interface DailyReportSummary {
  id: string;
  reportDate: string;
  nextDate: string;
  orderStatus: OrderStatus;
  recorderName: string;
  createdBy: string;
  version: number;
  createdAt: string;
  updatedAt: string;
  lineCount: number;
  orderBagCount: number;
}

export interface DailyReportDetail extends DailyReportSummary {
  lines: Array<InventoryLineInput & {
    id: string;
    productNameTh: string;
    productLabelMy: string;
    stockUnit: string;
    purchaseUnit: string;
    recommendedBags: number | null;
    itemsPerBag: number | null;
  }>;
}
