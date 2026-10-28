import { z } from "zod/v4";

const quantity = z.number().finite().min(0).nullable();

export const inventoryLineSchema = z.object({
  productId: z.string().min(1).max(80),
  remainingQuantity: quantity,
  orderQuantity: z.number().int().min(0).nullable(),
});

export const reportSchema = z.object({
  reportDate: z.iso.date(),
  nextDate: z.iso.date(),
  orderStatus: z.enum(["ORDER", "NO_ORDER"]),
  recorderName: z.string().trim().min(1).max(120),
  lines: z.array(inventoryLineSchema).min(1).max(100),
}).superRefine((value, ctx) => {
  const ids = value.lines.map((line) => line.productId);
  if (new Set(ids).size !== ids.length) {
    ctx.addIssue({ code: "custom", path: ["lines"], message: "ห้ามเลือกสินค้าเดิมซ้ำในรายงาน" });
  }
});

export const updateReportSchema = reportSchema.extend({
  version: z.number().int().min(1),
});

export const productSchema = z.object({
  sourceNumber: z.number().int().min(1).optional(),
  nameTh: z.string().trim().min(1).max(160),
  labelMy: z.string().trim().max(160).default(""),
  stockUnit: z.string().trim().min(1).max(40),
  purchaseUnit: z.string().trim().min(1).max(40),
  recommendedBags: z.number().int().min(0).nullable(),
  itemsPerBag: z.number().int().min(0).nullable(),
  hasStockField: z.boolean(),
  isActive: z.boolean().default(true),
});

export const updateProductSchema = productSchema.extend({
  version: z.number().int().min(1),
});

export type ReportPayload = z.infer<typeof reportSchema>;
export type ProductPayload = z.infer<typeof productSchema>;
